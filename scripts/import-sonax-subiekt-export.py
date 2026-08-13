#!/usr/bin/env python3
"""
Parsuje eksporty Subiekt GT (Kopiuj listę → TSV) z katalogu Sonax.

Oczekiwane pliki w data/sonax-import/:
  sonax-towary.tsv       — kartoteka towarów
  sonax-kontrahenci.tsv  — kontrahenci (NIP, adres)
  sonax-faktury.tsv      — nagłówki faktur FS (bez pozycji)

Generuje:
  data/sonax-import/sonax-parsed.json   — znormalizowane rekordy
  data/sonax-import/sonax-report.json   — KPI, rankingi, trendy

Brakuje pozycji faktur (SKU × ilość × wartość) — bez nich nie da się
analizować koszyka produktowego; tylko obroty per klient / okres.
"""

from __future__ import annotations

import argparse
import json
import re
from collections import Counter, defaultdict
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).parent.parent
IMPORT_DIR = ROOT / "data" / "sonax-import"
DOWNLOADS = Path(r"d:/Users/Biuro/Downloads")

DEFAULT_FILES = {
    "towary": IMPORT_DIR / "sonax-towary.tsv",
    "kontrahenci": IMPORT_DIR / "sonax-kontrahenci.tsv",
    "faktury": IMPORT_DIR / "sonax-faktury.tsv",
}

DOWNLOAD_FALLBACK = {
    "towary": DOWNLOADS / "message.txt",
    "kontrahenci": DOWNLOADS / "message (1).txt",
    "faktury": DOWNLOADS / "message (2).txt",
}

ACQUISITION_DATE = "2026-03-01"


def resolve_path(kind: str) -> Path:
    path = DEFAULT_FILES[kind]
    if path.exists():
        return path
    fallback = DOWNLOAD_FALLBACK[kind]
    if fallback.exists():
        return fallback
    raise FileNotFoundError(f"Brak pliku {kind}: {path} ani {fallback}")


def read_tsv(path: Path) -> tuple[list[str], list[list[str]]]:
    text = path.read_text(encoding="utf-8", errors="replace")
    lines = [ln for ln in text.splitlines() if ln.strip()]
    if not lines:
        return [], []
    header = lines[0].split("\t")
    rows = [ln.split("\t") for ln in lines[1:]]
    return header, rows


def parse_pl_num(value: str) -> float:
    s = str(value or "").strip().replace(" ", "").replace(",", ".")
    if not s or s == "-":
        return 0.0
    try:
        return float(s)
    except ValueError:
        return 0.0


def norm_nip(value: str) -> str:
    digits = re.sub(r"\D", "", value or "")
    return digits if len(digits) >= 10 else ""


def col(row: list[str], idx: int) -> str:
    if idx < 0 or idx >= len(row):
        return ""
    return row[idx].strip()


def parse_towary(path: Path) -> list[dict]:
    header, rows = read_tsv(path)
    idx = {name: i for i, name in enumerate(header)}
    out: list[dict] = []
    for row in rows:
        symbol = col(row, idx.get("Symbol", 2))
        name = col(row, idx.get("Nazwa", 3))
        if not symbol and not name:
            continue
        out.append(
            {
                "symbol": symbol,
                "name": name,
                "unit": col(row, idx.get("J.m.", 6)),
                "priceNetWholesale": parse_pl_num(col(row, idx.get("hurtowa netto", 7))),
                "priceGrossWholesale": parse_pl_num(col(row, idx.get("hurtowa brutto", 8))),
                "description": col(row, idx.get("Opis", 9)),
            }
        )
    return out


def parse_kontrahenci(path: Path) -> list[dict]:
    header, rows = read_tsv(path)
    idx = {name: i for i, name in enumerate(header)}
    out: list[dict] = []
    for row in rows:
        name = col(row, idx.get("Nazwa", 4))
        if not name:
            continue
        typ = col(row, idx.get("Typ", 3))
        out.append(
            {
                "symbol": col(row, idx.get("Symbol", 3)),
                "type": col(row, idx.get("Typ", 1)),
                "name": name,
                "nip": norm_nip(col(row, idx.get("NIP", 5))),
                "address": col(row, idx.get("Adres", 6)),
                "city": col(row, idx.get("Miejscowość", 7)),
                "isCustomer": "odbiorca" in typ.lower() or typ.strip().upper().startswith("O"),
            }
        )
    return out


def parse_faktury(path: Path) -> list[dict]:
    header, rows = read_tsv(path)
    idx = {name: i for i, name in enumerate(header)}
    out: list[dict] = []
    for row in rows:
        date = col(row, idx.get("Data", 2))
        number = col(row, idx.get("Numer", 4))
        client = col(row, idx.get("Kontrahent", 5))
        if not date or not client:
            continue
        out.append(
            {
                "date": date,
                "number": number,
                "clientName": client,
                "valueGross": parse_pl_num(col(row, idx.get("Wartość", 6))),
                "docType": col(row, idx.get("R", 3)),
                "excludedPostAcquisition": date >= ACQUISITION_DATE,
            }
        )
    return out


