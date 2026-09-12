# context-store

> **Position in ThreadRev.** The reviewer's context retrieval is the exact-match
> workspace index in `apps/channel/src/workspace.ts` (document name, unit,
> quantity words, author, channel; every hit up to the trigger, no ranking).
> This package is the optional similarity layer that sits **behind** that exact
> match, for synonyms across channels, and it is later work: it is not wired
> into the reviewer, not part of `npm run verify`, and nothing in the demo
> depends on it. If it is ever registered, retrieved chunks feed `run_check`
> inputs only; the model never computes a number from retrieved text, and every
> chunk that reaches a card must carry `sha256` / `locator` / `quote`.


Conversation-memory chunk storage and 3-stage retrieval (pgvector HNSW top-K
-> per-thread collapse -> MMR), extracted from Zamp's pantheon platform for
ThreadRev.

## Provenance

Source: Zamp `pantheon` repo, `pantheon_v2/` (read-only mirror). Zamp cleared
this slice for public release — team lead confirmation, 2026-09-12.

| This package | Upstream file |
|---|---|
| `migrations/001_message_chunks.sql` | `app-migrations/super/20260421211000_enable_pgvector.up.sql`, `app-migrations/20260424211730_init_message_chunks.up.sql` |
| `context_store/models.py` | `platform/messages/repository/schemas/message_chunk.py` |
| `context_store/chunking.py` | `platform/messages/services/element_builder.py`, `ElementClassification` from `platform/messages/models/etl_models.py` |
| `context_store/text_chunking.py` | `platform/utils/text_chunking.py` (verbatim) |
| `context_store/constants.py` | `platform/messages/constants.py` + `platform/conversations_v4/search/constants.py` |
| `context_store/store.py` | `platform/messages/repository/message_chunks_store.py`, `index_message` from `platform/messages/services/etl_service.py`, `ChunkRow` from `etl_models.py` |
| `context_store/search.py` | `platform/conversations_v4/search/repository/search_store.py`, `.../services/search_service.py`, `.../models/search_models.py` |
| `context_store/mmr.py` | `platform/utils/mmr.py` (verbatim) |
| `context_store/embeddings.py` | the `_embed` helpers in `etl_service.py` / `search_service.py` |

Not copied, only their call shape noted: the Temporal/ActionsHub activities
`platform/messages/activities/etl_activities.py` (`etl_index_message(MessageIndexInput{message_id})`,
`etl_scan_missing_messages(ETLScanInput{limit})`) and
`platform/conversations_v4/search/activities/search_activities.py`
(`search_conversations(SearchConversationsInput{query, limit, ...})`). Each was
a 5-line wrapper calling the service; here you call the service directly.

The `platform/tasks/search/` twin of the conversation search was not ported.

## What changed vs upstream

- **Temporal removed.** No ActionsHub, no activities, no `with_session` /
  `PostgresService`. `MessageChunksStore` and `SearchStore` take a SQLAlchemy
  `async_sessionmaker`; embeddings go through the `Embedder` Protocol
  (`OpenAIEmbedder` for `text-embedding-3-small`, or a fake in tests).
- **`organization_id` -> `channel` / `thread_ts` / `message_ts`.** Upstream's
  access boundary was org membership (FRAP). Here the caller passes the
  channel list it is allowed to read to `SearchInput.channels`; that list is
  the boundary. No workspace column: one deployment == one workspace.
  Optional `thread_ts` narrows to one thread. FRAP hooks
  (`get_query_filters`, `before_create/update/delete`) dropped.
- **No junction joins.** Upstream joined `MessageChunk -> MessageEvent ->
  ConversationMessage -> Conversation`; the collapse unit is now
  `(channel, thread_ts)`. Date filters apply to `message_created_at`;
  `title_contains` dropped.
- **Idempotency key.** Upstream: "chunks exist for this `message_event_id`?".
  Here: `INSERT ... SELECT ... WHERE NOT EXISTS (channel, message_ts,
  chunk_index, doc_sha256 IS NOT DISTINCT FROM ?)`. The `doc_sha256` term is
  needed because a `document_read` is ingested separately from the
  `message_read` that named it and would otherwise collide on `chunk_index`.
  Same check-then-insert race as upstream; no UNIQUE index.
- **Added columns for the card contract:** `doc_sha256`, `locator`, `quote`
  (all nullable). `message_event_id` / `message_id` kept as nullable,
  un-referenced columns; the three FKs and the `app.` schema are gone.
- **Chunking passthrough.** An element dict may carry top-level `doc_sha256`
  and `locator`; they are copied onto every chunk it produces. Chunking
  itself is unchanged: cl100k_base, 512 tokens / 64 overlap, tool_result
  capped at 8000 tokens.

## Setup

```bash
pip install -e packages/context-store
psql "$DATABASE_URL" -f packages/context-store/migrations/001_message_chunks.sql   # needs superuser for CREATE EXTENSION
```

