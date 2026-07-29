import csv
import json
from pathlib import Path

products = json.load(open("data/products.json", encoding="utf-8"))
skus = set()
for x in products:
    skus.add(x["sku"])
    for v in x.get("variants", []):
        skus.add(v["sku"])

eans = {}
with open(
    Path(r"d:/Users/Biuro/Downloads/Base__Produkty__domylny_CSV_2026-07-27_13_44.csv"),
    encoding="utf-8",
) as f:
    for row in csv.DictReader(f, delimiter=";", quotechar='"'):
        sku = row.get("produkt_sku", "").strip().upper()
        ean = row.get("produkt_ean", "").strip()
        if sku and ean:
            eans[sku] = ean

overlap = [s for s in skus if s in eans]
print("catalog skus", len(skus))
print("baselinker eans", len(eans))
print("overlap", len(overlap))
