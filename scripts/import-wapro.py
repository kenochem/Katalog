#!/usr/bin/env python3
"""Import hardware parts from Wapro XLS export."""

import json
import os
import re
import sys
from pathlib import Path

import xlrd

DOWNLOADS = Path(r"d:/Users/Biuro/Downloads")
OUTPUT_PATH = Path(__file__).parent.parent / "data" / "products.json"
PUBLIC_PATH = Path(__file__).parent.parent / "public" / "data" / "products.json"

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
    r"nypel|nypl",
    r"gwint",
    r"1/4",
    r"3/8",
    r"m22",
    r"m18",
    r"zakuci",
    r"szczotka.*myjni",
    r"piaskowan",
    r"bajpas",
    r"by-?pas",
    r"hydropiask",
    r"weży[kc]",
    r"butelka.*lanc",
    r"komplet.*ssaw",
]

EXCLUDE = re.compile(
    r"płyn\b|preparat|koncentrat|szampon|mydł|wosk\b|detergent|środek\b|"
    r"czyszczący|odtłuszcz|nabłyszcz|dezynfek|pasta\s*poler|"
    r"pianka\s+(?:do|apc|myj|odtłuszcz)|kwas\s+do\s+mycia|"
    r"ircha|ściereczk|rękawic|folia\s+mask|odświeżacz|"
    r"dozownik\s+do\s+myd|opryskiwacz\s+(?:eco|venus)\b|"
    r"kwazar\s+(?:venus|eco)\b|"
    r"gumowa\s+ściągaczk|szczotka\s+spiralna|"
    r"smar\s+do\s+lin|klej\s+do\s+zabezpiecz|"
    r"mikrofibra|recznik|ręcznik\s+do\s+osusz|"
    r"myjka\s+(?:wysokociśnieniowa|zimnowodna)|comet\s+k\s*\d|"
    r"ściągacz.*(?:szyb|wody)|dywanik|"
    r"draco\b|tenzi\b|orion\s+v\s+\d|eco\s*shine|kenochem|kenotek|"
    r"fraber|polchem|cid\s*lines|dolphin|eilfix|sonax\b|"
    r"\bkij\b|"
    r"szczotka\s+teleskopowa.*(?:niebi|żółt|zol|4p\s*pro)|"
    r"szczotka\s+ręczna.*żółt",
    re.I,
)

CHEMICAL_VOLUME = re.compile(r"\b\d+\s*(?:ml|l|kg|g)\b", re.I)
HARDWARE_VOLUME_OK = re.compile(
    r"pianownic|zbiornik|butelka.*lanc|lanca\s+pian|pojemno",
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
    r"\brurk": "Rurki",
    "zbiornik": "Zbiorniki",
    r"butelka": "Zbiorniki",
    r"opryskiwacz": "Opryskiwacze",
    "przedłuż": "Przedłużacze",
    "adapter": "Adaptery",
    "redukc": "Adaptery",
    r"nypel|nypl": "Adaptery",
    "filtr": "Filtry",
    "sitko": "Filtry",
    "obrotow": "Obrotowe złącza",
    "trójnik": "Trójniki",
    "kolanko": "Kolanka",
    "zawór": "Zawory",
    r"inżektor|injekt": "Zawory",
    "manometr": "Manometry",
    r"szczotka.*myjni": "Szczotki do myjni",
    r"piaskowan|hydropiask|bajpas|by-?pas": "Zestawy piaskowania",
}


def fix_encoding(text: str) -> str:
    """Napraw polskie znaki gdy xlrd czyta cp1250 jako latin-1."""
    try:
        return text.encode("latin-1").decode("cp1250")
    except (UnicodeDecodeError, UnicodeEncodeError):
        return text


def find_wapro_file() -> Path:
    candidates = sorted(
        DOWNLOADS.glob("Artyku*y*przegl*danie*.xls"),
        key=lambda p: p.stat().st_mtime,
        reverse=True,
    )
    if not candidates:
        candidates = list(DOWNLOADS.glob("WAPRO*.xls"))
    if not candidates:
        raise FileNotFoundError("Nie znaleziono eksportu Wapro w Downloads")
    return candidates[0]


def detect_subcategory(name: str) -> str:
    text = name.lower()
    for pattern, cat in CATEGORY_MAP.items():
        if re.search(pattern, text, re.I):
            return cat
    return "Inne części"


def is_hardware(name: str, sku: str) -> bool:
    text = f"{name} {sku}"

    if EXCLUDE.search(text):
        return False

    if CHEMICAL_VOLUME.search(text) and not HARDWARE_VOLUME_OK.search(text):
        return False

    if sku.upper().startswith("HYD"):
        return True

    return any(re.search(p, text, re.I) for p in INCLUDE)


