#!/usr/bin/env python3
from __future__ import annotations

import argparse
import csv
import json
import math
import re
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path

import numpy as np
import refet


@dataclass(frozen=True)
class KbsRawHourlyScientificAuthorityV1:
    historical_online_freshness_diagnostic_hours: float
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
    historical_online_freshness_diagnostic_le_threshold: bool
    freshness_is_late_authoritative_admission_gate: bool
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


def parse_iso_v1(value: str, code: str) -> datetime:
    try:
        parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError as exc:
        raise RuntimeError(code) from exc
    require_v1(parsed.tzinfo is not None, code)
    return parsed.astimezone(timezone.utc)


def iso_v1(value: datetime) -> str:
    return value.astimezone(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


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
    freshness_diagnostic = age_hours <= float(authority.historical_online_freshness_diagnostic_hours)

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
        historical_online_freshness_diagnostic_le_threshold=freshness_diagnostic,
        freshness_is_late_authoritative_admission_gate=False,
        rainfall_mm=rainfall,
        historical_et0_mm=et0,
        air_temperature_c=air,
        actual_vapor_pressure_kpa=actual_vapor_pressure,
        solar_radiation_w_m2=solar,
        wind_speed_10m=wind,
    )


def exact_interval_json_v1(value: KbsRawHourlyExactIntervalV1) -> dict:
    return {
        "schema_version": "geox_mcft_cap09_kbs_raw_hourly_exact_interval_scientific_result_v1",
        "target_interval_end": iso_v1(value.target_interval_end),
        "provider_latest_timestamp": iso_v1(value.provider_latest_timestamp),
        "provider_latest_age_hours": value.provider_latest_age_hours,
        "historical_online_freshness_diagnostic_le_threshold": value.historical_online_freshness_diagnostic_le_threshold,
        "freshness_is_late_authoritative_admission_gate": value.freshness_is_late_authoritative_admission_gate,
        "rainfall_mm": value.rainfall_mm,
        "historical_et0_mm": value.historical_et0_mm,
        "air_temperature_c": value.air_temperature_c,
        "actual_vapor_pressure_kpa": value.actual_vapor_pressure_kpa,
        "solar_radiation_w_m2": value.solar_radiation_w_m2,
        "wind_speed_10m": value.wind_speed_10m,
    }


def decode_cli_v1(args: argparse.Namespace) -> None:
    authority = KbsRawHourlyScientificAuthorityV1(
        historical_online_freshness_diagnostic_hours=float(args.historical_online_freshness_diagnostic_hours),
        station_elevation_m=float(args.station_elevation_m),
        station_latitude=float(args.station_latitude),
        station_longitude=float(args.station_longitude),
        wind_10m_to_2m_factor=float(args.wind_10m_to_2m_factor),
    )
    decoded = decode_exact_kbs_raw_hourly_interval_v1(
        body=Path(args.input).read_bytes(),
        target_interval_end=parse_iso_v1(args.target, "MCFT_CAP09_KBS_CLI_TARGET_INVALID"),
        available_at=parse_iso_v1(args.available_at, "MCFT_CAP09_KBS_CLI_AVAILABLE_AT_INVALID"),
        authority=authority,
    )
    payload = exact_interval_json_v1(decoded)
    Path(args.output).write_text(json.dumps(payload, sort_keys=True, separators=(",", ":")) + "\n", encoding="utf-8")
    print(json.dumps({
        "status": "PASS",
        "schema_version": payload["schema_version"],
        "target_interval_end": payload["target_interval_end"],
        "provider_latest_timestamp": payload["provider_latest_timestamp"],
        "historical_online_freshness_diagnostic_le_threshold": payload["historical_online_freshness_diagnostic_le_threshold"],
        "freshness_is_late_authoritative_admission_gate": False,
        "raw_values_emitted": False,
        "provider_request_count": 0,
        "database_write_count": 0,
    }, sort_keys=True))


