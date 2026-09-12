# adapted from pantheon_v2/platform/conversations_v4/search/repository/search_store.py,
#              pantheon_v2/platform/conversations_v4/search/services/search_service.py
#          and pantheon_v2/platform/conversations_v4/search/models/search_models.py
"""Three-stage retrieval: embed -> HNSW top-K + collapse -> MMR -> shape output.

Changes vs upstream:
- No junction joins (``MessageEvent -> ConversationMessage -> Conversation``)
  and no FRAP: the caller passes the ``channels`` it is allowed to read and
  that list is the access boundary. Optional ``thread_ts`` narrows further.
- Collapse unit is ``(channel, thread_ts)`` — the Slack thread is the
  conversation analog. Each result is still one representative chunk and
  carries the evidenceRef fields (``message_ts``, ``doc_sha256``,
  ``locator``, ``quote``, ``element_id``).
- Date filters apply to ``message_created_at`` (upstream:
  ``Conversation.created_at``). ``title_contains`` dropped — no title.
- ``with_session(force_transactional=True)`` replaced by
  ``async with session.begin()`` so ``SET LOCAL hnsw.ef_search`` survives.
"""

from __future__ import annotations

from collections import defaultdict
from datetime import datetime
from typing import Dict, List, Optional, Sequence, Tuple

from pydantic import BaseModel, Field
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import async_sessionmaker

from context_store.constants import (
    COLLAPSE_TOP_K,
    DENSITY_ALPHA_DEFAULT,
    EMBEDDING_DIM,
    HNSW_EF_SEARCH,
    HNSW_TOP_K,
    MAX_DISTANCE_DEFAULT,
    MMR_LAMBDA_DEFAULT,
    PRIMARY_ELEMENT_TYPES,
    STRONG_MATCH_THRESHOLD,
)
from context_store.embeddings import Embedder
from context_store.mmr import mmr_rerank
from context_store.models import MessageChunk


# ── Models ─────────────────────────────────────────────────────────────


class SearchInput(BaseModel):
    """``query`` / ``channels`` / ``limit`` are the typical knobs; the rest
    are tuning overrides used mainly by evals."""

    query: str = Field(description="Natural-language search query.")
    channels: List[str] = Field(
        min_length=1,
        description="Channels the caller may read. This is the access boundary.",
    )
    thread_ts: Optional[str] = Field(default=None, description="Restrict to one thread.")
    limit: int = Field(default=COLLAPSE_TOP_K, ge=1, le=100)
    mmr_lambda: float = Field(default=MMR_LAMBDA_DEFAULT, ge=0.0, le=1.0)
    density_alpha: float = Field(default=DENSITY_ALPHA_DEFAULT, ge=0.0)
    max_distance: float = Field(
        default=MAX_DISTANCE_DEFAULT,
        ge=0.0,
        le=2.0,
        description=(
            "Drop matches whose best cosine distance exceeds this. "
            "Defaults to 0.7 — past that on text-embedding-3-small the "
            "matches are usually unrelated to the query."
        ),
    )
    element_types: Optional[List[str]] = Field(
        default=None,
        description=(
            "Narrow past the default primary-element set "
            "(markdown / plain_text / user_input)."
        ),
    )
    created_after: Optional[datetime] = Field(default=None)
    created_before: Optional[datetime] = Field(default=None)


class ThreadSearchResult(BaseModel):
    channel: str
    thread_ts: str
    best_distance: float
    strong_match_count: int
    representative_text: str
    # evidenceRef fields of the representative chunk.
    message_ts: str
    element_id: Optional[str] = None
    doc_sha256: Optional[str] = None
    locator: Optional[str] = None
    quote: Optional[str] = None
    created_at: datetime = Field(
        description=(
            "Timestamp of the representative message, in UTC. Use this to "
            "resolve contradictions between matches: when two results "
            "disagree, the one with the later created_at is the current "
            "truth."
        ),
    )


class SearchOutput(BaseModel):
    results: List[ThreadSearchResult] = Field(default_factory=list)


class CollapsedMatch(BaseModel):
    """Per-thread aggregation produced by the HNSW+collapse step."""

    channel: str
    thread_ts: str
    best_distance: float
    strong_match_count: int
    representative_chunk_id: int
    representative_text: str
    representative_embedding: List[float]
    message_ts: str
    element_id: Optional[str] = None
    doc_sha256: Optional[str] = None
    locator: Optional[str] = None
    quote: Optional[str] = None
    created_at: datetime


# ── Repository ─────────────────────────────────────────────────────────


