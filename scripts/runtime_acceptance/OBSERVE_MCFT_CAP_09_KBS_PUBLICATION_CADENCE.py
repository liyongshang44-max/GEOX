#!/usr/bin/env python3
from __future__ import annotations

import argparse
import csv
import hashlib
import io
import json
import os
import re
import sys
import time
import zipfile
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode, urlparse
from urllib.request import Request, urlopen

ROOT = Path.cwd()
CONFIG_PATH = ROOT / "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-KBS-PUBLICATION-CADENCE-OBSERVER-V1.json"
DEFAULT_OUTPUT = ROOT / "acceptance-output/KBS_PUBLICATION_CADENCE_STATE.json"
WORKFLOW_FILE = "mcft-cap-09-kbs-publication-cadence-observer.yml"
USER_AGENT = "GEOX-MCFT-CAP09-KBS-CADENCE-OBSERVER/1.0"


def require(condition: bool, code: str) -> None:
    if not condition:
        raise RuntimeError(code)


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def iso(value: datetime) -> str:
    return value.astimezone(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def parse_iso(value: str, code: str) -> datetime:
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except Exception as exc:
        raise RuntimeError(code) from exc
    require(parsed.tzinfo is not None, code)
    return parsed.astimezone(timezone.utc)


def sha256_bytes(body: bytes) -> str:
    return "sha256:" + hashlib.sha256(body).hexdigest()


def sha256_json(value) -> str:
    return sha256_bytes(json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=True).encode("utf-8"))


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


def request_bytes(url: str, max_bytes: int, attempts: int = 4):
    parsed = urlparse(url)
    require(parsed.scheme == "https", "KBS_CADENCE_HTTPS_REQUIRED")
    last = None
    for attempt in range(attempts):
        try:
            req = Request(url, headers={
                "User-Agent": USER_AGENT,
                "Accept": "text/csv,text/plain;q=0.9,*/*;q=0.5",
                "Cache-Control": "no-cache",
            }, method="GET")
            with urlopen(req, timeout=90) as response:
                body = response.read(max_bytes + 1)
                require(len(body) <= max_bytes, "KBS_CADENCE_BODY_TOO_LARGE")
                return int(response.status), dict(response.headers.items()), body, response.geturl()
        except (HTTPError, URLError, TimeoutError) as exc:
            last = exc
            if attempt + 1 < attempts:
                time.sleep(0.75 * (attempt + 1))
    raise RuntimeError(f"KBS_CADENCE_HTTP_FAILED:{type(last).__name__}")


def parse_kbs_csv(body: bytes, required_columns: list[str]):
    text = body.decode("utf-8-sig")
    lines = text.splitlines()
    for idx, line in enumerate(lines[:80]):
        for delim in (",", "\t", ";", "|"):
            cells = next(csv.reader([line], delimiter=delim))
            headers = [normalize_key(cell) for cell in cells]
            if all(column in headers for column in required_columns):
                parsed = []
                for values in csv.reader(lines[idx + 1:], delimiter=delim):
                    if len(values) < len(headers):
                        continue
                    row = {header: values[pos] for pos, header in enumerate(headers)}
                    row_hash = sha256_json({header: row.get(header, "") for header in headers})
                    parsed.append((row, row_hash))
                return idx, delim, headers, parsed
    raise RuntimeError("KBS_CADENCE_RAW_HOURLY_HEADER_NOT_FOUND")


