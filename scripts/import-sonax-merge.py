#!/usr/bin/env python3
"""
Merge produktów z eksportu sonax.sklep.pl (Baselinker CSV) do katalogu Produkty.

- Dodaje tylko SKU, których jeszcze nie ma w shop ani w akcesoriach (WAPRO).
- Pomija też pozycje, których EAN już występuje w katalogu.
- Nowe pozycje dostają tag „Sonax”.
- Dla istniejących SKU uzupełnia brakujące EAN-y z CSV (bez tagu Sonax).
"""

from __future__ import annotations

import csv
import json
import re
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).parent.parent
DOWNLOADS = Path(r"d:/Users/Biuro/Downloads")
SHOP_PATH = ROOT / "data" / "shop-products.json"
PUBLIC_SHOP = ROOT / "public" / "data" / "shop-products.json"
ACC_PATH = ROOT / "data" / "products.json"

SONAX_TAG = "Sonax"
DEFAULT_CSV = DOWNLOADS / "Base__Produkty__domylny_CSV_2026-07-31_09_21.csv"


def find_sonax_csv() -> Path:
    if DEFAULT_CSV.exists():
        return DEFAULT_CSV
    candidates = sorted(
        DOWNLOADS.glob("Base__Produkty__*.csv"),
        key=lambda p: p.stat().st_mtime,
        reverse=True,
    )
    if not candidates:
        raise FileNotFoundError(f"Brak CSV Sonax w {DOWNLOADS}")
    return candidates[0]


def parse_stock(value: str) -> float:
    try:
        return float(str(value).replace(",", ".").strip() or 0)
    except (TypeError, ValueError):
        return 0.0


def norm_sku(value: str) -> str:
    return str(value or "").strip().upper()


def norm_ean(value: str) -> str:
    digits = re.sub(r"\D", "", value or "")
    return digits if len(digits) >= 8 else ""


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


def normalize_category(raw: str) -> str:
    text = (raw or "").strip()
    if not text or text.lower() in {"brak danych", "inne", "pozostałe", "pozostale"}:
        return "Inne"

    lower = text.lower()
    rules = [
        (
            r"chemic|środk|srodk|alkalicz|kwa[sś]n|szampon|wosk|neutraliz|zmywacz|odrdzew|"
            r"myd[lł]|krem|past|p[lł]yn|spryskiwacz|detailing|piel[eę]gn|tapicer|"
            r"opon|felg|kenolon|sezonow|warsztat|specjalist|myjni samochod|czyszczen|"
            r"auto/|producenci/",
            "Chemia",
        ),
        (r"od[sś]wie[zż]", "Odświeżacze"),
        (r"szczotk|vikan|ściągacz|sciagacz", "Szczotki"),
        (r"myjk", "Myjki"),
        (r"pistolet|tornado|oprysk|kwazar", "Opryskiwacze"),
        (r"dom i ogr", "Dom i ogród"),
        (r"smar", "Smary"),
        (r"akcesor", "Akcesoria sklepowe"),
        (r"abel", "Abel Auto"),
    ]
    for pattern, label in rules:
        if re.search(pattern, lower, re.I):
            return label
    if len(text) <= 40:
        return text
    return "Inne"


def collect_extra_images(row: dict) -> list[str]:
    extras: list[str] = []
    for i in range(1, 16):
        url = (row.get(f"zdjecie_dodatkowe_{i}") or "").strip()
        if url.startswith("http") and url not in extras:
            extras.append(url)
    return extras


def load_json(path: Path) -> list[dict]:
    if not path.exists():
        return []
    return json.loads(path.read_text(encoding="utf-8"))


def collect_existing_keys(
    shop: list[dict], accessories: list[dict]
) -> tuple[set[str], set[str]]:
    skus: set[str] = set()
    eans: set[str] = set()

    def add(p: dict) -> None:
        sku = norm_sku(p.get("sku"))
        if sku:
            skus.add(sku)
        ean = norm_ean(p.get("ean") or "")
        if ean:
            eans.add(ean)
        for v in p.get("variants") or []:
            vsku = norm_sku(v.get("sku"))
            if vsku:
                skus.add(vsku)
            vean = norm_ean(v.get("ean") or "")
            if vean:
                eans.add(vean)

    for p in shop:
        add(p)
    for p in accessories:
        add(p)
    return skus, eans


