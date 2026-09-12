# adapted from pantheon_v2/platform/messages/constants.py
# and       pantheon_v2/platform/conversations_v4/search/constants.py
"""Tuning constants for chunk indexing and retrieval.

Indexing-side values (embedding model, chunking, element classification)
come from ``platform/messages/constants.py``; retrieval-side values
(``HNSW_*``, ``COLLAPSE_TOP_K``, ``MMR_LAMBDA_DEFAULT``, ...) come from
``conversations_v4/search/constants.py``. Merged into one module because
this package has a single consumer. Temporal activity / workflow / retry
identifiers and the side-panel entity constants were dropped.
"""

# ── Embedding configuration ────────────────────────────────────────────
EMBEDDING_MODEL_NAME: str = "text-embedding-3-small"
EMBEDDING_DIM: int = 1536

# ── Chunking (applied by chunking via text_chunking) ───────────────────
CHUNK_MAX_TOKENS: int = 512
CHUNK_OVERLAP_TOKENS: int = 64
TOOL_RESULT_TOKEN_CAP: int = 8000
TOOL_USE_INLINE_MAX_BYTES: int = 2048

# ── Element types (the ``type`` field on an element) ───────────────────
ELEMENT_TYPE_MARKDOWN: str = "markdown"
ELEMENT_TYPE_PLAIN_TEXT: str = "plain_text"
ELEMENT_TYPE_USER_INPUT: str = "user_input"
ELEMENT_TYPE_THINKING: str = "thinking"
ELEMENT_TYPE_TOOL_USE: str = "tool_use"
ELEMENT_TYPE_TOOL_RESULT: str = "tool_result"

# ── Element classification ─────────────────────────────────────────────
PRIMARY_ELEMENT_TYPES: frozenset[str] = frozenset(
    {ELEMENT_TYPE_MARKDOWN, ELEMENT_TYPE_PLAIN_TEXT, ELEMENT_TYPE_USER_INPUT}
)
SOURCE_MODE_DIRECT: str = "direct"
SOURCE_MODE_THINKING: str = "thinking"
SOURCE_MODE_TOOL_CALL: str = "tool_call"
SOURCE_MODE_TOOL_RESULT: str = "tool_result"

# ── Retrieval pipeline ─────────────────────────────────────────────────
HNSW_TOP_K: int = 200
# pgvector HNSW `ef_search` controls how many candidates the graph explores
# before truncating to LIMIT. Default is 40 — too low to reliably fill a
# top-200 from a 6k-chunk corpus. Set it ≥ HNSW_TOP_K so the ANN step
# never runs out of candidates before we hit LIMIT.
HNSW_EF_SEARCH: int = 400
# Enforced at import time because `HNSW_EF_SEARCH` is f-stringed into a
# SET LOCAL statement in search.py (SET LOCAL does not accept bind
# params). Keeping this an int is load-bearing for that suppression.
assert isinstance(HNSW_EF_SEARCH, int)
COLLAPSE_TOP_K: int = 20
MMR_LAMBDA_DEFAULT: float = (
    0.9  # lean toward relevance; diversity helps only marginally on the hard eval
)
STRONG_MATCH_THRESHOLD: float = (
    0.35  # cosine distance; < 0.35 counts as a "strong" match
)
# Drop collapsed matches whose best chunk is farther than this.
# 0.7 cosine distance on text-embedding-3-small is the rough boundary
# between "loosely related" and "unrelated"; tuned so a query like
# "what sweet food do I like" doesn't pull back unrelated greetings.
MAX_DISTANCE_DEFAULT: float = 0.7
DENSITY_ALPHA_DEFAULT: float = 0.0  # 0 = no density weighting at v1
