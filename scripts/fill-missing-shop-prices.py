#!/usr/bin/env python3
"""
Uzupełnia brakujące ceny w katalogu Produkty — tylko bezpieczne dopasowania:

1) dokładne SKU w WAPRO
2) znormalizowane SKU (ADB00001 ↔ ADB000001, spacje)
3) ten sam EAN co produkt z ceną
4) bliźniak w shop (podobieństwo nazwy ≥ 0.95)
5) znane duplikaty (mapa ręczna)

  py scripts/fill-missing-shop-prices.py
  py scripts/fill-missing-shop-prices.py --apply
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from difflib import SequenceMatcher
from pathlib import Path

import xlrd

ROOT = Path(__file__).parent.parent
DOWNLOADS = Path(r"d:/Users/Biuro/Downloads")
SHOP_PATH = ROOT / "data" / "shop-products.json"
PUBLIC_SHOP = ROOT / "public" / "data" / "shop-products.json"

# Duplikaty katalogowe: SKU bez ceny → SKU z ceną (ten sam towar)
KNOWN_TWINS = {
    "HYD000918": "K2000030",  # K2 AURON brush
}


def log(msg: str) -> None:
    print(msg, flush=True)


def find_wapro_file() -> Path:
    candidates = sorted(
        DOWNLOADS.glob("Artyku*y*przegl*danie*.xls"),
        key=lambda p: p.stat().st_mtime,
        reverse=True,
    )
    if not candidates:
        raise FileNotFoundError("Brak eksportu WAPRO XLS w Downloads")
    return candidates[0]


def parse_price(value) -> float | None:
    try:
        if value is None or value == "":
            return None
        n = float(value)
        if n != n or n <= 0:
            return None
        return n
    except (TypeError, ValueError):
        return None


def norm_sku(s: str) -> str:
    s = re.sub(r"[^A-Z0-9]", "", str(s).upper())
    m = re.match(r"^([A-Z]+)0*([0-9]+)$", s)
    if m:
        return m.group(1) + str(int(m.group(2)))
    return s


def norm_ean(s: str) -> str:
    return re.sub(r"\D", "", str(s or ""))


def norm_name(s: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9]+", " ", str(s).lower())).strip()


def load_wapro(path: Path) -> tuple[dict[str, dict], dict[str, dict]]:
    wb = xlrd.open_workbook(str(path), encoding_override="latin-1")
    sh = wb.sheet_by_index(0)
    by_sku: dict[str, dict] = {}
    by_norm: dict[str, dict] = {}
    for r in range(1, sh.nrows):
        sku = str(sh.cell_value(r, 1)).strip().upper()
        if not sku:
            continue
        row = {
            "sku": sku,
            "priceSaleGross": parse_price(sh.cell_value(r, 2)),
            "pricePurchaseNet": parse_price(sh.cell_value(r, 6)),
            "priceSaleNet": parse_price(sh.cell_value(r, 7)),
        }
        if row["priceSaleGross"] is None and row["priceSaleNet"] is None:
            continue
        by_sku[sku] = row
        by_norm[norm_sku(sku)] = row
    return by_sku, by_norm


def has_price(p: dict) -> bool:
    for k in (
        "priceSaleGross",
        "priceSaleNet",
        "pricePurchaseNet",
        "price_sale_gross",
        "price_sale_net",
        "price_purchase_net",
    ):
        if parse_price(p.get(k)) is not None:
            return True
    return False


def price_bundle_from_row(p: dict) -> dict | None:
    buy_n = parse_price(p.get("pricePurchaseNet", p.get("price_purchase_net")))
    net_n = parse_price(p.get("priceSaleNet", p.get("price_sale_net")))
    gross_n = parse_price(p.get("priceSaleGross", p.get("price_sale_gross")))
    if gross_n is None and net_n is None and buy_n is None:
        return None
    return {
        "sku": str(p.get("sku") or ""),
        "pricePurchaseNet": buy_n,
        "priceSaleNet": net_n,
        "priceSaleGross": gross_n,
    }


def load_dotenv() -> None:
    env = ROOT / ".env"
    if not env.exists():
        return
    for line in env.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


def fetch_supabase_products() -> list[dict]:
    import urllib.request

    load_dotenv()
    url = os.environ.get("SUPABASE_URL") or os.environ.get("VITE_SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        raise RuntimeError("Brak SUPABASE_URL / SERVICE_ROLE_KEY w .env")

    out: list[dict] = []
    from_idx = 0
    page = 1000
    while True:
        req = urllib.request.Request(
            f"{url}/rest/v1/products?catalog=eq.shop&select=id,sku,display_name,name,ean,"
            f"price_purchase_net,price_sale_net,price_sale_gross,stock"
            f"&order=sku&offset={from_idx}&limit={page}",
            headers={
                "apikey": key,
                "Authorization": f"Bearer {key}",
                "Accept": "application/json",
            },
        )
        with urllib.request.urlopen(req, timeout=60) as res:
            batch = json.loads(res.read().decode("utf-8"))
        if not batch:
            break
        out.extend(batch)
        if len(batch) < page:
            break
        from_idx += page
    return out


def patch_supabase(rows: list[dict]) -> None:
    import urllib.request

    load_dotenv()
    url = os.environ.get("SUPABASE_URL") or os.environ.get("VITE_SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    assert url and key

    for row in rows:
        body = json.dumps(
            {
                "price_purchase_net": row["pricePurchaseNet"],
                "price_sale_net": row["priceSaleNet"],
                "price_sale_gross": row["priceSaleGross"],
            }
        ).encode("utf-8")
        req = urllib.request.Request(
            f"{url}/rest/v1/products?id=eq.{row['id']}",
            data=body,
            method="PATCH",
            headers={
                "apikey": key,
                "Authorization": f"Bearer {key}",
                "Content-Type": "application/json",
                "Prefer": "return=minimal",
            },
        )
        with urllib.request.urlopen(req, timeout=30) as res:
            res.read()


def find_shop_twin(
    missing: dict,
    priced: list[dict],
    by_sku_db: dict[str, dict],
) -> tuple[dict | None, str]:
    sku = str(missing.get("sku") or "").strip().upper()
    if sku in KNOWN_TWINS:
        twin = by_sku_db.get(KNOWN_TWINS[sku].upper())
        if twin:
            bundle = price_bundle_from_row(twin)
            if bundle:
                return bundle, f"known:{KNOWN_TWINS[sku]}"

    ean = norm_ean(missing.get("ean") or "")
    if len(ean) >= 8:
        for p in priced:
            if norm_ean(p.get("ean") or "") == ean:
                bundle = price_bundle_from_row(p)
                if bundle:
                    return bundle, f"ean:{p.get('sku')}"

    name = norm_name(
        missing.get("display_name")
        or missing.get("displayName")
        or missing.get("name")
        or ""
    )
    if len(name) < 16:
        return None, ""

    best = None
    best_score = 0.0
    for p in priced:
        other = norm_name(
            p.get("display_name") or p.get("displayName") or p.get("name") or ""
        )
        if len(other) < 16:
            continue
        score = SequenceMatcher(None, name, other).ratio()
        if score > best_score:
            best_score = score
            best = p

    if best and best_score >= 0.95:
        bundle = price_bundle_from_row(best)
        if bundle:
            return bundle, f"twin:{best_score:.2f}:{best.get('sku')}"
    return None, ""


def resolve_wapro(sku: str, by_sku: dict, by_norm: dict) -> tuple[dict | None, str]:
    sku_u = str(sku or "").strip().upper()
    if sku_u in by_sku:
        return by_sku[sku_u], "exact"
    n = norm_sku(sku_u)
    if n in by_norm:
        return by_norm[n], f"norm:{by_norm[n]['sku']}"
    return None, ""


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()

    wapro_path = find_wapro_file()
    log(f"WAPRO: {wapro_path.name}")
    by_sku, by_norm = load_wapro(wapro_path)
    log(f"WAPRO z ceną: {len(by_sku)}")

    db = fetch_supabase_products()
    by_sku_db = {str(p.get("sku") or "").upper(): p for p in db}
    priced = [p for p in db if has_price(p)]
    missing = [p for p in db if not has_price(p)]
    log(f"Supabase shop bez ceny: {len(missing)} / {len(db)}")

    patches: list[dict] = []
    for p in missing:
        src, how = resolve_wapro(str(p.get("sku") or ""), by_sku, by_norm)
        if not src:
            src, how = find_shop_twin(p, priced, by_sku_db)
        if not src:
            continue
        patches.append(
            {
                "id": p["id"],
                "sku": p.get("sku"),
                "how": how,
                "pricePurchaseNet": src["pricePurchaseNet"],
                "priceSaleNet": src["priceSaleNet"],
                "priceSaleGross": src["priceSaleGross"],
            }
        )
        log(
            f"  DB {p.get('sku')} <- {how} gross={src['priceSaleGross']} | "
            f"{str(p.get('display_name') or '')[:48]}"
        )

    shop = json.loads(SHOP_PATH.read_text(encoding="utf-8")) if SHOP_PATH.exists() else []
    by_patch_sku = {str(x["sku"]).upper(): x for x in patches}
    local_priced = [x for x in shop if has_price(x)]
    local_by_sku = {str(x.get("sku") or "").upper(): x for x in shop}
    json_updates = 0
    for p in shop:
        if has_price(p):
            continue
        sku = str(p.get("sku") or "").strip().upper()
        src, how = resolve_wapro(sku, by_sku, by_norm)
        if not src and sku in by_patch_sku:
            src = by_patch_sku[sku]
            how = by_patch_sku[sku]["how"]
        if not src:
            src, how = find_shop_twin(
                {
                    "sku": sku,
                    "ean": p.get("ean"),
                    "displayName": p.get("displayName"),
                    "name": p.get("name"),
                },
                local_priced,
                local_by_sku,
            )
        if not src:
            continue
        p["pricePurchaseNet"] = src["pricePurchaseNet"]
        p["priceSaleNet"] = src["priceSaleNet"]
        p["priceSaleGross"] = src["priceSaleGross"]
        json_updates += 1
        log(f"  JSON {sku} <- {how} gross={src['priceSaleGross']}")

    log(f"Do uzupełnienia: JSON={json_updates}, Supabase={len(patches)}")
    log(f"Nadal bez ceny: {len(missing) - len(patches)}")

    if not args.apply:
        log("Dry-run. Uruchom z --apply aby zapisać.")
        return

    if json_updates:
        payload = json.dumps(shop, ensure_ascii=False, indent=2)
        SHOP_PATH.write_text(payload, encoding="utf-8")
        PUBLIC_SHOP.parent.mkdir(parents=True, exist_ok=True)
        PUBLIC_SHOP.write_text(payload, encoding="utf-8")
        log(f"Zapisano {SHOP_PATH}")

    if patches:
        patch_supabase(patches)
        log(f"Zapisano {len(patches)} cen do Supabase")


if __name__ == "__main__":
    try:
        main()
    except Exception as err:
        print(f"ERROR: {err}", file=sys.stderr)
        sys.exit(1)
