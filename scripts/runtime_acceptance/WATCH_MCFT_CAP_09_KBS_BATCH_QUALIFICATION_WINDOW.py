#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

from OBSERVE_MCFT_CAP_09_KBS_CURRENT_FRESHNESS_METADATA import observe_current_freshness_metadata

SCHEMA = "geox_mcft_cap09_kbs_batch_qualification_window_v1"
DEFAULT_INTERVAL_SECONDS = 300
DEFAULT_MAX_ATTEMPTS = 24


def require(condition: bool, code: str) -> None:
    if not condition:
        raise RuntimeError(code)


def write_json(path: Path, value: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def safe_error(exc: Exception) -> str:
    return str(exc).replace("\n", " ")[:240]


def baseline_latest(previous_state: Path | None) -> str | None:
    if previous_state is None or not previous_state.exists():
        return None
    state = json.loads(previous_state.read_text(encoding="utf-8"))
    require(state.get("schema_version") == "geox_mcft_cap09_kbs_publication_cadence_state_v1", "KBS_WINDOW_PREVIOUS_STATE_SCHEMA_INVALID")
    value = state.get("latest_event_time")
    require(isinstance(value, str) and value, "KBS_WINDOW_PREVIOUS_LATEST_REQUIRED")
    return value


def evaluate_snapshot(snapshot: dict, previous_latest: str | None) -> dict:
    require(snapshot.get("schema_version") == "geox_mcft_cap09_kbs_current_freshness_metadata_v1", "KBS_WINDOW_SNAPSHOT_SCHEMA_INVALID")
    latest = str(snapshot.get("latest_raw_hourly_timestamp") or "")
    latest_ms = datetime.fromisoformat(latest.replace("Z", "+00:00")).timestamp()
    previous_ms = datetime.fromisoformat(previous_latest.replace("Z", "+00:00")).timestamp() if previous_latest else None
    advanced = previous_ms is not None and latest_ms > previous_ms
    fresh = snapshot.get("within_frozen_6h_authority") is True
    complete = (
        snapshot.get("latest_24h_contiguous") is True
        and snapshot.get("latest_24h_expected_hour_count") == 24
        and snapshot.get("latest_24h_observed_hour_count") == 24
        and snapshot.get("latest_24h_missing_event_times") == []
    )
    captured = fresh and complete
    if captured and advanced:
        classification = "NEW_DAILY_BATCH_FRESH_WINDOW_CAPTURED"
    elif captured:
        classification = "FRESH_DAILY_BATCH_WINDOW_ALREADY_VISIBLE"
    elif advanced:
        classification = "BATCH_ADVANCE_DETECTED_OUTSIDE_QUALIFICATION_WINDOW"
    else:
        classification = "WAITING_FOR_FRESH_COMPLETE_DAILY_BATCH"
    return {
        "captured": captured,
        "stop": captured or advanced,
        "classification": classification,
        "latest_event_time": latest,
        "latest_age_hours": snapshot.get("latest_age_hours"),
        "latest_advanced_from_previous_state": advanced,
        "within_frozen_6h_authority": fresh,
        "latest_24h_complete_and_contiguous": complete,
    }


def selftest() -> dict:
    base = {
        "schema_version": "geox_mcft_cap09_kbs_current_freshness_metadata_v1",
        "latest_raw_hourly_timestamp": "2026-08-12T04:00:00.000Z",
        "latest_age_hours": 23.9,
        "within_frozen_6h_authority": False,
        "latest_24h_contiguous": True,
        "latest_24h_expected_hour_count": 24,
        "latest_24h_observed_hour_count": 24,
        "latest_24h_missing_event_times": [],
    }
    waiting = evaluate_snapshot(base, "2026-08-12T04:00:00.000Z")
    advanced = evaluate_snapshot({
        **base,
        "latest_raw_hourly_timestamp": "2026-08-13T04:00:00.000Z",
        "latest_age_hours": 1.1,
        "within_frozen_6h_authority": True,
    }, "2026-08-12T04:00:00.000Z")
    already_visible = evaluate_snapshot({
        **base,
        "latest_raw_hourly_timestamp": "2026-08-13T04:00:00.000Z",
        "latest_age_hours": 1.2,
        "within_frozen_6h_authority": True,
    }, "2026-08-13T04:00:00.000Z")
    require(waiting["captured"] is False and waiting["stop"] is False, "SELFTEST_WAIT")
    require(advanced["captured"] is True and advanced["latest_advanced_from_previous_state"] is True, "SELFTEST_ADVANCE")
    require(already_visible["captured"] is True and already_visible["classification"] == "FRESH_DAILY_BATCH_WINDOW_ALREADY_VISIBLE", "SELFTEST_ALREADY_VISIBLE")
    return {
        "status": "PASS",
        "case_count": 3,
        "provider_operating_profile": "CONFIRMED_DAILY_BATCH",
        "poll_interval_seconds": DEFAULT_INTERVAL_SECONDS,
        "maximum_attempts": DEFAULT_MAX_ATTEMPTS,
        "metadata_only": True,
        "live_dispatch_requested": False,
        "authority_effect": False,
    }


def run(args: argparse.Namespace) -> int:
    previous_path = Path(args.previous_state) if args.previous_state else None
    previous_latest = baseline_latest(previous_path)
    output = Path(args.output)
    current_output = Path(args.current_output)
    attempts: list[dict] = []
    captured = False
    final_evaluation = None

    for attempt_number in range(1, args.max_attempts + 1):
        polled_at = datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")
        try:
            snapshot = observe_current_freshness_metadata()
            write_json(current_output, snapshot)
            evaluation = evaluate_snapshot(snapshot, previous_latest)
            final_evaluation = evaluation
            attempts.append({
                "attempt": attempt_number,
                "polled_at": polled_at,
                **evaluation,
                "raw_values_emitted": False,
            })
            if evaluation["captured"]:
                captured = True
                break
            if evaluation["stop"]:
                break
        except Exception as exc:
            attempts.append({
                "attempt": attempt_number,
                "polled_at": polled_at,
                "classification": "TRANSIENT_POLL_ERROR",
                "error_code": safe_error(exc),
                "raw_values_emitted": False,
            })
        if attempt_number < args.max_attempts:
            time.sleep(args.poll_interval_seconds)

    status = "PASS" if captured else "NO_FRESH_COMPLETE_BATCH_WITHIN_BOUNDED_WINDOW"
    proof = {
        "schema_version": SCHEMA,
        "status": status,
        "provider_operating_profile": "CONFIRMED_DAILY_BATCH",
        "provider_operating_profile_authority_effect": False,
        "observer_machine_evidence_remains_separate": True,
        "baseline_latest_event_time": previous_latest,
        "poll_interval_seconds": args.poll_interval_seconds,
        "maximum_attempts": args.max_attempts,
        "attempt_count": len(attempts),
        "attempts": attempts,
        "capture": final_evaluation,
        "metadata_only": True,
        "raw_provider_body_retained": False,
        "raw_provider_values_emitted": False,
        "database_write_count": 0,
        "canonical_write_count": 0,
        "actions_write_count": 0,
        "read_only_readiness_evaluation_requested": captured,
        "live_dispatch_requested": False,
        "authority_effect": False,
        "formal_effect": False,
        "ea5e2_effectiveness": False,
        "ea5e3_authorized": False,
        "formal_window_started": False,
    }
    write_json(output, proof)
    print(json.dumps(proof, sort_keys=True))
    return 0 if captured or not args.fail_on_timeout else 2


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--previous-state")
    parser.add_argument("--output", default="acceptance-output/KBS_BATCH_QUALIFICATION_WINDOW.json")
    parser.add_argument("--current-output", default="acceptance-output/KBS_CURRENT_FRESHNESS_METADATA.json")
    parser.add_argument("--poll-interval-seconds", type=int, default=DEFAULT_INTERVAL_SECONDS)
    parser.add_argument("--max-attempts", type=int, default=DEFAULT_MAX_ATTEMPTS)
    parser.add_argument("--fail-on-timeout", action="store_true")
    parser.add_argument("--selftest", action="store_true")
    args = parser.parse_args()
    if args.selftest:
        print(json.dumps(selftest(), sort_keys=True))
        return
    require(60 <= args.poll_interval_seconds <= 300, "KBS_WINDOW_POLL_INTERVAL_MUST_BE_1_TO_5_MINUTES")
    require(1 <= args.max_attempts <= 36, "KBS_WINDOW_MAX_ATTEMPTS_INVALID")
    raise SystemExit(run(args))


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"[FAIL] {safe_error(exc)}", file=sys.stderr)
        raise
