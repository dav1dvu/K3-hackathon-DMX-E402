"""Unstructured PDF bridge used by the TypeScript document service."""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

# Numba compilation can take several minutes on first Windows startup. The sorting
# helpers remain functionally identical in Python mode and make worker startup deterministic.
os.environ.setdefault("NUMBA_DISABLE_JIT", "1")
default_tessdata = Path(sys.prefix) / "share" / "tessdata"
if "TESSDATA_PREFIX" not in os.environ and (default_tessdata / "eng.traineddata").exists():
    os.environ["TESSDATA_PREFIX"] = str(default_tessdata)

from unstructured.partition.pdf import partition_pdf


def serialize_element(element: object, fallback_filename: str) -> dict[str, object]:
    metadata = getattr(element, "metadata", None)
    return {
        "text": str(element).strip(),
        "filename": getattr(metadata, "filename", None) or fallback_filename,
        "page_number": getattr(metadata, "page_number", None) or 0,
        "element_type": getattr(element, "category", None)
        or element.__class__.__name__,
    }


def main() -> int:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    if len(sys.argv) != 2:
        print("Usage: partition_pdf.py <pdf_path>", file=sys.stderr)
        return 2

    pdf_path = Path(sys.argv[1]).resolve(strict=True)
    if pdf_path.suffix.lower() != ".pdf":
        print("Input must be a PDF.", file=sys.stderr)
        return 2

    elements = partition_pdf(
        filename=str(pdf_path),
        strategy="auto",
        infer_table_structure=True,
    )
    payload = [
        serialize_element(element, pdf_path.name)
        for element in elements
        if str(element).strip()
    ]
    json.dump(payload, sys.stdout, ensure_ascii=False)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
