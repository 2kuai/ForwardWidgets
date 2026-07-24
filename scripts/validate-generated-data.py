import json
import sys

from data_contract import validate_data


if len(sys.argv) != 2:
    raise RuntimeError("Usage: python scripts/validate-generated-data.py <data-file>")

with open(sys.argv[1], "r", encoding="utf-8") as source:
    data = json.load(source)

record_count = validate_data(data)
print(f"[data] {sys.argv[1]}: {record_count} media records match the shared contract.")
