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

import numpy as np
import refet

SOURCE = "https://lter.kbs.msu.edu/datatables/13.csv"
USER_AGENT = "GEOX-MCFT-CAP09-KBS-ENGINEERING-VALUE-PATH/1.0"
MAX_BYTES = 110_000_000
ENGINEERING_MAX_AGE_HOURS = 24
SEARCH_BACK_HOURS = 36
STATION_LAT = 42.408537
STATION_LON = -85.373637
STATION_ELEV_M = 286.43
WIND_FACTOR = 0.747951075
SOLAR_FACTOR = 0.0036
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


def scalar_eto(t_c: float, ea_kpa: float, rs: float, wind2: float, interval_end: datetime) -> float:
    start = interval_end - timedelta(hours=1)
    obj = refet.Hourly(
        tmean=t_c,
        ea=ea_kpa,
        rs=rs,
        uz=wind2,
        zw=2,
        elev=STATION_ELEV_M,
        lat=STATION_LAT,
        lon=STATION_LON,
        doy=start.timetuple().tm_yday,
        time=start.hour,
        method="asce",
    )
    arr = np.asarray(obj.eto(), dtype=float).reshape(-1)
    require(arr.size == 1 and math.isfinite(float(arr[0])), "KBS_ENGINEERING_ET0_NONFINITE")
    return float(arr[0])


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
    require(status == 200 and len(body) <= MAX_BYTES, "KBS_ENGINEERING_VALUE_PATH_HTTP_OR_SIZE")
    final = urlparse(final_url)
    require(final.scheme == "https" and final.hostname == "lter.kbs.msu.edu" and final.path == "/datatables/13.csv", "KBS_ENGINEERING_VALUE_PATH_IDENTITY_DRIFT")

    text = body.decode("utf-8-sig")
    parsed = []
    positions = None
    for delim in (",", "\t", ";", "|"):
        rows = list(csv.reader(io.StringIO(text), delimiter=delim))
        headers = None
        start = None
        for idx, cells in enumerate(rows[:80]):
            normalized = [normalize_key(cell) for cell in cells]
            if all(field in normalized for field in REQUIRED_FIELDS):
                headers = normalized
                start = idx + 1
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
            parsed.append((timestamp, values))
        break

    require(parsed and positions is not None, "KBS_ENGINEERING_VALUE_PATH_ROWS_REQUIRED")
    parsed.sort(key=lambda x: x[0])
    provider_latest = parsed[-1][0]
    provider_age_hours = (retrieved_at - provider_latest).total_seconds() / 3600.0
    require(provider_age_hours <= ENGINEERING_MAX_AGE_HOURS, f"KBS_ENGINEERING_VALUE_PATH_STALE:{provider_age_hours:.6f}")

    search_start = provider_latest - timedelta(hours=SEARCH_BACK_HOURS)
    eligible = []
    for timestamp, values in parsed:
        if timestamp < search_start or timestamp > provider_latest:
            continue
        rain = finite(values[positions["rain_mm"]])
        air = finite(values[positions["airtmp_107_avg"]])
        ah = finite(values[positions["ah"]])
        solar = finite(values[positions["solrad_avg"]])
        wind = finite(values[positions["wind_speed"]])
        if None in (rain, air, ah, solar, wind):
            continue
        if not (0 <= rain <= 100 and -50 <= air <= 60 and 0 < ah <= 10 and 0 <= solar <= 1600 and 0 <= wind <= 100):
            continue
        eligible.append((timestamp, rain, air, ah, solar, wind))

    require(eligible, "KBS_ENGINEERING_VALUE_PATH_COMPLETE_EXACT_HOUR_REQUIRED")
    target, rain, air, ah, solar, wind = eligible[-1]
    et0 = scalar_eto(air, ah, solar * SOLAR_FACTOR, wind * WIND_FACTOR, target)
    require(math.isfinite(et0), "KBS_ENGINEERING_VALUE_PATH_ET0_INVALID")

    value_identity = {
        "target": iso(target),
        "rain_hex": float(rain).hex(),
        "air_hex": float(air).hex(),
        "ah_hex": float(ah).hex(),
        "solar_hex": float(solar).hex(),
        "wind_hex": float(wind).hex(),
        "et0_hex": float(et0).hex(),
    }
    proof = {
        "schema_version": "geox_mcft_cap09_kbs_engineering_value_path_v1",
        "status": "PASS",
        "qualification_mode": "ENGINEERING_VALIDATION",
        "requested_at": iso(requested_at),
        "retrieved_at": iso(retrieved_at),
        "provider_latest_timestamp": iso(provider_latest),
        "provider_latest_age_hours": round(provider_age_hours, 6),
        "production_authority_max_age_hours": 6,
        "production_authority_pass": provider_age_hours <= 6,
        "engineering_max_age_hours": ENGINEERING_MAX_AGE_HOURS,
        "selected_complete_exact_hour": iso(target),
        "selected_row_lag_from_provider_latest_hours": round((provider_latest - target).total_seconds() / 3600.0, 6),
        "rainfall_decode_executed": True,
        "historical_et0_decode_executed": True,
        "asce_et0_method": "ASCE_STANDARDIZED_REFERENCE_ET_SHORT_HOURLY_V1",
        "refet_version": "0.4.2",
        "value_identity_sha256": "sha256:" + hashlib.sha256(json.dumps(value_identity, sort_keys=True, separators=(",", ":")).encode("utf-8")).hexdigest(),
        "raw_provider_body_retained": False,
        "raw_provider_values_emitted": False,
        "decoded_values_emitted": False,
        "authority_effect": False,
        "formal_effect": False,
        "ea5e3_authorized": False,
        "formal_window_started": False,
        "database_write_count": 0,
        "canonical_write_count": 0,
    }
    print(json.dumps(proof, sort_keys=True))


if __name__ == "__main__":
    main()
