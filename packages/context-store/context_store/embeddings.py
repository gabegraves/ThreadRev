# adapted from the `_embed` helpers in
#   pantheon_v2/platform/messages/services/etl_service.py and
#   pantheon_v2/platform/conversations_v4/search/services/search_service.py
"""Embedding client seam.

Upstream routed embeddings through ActionsHub -> model_orchestrator
(litellm router). Here the same contract is a tiny Protocol so a fake can
be injected in tests; ``OpenAIEmbedder`` is the production implementation
for ``text-embedding-3-small``.
"""

from __future__ import annotations

from typing import List, Optional, Protocol

from context_store.constants import EMBEDDING_DIM, EMBEDDING_MODEL_NAME


class Embedder(Protocol):
    model_name: str

    async def embed(self, text: str) -> List[float]: ...


class OpenAIEmbedder:
    """Thin ``openai.AsyncOpenAI`` wrapper. Imports openai lazily so the
    package is importable without it."""

    def __init__(self, api_key: Optional[str] = None, model_name: str = EMBEDDING_MODEL_NAME):
        from openai import AsyncOpenAI

        self._client = AsyncOpenAI(api_key=api_key)
        self.model_name = model_name

    async def embed(self, text: str) -> List[float]:
        result = await self._client.embeddings.create(model=self.model_name, input=text)
        if not result.data:
            raise RuntimeError("generate_embeddings returned no vectors")
        vec = list(result.data[0].embedding)
        if len(vec) != EMBEDDING_DIM:
            raise RuntimeError(
                f"embedding dim mismatch: got {len(vec)}, expected {EMBEDDING_DIM}"
            )
        return vec
