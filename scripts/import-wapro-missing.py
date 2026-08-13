#!/usr/bin/env python3
"""
Import brakujących artykułów z eksportu WAPRO (XLS) do Supabase.

Reguły:
  - pomija indeks SKU zaczynający się od X oraz nazwy wycofane (x. / xxx / x…)
  - Akcesoria: logika is_hardware z import-wapro.py
  - Produkty (shop): reszta (chemia, kosmetyka itd. z Mag)
  - dopasowanie BaseLinker po SKU (opisy, waga, atrybuty, zdjęcia, EAN, ID)
  - tylko INSERT — istniejące SKU w Supabase nie są nadpisywane

Użycie:
  py scripts/import-wapro-missing.py              # raport, max 30 wierszy
  py scripts/import-wapro-missing.py --limit 500
  py scripts/import-wapro-missing.py --apply --min-stock 1
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import urllib.error
import urllib.request
from pathlib import Path

SCRIPT_DIR = Path(__file__).parent
ROOT = SCRIPT_DIR.parent
sys.path.insert(0, str(SCRIPT_DIR))

import xlrd

from lib.baselinker_export import BaselinkerEnrichment, find_latest_baselinker_csv, load_enrichment_index

# import-wapro.py (myślnik w nazwie pliku)
import importlib.util

_wapro_spec = importlib.util.spec_from_file_location(
    "import_wapro", SCRIPT_DIR / "import-wapro.py"
)
if _wapro_spec is None or _wapro_spec.loader is None:
    raise RuntimeError("Nie znaleziono scripts/import-wapro.py")
_import_wapro = importlib.util.module_from_spec(_wapro_spec)
_wapro_spec.loader.exec_module(_import_wapro)

find_wapro_file = _import_wapro.find_wapro_file
fix_encoding = _import_wapro.fix_encoding
is_hardware = _import_wapro.is_hardware
detect_subcategory = _import_wapro.detect_subcategory
X_PREFIX_RE = _import_wapro.X_PREFIX_RE
parse_price = _import_wapro.parse_price
parse_stock = _import_wapro.parse_stock

DOWNLOADS = Path(r"d:/Users/Biuro/Downloads")


def load_env() -> dict[str, str]:
    env: dict[str, str] = {}
    for name in (".env",):
        path = ROOT / name
        if not path.exists():
            continue
        for line in path.read_text(encoding="utf-8").splitlines():
            t = line.strip()
            if not t or t.startswith("#") or "=" not in t:
                continue
            k, v = t.split("=", 1)
            env[k.strip()] = v.strip().strip('"').strip("'")
    return env


def norm_sku(s: str) -> str:
    s = re.sub(r"[^A-Z0-9]", "", s.upper())
    m = re.match(r"^([A-Z]+)0*([0-9]+)$", s)
    if m:
        return m.group(1) + str(int(m.group(2)))
    return s


def should_skip_row(sku: str, name: str) -> str | None:
    u = sku.strip().upper()
    if not u:
        return "brak SKU"
    if u.startswith("X"):
        return "SKU z prefiksem X"
    if X_PREFIX_RE.match(name.strip()):
        return "nazwa wycofana (x…)"
    return None


def fetch_existing_skus(url: str, key: str) -> set[str]:
    base = url.rstrip("/")
    seen: set[str] = set()
    offset = 0
    page = 1000
    while True:
        uri = (
            f"{base}/rest/v1/products?select=sku"
            f"&offset={offset}&limit={page}&order=sku"
        )
        req = urllib.request.Request(
            uri,
            headers={
                "apikey": key,
                "Authorization": f"Bearer {key}",
            },
        )
        with urllib.request.urlopen(req, timeout=120) as resp:
            batch = json.loads(resp.read().decode("utf-8"))
        if not batch:
            break
        for row in batch:
            sku = str(row.get("sku") or "").strip().upper()
            if sku:
                seen.add(sku)
                seen.add(norm_sku(sku))
        if len(batch) < page:
            break
        offset += page
    return seen


def shop_category_from_name(name: str) -> str:
    lower = name.lower()
    if re.search(r"chemic|szampon|wosk|odświe|odswie|płyn|plyn|kenolon", lower):
        return "Chemia"
    if re.search(r"szczotk|vikan", lower):
        return "Szczotki"
    return "Inne"


def build_product_row(
    name: str,
    sku: str,
    stock: float,
    purchase_net,
    sale_net,
    sale_gross,
    bl: BaselinkerEnrichment | None,
    *,
    skeleton: bool = False,
) -> dict:
    hardware = is_hardware(name, sku)
    catalog = "accessories" if hardware else "shop"
    category = detect_subcategory(name) if hardware else shop_category_from_name(name)
    imported_at = __import__("datetime").datetime.now(__import__("datetime").timezone.utc).isoformat()

    if skeleton:
        image_url = ""
        ean = ""
        description = ""
        meta: dict = {
            "waproImport": True,
            "waproSkeleton": True,
            "waproImportedAt": imported_at,
        }
        tags = ["wapro-import", "do-uzupelnienia"]
        manufacturer = "WAPRO" if hardware else ""
    else:
        image_url = bl.image_url if bl else ""
        ean = bl.ean if bl else ""
        meta = {"waproImport": True, "waproImportedAt": imported_at}
        if bl:
            meta.update(bl.to_product_meta_patch())
        tags = ["wapro-import"]
        manufacturer = "WAPRO" if hardware else (bl.manufacturer if bl else "") or ""
        description = ""
        if bl and bl.description_plain:
            description = bl.description_html or bl.description_plain

    pid = sku if catalog == "accessories" else f"shop-{sku}"
    return {
        "id": pid,
        "sku": sku,
        "name": name,
        "display_name": name,
        "category": category,
        "manufacturer": manufacturer,
        "ean": ean,
        "image_url": image_url,
        "custom_image_url": "",
        "description": description,
        "has_image": bool(image_url),
        "stock": stock,
        "stock_manual": False,
        "price_purchase_net": purchase_net,
        "price_sale_net": sale_net,
        "price_sale_gross": sale_gross,
        "tags": tags,
        "extra_images": [] if skeleton else (bl.extra_image_urls if bl else []),
        "variants": [],
        "is_group": False,
        "catalog": catalog,
        "product_meta": meta,
    }


def insert_batch(url: str, key: str, rows: list[dict]) -> None:
    base = url.rstrip("/")
    body = json.dumps(rows, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(
        f"{base}/rest/v1/products",
        data=body,
        method="POST",
        headers={
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
            "Prefer": "return=minimal",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            resp.read()
    except urllib.error.HTTPError as e:
        err = e.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"Supabase insert HTTP {e.code}: {err[:500]}") from e


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true", help="Wgraj do Supabase (domyślnie tylko raport)")
    ap.add_argument("--file", type=str, help="Ścieżka do XLS WAPRO (domyślnie najnowszy z Downloads)")
    ap.add_argument("--limit", type=int, default=30, help="Max pozycji w raporcie / apply (0 = bez limitu)")
    ap.add_argument("--min-stock", type=float, default=None, help="Pomiń gdy stan <= wartość (domyślnie: 0 = tylko stan>0)")
    ap.add_argument(
        "--include-zero-stock",
        action="store_true",
        help="Importuj także pozycje ze stanem 0 (nadpisuje filtr min-stock)",
    )
    ap.add_argument(
        "--skeleton",
        action="store_true",
        help="Tylko SKU, nazwa, ceny, stan — bez zdjęć i opisów z BaseLinker",
    )
    ap.add_argument(
        "--enrich-baselinker",
        action="store_true",
        help="Dociągnij zdjęcia/opisy z BaseLinker (domyślnie wyłączone przy --skeleton)",
    )
    args = ap.parse_args()

    min_stock = -1.0 if args.include_zero_stock else (0.0 if args.min_stock is None else args.min_stock)
    skeleton = args.skeleton or not args.enrich_baselinker

    env = load_env()
    supabase_url = env.get("SUPABASE_URL") or env.get("VITE_SUPABASE_URL")
    service_key = env.get("SUPABASE_SERVICE_ROLE_KEY")
    if args.apply and (not supabase_url or not service_key):
        print("Do --apply potrzebne SUPABASE_URL i SUPABASE_SERVICE_ROLE_KEY w .env")
        sys.exit(1)

    wapro_path = Path(args.file) if args.file else find_wapro_file()
    print(f"WAPRO: {wapro_path.name}")

    bl_by_sku: dict = {}
    if not skeleton:
        bl_csv = find_latest_baselinker_csv()
        bl_by_sku = load_enrichment_index(bl_csv) if bl_csv else {}
        print(
            f"BaseLinker CSV: {bl_csv.name if bl_csv else '—'} · "
            f"{len(bl_by_sku)} SKU (opisy/waga/atrybuty)"
        )
    else:
        print("Tryb szkielet: bez BaseLinker (zdjęcia/opisy uzupełnisz w katalogu).")

    existing: set[str] = set()
    if supabase_url and service_key:
        print("Pobieram SKU z Supabase…")
        existing = fetch_existing_skus(supabase_url, service_key)
        print(f"W Supabase: {len(existing)} wpisów SKU (z normalizacją)")

    wb = xlrd.open_workbook(str(wapro_path), encoding_override="latin-1")
    sh = wb.sheet_by_index(0)

    candidates: list[dict] = []
    skipped = {"x_sku": 0, "x_name": 0, "exists": 0, "stock": 0}

    for r in range(1, sh.nrows):
        name = fix_encoding(str(sh.cell_value(r, 0)).strip())
        sku = str(sh.cell_value(r, 1)).strip().upper()
        reason = should_skip_row(sku, name)
        if reason:
            if reason.startswith("SKU"):
                skipped["x_sku"] += 1
            else:
                skipped["x_name"] += 1
            continue
        if sku in existing or norm_sku(sku) in existing:
            skipped["exists"] += 1
            continue
        stock = parse_stock(sh.cell_value(r, 3))
        if stock <= min_stock:
            skipped["stock"] += 1
            continue
        purchase_net = parse_price(sh.cell_value(r, 6))
        sale_net = parse_price(sh.cell_value(r, 7))
        sale_gross = parse_price(sh.cell_value(r, 2))
        bl = None if skeleton else (bl_by_sku.get(sku) or bl_by_sku.get(norm_sku(sku)))
        row = build_product_row(
            name,
            sku,
            stock,
            purchase_net,
            sale_net,
            sale_gross,
            bl,
            skeleton=skeleton,
        )
        candidates.append(row)

    candidates.sort(key=lambda x: (-float(x["stock"]), x["sku"]))
    total = len(candidates)
    limit = args.limit if args.limit > 0 else total
    batch = candidates[:limit]

    acc = sum(1 for c in batch if c["catalog"] == "accessories")
    shop = len(batch) - acc
    with_bl = sum(1 for c in batch if c["product_meta"].get("baselinkerProductId"))

    print(f"\nDo importu (spełnia warunki): {total}")
    print(f"Pominięte: X-SKU={skipped['x_sku']}, x-nazwa={skipped['x_name']}, już w bazie={skipped['exists']}, stan<={min_stock}={skipped['stock']}")
    print(f"Paczka: {len(batch)} (Akcesoria {acc}, Produkty {shop}, z ID Base {with_bl})")

    for c in batch[:15]:
        bl = "BL" if c["product_meta"].get("baselinkerProductId") else "—"
        print(
            f"  [{c['catalog'][:3]}] {c['sku']} stan={c['stock']} {bl} | "
            f"{c['name'][:50]}"
        )
    if len(batch) > 15:
        print(f"  … i {len(batch) - 15} kolejnych")

    report_path = ROOT / "data" / "wapro-missing-import-preview.json"
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(json.dumps(batch, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\nPodgląd JSON: {report_path}")

    if not args.apply:
        print("\nDry-run. Aby wgrać wszystkie aktywne pozycje Mag (szkielet):")
        print("  py scripts/import-wapro-missing.py --apply --limit 0 --include-zero-stock --skeleton")
        return

    if not batch:
        print("Nic do wgrania.")
        return

    chunk = 100
    inserted = 0
    for i in range(0, len(batch), chunk):
        part = batch[i : i + chunk]
        insert_batch(supabase_url, service_key, part)
        inserted += len(part)
        print(f"Wgrano {inserted}/{len(batch)}")
    print("Gotowe. Odśwież katalog w aplikacji.")


if __name__ == "__main__":
    main()
