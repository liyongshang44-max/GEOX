#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import json
import os
import re
import subprocess
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path
from typing import Any
from urllib.error import HTTPError
from urllib.request import Request, urlopen

ROOT = Path.cwd()
AUTHORITY_PATH = ROOT / "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA1O-B-SFLUX-SOURCE-SPATIAL-QUALIFICATION-V1.json"
EA1K_RESULT_PATH = ROOT / "acceptance-output/MCFT_CAP_09_EA1K_GFS_EXACT_CYCLE_72H_AUTHORITY_RESULT.json"
OUTPUT_PATH = ROOT / "acceptance-output/MCFT_CAP_09_EA1O_B_SFLUX_SOURCE_SPATIAL_QUALIFICATION_RESULT.json"
USER_AGENT = "GEOX-MCFT-CAP09-EA1O-B-SFLUX-ADJUDICATION/2.0"
REQUEST_TIMEOUT = 45
MAX_IDX_BYTES = 2_000_000
CONCURRENCY = 8


def sha256_bytes(value: bytes) -> str:
    return "sha256:" + hashlib.sha256(value).hexdigest()


def sha256_text(value: str) -> str:
    return sha256_bytes(value.encode("utf-8"))


def require(condition: bool, code: str) -> None:
    if not condition:
        raise RuntimeError(code)


def safe_error(exc: BaseException) -> str:
    value = f"{type(exc).__name__}:{exc}"
    value = re.sub(r"https?://\S+", "[URL_REDACTED]", value)
    return value[:800]


def git(*args: str) -> str:
    return subprocess.check_output(["git", *args], cwd=ROOT, text=True).strip()


def parse_iso(value: str) -> datetime:
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    require(parsed.tzinfo is not None, "EA1OB_TIMEZONE_REQUIRED")
    return parsed.astimezone(timezone.utc)


def http_time(headers: Any, code: str) -> datetime:
    raw = headers.get("Last-Modified")
    require(bool(raw), f"{code}_LAST_MODIFIED_REQUIRED")
    parsed = parsedate_to_datetime(raw)
    require(parsed.tzinfo is not None, f"{code}_LAST_MODIFIED_TZ_REQUIRED")
    return parsed.astimezone(timezone.utc)


def fetch_bytes(url: str, code: str, max_bytes: int) -> tuple[bytes, Any, int]:
    request = Request(url, headers={"User-Agent": USER_AGENT, "Accept": "text/plain,*/*;q=0.5"}, method="GET")
    with urlopen(request, timeout=REQUEST_TIMEOUT) as response:
        status = int(getattr(response, "status", 200))
        data = response.read(max_bytes + 1)
        require(len(data) <= max_bytes, f"{code}_BODY_TOO_LARGE")
        return data, response.headers, status


def object_last_modified(url: str, code: str) -> datetime:
    request = Request(url, headers={"User-Agent": USER_AGENT}, method="HEAD")
    try:
        with urlopen(request, timeout=REQUEST_TIMEOUT) as response:
            return http_time(response.headers, code)
    except HTTPError as exc:
        if exc.code not in (403, 405):
            raise
    request = Request(url, headers={"User-Agent": USER_AGENT, "Range": "bytes=0-0"}, method="GET")
    with urlopen(request, timeout=REQUEST_TIMEOUT) as response:
        require(int(getattr(response, "status", 200)) == 206, f"{code}_RANGE0_REQUIRED")
        require(len(response.read(2)) == 1, f"{code}_RANGE0_LENGTH_REQUIRED")
        return http_time(response.headers, code)


def cycle_parts(cycle: datetime) -> tuple[str, str]:
    return cycle.strftime("%Y%m%d"), cycle.strftime("%H")


def sflux_urls(authority: dict[str, Any], cycle: datetime, lead: int) -> tuple[str, str]:
    ymd, hour = cycle_parts(cycle)
    filename = f"gfs.t{hour}z.sfluxgrbf{lead:03d}.grib2"
    base = f"{authority['source_candidate']['production_root']}/gfs.{ymd}/{hour}/atmos/{filename}"
    return base, base + authority["source_candidate"]["index_object_suffix"]