def row_to_product(row: dict) -> dict | None:
    name = (row.get("produkt_nazwa") or "").strip()
    bl_id = (row.get("produkt_id") or "").strip()
    sku = norm_sku(row.get("produkt_sku") or "")
    if not name:
        return None
    if not sku:
        sku = f"BL{bl_id}" if bl_id else ""
    if not sku:
        return None

    image_url = (row.get("zdjecie") or "").strip()
    if not image_url.startswith("http"):
        image_url = ""
    extras = collect_extra_images(row)
    ean = norm_ean(row.get("produkt_ean") or "")
    description = strip_html(row.get("opis_dodatkowy_1") or row.get("opis") or "")

    return {
        "id": f"shop-{sku}",
        "sku": sku,
        "name": name,
        "displayName": name,
        "category": normalize_category(row.get("kategoria_nazwa") or ""),
        "manufacturer": (row.get("producent_nazwa") or "").strip(),
        "ean": ean,
        "imageUrl": image_url,
        "extraImageUrls": extras,
        "description": description,
        "hasImage": bool(image_url or extras),
        "stock": parse_stock(row.get("ilosc") or "0"),
        "stockManual": False,
        "catalog": "shop",
        "tags": [SONAX_TAG],
    }


def main() -> None:
    csv_path = find_sonax_csv()
    print(f"Reading Sonax CSV: {csv_path.name}")

    shop = load_json(SHOP_PATH)
    accessories = load_json(ACC_PATH)
    existing_skus, existing_eans = collect_existing_keys(shop, accessories)
    by_sku = {norm_sku(p.get("sku")): p for p in shop if norm_sku(p.get("sku"))}

    added = 0
    ean_filled = 0
    skipped_sku = 0
    skipped_ean = 0
    csv_rows = 0

    with csv_path.open("r", encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f, delimiter=";", quotechar='"')
        for row in reader:
            csv_rows += 1
            product = row_to_product(row)
            if not product:
                continue

            sku = product["sku"]
            ean = product["ean"]

            if sku in by_sku:
                skipped_sku += 1
                existing = by_sku[sku]
                if ean and not norm_ean(existing.get("ean") or ""):
                    existing["ean"] = ean
                    ean_filled += 1
                continue

            if sku in existing_skus:
                skipped_sku += 1
                continue

            if ean and ean in existing_eans:
                skipped_ean += 1
                continue

            by_sku[sku] = product
            existing_skus.add(sku)
            if ean:
                existing_eans.add(ean)
            added += 1

    products = sorted(by_sku.values(), key=lambda p: (p.get("displayName") or "").lower())
    SHOP_PATH.parent.mkdir(parents=True, exist_ok=True)
    PUBLIC_SHOP.parent.mkdir(parents=True, exist_ok=True)
    payload = json.dumps(products, ensure_ascii=False, indent=2)
    SHOP_PATH.write_text(payload, encoding="utf-8")
    PUBLIC_SHOP.write_text(payload, encoding="utf-8")

    tagged = sum(1 for p in products if SONAX_TAG in (p.get("tags") or []))
    cats = Counter(p.get("category") or "Inne" for p in products if SONAX_TAG in (p.get("tags") or []))

    print(f"CSV rows: {csv_rows}")
    print(f"Added new Sonax products: {added}")
    print(f"Skipped (SKU already present): {skipped_sku}")
    print(f"Skipped (EAN already present): {skipped_ean}")
    print(f"Filled missing EAN on existing SKUs: {ean_filled}")
    print(f"Shop catalog total: {len(products)} (tagged Sonax: {tagged})")
    print("New Sonax categories:", dict(cats.most_common(15)))


if __name__ == "__main__":
    main()
