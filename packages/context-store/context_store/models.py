# adapted from pantheon_v2/platform/messages/repository/schemas/message_chunk.py
"""ORM for ``message_chunks`` — one row per embeddable element.

Changes vs upstream:
- No ``app.`` schema, no FKs: ThreadRev has no ``messages`` /
  ``message_events`` / ``organizations`` tables. ``message_event_id`` and
  ``message_id`` are kept as nullable, un-referenced columns.
- ``organization_id`` (the upstream access boundary) is replaced by
  ``channel`` + ``thread_ts`` + ``message_ts``; the allowed-channel list is
  the access boundary at query time (see ``search.py``).
- ThreadRev card-contract columns added: ``doc_sha256``, ``locator``,
  ``quote`` (all nullable) — they map 1:1 onto ``evidenceRef`` in
  ``packages/agent-core/src/contracts/finding.ts``.
- FRAP hooks (``get_query_filters`` / ``before_create`` / ``before_update``
  / ``before_delete``) dropped — they depend on pantheon's auth context.
"""

import uuid
from datetime import datetime, timezone
from typing import Optional

from pgvector.sqlalchemy import Vector
from sqlalchemy import BigInteger, DateTime, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

from context_store.constants import EMBEDDING_DIM


class Base(DeclarativeBase):
    pass


class MessageChunk(Base):
    """One row per embeddable unit (element or chunk of an element)."""

    __tablename__ = "message_chunks"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)

    # Upstream provenance columns, kept but no longer FK-bound.
    message_event_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), nullable=True
    )
    message_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), nullable=True
    )

    # ThreadRev provenance — Slack coordinates. ``thread_ts`` equals
    # ``message_ts`` for a top-level message.
    channel: Mapped[str] = mapped_column(Text, nullable=False)
    thread_ts: Mapped[str] = mapped_column(Text, nullable=False)
    message_ts: Mapped[str] = mapped_column(Text, nullable=False)

    # ThreadRev card contract (evidenceRef). ``doc_sha256`` set => the chunk
    # came from a document (``kind: "document"``); NULL => a message.
    doc_sha256: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    locator: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    quote: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    element_id: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    element_type: Mapped[str] = mapped_column(Text, nullable=False)
    source_mode: Mapped[str] = mapped_column(Text, nullable=False)
    chunk_index: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    chunk_text: Mapped[str] = mapped_column(Text, nullable=False)
    token_count: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    embedding: Mapped[list[float]] = mapped_column(
        Vector(EMBEDDING_DIM), nullable=False
    )
    embedding_model: Mapped[str] = mapped_column(String, nullable=False)

    message_created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
