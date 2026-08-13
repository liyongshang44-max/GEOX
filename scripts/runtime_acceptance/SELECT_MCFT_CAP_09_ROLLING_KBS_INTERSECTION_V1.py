#!/usr/bin/env python3
from __future__ import annotations

import argparse
import importlib.util
import json
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

ROOT = Path.cwd()
DECODER_PATH = ROOT / "scripts/runtime_acceptance/MCFT_CAP_09_KBS_AUTHORITATIVE_LATE_DECODER_V1.py"
SPEC = importlib.util.spec_from_file_location("mcft_cap09_kbs_late", DECODER_PATH)
if SPEC is None or SPEC.loader is None:
    raise RuntimeError("MCFT_CAP09_ROLLING_INTERSECTION_DECODER_LOAD_FAILED")
kbs = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(kbs)

HISTORICAL_FRESHNESS_HOURS = 6.0
EXPECTED_TYPES = [
    "future_et0_assumption_v1",
    "future_weather_assumption_v1",
    "soil_moisture_observation_v1",
]


def require(condition: bool, code: str) -> None:
    if not condition:
        raise RuntimeError(code)


def parse_iso(value: str, code: str) -> datetime:
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as exc:
        raise RuntimeError(code) from exc
    require(parsed.tzinfo is not None, code)
    return parsed.astimezone(timezone.utc)


