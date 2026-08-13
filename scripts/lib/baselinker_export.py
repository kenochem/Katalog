"""
Wspólne mapowanie eksportu BaseLinker (CSV `Base__Produkty__*.csv`) → pola katalogu Kenochem.
"""

from __future__ import annotations

import csv
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

DEFAULT_DOWNLOADS = Path(r"d:/Users/Biuro/Downloads")


@dataclass
class BaselinkerEnrichment:
    sku: str
    baselinker_product_id: str = ""
    name: str = ""
    manufacturer: str = ""
    ean: str = ""
    image_url: str = ""
    extra_image_urls: list[str] = field(default_factory=list)
    description_html: str = ""
    description_plain: str = ""
    short_description: str = ""
    weight_kg: float | None = None
    unit: str = ""
    vat_rate: float | None = None
    width_cm: float | None = None
    height_cm: float | None = None
    depth_cm: float | None = None
    parameters: dict[str, str] = field(default_factory=dict)

    def to_product_meta_patch(self) -> dict[str, Any]:
        meta: dict[str, Any] = {}
        if self.baselinker_product_id:
            meta["baselinkerProductId"] = self.baselinker_product_id
        if self.short_description:
            meta["shortDescription"] = self.short_description[:500]
        if self.weight_kg is not None:
            meta["weightKg"] = self.weight_kg
        if self.unit:
            meta["unit"] = self.unit
        if self.vat_rate is not None:
            meta["vatRate"] = self.vat_rate
        if self.width_cm is not None:
            meta["widthCm"] = self.width_cm
        if self.height_cm is not None:
            meta["heightCm"] = self.height_cm
        if self.depth_cm is not None:
            meta["depthCm"] = self.depth_cm
        if self.parameters:
            meta["parameters"] = dict(self.parameters)
        return meta


