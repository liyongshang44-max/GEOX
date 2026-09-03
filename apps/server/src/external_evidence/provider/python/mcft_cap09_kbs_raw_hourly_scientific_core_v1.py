#!/usr/bin/env python3
from __future__ import annotations

import argparse
import csv
import hashlib
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



def sha256_json_v1(value) -> str:
    encoded = json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=True).encode("utf-8")
    return "sha256:" + hashlib.sha256(encoded).hexdigest()


def publication_event_groups_v1(*, body: bytes, available_at: datetime) -> tuple[int, int, dict[str, list[str]]]:
    require_v1(available_at.tzinfo is not None, "MCFT_CAP09_KBS_PUBLICATION_AVAILABLE_AT_TZ_REQUIRED")
    available = available_at.astimezone(timezone.utc)
    rows = parse_kbs_raw_hourly_csv_v1(body)
    grouped: dict[str, list[str]] = {}
    valid_row_count = 0
    for row in rows:
        timestamp = parse_provider_utc_v1(row.get("datetime_utc", ""))
        if timestamp is None or timestamp > available + timedelta(minutes=5):
            continue
        valid_row_count += 1
        event_time = iso_v1(timestamp.replace(microsecond=0))
        row_hash = sha256_json_v1({key: row.get(key, "") for key in sorted(row)})
        grouped.setdefault(event_time, []).append(row_hash)
    require_v1(bool(grouped), "MCFT_CAP09_KBS_PUBLICATION_EVENT_INDEX_REQUIRED")
    return len(rows), valid_row_count, grouped


def publication_event_summary_v1(event_time: str, row_hashes: list[str]) -> dict:
    variants = sorted(set(row_hashes))
    return {
        "event_time": event_time,
        "row_count": len(row_hashes),
        "row_variant_count": len(variants),
        "row_identity_hash": sha256_json_v1(variants),
    }


def build_kbs_raw_hourly_publication_snapshot_inventory_v1(*, body: bytes, available_at: datetime) -> dict:
    parsed_row_count, valid_row_count, grouped = publication_event_groups_v1(
        body=body,
        available_at=available_at,
    )
    event_times = sorted(grouped)
    latest = parse_iso_v1(event_times[-1], "MCFT_CAP09_KBS_PUBLICATION_LATEST_INVALID")
    require_v1(
        latest.minute == 0 and latest.second == 0 and latest.microsecond == 0,
        "MCFT_CAP09_KBS_PUBLICATION_LATEST_CANONICAL_HOUR_REQUIRED",
    )
    digest = hashlib.sha256()
    for event_time in event_times:
        summary = publication_event_summary_v1(event_time, grouped[event_time])
        digest.update(
            (event_time + "\0" + summary["row_identity_hash"] + "\0" + str(summary["row_count"]) + "\n").encode("utf-8")
        )
    latest_summary = publication_event_summary_v1(event_times[-1], grouped[event_times[-1]])
    return {
        "schema_version": "geox_mcft_cap09_kbs_raw_hourly_publication_snapshot_inventory_v1",
        "endpoint_shape": "COMPLETE_ACCUMULATED_TABLE",
        "parsed_row_count": parsed_row_count,
        "valid_row_count": valid_row_count,
        "unique_event_time_count": len(event_times),
        "latest_event_time": event_times[-1],
        "latest_event_row_count": latest_summary["row_count"],
        "latest_event_row_variant_count": latest_summary["row_variant_count"],
        "latest_event_row_identity_hash": latest_summary["row_identity_hash"],
        "event_index_sha256": "sha256:" + digest.hexdigest(),
        "raw_values_emitted": False,
    }


