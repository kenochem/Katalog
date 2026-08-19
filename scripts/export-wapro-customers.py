#!/usr/bin/env python3
"""
Eksport kontrahentow z WAPRO (XLS/CSV) do data/wapro-customers.json + CSV.

  py scripts/export-wapro-customers.py --file "C:\\...\\Kontrahenci.xls"
  py scripts/export-wapro-customers.py --file "C:\\...\\Kontrahenci.csv"
"""
from __future__ import annotations

import argparse
import csv
import json
import re
import shutil
import unicodedata
from datetime import datetime, timezone
from pathlib import Path

import xlrd

ROOT = Path(__file__).parent.parent
JSON_PATH = ROOT / "data" / "wapro-customers.json"
CSV_PATH = ROOT / "data" / "wapro-customers.csv"
SYNC_DIR = Path(r"C:\katalog-sync")

ALIASES = {
    "waproId": ["id", "id kontrahenta", "identyfikator", "lp"],
    "code": ["kod", "symbol", "skrot", "akronim", "numer"],
    "name": ["nazwa", "kontrahent", "nazwa skrocona", "nazwa kontrahenta"],
    "legalName": ["nazwa pelna", "pelna nazwa", "firma", "nazwa firmy"],
    "nip": ["nip", "n i p"],
    "city": ["miasto", "miejscowosc", "miejscowosc poczty"],
    "postalCode": ["kod pocztowy", "kod"],
    "street": ["ulica", "adres ulica"],
    "address": ["adres", "adres pelny"],
    "country": ["kraj", "panstwo"],
    "phone": ["telefon", "tel", "komorka", "telefon kom"],
    "email": ["email", "e-mail", "mail"],
    "paymentTermsDays": ["termin platnosci", "dni platnosci", "platnosc dni"],
    "creditLimit": ["limit kredytu", "limit", "limit kupiecki"],
    "balance": ["saldo", "naleznosci", "zobowiazania"],
}


def norm(value: object) -> str:
    text = str(value or "").strip().lower()
    text = unicodedata.normalize("NFKD", text)
    text = "".join(ch for ch in text if not unicodedata.combining(ch))
    return re.sub(r"\s+", " ", text)


def cell_text(value: object) -> str:
    if value is None:
        return ""
    if isinstance(value, float) and value.is_integer():
        return str(int(value))
    return str(value).strip()


def parse_number(value: object):
    text = cell_text(value).replace(" ", "").replace(",", ".")
    if not text:
        return None
    try:
        return float(text)
    except ValueError:
        return None


def find_latest_file() -> Path:
    downloads = Path.home() / "Downloads"
    patterns = ["*kontrah*.xls", "*klien*.xls", "*customer*.xls", "*kontrah*.csv", "*klien*.csv"]
    candidates: list[Path] = []
    for pattern in patterns:
        candidates.extend(downloads.glob(pattern))
    if not candidates:
        raise SystemExit("Nie znaleziono eksportu kontrahentow. Podaj --file.")
    return max(candidates, key=lambda p: p.stat().st_mtime)


def read_table(path: Path) -> list[list[str]]:
    if path.suffix.lower() == ".csv":
        raw = path.read_text(encoding="utf-8-sig", errors="replace")
        sample = raw.splitlines()[0] if raw.splitlines() else ""
        delimiter = ";" if ";" in sample else ","
        return [row for row in csv.reader(raw.splitlines(), delimiter=delimiter)]

    wb = xlrd.open_workbook(str(path), encoding_override="latin-1")
    sh = wb.sheet_by_index(0)
    return [[cell_text(sh.cell_value(r, c)) for c in range(sh.ncols)] for r in range(sh.nrows)]


def detect_header(rows: list[list[str]]) -> tuple[int, dict[str, int]]:
    alias_lookup = {
        alias: field
        for field, aliases in ALIASES.items()
        for alias in aliases
    }
    best_index = 0
    best_matches: dict[str, int] = {}
    for index, row in enumerate(rows[:12]):
        matches: dict[str, int] = {}
        for col, value in enumerate(row):
            field = alias_lookup.get(norm(value))
            if field and field not in matches:
                matches[field] = col
        if len(matches) > len(best_matches):
            best_index = index
            best_matches = matches
    if "name" not in best_matches and "legalName" not in best_matches:
        raise SystemExit("Nie rozpoznalem kolumny nazwy kontrahenta w eksporcie.")
    return best_index, best_matches


def value(row: list[str], cols: dict[str, int], field: str) -> str:
    index = cols.get(field)
    if index is None or index >= len(row):
        return ""
    return cell_text(row[index])


def load_customers(path: Path) -> list[dict]:
    rows = read_table(path)
    header_index, cols = detect_header(rows)
    out: list[dict] = []
    seen: set[str] = set()
    for row in rows[header_index + 1 :]:
        name = value(row, cols, "name") or value(row, cols, "legalName")
        if not name:
            continue
        nip = value(row, cols, "nip")
        code = value(row, cols, "code")
        wapro_id = value(row, cols, "waproId") or code or re.sub(r"\D", "", nip) or name.lower()
        key = wapro_id.strip().lower()
        if key in seen:
            continue
        seen.add(key)
        out.append(
            {
                "waproId": wapro_id,
                "code": code,
                "name": name,
                "legalName": value(row, cols, "legalName"),
                "nip": nip,
                "city": value(row, cols, "city"),
                "postalCode": value(row, cols, "postalCode"),
                "street": value(row, cols, "street"),
                "address": value(row, cols, "address"),
                "country": value(row, cols, "country") or "PL",
                "phone": value(row, cols, "phone"),
                "email": value(row, cols, "email"),
                "paymentTermsDays": parse_number(value(row, cols, "paymentTermsDays")),
                "creditLimit": parse_number(value(row, cols, "creditLimit")),
                "balance": parse_number(value(row, cols, "balance")),
                "isActive": not norm(name).startswith(("x ", "x.", "xxx")),
            }
        )
    return out


def write_outputs(rows: list[dict], source: Path) -> None:
    JSON_PATH.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "exportedAt": datetime.now(timezone.utc).isoformat(),
        "sourceFile": source.name,
        "rows": rows,
    }
    JSON_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")

    with CSV_PATH.open("w", encoding="utf-8", newline="") as f:
        writer = csv.writer(f, delimiter=";")
        headers = [
            "waproId",
            "code",
            "name",
            "legalName",
            "nip",
            "city",
            "postalCode",
            "street",
            "address",
            "country",
            "phone",
            "email",
            "paymentTermsDays",
            "creditLimit",
            "balance",
            "isActive",
        ]
        writer.writerow(headers)
        for row in rows:
            writer.writerow([row.get(header, "") for header in headers])

    if SYNC_DIR.is_dir():
        shutil.copy2(JSON_PATH, SYNC_DIR / "wapro-customers.json")
        shutil.copy2(CSV_PATH, SYNC_DIR / "wapro-customers.csv")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--file", type=str, help="Sciezka do XLS/CSV z kontrahentami WAPRO")
    args = parser.parse_args()

    path = Path(args.file) if args.file else find_latest_file()
    rows = load_customers(path)
    write_outputs(rows, path)
    print(f"WAPRO kontrahenci: {path}")
    print(f"Wyeksportowano: {len(rows)}")
    print(f"JSON: {JSON_PATH}")
    print(f"CSV: {CSV_PATH}")


if __name__ == "__main__":
    main()