def strip_html(html: str, max_len: int = 0) -> str:
    if not html:
        return ""
    text = re.sub(r"(?i)<\s*br\s*/?>", "\n", html)
    text = re.sub(r"(?i)</\s*p\s*>", "\n", text)
    text = re.sub(r"(?i)<\s*li[^>]*>", "• ", text)
    text = re.sub(r"<[^>]+>", " ", text)
    for a, b in (
        ("&nbsp;", " "),
        ("&amp;", "&"),
        ("&lt;", "<"),
        ("&gt;", ">"),
        ("&quot;", '"'),
        ("&#39;", "'"),
    ):
        text = text.replace(a, b)
    text = re.sub(r"[ \t]+\n", "\n", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    text = re.sub(r"[ \t]{2,}", " ", text).strip()
    if max_len > 0 and len(text) > max_len:
        text = text[: max_len - 1].rstrip() + "…"
    return text


def _parse_float(raw: str) -> float | None:
    s = (raw or "").strip().replace(",", ".")
    if not s:
        return None
    try:
        return float(re.sub(r"[^\d.]", "", s) or 0)
    except ValueError:
        return None


def collect_extra_images(row: dict[str, str]) -> list[str]:
    extras: list[str] = []
    for i in range(1, 16):
        url = (row.get(f"zdjecie_dodatkowe_{i}") or "").strip()
        if url.startswith("http") and url not in extras:
            extras.append(url)
    return extras


def collect_parameters_from_row(row: dict[str, str]) -> dict[str, str]:
    params: dict[str, str] = {}

    for i in range(1, 41):
        name = (row.get(f"atrybut_{i}_nazwa") or row.get(f"atrybut_{i}") or "").strip()
        value = (row.get(f"atrybut_{i}_wartosc") or row.get(f"wartosc_{i}") or "").strip()
        if name and value and name.lower() not in {"brak danych", "-"}:
            params[name] = value[:500]

    for key, val in row.items():
        if not val or not key:
            continue
        m = re.match(r"^atrybut_(\d+)_nazwa$", key, re.I)
        if not m:
            continue
        idx = m.group(1)
        v = (row.get(f"atrybut_{idx}_wartosc") or "").strip()
        n = val.strip()
        if n and v:
            params[n] = v[:500]

    return params


def row_to_enrichment(row: dict[str, str]) -> BaselinkerEnrichment | None:
    sku = (row.get("produkt_sku") or "").strip().upper()
    name = (row.get("produkt_nazwa") or "").strip()
    bl_id = (row.get("produkt_id") or "").strip()
    if not name:
        return None
    if not sku:
        sku = f"BL{bl_id}" if bl_id else ""
    if not sku:
        return None

    image_url = (row.get("zdjecie") or "").strip()
    if not image_url.startswith("http"):
        image_url = ""

    ean = re.sub(r"\D", "", row.get("produkt_ean") or "")
    desc_raw = (
        row.get("opis_dodatkowy_1")
        or row.get("opis")
        or row.get("opis_dodatkowy_2")
        or ""
    )
    short_raw = (
        row.get("opis_krotki")
        or row.get("opis_dodatkowy_2")
        or row.get("opis_dodatkowy_3")
        or ""
    )

    w = _parse_float(row.get("waga") or row.get("waga_brutto") or "")
    unit = (row.get("jednostka") or row.get("produkt_jednostka") or "").strip()
    vat = _parse_float(row.get("stawka_vat") or row.get("vat") or "")

    width = _parse_float(row.get("szerokosc") or row.get("szerokosc_cm") or "")
    height = _parse_float(row.get("wysokosc") or row.get("wysokosc_cm") or "")
    depth = _parse_float(row.get("glebokosc") or row.get("glebokosc_cm") or "")

    params = collect_parameters_from_row(row)
    for extra_key in ("opis_dodatkowy_3", "opis_dodatkowy_4"):
        block = strip_html(row.get(extra_key) or "", max_len=0)
        for line in block.split("\n"):
            t = line.strip().lstrip("•").strip()
            if ":" in t:
                k, _, v = t.partition(":")
                k, v = k.strip(), v.strip()
                if k and v and len(k) < 80:
                    params.setdefault(k, v[:500])
    short = strip_html(short_raw, max_len=0)
    if short and len(short) > 500:
        short = short[:500]

    return BaselinkerEnrichment(
        sku=sku,
        baselinker_product_id=bl_id,
        name=name,
        manufacturer=(row.get("producent_nazwa") or "").strip(),
        ean=ean if len(ean) >= 8 else "",
        image_url=image_url,
        extra_image_urls=collect_extra_images(row),
        description_html=desc_raw.strip(),
        description_plain=strip_html(desc_raw, max_len=0),
        short_description=short,
        weight_kg=w,
        unit=unit,
        vat_rate=vat,
        width_cm=width,
        height_cm=height,
        depth_cm=depth,
        parameters=params,
    )


def find_latest_baselinker_csv(downloads: Path | None = None, min_rows: int = 800) -> Path | None:
    """Eksport z największą liczbą poprawnych SKU (unika wadliwych / zbyt małych CSV)."""
    base = downloads or DEFAULT_DOWNLOADS
    if not base.is_dir():
        return None
    cands = sorted(
        base.glob("Base__Produkty__*.csv"),
        key=lambda p: p.stat().st_mtime,
        reverse=True,
    )
    best: Path | None = None
    best_skus = 0
    for path in cands:
        try:
            with path.open("r", encoding="utf-8-sig", newline="") as f:
                n = max(0, sum(1 for _ in f) - 1)
        except OSError:
            continue
        if n < min_rows:
            continue
        idx = load_enrichment_index(path)
        count = len(idx)
        if count > best_skus:
            best_skus = count
            best = path
    if best:
        return best
    return cands[0] if cands else None


def load_enrichment_index(csv_path: Path | None = None) -> dict[str, BaselinkerEnrichment]:
    path = csv_path or find_latest_baselinker_csv()
    if not path or not path.exists():
        return {}

    by_sku: dict[str, BaselinkerEnrichment] = {}
    with path.open("r", encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f, delimiter=";", quotechar='"')
        for row in reader:
            rec = row_to_enrichment(row)
            if not rec:
                continue
            prev = by_sku.get(rec.sku)
            if not prev:
                by_sku[rec.sku] = rec
                continue
            if len(rec.description_plain) > len(prev.description_plain):
                by_sku[rec.sku] = rec
            elif rec.image_url and not prev.image_url:
                by_sku[rec.sku] = rec
    return by_sku


def inspect_csv_headers(csv_path: Path) -> list[str]:
    with csv_path.open("r", encoding="utf-8-sig", newline="") as f:
        reader = csv.reader(f, delimiter=";", quotechar='"')
        header = next(reader, [])
    return [h.strip() for h in header if h.strip()]


if __name__ == "__main__":
    import sys

    p = Path(sys.argv[1]) if len(sys.argv) > 1 else find_latest_baselinker_csv()
    if not p:
        print("Brak pliku Base__Produkty__*.csv")
        raise SystemExit(1)
    cols = inspect_csv_headers(p)
    print(f"Plik: {p.name} ({len(cols)} kolumn)")
    for c in cols:
        print(c)
    idx = load_enrichment_index(p)
    with_desc = sum(1 for r in idx.values() if len(r.description_plain) >= 40)
    with_short = sum(1 for r in idx.values() if len(r.short_description) >= 18)
    with_w = sum(1 for r in idx.values() if r.weight_kg is not None)
    with_params = sum(1 for r in idx.values() if len(r.parameters) >= 2)
    print(
        f"SKU: {len(idx)}, opisy≥40: {with_desc}, krótki≥18: {with_short}, "
        f"waga: {with_w}, ≥2 atrybuty: {with_params}"
    )
