#!/usr/bin/env python3
"""
Dopisz ceny + stany z eksportu WAPRO (XLS) do katalogu Produkty po SKU
oraz wygeneruj data/wapro-stock.csv do sync:wapro-stock (oba katalogi).

Kolumny XLS jak w import-wapro:
  1 = SKU, 2 = sprzedaż brutto, 3 = stan, 6 = zakup netto, 7 = sprzedaż netto
"""

from __future__ import annotations

import csv
import json
import re
from pathlib import Path

import xlrd

ROOT = Path(__file__).parent.parent
DOWNLOADS = Path(r"d:/Users/Biuro/Downloads")
SHOP_PATH = ROOT / "data" / "shop-products.json"
PUBLIC_SHOP = ROOT / "public" / "data" / "shop-products.json"
CSV_PATH = ROOT / "data" / "wapro-stock.csv"


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


def parse_price(value) -> float | None:
    try:
        if value is None or value == "":
            return None
        n = float(value)
        if n != n:  # NaN
            return None
        return n
    except (TypeError, ValueError):
        return None


def parse_stock(value) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return 0.0


def norm_sku(s: str) -> str:
    s = re.sub(r"[^A-Z0-9]", "", str(s).upper())
    m = re.match(r"^([A-Z]+)0*([0-9]+)$", s)
    if m:
        return m.group(1) + str(int(m.group(2)))
    return s


def load_wapro_rows(path: Path) -> tuple[dict[str, dict], dict[str, dict]]:
    wb = xlrd.open_workbook(str(path), encoding_override="latin-1")
    sh = wb.sheet_by_index(0)
    out: dict[str, dict] = {}
    by_norm: dict[str, dict] = {}
    for r in range(1, sh.nrows):
        sku = str(sh.cell_value(r, 1)).strip().upper()
        if not sku:
            continue
        row = {
            "stock": parse_stock(sh.cell_value(r, 3)),
            "pricePurchaseNet": parse_price(sh.cell_value(r, 6)),
            "priceSaleNet": parse_price(sh.cell_value(r, 7)),
            "priceSaleGross": parse_price(sh.cell_value(r, 2)),
        }
        out[sku] = row
        by_norm[norm_sku(sku)] = row
    return out, by_norm


def write_csv(rows: dict[str, dict], path: Path) -> None:
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
        for sku in sorted(rows.keys()):
            row = rows[sku]
            w.writerow(
                [
                    sku,
                    row["stock"],
                    "" if row["pricePurchaseNet"] is None else row["pricePurchaseNet"],
                    "" if row["priceSaleNet"] is None else row["priceSaleNet"],
                    "" if row["priceSaleGross"] is None else row["priceSaleGross"],
                ]
            )


def main() -> None:
    wapro_path = find_wapro_file()
    print(f"Reading WAPRO: {wapro_path.name}")
    rows, by_norm = load_wapro_rows(wapro_path)
    print(f"WAPRO SKUs: {len(rows)}")

    write_csv(rows, CSV_PATH)
    print(f"Wrote {CSV_PATH}")

    if not SHOP_PATH.exists():
        raise FileNotFoundError(f"Brak {SHOP_PATH}")

    shop = json.loads(SHOP_PATH.read_text(encoding="utf-8"))
    updated = 0
    matched = 0
    for p in shop:
        sku = str(p.get("sku") or "").strip().upper()
        if not sku:
            continue
        row = rows.get(sku) or by_norm.get(norm_sku(sku))
        if not row:
            continue
        matched += 1
        changed = False
        if not p.get("stockManual"):
            if float(p.get("stock") or 0) != float(row["stock"]):
                p["stock"] = row["stock"]
                changed = True
        for key in ("pricePurchaseNet", "priceSaleNet", "priceSaleGross"):
            val = row[key]
            if val is None:
                continue
            if p.get(key) != val:
                p[key] = val
                changed = True
        if changed:
            updated += 1

    payload = json.dumps(shop, ensure_ascii=False, indent=2)
    SHOP_PATH.write_text(payload, encoding="utf-8")
    PUBLIC_SHOP.parent.mkdir(parents=True, exist_ok=True)
    PUBLIC_SHOP.write_text(payload, encoding="utf-8")

    with_price = sum(
        1
        for p in shop
        if p.get("priceSaleGross") is not None
        or p.get("priceSaleNet") is not None
        or p.get("pricePurchaseNet") is not None
    )
    print(f"Shop products: {len(shop)}")
    print(f"Matched SKU in WAPRO: {matched}")
    print(f"Updated stock/price fields: {updated}")
    print(f"Shop with any price now: {with_price}")

    for sample_sku in ("FRE000063", "SON000098", "ADB00001", "ECO 000191"):
        hit = next((p for p in shop if str(p.get("sku", "")).upper() == sample_sku), None)
        if hit:
            print(
                f"  {sample_sku}: stock={hit.get('stock')} buy={hit.get('pricePurchaseNet')} "
                f"net={hit.get('priceSaleNet')} gross={hit.get('priceSaleGross')}"
            )


if __name__ == "__main__":
    main()
