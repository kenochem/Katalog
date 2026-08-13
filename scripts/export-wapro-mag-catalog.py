#!/usr/bin/env python3
"""
Eksport aktywnego Mag z WAPRO (XLS) → CSV stanów + JSON do auto-importu w katalogu.

Pomija: SKU z prefiksem X, nazwy wycofane (x. / xxx / x…).

  py scripts/export-wapro-mag-catalog.py
  py scripts/export-wapro-mag-catalog.py --file "D:\\Users\\Biuro\\Downloads\\Artykuły …xls"
"""
from __future__ import annotations

import argparse
import csv
import importlib.util
import json
import shutil
import sys
from datetime import datetime, timezone
from pathlib import Path

import xlrd

SCRIPT_DIR = Path(__file__).parent
ROOT = SCRIPT_DIR.parent
CSV_PATH = ROOT / "data" / "wapro-stock.csv"
JSON_PATH = ROOT / "data" / "wapro-mag-catalog.json"
SYNC_DIR = Path(r"C:\katalog-sync")

_wapro_spec = importlib.util.spec_from_file_location(
    "import_wapro", SCRIPT_DIR / "import-wapro.py"
)
if _wapro_spec is None or _wapro_spec.loader is None:
    raise RuntimeError("Brak scripts/import-wapro.py")
_import_wapro = importlib.util.module_from_spec(_wapro_spec)
_wapro_spec.loader.exec_module(_import_wapro)

_missing_spec = importlib.util.spec_from_file_location(
    "import_wapro_missing", SCRIPT_DIR / "import-wapro-missing.py"
)
if _missing_spec is None or _missing_spec.loader is None:
    raise RuntimeError("Brak scripts/import-wapro-missing.py")
_import_missing = importlib.util.module_from_spec(_missing_spec)
_missing_spec.loader.exec_module(_import_missing)

find_wapro_file = _import_wapro.find_wapro_file
fix_encoding = _import_wapro.fix_encoding
parse_price = _import_wapro.parse_price
parse_stock = _import_wapro.parse_stock
is_hardware = _import_wapro.is_hardware
detect_subcategory = _import_wapro.detect_subcategory
should_skip_row = _import_missing.should_skip_row
shop_category_from_name = _import_missing.shop_category_from_name


def load_rows(path: Path) -> list[dict]:
    wb = xlrd.open_workbook(str(path), encoding_override="latin-1")
    sh = wb.sheet_by_index(0)
    out: list[dict] = []
    seen: set[str] = set()
    for r in range(1, sh.nrows):
        name = fix_encoding(str(sh.cell_value(r, 0)).strip())
        sku = str(sh.cell_value(r, 1)).strip().upper()
        if not sku or sku in seen:
            continue
        if should_skip_row(sku, name):
            continue
        seen.add(sku)
        hardware = is_hardware(name, sku)
        catalog = "accessories" if hardware else "shop"
        category = detect_subcategory(name) if hardware else shop_category_from_name(name)
        out.append(
            {
                "sku": sku,
                "name": name,
                "stock": parse_stock(sh.cell_value(r, 3)),
                "pricePurchaseNet": parse_price(sh.cell_value(r, 6)),
                "priceSaleNet": parse_price(sh.cell_value(r, 7)),
                "priceSaleGross": parse_price(sh.cell_value(r, 2)),
                "catalog": catalog,
                "category": category,
            }
        )
    return out


def write_csv(rows: list[dict], path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as f:
        w = csv.writer(f, delimiter=";")
        w.writerow(
            [
                "sku",
                "stock",
                "price_purchase_net",
                "price_sale_net",
                "price_sale_gross",
            ]
        )
        for row in sorted(rows, key=lambda x: x["sku"]):
            w.writerow(
                [
                    row["sku"],
                    row["stock"],
                    "" if row["pricePurchaseNet"] is None else row["pricePurchaseNet"],
                    "" if row["priceSaleNet"] is None else row["priceSaleNet"],
                    "" if row["priceSaleGross"] is None else row["priceSaleGross"],
                ]
            )


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--file", type=str, help="Ścieżka do XLS z WAPRO (domyślnie najnowszy z Downloads)")
    args = ap.parse_args()

    path = Path(args.file) if args.file else find_wapro_file()
    print(f"WAPRO XLS: {path.name}")

    rows = load_rows(path)
    acc = sum(1 for r in rows if r["catalog"] == "accessories")
    shop = len(rows) - acc
    print(f"Aktywne pozycje Mag (bez X): {len(rows)} (akcesoria {acc}, produkty {shop})")

    write_csv(rows, CSV_PATH)
    print(f"CSV sync: {CSV_PATH}")

    payload = {
        "exportedAt": datetime.now(timezone.utc).isoformat(),
        "sourceFile": path.name,
        "rows": rows,
    }
    JSON_PATH.parent.mkdir(parents=True, exist_ok=True)
    JSON_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"JSON import: {JSON_PATH}")

    if SYNC_DIR.is_dir():
        shutil.copy2(JSON_PATH, SYNC_DIR / "wapro-mag-catalog.json")
        shutil.copy2(CSV_PATH, SYNC_DIR / "wapro-stock.csv")
        print(f"Skopiowano do {SYNC_DIR} (wapro-mag-catalog.json + wapro-stock.csv)")


if __name__ == "__main__":
    main()