def build_snapshot(config: dict, body: bytes, headers: dict, final_url: str, polled_at: datetime):
    parsed_final = urlparse(final_url)
    source = config["source"]
    require(parsed_final.hostname == source["required_final_host"], "KBS_CADENCE_FINAL_HOST_DRIFT")
    require(parsed_final.path == source["required_final_path"], "KBS_CADENCE_FINAL_PATH_DRIFT")
    header_index, delimiter, csv_headers, rows = parse_kbs_csv(body, source["required_columns"])
    future_limit = polled_at + timedelta(minutes=int(config["polling"]["future_clock_skew_allowance_minutes"]))
    grouped: dict[str, set[str]] = {}
    valid_count = 0
    for row, row_hash in rows:
        timestamp = parse_provider_utc(row.get(source["event_time_field"], ""))
        if timestamp is None or timestamp > future_limit:
            continue
        valid_count += 1
        key = iso(timestamp.replace(microsecond=0))
        grouped.setdefault(key, set()).add(row_hash)
    require(grouped, "KBS_CADENCE_VALID_EVENT_TIME_REQUIRED")
    event_times = sorted(grouped.keys())
    latest = parse_iso(event_times[-1], "KBS_CADENCE_LATEST_INVALID")
    recent_start = latest - timedelta(hours=int(config["polling"]["recent_event_index_hours"]))
    recent = []
    for event_time in event_times:
        when = parse_iso(event_time, "KBS_CADENCE_EVENT_INVALID")
        if when < recent_start:
            continue
        variants = sorted(grouped[event_time])
        recent.append({
            "event_time": event_time,
            "row_identity_hash": sha256_json(variants),
            "row_variant_count": len(variants),
        })
    return {
        "snapshot_sha256": sha256_bytes(body),
        "response_bytes": len(body),
        "http_last_modified_if_present": headers.get("Last-Modified"),
        "etag_if_present": headers.get("ETag"),
        "csv_header_row_index": header_index,
        "csv_delimiter": "TAB" if delimiter == "\t" else delimiter,
        "parsed_row_count": len(rows),
        "valid_event_time_count": valid_count,
        "latest_event_time": event_times[-1],
        "recent_window_start": iso(recent_start),
        "recent_event_index": recent,
        "recent_event_index_digest": sha256_json(recent),
    }


def index_by_event(state: dict):
    return {item["event_time"]: item for item in state.get("recent_event_index", [])}


def publication_bracket(event_time: str, previous_polled_at: str, current_polled_at: str):
    event = parse_iso(event_time, "KBS_CADENCE_BRACKET_EVENT_INVALID")
    lower = parse_iso(previous_polled_at, "KBS_CADENCE_BRACKET_LOWER_INVALID")
    upper = parse_iso(current_polled_at, "KBS_CADENCE_BRACKET_UPPER_INVALID")
    require(lower < upper, "KBS_CADENCE_BRACKET_ORDER_INVALID")
    return {
        "event_time": event_time,
        "last_not_seen_at": previous_polled_at,
        "first_seen_at": current_polled_at,
        "publication_lag_lower_exclusive_seconds": int((lower - event).total_seconds()),
        "publication_lag_upper_inclusive_seconds": int((upper - event).total_seconds()),
    }


def cadence_candidate(history: list[dict], minimum: int):
    transitions = [item for item in history if int(item.get("forward_new_row_count", 0)) > 0]
    if len(transitions) < minimum:
        return "INSUFFICIENT_TRANSITIONS"
    recent = transitions[-minimum:]
    if all(item.get("forward_new_row_count") == 1 and item.get("latest_advanced_by_hours") == 1 for item in recent):
        return "HOURLY_INCREMENTAL_OBSERVED"
    if all((item.get("forward_new_row_count") or 0) >= 6 or (item.get("latest_advanced_by_hours") or 0) >= 6 for item in recent):
        return "BATCHED_OR_BURSTY_OBSERVED"
    return "VARIABLE_PUBLICATION_OBSERVED"


