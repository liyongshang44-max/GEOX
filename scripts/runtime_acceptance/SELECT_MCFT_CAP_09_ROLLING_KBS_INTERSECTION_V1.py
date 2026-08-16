#!/usr/bin/env python3
from __future__ import annotations

import argparse
import importlib.util
import json
import subprocess
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path.cwd()
DECODER_PATH = ROOT / "scripts/runtime_acceptance/MCFT_CAP_09_KBS_AUTHORITATIVE_LATE_DECODER_V1.py"
PRODUCER_SCOPE_PATH = "apps/server/src/domain/twin_runtime/external_formal_runtime_config_v1.ts"
PRODUCER_SCOPE_AUTHORITY = "T3R1_EXTERNAL_FORMAL_SCOPE_V1"
T3R1_SCOPE_MARKERS = (
    'tenant_id: "tenant_mcft_external"',
    'project_id: "project_mcft_cap09"',
    'group_id: "group_public_research"',
    'field_id: "field_kbs_mcse_t3r1"',
    'season_id: "season_2026_corn"',
    'zone_id: "zone_kbs_mcse_t3r1_crop_formal_v1"',
)
T1R1_SCOPE_MARKERS = (
    'field_id: "field_kbs_mcse_t1r1"',
    'zone_id: "zone_kbs_mcse_t1r1_formal_v1"',
)

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


def scope_text_is_t3r1(text: str) -> bool:
    return all(marker in text for marker in T3R1_SCOPE_MARKERS) and not any(marker in text for marker in T1R1_SCOPE_MARKERS)


def producer_scope_authority(producer: str) -> str | None:
    try:
        completed = subprocess.run(
            ["git", "show", f"{producer}:{PRODUCER_SCOPE_PATH}"],
            cwd=ROOT,
            check=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
            text=True,
            timeout=15,
        )
    except (subprocess.SubprocessError, OSError):
        return None
    return PRODUCER_SCOPE_AUTHORITY if scope_text_is_t3r1(completed.stdout) else None


def candidate_profile(path: Path, now: datetime) -> dict[str, Any] | None:
    metadata_path = path.parent / "ARTIFACT_METADATA.json"
    try:
        candidate = json.loads(path.read_text(encoding="utf-8"))
        metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
    except Exception:
        return None
    if candidate.get("status") != "PASS" or candidate.get("temporal_authority") != "PROVIDER_AVAILABILITY_WATERMARK_V1":
        return None
    producer = str(candidate.get("producer_subject_sha") or candidate.get("subject_sha") or "")
    if len(producer) != 40 or any(ch not in "0123456789abcdef" for ch in producer):
        return None
    if metadata.get("run_conclusion") != "success" or metadata.get("head_branch") != "main" or metadata.get("head_sha") != producer:
        return None
    if producer_scope_authority(producer) != PRODUCER_SCOPE_AUTHORITY:
        return None
    if not isinstance(metadata.get("workflow_run_id"), int) or metadata["workflow_run_id"] <= 0:
        return None
    if not isinstance(metadata.get("artifact_id"), int) or metadata["artifact_id"] <= 0:
        return None
    digest = str(metadata.get("artifact_digest") or "")
    if not digest.startswith("sha256:") or len(digest) != 71:
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
        "producer_scope_authority": PRODUCER_SCOPE_AUTHORITY,
        "producer_workflow_run_id": metadata["workflow_run_id"],
        "artifact_id": metadata["artifact_id"],
        "artifact_digest": digest,
        "target_t": iso(target),
        "target_dt": target,
        "candidate_expires_at": iso(expires),
        "raw_ref_count": len(candidate["raw_retention_refs"]),
        "semantic_manifest_digest": candidate.get("semantic_manifest_digest"),
    }


