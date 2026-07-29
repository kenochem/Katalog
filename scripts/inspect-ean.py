#!/usr/bin/env python3
import csv
import xlrd
from pathlib import Path

DOWNLOADS = Path(r"d:/Users/Biuro/Downloads")

csv_path = DOWNLOADS / "Base__Produkty__domylny_CSV_2026-07-27_13_44.csv"
if csv_path.exists():
    with open(csv_path, encoding="utf-8") as f:
        reader = csv.DictReader(f, delimiter=";", quotechar='"')
        fields = reader.fieldnames or []
        ean_cols = [k for k in fields if k and ("ean" in k.lower() or "kod" in k.lower())]
        print("Baselinker EAN cols:", ean_cols)
        with_ean = 0
        sample = []
        for row in reader:
            sku = row.get("produkt_sku", "").strip().upper()
            ean = ""
            for c in ean_cols:
                ean = row.get(c, "").strip()
                if ean:
                    break
            if ean:
                with_ean += 1
                if len(sample) < 3:
                    sample.append((sku, ean))
        print("Baselinker rows with EAN:", with_ean)
        print("Samples:", sample)

wapro = sorted(
    DOWNLOADS.glob("Artyku*y*przegl*danie*.xls"),
    key=lambda p: p.stat().st_mtime,
    reverse=True,
)
if wapro:
    wb = xlrd.open_workbook(str(wapro[0]), encoding_override="latin-1")
    sh = wb.sheet_by_index(0)
    print("Wapro file:", wapro[0].name)
    for c in range(sh.ncols):
        val = str(sh.cell_value(0, c)).encode("ascii", "replace").decode()
        print(f"  col {c}: {val}")