def compare_state(config: dict, previous: dict | None, current: dict, polled_at: str):
    if previous is None:
        return {
            "shape": "BASELINE_SNAPSHOT",
            "baseline_only": True,
            "previous_polled_at": None,
            "previous_latest_event_time": None,
            "new_row_count": 0,
            "forward_new_row_count": 0,
            "backfill_row_count": 0,
            "provider_revision_count": 0,
            "disappeared_event_count": 0,
            "new_event_min": None,
            "new_event_max": None,
            "latest_advanced_by_hours": None,
            "batch_id": None,
            "first_seen_observations": [],
            "provider_revision_observations": [],
            "availability_brackets_established": 0,
        }
    require(previous.get("schema_version") == "geox_mcft_cap09_kbs_publication_cadence_state_v1", "KBS_CADENCE_PREVIOUS_SCHEMA_INVALID")
    require(previous.get("source_url") == config["source"]["url"], "KBS_CADENCE_PREVIOUS_SOURCE_DRIFT")
    previous_polled_at = previous["polled_at"]
    require(parse_iso(previous_polled_at, "KBS_CADENCE_PREVIOUS_POLL_INVALID") < parse_iso(polled_at, "KBS_CADENCE_CURRENT_POLL_INVALID"), "KBS_CADENCE_POLL_ORDER_INVALID")
    prev_index = index_by_event(previous)
    cur_index = index_by_event(current)
    prev_latest = previous["latest_event_time"]
    prev_latest_dt = parse_iso(prev_latest, "KBS_CADENCE_PREVIOUS_LATEST_INVALID")
    cur_latest_dt = parse_iso(current["latest_event_time"], "KBS_CADENCE_CURRENT_LATEST_INVALID")
    previous_window_start = parse_iso(previous["recent_window_start"], "KBS_CADENCE_PREVIOUS_WINDOW_INVALID")

    new_events = sorted(event for event in cur_index if event not in prev_index and parse_iso(event, "KBS_CADENCE_NEW_EVENT_INVALID") >= previous_window_start)
    forward = [event for event in new_events if parse_iso(event, "KBS_CADENCE_FORWARD_EVENT_INVALID") > prev_latest_dt]
    backfill = [event for event in new_events if parse_iso(event, "KBS_CADENCE_BACKFILL_EVENT_INVALID") <= prev_latest_dt]
    revisions = sorted(event for event in cur_index if event in prev_index and cur_index[event]["row_identity_hash"] != prev_index[event]["row_identity_hash"])
    disappeared = sorted(event for event in prev_index if event not in cur_index and parse_iso(event, "KBS_CADENCE_DISAPPEARED_EVENT_INVALID") >= parse_iso(current["recent_window_start"], "KBS_CADENCE_CURRENT_WINDOW_INVALID"))
    brackets = [publication_bracket(event, previous_polled_at, polled_at) for event in new_events]
    revision_observations = [{
        "event_time": event,
        "previous_row_identity_hash": prev_index[event]["row_identity_hash"],
        "current_row_identity_hash": cur_index[event]["row_identity_hash"],
        "revision_first_seen_at": polled_at,
        "revision_last_not_seen_at": previous_polled_at,
    } for event in revisions]
    latest_advance = (cur_latest_dt - prev_latest_dt).total_seconds() / 3600.0
    latest_advance_value = int(latest_advance) if float(latest_advance).is_integer() else round(latest_advance, 6)
    changed_aux = bool(backfill or revisions or disappeared)
    if not new_events and not revisions and not disappeared:
        shape = "NO_CHANGE"
    elif len(forward) == 1 and not changed_aux:
        shape = "SINGLE_NEW_EVENT_HOUR"
    elif len(forward) > 1 and not changed_aux:
        shape = "MULTI_HOUR_FORWARD_BATCH"
    elif not forward:
        shape = "BACKFILL_OR_REVISION_ONLY"
    else:
        shape = "MIXED_FORWARD_AND_BACKFILL_OR_REVISION"
    batch_id = sha256_json({"first_seen_at": polled_at, "events": new_events, "revisions": revisions}) if (new_events or revisions) else None
    return {
        "shape": shape,
        "baseline_only": False,
        "previous_polled_at": previous_polled_at,
        "previous_latest_event_time": prev_latest,
        "new_row_count": len(new_events),
        "forward_new_row_count": len(forward),
        "backfill_row_count": len(backfill),
        "provider_revision_count": len(revisions),
        "disappeared_event_count": len(disappeared),
        "new_event_min": new_events[0] if new_events else None,
        "new_event_max": new_events[-1] if new_events else None,
        "latest_advanced_by_hours": latest_advance_value,
        "batch_id": batch_id,
        "first_seen_observations": brackets,
        "provider_revision_observations": revision_observations,
        "availability_brackets_established": len(brackets),
    }


def github_json(url: str, token: str):
    req = Request(url, headers={"Authorization": f"Bearer {token}", "Accept": "application/vnd.github+json", "User-Agent": USER_AGENT})
    with urlopen(req, timeout=60) as response:
        return json.loads(response.read().decode("utf-8"))


def github_bytes(url: str, token: str):
    req = Request(url, headers={"Authorization": f"Bearer {token}", "Accept": "application/vnd.github+json", "User-Agent": USER_AGENT})
    with urlopen(req, timeout=60) as response:
        return response.read()


