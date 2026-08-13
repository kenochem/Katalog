#!/usr/bin/env python3
"""Jednorazowo: SKU z WAPRO XLS, których nie ma w products.json + shop-products.json."""
import json
import re
import sys
from pathlib import Path

import xlrd

ROOT = Path(__file__).parent.parent
DOWNLOADS = Path(r"d:/Users/Biuro/Downloads")


def load_skus(p: Path) -> set[str]:
    if not p.exists():
        return set()
    data = json.loads(p.read_text(encoding="utf-8"))
    s: set[str] = set()
    for prod in data:
        sku = str(prod.get("sku", "")).strip().upper()
        if sku:
            s.add(sku)
        for v in prod.get("variants") or []:
            vs = str(v.get("sku", "")).strip().upper()
            if vs:
                s.add(vs)
        pid = str(prod.get("id", "")).strip().upper()
        if pid.startswith("SHOP-"):
            s.add(pid[5:])
    return s


def norm(s: str) -> str:
    s = re.sub(r"[^A-Z0-9]", "", s.upper())
    m = re.match(r"^([A-Z]+)0*([0-9]+)$", s)
    if m:
        return m.group(1) + str(int(m.group(2)))
    return s


def parse_price(v):
    try:
        if v is None or v == "":
            return None
        n = float(v)
        return None if n != n else n
    except (TypeError, ValueError):
        return None


def main():
    arg = sys.argv[1] if len(sys.argv) > 1 else "20260807"
    cands = sorted(
        DOWNLOADS.glob(f"Artyku*y*przegl*danie_{arg}.xls"),
        key=lambda p: p.stat().st_mtime,
        reverse=True,
    )
    if not cands:
        cands = sorted(
            DOWNLOADS.glob("Artyku*y*przegl*danie*.xls"),
            key=lambda p: p.stat().st_mtime,
            reverse=True,
        )
    if not cands:
        print("Brak pliku XLS w Downloads")
        sys.exit(1)
    path = cands[0]
    print(f"WAPRO: {path.name}")

    cat = load_skus(ROOT / "public/data/products.json") | load_skus(
        ROOT / "public/data/shop-products.json"
    )
    cat_norm = {norm(x) for x in cat}
    print(f"SKU w JSON katalogu (akcesoria + sklep): {len(cat)}")

    wb = xlrd.open_workbook(str(path), encoding_override="latin-1")
    sh = wb.sheet_by_index(0)
    missing = []
    for r in range(1, sh.nrows):
        name = str(sh.cell_value(r, 0)).strip()
        sku = str(sh.cell_value(r, 1)).strip().upper()
        if not sku:
            continue
        if sku in cat or norm(sku) in cat_norm:
            continue
        stock = parse_price(sh.cell_value(r, 3)) or 0
        buy = parse_price(sh.cell_value(r, 6))
        net = parse_price(sh.cell_value(r, 7))
        gross = parse_price(sh.cell_value(r, 2))
        if stock <= 0 and not any(x and x > 0 for x in (buy, net, gross)):
            continue
        missing.append(
            {
                "sku": sku,
                "name": name,
                "stock": stock,
                "buy": buy,
                "net": net,
                "gross": gross,
            }
        )

    missing.sort(key=lambda x: (-(x["stock"] or 0), x["sku"]))
    print(f"W Mag, brak w JSON, ze stanem/cena: {len(missing)}")
    for m in missing[:12]:
        name_safe = m["name"].encode("ascii", "replace").decode("ascii")
        print(
            f"  {m['sku']} | stan={m['stock']} | "
            f"zakup={m['buy']} netto={m['net']} brutto={m['gross']} | {name_safe[:55]}"
        )

    pick = None
    for m in missing:
        if (m["stock"] or 0) > 0 and m["buy"] and m["net"]:
            pick = m
            break
    if not pick and missing:
        pick = missing[0]
    if not pick:
        print("Nie znaleziono kandydata ze stanem/cena poza katalogiem.")
        sys.exit(0)

    print("\n=== PROPOZYCJA DO RECZNEGO DODANIA (test sync) ===")
    print(f"SKU (indeks WAPRO): {pick['sku']}")
    print(f"Nazwa: {pick['name'].encode('ascii', 'replace').decode('ascii')}")
    print(
        f"Stan: {pick['stock']} | zakup netto: {pick['buy']} | "
        f"sprzedaż netto: {pick['net']} | brutto: {pick['gross']}"
    )
    print(
        "\nW katalogu: Nowy produkt → SKU jak wyżej → Akcesoria lub Produkty → "
        "Zapisz → Sync WAPRO → Odśwież. Oczekiwane: te same stany/ceny."
    )


if __name__ == "__main__":
    main()