def crop_legality(path: Path) -> dict[str, str]:
    proof = json.loads(path.read_text(encoding="utf-8"))
    require(proof.get("schema_version") == "geox_mcft_cap09_rolling_crop_legality_v1", "MCFT_CAP09_ROLLING_INTERSECTION_CROP_LEGALITY_SCHEMA_REQUIRED")
    require(proof.get("status") == "PASS", "MCFT_CAP09_ROLLING_INTERSECTION_CROP_LEGALITY_PASS_REQUIRED")
    require(proof.get("selection_role") == "PRE_KBS_CROP_AUTHORITY_INTERSECTION", "MCFT_CAP09_ROLLING_INTERSECTION_CROP_LEGALITY_ROLE_REQUIRED")
    require(proof.get("temporal_authority") == "PROVIDER_AVAILABILITY_WATERMARK_V1", "MCFT_CAP09_ROLLING_INTERSECTION_CROP_TEMPORAL_AUTHORITY_REQUIRED")
    require(proof.get("crop_authority_effect") == "NONE", "MCFT_CAP09_ROLLING_INTERSECTION_CROP_EFFECT_FORBIDDEN")
    require(proof.get("future_observations_used") is False, "MCFT_CAP09_ROLLING_INTERSECTION_FUTURE_CROP_OBSERVATION_FORBIDDEN")
    require(proof.get("provider_request_count") == 0 and proof.get("database_write_count") == 0, "MCFT_CAP09_ROLLING_INTERSECTION_CROP_SIDE_EFFECT_FORBIDDEN")
    result: dict[str, str] = {}
    for item in proof.get("legal_targets") or []:
        target = iso(exact_hour(str(item.get("target_t") or ""), "MCFT_CAP09_ROLLING_INTERSECTION_CROP_TARGET_INVALID"))
        stage = str(item.get("crop_stage_code") or "")
        require(stage in {"INITIAL", "DEVELOPMENT", "MID", "LATE"}, "MCFT_CAP09_ROLLING_INTERSECTION_CROP_STAGE_INVALID")
        result[target] = stage
    return result


def choose(rows: list[dict], candidate_profiles: list[dict[str, Any]], crop_legal: dict[str, str], available_at: datetime) -> dict[str, Any]:
    by_timestamp = kbs.index_rows(rows, available_at)
    latest = max(by_timestamp)
    latest_age_hours = (available_at - latest).total_seconds() / 3600.0
    crop_legal_profiles = [candidate for candidate in candidate_profiles if candidate["target_t"] in crop_legal]
    exact_matches: list[dict[str, Any]] = []
    for candidate in sorted(crop_legal_profiles, key=lambda item: item["target_dt"]):
        require(candidate.get("producer_scope_authority") == PRODUCER_SCOPE_AUTHORITY, "MCFT_CAP09_ROLLING_INTERSECTION_T3R1_PRODUCER_SCOPE_REQUIRED")
        target = candidate["target_dt"]
        provider_rows = by_timestamp.get(target, [])
        if len(provider_rows) != 1:
            continue
        if not kbs.row_is_complete(provider_rows[0], target):
            continue
        exact_matches.append({**candidate, "crop_stage_code": crop_legal[candidate["target_t"]]})
    selected = exact_matches[0] if exact_matches else None
    return {
        "schema_version": "geox_mcft_cap09_rolling_kbs_intersection_v2",
        "status": "PASS",
        "temporal_authority": "PROVIDER_AVAILABILITY_WATERMARK_V1",
        "provider_publication_cadence": "DAILY_BATCH",
        "observation_resolution": "HOURLY",
        "provider_latest_timestamp": iso(latest),
        "provider_latest_age_hours": round(latest_age_hours, 6),
        "historical_online_freshness_diagnostic_le_6h": latest_age_hours <= HISTORICAL_FRESHNESS_HOURS,
        "freshness_is_late_authoritative_admission_gate": False,
        "producer_scope_authority_required": PRODUCER_SCOPE_AUTHORITY,
        "candidate_provenance_valid_count": len(candidate_profiles),
        "crop_legal_candidate_count": len(crop_legal_profiles),
        "crop_rejected_candidate_count": len(candidate_profiles) - len(crop_legal_profiles),
        "crop_authority_intersection_applied": True,
        "crop_authority_effect": "NONE",
        "future_crop_observations_used": False,
        "exact_kbs_intersection_count": len(exact_matches),
        "selection_policy": "OLDEST_CROP_LEGAL_EXACT_TARGET_FIRST",
        "selected": None if selected is None else {
            key: value for key, value in selected.items() if key != "target_dt"
        },
        "raw_values_emitted": False,
        "database_write_count": 0,
        "formal_effect": False,
    }


