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
USER_AGENT = "GEOX-MCFT-CAP09-KBS-CADENCE-OBSERVER/1.1"
STATE_SCHEMA = "geox_mcft_cap09_kbs_publication_cadence_state_v1"


def require(condition: bool, code: str) -> None:
    if not condition:
        raise RuntimeError(code)


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
    require(urlparse(url).scheme == "https", "KBS_CADENCE_HTTPS_REQUIRED")
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
    lines = body.decode("utf-8-sig").splitlines()
    for idx, line in enumerate(lines[:80]):
        for delim in (",", "\t", ";", "|"):
            cells = next(csv.reader([line], delimiter=delim))
            headers = [normalize_key(cell) for cell in cells]
            if not all(column in headers for column in required_columns):
                continue
            parsed = []
            for values in csv.reader(lines[idx + 1:], delimiter=delim):
                if len(values) < len(headers):
                    continue
                row = {header: values[pos] for pos, header in enumerate(headers)}
                parsed.append((row, sha256_json({header: row.get(header, "") for header in headers})))
            return idx, delim, parsed
    raise RuntimeError("KBS_CADENCE_RAW_HOURLY_HEADER_NOT_FOUND")


def build_snapshot(config: dict, body: bytes, headers: dict, final_url: str, polled_at: datetime):
    final = urlparse(final_url)
    source = config["source"]
    require(final.hostname == source["required_final_host"], "KBS_CADENCE_FINAL_HOST_DRIFT")
    require(final.path == source["required_final_path"], "KBS_CADENCE_FINAL_PATH_DRIFT")
    header_index, delimiter, rows = parse_kbs_csv(body, source["required_columns"])
    future_limit = polled_at + timedelta(minutes=int(config["polling"]["future_clock_skew_allowance_minutes"]))
    grouped: dict[str, set[str]] = {}
    valid_count = 0
    for row, row_hash in rows:
        timestamp = parse_provider_utc(row.get(source["event_time_field"], ""))
        if timestamp is None or timestamp > future_limit:
            continue
        valid_count += 1
        grouped.setdefault(iso(timestamp.replace(microsecond=0)), set()).add(row_hash)
    require(grouped, "KBS_CADENCE_VALID_EVENT_TIME_REQUIRED")
    event_times = sorted(grouped)
    latest = parse_iso(event_times[-1], "KBS_CADENCE_LATEST_INVALID")
    recent_start = latest - timedelta(hours=int(config["polling"]["recent_event_index_hours"]))
    recent = []
    for event_time in event_times:
        if parse_iso(event_time, "KBS_CADENCE_EVENT_INVALID") < recent_start:
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
    transitions = [item for item in history if int(item.get("forward_new_event_count", 0)) > 0]
    if len(transitions) < minimum:
        return "INSUFFICIENT_TRANSITIONS"
    recent = transitions[-minimum:]
    if all(item.get("forward_new_event_count") == 1 and item.get("latest_advanced_by_hours") == 1 for item in recent):
        return "HOURLY_INCREMENTAL_OBSERVED"
    if all((item.get("forward_new_event_count") or 0) >= 6 or (item.get("latest_advanced_by_hours") or 0) >= 6 for item in recent):
        return "BATCHED_OR_BURSTY_OBSERVED"
    return "VARIABLE_PUBLICATION_OBSERVED"


def baseline_transition():
    return {
        "shape": "BASELINE_SNAPSHOT",
        "baseline_only": True,
        "previous_polled_at": None,
        "previous_latest_event_time": None,
        "snapshot_changed": None,
        "parsed_row_count_delta": None,
        "new_event_count": 0,
        "new_row_count": 0,
        "forward_new_event_count": 0,
        "forward_new_row_count": 0,
        "backfill_event_count": 0,
        "backfill_row_count": 0,
        "provider_revision_count": 0,
        "disappeared_event_count": 0,
        "snapshot_changed_without_recent_event_delta": False,
        "new_event_min": None,
        "new_event_max": None,
        "latest_advanced_by_hours": None,
        "batch_id": None,
        "first_seen_observations": [],
        "provider_revision_observations": [],
        "availability_brackets_established": 0,
    }


