"""MMR rerank tests — pure numpy, no DB, no network."""

import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))

from context_store.mmr import mmr_rerank  # noqa: E402


class MMRTests(unittest.TestCase):
    def test_pure_relevance_orders_by_cosine(self):
        q = [1.0, 0.0]
        cands = [[0.0, 1.0], [1.0, 0.0], [1.0, 1.0]]
        self.assertEqual(mmr_rerank(q, cands, ["a", "b", "c"], lambda_=1.0, k=3), ["b", "c", "a"])

    def test_diversity_demotes_near_duplicate(self):
        q = [1.0, 1.0]
        # a is a near-duplicate of b (the top hit); c is less relevant but diverse.
        cands = [[1.0, 0.9], [1.0, 0.95], [0.0, 1.0]]
        ids = ["a", "b", "c"]
        self.assertEqual(mmr_rerank(q, cands, ids, lambda_=1.0, k=3), ["b", "a", "c"])
        self.assertEqual(mmr_rerank(q, cands, ids, lambda_=0.5, k=3), ["b", "c", "a"])

    def test_k_clamped_and_empty(self):
        q = [1.0, 0.0]
        self.assertEqual(mmr_rerank(q, [[1.0, 0.0]], ["a"], lambda_=0.9, k=5), ["a"])
        self.assertEqual(mmr_rerank(q, [], [], lambda_=0.9, k=5), [])
        self.assertEqual(mmr_rerank(q, [[1.0, 0.0]], ["a"], lambda_=0.9, k=0), [])

    def test_zero_vector_has_zero_similarity(self):
        q = [1.0, 0.0]
        out = mmr_rerank(q, [[0.0, 0.0], [0.5, 0.5]], ["zero", "half"], lambda_=1.0, k=2)
        self.assertEqual(out, ["half", "zero"])

    def test_validation(self):
        with self.assertRaises(ValueError):
            mmr_rerank([1.0], [[1.0]], ["a", "b"], lambda_=0.5, k=1)
        with self.assertRaises(ValueError):
            mmr_rerank([1.0], [[1.0]], ["a"], lambda_=1.5, k=1)


if __name__ == "__main__":
    unittest.main()