def diff_kbs_raw_hourly_publication_forward_v1(
    *,
    body: bytes,
    available_at: datetime,
    after_event_time: datetime,
) -> dict:
    require_v1(after_event_time.tzinfo is not None, "MCFT_CAP09_KBS_PUBLICATION_AFTER_TZ_REQUIRED")
    after = after_event_time.astimezone(timezone.utc)
    require_v1(
        after.minute == 0 and after.second == 0 and after.microsecond == 0,
        "MCFT_CAP09_KBS_PUBLICATION_AFTER_CANONICAL_HOUR_REQUIRED",
    )
    inventory = build_kbs_raw_hourly_publication_snapshot_inventory_v1(
        body=body,
        available_at=available_at,
    )
    current_latest = parse_iso_v1(inventory["latest_event_time"], "MCFT_CAP09_KBS_PUBLICATION_CURRENT_LATEST_INVALID")
    require_v1(current_latest >= after, "MCFT_CAP09_KBS_PUBLICATION_LATEST_REGRESSION")

    _, _, grouped = publication_event_groups_v1(body=body, available_at=available_at)
    forward: list[dict] = []
    for event_time in sorted(grouped):
        parsed = parse_iso_v1(event_time, "MCFT_CAP09_KBS_PUBLICATION_FORWARD_EVENT_INVALID")
        if parsed <= after:
            continue
        require_v1(
            parsed.minute == 0 and parsed.second == 0 and parsed.microsecond == 0,
            "MCFT_CAP09_KBS_PUBLICATION_FORWARD_EVENT_CANONICAL_HOUR_REQUIRED",
        )
        forward.append(publication_event_summary_v1(event_time, grouped[event_time]))

    ambiguous = [item["event_time"] for item in forward if int(item["row_count"]) != 1]
    status = "NO_CHANGE" if not forward else ("AMBIGUOUS_FORWARD" if ambiguous else "FORWARD_DELTA")
    return {
        "schema_version": "geox_mcft_cap09_kbs_raw_hourly_publication_forward_delta_v1",
        "status": status,
        "baseline_latest_event_time": iso_v1(after),
        "current_latest_event_time": inventory["latest_event_time"],
        "forward_event_count": len(forward),
        "forward_event_times": [item["event_time"] for item in forward],
        "forward_event_rows": forward,
        "ambiguous_forward_event_times": ambiguous,
        "revision_or_backfill_auto_promotion_authorized": False,
        "raw_values_emitted": False,
    }