def selftest_v1() -> None:
    authority = KbsRawHourlyScientificAuthorityV1(
        historical_online_freshness_diagnostic_hours=6.0,
        station_elevation_m=286.43,
        station_latitude=42.408537,
        station_longitude=-85.373637,
        wind_10m_to_2m_factor=0.747951075,
    )
    header = "datetime_utc,solrad_avg,wind_speed,ah,airtmp_107_avg,rain_mm\n"
    rows = [
        "2026-08-13 02:00:00,120.0,2.0,1.7,23.0,0.1",
        "2026-08-13 03:00:00,150.0,2.5,1.8,24.0,0.2",
        "2026-08-13 04:00:00,180.0,3.0,1.9,25.0,0.3",
    ]
    body = (header + "\n".join(rows) + "\n").encode("utf-8")
    available = datetime(2026, 8, 13, 20, 0, tzinfo=timezone.utc)
    target = datetime(2026, 8, 13, 3, 0, tzinfo=timezone.utc)

    decoded = decode_exact_kbs_raw_hourly_interval_v1(
        body=body,
        target_interval_end=target,
        available_at=available,
        authority=authority,
    )
    require_v1(decoded.target_interval_end == target, "MCFT_CAP09_KBS_PRODUCT_CORE_SELFTEST_TARGET")
    require_v1(decoded.provider_latest_timestamp.hour == 4, "MCFT_CAP09_KBS_PRODUCT_CORE_SELFTEST_LATEST")
    require_v1(decoded.provider_latest_age_hours > 6.0, "MCFT_CAP09_KBS_PRODUCT_CORE_SELFTEST_STALE_CASE_REQUIRED")
    require_v1(
        decoded.historical_online_freshness_diagnostic_le_threshold is False,
        "MCFT_CAP09_KBS_PRODUCT_CORE_SELFTEST_FRESHNESS_DIAGNOSTIC",
    )
    require_v1(
        decoded.freshness_is_late_authoritative_admission_gate is False,
        "MCFT_CAP09_KBS_PRODUCT_CORE_SELFTEST_FRESHNESS_NOT_ADMISSION",
    )
    require_v1(decoded.rainfall_mm == 0.2, "MCFT_CAP09_KBS_PRODUCT_CORE_SELFTEST_RAIN")
    require_v1(math.isfinite(decoded.historical_et0_mm), "MCFT_CAP09_KBS_PRODUCT_CORE_SELFTEST_ET0")

    try:
        decode_exact_kbs_raw_hourly_interval_v1(
            body=body,
            target_interval_end=datetime(2026, 8, 13, 1, 0, tzinfo=timezone.utc),
            available_at=available,
            authority=authority,
        )
        raise RuntimeError("MCFT_CAP09_KBS_PRODUCT_CORE_SELFTEST_MISSING_TARGET_NOT_REJECTED")
    except RuntimeError as exc:
        require_v1(
            str(exc) == "MCFT_CAP09_KBS_EXACT_TARGET_ROW_REQUIRED:0",
            "MCFT_CAP09_KBS_PRODUCT_CORE_SELFTEST_MISSING_TARGET_CODE",
        )

    duplicate_body = (header + "\n".join(rows + [rows[1]]) + "\n").encode("utf-8")
    try:
        decode_exact_kbs_raw_hourly_interval_v1(
            body=duplicate_body,
            target_interval_end=target,
            available_at=available,
            authority=authority,
        )
        raise RuntimeError("MCFT_CAP09_KBS_PRODUCT_CORE_SELFTEST_DUPLICATE_TARGET_NOT_REJECTED")
    except RuntimeError as exc:
        require_v1(
            str(exc) == "MCFT_CAP09_KBS_EXACT_TARGET_ROW_REQUIRED:2",
            "MCFT_CAP09_KBS_PRODUCT_CORE_SELFTEST_DUPLICATE_TARGET_CODE",
        )

    print(json.dumps({
        "schema_version": "geox_mcft_cap09_kbs_raw_hourly_scientific_core_selftest_v1",
        "status": "PASS",
        "provider_latest_age_hours": round(decoded.provider_latest_age_hours, 6),
        "historical_online_freshness_diagnostic_le_6h": decoded.historical_online_freshness_diagnostic_le_threshold,
        "freshness_is_late_authoritative_admission_gate": decoded.freshness_is_late_authoritative_admission_gate,
        "stale_daily_batch_exact_t_remains_decodable": True,
        "missing_exact_t_fails_closed": True,
        "duplicate_exact_t_fails_closed": True,
        "provider_request_count": 0,
        "database_write_count": 0,
        "runtime_tick_mutation_count": 0,
    }, sort_keys=True))


def main_v1() -> None:
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("selftest")
    decode = sub.add_parser("decode-exact")
    decode.add_argument("--target", required=True)
    decode.add_argument("--available-at", required=True)
    decode.add_argument("--input", required=True)
    decode.add_argument("--output", required=True)
    decode.add_argument("--historical-online-freshness-diagnostic-hours", required=True, type=float)
    decode.add_argument("--station-elevation-m", required=True, type=float)
    decode.add_argument("--station-latitude", required=True, type=float)
    decode.add_argument("--station-longitude", required=True, type=float)
    decode.add_argument("--wind-10m-to-2m-factor", required=True, type=float)
    args = parser.parse_args()
    if args.command == "selftest":
        selftest_v1()
    elif args.command == "decode-exact":
        decode_cli_v1(args)


if __name__ == "__main__":
    main_v1()
