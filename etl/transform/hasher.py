import hashlib
import json


def compute_line_hash(row_values: list[str]) -> str:
    payload = json.dumps(row_values, ensure_ascii=False, sort_keys=False)
    return hashlib.md5(payload.encode("utf-8")).hexdigest()
