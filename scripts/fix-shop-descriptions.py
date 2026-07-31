#!/usr/bin/env python3
"""Wyczyść HTML z opisów w shop-products.json (jednorazowo / po imporcie)."""

from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).parent.parent
PATHS = [
    ROOT / "data" / "shop-products.json",
    ROOT / "public" / "data" / "shop-products.json",
]


def strip_html(html: str, max_len: int = 500) -> str:
    if not html:
        return ""
    text = re.sub(r"(?i)<\s*br\s*/?>", "\n", html)
    text = re.sub(r"(?i)</\s*p\s*>", "\n", text)
    text = re.sub(r"(?i)<\s*li[^>]*>", "• ", text)
    text = re.sub(r"<[^>]+>", " ", text)
    for a, b in (
        ("&nbsp;", " "),
        ("&amp;", "&"),
        ("&lt;", "<"),
        ("&gt;", ">"),
        ("&quot;", '"'),
        ("&#39;", "'"),
    ):
        text = text.replace(a, b)
    text = re.sub(r"[ \t]+\n", "\n", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    text = re.sub(r"[ \t]{2,}", " ", text).strip()
    if max_len > 0 and len(text) > max_len:
        text = text[: max_len - 1].rstrip() + "…"
    return text


def main() -> None:
    shop = json.loads(PATHS[0].read_text(encoding="utf-8"))
    fixed = 0
    for p in shop:
        d = p.get("description") or ""
        clean = strip_html(d)
        if clean != d:
            p["description"] = clean
            fixed += 1

    payload = json.dumps(shop, ensure_ascii=False, indent=2)
    for path in PATHS:
        path.write_text(payload, encoding="utf-8")

    htmlish = sum(
        1
        for p in shop
        if "<" in (p.get("description") or "") and ">" in (p.get("description") or "")
    )
    print(f"Fixed {fixed} descriptions; remaining htmlish: {htmlish}")


if __name__ == "__main__":
    main()
