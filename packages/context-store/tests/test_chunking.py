"""Chunking tests — no DB, no network.

tiktoken's cl100k_base is fetched over the network on first use, so the
encoder is replaced with a whitespace tokenizer for the whole module.
"""

import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))

from context_store import chunking, text_chunking  # noqa: E402
from context_store.constants import (  # noqa: E402
    CHUNK_MAX_TOKENS,
    CHUNK_OVERLAP_TOKENS,
    SOURCE_MODE_DIRECT,
    SOURCE_MODE_TOOL_CALL,
    SOURCE_MODE_TOOL_RESULT,
    TOOL_RESULT_TOKEN_CAP,
)


class _WordEncoding:
    """1 token == 1 whitespace-separated word."""

    def encode(self, text):
        return text.split(" ")

    def decode(self, tokens):
        return " ".join(tokens)


def setUpModule():
    text_chunking._encoder = _WordEncoding()


def tearDownModule():
    text_chunking._encoder = None


def _words(n, prefix="w"):
    return " ".join(f"{prefix}{i}" for i in range(n))


class TextChunkingTests(unittest.TestCase):
    def test_token_count(self):
        self.assertEqual(text_chunking.token_count(""), 0)
        self.assertEqual(text_chunking.token_count(_words(7)), 7)

    def test_cap_text(self):
        self.assertEqual(text_chunking.cap_text(_words(3), 10), _words(3))
        self.assertEqual(text_chunking.cap_text(_words(10), 3), _words(3))
        self.assertEqual(text_chunking.cap_text(_words(3), 0), "")

    def test_split_with_overlap_windows(self):
        chunks = text_chunking.split_with_overlap(_words(10), 4, 1)
        # step = 3 -> windows [0:4] [3:7] [6:10]
        self.assertEqual(chunks, ["w0 w1 w2 w3", "w3 w4 w5 w6", "w6 w7 w8 w9"])

    def test_split_with_overlap_edge_cases(self):
        self.assertEqual(text_chunking.split_with_overlap("   ", 4, 1), [])
        self.assertEqual(text_chunking.split_with_overlap(_words(4), 4, 1), [_words(4)])
        with self.assertRaises(ValueError):
            text_chunking.split_with_overlap(_words(5), 4, 4)


class ClassifyTests(unittest.TestCase):
    def test_primary_short_text_single_chunk(self):
        out = chunking.classify_event_payload(
            {"elements": [{"id": "e1", "type": "plain_text", "payload": {"text": "bus is 680 uF"}}]}
        )
        self.assertEqual(len(out), 1)
        c = out[0]
        self.assertEqual((c.element_id, c.element_type, c.source_mode), ("e1", "plain_text", SOURCE_MODE_DIRECT))
        self.assertTrue(c.is_primary)
        self.assertEqual(c.text, "bus is 680 uF")
        self.assertIsNone(c.doc_sha256)
        self.assertIsNone(c.locator)

    def test_primary_long_text_split_512_64(self):
        n = CHUNK_MAX_TOKENS * 2
        out = chunking.classify_event_payload(
            {"elements": [{"type": "markdown", "payload": {"markdown": _words(n)}}]}
        )
        step = CHUNK_MAX_TOKENS - CHUNK_OVERLAP_TOKENS
        expected = 1 + -(-(n - CHUNK_MAX_TOKENS) // step)  # ceil
        self.assertEqual(len(out), expected)
        self.assertTrue(all(len(c.text.split(" ")) <= CHUNK_MAX_TOKENS for c in out))
        # consecutive chunks overlap by CHUNK_OVERLAP_TOKENS words
        a, b = out[0].text.split(" "), out[1].text.split(" ")
        self.assertEqual(a[-CHUNK_OVERLAP_TOKENS:], b[:CHUNK_OVERLAP_TOKENS])

    def test_empty_unknown_and_non_dict_skipped(self):
        out = chunking.classify_event_payload(
            {"elements": [{"type": "plain_text", "payload": {"text": "  "}}, {"type": "mystery", "payload": {"text": "x"}}, "junk", None]}
        )
        self.assertEqual(out, [])
        self.assertEqual(chunking.classify_event_payload(None), [])

    def test_tool_use_embeds_name_and_sorted_json(self):
        out = chunking.classify_event_payload(
            {"elements": [{"type": "tool_use", "payload": {"name": "check_rc", "input": {"b": 1, "a": 2}}}]}
        )
        self.assertEqual(len(out), 1)
        self.assertEqual(out[0].source_mode, SOURCE_MODE_TOOL_CALL)
        self.assertFalse(out[0].is_primary)
        self.assertEqual(out[0].text, 'check_rc\n{"a": 2, "b": 1}')

    def test_tool_result_capped_at_8000_tokens(self):
        out = chunking.classify_event_payload(
            {"elements": [{"type": "tool_result", "payload": {"content": _words(TOOL_RESULT_TOKEN_CAP + 500)}}]}
        )
        self.assertTrue(all(c.source_mode == SOURCE_MODE_TOOL_RESULT for c in out))
        total_words = set()
        for c in out:
            total_words.update(c.text.split(" "))
        self.assertEqual(max(int(w[1:]) for w in total_words), TOOL_RESULT_TOKEN_CAP - 1)

    def test_tool_result_non_text_payload_stringified(self):
        out = chunking.classify_event_payload(
            {"elements": [{"type": "tool_result", "payload": {"rows": [1, 2]}}]}
        )
        self.assertEqual(out[0].text, '{"rows": [1, 2]}')

    def test_doc_sha256_and_locator_passthrough(self):
        sha = "a" * 64
        out = chunking.classify_event_payload(
            {
                "elements": [
                    {"id": "precharge-review-r2.docx", "type": "plain_text", "doc_sha256": sha, "locator": "line 3", "payload": {"text": _words(CHUNK_MAX_TOKENS + 10)}},
                    {"type": "plain_text", "payload": {"text": "no passthrough"}},
                ]
            }
        )
        self.assertEqual(len(out), 3)
        for c in out[:2]:
            self.assertEqual(c.doc_sha256, sha)
            self.assertEqual(c.locator, "line 3")
            self.assertEqual(c.element_id, "precharge-review-r2.docx")
        self.assertIsNone(out[2].doc_sha256)


if __name__ == "__main__":
    unittest.main()