def restore_github_state(config: dict):
    token = os.environ.get("GITHUB_TOKEN", "").strip()
    repository = os.environ.get("GITHUB_REPOSITORY", "").strip()
    current_run_id = os.environ.get("GITHUB_RUN_ID", "").strip()
    require(token and repository and current_run_id, "KBS_CADENCE_GITHUB_CONTEXT_REQUIRED")
    params = urlencode({"branch": "main", "status": "success", "per_page": 20})
    runs_url = f"https://api.github.com/repos/{repository}/actions/workflows/{WORKFLOW_FILE}/runs?{params}"
    runs = github_json(runs_url, token).get("workflow_runs", [])
    prefix = config["state_chain"]["artifact_name_prefix"]
    filename = config["state_chain"]["state_filename"]
    for run in runs:
        if str(run.get("id")) == current_run_id:
            continue
        artifacts = github_json(f"https://api.github.com/repos/{repository}/actions/runs/{run['id']}/artifacts?per_page=100", token).get("artifacts", [])
        matching = [item for item in artifacts if str(item.get("name", "")).startswith(prefix) and not item.get("expired")]
        if not matching:
            continue
        artifact = sorted(matching, key=lambda item: item.get("created_at", ""), reverse=True)[0]
        archive = github_bytes(artifact["archive_download_url"], token)
        with zipfile.ZipFile(io.BytesIO(archive), "r") as zipped:
            require(filename in zipped.namelist(), "KBS_CADENCE_PREVIOUS_STATE_FILE_REQUIRED")
            state = json.loads(zipped.read(filename).decode("utf-8"))
        return state, {"run_id": run["id"], "artifact_id": artifact["id"], "artifact_digest": artifact.get("digest")}
    return None, None


def make_state(config: dict, snapshot: dict, polled_at: str, previous: dict | None, predecessor: dict | None):
    transition = compare_state(config, previous, snapshot, polled_at)
    history = list(previous.get("publication_transition_history", [])) if previous else []
    if transition["shape"] != "BASELINE_SNAPSHOT" and transition["shape"] != "NO_CHANGE":
        history.append({
            "polled_at": polled_at,
            "shape": transition["shape"],
            "forward_new_row_count": transition["forward_new_row_count"],
            "backfill_row_count": transition["backfill_row_count"],
            "provider_revision_count": transition["provider_revision_count"],
            "latest_advanced_by_hours": transition["latest_advanced_by_hours"],
            "batch_id": transition["batch_id"],
        })
    history = history[-50:]
    return {
        "schema_version": "geox_mcft_cap09_kbs_publication_cadence_state_v1",
        "status": "PASS",
        "subject_sha": os.environ.get("MCFT_SUBJECT_SHA") or os.environ.get("GITHUB_SHA"),
        "source_url": config["source"]["url"],
        "source_authority_role": config["source"]["authority_role"],
        "polled_at": polled_at,
        "predecessor_state": predecessor,
        **snapshot,
        "transition": transition,
        "publication_transition_history": history,
        "publication_transition_count": len([item for item in history if int(item.get("forward_new_row_count", 0)) > 0]),
        "candidate_publication_class": cadence_candidate(history, int(config["polling"]["minimum_publication_transitions_before_candidate_classification"])),
        "candidate_publication_class_is_authority": False,
        "exact_source_availability_time_claimed_from_polling_alone": False,
        "raw_provider_body_published": False,
        "raw_provider_values_published": False,
        "daily_aggregate_substitution_authorized": False,
        "kbs_6h_freshness_authority_changed": False,
        "amendment_07_fixed_lag_changed": False,
        "formal_database_write_count": 0,
        "formal_raw_write_count": 0,
        "scheduler_write_count": 0,
        "canonical_runtime_write_count": 0,
        "formal_execution_count": "0/24"
    }


