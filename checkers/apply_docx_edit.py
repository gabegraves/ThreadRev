#!/usr/bin/env python3
"""Apply approved text replacements to a .docx, writing a NEW file.

stdlib only. The source file is never modified. Each replacement's `find`
must occur exactly once in the document's visible text runs, or nothing is
written and the error names the count. Numbers in `replace` are checked by
the caller (propose_edit) against a checker run; this script only edits text.

Usage:
    echo '{"source": "fixtures/documents/precharge-review-r2.docx",
           "out": "fixtures/documents/precharge-review-r2-proposed.docx",
           "replacements": [{"find": "t = 6.91 s", "replace": "t = 6.493 s"}]}' \
      | python3 checkers/apply_docx_edit.py

Output: {"out": ..., "source_sha256": ..., "sha256": ..., "applied": [{"find", "replace"}]}
or      {"error": "..."} with exit 1.
"""
import hashlib
import json
import os
import sys
import zipfile
from xml.sax.saxutils import escape

DOC_XML = "word/document.xml"


def sha256_of(path: str) -> str:
    with open(path, "rb") as fh:
        return hashlib.sha256(fh.read()).hexdigest()


def main() -> int:
    req = json.load(sys.stdin)
    source = req["source"]
    out = req["out"]
    reps = req.get("replacements") or []
    if not reps:
        raise ValueError("no replacements given")
    if os.path.abspath(source) == os.path.abspath(out):
        raise ValueError("out must differ from source; the source is never modified")

    with zipfile.ZipFile(source) as z:
        names = z.namelist()
        if DOC_XML not in names:
            raise ValueError(f"{source} has no {DOC_XML}")
        xml = z.read(DOC_XML).decode("utf-8")
        others = {n: z.read(n) for n in names if n != DOC_XML}
        infos = {n: z.getinfo(n) for n in names}

    # Replacements act on the XML-escaped text, since that is what sits inside <w:t>.
    for r in reps:
        find = escape(str(r["find"]))
        repl = escape(str(r["replace"]))
        if not find:
            raise ValueError("empty find")
        n = xml.count(find)
        if n != 1:
            raise ValueError(f'"{r["find"]}" occurs {n} times in the document text; it must occur exactly once')
        xml = xml.replace(find, repl, 1)

    tmp = out + ".tmp"
    with zipfile.ZipFile(tmp, "w") as zo:
        for n in names:
            info = infos[n]
            data = xml.encode("utf-8") if n == DOC_XML else others[n]
            zo.writestr(zipfile.ZipInfo(n, date_time=info.date_time), data, compress_type=info.compress_type)
    os.replace(tmp, out)
    json.dump(
        {
            "out": out,
            "source_sha256": sha256_of(source),
            "sha256": sha256_of(out),
            "applied": [{"find": str(r["find"]), "replace": str(r["replace"])} for r in reps],
        },
        sys.stdout,
    )
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as exc:  # report, never guess
        json.dump({"error": f"{type(exc).__name__}: {exc}"}, sys.stdout)
        sys.exit(1)