def build_report(
    towary: list[dict],
    kontrahenci: list[dict],
    faktury: list[dict],
) -> dict:
    by_month: dict[str, float] = defaultdict(float)
    by_client: dict[str, float] = defaultdict(float)
    by_client_count: Counter[str] = Counter()
    pre_acq = post_acq = 0.0
    n_pre = n_post = 0

    dates = [f["date"] for f in faktury if f["date"] and not f.get("excludedPostAcquisition")]
    history = [f for f in faktury if not f.get("excludedPostAcquisition")]
    for inv in faktury:
        val = inv["valueGross"]
        if inv.get("excludedPostAcquisition"):
            post_acq += val
            n_post += 1
            continue
        ym = inv["date"][:7] if len(inv["date"]) >= 7 else "?"
        by_month[ym] += val
        by_client[inv["clientName"]] += val
        by_client_count[inv["clientName"]] += 1
        pre_acq += val
        n_pre += 1

    kontrahenci_nip = sum(1 for k in kontrahenci if k["nip"])
    customers = sum(1 for k in kontrahenci if k["isCustomer"])
    sonax_products = sum(
        1 for t in towary if "sonax" in (t.get("name") or "").lower()
    )

    top_clients = sorted(by_client.items(), key=lambda x: -x[1])[:30]
    monthly = sorted(by_month.items())

    return {
        "generatedAt": datetime.now().isoformat(timespec="seconds"),
        "acquisitionCutoff": ACQUISITION_DATE,
        "summary": {
            "products": len(towary),
            "productsWithSonaxInName": sonax_products,
            "contractors": len(kontrahenci),
            "contractorsWithNip": kontrahenci_nip,
            "contractorsMarkedCustomer": customers,
            "invoices": len(history),
            "invoicesRawIncludingPostAcquisition": len(faktury),
            "uniqueInvoiceClients": len(by_client),
            "invoiceDateMin": min(dates) if dates else None,
            "invoiceDateMax": max(dates) if dates else None,
            "invoiceTotalGrossPln": round(sum(f["valueGross"] for f in history), 2),
            "subiektHistoryThrough": "2026-02-28",
            "beforeAcquisition": {
                "invoices": n_pre,
                "totalGrossPln": round(pre_acq, 2),
            },
            "excludedFromSubiektAnalysis": {
                "invoices": n_post,
                "totalGrossPln": round(post_acq, 2),
                "note": "FV w Subiekcie od 2026-03 — pomijane; liczymy tylko WAPRO Kenochem",
            },
        },
        "monthlyTrend": [{"month": m, "grossPln": round(v, 2)} for m, v in monthly],
        "topClientsByRevenue": [
            {"clientName": name, "grossPln": round(val, 2), "invoices": by_client_count[name]}
            for name, val in top_clients
        ],
        "missingData": [
            "Eksport WAPRO od 2026-03 (wapro-faktury.tsv) — npm run reconcile:sonax po sync na serwerze Mag",
        ],
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Parsuj eksport Subiekt Sonax (TSV)")
    parser.add_argument(
        "--out-dir",
        type=Path,
        default=IMPORT_DIR,
        help="Katalog wyjściowy (domyślnie data/sonax-import)",
    )
    args = parser.parse_args()
    out_dir: Path = args.out_dir
    out_dir.mkdir(parents=True, exist_ok=True)

    towary_path = resolve_path("towary")
    kontra_path = resolve_path("kontrahenci")
    faktury_path = resolve_path("faktury")

    print(f"Towary:       {towary_path}")
    print(f"Kontrahenci:  {kontra_path}")
    print(f"Faktury:      {faktury_path}")

    towary = parse_towary(towary_path)
    kontrahenci = parse_kontrahenci(kontra_path)
    faktury = parse_faktury(faktury_path)
    report = build_report(towary, kontrahenci, faktury)

    parsed = {
        "sources": {
            "towary": str(towary_path.name),
            "kontrahenci": str(kontra_path.name),
            "faktury": str(faktury_path.name),
        },
        "towary": towary,
        "kontrahenci": kontrahenci,
        "faktury": faktury,
    }

    parsed_path = out_dir / "sonax-parsed.json"
    report_path = out_dir / "sonax-report.json"
    parsed_path.write_text(json.dumps(parsed, ensure_ascii=False, indent=2), encoding="utf-8")
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")

    s = report["summary"]
    print()
    print("=== Raport Sonax / Subiekt ===")
    print(f"Towary: {s['products']} ({s['productsWithSonaxInName']} z 'SONAX' w nazwie)")
    print(f"Kontrahenci: {s['contractors']} (NIP: {s['contractorsWithNip']}, odbiorcy: {s['contractorsMarkedCustomer']})")
    print(f"Faktury (historia Sonax, do 2026-02): {s['invoices']} | {s['invoiceDateMin']} - {s['invoiceDateMax']}")
    print(f"Suma brutto (historia): {s['invoiceTotalGrossPln']:,.2f} PLN")
    ex = s.get("excludedFromSubiektAnalysis") or s.get("fromAcquisitionInSubiekt") or {}
    if ex.get("invoices"):
        print(f"Pominiete FV Subiekt od 2026-03: {ex['invoices']} ({ex.get('totalGrossPln', 0):,.2f} PLN)")
    print()
    print(f"Zapisano: {parsed_path.relative_to(ROOT)}")
    print(f"Zapisano: {report_path.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
