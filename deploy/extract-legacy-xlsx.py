"""Read-only owner export conversion. Never prints or retains legacy credentials."""
import datetime
import json
import os
import sys
from pathlib import Path
import openpyxl

SECRET_FIELDS = {"password", "token", "passwordhash", "password_hash", "secret", "access_token", "refresh_token"}

def clean(value):
    if isinstance(value, (datetime.datetime, datetime.date, datetime.time)):
        return value.isoformat()
    if isinstance(value, dict):
        return {k: clean(v) for k, v in value.items() if k.lower() not in SECRET_FIELDS}
    if isinstance(value, list):
        return [clean(v) for v in value]
    return value

def extract(source):
    workbook = openpyxl.load_workbook(source, read_only=True, data_only=True)
    result = {}
    for sheet in workbook:
        rows = sheet.iter_rows(values_only=True)
        headers = next(rows, ())
        data = []
        for row in rows:
            if not any(v not in (None, "") for v in row):
                continue
            record = {str(k): v if v is not None else "" for k, v in zip(headers, row) if k}
            extras = {str(i + 1): v for i, v in enumerate(row) if v not in (None, "") and (i >= len(headers) or not headers[i])}
            if extras:
                record["_sourceColumnsWithoutHeader"] = extras
            data.append(clean(record))
        result[sheet.title] = data
    result["counts"] = {k: len(v) for k, v in result.items()}
    return result

if __name__ == "__main__":
    result = extract(sys.argv[1])
    target = Path(sys.argv[2])
    target.write_text(json.dumps(result, ensure_ascii=False, separators=(",", ":")))
    os.chmod(target, 0o600)
    print(json.dumps({"counts": result["counts"], "credentialsExcluded": True}))