def compare_state(config: dict, previous: dict | None, current: dict, polled_at: str):
    if previous is None:
        return baseline_transition()
    require(previous.get("schema_version") == STATE_SCHEMA, "KBS_CADENCE_PREVIOUS_SCHEMA_INVALID")
    require(previous.get("source_url") == config["source"]["url"], "KBS_CADENCE_PREVIOUS_SOURCE_DRIFT")
    previous_polled_at = previous["polled_at"]
    require(parse_iso(previous_polled_at, "KBS_CADENCE_PREVIOUS_POLL_INVALID") < parse_iso(polled_at, "KBS_CADENCE_CURRENT_POLL_INVALID"), "KBS_CADENCE_POLL_ORDER_INVALID")
    prev_index, cur_index = index_by_event(previous), index_by_event(current)
    prev_latest = previous["latest_event_time"]
    prev_latest_dt = parse_iso(prev_latest, "KBS_CADENCE_PREVIOUS_LATEST_INVALID")
    cur_latest_dt = parse_iso(current["latest_event_time"], "KBS_CADENCE_CURRENT_LATEST_INVALID")
    previous_window_start = parse_iso(previous["recent_window_start"], "KBS_CADENCE_PREVIOUS_WINDOW_INVALID")
    current_window_start = parse_iso(current["recent_window_start"], "KBS_CADENCE_CURRENT_WINDOW_INVALID")

    new_events = sorted(event for event in cur_index if event not in prev_index and parse_iso(event, "KBS_CADENCE_NEW_EVENT_INVALID") >= previous_window_start)
    forward = [event for event in new_events if parse_iso(event, "KBS_CADENCE_FORWARD_EVENT_INVALID") > prev_latest_dt]
    backfill = [event for event in new_events if parse_iso(event, "KBS_CADENCE_BACKFILL_EVENT_INVALID") <= prev_latest_dt]
    revisions = sorted(event for event in cur_index if event in prev_index and cur_index[event]["row_identity_hash"] != prev_index[event]["row_identity_hash"])
    disappeared = sorted(event for event in prev_index if event not in cur_index and parse_iso(event, "KBS_CADENCE_DISAPPEARED_EVENT_INVALID") >= current_window_start)
    brackets = [publication_bracket(event, previous_polled_at, polled_at) for event in new_events]
    revision_observations = [{
        "event_time": event,
        "previous_row_identity_hash": prev_index[event]["row_identity_hash"],
        "current_row_identity_hash": cur_index[event]["row_identity_hash"],
        "revision_last_not_seen_at": previous_polled_at,
        "revision_first_seen_at": polled_at,
    } for event in revisions]

    snapshot_changed = current.get("snapshot_sha256") != previous.get("snapshot_sha256")
    parsed_delta = int(current.get("parsed_row_count", 0)) - int(previous.get("parsed_row_count", 0))
    new_row_count = sum(int(cur_index[event].get("row_variant_count", 1)) for event in new_events)
    forward_row_count = sum(int(cur_index[event].get("row_variant_count", 1)) for event in forward)
    backfill_row_count = sum(int(cur_index[event].get("row_variant_count", 1)) for event in backfill)
    recent_delta = bool(new_events or revisions or disappeared)
    snapshot_only = bool(snapshot_changed and not recent_delta)
    latest_advance = (cur_latest_dt - prev_latest_dt).total_seconds() / 3600.0
    latest_advance_value = int(latest_advance) if float(latest_advance).is_integer() else round(latest_advance, 6)
    changed_aux = bool(backfill or revisions or disappeared)

    if not recent_delta:
        shape = "SNAPSHOT_CHANGED_OUTSIDE_RECENT_INDEX" if snapshot_changed else "NO_CHANGE"
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
        "snapshot_changed": snapshot_changed,
        "parsed_row_count_delta": parsed_delta,
        "new_event_count": len(new_events),
        "new_row_count": new_row_count,
        "forward_new_event_count": len(forward),
        "forward_new_row_count": forward_row_count,
        "forward_event_times": forward,
        "backfill_event_count": len(backfill),
        "backfill_row_count": backfill_row_count,
        "provider_revision_count": len(revisions),
        "disappeared_event_count": len(disappeared),
        "snapshot_changed_without_recent_event_delta": snapshot_only,
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



