#!/usr/bin/env python3
"""Print the paragraphs of a .docx as JSON, with the file's sha256.

stdlib only. Usage: python3 extractors/docx_text.py path/to/file.docx
Output: {"path": ..., "sha256": ..., "paragraphs": [str, ...]}
"""
import hashlib, json, re, sys, zipfile
from xml.etree import ElementTree as ET

W = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"

def main(path: str) -> int:
    with open(path, "rb") as fh:
        digest = hashlib.sha256(fh.read()).hexdigest()
    with zipfile.ZipFile(path) as z:
        root = ET.fromstring(z.read("word/document.xml"))
    paragraphs = []
    for p in root.iter(W + "p"):
        text = "".join(t.text or "" for t in p.iter(W + "t")).strip()
        if text:
            paragraphs.append(re.sub(r"\s+", " ", text))
    json.dump({"path": path, "sha256": digest, "paragraphs": paragraphs}, sys.stdout)
    return 0

if __name__ == "__main__":
    if len(sys.argv) != 2:
        json.dump({"error": "usage: docx_text.py <file.docx>"}, sys.stdout); sys.exit(1)
    try:
        sys.exit(main(sys.argv[1]))
    except Exception as exc:  # report, never guess
        json.dump({"path": sys.argv[1], "error": f"{type(exc).__name__}: {exc}"}, sys.stdout); sys.exit(1)
