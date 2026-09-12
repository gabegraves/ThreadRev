-- adapted from pantheon_v2/app-migrations/super/20260421211000_enable_pgvector.up.sql
--          and pantheon_v2/app-migrations/20260424211730_init_message_chunks.up.sql
-- ============================================================
-- message_chunks — message/document-level vector search storage.
--
-- Changes vs upstream: no `app.` schema; the three FKs
-- (message_events / messages / organizations) are gone because
-- ThreadRev has no such tables; organization_id is replaced by
-- channel / thread_ts / message_ts; doc_sha256 / locator / quote
-- added for the finding card contract.
--
-- CREATE EXTENSION needs a superuser on managed Postgres (RDS
-- etc.) — run this file under a privileged DSN or split the first
-- statement out, as upstream did.
-- ============================================================
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS message_chunks (
    id                    BIGSERIAL PRIMARY KEY,

    -- Upstream provenance columns, kept but no longer FK-bound.
    message_event_id      UUID,
    message_id            UUID,

    -- ThreadRev provenance. thread_ts = message_ts for a top-level
    -- message. Idempotency probe (store.py) is
    -- (channel, message_ts, chunk_index, doc_sha256 IS NOT DISTINCT FROM).
    channel               TEXT NOT NULL,
    thread_ts             TEXT NOT NULL,
    message_ts            TEXT NOT NULL,

    -- Finding card contract (evidenceRef). doc_sha256 set => document.
    doc_sha256            TEXT,
    locator               TEXT,
    quote                 TEXT,

    -- What this chunk is. The "primary vs secondary" distinction
    -- is a pure function of element_type + source_mode (see
    -- context_store/chunking.py), so there is no dedicated is_primary
    -- column — queries filter by `element_type = ANY(:primary_types)`.
    element_id            TEXT,
    element_type          TEXT NOT NULL,
    source_mode           TEXT NOT NULL,
    chunk_index           INT  NOT NULL DEFAULT 0,
    chunk_text            TEXT NOT NULL,
    token_count           INT,

    -- The vector.
    embedding             vector(1536) NOT NULL,
    embedding_model       TEXT NOT NULL,

    -- Timestamps.
    message_created_at    TIMESTAMPTZ NOT NULL,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Single HNSW index over all chunks. Primary vs secondary element
-- separation is handled at the query layer (see search.py —
-- `WHERE element_type IN (...)`), so one index serves every search
-- variant. ef_construction is build-time; ef_search is the runtime
-- knob, set per query via `SET LOCAL hnsw.ef_search = N`.
CREATE INDEX IF NOT EXISTS idx_msg_chunks_embedding
    ON message_chunks
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);

-- Btrees for the hot read / write paths.
--   *_msg:     NOT EXISTS probe on insert.
--   *_thread:  channel / thread filters on search.
--   *_created: recency ordering.
CREATE INDEX IF NOT EXISTS idx_msg_chunks_msg
    ON message_chunks (channel, message_ts);
CREATE INDEX IF NOT EXISTS idx_msg_chunks_thread
    ON message_chunks (channel, thread_ts);
CREATE INDEX IF NOT EXISTS idx_msg_chunks_msg_created
    ON message_chunks (message_created_at DESC);