def build_publication_batch_profile(transition: dict):
    forward = sorted(transition.get("forward_event_times", []))
    if not forward:
        return None
    start = parse_iso(forward[0], "KBS_CADENCE_BATCH_START_INVALID")
    end = parse_iso(forward[-1], "KBS_CADENCE_BATCH_END_INVALID")
    expected = []
    cursor = start
    while cursor <= end:
        expected.append(iso(cursor))
        cursor += timedelta(hours=1)
    observed = set(forward)
    missing = [event for event in expected if event not in observed]
    brackets = [item for item in transition.get("first_seen_observations", []) if item.get("event_time") in observed]
    return {
        "batch_id": transition.get("batch_id"),
        "first_seen_at": brackets[0].get("first_seen_at") if brackets else None,
        "last_not_seen_at": brackets[0].get("last_not_seen_at") if brackets else None,
        "observation_time_start": forward[0],
        "observation_time_end": forward[-1],
        "forward_hour_count": len(forward),
        "expected_span_hour_count": len(expected),
        "missing_hour_count": len(missing),
        "missing_event_times": missing,
        "contiguous_hourly_coverage": len(missing) == 0 and len(forward) == len(expected),
        "expected_approximately_24_hours": 23 <= len(forward) <= 25,
        "provider_revision_count": int(transition.get("provider_revision_count", 0)),
        "backfill_event_count": int(transition.get("backfill_event_count", 0)),
        "shape": transition.get("shape"),
        "metadata_only": True,
    }



def nearest_rank(values: list[float], percentile: float):
    if not values:
        return None
    ordered = sorted(values)
    index = max(0, int((percentile * len(ordered) + 0.999999999)) - 1)
    return ordered[index]


def build_provider_cadence_profile(history: list[dict]):
    batches = [item.get("batch_profile") for item in history if item.get("batch_profile")]
    first_seen = sorted(parse_iso(item["first_seen_at"], "KBS_CADENCE_BATCH_FIRST_SEEN_INVALID") for item in batches if item.get("first_seen_at"))
    intervals = [(first_seen[index] - first_seen[index - 1]).total_seconds() / 3600.0 for index in range(1, len(first_seen))]
    publish_minutes = [value.hour * 60 + value.minute + value.second / 60.0 for value in first_seen]
    median_publish = nearest_rank(publish_minutes, 0.5)
    p95_publish = nearest_rank(publish_minutes, 0.95)
    jitter = (max(publish_minutes) - min(publish_minutes)) if len(publish_minutes) >= 2 else None
    return {
        "provider_expected_update_behavior": "DAILY_BATCH",
        "observed_batch_count": len(batches),
        "median_publish_minute_utc": median_publish,
        "p95_publish_minute_utc": p95_publish,
        "publish_time_jitter_minutes": jitter,
        "median_inter_batch_interval_hours": nearest_rank(intervals, 0.5),
        "p95_inter_batch_interval_hours": nearest_rank(intervals, 0.95),
        "machine_auditable_profile_only": True,
        "freshness_authority_effect": False,
    }


