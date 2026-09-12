#!/usr/bin/env python3
"""Print the rows of an .xlsx as JSON, with the file's sha256.

stdlib only. Usage: python3 extractors/xlsx_text.py path/to/file.xlsx
Output: {"path": ..., "sha256": ..., "paragraphs": [str, ...]}

Same envelope as docx_text.py on purpose: read_evidence picks an extractor by
extension and gets the same shape back either way, so a spreadsheet is quoted
and cited exactly like a document.

One row per paragraph, rendered as `<sheet> row <n>: a | b | c`, because the
reviewer cites a locator and "row 3" is the locator an engineer would use for a
parameter sheet. Empty rows are dropped rather than numbered.

A spreadsheet is evidence, and evidence is not trusted: the zip states each
member's uncompressed size before it is decompressed, so the claim is checked
rather than believed.
"""
import hashlib, json, re, sys, zipfile
from xml.etree import ElementTree as ET

S = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
R = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}"

#: Largest single sheet or shared-string table we will decompress.
MAX_PART = 64 * 1024 * 1024
HASH_CHUNK = 1024 * 1024


def sha256_of(path):
    digest = hashlib.sha256()
    with open(path, "rb") as fh:
        for chunk in iter(lambda: fh.read(HASH_CHUNK), b""):
            digest.update(chunk)
    return digest.hexdigest()


def read_part(z, name):
    """Read one zip member after checking the size it claims."""
    info = z.getinfo(name)
    if info.file_size > MAX_PART:
        raise ValueError(
            "%s claims %d bytes uncompressed, over the %d byte limit"
            % (name, info.file_size, MAX_PART)
        )
    return z.read(name)


def shared_strings(z):
    """The workbook's string table, when it has one. Newer writers inline instead."""
    if "xl/sharedStrings.xml" not in z.namelist():
        return []
    root = ET.fromstring(read_part(z, "xl/sharedStrings.xml"))
    return ["".join(t.text or "" for t in si.iter(S + "t")) for si in root.iter(S + "si")]


def sheet_targets(z):
    """[(sheet name, zip member)] in workbook order."""
    workbook = ET.fromstring(read_part(z, "xl/workbook.xml"))
    rels = ET.fromstring(read_part(z, "xl/_rels/workbook.xml.rels"))
    by_id = {
        rel.get("Id"): rel.get("Target")
        for rel in rels.iter("{http://schemas.openxmlformats.org/package/2006/relationships}Relationship")
    }
    out = []
    for sheet in workbook.iter(S + "sheet"):
        target = by_id.get(sheet.get(R + "id"), "")
        if not target:
            continue
        # Targets come either package-absolute ("/xl/worksheets/sheet1.xml") or
        # relative to xl/ ("worksheets/sheet1.xml"), depending on the writer.
        member = target.lstrip("/")
        if not member.startswith("xl/"):
            member = "xl/" + member
        if member in z.namelist():
            out.append((sheet.get("name") or "sheet", member))
    return out


def cell_text(c, strings):
    """A cell's displayed value, whichever way this writer stored it."""
    kind = c.get("t")
    if kind == "inlineStr":
        return "".join(t.text or "" for t in c.iter(S + "t")).strip()
    if kind == "s":
        v = c.find(S + "v")
        if v is None or not (v.text or "").isdigit():
            return ""
        index = int(v.text)
        return strings[index].strip() if index < len(strings) else ""
    if kind == "str":
        v = c.find(S + "f/..")  # formula result lives in <v> alongside <f>
        v = c.find(S + "v")
        return (v.text or "").strip() if v is not None else ""
    v = c.find(S + "v")
    return (v.text or "").strip() if v is not None else ""


def main(path):
    digest = sha256_of(path)
    paragraphs = []
    with zipfile.ZipFile(path) as z:
        strings = shared_strings(z)
        for name, member in sheet_targets(z):
            root = ET.fromstring(read_part(z, member))
            for row in root.iter(S + "row"):
                cells = [cell_text(c, strings) for c in row.iter(S + "c")]
                while cells and cells[-1] == "":
                    cells.pop()
                if not any(cells):
                    continue
                number = row.get("r") or str(len(paragraphs) + 1)
                text = " | ".join(cells)
                paragraphs.append(re.sub(r"\s+", " ", "%s row %s: %s" % (name, number, text)))
    json.dump({"path": path, "sha256": digest, "paragraphs": paragraphs}, sys.stdout)
    return 0


if __name__ == "__main__":
    if len(sys.argv) != 2:
        json.dump({"error": "usage: xlsx_text.py <file.xlsx>"}, sys.stdout); sys.exit(1)
    try:
        sys.exit(main(sys.argv[1]))
    except Exception as exc:  # report, never guess
        json.dump({"path": sys.argv[1], "error": f"{type(exc).__name__}: {exc}"}, sys.stdout); sys.exit(1)
