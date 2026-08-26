#!/usr/bin/env python3
from __future__ import annotations

import csv
import math
import re
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

import numpy as np
import refet


@dataclass(frozen=True)
class KbsRawHourlyScientificAuthorityV1:
    raw_hourly_latest_max_age_hours: float
    station_elevation_m: float
    station_latitude: float
    station_longitude: float
    wind_10m_to_2m_factor: float
    solar_w_m2_to_mj_m2_h_factor: float = 0.0036


@dataclass(frozen=True)
class KbsRawHourlyExactIntervalV1:
    target_interval_end: datetime
    provider_latest_timestamp: datetime
    provider_latest_age_hours: float
    rainfall_mm: float
    historical_et0_mm: float
    air_temperature_c: float
    actual_vapor_pressure_kpa: float
    solar_radiation_w_m2: float
    wind_speed_10m: float


def require_v1(condition: bool, code: str) -> None:
    if not condition:
        raise RuntimeError(code)


def normalize_key_v1(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", str(value or "").lstrip("\ufeff").strip().lower()).strip("_")


def parse_provider_utc_v1(value: str) -> datetime | None:
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


def finite_v1(value) -> float | None:
    try:
        parsed = float(str(value).strip())
        return parsed if math.isfinite(parsed) else None
    except Exception:
        return None


def parse_kbs_raw_hourly_csv_v1(body: bytes) -> list[dict[str, str]]:
    text = body.decode("utf-8-sig")
    lines = text.splitlines()
    required = ["datetime_utc", "solrad_avg", "wind_speed", "ah", "airtmp_107_avg", "rain_mm"]
    for index, line in enumerate(lines[:80]):
        for delimiter in (",", "\t", ";", "|"):
            cells = next(csv.reader([line], delimiter=delimiter))
            headers = [normalize_key_v1(cell) for cell in cells]
            if all(name in headers for name in required):
                rows: list[dict[str, str]] = []
                for values in csv.reader(lines[index + 1 :], delimiter=delimiter):
                    if len(values) < len(headers):
                        continue
                    rows.append({header: values[position] for position, header in enumerate(headers)})
                return rows
    raise RuntimeError("MCFT_CAP09_KBS_RAW_HOURLY_HEADER_NOT_FOUND")


def compute_asce_short_hourly_et0_v1(
    *,
    air_temperature_c: float,
    actual_vapor_pressure_kpa: float,
    solar_radiation_mj_m2_h: float,
    wind_speed_2m: float,
    interval_end: datetime,
    station_elevation_m: float,
    station_latitude: float,
    station_longitude: float,
) -> float:
    require_v1(interval_end.tzinfo is not None, "MCFT_CAP09_KBS_ET0_INTERVAL_END_TZ_REQUIRED")
    normalized_end = interval_end.astimezone(timezone.utc)
    start = normalized_end - timedelta(hours=1)
    hourly = refet.Hourly(
        tmean=air_temperature_c,
        ea=actual_vapor_pressure_kpa,
        rs=solar_radiation_mj_m2_h,
        uz=wind_speed_2m,
        zw=2,
        elev=station_elevation_m,
        lat=station_latitude,
        lon=station_longitude,
        doy=start.timetuple().tm_yday,
        time=start.hour,
        method="asce",
    )
    raw = hourly.eto()
    values = np.asarray(raw, dtype=float).reshape(-1)
    require_v1(values.size == 1 and math.isfinite(float(values[0])), "MCFT_CAP09_KBS_REFET_NONFINITE")
    return float(values[0])


def decode_exact_kbs_raw_hourly_interval_v1(
    *,
    body: bytes,
    target_interval_end: datetime,
    available_at: datetime,
    authority: KbsRawHourlyScientificAuthorityV1,
) -> KbsRawHourlyExactIntervalV1:
    require_v1(target_interval_end.tzinfo is not None, "MCFT_CAP09_KBS_TARGET_TZ_REQUIRED")
    require_v1(available_at.tzinfo is not None, "MCFT_CAP09_KBS_AVAILABLE_AT_TZ_REQUIRED")
    target = target_interval_end.astimezone(timezone.utc)
    available = available_at.astimezone(timezone.utc)
    require_v1(
        target.minute == 0 and target.second == 0 and target.microsecond == 0,
        "MCFT_CAP09_KBS_TARGET_CANONICAL_HOUR_REQUIRED",
    )

    parsed: list[tuple[datetime, dict[str, str]]] = []
    for row in parse_kbs_raw_hourly_csv_v1(body):
        timestamp = parse_provider_utc_v1(row.get("datetime_utc", ""))
        if timestamp is not None and timestamp <= available + timedelta(minutes=5):
            parsed.append((timestamp, row))
    require_v1(bool(parsed), "MCFT_CAP09_KBS_TIMESTAMPED_ROWS_REQUIRED")
    parsed.sort(key=lambda item: item[0])

    latest = parsed[-1][0]
    age_hours = (available - latest).total_seconds() / 3600.0
    require_v1(
        age_hours <= float(authority.raw_hourly_latest_max_age_hours),
        f"MCFT_CAP09_KBS_SOURCE_STALE:{age_hours:.6f}",
    )

    matches = [row for timestamp, row in parsed if timestamp == target]
    require_v1(len(matches) == 1, f"MCFT_CAP09_KBS_EXACT_TARGET_ROW_REQUIRED:{len(matches)}")
    row = matches[0]

    rainfall = finite_v1(row.get("rain_mm"))
    require_v1(rainfall is not None and 0 <= rainfall <= 100, "MCFT_CAP09_KBS_TARGET_RAIN_INVALID")

    air = finite_v1(row.get("airtmp_107_avg"))
    actual_vapor_pressure = finite_v1(row.get("ah"))
    solar = finite_v1(row.get("solrad_avg"))
    wind = finite_v1(row.get("wind_speed"))
    require_v1(None not in (air, actual_vapor_pressure, solar, wind), "MCFT_CAP09_KBS_TARGET_ET0_INPUT_MISSING")
    assert air is not None and actual_vapor_pressure is not None and solar is not None and wind is not None
    require_v1(
        -50 <= air <= 60
        and 0 < actual_vapor_pressure <= 10
        and 0 <= solar <= 1600
        and 0 <= wind <= 100,
        "MCFT_CAP09_KBS_TARGET_ET0_INPUT_RANGE",
    )

    et0 = compute_asce_short_hourly_et0_v1(
        air_temperature_c=air,
        actual_vapor_pressure_kpa=actual_vapor_pressure,
        solar_radiation_mj_m2_h=solar * authority.solar_w_m2_to_mj_m2_h_factor,
        wind_speed_2m=wind * authority.wind_10m_to_2m_factor,
        interval_end=target,
        station_elevation_m=authority.station_elevation_m,
        station_latitude=authority.station_latitude,
        station_longitude=authority.station_longitude,
    )
    require_v1(math.isfinite(et0), "MCFT_CAP09_KBS_TARGET_ET0_NONFINITE")

    return KbsRawHourlyExactIntervalV1(
        target_interval_end=target,
        provider_latest_timestamp=latest,
        provider_latest_age_hours=age_hours,
        rainfall_mm=rainfall,
        historical_et0_mm=et0,
        air_temperature_c=air,
        actual_vapor_pressure_kpa=actual_vapor_pressure,
        solar_radiation_w_m2=solar,
        wind_speed_10m=wind,
    )
