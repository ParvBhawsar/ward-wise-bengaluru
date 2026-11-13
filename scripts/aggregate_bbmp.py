"""Build Ward Wise's 2020–2024 BBMP application counts using the Python standard library."""
import argparse
import collections
import csv
import datetime
import gzip
import hashlib
import json
import re
import tempfile
import urllib.request
from pathlib import Path

SOURCE = "https://github.com/Vonter/bbmp-trade-license/releases/download/bbmp-trade-license/trade-license.csv.gz"
DIGEST = "0980a6cff9c7ba361c83172f9c5f32bda7245878456a8f0a62cfb6f9d2bd89cc"
FIELDS = {"Date", "Application ID", "Application Type", "Ward", "Major Trade"}
CATEGORIES = {
    "1": "Food & drink",
    "2": "Accommodation",
    "3": "Medical & personal care",
    "4": "Industrial trades",
    "5": "Construction materials",
    "6": "Retail & other trades",
    "7": "Power machinery",
    "8": "Entertainment & fuel",
}
PERIOD = (2020, 2024)


def aggregate(source, crosswalk, output):
    with open(source, "rb") as handle:
        digest = hashlib.file_digest(handle, "sha256").hexdigest()
    if digest != DIGEST:
        raise ValueError("Unexpected source digest. Obtain the documented 1 September 2026 release snapshot.")
    with open(crosswalk, encoding="utf-8-sig", newline="") as handle:
        ward_ids = {row["source_ward"]: int(row["ward_id"]) for row in csv.DictReader(handle)}
    if len(ward_ids) != 198 or set(ward_ids.values()) != set(range(1, 199)):
        raise ValueError("The crosswalk must contain all 198 unique legacy ward IDs.")
    cells = collections.defaultdict(collections.Counter)
    seen = {}
    years = collections.Counter()
    coverage = collections.Counter()
    types = collections.Counter()
    unknown_by_year = collections.Counter()
    days = set()
    with gzip.open(source, "rt", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        if not FIELDS <= set(reader.fieldnames or []):
            raise ValueError("Input is missing required source fields.")
        for row in reader:
            coverage["source_rows"] += 1
            if not row["Date"]:
                coverage["missing_date"] += 1
                continue
            date = datetime.date.fromisoformat(row["Date"][:10])
            if not PERIOD[0] <= date.year <= PERIOD[1]:
                continue
            coverage["in_period_rows"] += 1
            category = "Unclassified"
            if row["Major Trade"]:
                match = re.match(r"PART-([1-8])\(", row["Major Trade"])
                if not match:
                    raise ValueError("Unrecognised source trade heading")
                category = CATEGORIES[match[1]]
            application_type = row["Application Type"].strip()
            if application_type not in ("Renewal", "New"):
                raise ValueError(f"Unrecognised application type {application_type!r}")
            source_ward = row["Ward"].strip()
            if source_ward not in ward_ids:
                raise ValueError(f"Unmapped ward {source_ward!r}")
            application_id = row["Application ID"].strip()
            if not application_id:
                raise ValueError("Empty application ID")
            key = (ward_ids[source_ward], date, application_type)
            if application_id in seen:
                previous_key, categories = seen[application_id]
                if previous_key != key:
                    raise ValueError("Application ID has inconsistent ward, date or application type")
                categories.add(category)
                coverage["additional_trade_rows"] += 1
            else:
                seen[application_id] = (key, {category})
    for (ward_id, date, application_type), categories in seen.values():
        categories.discard("Unclassified")
        if len(categories) > 1:
            category = "Multiple categories"
        elif categories:
            category = next(iter(categories))
        else:
            category = "Unclassified"
        cells[(ward_id, date.year, (date.month-1)//3+1, category)][application_type] += 1
        years[date.year] += 1
        types[application_type] += 1
        if category == "Unclassified":
            unknown_by_year[date.year] += 1
        days.add(date)
    output.mkdir(exist_ok=True, parents=True)
    with (output/"application-counts.csv").open("w", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle)
        writer.writerow(["ward_id", "year", "quarter", "category", "new", "renewal", "total"])
        for key, classes in sorted(cells.items()):
            writer.writerow([*key, classes["New"], classes["Renewal"], classes.total()])
    provenance = {
        "source": SOURCE, "source_release": "2026-09-01", "source_sha256": digest,
        "attribution": "BBMP Trade License Website; BBMP trade-licence applications dataset compiled by Vivek Matthew (Vonter), adapted by Team Codyssey.",
        "license": "ODbL 1.0", "license_url": "https://opendatacommons.org/licenses/odbl/1-0/",
        "period": PERIOD, "start_date": str(min(days)), "end_date": str(max(days)),
        "distinct_application_ids": len(seen), "distinct_wards": len({k[0] for k in cells}),
        "distinct_quarters": len({k[1:3] for k in cells}), "aggregated_rows": len(cells),
        "source_rows": coverage["source_rows"], "missing_date_in_full_source": coverage["missing_date"],
        "period_rows_before_deduplication": coverage["in_period_rows"], "additional_trade_rows_for_repeat_ids": coverage["additional_trade_rows"],
        "application_types": dict(sorted(types.items())), "calendar_year_totals": dict(sorted(years.items())),
        "unclassified_by_year": {y: unknown_by_year[y] for y in sorted(years)},
        "categories": list(CATEGORIES.values()) + ["Multiple categories", "Unclassified"],
    }
    (output/"coverage.json").write_text(json.dumps(provenance, indent=2)+"\n", encoding="utf-8")
    return provenance


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, help="Existing original compressed CSV. If omitted, downloads it to a temporary directory.")
    parser.add_argument("--crosswalk", type=Path, default=Path(__file__).with_name("ward-crosswalk.csv"))
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    with tempfile.TemporaryDirectory() as temp:
        source = args.source
        if source is None:
            source = Path(temp)/"source.csv.gz"
            urllib.request.urlretrieve(SOURCE, source)
        print(json.dumps(aggregate(source, args.crosswalk, args.output), indent=2))


if __name__ == "__main__":
    main()
