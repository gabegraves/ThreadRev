#!/usr/bin/env python3
"""Print the paragraphs of a .docx as JSON, with the file's sha256.

stdlib only. Usage: python3 extractors/docx_text.py path/to/file.docx
Output: {"path": ..., "sha256": ..., "paragraphs": [str, ...]}

A document is evidence, and evidence is not trusted here: the reviewer already
treats text inside one as data rather than instructions. The same applies to
its bytes. A .docx is a zip, and a zip says how large its members claim to be
before you decompress them, so the claim is checked rather than believed.
"""
import hashlib, json, re, sys, zipfile
from xml.etree import ElementTree as ET

W = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"

#: Largest document.xml we will decompress. Real engineering documents are far
#: under this; a file that claims more is a decompression bomb or a mistake, and
#: either way refusing beats exhausting memory mid-review.
MAX_DOCUMENT_XML = 64 * 1024 * 1024

#: Hash in chunks rather than reading the whole file into memory to do it.
HASH_CHUNK = 1024 * 1024


def sha256_of(path: str) -> str:
    digest = hashlib.sha256()
    with open(path, "rb") as fh:
        for chunk in iter(lambda: fh.read(HASH_CHUNK), b""):
            digest.update(chunk)
    return digest.hexdigest()


def main(path: str) -> int:
    digest = sha256_of(path)
    with zipfile.ZipFile(path) as z:
        info = z.getinfo("word/document.xml")
        if info.file_size > MAX_DOCUMENT_XML:
            json.dump(
                {
                    "path": path,
                    "error": "document.xml claims %d bytes uncompressed, over the %d byte limit; refusing to decompress it"
                    % (info.file_size, MAX_DOCUMENT_XML),
                },
                sys.stdout,
            )
            return 1
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
