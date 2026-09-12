# adapted from pantheon_v2/platform/messages/repository/message_chunks_store.py
# and       pantheon_v2/platform/messages/services/etl_service.py (index_message)
# ChunkRow adapted from pantheon_v2/platform/messages/models/etl_models.py
"""Write path for ``message_chunks``: classify -> embed -> idempotent insert.

Changes vs upstream:
- Idempotency key is ``(channel, message_ts, chunk_index)`` plus
  ``doc_sha256 IS NOT DISTINCT FROM :doc_sha256`` instead of
  ``message_event_id``. The extra term is needed because a
  ``document_read`` is ingested separately from the ``message_read`` that
  named it and would otherwise collide on ``chunk_index``. The NOT EXISTS
  probe is kept (as ``INSERT ... SELECT ... WHERE NOT EXISTS``).
- ``get_unindexed_events_for_message`` / ``scan_missing_messages`` dropped:
  they read pantheon's ``messages`` / ``message_events`` tables.
- ``with_session`` / ``PostgresService`` replaced by an injected
  ``async_sessionmaker``. ActionsHub embedding call replaced by ``Embedder``.
"""

from __future__ import annotations

from datetime import datetime
from typing import List, Optional
from uuid import UUID

from pgvector.sqlalchemy import Vector
from pydantic import BaseModel
from sqlalchemy import and_, exists, literal, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import async_sessionmaker

from context_store.chunking import classify_event_payload
from context_store.constants import EMBEDDING_DIM
from context_store.embeddings import Embedder
from context_store.models import MessageChunk
from context_store.text_chunking import token_count


class ChunkRow(BaseModel):
    """A row destined for message_chunks."""

    message_event_id: Optional[UUID] = None
    message_id: Optional[UUID] = None
    channel: str
    thread_ts: str
    message_ts: str
    doc_sha256: Optional[str] = None
    locator: Optional[str] = None
    quote: Optional[str] = None
    element_id: Optional[str] = None
    element_type: str
    source_mode: str
    chunk_index: int
    chunk_text: str
    token_count: int
    embedding: List[float]
    embedding_model: str
    message_created_at: datetime


async def build_chunk_rows(
    *,
    channel: str,
    thread_ts: str,
    message_ts: str,
    message_created_at: datetime,
    event_payload: dict,
    embedder: Embedder,
    doc_sha256: Optional[str] = None,
) -> List[ChunkRow]:
    """Classify + embed one message (or one document) into ChunkRows.

    Mirrors the per-event loop of upstream ``ETLService.index_message``.
    ``chunk_index`` enumerates across all classifications of the payload.
    A ``doc_sha256`` passed here applies to every chunk; a per-element
    ``doc_sha256`` on the element dict wins over it.
    """

    rows: List[ChunkRow] = []
    for idx, c in enumerate(classify_event_payload(event_payload or {})):
        embedding = await embedder.embed(c.text)
        if len(embedding) != EMBEDDING_DIM:
            raise RuntimeError(
                f"embedding dim mismatch: got {len(embedding)}, expected {EMBEDDING_DIM}"
            )
        rows.append(
            ChunkRow(
                channel=channel,
                thread_ts=thread_ts,
                message_ts=message_ts,
                doc_sha256=c.doc_sha256 or doc_sha256,
                locator=c.locator,
                element_id=c.element_id,
                element_type=c.element_type,
                source_mode=c.source_mode,
                chunk_index=idx,
                chunk_text=c.text,
                token_count=token_count(c.text),
                embedding=embedding,
                embedding_model=embedder.model_name,
                message_created_at=message_created_at,
            )
        )
    return rows


class MessageChunksStore:
    """Repository for ``message_chunks``: chunk writes."""

    def __init__(self, sessionmaker: async_sessionmaker):
        self.sessionmaker = sessionmaker

    # ── Write path ────────────────────────────────────────────────────

    async def insert_chunks(self, chunks: List[ChunkRow]) -> int:
        """Insert rows whose ``(channel, message_ts, doc_sha256, chunk_index)``
        is not already present. Returns the number of rows written."""
        if not chunks:
            return 0
        written = 0
        async with self.sessionmaker() as session, session.begin():
            for c in chunks:
                written += await self._insert_if_missing(session, c)
        return written

    @staticmethod
    async def _insert_if_missing(session, c: ChunkRow) -> int:
        already = exists().where(
            and_(
                MessageChunk.channel == c.channel,
                MessageChunk.message_ts == c.message_ts,
                MessageChunk.chunk_index == c.chunk_index,
                MessageChunk.doc_sha256.is_not_distinct_from(c.doc_sha256),
            )
        )
        values = c.model_dump()
        cols = list(values.keys())
        literals = [
            literal(values["embedding"], Vector(EMBEDDING_DIM)).label("embedding")
            if col == "embedding"
            else literal(values[col], getattr(MessageChunk, col).type).label(col)
            for col in cols
        ]
        stmt = pg_insert(MessageChunk).from_select(
            cols, select(*literals).where(~already)
        )
        result = await session.execute(stmt)
        return int(result.rowcount or 0)