def make_state(config: dict, snapshot: dict, polled_at: str, previous: dict | None, predecessor: dict | None):
    transition = compare_state(config, previous, snapshot, polled_at)
    history = list(previous.get("publication_transition_history", [])) if previous else []
    if transition["shape"] not in {"BASELINE_SNAPSHOT", "NO_CHANGE"}:
        history.append({
            "polled_at": polled_at,
            "shape": transition["shape"],
            "forward_new_event_count": transition["forward_new_event_count"],
            "forward_new_row_count": transition["forward_new_row_count"],
            "backfill_event_count": transition["backfill_event_count"],
            "provider_revision_count": transition["provider_revision_count"],
            "latest_advanced_by_hours": transition["latest_advanced_by_hours"],
            "batch_id": transition["batch_id"],
            "new_event_min": transition["new_event_min"],
            "new_event_max": transition["new_event_max"],
            "forward_event_times": transition["forward_event_times"],
            "batch_profile": build_publication_batch_profile(transition),
        })
    history = history[-50:]
    publication_transitions = len([item for item in history if int(item.get("forward_new_event_count", 0)) > 0])
    current_batch_profile = build_publication_batch_profile(transition)
    latest_batch_profile = current_batch_profile or (previous.get("latest_publication_batch_profile") if previous else None)
    provider_cadence_profile = build_provider_cadence_profile(history)
    return {
        "schema_version": STATE_SCHEMA,
        "status": "PASS",
        "subject_sha": os.environ.get("MCFT_SUBJECT_SHA") or os.environ.get("GITHUB_SHA"),
        "source_url": config["source"]["url"],
        "source_authority_role": config["source"]["authority_role"],
        "polled_at": polled_at,
        "predecessor_state": predecessor,
        **snapshot,
        "transition": transition,
        "publication_transition_history": history,
        "publication_transition_count": publication_transitions,
        "provider_expected_update_behavior": "DAILY_BATCH",
        "provider_operating_profile": config["operating_profile"]["provider_operating_profile"],
        "provider_operating_profile_authority_effect": False,
        "provider_operating_behavior_confirmation_is_freshness_authority": False,
        "latest_publication_batch_profile": latest_batch_profile,
        "provider_cadence_profile": provider_cadence_profile,
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
        "formal_execution_count": "0/24",
    }


