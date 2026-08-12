#!/usr/bin/env python3
from __future__ import annotations

import csv
import io
import json
import re
from datetime import datetime, timedelta, timezone
from urllib.parse import urlparse
from urllib.request import Request, urlopen

SOURCE = "https://lter.kbs.msu.edu/datatables/13.csv"
USER_AGENT = "GEOX-MCFT-CAP09-KBS-CURRENT-FRESHNESS-METADATA/1.0"
MAX_BYTES = 110_000_000


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
    require(status == 200, f"KBS_CURRENT_FRESHNESS_HTTP:{status}")
    require(len(body) <= MAX_BYTES, "KBS_CURRENT_FRESHNESS_BODY_TOO_LARGE")
    final = urlparse(final_url)
    require(final.scheme == "https" and final.hostname == "lter.kbs.msu.edu" and final.path == "/datatables/13.csv", "KBS_CURRENT_FRESHNESS_IDENTITY_DRIFT")

    text = body.decode("utf-8-sig")
    latest = None
    parsed_row_count = 0
    for delim in (",", "\t", ";", "|"):
        rows = list(csv.reader(io.StringIO(text), delimiter=delim))
        header_index = None
        headers = None
        for idx, cells in enumerate(rows[:80]):
            normalized = [normalize_key(cell) for cell in cells]
            if "datetime_utc" in normalized:
                header_index = idx
                headers = normalized
                break
        if header_index is None:
            continue
        time_index = headers.index("datetime_utc")
        future_limit = retrieved_at + timedelta(minutes=5)
        for values in rows[header_index + 1:]:
            if len(values) <= time_index:
                continue
            parsed = parse_provider_utc(values[time_index])
            if parsed is None or parsed > future_limit:
                continue
            parsed_row_count += 1
            if latest is None or parsed > latest:
                latest = parsed
        break

    require(latest is not None, "KBS_CURRENT_FRESHNESS_TIMESTAMP_REQUIRED")
    age_hours = (retrieved_at - latest).total_seconds() / 3600.0
    proof = {
        "schema_version": "geox_mcft_cap09_kbs_current_freshness_metadata_v1",
        "status": "PASS",
        "requested_at": iso(requested_at),
        "retrieved_at": iso(retrieved_at),
        "latest_raw_hourly_timestamp": iso(latest),
        "latest_age_hours": round(age_hours, 6),
        "configured_authority_max_age_hours": 6,
        "within_frozen_6h_authority": age_hours <= 6,
        "parsed_row_count": parsed_row_count,
        "raw_values_emitted": False,
        "raw_body_retained": False,
        "database_write_count": 0,
        "canonical_write_count": 0,
        "authority_changed": False,
    }
    print(json.dumps(proof, sort_keys=True))


if __name__ == "__main__":
    main()