def load_baselinker_data() -> tuple[dict[str, str], dict[str, str]]:
    """Pobierz zdjęcia i EAN z eksportu Baselinker dla pasujących SKU."""
    csv_path = DOWNLOADS / "Base__Produkty__domylny_CSV_2026-07-27_13_44.csv"
    images: dict[str, str] = {}
    eans: dict[str, str] = {}
    if not csv_path.exists():
        return images, eans

    import csv

    with open(csv_path, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f, delimiter=";", quotechar='"')
        for row in reader:
            sku = row.get("produkt_sku", "").strip().upper()
            if not sku:
                continue
            img = row.get("zdjecie", "").strip()
            if img.startswith("http"):
                images[sku] = img
            ean = re.sub(r"\D", "", row.get("produkt_ean", "").strip())
            if len(ean) >= 8:
                eans[sku] = ean
    return images, eans


def load_baselinker_images() -> dict[str, str]:
    images, _ = load_baselinker_data()
    return images


NOZZLE_GROUP_RE = re.compile(
    r"^(DYSZA WODY(?: CERAMIKA)?(?: \d+/\d+)?(?: HB)?) \d+-\d+",
    re.I,
)


def parse_stock(value) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return 0.0


def group_nozzle_products(products: list[dict]) -> list[dict]:
    """Grupuj identyczne wizualnie dysze wody w jedną pozycję z wariantami."""
    groups: dict[str, list[dict]] = {}
    rest: list[dict] = []

    for p in products:
        m = NOZZLE_GROUP_RE.match(p["name"].strip())
        if m:
            prefix = m.group(1).upper()
            groups.setdefault(prefix, []).append(p)
        else:
            rest.append(p)

    grouped: list[dict] = []
    for prefix, items in groups.items():
        if len(items) < 2:
            rest.extend(items)
            continue

        items.sort(key=lambda x: x["name"])
        rep = next((p for p in items if p.get("imageUrl")), items[0])
        slug = re.sub(r"[^A-Z0-9]+", "-", prefix).strip("-")
        group_id = f"GROUP-{slug}"
        variants = [
            {
                "sku": p["sku"],
                "name": p["name"],
                "stock": float(p.get("stock") or 0),
                **({"ean": p["ean"]} if p.get("ean") else {}),
            }
            for p in items
        ]

        grouped.append({
            "id": group_id,
            "sku": group_id,
            "name": prefix,
            "displayName": prefix,
            "category": "Dysze",
            "manufacturer": rep.get("manufacturer", "WAPRO"),
            "ean": "",
            "imageUrl": rep.get("imageUrl", ""),
            "description": f"{len(variants)} rozmiarów — wybierz SKU z listy poniżej",
            "hasImage": any(p.get("hasImage") for p in items),
            "stock": sum(p.get("stock", 0) for p in items),
            "stockManual": False,
            "catalog": "accessories",
            "isGroup": True,
            "variants": variants,
        })

    return rest + grouped


def main():
    wapro_path = find_wapro_file()
    print(f"Reading: {wapro_path.name}")

    bl_images, bl_eans = load_baselinker_data()
    print(f"Baselinker images available: {len(bl_images)}")
    print(f"Baselinker EANs available: {len(bl_eans)}")

    wb = xlrd.open_workbook(str(wapro_path), encoding_override="latin-1")
    sh = wb.sheet_by_index(0)

    products = []
    seen_skus: set[str] = set()

    for r in range(1, sh.nrows):
        name = fix_encoding(str(sh.cell_value(r, 0)).strip())
        sku = str(sh.cell_value(r, 1)).strip().upper()

        if not name or not sku or sku in seen_skus:
            continue

        if not is_hardware(name, sku):
            continue

        seen_skus.add(sku)
        image_url = bl_images.get(sku, "")
        ean = bl_eans.get(sku, "")
        stock = parse_stock(sh.cell_value(r, 3))
        products.append({
            "id": sku,
            "sku": sku,
            "name": name,
            "displayName": name,
            "category": detect_subcategory(name),
            "manufacturer": "WAPRO",
            "ean": ean,
            "imageUrl": image_url,
            "description": "",
            "hasImage": bool(image_url),
            "stock": stock,
            "stockManual": False,
            "catalog": "accessories",
        })

    before = len(products)
    products = group_nozzle_products(products)
    grouped_count = before - len(products)

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(products, f, ensure_ascii=False, indent=2)
    PUBLIC_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(PUBLIC_PATH, "w", encoding="utf-8") as f:
        json.dump(products, f, ensure_ascii=False, indent=2)

    with_img = sum(1 for p in products if p["hasImage"])
    with_ean = sum(
        1
        for p in products
        if p.get("ean") or any(v.get("ean") for v in p.get("variants", []))
    )
    cats: dict[str, int] = {}
    for p in products:
        cats[p["category"]] = cats.get(p["category"], 0) + 1

    print(f"Exported {len(products)} products to {OUTPUT_PATH}")
    if grouped_count:
        print(f"Grouped nozzles: {before} -> {len(products)} ({grouped_count} merged into groups)")
    print(f"With images: {with_img}, without: {len(products) - with_img}")
    print(f"With EAN: {with_ean}, without: {len(products) - with_ean}")
    print("Categories:", dict(sorted(cats.items(), key=lambda x: -x[1])))


if __name__ == "__main__":
    main()
