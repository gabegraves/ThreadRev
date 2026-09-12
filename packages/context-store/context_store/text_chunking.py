# adapted from pantheon_v2/platform/utils/text_chunking.py (verbatim)
"""Pure text-processing helpers for embedding/retrieval pipelines.

These are ordinary importable functions — no I/O, no activities, no side
effects. Any module that needs to chunk text imports these directly (no
ActionsHub hop needed).
"""

from __future__ import annotations

from typing import List, Optional

import tiktoken

_ENCODER_NAME = "cl100k_base"
_encoder: Optional["tiktoken.Encoding"] = None


def _get_encoder() -> "tiktoken.Encoding":
    global _encoder
    if _encoder is None:
        _encoder = tiktoken.get_encoding(_ENCODER_NAME)
    return _encoder


def token_count(text: str) -> int:
    """Return the number of cl100k_base tokens in `text`."""
    if not text:
        return 0
    return len(_get_encoder().encode(text))


def cap_text(text: str, max_tokens: int) -> str:
    """Truncate `text` to at most `max_tokens` tokens, preserving a token boundary.

    Returns the original string unchanged if it already fits.
    """
    if not text or max_tokens <= 0:
        return "" if max_tokens <= 0 else text
    encoder = _get_encoder()
    tokens = encoder.encode(text)
    if len(tokens) <= max_tokens:
        return text
    return encoder.decode(tokens[:max_tokens])


def split_with_overlap(text: str, max_tokens: int, overlap: int) -> List[str]:
    """Split `text` into chunks of at most `max_tokens` tokens with `overlap` token overlap.

    - Text that fits in a single chunk is returned as a single-element list.
    - Empty / whitespace-only input returns an empty list.
    - `overlap` must be strictly less than `max_tokens`.
    """
    if not text or not text.strip():
        return []
    if max_tokens <= 0:
        raise ValueError("max_tokens must be > 0")
    if overlap < 0:
        raise ValueError("overlap must be >= 0")
    if overlap >= max_tokens:
        raise ValueError("overlap must be < max_tokens")

    encoder = _get_encoder()
    tokens = encoder.encode(text)
    if len(tokens) <= max_tokens:
        return [text]

    step = max_tokens - overlap
    chunks: List[str] = []
    start = 0
    while start < len(tokens):
        end = min(start + max_tokens, len(tokens))
        chunks.append(encoder.decode(tokens[start:end]))
        if end == len(tokens):
            break
        start += step
    return chunks