def selftest() -> None:
    available = datetime(2026, 8, 14, 12, 0, tzinfo=timezone.utc)

    require(scope_text_is_t3r1("\n".join(T3R1_SCOPE_MARKERS)), "MCFT_CAP09_ROLLING_INTERSECTION_SELFTEST_T3R1_SCOPE_REQUIRED")
    require(not scope_text_is_t3r1("\n".join(T1R1_SCOPE_MARKERS)), "MCFT_CAP09_ROLLING_INTERSECTION_SELFTEST_T1R1_SCOPE_REJECTED")

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
        {"candidate_file": "a.json", "producer_subject_sha": "a" * 40, "producer_scope_authority": PRODUCER_SCOPE_AUTHORITY, "producer_workflow_run_id": 1, "artifact_id": 10, "artifact_digest": "sha256:" + "a" * 64, "target_t": "2026-08-13T12:00:00.000Z", "target_dt": datetime(2026, 8, 13, 12, tzinfo=timezone.utc), "candidate_expires_at": "2026-08-15T00:00:00.000Z", "raw_ref_count": 2, "semantic_manifest_digest": "sha256:a"},
        {"candidate_file": "b.json", "producer_subject_sha": "b" * 40, "producer_scope_authority": PRODUCER_SCOPE_AUTHORITY, "producer_workflow_run_id": 2, "artifact_id": 20, "artifact_digest": "sha256:" + "b" * 64, "target_t": "2026-08-13T13:00:00.000Z", "target_dt": datetime(2026, 8, 13, 13, tzinfo=timezone.utc), "candidate_expires_at": "2026-08-15T01:00:00.000Z", "raw_ref_count": 2, "semantic_manifest_digest": "sha256:b"},
    ]
    result = choose([row(13), row(12)], candidates, {"2026-08-13T13:00:00.000Z": "MID"}, available)
    require(result["selected"] is not None, "MCFT_CAP09_ROLLING_INTERSECTION_SELFTEST_SELECTION_REQUIRED")
    require(result["selected"]["target_t"] == "2026-08-13T13:00:00.000Z", "MCFT_CAP09_ROLLING_INTERSECTION_SELFTEST_OLDEST_CROP_LEGAL_FIRST")
    require(result["selected"]["artifact_id"] == 20, "MCFT_CAP09_ROLLING_INTERSECTION_SELFTEST_ARTIFACT_ID")
    require(result["selected"]["crop_stage_code"] == "MID", "MCFT_CAP09_ROLLING_INTERSECTION_SELFTEST_CROP_STAGE")
    require(result["selected"]["producer_scope_authority"] == PRODUCER_SCOPE_AUTHORITY, "MCFT_CAP09_ROLLING_INTERSECTION_SELFTEST_T3R1_SELECTED")
    require(result["crop_rejected_candidate_count"] == 1, "MCFT_CAP09_ROLLING_INTERSECTION_SELFTEST_CROP_REJECTION_REQUIRED")
    require(result["historical_online_freshness_diagnostic_le_6h"] is False, "MCFT_CAP09_ROLLING_INTERSECTION_SELFTEST_STALE_DIAGNOSTIC_REQUIRED")
    require(result["freshness_is_late_authoritative_admission_gate"] is False, "MCFT_CAP09_ROLLING_INTERSECTION_SELFTEST_FRESHNESS_GATE_FORBIDDEN")
    print(json.dumps({
        "status": "PASS",
        "oldest_crop_legal_exact_target_first": True,
        "producer_run_provenance_required": True,
        "producer_t3r1_scope_required": True,
        "t1r1_producer_scope_rejected": True,
        "stale_daily_batch_can_intersect": True,
        "crop_authority_intersection_applied": True,
        "crop_authority_effect": "NONE",
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
    select.add_argument("--crop-legality", required=True)
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
    crop_legal = crop_legality(Path(args.crop_legality))
    rows = kbs.ea4.parse_kbs_csv(Path(args.kbs_input).read_bytes())
    result = choose(rows, profiles, crop_legal, available)
    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(result, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(json.dumps(result, sort_keys=True))


if __name__ == "__main__":
    main()
