#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import importlib.util
import io
import json
import math
import re
import sys
import tarfile
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path.cwd()
EA4_PATH = ROOT / "scripts/runtime_acceptance/PROBE_MCFT_CAP_09_EA4_LIVE_SOURCE_EXACT_HEAD_QUALIFICATION.py"
SPEC = importlib.util.spec_from_file_location("mcft_cap09_ea4_live", EA4_PATH)
if SPEC is None or SPEC.loader is None:
    raise RuntimeError("EA5E2_LIVE_EA4_MODULE_LOAD_FAILED")
ea4 = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(ea4)

GFS_WEATHER_BINDING = "noaa_ncep_gfs_pgrb2_kbs_nearest_72h_v1"
GFS_ET0_BINDING = "noaa_ncep_gfs_asce_short_reference_et_same_cycle_72h_v1"
RAIN_BINDING = "kbs_lter_raw_hourly_rain_mm_v1"
HIST_ET0_BINDING = "kbs_lter_asce_short_reference_et_hourly_v1"
SOURCE_MATRIX_REF = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S6-FORMAL-SOURCE-BINDING-MATRIX-V1.json"
AMENDMENT04_REF = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-04-GFS-SFLUX-INSTANTANEOUS-PIECEWISE-LINEAR-SOLAR-AUTHORITY.md"
ET0_CANONICAL_DECIMALS = 12
ET0_DECIMAL_NORMALIZATION_ID = "DECIMAL_HALF_AWAY_FROM_ZERO_12_V1"


def require(condition: bool, code: str) -> None:
    if not condition:
        raise RuntimeError(code)


def canonical_decimal_half_away_from_zero(value: float, decimals: int) -> float:
    require(math.isfinite(value), "EA5E2_CANONICAL_DECIMAL_NONFINITE")
    require(isinstance(decimals, int) and 0 <= decimals <= 12, "EA5E2_CANONICAL_DECIMAL_SCALE_INVALID")
    factor = 10 ** decimals
    scaled = abs(value) * factor
    rounded = math.floor(scaled + 0.5 + sys.float_info.epsilon * scaled)
    result = (-1.0 if value < 0 else 1.0) * rounded / factor
    return 0.0 if result == 0 else result


def iso(value: datetime) -> str:
    return value.astimezone(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def parse_iso(value: str, code: str) -> datetime:
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as exc:
        raise RuntimeError(code) from exc
    require(parsed.tzinfo is not None, code)
    return parsed.astimezone(timezone.utc)


def canonical_hour(value: str, code: str) -> datetime:
    parsed = parse_iso(value, code)
    require(parsed.minute == 0 and parsed.second == 0 and parsed.microsecond == 0, code)
    return parsed


def sha256_bytes(body: bytes) -> str:
    return "sha256:" + hashlib.sha256(body).hexdigest()


def sha256_json(value) -> str:
    return sha256_bytes(json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=True).encode("utf-8"))


