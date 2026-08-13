#!/usr/bin/env python3
import json
import re
import sys
import urllib.request
from pathlib import Path

SCRIPT_DIR = Path(__file__).parent
sys.path.insert(0, str(SCRIPT_DIR))
from lib.baselinker_export import find_latest_baselinker_csv, load_enrichment_index, strip_html


def load_env():
    env = {}
    p = SCRIPT_DIR.parent / ".env"
    if p.exists():
        for line in p.read_text(encoding="utf-8").splitlines():
            t = line.strip()
            if not t or t.startswith("#") or "=" not in t:
                continue
            k, v = t.split("=", 1)
            env[k.strip()] = v.strip().strip('"').strip("'")
    return env


def norm_sku(s: str) -> str:
    s = re.sub(r"[^A-Z0-9]", "", (s or "").upper())
    m = re.match(r"^([A-Z]+)0*([0-9]+)$", s)
    if m:
        return m.group(1) + str(int(m.group(2)))
    return s


def fetch_products(url: str, key: str):
    out = []
    off = 0
    sel = "id,sku,description,ean,image_url,custom_image_url,manufacturer,product_meta"
    while True:
        uri = (
            f"{url.rstrip('/')}/rest/v1/products?select={sel}"
            f"&order=sku.asc&offset={off}&limit=500"
        )
        req = urllib.request.Request(
            uri, headers={"apikey": key, "Authorization": f"Bearer {key}"}
        )
        with urllib.request.urlopen(req, timeout=120) as resp:
            batch = json.loads(resp.read().decode())
        if not batch:
            break
        out.extend(batch)
        if len(batch) < 500:
            break
        off += 500
    return out


def main():
    csv = find_latest_baselinker_csv()
    by_sku = load_enrichment_index(csv)
    by_bl = {r.baselinker_product_id: r for r in by_sku.values() if r.baselinker_product_id}
    env = load_env()
    url = env.get("SUPABASE_URL") or env.get("VITE_SUPABASE_URL")
    key = env.get("SUPABASE_SERVICE_ROLE_KEY")
    prods = fetch_products(url, key)
    matched = gaps = 0
    for row in prods:
        sku = (row.get("sku") or "").upper()
        bl = by_sku.get(sku) or by_sku.get(norm_sku(sku))
        if not bl:
            meta = row.get("product_meta") or {}
            bid = str(meta.get("baselinkerProductId") or "").strip()
            bl = by_bl.get(bid) if bid else None
        if not bl:
            continue
        matched += 1
        meta = row.get("product_meta") or {}
        desc = strip_html(row.get("description") or "")
        params = meta.get("parameters") if isinstance(meta.get("parameters"), dict) else {}
        if (
            (len(desc) < 40 and len(bl.description_plain) >= 40)
            or (not str(meta.get("shortDescription") or "").strip() and bl.short_description)
            or (meta.get("weightKg") is None and bl.weight_kg is not None)
            or (len(params) < 2 and len(bl.parameters) >= 2)
            or (not (row.get("ean") or "").strip() and bl.ean)
        ):
            gaps += 1
    print(f"csv={csv.name if csv else '-'} bl_skus={len(by_sku)} db={len(prods)} matched={matched} gaps={gaps}")
    with_params = sum(1 for r in by_sku.values() if len(r.parameters) >= 2)
    print(f"bl_with_2plus_params={with_params}")

    with_bl_meta = sku_hit = id_hit = 0
    for row in prods:
        sku = (row.get("sku") or "").upper()
        if sku in by_sku or norm_sku(sku) in by_sku:
            sku_hit += 1
        meta = row.get("product_meta") or {}
        bid = str(meta.get("baselinkerProductId") or "").strip()
        if bid:
            with_bl_meta += 1
            if bid in by_bl:
                id_hit += 1
    print(f"db_with_bl_id_meta={with_bl_meta} sku_in_csv={sku_hit} bl_id_in_csv={id_hit}")
    if by_sku:
        print("csv_sku_sample:", list(by_sku.keys())[:6])


if __name__ == "__main__":
    main()
