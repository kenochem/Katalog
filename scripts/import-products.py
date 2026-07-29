#!/usr/bin/env python3
"""Parse CSV and filter pressure-washer hardware parts for Firebase import."""

import csv
import json
import re
import sys
from pathlib import Path

CSV_PATH = Path(r"d:/Users/Biuro/Downloads/Base__Produkty__domylny_CSV_2026-07-27_13_44.csv")
OUTPUT_PATH = Path(__file__).parent.parent / "data" / "products.json"

# Tylko fizyczne części i akcesoria — nie chemia w opakowaniach
INCLUDE = [
    r"\bdysz",
    r"\blanc",
    r"w[aą]ż|węż|wez\b",
    r"pianownic",
    r"pistolet",
    r"szybkoz",
    r"końcówk",
    r"\bssawk",
    r"\brurk",
    r"zbiornik",
    r"opryskiwacz",
    r"filtr",
    r"adapter",
    r"redukc",
    r"złącz",
    r"złacz",
    r"złącze",
    r"obrotow",
    r"trójnik",
    r"kolanko",
    r"sitko",
    r"zawór",
    r"inżektor",
    r"injekt",
    r"osłon",
    r"nakrętk",
    r"przełącznik",
    r"manometr",
    r"przedłuż",
    r"uchwyt.*(?:dysz|lanc|pistolet)",
    r"gwint.*(?:1/4|3/8|m22|m18)",
    r"(?:1/4|3/8).*(?:gwint|gz|gw)",
]

CHEMICAL_BRANDS = re.compile(
    r"eco\s*shine|kenochem|kenotek|fraber|polchem|cid\s*lines|dolphin|eilfix|"
    r"mps\b|sonax|koch\s*chemie|solution\b|normatek|"
    r"basf|diversey|tork\b|merida|clovin|probiotics",
    re.I,
)

EXCLUDE = re.compile(
    r"płyn\b|preparat|koncentrat|szampon|mydł|wosk\b|detergent|środek\b|"
    r"czyszczący|odtłuszcz|nabłyszcz|dezynfek|pasta\s*poler|"
    r"pianka\s+(?:do|apc|myj|odtłuszcz)|kwas\s+do\s+mycia|"
    r"ircha|ściereczk|rękawic|folia\s+mask|odświeżacz|"
    r"dozownik\s+do\s+myd|opryskiwacz\s+(?:eco|venus)\b|"
    r"kwazar\s+(?:venus|eco|opryskiwacz)\b|"
    r"gumowa\s+ściągaczk|szczotka\s+spiralna|"
    r"smar\s+do\s+lin|klej\s+do\s+zabezpiecz|baner|"
    r"piana\s+aktywna|piana\s+myj|mycie\s+naczyń|mycia\s+podłóg|"
    r"kokpit|tapicerk|aluminium\s+5l|aluminium\s+20l|"
    r"mikrofibra|recznik|ręcznik\s+do\s+osusz|"
    r"myjka\s+(?:wysokociśnieniowa|zimnowodna)|comet\s+k\s*\d|"
    r"ściągacz.*(?:szyb|wody)|dywanik",
    re.I,
)

CHEMICAL_VOLUME = re.compile(r"\b\d+\s*(?:ml|l|kg|g)\b", re.I)
HARDWARE_VOLUME_OK = re.compile(
    r"pianownic|zbiornik|butelka.*lanc|lanca\s+pian|pojemno",
    re.I,
)

HARDWARE_MANUFACTURERS = re.compile(
    r"akcesoria\s+do\s+myjni|lechler|mv\s*925|myjni",
    re.I,
)