```python
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from context_store.embeddings import OpenAIEmbedder
from context_store.store import MessageChunksStore, build_chunk_rows
from context_store.search import SearchService, SearchStore, SearchInput

engine = create_async_engine("postgresql+asyncpg://...")
sessions = async_sessionmaker(engine, expire_on_commit=False)
embedder = OpenAIEmbedder()  # OPENAI_API_KEY
store = MessageChunksStore(sessions)
search = SearchService(SearchStore(sessions), embedder)
```

## How ThreadRev calls it

### Ingest on `message_read`

`packages/agent-core/src/contracts/evidence.ts` `messageRead` -> one call.
`thread_ts` is the Slack thread ts (`thread` in the event); for a top-level
message pass `thread_ts = message_ts`.

```python
rows = await build_chunk_rows(
    channel=channel,                       # Slack channel id
    thread_ts=event["thread"],
    message_ts=event["ts"],
    message_created_at=ts_to_datetime(event["ts"]),
    event_payload={"elements": [
        {"id": event["ts"], "type": "user_input", "payload": {"text": event["text"]}},
    ]},
    embedder=embedder,
)
await store.insert_chunks(rows)            # re-running is a no-op
```

### Ingest on `document_read`

`documentRead` -> one call. Feed each extracted paragraph as its own element
so `locator` stays per-line; `element_id` carries the filename, which is the
evidenceRef `id` for documents.

```python
rows = await build_chunk_rows(
    channel=channel,
    thread_ts=event["thread"],
    message_ts=event.get("named_in_ts") or event.get("trigger_ts"),
    message_created_at=ts_to_datetime(event.get("named_in_ts") or event.get("trigger_ts")),
    event_payload={"elements": [
        {"id": event["document"], "type": "plain_text",
         "doc_sha256": event["sha256"], "locator": f"line {line['n']}",
         "payload": {"text": line["text"]}}
        for line in extracted_lines
    ]},
    embedder=embedder,
    doc_sha256=event["sha256"],
)
await store.insert_chunks(rows)
```

A new revision has a new `sha256`, so its chunks are new rows; the old
revision's chunks stay (evidence history is preserved, per SCRATCHPAD.md).

### Retrieve for a finding

```python
out = await search.search(SearchInput(
    query="bus capacitance correction precharge",
    channels=allowed_channel_ids,          # access boundary
    limit=5,
))
```

Result order: strong-match density, then best distance, then MMR
(`mmr_lambda` 0.9). Matches with best cosine distance > 0.7 are dropped
before MMR. `created_at` on each result is the representative message's
time — when two results disagree, the later one is the current truth
(same rule as `latestRevision()`).

### Every retrieved chunk -> one `sources[]` entry

`ThreadSearchResult` maps onto `evidenceRef` in
`packages/agent-core/src/contracts/finding.ts`:

| evidenceRef | from result |
|---|---|
| `kind` | `"document"` if `doc_sha256` is set, else `"message"` |
| `id` | `element_id` (document filename) for documents; `message_ts` for messages |
| `revision` | documents only: `/-(r\d+)\b/` on `element_id` (same regex as `reviewer-tools.tsx`) |
| `sha256` | `doc_sha256` |
| `locator` | `locator` |
| `quote` | `quote` if set, else `representative_text[:300]` (contract caps at 300) |

`quote` is NULL at ingest — nothing derives it — so the reviewer trims
`representative_text` when building the card.

## Convex equivalent (hosted storage)

SCRATCHPAD.md (2026-09-12) chose Convex for hosted evidence storage. The
same table as a Convex `vectorIndex`; `filterFields` mirror the SQL WHERE
clauses (`channel`, `thread_ts`, `element_type`):

```ts
// convex/schema.ts
messageChunks: defineTable({
  channel: v.string(),
  threadTs: v.string(),
  messageTs: v.string(),
  docSha256: v.optional(v.string()),
  locator: v.optional(v.string()),
  quote: v.optional(v.string()),
  elementId: v.optional(v.string()),
  elementType: v.string(),
  sourceMode: v.string(),
  chunkIndex: v.number(),
  chunkText: v.string(),
  tokenCount: v.optional(v.number()),
  embedding: v.array(v.float64()),
  embeddingModel: v.string(),
  messageCreatedAt: v.number(),
})
  .index("by_message", ["channel", "messageTs", "chunkIndex"])
  .vectorIndex("by_embedding", {
    vectorField: "embedding",
    dimensions: 1536,
    filterFields: ["channel", "threadTs", "elementType"],
  }),
```

`ctx.vectorSearch("messageChunks", "by_embedding", { vector, limit: 200,
filter: q => q.or(...channels.map(c => q.eq("channel", c))) })` replaces
the HNSW step (Convex `limit` max is 256; `_score` is cosine similarity,
so `distance = 1 - _score`). Collapse and `mmr_rerank` run unchanged on
the returned rows. Idempotency: query `by_message` for
`(channel, messageTs, chunkIndex)` and compare `docSha256` inside the
insert mutation. Date filters are not `filterFields` (equality only) —
apply them after the search.

## Tests

No database, no network (tiktoken's encoder is replaced by a whitespace
tokenizer in the test module):

```bash
python -m unittest discover -s packages/context-store/tests
```