class SearchStore:
    """Repository for the channel-scoped search query."""

    def __init__(self, sessionmaker: async_sessionmaker):
        self.sessionmaker = sessionmaker

    async def search_and_collapse(
        self,
        *,
        query_embedding: Sequence[float],
        channels: Sequence[str],
        limit: int,
        thread_ts: Optional[str] = None,
        element_types: Optional[Sequence[str]] = None,
        created_after: Optional[datetime] = None,
        created_before: Optional[datetime] = None,
    ) -> List[CollapsedMatch]:
        """HNSW top-K + per-thread collapse + strong-match count.

        The collapse / density / rank step runs in Python on
        <=``HNSW_TOP_K`` rows.
        """

        q_vec = list(query_embedding)
        distance = MessageChunk.embedding.cosine_distance(q_vec)

        primary = list(element_types) if element_types else list(PRIMARY_ELEMENT_TYPES)

        where_clauses = [
            MessageChunk.element_type.in_(primary),
            MessageChunk.channel.in_(list(channels)),
        ]
        if thread_ts:
            where_clauses.append(MessageChunk.thread_ts == thread_ts)
        if created_after is not None:
            where_clauses.append(MessageChunk.message_created_at >= created_after)
        if created_before is not None:
            where_clauses.append(MessageChunk.message_created_at <= created_before)

        stmt = (
            select(
                MessageChunk.id.label("chunk_id"),
                MessageChunk.channel.label("channel"),
                MessageChunk.thread_ts.label("thread_ts"),
                MessageChunk.message_ts.label("message_ts"),
                MessageChunk.element_id.label("element_id"),
                MessageChunk.doc_sha256.label("doc_sha256"),
                MessageChunk.locator.label("locator"),
                MessageChunk.quote.label("quote"),
                MessageChunk.message_created_at.label("created_at"),
                MessageChunk.chunk_text.label("chunk_text"),
                MessageChunk.embedding.label("embedding"),
                distance.label("distance"),
            )
            .where(*where_clauses)
            .order_by(distance)
            .limit(HNSW_TOP_K)
        )

        async with self.sessionmaker() as session, session.begin():
            await session.execute(text(f"SET LOCAL hnsw.ef_search = {HNSW_EF_SEARCH}"))
            rows = (await session.execute(stmt)).all()
        return _collapse_and_rank(rows, limit=limit)


def _collapse_and_rank(rows, *, limit: int) -> List[CollapsedMatch]:
    """Reproduce the old best_per_conv_cte + density_cte + final ORDER BY.

    For each ``(channel, thread_ts)`` in ``rows``: pick the closest chunk as
    the representative, count chunks below ``STRONG_MATCH_THRESHOLD`` for
    density, then sort by ``(strong_match_count desc, best_distance asc)``
    and truncate to ``limit``.
    """
    best: Dict[Tuple[str, str], CollapsedMatch] = {}
    density: Dict[Tuple[str, str], int] = defaultdict(int)

    for r in rows:
        cid = (r.channel, r.thread_ts)
        if r.distance < STRONG_MATCH_THRESHOLD:
            density[cid] += 1
        existing = best.get(cid)
        if existing is None or r.distance < existing.best_distance:
            raw_emb = r.embedding
            if isinstance(raw_emb, str):
                parsed = [float(x) for x in raw_emb.strip("[]").split(",") if x]
            else:
                parsed = [float(x) for x in raw_emb]
            best[cid] = CollapsedMatch(
                channel=r.channel,
                thread_ts=r.thread_ts,
                best_distance=float(r.distance),
                strong_match_count=0,  # filled in below
                representative_chunk_id=int(r.chunk_id),
                representative_text=r.chunk_text,
                representative_embedding=parsed,
                message_ts=r.message_ts,
                element_id=r.element_id,
                doc_sha256=r.doc_sha256,
                locator=r.locator,
                quote=r.quote,
                created_at=r.created_at,
            )

    collapsed: List[CollapsedMatch] = []
    for cid, m in best.items():
        collapsed.append(
            m.model_copy(update={"strong_match_count": density.get(cid, 0)})
        )

    # Density first, then best chunk distance — same intent as the old
    # outer ORDER BY (rationale lives in ``CollapsedMatch`` consumers).
    collapsed.sort(key=lambda m: (-m.strong_match_count, m.best_distance))
    return collapsed[:limit]


# ── Service ────────────────────────────────────────────────────────────


class SearchService:
    """Embed a query and retrieve a small set of ranked thread matches."""

    def __init__(self, store: SearchStore, embedder: Embedder):
        self.store = store
        self.embedder = embedder

    async def search(self, params: SearchInput) -> SearchOutput:
        query_vec = await self._embed(params.query)

        # ANN top-200 + collapse + density. Access boundary = params.channels.
        collapsed: List[CollapsedMatch] = await self.store.search_and_collapse(
            query_embedding=query_vec,
            channels=params.channels,
            limit=params.limit,
            thread_ts=params.thread_ts,
            element_types=params.element_types,
            created_after=params.created_after,
            created_before=params.created_before,
        )

        # Drop weak matches before MMR so diversity can't promote noise.
        collapsed = [c for c in collapsed if c.best_distance <= params.max_distance]
        if not collapsed:
            return SearchOutput(results=[])

        # MMR for diversity over thread representatives.
        candidate_ids = [f"{c.channel}/{c.thread_ts}" for c in collapsed]
        candidate_vecs = [c.representative_embedding for c in collapsed]
        reranked_ids = mmr_rerank(
            query_vec=query_vec,
            candidate_vecs=candidate_vecs,
            candidate_ids=candidate_ids,
            lambda_=params.mmr_lambda,
            k=params.limit,
        )

        by_id = dict(zip(candidate_ids, collapsed))
        return SearchOutput(
            results=[
                ThreadSearchResult(
                    channel=match.channel,
                    thread_ts=match.thread_ts,
                    best_distance=match.best_distance,
                    strong_match_count=match.strong_match_count,
                    representative_text=match.representative_text,
                    message_ts=match.message_ts,
                    element_id=match.element_id,
                    doc_sha256=match.doc_sha256,
                    locator=match.locator,
                    quote=match.quote,
                    created_at=match.created_at,
                )
                for cid in reranked_ids
                if (match := by_id.get(cid)) is not None
            ]
        )

    async def _embed(self, query: str) -> List[float]:
        vec = await self.embedder.embed(query)
        if len(vec) != EMBEDDING_DIM:
            raise RuntimeError(
                f"query embedding dim mismatch: got {len(vec)}, expected {EMBEDDING_DIM}"
            )
        return vec
