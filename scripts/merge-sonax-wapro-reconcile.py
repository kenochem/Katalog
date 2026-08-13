#!/usr/bin/env python3
"""
Zderzenie bazy Sonax (Subiekt, historia do 2026-02-28) z WAPRO Kenochem (od 2026-03-01).

Wejście (data/sonax-import/):
  sonax-kontrahenci.tsv, sonax-faktury.tsv  — Subiekt (już w repo)
  wapro-faktury.tsv, wapro-kontrahenci.tsv  — eksport z serwera (sync-wapro-sonax-export.ps1)
  wapro-kenochem-przed.tsv                  — klienci z FV Kenochem przed 2026-03-01

Wyjście:
  sonax-reconcile.json           — pełny raport + segmentacja klientów
  sonax-acquisition-clients.tsv  — ROI: klienci z Sonax bez historii Kenochem
  sonax-overlap-excluded.tsv     — wykluczeni (overlap Kenochem + Sonax)
  sonax-acquisition-monthly.tsv  — trend miesięczny WAPRO (segment from_sonax)

Segmenty klientów:
  from_sonax         — Subiekt przed 03/2026 + WAPRO od 03/2026, brak FV Kenochem przed marcem
  overlap_kenochem   — Subiekt + WAPRO od marca, ale FV Kenochem przed marcem (poza ROI)
  sonax_dormant      — historia Sonax, brak sprzedaży WAPRO po przejęciu
  kenochem_new       — tylko WAPRO od 03/2026 (bez dopasowania do Sonax)
  *_unverified       — dopasowanie tylko po nazwie (brak NIP)
"""

from __future__ import annotations

import argparse
import json
import re
import unicodedata
from collections import defaultdict
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).parent.parent
IMPORT_DIR = ROOT / "data" / "sonax-import"
PUBLIC_DIR = ROOT / "public" / "data" / "sonax-import"

ACQUISITION_DATE = "2026-03-01"
SUBIEKT_CUTOFF = "2026-02-28"  # ostatni dzień historii Subiekt w analizie


def norm_nip(value: str) -> str:
    digits = re.sub(r"\D", "", value or "")
    return digits if len(digits) >= 10 else ""


