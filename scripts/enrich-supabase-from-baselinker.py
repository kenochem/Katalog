#!/usr/bin/env python3
"""Uzupełnia Supabase z eksportu BaseLinker — docs/products/BASELINKER-EXPORT-MAPPING.md"""

from __future__ import annotations

import argparse
import json
import re
import sys
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

SCRIPT_DIR = Path(__file__).parent
ROOT = SCRIPT_DIR.parent
sys.path.insert(0, str(SCRIPT_DIR))

from lib.baselinker_export import (  # noqa: E402
    BaselinkerEnrichment,
    find_latest_baselinker_csv,
    load_enrichment_index,
    strip_html,
)

PREVIEW_PATH = ROOT / "data" / "baselinker-enrich-preview.json"


def load_env() -> dict[str, str]:
    env: dict[str, str] = {}
    path = ROOT / ".env"
    if not path.exists():
        return env
    for line in path.read_text(encoding="utf-8").splitlines():
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


def fetch_products(url: str, key: str) -> list[dict]:
    base = url.rstrip("/")
    out: list[dict] = []
    offset = 0
    page = 500
    select = (
        "id,sku,name,display_name,description,ean,has_image,image_url,custom_image_url,"
        "extra_images,manufacturer,product_meta,catalog"
    )
    while True:
        uri = (
            f"{base}/rest/v1/products?select={select}"
            f"&order=sku.asc&offset={offset}&limit={page}"
        )
        req = urllib.request.Request(
            uri,
            headers={"apikey": key, "Authorization": f"Bearer {key}"},
        )
        with urllib.request.urlopen(req, timeout=120) as resp:
            batch = json.loads(resp.read().decode("utf-8"))
        if not batch:
            break
        out.extend(batch)
        if len(batch) < page:
            break
        offset += page
    return out


def merge_meta(existing: dict | None, patch: dict, overwrite: bool) -> dict:
    base = dict(existing or {})
    for k, v in patch.items():
        if k == "parameters" and isinstance(v, dict):
            cur = base.get("parameters") if isinstance(base.get("parameters"), dict) else {}
            merged = {**cur, **v}
            if merged:
                base["parameters"] = merged
            continue
        if overwrite or base.get(k) in (None, "", [], {}):
            base[k] = v
    # Zawsze dopinaj brakujące klucze parametrów (merge wyżej)
    return base


def needs_meta_fill(existing: dict | None, patch: dict) -> bool:
    base = existing or {}
    for k, v in patch.items():
        if k == "parameters" and isinstance(v, dict):
            cur = base.get("parameters") if isinstance(base.get("parameters"), dict) else {}
            if any(pk not in cur or not str(cur.get(pk) or "").strip() for pk in v):
                return True
            continue
        if k in ("baselinkerEnrichedAt",):
            continue
        if base.get(k) in (None, "", [], {}):
            return True
    return False


def build_patch(
    row: dict,
    bl: BaselinkerEnrichment,
    *,
    overwrite_desc: bool,
    overwrite_meta: bool,
) -> dict | None:
    meta = row.get("product_meta") if isinstance(row.get("product_meta"), dict) else {}
    desc_plain = strip_html(row.get("description") or "")

    update: dict = {}
    meta_patch = bl.to_product_meta_patch()
    meta_patch["baselinkerEnrichedAt"] = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")

    new_meta = merge_meta(meta, meta_patch, overwrite_meta)
    if new_meta != meta or needs_meta_fill(meta, meta_patch):
        update["product_meta"] = new_meta

    if bl.description_plain and (overwrite_desc or len(desc_plain) < 40):
        update["description"] = bl.description_html or bl.description_plain

    if bl.ean and not (row.get("ean") or "").strip():
        update["ean"] = bl.ean

    if bl.manufacturer and not (row.get("manufacturer") or "").strip():
        update["manufacturer"] = bl.manufacturer

    img = (row.get("custom_image_url") or row.get("image_url") or "").strip()
    if bl.image_url and not img.startswith("http"):
        update["image_url"] = bl.image_url
        update["has_image"] = True

    extras = row.get("extra_images") if isinstance(row.get("extra_images"), list) else []
    if bl.extra_image_urls:
        merged_extras = list(extras)
        for u in bl.extra_image_urls:
            if u not in merged_extras:
                merged_extras.append(u)
        if merged_extras != extras:
            update["extra_images"] = merged_extras

    return update if update else None