CATEGORY_MAP = {
    "dysz": "Dysze",
    r"lanc": "Lance",
    r"w[aą]ż|węż": "Węże",
    "pianownic": "Pianownice",
    "pistolet": "Pistolety",
    "szybkoz": "Szybkozłącza",
    r"złącz": "Szybkozłącza",
    r"złacz": "Szybkozłącza",
    r"końcówk": "Końcówki odkurzaczy",
    r"\bssawk": "Końcówki odkurzaczy",
    r"manometr": "Manometry",
    r"nypel|nypl": "Adaptery",
    r"\brurk": "Rurki",
    "zbiornik": "Zbiorniki",
    r"opryskiwacz": "Opryskiwacze",
    "przedłuż": "Przedłużacze",
    "adapter": "Adaptery",
    "redukc": "Adaptery",
    "filtr": "Filtry",
    "obrotow": "Obrotowe złącza",
    "trójnik": "Trójniki",
    "kolanko": "Kolanka",
    "zawór": "Zawory",
    r"inżektor|injekt": "Zawory",
    "sitko": "Filtry",
    r"butelka": "Zbiorniki",
}


def is_chemical_volume(text: str) -> bool:
    if not CHEMICAL_VOLUME.search(text):
        return False
    return not HARDWARE_VOLUME_OK.search(text)


def detect_subcategory(name: str, short_desc: str) -> str:
    text = f"{name} {short_desc}".lower()
    for pattern, cat in CATEGORY_MAP.items():
        if re.search(pattern, text, re.I):
            return cat
    return "Inne części"


def strip_html(html: str) -> str:
    if not html:
        return ""
    text = re.sub(r"<[^>]+>", " ", html)
    text = re.sub(r"\s+", " ", text).strip()
    return text[:500] if len(text) > 500 else text


def is_hardware_part(name: str, sku: str, short_desc: str, manufacturer: str) -> bool:
    text = f"{name} {sku} {short_desc} {manufacturer}"

    if EXCLUDE.search(text):
        return False

    if is_chemical_volume(text):
        return False

    if CHEMICAL_BRANDS.search(manufacturer) or CHEMICAL_BRANDS.search(name):
        return False

    if sku.upper().startswith("HYD"):
        return True

    if HARDWARE_MANUFACTURERS.search(manufacturer):
        if EXCLUDE.search(name):
            return False
        return True

    return any(re.search(p, text, re.I) for p in INCLUDE)


def main():
    if not CSV_PATH.exists():
        print(f"CSV not found: {CSV_PATH}", file=sys.stderr)
        sys.exit(1)

    products = []
    seen_skus = set()

    with open(CSV_PATH, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f, delimiter=";", quotechar='"')
        for row in reader:
            name = row.get("produkt_nazwa", "").strip()
            sku = row.get("produkt_sku", "").strip()
            short_desc = row.get("opis_dodatkowy_1", "").strip()
            manufacturer = row.get("producent_nazwa", "").strip()
            image = row.get("zdjecie", "").strip()
            product_id = row.get("produkt_id", "").strip()
            ean = row.get("produkt_ean", "").strip()

            if not sku or sku in seen_skus:
                continue

            if not is_hardware_part(name, sku, short_desc, manufacturer):
                continue

            seen_skus.add(sku)
            subcategory = detect_subcategory(name, short_desc)
            display_name = short_desc if short_desc and len(short_desc) < 120 else name

            products.append({
                "id": product_id or sku,
                "sku": sku,
                "name": name,
                "displayName": display_name,
                "category": subcategory,
                "manufacturer": manufacturer,
                "ean": ean,
                "imageUrl": image if image.startswith("http") else "",
                "description": strip_html(row.get("opis", "")),
                "hasImage": bool(image and image.startswith("http")),
            })

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(products, f, ensure_ascii=False, indent=2)

    with_img = sum(1 for p in products if p["hasImage"])
    cats = {}
    for p in products:
        cats[p["category"]] = cats.get(p["category"], 0) + 1

    print(f"Exported {len(products)} products to {OUTPUT_PATH}")
    print(f"With images: {with_img}, without: {len(products) - with_img}")
    print("Categories:", dict(sorted(cats.items(), key=lambda x: -x[1])))


if __name__ == "__main__":
    main()