def compare_kbs_raw_hourly_publication_snapshots_v1(
    *,
    previous_body: bytes,
    previous_available_at: datetime,
    current_body: bytes,
    current_available_at: datetime,
    baseline_latest_event_time: datetime,
) -> dict:
    require_v1(
        baseline_latest_event_time.tzinfo is not None,
        "MCFT_CAP09_KBS_PUBLICATION_COMPARE_BASELINE_TZ_REQUIRED",
    )
    baseline = baseline_latest_event_time.astimezone(timezone.utc)
    require_v1(
        baseline.minute == 0 and baseline.second == 0 and baseline.microsecond == 0,
        "MCFT_CAP09_KBS_PUBLICATION_COMPARE_BASELINE_CANONICAL_HOUR_REQUIRED",
    )

    previous_inventory = build_kbs_raw_hourly_publication_snapshot_inventory_v1(
        body=previous_body,
        available_at=previous_available_at,
    )
    current_inventory = build_kbs_raw_hourly_publication_snapshot_inventory_v1(
        body=current_body,
        available_at=current_available_at,
    )
    previous_latest = parse_iso_v1(
        previous_inventory["latest_event_time"],
        "MCFT_CAP09_KBS_PUBLICATION_COMPARE_PREVIOUS_LATEST_INVALID",
    )
    current_latest = parse_iso_v1(
        current_inventory["latest_event_time"],
        "MCFT_CAP09_KBS_PUBLICATION_COMPARE_CURRENT_LATEST_INVALID",
    )
    require_v1(
        previous_latest == baseline,
        "MCFT_CAP09_KBS_PUBLICATION_COMPARE_BASELINE_POINTER_SNAPSHOT_MISMATCH",
    )
    require_v1(
        current_latest >= baseline,
        "MCFT_CAP09_KBS_PUBLICATION_COMPARE_CURRENT_LATEST_REGRESSION",
    )

    _, _, previous_grouped = publication_event_groups_v1(
        body=previous_body,
        available_at=previous_available_at,
    )
    _, _, current_grouped = publication_event_groups_v1(
        body=current_body,
        available_at=current_available_at,
    )

    historical_times = sorted({
        event_time
        for event_time in set(previous_grouped) | set(current_grouped)
        if parse_iso_v1(
            event_time,
            "MCFT_CAP09_KBS_PUBLICATION_COMPARE_HISTORICAL_EVENT_INVALID",
        ) <= baseline
    })
    historical_drift: list[dict] = []
    for event_time in historical_times:
        previous_hashes = previous_grouped.get(event_time)
        current_hashes = current_grouped.get(event_time)
        if previous_hashes is None:
            kind = "ADDED_BEFORE_OR_AT_BASELINE"
        elif current_hashes is None:
            kind = "REMOVED_BEFORE_OR_AT_BASELINE"
        else:
            previous_summary = publication_event_summary_v1(event_time, previous_hashes)
            current_summary = publication_event_summary_v1(event_time, current_hashes)
            if (
                previous_summary["row_count"] == current_summary["row_count"]
                and previous_summary["row_variant_count"] == current_summary["row_variant_count"]
                and previous_summary["row_identity_hash"] == current_summary["row_identity_hash"]
            ):
                continue
            kind = "CHANGED_BEFORE_OR_AT_BASELINE"
        historical_drift.append({"event_time": event_time, "kind": kind})

    forward: list[dict] = []
    for event_time in sorted(current_grouped):
        parsed = parse_iso_v1(
            event_time,
            "MCFT_CAP09_KBS_PUBLICATION_COMPARE_FORWARD_EVENT_INVALID",
        )
        if parsed <= baseline:
            continue
        require_v1(
            parsed.minute == 0 and parsed.second == 0 and parsed.microsecond == 0,
            "MCFT_CAP09_KBS_PUBLICATION_COMPARE_FORWARD_CANONICAL_HOUR_REQUIRED",
        )
        forward.append(publication_event_summary_v1(event_time, current_grouped[event_time]))

    ambiguous_forward = [
        item["event_time"]
        for item in forward
        if int(item["row_count"]) != 1 or int(item["row_variant_count"]) != 1
    ]
    if historical_drift:
        status = "HISTORICAL_DRIFT"
    elif ambiguous_forward:
        status = "AMBIGUOUS_FORWARD"
    elif forward:
        status = "FORWARD_DELTA"
    else:
        status = "NO_CHANGE"

    return {
        "schema_version": "geox_mcft_cap09_kbs_raw_hourly_publication_snapshot_comparison_v1",
        "status": status,
        "baseline_latest_event_time": iso_v1(baseline),
        "previous_latest_event_time": previous_inventory["latest_event_time"],
        "current_latest_event_time": current_inventory["latest_event_time"],
        "historical_prefix_exact_match": len(historical_drift) == 0,
        "historical_drift_count": len(historical_drift),
        "historical_drift": historical_drift,
        "forward_event_count": len(forward),
        "forward_event_times": [item["event_time"] for item in forward],
        "forward_event_rows": forward,
        "ambiguous_forward_event_times": ambiguous_forward,
        "historical_revision_or_backfill_auto_promotion_authorized": False,
        "raw_values_emitted": False,
    }


