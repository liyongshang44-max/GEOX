#!/usr/bin/env python3
from __future__ import annotations

import csv
import hashlib
import io
import json
import math
import re
from datetime import datetime, timedelta, timezone
from urllib.parse import urlparse
from urllib.request import Request, urlopen

SOURCE = "https://lter.kbs.msu.edu/datatables/13.csv"
USER_AGENT = "GEOX-MCFT-CAP09-KBS-ENGINEERING-WINDOW/1.0"
MAX_BYTES = 110_000_000
ENGINEERING_MAX_AGE_HOURS = 24
REQUIRED_FIELDS = ["datetime_utc", "rain_mm", "airtmp_107_avg", "ah", "solrad_avg", "wind_speed"]


def require(condition: bool, code: str) -> None:
    if not condition:
        raise RuntimeError(code)


def iso(value: datetime) -> str:
    return value.astimezone(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def normalize_key(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", str(value or "").lstrip("\ufeff").strip().lower()).strip("_")


def parse_provider_utc(value: str):
    raw = str(value or "").replace("\u00a0", " ").strip()
    if not raw:
        return None
    cleaned = re.sub(r"\s+(?:UTC|GMT|\+0000|\+00:00|\+00)$", "", raw, flags=re.I).rstrip("Zz").strip()
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M", "%m/%d/%Y %H:%M:%S", "%m/%d/%Y %H:%M"):
        try:
            return datetime.strptime(cleaned, fmt).replace(tzinfo=timezone.utc)
        except ValueError:
            pass
    try:
        parsed = datetime.fromisoformat(raw.replace("Z", "+00:00"))
        return parsed.astimezone(timezone.utc) if parsed.tzinfo else None
    except ValueError:
        return None


def finite(value):
    try:
        parsed = float(str(value).strip())
        return parsed if math.isfinite(parsed) else None
    except Exception:
        return None


def main() -> None:
    requested_at = datetime.now(timezone.utc)
    req = Request(SOURCE, headers={
        "User-Agent": USER_AGENT,
        "Accept": "text/csv,text/plain;q=0.9,*/*;q=0.5",
        "Cache-Control": "no-cache",
        "Pragma": "no-cache",
    })
    with urlopen(req, timeout=90) as response:
        body = response.read(MAX_BYTES + 1)
        final_url = response.geturl()
        status = int(response.status)
    retrieved_at = datetime.now(timezone.utc)
    require(status == 200, f"KBS_ENGINEERING_HTTP:{status}")
    require(len(body) <= MAX_BYTES, "KBS_ENGINEERING_BODY_TOO_LARGE")
    final = urlparse(final_url)
    require(final.scheme == "https" and final.hostname == "lter.kbs.msu.edu" and final.path == "/datatables/13.csv", "KBS_ENGINEERING_IDENTITY_DRIFT")

    text = body.decode("utf-8-sig")
    latest_pair = None
    header_index = None
    delimiter_name = None
    parsed_row_count = 0
    for delim, name in ((",", "COMMA"), ("\t", "TAB"), (";", "SEMICOLON"), ("|", "PIPE")):
        rows = list(csv.reader(io.StringIO(text), delimiter=delim))
        headers = None
        start = None
        for idx, cells in enumerate(rows[:80]):
            normalized = [normalize_key(cell) for cell in cells]
            if all(field in normalized for field in REQUIRED_FIELDS):
                headers = normalized
                start = idx + 1
                header_index = idx
                delimiter_name = name
                break
        if headers is None:
            continue
        positions = {field: headers.index(field) for field in REQUIRED_FIELDS}
        future_limit = retrieved_at + timedelta(minutes=5)
        for values in rows[start:]:
            if len(values) <= max(positions.values()):
                continue
            timestamp = parse_provider_utc(values[positions["datetime_utc"]])
            if timestamp is None or timestamp > future_limit:
                continue
            parsed_row_count += 1
            if latest_pair is None or timestamp > latest_pair[0]:
                latest_pair = (timestamp, values, positions)
        break

    require(latest_pair is not None, "KBS_ENGINEERING_LATEST_ROW_REQUIRED")
    latest, values, positions = latest_pair
    age_hours = (retrieved_at - latest).total_seconds() / 3600.0
    require(age_hours <= ENGINEERING_MAX_AGE_HOURS, f"KBS_ENGINEERING_WINDOW_STALE:{age_hours:.6f}")

    rain = finite(values[positions["rain_mm"]])
    air = finite(values[positions["airtmp_107_avg"]])
    ah = finite(values[positions["ah"]])
    solar = finite(values[positions["solrad_avg"]])
    wind = finite(values[positions["wind_speed"]])
    require(rain is not None and 0 <= rain <= 100, "KBS_ENGINEERING_RAIN_FIELD_INVALID")
    require(air is not None and -50 <= air <= 60, "KBS_ENGINEERING_AIR_FIELD_INVALID")
    require(ah is not None and 0 < ah <= 10, "KBS_ENGINEERING_AH_FIELD_INVALID")
    require(solar is not None and 0 <= solar <= 1600, "KBS_ENGINEERING_SOLAR_FIELD_INVALID")
    require(wind is not None and 0 <= wind <= 100, "KBS_ENGINEERING_WIND_FIELD_INVALID")

    row_identity = "|".join(str(values[positions[field]]) for field in REQUIRED_FIELDS)
    proof = {
        "schema_version": "geox_mcft_cap09_kbs_engineering_window_v1",
        "status": "PASS",
        "qualification_mode": "ENGINEERING_VALIDATION",
        "requested_at": iso(requested_at),
        "retrieved_at": iso(retrieved_at),
        "latest_raw_hourly_timestamp": iso(latest),
        "latest_age_hours": round(age_hours, 6),
        "production_authority_max_age_hours": 6,
        "production_authority_pass": age_hours <= 6,
        "engineering_max_age_hours": ENGINEERING_MAX_AGE_HOURS,
        "engineering_window_pass": True,
        "required_field_count": len(REQUIRED_FIELDS),
        "required_field_contract_pass": True,
        "latest_row_identity_sha256": "sha256:" + hashlib.sha256(row_identity.encode("utf-8")).hexdigest(),
        "parsed_row_count": parsed_row_count,
        "csv_header_row_index": header_index,
        "csv_delimiter": delimiter_name,
        "authority_effect": False,
        "formal_effect": False,
        "ea5e3_authorized": False,
        "formal_window_started": False,
        "raw_provider_body_retained": False,
        "raw_provider_values_emitted": False,
        "database_write_count": 0,
        "canonical_write_count": 0,
    }
    print(json.dumps(proof, sort_keys=True))


if __name__ == "__main__":
    main()