def parse_surface_dswrf(text: str, lead: int) -> dict[str, Any]:
    descriptors: list[str] = []
    descriptor_hashes: list[str] = []
    average_windows: list[int] = []
    direct_1h_count = 0
    n_hour_fcst_count = 0
    unsupported_count = 0
    expected_fcst = f"{lead} hour fcst"

    for raw in text.splitlines():
        line = raw.strip()
        if not line:
            continue
        parts = line.split(":")
        if len(parts) < 5 or not parts[1].isdigit():
            continue
        try:
            var_index = parts.index("DSWRF")
        except ValueError:
            continue
        if var_index + 2 >= len(parts) or parts[var_index + 1] != "surface":
            continue
        descriptor = parts[var_index + 2].strip().lower()
        descriptors.append(descriptor)
        descriptor_hashes.append(sha256_text(line))
        if descriptor == expected_fcst:
            n_hour_fcst_count += 1
            continue
        match = re.fullmatch(r"(\d+)-(\d+) hour ave fcst", descriptor)
        if not match:
            unsupported_count += 1
            continue
        start_step = int(match.group(1))
        end_step = int(match.group(2))
        require(end_step == lead, f"EA1OB_F{lead:03d}_AVERAGE_END_STEP_DRIFT_{end_step}")
        require(start_step < end_step, f"EA1OB_F{lead:03d}_AVERAGE_WINDOW_NONPOSITIVE")
        window = end_step - start_step
        average_windows.append(window)
        if window == 1 and start_step == lead - 1:
            direct_1h_count += 1

    require(len(descriptors) >= 2, f"EA1OB_F{lead:03d}_SURFACE_DSWRF_RECORDS_REQUIRED")
    require(len(average_windows) == 1, f"EA1OB_F{lead:03d}_SURFACE_DSWRF_AVERAGE_RECORD_COUNT_{len(average_windows)}")
    require(n_hour_fcst_count == 1, f"EA1OB_F{lead:03d}_N_HOUR_FCST_RECORD_COUNT_{n_hour_fcst_count}")
    require(unsupported_count == 0, f"EA1OB_F{lead:03d}_UNSUPPORTED_DSWRF_DESCRIPTOR_COUNT_{unsupported_count}")
    return {
        "direct_1h_count": direct_1h_count,
        "average_window_hours": average_windows[0],
        "n_hour_fcst_count": n_hour_fcst_count,
        "descriptor_chain_sha256": sha256_text("\n".join(descriptor_hashes)),
    }


def fetch_lead_inventory(authority: dict[str, Any], cycle: datetime, lead: int, tick: datetime) -> dict[str, Any]:
    grib_url, idx_url = sflux_urls(authority, cycle, lead)
    idx_bytes, idx_headers, idx_status = fetch_bytes(idx_url, f"EA1OB_F{lead:03d}_IDX", MAX_IDX_BYTES)
    require(idx_status == 200, f"EA1OB_F{lead:03d}_IDX_HTTP_{idx_status}")
    idx_modified = http_time(idx_headers, f"EA1OB_F{lead:03d}_IDX")
    grib_modified = object_last_modified(grib_url, f"EA1OB_F{lead:03d}_GRIB")
    require(idx_modified <= tick, f"EA1OB_F{lead:03d}_IDX_PUBLISHED_AFTER_TICK")
    require(grib_modified <= tick, f"EA1OB_F{lead:03d}_GRIB_PUBLISHED_AFTER_TICK")
    text = idx_bytes.decode("utf-8")
    require(not re.match(r"^\s*<(?:!doctype|html)", text, re.I), f"EA1OB_F{lead:03d}_IDX_HTML_FORBIDDEN")
    semantics = parse_surface_dswrf(text, lead)
    return {
        "lead": lead,
        "idx_sha256": sha256_bytes(idx_bytes),
        "idx_modified": idx_modified,
        "grib_modified": grib_modified,
        **semantics,
    }


