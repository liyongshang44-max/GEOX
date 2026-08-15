#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse
from urllib.request import Request, urlopen

ROOT = Path.cwd()
PROVIDER_PATH = ROOT / "scripts/runtime_acceptance/MCFT_CAP_09_EA5E2_LIVE_PROVIDER_TWO_PHASE.py"
SPEC = importlib.util.spec_from_file_location("mcft_cap09_ea5e2_provider", PROVIDER_PATH)
if SPEC is None or SPEC.loader is None:
    raise RuntimeError("EA5E2_LATE_POLL_PROVIDER_MODULE_LOAD_FAILED")
provider = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(provider)
ea4 = provider.ea4

POLL_INTERVAL_SECONDS = 60
START_OFFSET_MINUTES = 390
CUTOFF_OFFSET_MINUTES = 432
MIN_INGRESS_MARGIN_MINUTES = 5
# Scheduler-only end-to-end reservation. The frozen evidence cutoff remains T+432.
# Discovery must finish earlier so the real collector, retention, decode,
# canonicalization and DB ingress do not race the same deadline.
COLLECTOR_PROCESSING_BUDGET_MINUTES = 25
DEADLINE_OFFSET_MINUTES = CUTOFF_OFFSET_MINUTES - COLLECTOR_PROCESSING_BUDGET_MINUTES
MAX_BYTES = 110_000_000
KBS_URL = ea4.AUTH["kbs"]["raw_hourly_csv"]
TEMPORAL_AUTHORITY = "PROVIDER_AVAILABILITY_WATERMARK_V1"
PROVIDER_PUBLICATION_CADENCE = "DAILY_BATCH"
FRESHNESS_ROLE = "HISTORICAL_ONLINE_DIAGNOSTIC_ONLY"