def norm_name(value: str) -> str:
    s = (value or "").upper().strip()
    s = s.replace('"', "").replace("'", "")
    s = unicodedata.normalize("NFKD", s)
    s = "".join(c for c in s if not unicodedata.combining(c))
    s = re.sub(r"\s+", " ", s)
    for token in (
        r"\bSP\.?\s*Z\s*O\.?\s*O\.?\b",
        r"\bSPOLKA\s+Z\s+OGRANICZONA\s+ODPOWIEDZIALNOSCIA\b",
        r"\bS\.?\s*C\.?\b",
        r"\bP\.?\s*P\.?\s*H\.?\b",
        r"\bF\.?\s*H\.?\b",
    ):
        s = re.sub(token, " ", s, flags=re.I)
    s = re.sub(r"[^A-Z0-9 ]+", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s


def parse_pl_num(value: str) -> float:
    s = str(value or "").strip().replace(" ", "").replace(",", ".")
    try:
        return float(s)
    except ValueError:
        return 0.0


def read_tsv(path: Path) -> tuple[list[str], list[list[str]]]:
    if not path.exists():
        return [], []
    text = path.read_text(encoding="utf-8", errors="replace")
    lines = [ln for ln in text.splitlines() if ln.strip()]
    if not lines:
        return [], []
    header = lines[0].split("\t")
    rows = [ln.split("\t") for ln in lines[1:]]
    return header, rows


def col(row: list[str], idx: int) -> str:
    if idx < 0 or idx >= len(row):
        return ""
    return row[idx].strip()


def clarion_to_date(value: str) -> str:
    s = str(value or "").strip()
    if re.match(r"^\d{4}-\d{2}-\d{2}$", s):
        return s
    try:
        days = int(float(s))
    except ValueError:
        return ""
    if days <= 0:
        return ""
    from datetime import date, timedelta

    if days > 30000:
        epoch = date(1900, 1, 1)
        return (epoch + timedelta(days=days - 36163)).isoformat()
    epoch = date(1800, 12, 28)
    return (epoch + timedelta(days=days)).isoformat()


def load_subiekt_kontrahenci(path: Path) -> tuple[dict[str, dict], dict[str, str]]:
    """nip -> info, norm_name -> nip (best effort)"""
    header, rows = read_tsv(path)
    idx = {name: i for i, name in enumerate(header)}
    by_nip: dict[str, dict] = {}
    name_to_nip: dict[str, str] = {}
    for row in rows:
        name = col(row, idx.get("Nazwa", 4))
        nip = norm_nip(col(row, idx.get("NIP", 5)))
        if not name:
            continue
        nn = norm_name(name)
        if nip:
            by_nip[nip] = {
                "name": name,
                "nip": nip,
                "address": col(row, idx.get("Adres", 6)),
                "city": col(row, idx.get("Miejscowość", 7)),
                "symbol": col(row, idx.get("Symbol", 3)),
            }
            if nn and nn not in name_to_nip:
                name_to_nip[nn] = nip
        elif nn and nn not in name_to_nip:
            name_to_nip[nn] = ""
    return by_nip, name_to_nip


def load_subiekt_faktury(path: Path) -> list[dict]:
    header, rows = read_tsv(path)
    idx = {name: i for i, name in enumerate(header)}
    out: list[dict] = []
    for row in rows:
        date = col(row, idx.get("Data", 2))
        if not date or date >= ACQUISITION_DATE:
            continue
        client = col(row, idx.get("Kontrahent", 5))
        if not client:
            continue
        out.append(
            {
                "date": date,
                "number": col(row, idx.get("Numer", 4)),
                "clientName": client,
                "valueGross": parse_pl_num(col(row, idx.get("Wartość", 6))),
            }
        )
    return out


def load_wapro_faktury(path: Path) -> tuple[list[dict], dict]:
    header, rows = read_tsv(path)
    if not header:
        return [], {"rawRows": 0, "uniqueInvoices": 0}
    idx = {name.lower(): i for i, name in enumerate(header)}
    by_key: dict[tuple[str, str, str, str], dict] = {}
    raw_after_date = 0
    for row in rows:
        date = clarion_to_date(col(row, idx.get("data_int", 0)))
        if not date or date < ACQUISITION_DATE:
            continue
        client = col(row, idx.get("kontrahent", 2))
        if not client:
            continue
        raw_after_date += 1
        number = col(row, idx.get("numer", 1))
        nip = norm_nip(col(row, idx.get("nip", 3)))
        net = parse_pl_num(col(row, idx.get("netto", 4)))
        gross = parse_pl_num(col(row, idx.get("brutto_proxy", 5)))
        if gross <= 0:
            gross = net
        key = (date, number, norm_name(client), nip)
        if key not in by_key:
            by_key[key] = {
                "date": date,
                "number": number,
                "clientName": client,
                "nip": nip,
                "valueNet": net,
                "valueGross": gross,
            }
        else:
            existing = by_key[key]
            existing["valueNet"] += net
            existing["valueGross"] += gross
    out = list(by_key.values())
    meta = {
        "rawRows": raw_after_date,
        "uniqueInvoices": len(out),
        "dedupedRows": max(0, raw_after_date - len(out)),
    }
    return out, meta


def load_wapro_kontrahenci(path: Path) -> dict[str, dict]:
    header, rows = read_tsv(path)
    if not header:
        return {}
    idx = {name.lower(): i for i, name in enumerate(header)}
    by_nip: dict[str, dict] = {}
    for row in rows:
        name = col(row, idx.get("nazwa", 1))
        nip = norm_nip(col(row, idx.get("nip", 2)))
        if not name:
            continue
        if nip:
            by_nip[nip] = {"name": name, "nip": nip, "waproId": col(row, idx.get("id", 0))}
    return by_nip


def load_kenochem_before(path: Path) -> tuple[set[str], set[str], list[dict]]:
    """NIP-y i nazwy klientow z FV Kenochem przed ACQUISITION_DATE."""
    header, rows = read_tsv(path)
    if not header:
        return set(), set(), []
    idx = {name.lower(): i for i, name in enumerate(header)}
    nips: set[str] = set()
    names: set[str] = set()
    detail: list[dict] = []
    for row in rows:
        nip = norm_nip(col(row, idx.get("nip", 0)))
        name = col(row, idx.get("kontrahent", 1))
        fv_count = int(parse_pl_num(col(row, idx.get("fv_count", 2))))
        netto = parse_pl_num(col(row, idx.get("netto_pln", 3)))
        if not name and not nip:
            continue
        if nip:
            nips.add(nip)
        nn = norm_name(name)
        if nn:
            names.add(nn)
        detail.append(
            {
                "nip": nip,
                "name": name,
                "fvCount": fv_count,
                "netPln": round(netto, 2),
            }
        )
    return nips, names, detail


def was_kenochem_before(
    client: dict,
    before_nips: set[str],
    before_names: set[str],
) -> bool:
    nip = norm_nip(client.get("nip") or "")
    if nip and nip in before_nips:
        return True
    nn = norm_name(client.get("displayName") or "")
    return bool(nn and nn in before_names)


def resolve_client_key(
    client_name: str,
    nip: str,
    subiekt_by_nip: dict[str, dict],
    subiekt_name_to_nip: dict[str, str],
    wapro_by_nip: dict[str, dict],
) -> tuple[str, str, str]:
    """Returns (client_key, match_method, canonical_name)"""
    n = norm_nip(nip)
    if n:
        name = (
            subiekt_by_nip.get(n, {}).get("name")
            or wapro_by_nip.get(n, {}).get("name")
            or client_name
        )
        return f"nip:{n}", "nip", name

    nn = norm_name(client_name)
    if nn in subiekt_name_to_nip and subiekt_name_to_nip[nn]:
        n2 = subiekt_name_to_nip[nn]
        name = subiekt_by_nip.get(n2, {}).get("name") or client_name
        return f"nip:{n2}", "name_to_subiekt_nip", name

    if nn:
        return f"name:{nn}", "name_only", client_name
    return f"raw:{client_name[:80]}", "raw", client_name


def aggregate_clients(
    subiekt_invoices: list[dict],
    wapro_invoices: list[dict],
    subiekt_by_nip: dict[str, dict],
    subiekt_name_to_nip: dict[str, str],
    wapro_by_nip: dict[str, dict],
    kenochem_before_nips: set[str],
    kenochem_before_names: set[str],
    kenochem_before_loaded: bool,
) -> dict[str, dict]:
    clients: dict[str, dict] = {}

    def ensure(key: str, method: str, name: str, nip: str = "") -> dict:
        if key not in clients:
            clients[key] = {
                "clientKey": key,
                "matchMethod": method,
                "displayName": name,
                "nip": nip,
                "sonaxInvoiceCount": 0,
                "sonaxGrossPln": 0.0,
                "sonaxFirstDate": None,
                "sonaxLastDate": None,
                "waproInvoiceCount": 0,
                "waproNetPln": 0.0,
                "waproGrossPln": 0.0,
                "waproFirstDate": None,
                "waproLastDate": None,
                "segment": "unknown",
            }
        return clients[key]

    for inv in subiekt_invoices:
        nip_hint = ""
        nn = norm_name(inv["clientName"])
        if nn in subiekt_name_to_nip:
            nip_hint = subiekt_name_to_nip[nn]
        key, method, name = resolve_client_key(
            inv["clientName"], nip_hint, subiekt_by_nip, subiekt_name_to_nip, wapro_by_nip
        )
        c = ensure(key, method, name, norm_nip(nip_hint))
        c["sonaxInvoiceCount"] += 1
        c["sonaxGrossPln"] += inv["valueGross"]
        d = inv["date"]
        if not c["sonaxFirstDate"] or d < c["sonaxFirstDate"]:
            c["sonaxFirstDate"] = d
        if not c["sonaxLastDate"] or d > c["sonaxLastDate"]:
            c["sonaxLastDate"] = d
        if not c["nip"] and nip_hint:
            c["nip"] = nip_hint

    for inv in wapro_invoices:
        key, method, name = resolve_client_key(
            inv["clientName"],
            inv.get("nip", ""),
            subiekt_by_nip,
            subiekt_name_to_nip,
            wapro_by_nip,
        )
        c = ensure(key, method, name, inv.get("nip") or "")
        c["waproInvoiceCount"] += 1
        c["waproNetPln"] += inv["valueNet"]
        c["waproGrossPln"] += inv["valueGross"]
        d = inv["date"]
        if not c["waproFirstDate"] or d < c["waproFirstDate"]:
            c["waproFirstDate"] = d
        if not c["waproLastDate"] or d > c["waproLastDate"]:
            c["waproLastDate"] = d
        if not c["nip"] and inv.get("nip"):
            c["nip"] = inv["nip"]

    for c in clients.values():
        has_sonax = c["sonaxInvoiceCount"] > 0
        has_wapro = c["waproInvoiceCount"] > 0
        if has_sonax and has_wapro:
            overlap = (
                kenochem_before_loaded
                and was_kenochem_before(c, kenochem_before_nips, kenochem_before_names)
            )
            c["segment"] = "overlap_kenochem" if overlap else "from_sonax"
            c["kenochemBefore"] = overlap
        elif has_sonax:
            c["segment"] = "sonax_dormant"
            c["kenochemBefore"] = (
                kenochem_before_loaded
                and was_kenochem_before(c, kenochem_before_nips, kenochem_before_names)
            )
        elif has_wapro:
            c["segment"] = "kenochem_new"
            c["kenochemBefore"] = (
                kenochem_before_loaded
                and was_kenochem_before(c, kenochem_before_nips, kenochem_before_names)
            )
        else:
            c["segment"] = "unknown"
            c["kenochemBefore"] = False

        if c["matchMethod"] in ("name_only", "raw") and not c["nip"]:
            if c["segment"] == "from_sonax":
                c["segment"] = "from_sonax_unverified"
            elif c["segment"] == "overlap_kenochem":
                c["segment"] = "overlap_kenochem_unverified"
            elif c["segment"] == "kenochem_new":
                c["segment"] = "kenochem_new_unverified"

        for field in ("sonaxGrossPln", "waproNetPln", "waproGrossPln"):
            c[field] = round(c[field], 2)

    return clients


def monthly_trend(
    subiekt_invoices: list[dict], wapro_invoices: list[dict]
) -> list[dict]:
    by_month: dict[str, dict] = defaultdict(
        lambda: {"sonaxGrossPln": 0.0, "waproNetPln": 0.0, "waproGrossPln": 0.0}
    )
    for inv in subiekt_invoices:
        ym = inv["date"][:7]
        by_month[ym]["sonaxGrossPln"] += inv["valueGross"]
    for inv in wapro_invoices:
        ym = inv["date"][:7]
        by_month[ym]["waproNetPln"] += inv["valueNet"]
        by_month[ym]["waproGrossPln"] += inv["valueGross"]
    rows = []
    for ym in sorted(by_month.keys()):
        m = by_month[ym]
        rows.append(
            {
                "month": ym,
                "sonaxGrossPln": round(m["sonaxGrossPln"], 2),
                "waproNetPln": round(m["waproNetPln"], 2),
                "waproGrossPln": round(m["waproGrossPln"], 2),
                "source": "wapro" if ym >= ACQUISITION_DATE[:7] else "subiekt",
            }
        )
    return rows


def write_clients_tsv(clients: dict[str, dict], path: Path) -> None:
    header = [
        "segment",
        "nip",
        "nazwa",
        "sonax_fv",
        "sonax_brutto_pln",
        "sonax_od",
        "sonax_do",
        "wapro_fv",
        "wapro_netto_pln",
        "wapro_brutto_pln",
        "wapro_od",
        "wapro_do",
        "match",
    ]
    lines = ["\t".join(header)]
    sorted_clients = sorted(
        clients.values(),
        key=lambda c: (-(c["waproNetPln"] + c["sonaxGrossPln"]), c["displayName"]),
    )
    for c in sorted_clients:
        lines.append(
            "\t".join(
                [
                    c["segment"],
                    c["nip"],
                    c["displayName"].replace("\t", " "),
                    str(c["sonaxInvoiceCount"]),
                    f"{c['sonaxGrossPln']:.2f}",
                    c["sonaxFirstDate"] or "",
                    c["sonaxLastDate"] or "",
                    str(c["waproInvoiceCount"]),
                    f"{c['waproNetPln']:.2f}",
                    f"{c['waproGrossPln']:.2f}",
                    c["waproFirstDate"] or "",
                    c["waproLastDate"] or "",
                    c["matchMethod"],
                ]
            )
        )
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


MIGRATED_SEGMENTS = frozenset({"from_sonax", "from_sonax_unverified"})
OVERLAP_SEGMENTS = frozenset({"overlap_kenochem", "overlap_kenochem_unverified"})


def is_from_sonax_client(client: dict) -> bool:
    return client["segment"] in MIGRATED_SEGMENTS and client["waproInvoiceCount"] > 0


def is_overlap_client(client: dict) -> bool:
    return client["segment"] in OVERLAP_SEGMENTS and client["waproInvoiceCount"] > 0


def is_migrated_sonax_client(client: dict) -> bool:
    return is_from_sonax_client(client)


def build_client_invoice_view(
    clients: dict[str, dict],
    wapro_invoices: list[dict],
    subiekt_by_nip: dict[str, dict],
    subiekt_name_to_nip: dict[str, str],
    wapro_by_nip: dict[str, dict],
    segment_filter: frozenset[str],
) -> tuple[list[dict], list[dict]]:
    selected = [c for c in clients.values() if c["segment"] in segment_filter and c["waproInvoiceCount"] > 0]
    keys = {c["clientKey"] for c in selected}

    invoices: list[dict] = []
    for inv in wapro_invoices:
        key, _, display = resolve_client_key(
            inv["clientName"],
            inv.get("nip", ""),
            subiekt_by_nip,
            subiekt_name_to_nip,
            wapro_by_nip,
        )
        if key not in keys:
            continue
        invoices.append(
            {
                "date": inv["date"],
                "number": inv["number"],
                "clientName": inv["clientName"],
                "displayName": display,
                "nip": inv.get("nip", ""),
                "netPln": round(inv["valueNet"], 2),
                "grossPln": round(inv["valueGross"], 2),
                "clientKey": key,
            }
        )
    invoices.sort(key=lambda x: (x["date"], x["number"]), reverse=True)
    return selected, invoices


def build_acquisition_view(
    clients: dict[str, dict],
    wapro_invoices: list[dict],
    subiekt_by_nip: dict[str, dict],
    subiekt_name_to_nip: dict[str, str],
    wapro_by_nip: dict[str, dict],
    kenochem_before_loaded: bool,
) -> dict:
    migrated_clients, migrated_invoices = build_client_invoice_view(
        clients,
        wapro_invoices,
        subiekt_by_nip,
        subiekt_name_to_nip,
        wapro_by_nip,
        MIGRATED_SEGMENTS,
    )

    total_migrated_net = sum(c["waproNetPln"] for c in migrated_clients)
    total_wapro_net = sum(i["valueNet"] for i in wapro_invoices)

    by_month: dict[str, float] = defaultdict(float)
    for inv in migrated_invoices:
        by_month[inv["date"][:7]] += inv["netPln"]
    monthly = [
        {"month": m, "netPln": round(v, 2)}
        for m, v in sorted(by_month.items())
        if m >= ACQUISITION_DATE[:7]
    ]

    return {
        "periodFrom": ACQUISITION_DATE,
        "kenochemBeforeDataMissing": not kenochem_before_loaded,
        "summary": {
            "fromSonaxClients": len(migrated_clients),
            "migratedClients": len(migrated_clients),
            "migratedClientsWithNip": sum(1 for c in migrated_clients if c["nip"]),
            "waproInvoices": len(migrated_invoices),
            "waproNetPln": round(total_migrated_net, 2),
            "waproGrossPln": round(sum(c["waproGrossPln"] for c in migrated_clients), 2),
            "avgNetPerClient": round(total_migrated_net / len(migrated_clients), 2)
            if migrated_clients
            else 0.0,
            "totalWaproNetPln": round(total_wapro_net, 2),
            "shareOfWaproPct": round(100.0 * total_migrated_net / total_wapro_net, 1)
            if total_wapro_net
            else 0.0,
        },
        "clients": sorted(migrated_clients, key=lambda c: -c["waproNetPln"]),
        "invoices": migrated_invoices,
        "monthlyWapro": monthly,
    }


def build_overlap_excluded_view(
    clients: dict[str, dict],
    wapro_invoices: list[dict],
    subiekt_by_nip: dict[str, dict],
    subiekt_name_to_nip: dict[str, str],
    wapro_by_nip: dict[str, dict],
    kenochem_before_loaded: bool,
) -> dict:
    overlap_clients, overlap_invoices = build_client_invoice_view(
        clients,
        wapro_invoices,
        subiekt_by_nip,
        subiekt_name_to_nip,
        wapro_by_nip,
        OVERLAP_SEGMENTS,
    )
    total_net = sum(c["waproNetPln"] for c in overlap_clients)
    return {
        "kenochemBeforeDataMissing": not kenochem_before_loaded,
        "summary": {
            "clients": len(overlap_clients),
            "waproInvoices": len(overlap_invoices),
            "waproNetPln": round(total_net, 2),
        },
        "clients": sorted(overlap_clients, key=lambda c: -c["waproNetPln"]),
        "invoices": overlap_invoices,
    }


def write_acquisition_clients_tsv(clients: list[dict], path: Path) -> None:
    header = [
        "nip",
        "nazwa",
        "wapro_fv",
        "wapro_netto_pln",
        "wapro_brutto_pln",
        "wapro_od",
        "wapro_do",
        "dopasowanie",
    ]
    lines = ["\t".join(header)]
    for c in clients:
        lines.append(
            "\t".join(
                [
                    c["nip"],
                    c["displayName"].replace("\t", " "),
                    str(c["waproInvoiceCount"]),
                    f"{c['waproNetPln']:.2f}",
                    f"{c['waproGrossPln']:.2f}",
                    c["waproFirstDate"] or "",
                    c["waproLastDate"] or "",
                    c["matchMethod"],
                ]
            )
        )
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def write_acquisition_invoices_tsv(invoices: list[dict], path: Path) -> None:
    header = ["data", "numer", "nip", "kontrahent", "netto_pln", "brutto_pln"]
    lines = ["\t".join(header)]
    for inv in invoices:
        lines.append(
            "\t".join(
                [
                    inv["date"],
                    inv["number"].replace("\t", " "),
                    inv["nip"],
                    inv["displayName"].replace("\t", " "),
                    f"{inv['netPln']:.2f}",
                    f"{inv['grossPln']:.2f}",
                ]
            )
        )
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def write_monthly_tsv(rows: list[dict], path: Path) -> None:
    header = ["month", "wapro_netto_pln"]
    lines = ["\t".join(header)]
    for r in rows:
        net = r.get("wapro_netto_pln", r.get("netPln", 0))
        lines.append("\t".join([r["month"], f"{float(net):.2f}"]))
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def segment_summary(clients: dict[str, dict]) -> list[dict]:
    agg: dict[str, dict] = defaultdict(
        lambda: {"count": 0, "sonaxGrossPln": 0.0, "waproNetPln": 0.0}
    )
    for c in clients.values():
        seg = c["segment"]
        agg[seg]["count"] += 1
        agg[seg]["sonaxGrossPln"] += c["sonaxGrossPln"]
        agg[seg]["waproNetPln"] += c["waproNetPln"]
    out = []
    for seg, v in sorted(agg.items(), key=lambda x: -x[1]["waproNetPln"]):
        out.append(
            {
                "segment": seg,
                "clients": v["count"],
                "sonaxGrossPln": round(v["sonaxGrossPln"], 2),
                "waproNetPln": round(v["waproNetPln"], 2),
            }
        )
    return out


def resolve_wapro_path(base_dir: Path, filename: str) -> Path:
    direct = base_dir / filename
    if direct.exists():
        return direct
    nested = base_dir / "sonax-export" / filename
    if nested.exists():
        return nested
    return direct


def main() -> None:
    parser = argparse.ArgumentParser(description="Zderzenie Sonax (Subiekt) + WAPRO")
    parser.add_argument("--dir", type=Path, default=IMPORT_DIR)
    args = parser.parse_args()
    d: Path = args.dir
    d.mkdir(parents=True, exist_ok=True)

    subiekt_k_path = d / "sonax-kontrahenci.tsv"
    subiekt_f_path = d / "sonax-faktury.tsv"
    wapro_f_path = resolve_wapro_path(d, "wapro-faktury.tsv")
    wapro_k_path = resolve_wapro_path(d, "wapro-kontrahenci.tsv")
    kenochem_before_path = resolve_wapro_path(d, "wapro-kenochem-przed.tsv")

    subiekt_by_nip, subiekt_name_to_nip = load_subiekt_kontrahenci(subiekt_k_path)
    subiekt_invoices = load_subiekt_faktury(subiekt_f_path)
    wapro_invoices, wapro_meta = load_wapro_faktury(wapro_f_path)
    wapro_by_nip = load_wapro_kontrahenci(wapro_k_path)
    kenochem_before_nips, kenochem_before_names, kenochem_before_detail = load_kenochem_before(
        kenochem_before_path
    )
    kenochem_before_loaded = kenochem_before_path.exists() and bool(
        kenochem_before_nips or kenochem_before_names
    )

    clients = aggregate_clients(
        subiekt_invoices,
        wapro_invoices,
        subiekt_by_nip,
        subiekt_name_to_nip,
        wapro_by_nip,
        kenochem_before_nips,
        kenochem_before_names,
        kenochem_before_loaded,
    )
    monthly = monthly_trend(subiekt_invoices, wapro_invoices)
    segments = segment_summary(clients)

    acquisition = build_acquisition_view(
        clients,
        wapro_invoices,
        subiekt_by_nip,
        subiekt_name_to_nip,
        wapro_by_nip,
        kenochem_before_loaded,
    )
    excluded_overlap = build_overlap_excluded_view(
        clients,
        wapro_invoices,
        subiekt_by_nip,
        subiekt_name_to_nip,
        wapro_by_nip,
        kenochem_before_loaded,
    )

    report = {
        "generatedAt": datetime.now().isoformat(timespec="seconds"),
        "acquisitionDate": ACQUISITION_DATE,
        "acquisition": acquisition,
        "excludedOverlap": excluded_overlap,
        "inputs": {
            "subiektKontrahenci": subiekt_k_path.name,
            "subiektFaktury": subiekt_f_path.name,
            "waproFaktury": wapro_f_path.name if wapro_f_path.exists() else None,
            "waproKontrahenci": wapro_k_path.name if wapro_k_path.exists() else None,
            "waproKenochemBefore": kenochem_before_path.name
            if kenochem_before_path.exists()
            else None,
        },
        "summary": {
            "subiektInvoicesBeforeAcquisition": len(subiekt_invoices),
            "subiektGrossPln": round(sum(i["valueGross"] for i in subiekt_invoices), 2),
            "subiektUniqueClients": len({norm_name(i["clientName"]) for i in subiekt_invoices}),
            "subiektKontrahenciWithNip": len(subiekt_by_nip),
            "waproInvoicesFromAcquisition": len(wapro_invoices),
            "waproRawRowsInFile": wapro_meta.get("rawRows", 0),
            "waproDedupedRows": wapro_meta.get("dedupedRows", 0),
            "waproNetPln": round(sum(i["valueNet"] for i in wapro_invoices), 2),
            "waproUniqueClients": len({c["clientKey"] for c in clients.values() if c["waproInvoiceCount"]}),
            "reconciledClients": len(clients),
            "waproDataMissing": not wapro_f_path.exists(),
            "kenochemBeforeDataMissing": not kenochem_before_loaded,
            "kenochemBeforeClients": len(kenochem_before_detail),
            "overlapExcludedClients": excluded_overlap["summary"]["clients"],
            "overlapExcludedNetPln": excluded_overlap["summary"]["waproNetPln"],
        },
        "segments": segments,
        "topMigratedClients": acquisition["clients"][:40],
        "clients": acquisition["clients"],
        "monthlyTrend": acquisition["monthlyWapro"],
        "notes": [
            "ROI: tylko klienci z historią Sonax (Subiekt), którzy NIE mieli FV Kenochem przed 2026-03-01.",
            "Overlap (Kenochem + Sonax) trafia do excludedOverlap — np. MOTOZBYT, DAFIPAPIER.",
            "Subiekt służy do rozpoznania klienta Sonax, nie do KPI historycznych.",
            "Nowi klienci tylko z towarami Sonax (SKU) — wymaga eksportu pozycji FV z Mag (faza 2).",
        ],
    }

    out_json = d / "sonax-reconcile.json"
    out_clients = d / "sonax-acquisition-clients.tsv"
    out_invoices = d / "sonax-acquisition-invoices.tsv"
    out_monthly = d / "sonax-acquisition-monthly.tsv"
    out_overlap = d / "sonax-overlap-excluded.tsv"

    out_json.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    write_acquisition_clients_tsv(acquisition["clients"], out_clients)
    write_acquisition_invoices_tsv(acquisition["invoices"], out_invoices)
    write_acquisition_clients_tsv(excluded_overlap["clients"], out_overlap)
    write_monthly_tsv(
        [{"month": m["month"], "netPln": m["netPln"]} for m in acquisition["monthlyWapro"]],
        out_monthly,
    )

    PUBLIC_DIR.mkdir(parents=True, exist_ok=True)
    for src in (out_json, out_clients, out_invoices, out_monthly, out_overlap):
        (PUBLIC_DIR / src.name).write_text(src.read_text(encoding="utf-8"), encoding="utf-8")

    s = report["summary"]
    acq = acquisition["summary"]
    ex = excluded_overlap["summary"]
    print("=== Sonax — przychod od klientow z Sonax (bez overlap Kenochem) ===")
    if s["waproDataMissing"]:
        print("WAPRO: BRAK danych")
    else:
        if s["kenochemBeforeDataMissing"]:
            print("UWAGA: brak wapro-kenochem-przed.tsv — overlap NIE wykluczony (uruchom eksport na serwerze)")
        print(f"Klienci z Sonax u nas (ROI): {acq['fromSonaxClients']} ({acq['migratedClientsWithNip']} z NIP)")
        print(f"Wykluczeni overlap Kenochem: {ex['clients']} klientow, {ex['waproNetPln']:,.2f} PLN netto")
        print(f"Faktury WAPRO (ROI): {acq['waproInvoices']}")
        print(f"Obrot netto ROI: {acq['waproNetPln']:,.2f} PLN ({acq['shareOfWaproPct']}% calego WAPRO od marca)")
        print(f"Srednio netto / klient: {acq['avgNetPerClient']:,.2f} PLN")
    print(f"Zapisano: {out_json.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
