# adapted from pantheon_v2/platform/messages/services/element_builder.py
# ElementClassification adapted from pantheon_v2/platform/messages/models/etl_models.py
"""Classify a message's ``elements`` into embeddable chunks.

Pure functions, Temporal-free. Input is the same ``{"elements": [...]}``
dict shape pantheon persists on ``message_events.event_payload``; each
element is ``{"id", "type", "payload": {...}}``. ThreadRev additions: an
element may carry top-level ``doc_sha256`` and ``locator`` keys, which are
copied onto every chunk produced from it (see ``classify_event_payload``).
"""

from __future__ import annotations

import json
from typing import List, Optional

from pydantic import BaseModel

from context_store.constants import (
    CHUNK_MAX_TOKENS,
    CHUNK_OVERLAP_TOKENS,
    ELEMENT_TYPE_THINKING,
    ELEMENT_TYPE_TOOL_RESULT,
    ELEMENT_TYPE_TOOL_USE,
    PRIMARY_ELEMENT_TYPES,
    SOURCE_MODE_DIRECT,
    SOURCE_MODE_THINKING,
    SOURCE_MODE_TOOL_CALL,
    SOURCE_MODE_TOOL_RESULT,
    TOOL_RESULT_TOKEN_CAP,
    TOOL_USE_INLINE_MAX_BYTES,
)
from context_store.text_chunking import cap_text, split_with_overlap, token_count


class ElementClassification(BaseModel):
    """One classified unit out of ``event_payload.elements``.

    ``is_primary`` stays on the in-memory classification for caller
    convenience, but it is NOT persisted — ``message_chunks`` has no such
    column; queries filter by ``element_type IN (...)`` instead.

    ``doc_sha256`` / ``locator`` are ThreadRev additions carried through
    from the source element so the stored chunk can be mapped back onto a
    finding ``sources[]`` entry.
    """

    element_id: Optional[str] = None
    element_type: str
    source_mode: str
    is_primary: bool
    text: str
    doc_sha256: Optional[str] = None
    locator: Optional[str] = None


def _extract_element_text(element: dict) -> Optional[str]:
    """Get the text carried by one element dict, whatever its shape."""

    payload = element.get("payload") or {}
    # Direct text elements.
    for key in ("text", "markdown", "content", "value"):
        val = payload.get(key)
        if isinstance(val, str) and val.strip():
            return val
    return None


def _classify_one(element: dict) -> List[ElementClassification]:
    """Turn one raw element dict into one-or-more classified embeddable chunks.

    Returns a list because tool_use / tool_result payloads may exceed one
    embedding window and get split, and because empty elements return [].
    """

    element_id = element.get("id")
    etype = (element.get("type") or "").strip()

    # ── Primary text elements: markdown / plain_text / user_input ─────
    if etype in PRIMARY_ELEMENT_TYPES:
        text = _extract_element_text(element)
        if not text:
            return []
        return [
            ElementClassification(
                element_id=element_id,
                element_type=etype,
                source_mode=SOURCE_MODE_DIRECT,
                is_primary=True,
                text=text,
            )
            for text in _chunked(text)
        ]

    # ── Thinking — secondary, diversifier only ────────────────────────
    if etype == ELEMENT_TYPE_THINKING:
        text = _extract_element_text(element)
        if not text:
            return []
        return [
            ElementClassification(
                element_id=element_id,
                element_type=etype,
                source_mode=SOURCE_MODE_THINKING,
                is_primary=False,
                text=text,
            )
            for text in _chunked(text)
        ]

    # ── Tool use — embed tool name + input JSON ───────────────────────
    if etype == ELEMENT_TYPE_TOOL_USE:
        payload = element.get("payload") or {}
        tool_name = payload.get("name") or payload.get("tool_name") or "tool_use"
        tool_input = payload.get("input") or payload.get("arguments") or {}
        try:
            input_json = json.dumps(tool_input, sort_keys=True, default=str)
        except (TypeError, ValueError):
            input_json = str(tool_input)
        combined = f"{tool_name}\n{input_json}"
        if len(combined.encode("utf-8")) > TOOL_USE_INLINE_MAX_BYTES:
            # Large tool_use — chunk as usual.
            pieces = _chunked(combined)
        else:
            pieces = [combined]
        return [
            ElementClassification(
                element_id=element_id,
                element_type=etype,
                source_mode=SOURCE_MODE_TOOL_CALL,
                is_primary=False,
                text=piece,
            )
            for piece in pieces
        ]

    # ── Tool result — cap then chunk ──────────────────────────────────
    if etype == ELEMENT_TYPE_TOOL_RESULT:
        text = _extract_element_text(element)
        if not text:
            # Non-text payloads: stringify for reference.
            payload = element.get("payload") or {}
            try:
                text = json.dumps(payload, sort_keys=True, default=str)
            except (TypeError, ValueError):
                text = str(payload)
            if not text.strip():
                return []
        capped = cap_text(text, TOOL_RESULT_TOKEN_CAP)
        return [
            ElementClassification(
                element_id=element_id,
                element_type=etype,
                source_mode=SOURCE_MODE_TOOL_RESULT,
                is_primary=False,
                text=piece,
            )
            for piece in _chunked(capped)
        ]

    # Unknown element types are skipped (no useful text contract).
    return []


def _chunked(text: str) -> List[str]:
    """Split a string into <=CHUNK_MAX_TOKENS pieces with overlap.

    Short strings pass through unchanged.
    """

    if token_count(text) <= CHUNK_MAX_TOKENS:
        return [text]
    return split_with_overlap(text, CHUNK_MAX_TOKENS, CHUNK_OVERLAP_TOKENS)


def classify_event_payload(event_payload: dict) -> List[ElementClassification]:
    """Classify every element in ``event_payload.elements``.

    ThreadRev addition: top-level ``doc_sha256`` / ``locator`` on an element
    are copied onto each chunk it produces. Chunk ordering (and therefore
    ``chunk_index`` assigned by the store) is the enumeration order of this
    list, across all elements of the payload — same as upstream.
    """

    if not isinstance(event_payload, dict):
        return []
    out: List[ElementClassification] = []
    for element in event_payload.get("elements") or []:
        if not isinstance(element, dict):
            continue
        passthrough = {
            k: element[k] for k in ("doc_sha256", "locator") if element.get(k)
        }
        for c in _classify_one(element):
            out.append(c.model_copy(update=passthrough) if passthrough else c)
    return out