def publication_snapshot_comparison_cli_v1(args: argparse.Namespace) -> None:
    payload = compare_kbs_raw_hourly_publication_snapshots_v1(
        previous_body=Path(args.previous_input).read_bytes(),
        previous_available_at=parse_iso_v1(
            args.previous_available_at,
            "MCFT_CAP09_KBS_PUBLICATION_COMPARE_CLI_PREVIOUS_AVAILABLE_INVALID",
        ),
        current_body=Path(args.current_input).read_bytes(),
        current_available_at=parse_iso_v1(
            args.current_available_at,
            "MCFT_CAP09_KBS_PUBLICATION_COMPARE_CLI_CURRENT_AVAILABLE_INVALID",
        ),
        baseline_latest_event_time=parse_iso_v1(
            args.baseline_latest_event_time,
            "MCFT_CAP09_KBS_PUBLICATION_COMPARE_CLI_BASELINE_INVALID",
        ),
    )
    Path(args.output).write_text(
        json.dumps(payload, sort_keys=True, separators=(",", ":")) + "\n",
        encoding="utf-8",
    )
    print(json.dumps({
        "status": "PASS",
        "comparison_status": payload["status"],
        "schema_version": payload["schema_version"],
        "raw_values_emitted": False,
        "provider_request_count": 0,
        "database_write_count": 0,
    }, sort_keys=True))