def run_poll(args):
    config = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
    polled_at_dt = utc_now()
    status, headers, body, final_url = request_bytes(config["source"]["url"], int(config["polling"]["max_response_bytes"]))
    require(status == 200, f"KBS_CADENCE_HTTP_STATUS:{status}")
    snapshot = build_snapshot(config, body, headers, final_url, polled_at_dt)
    previous = None
    predecessor = None
    if args.previous_state:
        previous = json.loads(Path(args.previous_state).read_text(encoding="utf-8"))
        predecessor = {"mode": "LOCAL_FILE"}
    elif args.restore_github_state:
        previous, predecessor = restore_github_state(config)
    state = make_state(config, snapshot, iso(polled_at_dt), previous, predecessor)
    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(state, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(json.dumps(state, sort_keys=True))


def fake_snapshot(latest: str, events: list[tuple[str, str]], polled_at: str):
    latest_dt = parse_iso(latest, "SELFTEST_LATEST_INVALID")
    recent_start = latest_dt - timedelta(hours=240)
    recent = [{"event_time": event, "row_identity_hash": row_hash, "row_variant_count": 1} for event, row_hash in sorted(events)]
    return {
        "schema_version": "geox_mcft_cap09_kbs_publication_cadence_state_v1",
        "source_url": "https://lter.kbs.msu.edu/datatables/13.csv",
        "polled_at": polled_at,
        "latest_event_time": latest,
        "recent_window_start": iso(recent_start),
        "recent_event_index": recent,
        "publication_transition_history": [],
    }


def run_selftest():
    config = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
    baseline_current = fake_snapshot("2026-08-11T05:00:00.000Z", [("2026-08-11T05:00:00.000Z", "h5")], "2026-08-11T12:00:00.000Z")
    baseline = compare_state(config, None, baseline_current, "2026-08-11T12:00:00.000Z")
    require(baseline["baseline_only"] and baseline["availability_brackets_established"] == 0, "SELFTEST_BASELINE_BRACKET_FORBIDDEN")

    previous = fake_snapshot("2026-08-11T05:00:00.000Z", [("2026-08-11T05:00:00.000Z", "h5")], "2026-08-11T12:00:00.000Z")
    one = {**previous, "latest_event_time": "2026-08-11T06:00:00.000Z", "recent_event_index": previous["recent_event_index"] + [{"event_time": "2026-08-11T06:00:00.000Z", "row_identity_hash": "h6", "row_variant_count": 1}]}
    one_transition = compare_state(config, previous, one, "2026-08-11T13:00:00.000Z")
    require(one_transition["shape"] == "SINGLE_NEW_EVENT_HOUR" and one_transition["new_row_count"] == 1, "SELFTEST_SINGLE_HOUR")
    require(one_transition["first_seen_observations"][0]["last_not_seen_at"] == previous["polled_at"], "SELFTEST_LAST_NOT_SEEN")

    batch_events = list(previous["recent_event_index"])
    for hour in range(6, 18):
        batch_events.append({"event_time": f"2026-08-11T{hour:02d}:00:00.000Z", "row_identity_hash": f"h{hour}", "row_variant_count": 1})
    batch = {**previous, "latest_event_time": "2026-08-11T17:00:00.000Z", "recent_event_index": batch_events}
    batch_transition = compare_state(config, previous, batch, "2026-08-11T20:00:00.000Z")
    require(batch_transition["shape"] == "MULTI_HOUR_FORWARD_BATCH" and batch_transition["new_row_count"] == 12, "SELFTEST_BATCH")
    require(batch_transition["availability_brackets_established"] == 12, "SELFTEST_BATCH_BRACKETS")

    revision = {**one, "recent_event_index": [{**item, "row_identity_hash": "h5-revised"} if item["event_time"] == "2026-08-11T05:00:00.000Z" else item for item in one["recent_event_index"]]}
    revision_transition = compare_state(config, one, revision, "2026-08-11T14:00:00.000Z")
    require(revision_transition["provider_revision_count"] == 1 and revision_transition["shape"] == "BACKFILL_OR_REVISION_ONLY", "SELFTEST_REVISION")

    history = [
        {"forward_new_row_count": 1, "latest_advanced_by_hours": 1},
        {"forward_new_row_count": 1, "latest_advanced_by_hours": 1},
        {"forward_new_row_count": 1, "latest_advanced_by_hours": 1},
    ]
    require(cadence_candidate(history, 3) == "HOURLY_INCREMENTAL_OBSERVED", "SELFTEST_HOURLY_CLASS")
    burst = [
        {"forward_new_row_count": 12, "latest_advanced_by_hours": 12},
        {"forward_new_row_count": 24, "latest_advanced_by_hours": 24},
        {"forward_new_row_count": 18, "latest_advanced_by_hours": 18},
    ]
    require(cadence_candidate(burst, 3) == "BATCHED_OR_BURSTY_OBSERVED", "SELFTEST_BURST_CLASS")
    result = {
        "schema_version": "geox_mcft_cap09_kbs_publication_cadence_observer_selftest_v1",
        "status": "PASS",
        "baseline_bracket_fabrication_forbidden": True,
        "single_hour_first_seen_bracket_verified": True,
        "multi_hour_batch_first_seen_brackets_verified": True,
        "provider_revision_metadata_verified": True,
        "minimum_three_transition_classification_verified": True,
        "daily_batch_authority_claimed": False,
        "raw_provider_values_emitted": False,
        "write_count": 0,
    }
    print(json.dumps(result, sort_keys=True))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", default=str(DEFAULT_OUTPUT))
    parser.add_argument("--previous-state")
    parser.add_argument("--restore-github-state", action="store_true")
    parser.add_argument("--selftest", action="store_true")
    args = parser.parse_args()
    if args.selftest:
        run_selftest()
        return
    run_poll(args)


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"[FAIL] {exc}", file=sys.stderr)
        raise