def run_poll(args):
    config = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
    polled_at = datetime.now(timezone.utc)
    status, headers, body, final_url = request_bytes(config["source"]["url"], int(config["polling"]["max_response_bytes"]))
    require(status == 200, f"KBS_CADENCE_HTTP_STATUS:{status}")
    snapshot = build_snapshot(config, body, headers, final_url, polled_at)
    previous = None
    predecessor = None
    if args.previous_state:
        previous = json.loads(Path(args.previous_state).read_text(encoding="utf-8"))
        predecessor = {"mode": "LOCAL_FILE"}
    elif args.restore_github_state:
        previous, predecessor = restore_github_state(config)
    state = make_state(config, snapshot, iso(polled_at), previous, predecessor)
    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(state, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(json.dumps(state, sort_keys=True))


def fake_state(latest: str, events: list[tuple[str, str]], polled_at: str, snapshot: str, parsed_count: int):
    latest_dt = parse_iso(latest, "SELFTEST_LATEST_INVALID")
    recent_start = latest_dt - timedelta(hours=240)
    recent = [{"event_time": event, "row_identity_hash": row_hash, "row_variant_count": 1} for event, row_hash in sorted(events)]
    return {
        "schema_version": STATE_SCHEMA,
        "source_url": "https://lter.kbs.msu.edu/datatables/13.csv",
        "polled_at": polled_at,
        "snapshot_sha256": snapshot,
        "parsed_row_count": parsed_count,
        "latest_event_time": latest,
        "recent_window_start": iso(recent_start),
        "recent_event_index": recent,
        "publication_transition_history": [],
    }


def run_selftest():
    config = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
    previous = fake_state("2026-08-11T05:00:00.000Z", [("2026-08-11T05:00:00.000Z", "h5")], "2026-08-11T12:00:00.000Z", "sha256:a", 100)
    baseline = compare_state(config, None, previous, previous["polled_at"])
    require(baseline["baseline_only"] and baseline["availability_brackets_established"] == 0, "SELFTEST_BASELINE_BRACKET_FORBIDDEN")

    one_events = [("2026-08-11T05:00:00.000Z", "h5"), ("2026-08-11T06:00:00.000Z", "h6")]
    one = fake_state("2026-08-11T06:00:00.000Z", one_events, "2026-08-11T13:00:00.000Z", "sha256:b", 101)
    one_transition = compare_state(config, previous, one, one["polled_at"])
    require(one_transition["shape"] == "SINGLE_NEW_EVENT_HOUR", "SELFTEST_SINGLE_SHAPE")
    require(one_transition["new_event_count"] == 1 and one_transition["new_row_count"] == 1, "SELFTEST_SINGLE_COUNTS")
    require(one_transition["snapshot_changed"] and one_transition["parsed_row_count_delta"] == 1, "SELFTEST_SINGLE_SNAPSHOT")
    require(one_transition["first_seen_observations"][0]["last_not_seen_at"] == previous["polled_at"], "SELFTEST_LAST_NOT_SEEN")

    batch_events = [("2026-08-11T05:00:00.000Z", "h5")] + [(f"2026-08-11T{hour:02d}:00:00.000Z", f"h{hour}") for hour in range(6, 18)]
    batch = fake_state("2026-08-11T17:00:00.000Z", batch_events, "2026-08-11T20:00:00.000Z", "sha256:c", 112)
    batch_transition = compare_state(config, previous, batch, batch["polled_at"])
    require(batch_transition["shape"] == "MULTI_HOUR_FORWARD_BATCH", "SELFTEST_BATCH_SHAPE")
    require(batch_transition["new_event_count"] == 12 and batch_transition["availability_brackets_established"] == 12, "SELFTEST_BATCH_COUNTS")
    batch_profile = build_publication_batch_profile(batch_transition)
    require(batch_profile["contiguous_hourly_coverage"] and batch_profile["forward_hour_count"] == 12 and batch_profile["missing_hour_count"] == 0, "SELFTEST_BATCH_PROFILE")

    revised_events = [("2026-08-11T05:00:00.000Z", "h5-revised"), ("2026-08-11T06:00:00.000Z", "h6")]
    revision = fake_state("2026-08-11T06:00:00.000Z", revised_events, "2026-08-11T14:00:00.000Z", "sha256:d", 101)
    revision_transition = compare_state(config, one, revision, revision["polled_at"])
    require(revision_transition["provider_revision_count"] == 1 and revision_transition["shape"] == "BACKFILL_OR_REVISION_ONLY", "SELFTEST_REVISION")

    outside_only = fake_state("2026-08-11T06:00:00.000Z", one_events, "2026-08-11T14:00:00.000Z", "sha256:e", 101)
    outside_transition = compare_state(config, one, outside_only, outside_only["polled_at"])
    require(outside_transition["shape"] == "SNAPSHOT_CHANGED_OUTSIDE_RECENT_INDEX" and outside_transition["snapshot_changed_without_recent_event_delta"], "SELFTEST_SNAPSHOT_ONLY")

    hourly_history = [{"forward_new_event_count": 1, "latest_advanced_by_hours": 1}] * 3
    burst_history = [
        {"forward_new_event_count": 12, "latest_advanced_by_hours": 12},
        {"forward_new_event_count": 24, "latest_advanced_by_hours": 24},
        {"forward_new_event_count": 18, "latest_advanced_by_hours": 18},
    ]
    require(cadence_candidate(hourly_history, 3) == "HOURLY_INCREMENTAL_OBSERVED", "SELFTEST_HOURLY_CLASS")
    require(cadence_candidate(burst_history, 3) == "BATCHED_OR_BURSTY_OBSERVED", "SELFTEST_BURST_CLASS")
    print(json.dumps({
        "schema_version": "geox_mcft_cap09_kbs_publication_cadence_observer_selftest_v1",
        "status": "PASS",
        "baseline_bracket_fabrication_forbidden": True,
        "single_hour_first_seen_bracket_verified": True,
        "multi_hour_batch_first_seen_brackets_verified": True,
        "batch_completeness_and_continuity_profile_verified": True,
        "provider_revision_metadata_verified": True,
        "snapshot_only_change_visible": True,
        "row_and_event_counts_separated": True,
        "minimum_three_transition_classification_verified": True,
        "daily_batch_authority_claimed": False,
        "raw_provider_values_emitted": False,
        "write_count": 0,
    }, sort_keys=True))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", default=str(DEFAULT_OUTPUT))
    parser.add_argument("--previous-state")
    parser.add_argument("--restore-github-state", action="store_true")
    parser.add_argument("--selftest", action="store_true")
    args = parser.parse_args()
    if args.selftest:
        run_selftest()
    else:
        run_poll(args)


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"[FAIL] {exc}", file=sys.stderr)
        raise
