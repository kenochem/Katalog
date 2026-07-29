#!/usr/bin/env python3
"""Import full Baselinker product catalog (shop / chemia)."""

from __future__ import annotations

import csv
import json
import re
from collections import Counter
from pathlib import Path

DOWNLOADS = Path(r"d:/Users/Biuro/Downloads")
OUTPUT_PATH = Path(__file__).parent.parent / "data" / "shop-products.json"
PUBLIC_PATH = Path(__file__).parent.parent / "public" / "data" / "shop-products.json"


def find_baselinker_csv() -> Path:
    candidates = sorted(
        DOWNLOADS.glob("Base__Produkty__*.csv"),
        key=lambda p: p.stat().st_mtime,
        reverse=True,
    )
    if not candidates:
        raise FileNotFoundError(f"Brak eksportu Baselinker w {DOWNLOADS}")
    return candidates[0]


def parse_stock(value: str) -> float:
    try:
        return float(str(value).replace(",", ".").strip() or 0)
    except (TypeError, ValueError):
        return 0.0


def normalize_category(raw: str) -> str:
    text = (raw or "").strip()
    if not text or text.lower() in {"brak danych", "inne", "pozostałe", "pozostale"}:
        return "Inne"

    lower = text.lower()

    rules = [
        (r"chemic|środk|srodk|alkalicz|kwa[sś]n|szampon|wosk|neutraliz|zmywacz|odrdzew|"
         r"myd[lł]|krem|past|p[lł]yn|spryskiwacz|detailing|piel[eę]gn|tapicer|"
         r"opon|felg|kenolon|sezonow|warsztat|specjalist|myjni samochod|czyszczen|"
         r"auto/", "Chemia"),
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

    # Zachowaj oryginalną nazwę, jeśli wygląda jak sensowna kategoria
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


def score_product(p: dict) -> tuple:
    """Prefer entries with image, EAN, and higher stock."""
    return (
        1 if p.get("hasImage") else 0,
        1 if p.get("ean") else 0,
        float(p.get("stock") or 0),
        len(p.get("extraImageUrls") or []),
    )


def merge_duplicate(existing: dict, incoming: dict) -> dict:
    """Keep richer entry; sum stock; merge extra images."""
    prefer_incoming = score_product(incoming) > score_product(existing)
    base = incoming if prefer_incoming else existing
    other = existing if prefer_incoming else incoming

    extras = list(base.get("extraImageUrls") or [])
    for url in other.get("extraImageUrls") or []:
        if url and url not in extras:
            extras.append(url)
    if other.get("imageUrl") and other["imageUrl"] != base.get("imageUrl"):
        if other["imageUrl"] not in extras:
            extras.append(other["imageUrl"])

    return {
        **base,
        "id": f"shop-{base['sku']}",
        "stock": float(existing.get("stock") or 0) + float(incoming.get("stock") or 0),
        "stockManual": False,
        "ean": base.get("ean") or other.get("ean") or "",
        "extraImageUrls": extras,
        "hasImage": bool(base.get("imageUrl") or extras or other.get("imageUrl")),
        "imageUrl": base.get("imageUrl") or other.get("imageUrl") or "",
        "description": base.get("description") or other.get("description") or "",
        "manufacturer": base.get("manufacturer") or other.get("manufacturer") or "",
    }


def main() -> None:
    csv_path = find_baselinker_csv()
    print(f"Reading: {csv_path.name}")

    by_sku: dict[str, dict] = {}
    duplicates = 0

    with open(csv_path, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f, delimiter=";", quotechar='"')
        for row in reader:
            sku = (row.get("produkt_sku") or "").strip().upper()
            name = (row.get("produkt_nazwa") or "").strip()
            bl_id = (row.get("produkt_id") or "").strip()
            if not name:
                continue
            if not sku:
                sku = f"BL{bl_id}" if bl_id else ""
            if not sku:
                continue

            image_url = (row.get("zdjecie") or "").strip()
            if not image_url.startswith("http"):
                image_url = ""

            ean = re.sub(r"\D", "", row.get("produkt_ean") or "")
            extras = collect_extra_images(row)
            category = normalize_category(row.get("kategoria_nazwa") or "")
            manufacturer = (row.get("producent_nazwa") or "").strip()
            description = (row.get("opis_dodatkowy_1") or row.get("opis") or "").strip()
            if len(description) > 500:
                description = description[:497] + "..."

            product = {
                "id": f"shop-{sku}",
                "sku": sku,
                "name": name,
                "displayName": name,
                "category": category,
                "manufacturer": manufacturer,
                "ean": ean if len(ean) >= 8 else "",
                "imageUrl": image_url,
                "extraImageUrls": extras,
                "description": description,
                "hasImage": bool(image_url or extras),
                "stock": parse_stock(row.get("ilosc") or "0"),
                "stockManual": False,
                "catalog": "shop",
            }

            if sku in by_sku:
                duplicates += 1
                by_sku[sku] = merge_duplicate(by_sku[sku], product)
            else:
                by_sku[sku] = product

    products = sorted(by_sku.values(), key=lambda p: p["displayName"].lower())

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(products, f, ensure_ascii=False, indent=2)
    PUBLIC_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(PUBLIC_PATH, "w", encoding="utf-8") as f:
        json.dump(products, f, ensure_ascii=False, indent=2)

    with_img = sum(1 for p in products if p["hasImage"])
    with_ean = sum(1 for p in products if p.get("ean"))
    cats = Counter(p["category"] for p in products)

    print(f"Exported {len(products)} shop products to {OUTPUT_PATH}")
    if duplicates:
        print(f"Merged {duplicates} duplicate Baselinker rows (same SKU)")
    print(f"With images: {with_img}, without: {len(products) - with_img}")
    print(f"With EAN: {with_ean}, without: {len(products) - with_ean}")
    print("Categories:", dict(cats.most_common(20)))


if __name__ == "__main__":
    main()