def select_complete_gfs_cycle(tick: datetime):
    """Select the newest cycle whose PGRB2 and SFLUX inventories are both complete."""
    rejections = []
    for cycle in ea4.candidate_cycles(tick):
        lead_start = int((tick - cycle).total_seconds() // 3600) + 1
        lead_end = lead_start + ea4.POINT_COUNT - 1
        support = lead_start - 1
        if support < 0 or lead_end > ea4.MAX_LEAD:
            continue
        try:
            url = ea4.directory_url(cycle)
            status, _, body, final_url = ea4.request_bytes(url, "EA5E2_GFS_DIRECTORY", 20_000_000)
            require(status == 200, f"EA5E2_GFS_DIRECTORY_HTTP_{status}")
            final = urlparse(final_url)
            require(final.hostname == "nomads.ncep.noaa.gov" and final.path == urlparse(url).path, "EA5E2_GFS_DIRECTORY_IDENTITY_DRIFT")
            ea4.retain_raw("GFS_DIRECTORY_LISTING", iso(cycle), body)
            entries = ea4.parse_directory(body)
            for lead in range(support, lead_end + 1):
                for name in ea4.pgrb2_names(cycle, lead):
                    match = entries.get(name, [])
                    require(len(match) == 1 and match[0]["size"] > 0, f"EA5E2_PGRB2_DIRECTORY_ENTRY_MISSING:{name}")
                    require(match[0]["upper"] <= tick, f"EA5E2_PGRB2_DIRECTORY_ENTRY_AFTER_TARGET:{name}")
            for lead in range(support, lead_end + 1):
                for name in ea4.sflux_names(cycle, lead):
                    match = entries.get(name, [])
                    require(len(match) == 1 and match[0]["size"] > 0, f"EA5E2_SFLUX_DIRECTORY_ENTRY_MISSING:{name}")
                    require(match[0]["upper"] <= tick, f"EA5E2_SFLUX_DIRECTORY_ENTRY_AFTER_TARGET:{name}")
            return {
                "cycle": cycle,
                "lead_start": lead_start,
                "lead_end": lead_end,
                "support": support,
                "directory_sha256": sha256_bytes(body),
                "rejections": rejections,
            }
        except Exception as exc:
            # A partially published newest cycle is not a terminal selection.
            # Keep searching for an older complete same-cycle PGRB2+SFLUX set.
            rejections.append({"cycle": iso(cycle), "reason": str(exc)[:240]})
    raise RuntimeError("EA5E2_NO_COMPLETE_GFS_CYCLE:" + json.dumps(rejections, separators=(",", ":")))


def safe_name(value: str) -> str:
    return re.sub(r"[^0-9A-Za-z]+", "_", value).strip("_").lower()


def add_tar_bytes(tar: tarfile.TarFile, name: str, body: bytes) -> None:
    info = tarfile.TarInfo(name=name)
    info.size = len(body)
    info.mtime = 0
    info.mode = 0o600
    tar.addfile(info, io.BytesIO(body))


def load_tar(path: Path) -> tuple[dict, dict[str, bytes]]:
    members: dict[str, bytes] = {}
    with tarfile.open(path, "r") as tar:
        for member in tar.getmembers():
            if not member.isfile():
                continue
            extracted = tar.extractfile(member)
            require(extracted is not None, f"EA5E2_LIVE_TAR_MEMBER_READ:{member.name}")
            members[member.name] = extracted.read()
    require("manifest.json" in members, "EA5E2_LIVE_GFS_MANIFEST_REQUIRED")
    manifest = json.loads(members.pop("manifest.json").decode("utf-8"))
    return manifest, members


def observe_kbs_raw_hourly(minimum_operational_headroom_minutes: float, enforce_current_authority: bool) -> dict:
    requested_at = datetime.now(timezone.utc)
    status, _, body, final = ea4.request_bytes(
        ea4.AUTH["kbs"]["raw_hourly_csv"],
        "EA5E2_LIVE_PRECHECK_KBS_HOURLY",
        110_000_000,
        {"Accept": "text/csv,text/plain;q=0.9,*/*;q=0.5"},
    )
    require(status == 200, "EA5E2_LIVE_PRECHECK_KBS_HTTP")
    retrieved_at = datetime.now(timezone.utc)
    parsed_final = urlparse(final)
    require(parsed_final.hostname == "lter.kbs.msu.edu" and parsed_final.path == "/datatables/13.csv", "EA5E2_LIVE_PRECHECK_KBS_IDENTITY")
    rows = ea4.parse_kbs_csv(body)
    timestamps = []
    for row in rows:
        timestamp = ea4.parse_provider_utc(row.get("datetime_utc", ""))
        if timestamp is not None and timestamp <= retrieved_at + timedelta(minutes=5):
            timestamps.append(timestamp)
    require(timestamps, "EA5E2_LIVE_PRECHECK_KBS_TIMESTAMP_REQUIRED")
    latest = max(timestamps)
    age_hours = (retrieved_at - latest).total_seconds() / 3600.0
    maximum = float(ea4.AUTH["kbs"]["raw_hourly_latest_max_age_hours"])
    minimum_headroom_minutes = max(0.0, float(minimum_operational_headroom_minutes))
    remaining_headroom_minutes = (maximum - age_hours) * 60.0
    authority_pass = age_hours <= maximum
    headroom_pass = authority_pass and remaining_headroom_minutes >= minimum_headroom_minutes
    if enforce_current_authority:
        require(authority_pass, f"EA5E2_LIVE_PRECHECK_KBS_STALE:{age_hours:.6f}")
        require(
            headroom_pass,
            f"EA5E2_LIVE_PRECHECK_KBS_OPERATIONAL_HEADROOM_INSUFFICIENT:{remaining_headroom_minutes:.3f}:{minimum_headroom_minutes:.3f}",
        )
    return {
        "status": "PASS" if enforce_current_authority else "OBSERVED",
        "requested_at": iso(requested_at),
        "retrieved_at": iso(retrieved_at),
        "freshness_evaluated_at": iso(retrieved_at),
        "latest_raw_hourly_timestamp": iso(latest),
        "latest_age_hours": round(age_hours, 6),
        "configured_max_age_hours": maximum,
        "remaining_authority_headroom_minutes": round(remaining_headroom_minutes, 3),
        "minimum_operational_headroom_minutes": minimum_headroom_minutes,
        "production_authority_pass": authority_pass,
        "operational_headroom_pass": headroom_pass,
        "operational_headroom_is_authority": False,
        "phase_aware_planning_only": not enforce_current_authority,
        "late_actual_retrieval_must_reprove_authority": not enforce_current_authority,
        "raw_values_emitted": False,
    }


def command_precheck(args: argparse.Namespace) -> None:
    print(json.dumps(observe_kbs_raw_hourly(args.minimum_operational_headroom_minutes, True), sort_keys=True))


def command_inspect_kbs(_args: argparse.Namespace) -> None:
    print(json.dumps(observe_kbs_raw_hourly(0.0, False), sort_keys=True))


def select_complete_kbs_timing_target(rows: list[dict], observed_at: datetime) -> dict:
    by_timestamp: dict[datetime, list[dict]] = {}
    for row in rows:
        timestamp = ea4.parse_provider_utc(row.get("datetime_utc", ""))
        if timestamp is not None and timestamp <= observed_at + timedelta(minutes=5):
            by_timestamp.setdefault(timestamp, []).append(row)
    require(by_timestamp, "EA5E2_TIMING_TARGET_KBS_TIMESTAMP_REQUIRED")
    latest = max(by_timestamp)
    selected = None
    skipped = 0
    for timestamp in sorted(by_timestamp, reverse=True):
        if timestamp < latest - timedelta(hours=23) or timestamp.minute != 0 or timestamp.second != 0 or timestamp.microsecond != 0:
            continue
        timestamp_rows = by_timestamp[timestamp]
        if len(timestamp_rows) != 1:
            skipped += 1
            continue
        row = timestamp_rows[0]
        rain = ea4.finite(row.get("rain_mm"))
        air = ea4.finite(row.get("airtmp_107_avg"))
        actual_vapor_pressure = ea4.finite(row.get("ah"))
        solar = ea4.finite(row.get("solrad_avg"))
        wind = ea4.finite(row.get("wind_speed"))
        valid = (
            rain is not None and 0 <= rain <= 100
            and air is not None and -50 <= air <= 60
            and actual_vapor_pressure is not None and 0 < actual_vapor_pressure <= 10
            and solar is not None and 0 <= solar <= 1600
            and wind is not None and 0 <= wind <= 100
        )
        if valid:
            et0 = ea4.scalar_eto(air, actual_vapor_pressure, solar * ea4.SOLAR_FACTOR, wind * ea4.WIND_FACTOR, timestamp)
            valid = math.isfinite(et0)
        if valid:
            selected = timestamp
            break
        skipped += 1
    require(selected is not None, "EA5E2_TIMING_TARGET_NO_COMPLETE_EXACT_ROW_IN_LATEST_BATCH")
    return {"latest": latest, "selected": selected, "skipped": skipped}


def command_select_kbs_timing_target(_args: argparse.Namespace) -> None:
    requested_at = datetime.now(timezone.utc)
    status, _, body, final = ea4.request_bytes(
        ea4.AUTH["kbs"]["raw_hourly_csv"],
        "EA5E2_TIMING_TARGET_KBS_HOURLY",
        110_000_000,
        {"Accept": "text/csv,text/plain;q=0.9,*/*;q=0.5"},
    )
    require(status == 200, "EA5E2_TIMING_TARGET_KBS_HTTP")
    retrieved_at = datetime.now(timezone.utc)
    parsed_final = urlparse(final)
    require(parsed_final.hostname == "lter.kbs.msu.edu" and parsed_final.path == "/datatables/13.csv", "EA5E2_TIMING_TARGET_KBS_IDENTITY")
    selection = select_complete_kbs_timing_target(ea4.parse_kbs_csv(body), retrieved_at)
    latest = selection["latest"]
    selected = selection["selected"]
    age_hours = (retrieved_at - latest).total_seconds() / 3600.0
    maximum = float(ea4.AUTH["kbs"]["raw_hourly_latest_max_age_hours"])
    require(age_hours <= maximum, f"EA5E2_TIMING_TARGET_KBS_STALE:{age_hours:.6f}")
    print(json.dumps({
        "schema_version": "geox_mcft_cap09_ea5e2_timing_target_selection_v1",
        "status": "PASS",
        "requested_at": iso(requested_at),
        "retrieved_at": iso(retrieved_at),
        "latest_raw_hourly_timestamp": iso(latest),
        "latest_age_hours": round(age_hours, 6),
        "configured_max_age_hours": maximum,
        "selected_target_t": iso(selected),
        "selected_target_lag_hours_from_latest": (latest - selected).total_seconds() / 3600.0,
        "skipped_newer_incomplete_or_duplicate_row_count": selection["skipped"],
        "selection_scope": "QUALIFICATION_TIMING_ONLY_NOT_LIVE_TARGET_ADMISSION",
        "same_source_exact_t_decoder_still_required": True,
        "authority_effect": False,
        "raw_values_emitted": False,
    }, sort_keys=True))


def command_selftest_kbs_timing_target(_args: argparse.Namespace) -> None:
    observed_at = datetime(2026, 8, 13, 7, 30, tzinfo=timezone.utc)

    def row(hour: int, rain: str = "0.2") -> dict:
        return {
            "datetime_utc": f"2026-08-13 {hour:02d}:00:00",
            "rain_mm": rain,
            "airtmp_107_avg": "24.0",
            "ah": "1.8",
            "solrad_avg": "150.0",
            "wind_speed": "2.5",
        }

    newest_incomplete = select_complete_kbs_timing_target([row(4, ""), row(3)], observed_at)
    require(newest_incomplete["latest"].hour == 4, "EA5E2_TIMING_TARGET_SELFTEST_LATEST_SOURCE_REQUIRED")
    require(newest_incomplete["selected"].hour == 3, "EA5E2_TIMING_TARGET_SELFTEST_PREVIOUS_COMPLETE_REQUIRED")
    require(newest_incomplete["skipped"] == 1, "EA5E2_TIMING_TARGET_SELFTEST_INCOMPLETE_SKIP_REQUIRED")

    newest_duplicate = select_complete_kbs_timing_target([row(4), row(4), row(3)], observed_at)
    require(newest_duplicate["selected"].hour == 3, "EA5E2_TIMING_TARGET_SELFTEST_DUPLICATE_SKIP_REQUIRED")
    require(newest_duplicate["skipped"] == 1, "EA5E2_TIMING_TARGET_SELFTEST_DUPLICATE_COUNT_REQUIRED")

    fail_closed = False
    try:
        select_complete_kbs_timing_target([row(4, ""), row(3, "invalid")], observed_at)
    except RuntimeError as exc:
        fail_closed = str(exc) == "EA5E2_TIMING_TARGET_NO_COMPLETE_EXACT_ROW_IN_LATEST_BATCH"
    require(fail_closed, "EA5E2_TIMING_TARGET_SELFTEST_NO_COMPLETE_ROW_MUST_FAIL")

    print(json.dumps({
        "status": "PASS",
        "cases": 3,
        "newest_incomplete_row_skipped": True,
        "duplicate_exact_timestamp_skipped": True,
        "no_complete_row_failed_closed": True,
        "live_target_admission_changed": False,
        "provider_request_count": 0,
        "database_write_count": 0,
    }, sort_keys=True))


def command_fetch_gfs(args: argparse.Namespace) -> None:
    target = canonical_hour(args.target, "EA5E2_LIVE_GFS_TARGET_INVALID")
    requested_at = datetime.now(timezone.utc)
    request_lock = threading.Lock()
    request_count = 0
    original_request = ea4.request_bytes
    selection_raw: list[tuple[str, str, bytes]] = []

    def counted_request(*pos, **kw):
        nonlocal request_count
        with request_lock:
            request_count += 1
        return original_request(*pos, **kw)

    def capture_retention(kind: str, identity: str, body: bytes) -> dict:
        selection_raw.append((kind, identity, bytes(body)))
        return {
            "kind": kind,
            "identity_sha256": sha256_bytes(identity.encode("utf-8")),
            "sha256": sha256_bytes(body),
            "bytes": len(body),
        }

    ea4.request_bytes = counted_request
    ea4.retain_raw = capture_retention
    selected = select_complete_gfs_cycle(target)
    cycle = selected["cycle"]
    leads = list(range(selected["support"], selected["lead_end"] + 1))
    raw_members: list[dict] = []
    raw_bodies: dict[str, bytes] = {}

    for index, (kind, identity, body) in enumerate(selection_raw):
        name = f"selection/{index:02d}_{safe_name(kind)}.raw"
        raw_bodies[name] = body
        raw_members.append({
            "name": name,
            "kind": kind,
            "identity_sha256": sha256_bytes(identity.encode("utf-8")),
            "sha256": sha256_bytes(body),
            "bytes": len(body),
        })

    def fetch_pgrb2(lead: int):
        url = ea4.filter_url(cycle, lead)
        status, _, body, final_url = ea4.request_bytes(url, f"EA5E2_LIVE_PGRB2_F{lead:03d}", 20_000_000)
        require(status == 200, f"EA5E2_LIVE_PGRB2_HTTP:{lead}")
        final = urlparse(final_url)
        require(final.hostname == "nomads.ncep.noaa.gov" and final.path == "/cgi-bin/filter_gfs_0p25.pl", f"EA5E2_LIVE_PGRB2_IDENTITY:{lead}")
        require(body.startswith(b"GRIB"), f"EA5E2_LIVE_PGRB2_NOT_GRIB:{lead}")
        return lead, body

    def fetch_sflux(lead: int):
        grib_url, idx_url = ea4.sflux_urls(cycle, lead)
        status, headers, idx_body, _ = ea4.request_bytes(
            idx_url,
            f"EA5E2_LIVE_SFLUX_IDX_F{lead:03d}",
            ea4.MAX_IDX_BYTES,
            {"Accept": "text/plain,*/*;q=0.5"},
        )
        require(status == 200, f"EA5E2_LIVE_SFLUX_IDX_HTTP:{lead}")
        require(ea4.http_last_modified(headers, f"EA5E2_LIVE_SFLUX_IDX_F{lead:03d}") <= target, f"EA5E2_LIVE_SFLUX_IDX_AFTER_TARGET:{lead}")
        selected_range = ea4.parse_sflux_idx(idx_body.decode("utf-8"), lead)
        range_header = f"bytes={selected_range['offset']}-{selected_range['end']}"
        status, headers, message, _ = ea4.request_bytes(
            grib_url,
            f"EA5E2_LIVE_SFLUX_RANGE_F{lead:03d}",
            ea4.MAX_SFLUX_MESSAGE_BYTES,
            {"Range": range_header},
        )
        require(status == 206, f"EA5E2_LIVE_SFLUX_RANGE_HTTP:{lead}")
        content_range = headers.get("Content-Range", "")
        match = re.fullmatch(r"bytes\s+(\d+)-(\d+)/(\d+)", content_range)
        require(bool(match) and int(match.group(1)) == selected_range["offset"] and int(match.group(2)) == selected_range["end"], f"EA5E2_LIVE_SFLUX_CONTENT_RANGE:{lead}")
        require(ea4.http_last_modified(headers, f"EA5E2_LIVE_SFLUX_RANGE_F{lead:03d}") <= target, f"EA5E2_LIVE_SFLUX_RANGE_AFTER_TARGET:{lead}")
        require(len(message) == selected_range["length"] and message.startswith(b"GRIB") and message.endswith(b"7777"), f"EA5E2_LIVE_SFLUX_MESSAGE_BOUNDARY:{lead}")
        return lead, idx_body, message, selected_range["line_sha256"]

    with ThreadPoolExecutor(max_workers=ea4.CONCURRENCY) as pool:
        futures = [pool.submit(fetch_pgrb2, lead) for lead in leads]
        for future in as_completed(futures):
            lead, body = future.result()
            name = f"pgrb2/f{lead:03d}.grib2"
            raw_bodies[name] = body
            raw_members.append({"name": name, "kind": "GFS_PGRB2_FILTER_RESPONSE", "lead": lead, "sha256": sha256_bytes(body), "bytes": len(body)})

    idx_line_hashes = []
    with ThreadPoolExecutor(max_workers=ea4.CONCURRENCY) as pool:
        futures = [pool.submit(fetch_sflux, lead) for lead in leads]
        for future in as_completed(futures):
            lead, idx_body, message, line_sha = future.result()
            idx_name = f"sflux/f{lead:03d}.idx"
            msg_name = f"sflux/f{lead:03d}.grib2"
            raw_bodies[idx_name] = idx_body
            raw_bodies[msg_name] = message
            raw_members.append({"name": idx_name, "kind": "GFS_SFLUX_IDX", "lead": lead, "sha256": sha256_bytes(idx_body), "bytes": len(idx_body)})
            raw_members.append({"name": msg_name, "kind": "GFS_SFLUX_EXACT_GRIB_MESSAGE", "lead": lead, "sha256": sha256_bytes(message), "bytes": len(message)})
            idx_line_hashes.append({"lead": lead, "line_sha256": line_sha})

    retrieved_at = datetime.now(timezone.utc)
    raw_members.sort(key=lambda item: item["name"])
    manifest = {
        "schema_version": "geox_mcft_cap09_ea5e2_gfs_raw_bundle_v1",
        "target_logical_time": iso(target),
        "selected_cycle": iso(cycle),
        "lead_start": selected["lead_start"],
        "lead_end": selected["lead_end"],
        "support_lead": selected["support"],
        "requested_at": iso(requested_at),
        "retrieved_at": iso(retrieved_at),
        "provider_request_count": request_count,
        "directory_rejection_count": len(selected["rejections"]),
        "member_count": len(raw_members),
        "member_chain_sha256": sha256_json(raw_members),
        "idx_selected_line_chain_sha256": sha256_json(sorted(idx_line_hashes, key=lambda item: item["lead"])),
        "members": raw_members,
    }
    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    with tarfile.open(output, "w") as tar:
        add_tar_bytes(tar, "manifest.json", json.dumps(manifest, sort_keys=True, separators=(",", ":")).encode("utf-8"))
        for name in sorted(raw_bodies):
            add_tar_bytes(tar, name, raw_bodies[name])
    bundle = output.read_bytes()
    safe = {
        "status": "PASS",
        "target_logical_time": iso(target),
        "selected_cycle": iso(cycle),
        "lead_start": selected["lead_start"],
        "lead_end": selected["lead_end"],
        "support_lead": selected["support"],
        "requested_at": iso(requested_at),
        "retrieved_at": iso(retrieved_at),
        "provider_request_count": request_count,
        "raw_provider_object_count": len(raw_members),
        "raw_bundle_sha256": sha256_bytes(bundle),
        "raw_bundle_bytes": len(bundle),
        "raw_member_chain_sha256": manifest["member_chain_sha256"],
        "raw_values_emitted": False,
    }
    Path(args.meta).write_text(json.dumps(safe, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(json.dumps(safe, sort_keys=True))


def command_probe_gfs(args: argparse.Namespace) -> None:
    """Read-only directory probe for one complete PGRB2+SFLUX cycle."""
    target = canonical_hour(args.target, "EA5E2_GFS_READINESS_TARGET_INVALID")
    requested_at = datetime.now(timezone.utc)
    retained: list[dict] = []

    def metadata_only_retention(kind: str, identity: str, body: bytes) -> dict:
        item = {
            "kind": kind,
            "identity_sha256": sha256_bytes(identity.encode("utf-8")),
            "sha256": sha256_bytes(body),
            "bytes": len(body),
        }
        retained.append(item)
        return item

    original_retention = ea4.retain_raw
    ea4.retain_raw = metadata_only_retention
    try:
        selected = select_complete_gfs_cycle(target)
    finally:
        ea4.retain_raw = original_retention
    retrieved_at = datetime.now(timezone.utc)
    proof = {
        "schema_version": "geox_mcft_cap09_ea5e2_gfs_same_cycle_readiness_v1",
        "status": "PASS",
        "target_logical_time": iso(target),
        "requested_at": iso(requested_at),
        "retrieved_at": iso(retrieved_at),
        "selected_cycle": iso(selected["cycle"]),
        "lead_start": selected["lead_start"],
        "lead_end": selected["lead_end"],
        "support_lead": selected["support"],
        "same_cycle_pgrb2_sflux_complete": True,
        "newer_incomplete_cycle_rejection_count": len(selected["rejections"]),
        "selection_directory_count": len(retained),
        "selection_directory_chain_sha256": sha256_json(retained),
        "raw_provider_body_retained": False,
        "raw_values_emitted": False,
        "database_write_count": 0,
        "canonical_write_count": 0,
    }
    Path(args.output).parent.mkdir(parents=True, exist_ok=True)
    Path(args.output).write_text(json.dumps(proof, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(json.dumps(proof, sort_keys=True))


def command_selftest_gfs_selection(_args: argparse.Namespace) -> None:
    target = datetime(2026, 8, 13, 12, tzinfo=timezone.utc)
    newest = datetime(2026, 8, 13, 6, tzinfo=timezone.utc)
    older = datetime(2026, 8, 13, 0, tzinfo=timezone.utc)
    originals = {
        "candidate_cycles": ea4.candidate_cycles,
        "request_bytes": ea4.request_bytes,
        "parse_directory": ea4.parse_directory,
        "retain_raw": ea4.retain_raw,
    }

    def inventory(cycle: datetime, complete: bool) -> dict:
        lead_start = int((target - cycle).total_seconds() // 3600) + 1
        lead_end = lead_start + ea4.POINT_COUNT - 1
        support = lead_start - 1
        entry = {"upper": target - timedelta(minutes=1), "size": 1024}
        values = {}
        for lead in range(support, lead_end + 1):
            for name in (*ea4.pgrb2_names(cycle, lead), *ea4.sflux_names(cycle, lead)):
                values[name] = [entry]
        if not complete:
            values.pop(ea4.sflux_names(cycle, support)[0])
        return values

    inventories = {b"newest": inventory(newest, False), b"older": inventory(older, True)}
    try:
        ea4.candidate_cycles = lambda _tick: [newest, older]

        def fake_request(url, *_pos, **_kw):
            body = b"newest" if "/06/" in url else b"older"
            return 200, {}, body, url

        ea4.request_bytes = fake_request
        ea4.parse_directory = lambda body: inventories[body]
        ea4.retain_raw = lambda *_pos, **_kw: {"metadata_only": True}
        selected = select_complete_gfs_cycle(target)
    finally:
        for name, value in originals.items():
            setattr(ea4, name, value)

    require(selected["cycle"] == older, "EA5E2_GFS_SELFTEST_OLDER_COMPLETE_CYCLE_REQUIRED")
    require(len(selected["rejections"]) == 1, "EA5E2_GFS_SELFTEST_NEWEST_PARTIAL_REJECTION_REQUIRED")
    require("EA5E2_SFLUX_DIRECTORY_ENTRY_MISSING" in selected["rejections"][0]["reason"], "EA5E2_GFS_SELFTEST_PARTIAL_REASON_DRIFT")
    print(json.dumps({
        "status": "PASS",
        "cases": 1,
        "newest_partial_cycle_rejected": True,
        "older_complete_same_cycle_selected": True,
        "provider_request_count": 0,
        "database_write_count": 0,
    }, sort_keys=True))


def command_selftest_et0_decimal_normalization(_args: argparse.Namespace) -> None:
    require(canonical_decimal_half_away_from_zero(0.1234567890124, 12) == 0.123456789012, "EA5E2_ET0_DECIMAL_ROUND_DOWN")
    require(canonical_decimal_half_away_from_zero(0.1234567890125, 12) == 0.123456789013, "EA5E2_ET0_DECIMAL_POSITIVE_HALF_TIE")
    require(canonical_decimal_half_away_from_zero(-0.1234567890125, 12) == -0.123456789013, "EA5E2_ET0_DECIMAL_NEGATIVE_HALF_TIE")
    require(canonical_decimal_half_away_from_zero(-0.0000000000001, 12) == 0.0, "EA5E2_ET0_DECIMAL_NEGATIVE_ZERO")
    left = canonical_decimal_half_away_from_zero(0.12345678901234, ET0_CANONICAL_DECIMALS)
    right = canonical_decimal_half_away_from_zero(0.12345678901236, ET0_CANONICAL_DECIMALS)
    require(left == right == 0.123456789012, "EA5E2_ET0_DECIMAL_SUBQUANTUM_DRIFT")
    print(json.dumps({
        "status": "PASS",
        "normalization_id": ET0_DECIMAL_NORMALIZATION_ID,
        "decimal_places": ET0_CANONICAL_DECIMALS,
        "positive_half_tie": "PASS",
        "negative_half_tie": "PASS",
        "negative_zero_normalized": True,
        "subquantum_drift_collapsed": True,
        "raw_values_emitted": False,
    }, sort_keys=True))


def command_decode_gfs(args: argparse.Namespace) -> None:
    normalize_et0 = bool(getattr(args, "normalize_et0", False))
    target = canonical_hour(args.target, "EA5E2_LIVE_GFS_DECODE_TARGET_INVALID")
    available_at = parse_iso(args.available_at, "EA5E2_LIVE_GFS_AVAILABLE_AT_INVALID")
    manifest, members = load_tar(Path(args.input))
    require(manifest.get("target_logical_time") == iso(target), "EA5E2_LIVE_GFS_BUNDLE_TARGET_MISMATCH")
    cycle = parse_iso(manifest["selected_cycle"], "EA5E2_LIVE_GFS_CYCLE_INVALID")
    support = int(manifest["support_lead"])
    lead_start = int(manifest["lead_start"])
    lead_end = int(manifest["lead_end"])
    leads = list(range(support, lead_end + 1))
    targets = list(range(lead_start, lead_end + 1))
    require(len(targets) == 72 and len(leads) == 73, "EA5E2_LIVE_GFS_LEAD_CARDINALITY")

    by_lead = {}
    for lead in leads:
        body = members[f"pgrb2/f{lead:03d}.grib2"]
        by_lead[lead] = ea4.decode_pgrb2(body, cycle, lead)
    weather = {"temperature_c": [], "rh_percent": [], "wind_2m": [], "precip_mm": []}
    duplicate_collapses = 0
    for lead in targets:
        temp = ea4.instant(by_lead[lead], "T2", lead)
        rh = ea4.instant(by_lead[lead], "RH2", lead)
        u = ea4.instant(by_lead[lead], "U10", lead)
        v = ea4.instant(by_lead[lead], "V10", lead)
        precip, collapsed = ea4.apcp(by_lead[lead], lead)
        duplicate_collapses += collapsed
        require(180 <= temp["value"] <= 330 and 0 <= rh["value"] <= 100 and abs(u["value"]) <= 100 and abs(v["value"]) <= 100, "EA5E2_LIVE_GFS_RAW_SANITY")
        length = lead - ea4.block_start(lead)
        if length == 1:
            hourly_precip = precip["value"]
        else:
            previous, _ = ea4.apcp(by_lead[lead - 1], lead - 1)
            require(previous["start_step"] == precip["start_step"], f"EA5E2_LIVE_GFS_APCP_CROSS_BLOCK:{lead}")
            hourly_precip = precip["value"] - previous["value"]
        require(math.isfinite(hourly_precip) and 0 <= hourly_precip <= 200, f"EA5E2_LIVE_GFS_APCP_HOURLY_INVALID:{lead}")
        valid = cycle + timedelta(hours=lead)
        weather["temperature_c"].append((valid, temp["value"] - 273.15))
        weather["rh_percent"].append((valid, rh["value"]))
        weather["wind_2m"].append((valid, math.hypot(u["value"], v["value"]) * ea4.WIND_FACTOR))
        weather["precip_mm"].append((valid, hourly_precip))

    expected = [target + timedelta(hours=index) for index in range(1, 73)]
    for name, points in weather.items():
        require(len(points) == 72 and [time for time, _ in points] == expected, f"EA5E2_LIVE_GFS_SERIES_ALIGNMENT:{name}")

    sflux = {}
    for lead in leads:
        message = members[f"sflux/f{lead:03d}.grib2"]
        sflux[lead] = ea4.decode_sflux(message, cycle, lead)
    require(len(sflux) == 73, "EA5E2_LIVE_GFS_SFLUX_ENDPOINT_COUNT")
    solar = []
    for lead in targets:
        value = (sflux[lead - 1]["value"] + sflux[lead]["value"]) / 2 * ea4.SOLAR_FACTOR
        require(math.isfinite(value) and value >= 0, f"EA5E2_LIVE_GFS_SOLAR_INTERVAL_INVALID:{lead}")
        solar.append((cycle + timedelta(hours=lead), value))
    require([time for time, _ in solar] == expected, "EA5E2_LIVE_GFS_SOLAR_ALIGNMENT")

    temp_map = dict(weather["temperature_c"])
    rh_map = dict(weather["rh_percent"])
    wind_map = dict(weather["wind_2m"])
    solar_map = dict(solar)
    future_et0 = []
    for valid in expected:
        temperature = temp_map[valid]
        rh = rh_map[valid]
        actual_vapor_pressure = (rh / 100.0) * 0.6108 * math.exp(17.27 * temperature / (temperature + 237.3))
        et0 = ea4.scalar_eto(temperature, actual_vapor_pressure, solar_map[valid], wind_map[valid], valid)
        require(math.isfinite(et0), "EA5E2_LIVE_GFS_ET0_NONFINITE")
        future_et0.append((
            valid,
            canonical_decimal_half_away_from_zero(et0, ET0_CANONICAL_DECIMALS) if normalize_et0 else et0,
        ))

    decoded_at = datetime.now(timezone.utc)
    require(available_at <= decoded_at, "EA5E2_LIVE_GFS_DECODE_BEFORE_AVAILABLE")
    issued_at = iso(cycle)
    valid_to = iso(target + timedelta(hours=72))
    weather_points = []
    et0_points = []
    for index, valid in enumerate(expected):
        start = valid - timedelta(hours=1)
        weather_points.append({
            "horizon": index + 1,
            "valid_from": iso(start),
            "valid_to": iso(valid),
            "precipitation_mm": weather["precip_mm"][index][1],
            "air_temperature_c": weather["temperature_c"][index][1],
            "relative_humidity_percent": weather["rh_percent"][index][1],
            "wind_speed_2m_m_s": weather["wind_2m"][index][1],
        })
        et0_points.append({
            "horizon": index + 1,
            "valid_from": iso(start),
            "valid_to": iso(valid),
            "et0_mm_per_hour": future_et0[index][1],
        })

    common_source_payload = {
        "provider": "NOAA_NCEP_NOMADS",
        "model": "GFS",
        "selected_cycle": issued_at,
        "target_logical_time": iso(target),
        "lead_start": lead_start,
        "lead_end": lead_end,
        "support_lead": support,
        "raw_provider_object_count": int(manifest["member_count"]),
        "raw_member_chain_sha256": manifest["member_chain_sha256"],
        "pgrb2_grid_latitude": ea4.GRID_LAT,
        "pgrb2_grid_longitude_native": ea4.GRID_LON,
        "sflux_native_index": int(ea4.AUTH["gfs"]["solar_native_index"]),
    }
    time_key = target.strftime("%Y%m%dT%H%M%SZ").lower()
    cycle_key = cycle.strftime("%Y%m%dT%H%M%SZ").lower()
    et0_quality = {
        "status": "LIMITED",
        "point_count": 72,
        "solar_temporal_method": "PIECEWISE_LINEAR_ENDPOINT_INTEGRATION_V1",
    }
    et0_limitations = ["MODEL_DERIVED_FORECAST_ASSUMPTION", "SFLUX_SOLAR_PIECEWISE_LINEAR_LIMITED"]
    if normalize_et0:
        et0_quality.update({
            "et0_decimal_normalization_id": ET0_DECIMAL_NORMALIZATION_ID,
            "et0_decimal_places": ET0_CANONICAL_DECIMALS,
        })
        et0_limitations.append("CANONICAL_ET0_DECIMAL_HALF_AWAY_FROM_ZERO_12")
    drafts = [
        {
            "role": "FUTURE_WEATHER_ASSUMPTION",
            "source_record_id": f"gfs_future_weather_{cycle_key}_{time_key}",
            "binding_id": GFS_WEATHER_BINDING,
            "origin_source_kind": "NOAA_NCEP_NOMADS_GFS",
            "origin_source_id": f"gfs_{cycle_key}_pgrb2_0p25_kbs",
            "epistemic_class": "ASSUMED",
            "available_to_runtime_at": iso(available_at),
            "role_time": {
                "issued_at": issued_at,
                "retrieved_at": iso(available_at),
                "available_to_runtime_at": iso(available_at),
                "ingested_at": iso(decoded_at),
                "valid_from": iso(target),
                "valid_to": valid_to,
            },
            "quality": {"status": "PASS", "point_count": 72, "apcp_semantic_duplicate_collapse_count": duplicate_collapses},
            "source_payload": common_source_payload,
            "canonical_payload": {"snapshot_kind": "FUTURE_WEATHER_ASSUMPTION", "points": weather_points},
            "source_unit": "GFS_NATIVE_MIXED",
            "canonical_unit": "mm_and_meteorological_support",
            "conversion_rule": {
                "conversion_rule_id": "GFS_PGRB2_72H_KBS_NEAREST_AND_APCP_BLOCK_DIFFERENCE_V1",
                "conversion_rule_version": "1",
                "authority_ref": SOURCE_MATRIX_REF,
            },
            "source_binding_version": 1,
            "limitations": ["NEAR_SITE_MODEL_GRID_POINT_SUPPORT", "DIRECT_FIELD_EQUIVALENCE_FALSE"],
        },
        {
            "role": "FUTURE_ET0_ASSUMPTION",
            "source_record_id": f"gfs_future_et0_{cycle_key}_{time_key}",
            "binding_id": GFS_ET0_BINDING,
            "origin_source_kind": "NOAA_NCEP_NOMADS_GFS_DERIVED",
            "origin_source_id": f"gfs_{cycle_key}_asce_short_reference_et0_kbs",
            "epistemic_class": "ASSUMED",
            "available_to_runtime_at": iso(available_at),
            "role_time": {
                "issued_at": issued_at,
                "retrieved_at": iso(available_at),
                "available_to_runtime_at": iso(available_at),
                "ingested_at": iso(decoded_at),
                "valid_from": iso(target),
                "valid_to": valid_to,
            },
            "quality": et0_quality,
            "source_payload": {**common_source_payload, "algorithm_id": "ASCE_STANDARDIZED_REFERENCE_ET_SHORT_HOURLY_V1", "qualification_oracle": "refet-0.4.2-asce"},
            "canonical_payload": {"snapshot_kind": "FUTURE_ET0_ASSUMPTION", "points": et0_points},
            "source_unit": "GFS_METEOROLOGICAL_INPUTS",
            "canonical_unit": "mm_per_hour",
            "conversion_rule": {
                "conversion_rule_id": "ASCE_SHORT_REFERENCE_ET0_GFS_SAME_CYCLE_WITH_SFLUX_PWL_SOLAR_V1",
                "conversion_rule_version": "1",
                "authority_ref": AMENDMENT04_REF,
            },
            "source_binding_version": 1,
            "limitations": et0_limitations,
        },
    ]
    Path(args.output).write_text(json.dumps({"drafts": drafts}, separators=(",", ":")) + "\n", encoding="utf-8")
    print(json.dumps({
        "status": "PASS",
        "target_logical_time": iso(target),
        "selected_cycle": issued_at,
        "draft_count": 2,
        "weather_point_count": len(weather_points),
        "et0_point_count": len(et0_points),
        "raw_values_emitted": False,
    }, sort_keys=True))


def command_decode_kbs_late(args: argparse.Namespace) -> None:
    target = canonical_hour(args.target, "EA5E2_LIVE_KBS_TARGET_INVALID")
    available_at = parse_iso(args.available_at, "EA5E2_LIVE_KBS_AVAILABLE_AT_INVALID")
    raw = Path(args.input).read_bytes()
    rows = ea4.parse_kbs_csv(raw)
    parsed = []
    for row in rows:
        timestamp = ea4.parse_provider_utc(row.get("datetime_utc", ""))
        if timestamp is not None and timestamp <= available_at + timedelta(minutes=5):
            parsed.append((timestamp, row))
    require(parsed, "EA5E2_LIVE_KBS_TIMESTAMPED_REQUIRED")
    parsed.sort(key=lambda item: item[0])
    latest = parsed[-1][0]
    age_hours = (available_at - latest).total_seconds() / 3600.0
    require(age_hours <= float(ea4.AUTH["kbs"]["raw_hourly_latest_max_age_hours"]), f"EA5E2_LIVE_KBS_SOURCE_STALE:{age_hours:.6f}")
    matches = [row for timestamp, row in parsed if timestamp == target]
    require(len(matches) == 1, f"EA5E2_LIVE_KBS_EXACT_TARGET_ROW_REQUIRED:{len(matches)}")
    row = matches[0]
    rain = ea4.finite(row.get("rain_mm"))
    require(rain is not None and 0 <= rain <= 100, "EA5E2_LIVE_KBS_TARGET_RAIN_INVALID")
    air = ea4.finite(row.get("airtmp_107_avg"))
    actual_vapor_pressure = ea4.finite(row.get("ah"))
    solar = ea4.finite(row.get("solrad_avg"))
    wind = ea4.finite(row.get("wind_speed"))
    require(None not in (air, actual_vapor_pressure, solar, wind), "EA5E2_LIVE_KBS_TARGET_ET0_INPUT_MISSING")
    require(-50 <= air <= 60 and 0 < actual_vapor_pressure <= 10 and 0 <= solar <= 1600 and 0 <= wind <= 100, "EA5E2_LIVE_KBS_TARGET_ET0_INPUT_RANGE")
    et0 = ea4.scalar_eto(air, actual_vapor_pressure, solar * ea4.SOLAR_FACTOR, wind * ea4.WIND_FACTOR, target)
    require(math.isfinite(et0), "EA5E2_LIVE_KBS_TARGET_ET0_NONFINITE")
    decoded_at = datetime.now(timezone.utc)
    interval_start = target - timedelta(hours=1)
    key = target.strftime("%Y%m%dT%H%M%SZ").lower()
    drafts = [
        {
            "role": "RAINFALL_OBSERVATION",
            "source_record_id": f"kbs_raw_hourly_rain_{key}",
            "binding_id": RAIN_BINDING,
            "origin_source_kind": "KBS_LTER_RAW_HOURLY_WEATHER",
            "origin_source_id": "KBS002-007.142:rain_mm",
            "epistemic_class": "OBSERVED",
            "available_to_runtime_at": iso(available_at),
            "role_time": {"interval_start": iso(interval_start), "interval_end": iso(target), "ingested_at": iso(decoded_at)},
            "quality": {"status": "PASS", "provider_latest_age_hours": round(age_hours, 6)},
            "source_payload": {"provider_table_id": "KBS002-007.142", "source_column": "rain_mm", "spatial_support": "NEAR_SITE_METEOROLOGICAL_SUPPORT"},
            "canonical_payload": {"value": rain, "unit": "mm"},
            "source_unit": "mm",
            "canonical_unit": "mm",
            "conversion_rule": {"conversion_rule_id": "KBS_RAW_HOURLY_RAIN_MM_IDENTITY_V1", "conversion_rule_version": "1", "authority_ref": SOURCE_MATRIX_REF},
            "source_binding_version": 1,
            "limitations": ["NEAR_SITE_METEOROLOGICAL_SUPPORT", "FIELD_POINT_PRECIPITATION_TRUTH_NOT_CLAIMED"],
        },
        {
            "role": "HISTORICAL_ET0_INPUT",
            "source_record_id": f"kbs_asce_short_reference_et0_{key}",
            "binding_id": HIST_ET0_BINDING,
            "origin_source_kind": "KBS_LTER_RAW_HOURLY_DERIVED",
            "origin_source_id": "KBS002-007.142:ASCE_SHORT_REFERENCE_ET0",
            "epistemic_class": "ESTIMATED",
            "available_to_runtime_at": iso(available_at),
            "role_time": {"interval_start": iso(interval_start), "interval_end": iso(target), "ingested_at": iso(decoded_at), "calculation_method": "ASCE_STANDARDIZED_REFERENCE_ET_SHORT_HOURLY_V1", "method_version": "refet-0.4.2"},
            "quality": {"status": "PASS", "provider_latest_age_hours": round(age_hours, 6), "negative_clipping_performed": False},
            "source_payload": {"provider_table_id": "KBS002-007.142", "input_columns": ["airtmp_107_avg", "ah", "solrad_avg", "wind_speed"], "wind_10m_to_2m_factor": ea4.WIND_FACTOR, "solar_w_m2_to_mj_m2_h_factor": ea4.SOLAR_FACTOR, "station_elevation_m": float(ea4.AUTH["kbs"]["elevation_m"])},
            "canonical_payload": {"value": et0, "unit": "mm", "rate_unit": "mm_per_hour", "calculation_method": "ASCE_STANDARDIZED_REFERENCE_ET_SHORT_HOURLY_V1", "method_version": "refet-0.4.2"},
            "source_unit": "KBS_HOURLY_METEOROLOGICAL_INPUTS",
            "canonical_unit": "mm",
            "conversion_rule": {"conversion_rule_id": "ASCE_STANDARDIZED_REFERENCE_ET_SHORT_HOURLY_V1", "conversion_rule_version": "refet-0.4.2", "authority_ref": SOURCE_MATRIX_REF},
            "source_binding_version": 1,
            "limitations": ["REFERENCE_ET_ESTIMATE_NOT_FIELD_ET", "NO_SILENT_IMPUTATION", "NO_NEGATIVE_CLIPPING"],
        },
    ]
    Path(args.output).write_text(json.dumps({"drafts": drafts}, separators=(",", ":")) + "\n", encoding="utf-8")
    print(json.dumps({
        "status": "PASS",
        "target_logical_time": iso(target),
        "provider_latest_timestamp": iso(latest),
        "provider_latest_age_hours": round(age_hours, 6),
        "draft_count": 2,
        "raw_values_emitted": False,
    }, sort_keys=True))


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest="command", required=True)
    precheck = sub.add_parser("precheck-kbs")
    precheck.add_argument("--minimum-operational-headroom-minutes", type=float, default=0.0)
    precheck.set_defaults(handler=command_precheck)
    inspect_kbs = sub.add_parser("inspect-kbs")
    inspect_kbs.set_defaults(handler=command_inspect_kbs)
    timing_target = sub.add_parser("select-kbs-timing-target")
    timing_target.set_defaults(handler=command_select_kbs_timing_target)
    selftest_timing_target = sub.add_parser("selftest-kbs-timing-target")
    selftest_timing_target.set_defaults(handler=command_selftest_kbs_timing_target)
    fetch_gfs = sub.add_parser("fetch-gfs")
    fetch_gfs.add_argument("--target", required=True)
    fetch_gfs.add_argument("--output", required=True)
    fetch_gfs.add_argument("--meta", required=True)
    fetch_gfs.set_defaults(handler=command_fetch_gfs)
    probe_gfs = sub.add_parser("probe-gfs")
    probe_gfs.add_argument("--target", required=True)
    probe_gfs.add_argument("--output", required=True)
    probe_gfs.set_defaults(handler=command_probe_gfs)
    selftest_gfs = sub.add_parser("selftest-gfs-selection")
    selftest_gfs.set_defaults(handler=command_selftest_gfs_selection)
    selftest_et0_decimal = sub.add_parser("selftest-et0-decimal-normalization")
    selftest_et0_decimal.set_defaults(handler=command_selftest_et0_decimal_normalization)
    for command, normalize_et0 in (("decode-gfs", False), ("decode-gfs-v2", True)):
        decode_gfs = sub.add_parser(command)
        decode_gfs.add_argument("--target", required=True)
        decode_gfs.add_argument("--available-at", required=True)
        decode_gfs.add_argument("--input", required=True)
        decode_gfs.add_argument("--output", required=True)
        decode_gfs.set_defaults(handler=command_decode_gfs, normalize_et0=normalize_et0)
    decode_kbs = sub.add_parser("decode-kbs-late")
    decode_kbs.add_argument("--target", required=True)
    decode_kbs.add_argument("--available-at", required=True)
    decode_kbs.add_argument("--input", required=True)
    decode_kbs.add_argument("--output", required=True)
    decode_kbs.set_defaults(handler=command_decode_kbs_late)
    return parser


def main() -> None:
    args = build_parser().parse_args()
    args.handler(args)


if __name__ == "__main__":
    main()