def iso(value: datetime) -> str:
    return value.astimezone(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def exact_hour(value: str) -> datetime:
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        raise RuntimeError("EA5E2_LATE_POLL_TARGET_TZ_REQUIRED")
    parsed = parsed.astimezone(timezone.utc)
    if parsed.minute != 0 or parsed.second != 0 or parsed.microsecond != 0:
        raise RuntimeError("EA5E2_LATE_POLL_EXACT_UTC_HOUR_REQUIRED")
    return parsed


def write(path: Path, proof: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(proof, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(json.dumps(proof, sort_keys=True))


def common_semantics() -> dict:
    return {
        "temporal_authority": TEMPORAL_AUTHORITY,
        "provider_publication_cadence": PROVIDER_PUBLICATION_CADENCE,
        "freshness_role": FRESHNESS_ROLE,
        "freshness_is_late_authoritative_admission_gate": False,
        "historical_online_freshness_diagnostic_hours": float(ea4.AUTH["kbs"]["raw_hourly_latest_max_age_hours"]),
    }


def fetch_once(deadline: datetime) -> tuple[bytes, str, int, datetime]:
    remaining = (deadline - datetime.now(timezone.utc)).total_seconds()
    if remaining <= 0:
        raise RuntimeError("EA5E2_LATE_EXACT_HOUR_AVAILABILITY_DEADLINE_EXCEEDED")
    timeout = max(1.0, min(30.0, remaining))
    request = Request(
        KBS_URL,
        method="GET",
        headers={
            "User-Agent": "GEOX-MCFT-CAP09-EA5E2-LATE-SEMANTIC-POLL/1",
            "Accept": "text/csv,text/plain;q=0.9,*/*;q=0.5",
            "Cache-Control": "no-cache",
            "Pragma": "no-cache",
        },
    )
    try:
        with urlopen(request, timeout=timeout) as response:
            body = response.read(MAX_BYTES + 1)
            retrieved = datetime.now(timezone.utc)
            if len(body) > MAX_BYTES:
                raise RuntimeError("EA5E2_LATE_POLL_BODY_TOO_LARGE")
            final_url = response.geturl()
            status = int(response.status)
    except (HTTPError, URLError, TimeoutError) as exc:
        raise RuntimeError(f"EA5E2_LATE_POLL_TRANSPORT:{type(exc).__name__}") from exc
    final = urlparse(final_url)
    if status != 200:
        raise RuntimeError(f"EA5E2_LATE_POLL_HTTP:{status}")
    if final.scheme != "https" or final.hostname != "lter.kbs.msu.edu" or final.path != "/datatables/13.csv":
        raise RuntimeError("EA5E2_LATE_POLL_SOURCE_IDENTITY_DRIFT")
    return body, final_url, status, retrieved


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--target", required=True)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()

    target = exact_hour(args.target)
    output = Path(args.output)
    scheduled = target + timedelta(minutes=START_OFFSET_MINUTES)
    deadline = target + timedelta(minutes=DEADLINE_OFFSET_MINUTES)
    cutoff = target + timedelta(minutes=CUTOFF_OFFSET_MINUTES)
    now = datetime.now(timezone.utc)

    if now > deadline:
        proof = {
            "schema_version": "geox_mcft_cap09_ea5e2_late_exact_t_availability_poll_v2",
            "status": "FAIL",
            "reason": "EA5E2_LATE_EXACT_HOUR_AVAILABILITY_DEADLINE_EXCEEDED",
            "target_t": iso(target),
            "scheduled_start": iso(scheduled),
            "semantic_poll_deadline": iso(deadline),
            "late_exact_hour_cutoff": iso(cutoff),
            "poll_interval_seconds": POLL_INTERVAL_SECONDS,
            "collector_processing_budget_minutes": COLLECTOR_PROCESSING_BUDGET_MINUTES,
            "provider_request_count": 0,
            "raw_retention_count": 0,
            "canonical_write_count": 0,
            "formal_database_write_count": 0,
            "raw_values_emitted": False,
            **common_semantics(),
        }
        write(output, proof)
        return 2

    if now < scheduled:
        time.sleep((scheduled - now).total_seconds())

    attempts: list[dict] = []
    provider_request_count = 0
    while datetime.now(timezone.utc) < deadline:
        attempt_started = datetime.now(timezone.utc)
        provider_request_count += 1
        try:
            body, final_url, status, retrieved = fetch_once(deadline)
            rows = ea4.parse_kbs_csv(body)
            timestamped = []
            for row in rows:
                timestamp = ea4.parse_provider_utc(row.get("datetime_utc", ""))
                if timestamp is not None and timestamp <= retrieved + timedelta(minutes=5):
                    timestamped.append((timestamp, row))
            if not timestamped:
                raise RuntimeError("EA5E2_LATE_POLL_TIMESTAMPED_ROWS_REQUIRED")
            timestamped.sort(key=lambda item: item[0])
            latest = timestamped[-1][0]
            latest_age_hours = (retrieved - latest).total_seconds() / 3600.0
            exact_matches = [row for timestamp, row in timestamped if timestamp == target]
            if len(exact_matches) > 1:
                raise RuntimeError(f"EA5E2_LATE_POLL_EXACT_TARGET_ROW_CONFLICT:{len(exact_matches)}")
            attempt = {
                "attempt": provider_request_count,
                "requested_at": iso(attempt_started),
                "retrieved_at": iso(retrieved),
                "http_status": status,
                "final_host": urlparse(final_url).hostname,
                "latest_timestamp": iso(latest),
                "latest_age_hours": round(latest_age_hours, 6),
                "exact_target_row_count": len(exact_matches),
                "response_sha256": "sha256:" + hashlib.sha256(body).hexdigest(),
                "response_bytes": len(body),
                "raw_values_emitted": False,
            }
            attempts.append(attempt)
            # Amendment-11: late authority is semantic availability of the exact T row
            # from the same provider source. Latest-row age remains diagnostic only for
            # the established KBS daily-batch publication mode and is not an admission gate.
            if len(exact_matches) == 1:
                if retrieved > deadline:
                    raise RuntimeError("EA5E2_LATE_EXACT_HOUR_AVAILABILITY_DEADLINE_EXCEEDED")
                proof = {
                    "schema_version": "geox_mcft_cap09_ea5e2_late_exact_t_availability_poll_v2",
                    "status": "PASS",
                    "target_t": iso(target),
                    "scheduled_start": iso(scheduled),
                    "first_semantically_available_at": iso(retrieved),
                    "semantic_poll_deadline": iso(deadline),
                    "late_exact_hour_cutoff": iso(cutoff),
                    "minimum_ingress_margin_minutes": MIN_INGRESS_MARGIN_MINUTES,
                    "collector_processing_budget_minutes": COLLECTOR_PROCESSING_BUDGET_MINUTES,
                    "discovery_deadline_is_collector_deadline": False,
                    "poll_interval_seconds": POLL_INTERVAL_SECONDS,
                    "attempt_count": len(attempts),
                    "provider_request_count": provider_request_count,
                    "latest_timestamp": iso(latest),
                    "latest_age_hours": round(latest_age_hours, 6),
                    "exact_target_row_count": 1,
                    "same_source_exact_t_only": True,
                    "late_semantic_availability_polling": True,
                    "raw_retention_count": 0,
                    "canonical_write_count": 0,
                    "formal_database_write_count": 0,
                    "raw_values_emitted": False,
                    "attempts": attempts,
                    **common_semantics(),
                }
                write(output, proof)
                return 0
        except RuntimeError as exc:
            attempts.append({
                "attempt": provider_request_count,
                "requested_at": iso(attempt_started),
                "error_code": str(exc),
                "raw_values_emitted": False,
            })
            if "EXACT_TARGET_ROW_CONFLICT" in str(exc) or "SOURCE_IDENTITY_DRIFT" in str(exc):
                break

        remaining = (deadline - datetime.now(timezone.utc)).total_seconds()
        if remaining <= 0:
            break
        time.sleep(min(POLL_INTERVAL_SECONDS, remaining))

    proof = {
        "schema_version": "geox_mcft_cap09_ea5e2_late_exact_t_availability_poll_v2",
        "status": "FAIL",
        "reason": "EA5E2_LATE_EXACT_HOUR_AVAILABILITY_DEADLINE_EXCEEDED",
        "target_t": iso(target),
        "scheduled_start": iso(scheduled),
        "semantic_poll_deadline": iso(deadline),
        "late_exact_hour_cutoff": iso(cutoff),
        "minimum_ingress_margin_minutes": MIN_INGRESS_MARGIN_MINUTES,
        "collector_processing_budget_minutes": COLLECTOR_PROCESSING_BUDGET_MINUTES,
        "discovery_deadline_is_collector_deadline": False,
        "poll_interval_seconds": POLL_INTERVAL_SECONDS,
        "attempt_count": len(attempts),
        "provider_request_count": provider_request_count,
        "same_source_exact_t_only": True,
        "late_semantic_availability_polling": True,
        "raw_retention_count": 0,
        "canonical_write_count": 0,
        "formal_database_write_count": 0,
        "raw_values_emitted": False,
        "attempts": attempts,
        **common_semantics(),
    }
    write(output, proof)
    return 3


if __name__ == "__main__":
    raise SystemExit(main())