def iso(value: datetime) -> str:
    return value.astimezone(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def exact_hour(value: str, code: str) -> datetime:
    parsed = parse_iso(value, code)
    require(parsed.minute == 0 and parsed.second == 0 and parsed.microsecond == 0, code)
    return parsed


def candidate_profile(path: Path, now: datetime) -> dict[str, Any] | None:
    try:
        candidate = json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return None
    if candidate.get("status") != "PASS" or candidate.get("temporal_authority") != "PROVIDER_AVAILABILITY_WATERMARK_V1":
        return None
    producer = str(candidate.get("producer_subject_sha") or candidate.get("subject_sha") or "")
    if len(producer) != 40 or any(ch not in "0123456789abcdef" for ch in producer):
        return None
    try:
        target = exact_hour(str(candidate.get("target_t") or ""), "MCFT_CAP09_ROLLING_INTERSECTION_TARGET_INVALID")
        expires = parse_iso(str(candidate.get("candidate_expires_at") or ""), "MCFT_CAP09_ROLLING_INTERSECTION_EXPIRY_INVALID")
    except RuntimeError:
        return None
    if expires <= now:
        return None
    record_types = sorted(candidate.get("record_types") or [])
    if record_types != EXPECTED_TYPES:
        return None
    side = candidate.get("side_effects") or {}
    if any(side.get(name) != 0 for name in [
        "formal_database_write_count",
        "formal_r2_prefix_write_count",
        "scheduler_write_count",
        "runtime_write_count",
    ]):
        return None
    if side.get("crop_authority_effect") != "NONE":
        return None
    if not candidate.get("raw_retention_refs") or len(candidate["raw_retention_refs"]) < 2:
        return None
    return {
        "candidate_file": str(path),
        "producer_subject_sha": producer,
        "target_t": iso(target),
        "target_dt": target,
        "candidate_expires_at": iso(expires),
        "raw_ref_count": len(candidate["raw_retention_refs"]),
        "semantic_manifest_digest": candidate.get("semantic_manifest_digest"),
    }


def choose(rows: list[dict], candidate_profiles: list[dict[str, Any]], available_at: datetime) -> dict[str, Any]:
    by_timestamp = kbs.index_rows(rows, available_at)
    latest = max(by_timestamp)
    latest_age_hours = (available_at - latest).total_seconds() / 3600.0
    exact_matches: list[dict[str, Any]] = []
    for candidate in sorted(candidate_profiles, key=lambda item: item["target_dt"]):
        target = candidate["target_dt"]
        provider_rows = by_timestamp.get(target, [])
        if len(provider_rows) != 1:
            continue
        if not kbs.row_is_complete(provider_rows[0], target):
            continue
        exact_matches.append(candidate)
    selected = exact_matches[0] if exact_matches else None
    return {
        "schema_version": "geox_mcft_cap09_rolling_kbs_intersection_v1",
        "status": "PASS",
        "temporal_authority": "PROVIDER_AVAILABILITY_WATERMARK_V1",
        "provider_publication_cadence": "DAILY_BATCH",
        "observation_resolution": "HOURLY",
        "provider_latest_timestamp": iso(latest),
        "provider_latest_age_hours": round(latest_age_hours, 6),
        "historical_online_freshness_diagnostic_le_6h": latest_age_hours <= HISTORICAL_FRESHNESS_HOURS,
        "freshness_is_late_authoritative_admission_gate": False,
        "eligible_candidate_count": len(candidate_profiles),
        "exact_kbs_intersection_count": len(exact_matches),
        "selection_policy": "OLDEST_EXACT_TARGET_FIRST",
        "selected": None if selected is None else {
            key: value for key, value in selected.items() if key != "target_dt"
        },
        "raw_values_emitted": False,
        "database_write_count": 0,
        "formal_effect": False,
        "crop_authority_effect": "NONE",
    }


def selftest() -> None:
    available = datetime(2026, 8, 14, 12, 0, tzinfo=timezone.utc)
    def row(hour: int) -> dict:
        return {
            "datetime_utc": f"2026-08-13 {hour:02d}:00:00",
            "rain_mm": "0.2",
            "airtmp_107_avg": "24.0",
            "ah": "1.8",
            "solrad_avg": "150.0",
            "wind_speed": "2.5",
        }
    candidates = [
        {"candidate_file": "b.json", "producer_subject_sha": "b" * 40, "target_t": "2026-08-13T13:00:00.000Z", "target_dt": datetime(2026, 8, 13, 13, tzinfo=timezone.utc), "candidate_expires_at": "2026-08-15T01:00:00.000Z", "raw_ref_count": 2, "semantic_manifest_digest": "sha256:b"},
        {"candidate_file": "a.json", "producer_subject_sha": "a" * 40, "target_t": "2026-08-13T12:00:00.000Z", "target_dt": datetime(2026, 8, 13, 12, tzinfo=timezone.utc), "candidate_expires_at": "2026-08-15T00:00:00.000Z", "raw_ref_count": 2, "semantic_manifest_digest": "sha256:a"},
    ]
    result = choose([row(13), row(12)], candidates, available)
    require(result["selected"] is not None, "MCFT_CAP09_ROLLING_INTERSECTION_SELFTEST_SELECTION_REQUIRED")
    require(result["selected"]["target_t"] == "2026-08-13T12:00:00.000Z", "MCFT_CAP09_ROLLING_INTERSECTION_SELFTEST_OLDEST_FIRST")
    require(result["historical_online_freshness_diagnostic_le_6h"] is False, "MCFT_CAP09_ROLLING_INTERSECTION_SELFTEST_STALE_DIAGNOSTIC_REQUIRED")
    require(result["freshness_is_late_authoritative_admission_gate"] is False, "MCFT_CAP09_ROLLING_INTERSECTION_SELFTEST_FRESHNESS_GATE_FORBIDDEN")
    print(json.dumps({
        "status": "PASS",
        "oldest_exact_target_first": True,
        "stale_daily_batch_can_intersect": True,
        "freshness_is_admission_gate": False,
        "database_write_count": 0,
    }, sort_keys=True))


def main() -> None:
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("selftest")
    select = sub.add_parser("select")
    select.add_argument("--available-at", required=True)
    select.add_argument("--kbs-input", required=True)
    select.add_argument("--candidate-root", required=True)
    select.add_argument("--output", required=True)
    args = parser.parse_args()
    if args.command == "selftest":
        selftest()
        return
    available = parse_iso(args.available_at, "MCFT_CAP09_ROLLING_INTERSECTION_AVAILABLE_AT_INVALID")
    candidate_root = Path(args.candidate_root)
    profiles = []
    for path in candidate_root.rglob("MCFT_CAP_09_ROLLING_PREBOUNDARY_CANDIDATE.json"):
        profile = candidate_profile(path, available)
        if profile is not None:
            profiles.append(profile)
    rows = kbs.ea4.parse_kbs_csv(Path(args.kbs_input).read_bytes())
    result = choose(rows, profiles, available)
    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(result, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(json.dumps(result, sort_keys=True))


if __name__ == "__main__":
    main()
