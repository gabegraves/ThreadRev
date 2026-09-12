# adapted from pantheon_v2/platform/utils/mmr.py (verbatim)
"""Maximal Marginal Relevance (MMR) rerank — cosine similarity, pure numpy.

Used downstream of an ANN candidate fetch to diversify results:
pick the next candidate that is most similar to the query but least similar
to already-selected candidates, controlled by `lambda_`.

Pure function, no I/O, no activities. Importable directly from any module.
"""

from __future__ import annotations

from typing import List, Sequence

import numpy as np


def _cosine_similarity(a: np.ndarray, b: np.ndarray) -> np.ndarray:
    """Row-wise cosine similarity between rows of `a` (m,d) and rows of `b` (n,d) -> (m,n)."""
    a_norm = np.linalg.norm(a, axis=1, keepdims=True)
    b_norm = np.linalg.norm(b, axis=1, keepdims=True)
    # Avoid div-by-zero: zero vectors get similarity 0 to everything.
    a_safe = np.where(a_norm == 0, 1.0, a_norm)
    b_safe = np.where(b_norm == 0, 1.0, b_norm)
    sim = (a @ b.T) / (a_safe @ b_safe.T)
    sim = np.where((a_norm == 0) | (b_norm.T == 0), 0.0, sim)
    return sim


def mmr_rerank(
    query_vec: Sequence[float],
    candidate_vecs: Sequence[Sequence[float]],
    candidate_ids: Sequence[str],
    lambda_: float,
    k: int,
) -> List[str]:
    """Return the top `k` candidate ids in MMR-reranked order.

    Args:
        query_vec:      the query embedding, length d.
        candidate_vecs: list of candidate embeddings, each length d.
        candidate_ids:  list of candidate ids, same length as candidate_vecs.
        lambda_:        trade-off in [0, 1]. 1.0 = pure relevance, 0.0 = pure diversity.
        k:              number of candidates to return (clamped to len(candidate_ids)).

    Returns:
        List of ids, length min(k, len(candidate_ids)), in selection order.
    """
    if len(candidate_vecs) != len(candidate_ids):
        raise ValueError("candidate_vecs and candidate_ids must be the same length")
    if not 0.0 <= lambda_ <= 1.0:
        raise ValueError("lambda_ must be in [0, 1]")
    if k <= 0 or not candidate_ids:
        return []

    k = min(k, len(candidate_ids))

    query = np.asarray(query_vec, dtype=np.float32).reshape(1, -1)
    cands = np.asarray(candidate_vecs, dtype=np.float32)

    # Pre-compute query-candidate similarity (n,)
    rel = _cosine_similarity(query, cands)[0]
    # Pre-compute pairwise candidate similarity (n, n)
    pairwise = _cosine_similarity(cands, cands)

    selected: List[int] = []
    remaining = set(range(len(candidate_ids)))

    # First pick: argmax of relevance (diversity term is 0 when nothing is selected).
    first = int(np.argmax(rel))
    selected.append(first)
    remaining.remove(first)

    while len(selected) < k and remaining:
        best_idx = -1
        best_score = -np.inf
        for i in remaining:
            max_sim_to_selected = float(np.max(pairwise[i, selected]))
            score = lambda_ * float(rel[i]) - (1.0 - lambda_) * max_sim_to_selected
            if score > best_score:
                best_score = score
                best_idx = i
        selected.append(best_idx)
        remaining.remove(best_idx)

    return [candidate_ids[i] for i in selected]