def publication_inventory_cli_v1(args: argparse.Namespace) -> None:
    available = parse_iso_v1(args.available_at, "MCFT_CAP09_KBS_PUBLICATION_CLI_AVAILABLE_AT_INVALID")
    if args.command == "inspect-snapshot":
        payload = build_kbs_raw_hourly_publication_snapshot_inventory_v1(
            body=Path(args.input).read_bytes(),
            available_at=available,
        )
    elif args.command == "diff-forward":
        payload = diff_kbs_raw_hourly_publication_forward_v1(
            body=Path(args.input).read_bytes(),
            available_at=available,
            after_event_time=parse_iso_v1(args.after, "MCFT_CAP09_KBS_PUBLICATION_CLI_AFTER_INVALID"),
        )
    else:
        raise RuntimeError("MCFT_CAP09_KBS_PUBLICATION_CLI_COMMAND_INVALID")
    Path(args.output).write_text(
        json.dumps(payload, sort_keys=True, separators=(",", ":")) + "\n",
        encoding="utf-8",
    )
    print(json.dumps({
        "status": "PASS",
        "schema_version": payload["schema_version"],
        "raw_values_emitted": False,
        "provider_request_count": 0,
        "database_write_count": 0,
    }, sort_keys=True))


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

    snapshot = build_kbs_raw_hourly_publication_snapshot_inventory_v1(body=body, available_at=available)
    require_v1(snapshot["endpoint_shape"] == "COMPLETE_ACCUMULATED_TABLE", "MCFT_CAP09_KBS_PUBLICATION_SELFTEST_ENDPOINT_SHAPE")
    require_v1(snapshot["latest_event_time"] == "2026-08-13T04:00:00.000Z", "MCFT_CAP09_KBS_PUBLICATION_SELFTEST_LATEST")
    require_v1(snapshot["latest_event_row_count"] == 1, "MCFT_CAP09_KBS_PUBLICATION_SELFTEST_LATEST_ROW_COUNT")
    no_change = diff_kbs_raw_hourly_publication_forward_v1(
        body=body,
        available_at=available,
        after_event_time=datetime(2026, 8, 13, 4, 0, tzinfo=timezone.utc),
    )
    require_v1(no_change["status"] == "NO_CHANGE", "MCFT_CAP09_KBS_PUBLICATION_SELFTEST_NO_CHANGE")
    next_rows = rows + [
        "2026-08-13 05:00:00,190.0,3.1,2.0,25.5,0.4",
        "2026-08-13 06:00:00,200.0,3.2,2.1,26.0,0.5",
    ]
    next_body = (header + "\n".join(next_rows) + "\n").encode("utf-8")
    forward = diff_kbs_raw_hourly_publication_forward_v1(
        body=next_body,
        available_at=available,
        after_event_time=datetime(2026, 8, 13, 4, 0, tzinfo=timezone.utc),
    )
    require_v1(forward["status"] == "FORWARD_DELTA", "MCFT_CAP09_KBS_PUBLICATION_SELFTEST_FORWARD_STATUS")
    require_v1(forward["forward_event_times"] == [
        "2026-08-13T05:00:00.000Z",
        "2026-08-13T06:00:00.000Z",
    ], "MCFT_CAP09_KBS_PUBLICATION_SELFTEST_FORWARD_EVENTS")

    compare_no_change = compare_kbs_raw_hourly_publication_snapshots_v1(
        previous_body=body,
        previous_available_at=available,
        current_body=body,
        current_available_at=available,
        baseline_latest_event_time=datetime(2026, 8, 13, 4, 0, tzinfo=timezone.utc),
    )
    require_v1(compare_no_change["status"] == "NO_CHANGE", "MCFT_CAP09_KBS_COMPARE_SELFTEST_NO_CHANGE")
    compare_forward = compare_kbs_raw_hourly_publication_snapshots_v1(
        previous_body=body,
        previous_available_at=available,
        current_body=next_body,
        current_available_at=available,
        baseline_latest_event_time=datetime(2026, 8, 13, 4, 0, tzinfo=timezone.utc),
    )
    require_v1(compare_forward["status"] == "FORWARD_DELTA", "MCFT_CAP09_KBS_COMPARE_SELFTEST_FORWARD")
    revised_rows = [
        rows[0],
        "2026-08-13 03:00:00,151.0,2.5,1.8,24.0,0.2",
        rows[2],
        "2026-08-13 05:00:00,190.0,3.1,2.0,25.5,0.4",
    ]
    revised_body = (header + "\n".join(revised_rows) + "\n").encode("utf-8")
    compare_drift = compare_kbs_raw_hourly_publication_snapshots_v1(
        previous_body=body,
        previous_available_at=available,
        current_body=revised_body,
        current_available_at=available,
        baseline_latest_event_time=datetime(2026, 8, 13, 4, 0, tzinfo=timezone.utc),
    )
    require_v1(compare_drift["status"] == "HISTORICAL_DRIFT", "MCFT_CAP09_KBS_COMPARE_SELFTEST_DRIFT")
    require_v1(
        compare_drift["historical_drift"][0]["event_time"] == "2026-08-13T03:00:00.000Z",
        "MCFT_CAP09_KBS_COMPARE_SELFTEST_DRIFT_EVENT",
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
        "complete_table_snapshot_inventory": True,
        "forward_delta_discovery": True,
        "no_change_discovery": True,
        "historical_prefix_snapshot_comparison": True,
        "historical_revision_backfill_fail_closed": True,
        "provider_request_count": 0,
        "database_write_count": 0,
        "runtime_tick_mutation_count": 0,
    }, sort_keys=True))


def main_v1() -> None:
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("selftest")
    inspect = sub.add_parser("inspect-snapshot")
    inspect.add_argument("--available-at", required=True)
    inspect.add_argument("--input", required=True)
    inspect.add_argument("--output", required=True)
    diff = sub.add_parser("diff-forward")
    diff.add_argument("--after", required=True)
    diff.add_argument("--available-at", required=True)
    diff.add_argument("--input", required=True)
    diff.add_argument("--output", required=True)
    compare = sub.add_parser("compare-snapshots")
    compare.add_argument("--previous-input", required=True)
    compare.add_argument("--previous-available-at", required=True)
    compare.add_argument("--current-input", required=True)
    compare.add_argument("--current-available-at", required=True)
    compare.add_argument("--baseline-latest-event-time", required=True)
    compare.add_argument("--output", required=True)
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
    elif args.command in ("inspect-snapshot", "diff-forward"):
        publication_inventory_cli_v1(args)
    elif args.command == "compare-snapshots":
        publication_snapshot_comparison_cli_v1(args)


if __name__ == "__main__":
    main_v1()
