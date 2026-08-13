#!/usr/bin/env python3
from __future__ import annotations

import argparse
import importlib.util
import json
import math
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path.cwd()
EA4_PATH = ROOT / "scripts/runtime_acceptance/PROBE_MCFT_CAP_09_EA4_LIVE_SOURCE_EXACT_HEAD_QUALIFICATION.py"
SPEC = importlib.util.spec_from_file_location("mcft_cap09_ea4_live", EA4_PATH)
if SPEC is None or SPEC.loader is None:
    raise RuntimeError("MCFT_CAP09_KBS_LATE_EA4_MODULE_LOAD_FAILED")
ea4 = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(ea4)

RAIN_BINDING = "kbs_lter_raw_hourly_rain_mm_v1"
HIST_ET0_BINDING = "kbs_lter_asce_short_reference_et_hourly_v1"
SOURCE_MATRIX_REF = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S6-FORMAL-SOURCE-BINDING-MATRIX-V1.json"
AMENDMENT11_REF = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-11-PROVIDER-AVAILABILITY-WATERMARK-AUTHORITY.md"
HISTORICAL_FRESHNESS_HOURS = 6.0


def require(condition: bool, code: str) -> None:
    if not condition:
        raise RuntimeError(code)


def iso(value: datetime) -> str:
    return value.astimezone(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def parse_iso(value: str, code: str) -> datetime:
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as exc:
        raise RuntimeError(code) from exc
    require(parsed.tzinfo is not None, code)
    return parsed.astimezone(timezone.utc)


def select_complete_exact_row(rows: list[dict], available_at: datetime) -> tuple[datetime, datetime, dict, int]:
    by_timestamp: dict[datetime, list[dict]] = {}
    for row in rows:
        timestamp = ea4.parse_provider_utc(row.get("datetime_utc", ""))
        if timestamp is not None and timestamp <= available_at + timedelta(minutes=5):
            by_timestamp.setdefault(timestamp, []).append(row)
    require(by_timestamp, "MCFT_CAP09_KBS_LATE_TIMESTAMP_REQUIRED")
    latest = max(by_timestamp)
    skipped = 0
    for timestamp in sorted(by_timestamp, reverse=True):
        if timestamp < latest - timedelta(hours=23):
            continue
        if timestamp.minute != 0 or timestamp.second != 0 or timestamp.microsecond != 0:
            skipped += 1
            continue
        candidates = by_timestamp[timestamp]
        if len(candidates) != 1:
            skipped += 1
            continue
        row = candidates[0]
        rain = ea4.finite(row.get("rain_mm"))
        air = ea4.finite(row.get("airtmp_107_avg"))
        vapor = ea4.finite(row.get("ah"))
        solar = ea4.finite(row.get("solrad_avg"))
        wind = ea4.finite(row.get("wind_speed"))
        valid = (
            rain is not None and 0 <= rain <= 100
            and air is not None and -50 <= air <= 60
            and vapor is not None and 0 < vapor <= 10
            and solar is not None and 0 <= solar <= 1600
            and wind is not None and 0 <= wind <= 100
        )
        if valid:
            et0 = ea4.scalar_eto(air, vapor, solar * ea4.SOLAR_FACTOR, wind * ea4.WIND_FACTOR, timestamp)
            valid = math.isfinite(et0)
        if valid:
            return latest, timestamp, row, skipped
        skipped += 1
    raise RuntimeError("MCFT_CAP09_KBS_LATE_NO_COMPLETE_UNIQUE_EXACT_ROW")


def decode(input_path: Path, output_path: Path, meta_path: Path, available_at: datetime) -> None:
    rows = ea4.parse_kbs_csv(input_path.read_bytes())
    latest, target, row, skipped = select_complete_exact_row(rows, available_at)
    latest_age_hours = (available_at - latest).total_seconds() / 3600.0
    freshness_le_6h = latest_age_hours <= HISTORICAL_FRESHNESS_HOURS

    rain = ea4.finite(row.get("rain_mm"))
    air = ea4.finite(row.get("airtmp_107_avg"))
    vapor = ea4.finite(row.get("ah"))
    solar = ea4.finite(row.get("solrad_avg"))
    wind = ea4.finite(row.get("wind_speed"))
    require(rain is not None and air is not None and vapor is not None and solar is not None and wind is not None, "MCFT_CAP09_KBS_LATE_COMPLETE_ROW_DRIFT")
    et0 = ea4.scalar_eto(air, vapor, solar * ea4.SOLAR_FACTOR, wind * ea4.WIND_FACTOR, target)
    require(math.isfinite(et0), "MCFT_CAP09_KBS_LATE_ET0_NONFINITE")

    decoded_at = datetime.now(timezone.utc)
    require(available_at <= decoded_at + timedelta(seconds=1), "MCFT_CAP09_KBS_LATE_DECODE_BEFORE_AVAILABILITY")
    interval_start = target - timedelta(hours=1)
    key = target.strftime("%Y%m%dT%H%M%SZ").lower()
    diagnostic = {
        "provider_latest_age_hours": round(latest_age_hours, 6),
        "historical_online_freshness_diagnostic_le_6h": freshness_le_6h,
        "freshness_diagnostic_only": True,
        "freshness_is_late_authoritative_admission_gate": False,
        "provider_publication_cadence": "DAILY_BATCH",
    }

    drafts = [
        {
            "role": "RAINFALL_OBSERVATION",
            "source_record_id": f"kbs_raw_hourly_rain_{key}",
            "binding_id": RAIN_BINDING,
            "origin_source_kind": "KBS_LTER_RAW_HOURLY_WEATHER",
            "origin_source_id": "KBS002-007.142:rain_mm",
            "epistemic_class": "OBSERVED",
            "available_to_runtime_at": iso(available_at),
            "role_time": {
                "interval_start": iso(interval_start),
                "interval_end": iso(target),
                "ingested_at": iso(decoded_at),
            },
            "quality": {"status": "PASS", **diagnostic},
            "source_payload": {
                "provider_table_id": "KBS002-007.142",
                "source_column": "rain_mm",
                "spatial_support": "NEAR_SITE_METEOROLOGICAL_SUPPORT",
                "late_authority_ref": AMENDMENT11_REF,
            },
            "canonical_payload": {"value": rain, "unit": "mm"},
            "source_unit": "mm",
            "canonical_unit": "mm",
            "conversion_rule": {
                "conversion_rule_id": "KBS_RAW_HOURLY_RAIN_MM_IDENTITY_V1",
                "conversion_rule_version": "1",
                "authority_ref": SOURCE_MATRIX_REF,
            },
            "source_binding_version": 1,
            "limitations": ["NEAR_SITE_METEOROLOGICAL_SUPPORT", "FIELD_POINT_PRECIPITATION_TRUTH_NOT_CLAIMED", "AUTHORITATIVE_LATE_NOT_ONLINE_AVAILABILITY_CLAIM"],
        },
        {
            "role": "HISTORICAL_ET0_INPUT",
            "source_record_id": f"kbs_asce_short_reference_et0_{key}",
            "binding_id": HIST_ET0_BINDING,
            "origin_source_kind": "KBS_LTER_RAW_HOURLY_DERIVED",
            "origin_source_id": "KBS002-007.142:ASCE_SHORT_REFERENCE_ET0",
            "epistemic_class": "ESTIMATED",
            "available_to_runtime_at": iso(available_at),
            "role_time": {
                "interval_start": iso(interval_start),
                "interval_end": iso(target),
                "ingested_at": iso(decoded_at),
                "calculation_method": "ASCE_STANDARDIZED_REFERENCE_ET_SHORT_HOURLY_V1",
                "method_version": "refet-0.4.2",
            },
            "quality": {"status": "PASS", **diagnostic, "negative_clipping_performed": False},
            "source_payload": {
                "provider_table_id": "KBS002-007.142",
                "input_columns": ["airtmp_107_avg", "ah", "solrad_avg", "wind_speed"],
                "wind_10m_to_2m_factor": ea4.WIND_FACTOR,
                "solar_w_m2_to_mj_m2_h_factor": ea4.SOLAR_FACTOR,
                "station_elevation_m": float(ea4.AUTH["kbs"]["elevation_m"]),
                "late_authority_ref": AMENDMENT11_REF,
            },
            "canonical_payload": {
                "value": et0,
                "unit": "mm",
                "rate_unit": "mm_per_hour",
                "calculation_method": "ASCE_STANDARDIZED_REFERENCE_ET_SHORT_HOURLY_V1",
                "method_version": "refet-0.4.2",
            },
            "source_unit": "KBS_HOURLY_METEOROLOGICAL_INPUTS",
            "canonical_unit": "mm",
            "conversion_rule": {
                "conversion_rule_id": "ASCE_STANDARDIZED_REFERENCE_ET_SHORT_HOURLY_V1",
                "conversion_rule_version": "refet-0.4.2",
                "authority_ref": SOURCE_MATRIX_REF,
            },
            "source_binding_version": 1,
            "limitations": ["REFERENCE_ET_ESTIMATE_NOT_FIELD_ET", "NO_SILENT_IMPUTATION", "NO_NEGATIVE_CLIPPING", "AUTHORITATIVE_LATE_NOT_ONLINE_AVAILABILITY_CLAIM"],
        },
    ]
    output_path.write_text(json.dumps({"drafts": drafts}, separators=(",", ":")) + "\n", encoding="utf-8")
    meta_path.write_text(json.dumps({
        "schema_version": "geox_mcft_cap09_kbs_authoritative_late_decoder_v1",
        "status": "PASS",
        "provider_latest_timestamp": iso(latest),
        "provider_latest_age_hours": round(latest_age_hours, 6),
        "historical_online_freshness_diagnostic_le_6h": freshness_le_6h,
        "freshness_is_late_authoritative_admission_gate": False,
        "provider_publication_cadence": "DAILY_BATCH",
        "selected_target_t": iso(target),
        "selected_interval_start": iso(interval_start),
        "selected_interval_end": iso(target),
        "skipped_newer_incomplete_or_duplicate_row_count": skipped,
        "draft_count": 2,
        "raw_values_emitted": False,
    }, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def selftest() -> None:
    observed = datetime(2026, 8, 13, 20, 0, tzinfo=timezone.utc)
    def row(hour: int, rain: str = "0.2") -> dict:
        return {
            "datetime_utc": f"2026-08-13 {hour:02d}:00:00",
            "rain_mm": rain,
            "airtmp_107_avg": "24.0",
            "ah": "1.8",
            "solrad_avg": "150.0",
            "wind_speed": "2.5",
        }
    latest, selected, _, skipped = select_complete_exact_row([row(4, ""), row(3)], observed)
    require(latest.hour == 4 and selected.hour == 3 and skipped == 1, "MCFT_CAP09_KBS_LATE_SELFTEST_SELECTION")
    require((observed - latest).total_seconds() / 3600.0 > HISTORICAL_FRESHNESS_HOURS, "MCFT_CAP09_KBS_LATE_SELFTEST_STALE_CASE_REQUIRED")
    print(json.dumps({
        "status": "PASS",
        "stale_daily_batch_remains_selectable": True,
        "historical_freshness_is_diagnostic_only": True,
        "provider_request_count": 0,
        "database_write_count": 0,
    }, sort_keys=True))


def main() -> None:
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest="command", required=True)
    decode_parser = sub.add_parser("decode")
    decode_parser.add_argument("--available-at", required=True)
    decode_parser.add_argument("--input", required=True)
    decode_parser.add_argument("--output", required=True)
    decode_parser.add_argument("--meta", required=True)
    sub.add_parser("selftest")
    args = parser.parse_args()
    if args.command == "selftest":
        selftest()
        return
    decode(Path(args.input), Path(args.output), Path(args.meta), parse_iso(args.available_at, "MCFT_CAP09_KBS_LATE_AVAILABLE_AT_INVALID"))


if __name__ == "__main__":
    main()