def main() -> None:
    subject_sha = os.environ.get("MCFT_SUBJECT_SHA", "").strip()
    require(bool(re.fullmatch(r"[0-9a-f]{40}", subject_sha)), "EA1OB_EXACT_SUBJECT_SHA_REQUIRED")
    require(git("rev-parse", "HEAD") == subject_sha, "EA1OB_SUBJECT_SHA_NOT_CHECKED_OUT_HEAD")

    authority = json.loads(AUTHORITY_PATH.read_text(encoding="utf-8"))
    require(authority["base_main_sha"] == "ce38bc250fb9ddb1aabd0475baafc85939046695", "EA1OB_BASE_MAIN_DRIFT")
    require(authority["source_candidate"]["required_statistical_semantics"] == "DIRECT_PRECEDING_ONE_HOUR_AVERAGE", "EA1OB_REQUIRED_SEMANTICS_DRIFT")
    require(authority["source_candidate"]["rolling_average_reconstruction_authorized"] is False, "EA1OB_RECONSTRUCTION_MUST_REMAIN_FORBIDDEN")

    ea1k = json.loads(EA1K_RESULT_PATH.read_text(encoding="utf-8"))
    require(ea1k.get("status") == "PASS", "EA1OB_EA1K_LIVE_CHRONOLOGY_PASS_REQUIRED")
    require(ea1k.get("subject_sha") == subject_sha, "EA1OB_EA1K_SUBJECT_SHA_MISMATCH")
    tick = parse_iso(ea1k["qualification_tick_boundary_utc"])
    selected_cycle = ea1k["selected_cycle"]
    cycle = parse_iso(selected_cycle["issued_at_utc"])
    lead_start = int(selected_cycle["lead_start"])
    lead_end = int(selected_cycle["lead_end"])
    require(int(selected_cycle["canonical_point_count"]) == 72, "EA1OB_EA1K_72_POINTS_REQUIRED")
    require(lead_end - lead_start + 1 == 72, "EA1OB_EA1K_LEAD_SPAN_REQUIRED")
    leads = list(range(lead_start, lead_end + 1))

    inventories: list[dict[str, Any]] = []
    with ThreadPoolExecutor(max_workers=CONCURRENCY) as pool:
        futures = {pool.submit(fetch_lead_inventory, authority, cycle, lead, tick): lead for lead in leads}
        for future in as_completed(futures):
            inventories.append(future.result())
    inventories.sort(key=lambda item: item["lead"])
    require([item["lead"] for item in inventories] == leads, "EA1OB_INVENTORY_LEAD_ORDER_MISMATCH")

    direct_leads = [item["lead"] for item in inventories if item["direct_1h_count"] == 1]
    non_direct_leads = [item["lead"] for item in inventories if item["direct_1h_count"] == 0]
    direct_count = len(direct_leads)
    multi_hour_count = sum(1 for item in inventories if item["average_window_hours"] > 1)
    window_set = sorted({item["average_window_hours"] for item in inventories})
    forbidden_fcst_presence_count = sum(item["n_hour_fcst_count"] for item in inventories)

    discovery = authority["live_discovery_evidence"]
    require(direct_count == discovery["direct_preceding_1h_count_expected_on_reproof"], f"EA1OB_DIRECT_1H_REPROOF_COUNT_DRIFT_{direct_count}")
    require(multi_hour_count == discovery["multi_hour_average_count_expected_on_reproof"], f"EA1OB_MULTI_HOUR_REPROOF_COUNT_DRIFT_{multi_hour_count}")
    require(window_set == discovery["average_window_length_hours_set_expected_on_reproof"], f"EA1OB_WINDOW_SET_DRIFT_{window_set}")
    require(direct_count < 72, "EA1OB_REJECTION_PRECONDITION_NO_LONGER_TRUE")
    require(direct_count + multi_hour_count == 72, "EA1OB_AVERAGE_CLASSIFICATION_NOT_EXHAUSTIVE")
    require(forbidden_fcst_presence_count == 72, f"EA1OB_N_HOUR_FCST_PRESENCE_COUNT_{forbidden_fcst_presence_count}")

    last_modified_values = [item["idx_modified"] for item in inventories] + [item["grib_modified"] for item in inventories]
    idx_chain = sha256_text("\n".join(item["idx_sha256"] for item in inventories))
    descriptor_chain = sha256_text("\n".join(item["descriptor_chain_sha256"] for item in inventories))

    result = {
        "schema_version": "geox_mcft_cap09_ea1o_b_sflux_direct_1h_source_adjudication_result_v2",
        "status": "PASS",
        "subject_sha": subject_sha,
        "probe_observed_at_utc": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "qualification_tick_boundary_utc": tick.isoformat().replace("+00:00", "Z"),
        "same_cycle_binding": {
            "ea1k_selected_cycle_utc": cycle.isoformat().replace("+00:00", "Z"),
            "sflux_selected_cycle_utc": cycle.isoformat().replace("+00:00", "Z"),
            "same_exact_gfs_cycle": True,
            "lead_start": lead_start,
            "lead_end": lead_end,
            "canonical_point_count": 72
        },
        "source_semantics_evidence": {
            "required_statistical_semantics": "DIRECT_PRECEDING_ONE_HOUR_AVERAGE",
            "required_direct_1h_record_count": 72,
            "observed_direct_1h_average_record_count": direct_count,
            "observed_multi_hour_average_record_count": multi_hour_count,
            "average_window_length_hours_set": window_set,
            "n_hour_fcst_record_presence_count": forbidden_fcst_presence_count,
            "all_72_source_objects_available_before_tick": True,
            "minimum_object_last_modified_utc": min(last_modified_values).isoformat().replace("+00:00", "Z"),
            "maximum_object_last_modified_utc": max(last_modified_values).isoformat().replace("+00:00", "Z"),
            "idx_chain_sha256": idx_chain,
            "surface_dswrf_descriptor_chain_sha256": descriptor_chain,
            "direct_1h_lead_set_sha256": sha256_text("\n".join(str(value) for value in direct_leads)),
            "non_direct_1h_lead_set_sha256": sha256_text("\n".join(str(value) for value in non_direct_leads)),
            "raw_idx_emitted": False,
            "raw_grib_message_emitted": False,
            "decoded_values_emitted": False
        },
        "adjudication": {
            "decision": "REJECTED_AS_AMENDMENT02_DIRECT_1H_SOURCE_AUTHORITY",
            "reason": "DIRECT_PRECEDING_ONE_HOUR_COVERAGE_IS_12_OF_72_NOT_72_OF_72",
            "sflux_source_authority_candidate_qualified": False,
            "sflux_spatial_authority_candidate_qualified": False,
            "spatial_stage_disposition": "NOT_REACHED_SOURCE_SEMANTICS_FAIL_CLOSED",
            "value_stage_disposition": "NOT_REACHED_SOURCE_SEMANTICS_FAIL_CLOSED",
            "expanding_window_weighted_difference_used": False,
            "rolling_average_reconstruction_used": False,
            "n_hour_fcst_used_as_interval_average": False,
            "pgrb2_fallback_used": False
        },
        "qualification_effect": "EA1O_B_SFLUX_DIRECT_1H_SOURCE_REJECTION_CANDIDATE_PASS",
        "future_et0_executed": False,
        "database_write_count": 0,
        "formal_evidence_write_count": 0,
        "canonical_evidence_write_count": 0,
        "runtime_product_source_delta_count": 0,
        "formal_window_started": False,
        "mcft_cap09_completed": False
    }
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(json.dumps(result, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(json.dumps(result, sort_keys=True, separators=(",", ":")))


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
        failure = {
            "schema_version": "geox_mcft_cap09_ea1o_b_sflux_direct_1h_source_adjudication_result_v2",
            "status": "FAIL",
            "error": safe_error(exc),
            "raw_provider_payload_emitted": False,
            "decoded_values_emitted": False,
            "database_write_count": 0,
            "formal_evidence_write_count": 0,
            "formal_window_started": False
        }
        OUTPUT_PATH.write_text(json.dumps(failure, indent=2, sort_keys=True) + "\n", encoding="utf-8")
        raise
