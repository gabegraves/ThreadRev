"""context_store — conversation-memory storage + retrieval extracted from Zamp pantheon.

Only the pure, dependency-light modules are imported eagerly so tests can run
without pgvector / asyncpg / openai installed:

    from context_store import chunking, mmr, constants

DB-backed modules are imported explicitly by callers:

    from context_store.store import MessageChunksStore
    from context_store.search import SearchService
    from context_store.embeddings import OpenAIEmbedder
"""

from context_store import chunking, constants, mmr  # noqa: F401