def patch_product(url: str, key: str, product_id: str, body: dict) -> None:
    base = url.rstrip("/")
    data = json.dumps(body, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(
        f"{base}/rest/v1/products?id=eq.{product_id}",
        data=data,
        method="PATCH",
        headers={
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
            "Prefer": "return=minimal",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            resp.read()
    except urllib.error.HTTPError as e:
        err = e.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"PATCH {product_id}: HTTP {e.code} {err[:300]}") from e


def resolve_bl(
    row: dict,
    by_sku: dict[str, BaselinkerEnrichment],
    by_bl_id: dict[str, BaselinkerEnrichment],
) -> BaselinkerEnrichment | None:
    sku = (row.get("sku") or "").strip().upper()
    bl = by_sku.get(sku) or by_sku.get(norm_sku(sku))
    if bl:
        return bl
    if sku.startswith("BL") and sku[2:].isdigit():
        bl = by_bl_id.get(sku[2:])
        if bl:
            return bl
    meta = row.get("product_meta") if isinstance(row.get("product_meta"), dict) else {}
    bl_id = str(meta.get("baselinkerProductId") or "").strip()
    if bl_id:
        return by_bl_id.get(bl_id)
    return None


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--csv", type=Path, help="Ścieżka do Base__Produkty__*.csv")
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--overwrite-descriptions", action="store_true")
    ap.add_argument("--overwrite-meta", action="store_true")
    args = ap.parse_args()

    csv_path = args.csv or find_latest_baselinker_csv()
    if not csv_path or not csv_path.exists():
        print("Brak eksportu Base__Produkty__*.csv")
        sys.exit(1)

    print(f"BaseLinker CSV: {csv_path.name}")
    by_sku = load_enrichment_index(csv_path)
    by_bl_id = {r.baselinker_product_id: r for r in by_sku.values() if r.baselinker_product_id}
    print(f"Indeks BL: {len(by_sku)} SKU")

    env = load_env()
    url = env.get("SUPABASE_URL") or env.get("VITE_SUPABASE_URL")
    key = env.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        print("Potrzebne SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY w .env")
        sys.exit(1)

    products = fetch_products(url, key)
    print(f"Supabase products: {len(products)}")

    plan: list[dict] = []
    for row in products:
        bl = resolve_bl(row, by_sku, by_bl_id)
        if not bl:
            continue
        patch = build_patch(
            row,
            bl,
            overwrite_desc=args.overwrite_descriptions,
            overwrite_meta=args.overwrite_meta,
        )
        if not patch:
            continue
        plan.append(
            {
                "id": row["id"],
                "sku": row.get("sku"),
                "fields": sorted(patch.keys()),
            }
        )

    PREVIEW_PATH.parent.mkdir(parents=True, exist_ok=True)
    PREVIEW_PATH.write_text(json.dumps(plan, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Do uzupelnienia: {len(plan)} -> {PREVIEW_PATH}")

    if not args.apply:
        for item in plan[:15]:
            print(f"  {item['sku']}: {', '.join(item['fields'])}")
        print("Dodaj --apply aby zapisać.")
        return

    applied = 0
    for item in plan:
        if args.limit and applied >= args.limit:
            break
        row = next(p for p in products if p["id"] == item["id"])
        bl = resolve_bl(row, by_sku, by_bl_id)
        if not bl:
            continue
        patch = build_patch(
            row,
            bl,
            overwrite_desc=args.overwrite_descriptions,
            overwrite_meta=args.overwrite_meta,
        )
        if not patch:
            continue
        patch_product(url, key, item["id"], patch)
        applied += 1

    print(f"Zaktualizowano: {applied}")


if __name__ == "__main__":
    main()
