#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import json
import math
import os
import sys
import tempfile
import time
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
from importlib.metadata import version as package_version
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

import eccodes
from eccodes import codes_get, codes_get_array, codes_grib_new_from_file, codes_release

BASE_MAIN_SHA = "58287db14bc0d6424219f6a91a08c3f12dfe4536"
PRODUCTION_ROOT = "https://nomads.ncep.noaa.gov/pub/data/nccf/com/gfs/prod"
FILTER_ENDPOINT = "https://nomads.ncep.noaa.gov/cgi-bin/filter_gfs_0p25.pl"
GRID_LAT = 42.5
GRID_LON_NATIVE = 274.75
GRID_BBOX_HALF_WIDTH = 0.01
POINT_COUNT = 72
MAX_LEAD = 120
WIND_10M_TO_2M_FACTOR = 0.747951075
SOLAR_WM2_TO_MJ_M2_H = 0.0036
OUTPUT = Path("acceptance-output/MCFT_CAP_09_EA1N_GFS_VALUE_EXTRACTION_AUTHORITY_RESULT.json")
USER_AGENT = "GEOX-MCFT-CAP-09-EA1N/1.1 (+exact-head qualification)"


def iso(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


def sha256_bytes(body: bytes) -> str:
    return hashlib.sha256(body).hexdigest()


def sha256_json(value) -> str:
    body = json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=True).encode("utf-8")
    return sha256_bytes(body)


def request_bytes(url: str, method: str = "GET", timeout: int = 60, attempts: int = 3):
    last = None
    for attempt in range(attempts):
        try:
            req = Request(url, method=method, headers={"User-Agent": USER_AGENT, "Accept": "*/*"})
            with urlopen(req, timeout=timeout) as response:
                body = b"" if method == "HEAD" else response.read()
                return response.status, response.headers, body, response.geturl()
        except (HTTPError, URLError, TimeoutError) as exc:
            last = exc
            if attempt + 1 < attempts:
                time.sleep(1.0 + attempt)
    raise RuntimeError(f"HTTP_REQUEST_FAILED:{method}:{url}:{type(last).__name__}:{last}")


def parse_last_modified(headers) -> datetime:
    raw = headers.get("Last-Modified")
    if not raw:
        raise RuntimeError("MISSING_HTTP_LAST_MODIFIED")
    dt = parsedate_to_datetime(raw)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def floor_utc_hour(dt: datetime) -> datetime:
    dt = dt.astimezone(timezone.utc)
    return dt.replace(minute=0, second=0, microsecond=0)


def candidate_cycles(tick: datetime):
    base = floor_utc_hour(tick)
    out = []
    for back in range(0, 49):
        candidate = base - timedelta(hours=back)
        if candidate.hour in (0, 6, 12, 18):
            out.append(candidate)
    return out


def object_urls(cycle: datetime, lead: int):
    date = cycle.strftime("%Y%m%d")
    cc = cycle.strftime("%H")
    stem = f"gfs.t{cc}z.pgrb2.0p25.f{lead:03d}"
    root = f"{PRODUCTION_ROOT}/gfs.{date}/{cc}/atmos/{stem}"
    return root, root + ".idx"


def prove_source_object_prior_available(url: str, tick: datetime):
    status, headers, _, final_url = request_bytes(url, method="HEAD", timeout=30, attempts=2)
    if status != 200:
        raise RuntimeError(f"SOURCE_OBJECT_HTTP_{status}:{url}")
    last_modified = parse_last_modified(headers)
    if last_modified > tick:
        raise RuntimeError(f"SOURCE_OBJECT_AFTER_TICK:{url}:{iso(last_modified)}>{iso(tick)}")
    return {
        "last_modified": last_modified,
        "content_length": int(headers.get("Content-Length") or 0),
        "final_host_path_hash": sha256_bytes(final_url.encode("utf-8")),
    }


def select_complete_cycle(tick: datetime):
    rejections = []
    for cycle in candidate_cycles(tick):
        lead_start = int((tick - cycle).total_seconds() // 3600) + 1
        lead_end = lead_start + POINT_COUNT - 1
        support_lead = lead_start - 1
        if support_lead < 0 or lead_end > MAX_LEAD:
            rejections.append({"cycle": iso(cycle), "reason": "LEAD_RANGE_OUTSIDE_0_TO_120"})
            continue
        leads = list(range(support_lead, lead_end + 1))
        last_modified_values = []
        total_grib_bytes = 0
        try:
            for lead in leads:
                grib_url, idx_url = object_urls(cycle, lead)
                grib = prove_source_object_prior_available(grib_url, tick)
                idx = prove_source_object_prior_available(idx_url, tick)
                last_modified_values.extend([grib["last_modified"], idx["last_modified"]])
                total_grib_bytes += grib["content_length"]
            return {
                "cycle": cycle,
                "lead_start": lead_start,
                "lead_end": lead_end,
                "support_lead": support_lead,
                "leads": leads,
                "last_modified_min": min(last_modified_values),
                "last_modified_max": max(last_modified_values),
                "production_grib_content_length_sum": total_grib_bytes,
                "candidate_rejections": rejections,
            }
        except Exception as exc:
            rejections.append({"cycle": iso(cycle), "reason": str(exc)[:300]})
    raise RuntimeError("NO_COMPLETE_GFS_CYCLE_BEFORE_TICK:" + json.dumps(rejections, separators=(",", ":")))


def filter_url(cycle: datetime, lead: int):
    date = cycle.strftime("%Y%m%d")
    cc = cycle.strftime("%H")
    params = [
        ("file", f"gfs.t{cc}z.pgrb2.0p25.f{lead:03d}"),
        ("var_TMP", "on"),
        ("var_RH", "on"),
        ("var_UGRD", "on"),
        ("var_VGRD", "on"),
        ("var_DSWRF", "on"),
        ("var_APCP", "on"),
        ("lev_2_m_above_ground", "on"),
        ("lev_10_m_above_ground", "on"),
        ("lev_surface", "on"),
        ("subregion", ""),
        ("leftlon", f"{GRID_LON_NATIVE - GRID_BBOX_HALF_WIDTH:.2f}"),
        ("rightlon", f"{GRID_LON_NATIVE + GRID_BBOX_HALF_WIDTH:.2f}"),
        ("toplat", f"{GRID_LAT + GRID_BBOX_HALF_WIDTH:.2f}"),
        ("bottomlat", f"{GRID_LAT - GRID_BBOX_HALF_WIDTH:.2f}"),
        ("dir", f"/gfs.{date}/{cc}/atmos"),
    ]
    return FILTER_ENDPOINT + "?" + urlencode(params)


def normalize_lon(lon: float) -> float:
    value = lon % 360.0
    if value < 0:
        value += 360.0
    return value


def dt_from_grib_keys(date_value, time_value) -> datetime:
    date_text = str(int(date_value)).zfill(8)
    time_text = str(int(time_value)).zfill(4)
    return datetime.strptime(date_text + time_text, "%Y%m%d%H%M").replace(tzinfo=timezone.utc)


def role_for(short_name: str, name: str, type_of_level: str, level: float):
    short = short_name.lower().strip()
    long_name = name.lower().strip()
    level_type = type_of_level.strip()
    numeric_level = float(level)
    if level_type == "heightAboveGround" and abs(numeric_level - 2.0) < 1e-9:
        if short in {"2t", "t"} or long_name == "temperature":
            return "AIR_TEMPERATURE_2M"
        if short in {"2r", "r"} or "relative humidity" in long_name:
            return "RELATIVE_HUMIDITY_2M"
    if level_type == "heightAboveGround" and abs(numeric_level - 10.0) < 1e-9:
        if short in {"10u", "u"} or "u component of wind" in long_name:
            return "U_WIND_10M"
        if short in {"10v", "v"} or "v component of wind" in long_name:
            return "V_WIND_10M"
    if level_type == "surface":
        if short == "dswrf" or "downward short-wave radiation flux" in long_name or "downward shortwave radiation flux" in long_name:
            return "DOWNWARD_SHORTWAVE_SURFACE"
        if short in {"tp", "apcp"} or long_name == "total precipitation":
            return "TOTAL_PRECIPITATION_SURFACE"
    return None


def decode_subset(body: bytes, expected_cycle: datetime, requested_lead: int):
    if not body.startswith(b"GRIB"):
        prefix_hash = sha256_bytes(body[:256])
        raise RuntimeError(f"FILTER_RESPONSE_NOT_GRIB:{len(body)}:{prefix_hash}")
    records = []
    extras = 0
    with tempfile.NamedTemporaryFile(prefix="ea1n-", suffix=".grib2", delete=False) as tmp:
        tmp.write(body)
        tmp_path = tmp.name
    try:
        with open(tmp_path, "rb") as handle:
            while True:
                gid = codes_grib_new_from_file(handle)
                if gid is None:
                    break
                try:
                    short_name = str(codes_get(gid, "shortName"))
                    name = str(codes_get(gid, "name"))
                    type_of_level = str(codes_get(gid, "typeOfLevel"))
                    level = float(codes_get(gid, "level"))
                    role = role_for(short_name, name, type_of_level, level)
                    if role is None:
                        extras += 1
                        continue
                    step_type = str(codes_get(gid, "stepType"))
                    start_step = int(codes_get(gid, "startStep"))
                    end_step = int(codes_get(gid, "endStep"))
                    data_dt = dt_from_grib_keys(codes_get(gid, "dataDate"), codes_get(gid, "dataTime"))
                    valid_dt = dt_from_grib_keys(codes_get(gid, "validityDate"), codes_get(gid, "validityTime"))
                    units = str(codes_get(gid, "units"))
                    lats = codes_get_array(gid, "latitudes")
                    lons = codes_get_array(gid, "longitudes")
                    values = codes_get_array(gid, "values")
                    if len(values) != 1 or len(lats) != 1 or len(lons) != 1:
                        raise RuntimeError(f"DECODED_GRID_POINT_COUNT_NOT_ONE:{role}:{len(values)}")
                    lat = float(lats[0])
                    lon = normalize_lon(float(lons[0]))
                    value = float(values[0])
                    if abs(lat - GRID_LAT) > 1e-6 or abs(lon - GRID_LON_NATIVE) > 1e-6:
                        raise RuntimeError(f"DECODED_GRID_NODE_MISMATCH:{role}:{lat}:{lon}")
                    if data_dt != expected_cycle:
                        raise RuntimeError(f"DECODED_REFERENCE_TIME_MISMATCH:{role}:{iso(data_dt)}:{iso(expected_cycle)}")
                    if end_step != requested_lead:
                        raise RuntimeError(f"DECODED_END_STEP_MISMATCH:{role}:{end_step}:{requested_lead}")
                    if valid_dt != expected_cycle + timedelta(hours=requested_lead):
                        raise RuntimeError(f"DECODED_VALID_TIME_MISMATCH:{role}:{iso(valid_dt)}")
                    if not math.isfinite(value):
                        raise RuntimeError(f"NONFINITE_DECODED_VALUE:{role}:F{requested_lead:03d}")
                    records.append({
                        "role": role,
                        "short_name": short_name,
                        "type_of_level": type_of_level,
                        "level": level,
                        "step_type": step_type,
                        "start_step": start_step,
                        "end_step": end_step,
                        "units": units,
                        "valid_time": valid_dt,
                        "value": value,
                    })
                finally:
                    codes_release(gid)
    finally:
        try:
            os.remove(tmp_path)
        except OSError:
            pass
    return records, extras


def exact_one(items, message: str):
    if len(items) != 1:
        raise RuntimeError(f"{message}:COUNT={len(items)}")
    return items[0]


def find_instant(records, role: str, lead: int):
    candidates = [r for r in records if r["role"] == role and r["step_type"] == "instant" and r["end_step"] == lead]
    return exact_one(candidates, f"INSTANT_RECORD_NOT_UNIQUE:{role}:F{lead:03d}")


def rolling_start(lead: int) -> int:
    return 6 * ((lead - 1) // 6)


def find_average(records, role: str, lead: int):
    start = rolling_start(lead)
    candidates = [
        r for r in records
        if r["role"] == role and r["step_type"] == "avg" and r["start_step"] == start and r["end_step"] == lead
    ]
    return exact_one(candidates, f"AVERAGE_RECORD_NOT_UNIQUE:{role}:S{start}:E{lead}")


def exact_hour_apcp_candidates(records, lead: int):
    return [
        r for r in records
        if r["role"] == "TOTAL_PRECIPITATION_SURFACE"
        and r["step_type"] == "accum"
        and r["start_step"] == lead - 1
        and r["end_step"] == lead
    ]


def find_exact_hour_apcp(records, lead: int):
    return exact_one(exact_hour_apcp_candidates(records, lead), f"APCP_EXACT_1H_RECORD_NOT_UNIQUE:F{lead:03d}")


def assert_apcp_unit(units: str, lead: int):
    normalized = units.lower().replace(" ", "").replace("*", "").replace("^", "")
    if normalized not in {"kgm-2", "kg/m2"}:
        raise RuntimeError(f"APCP_UNIT_NOT_KG_M2:F{lead:03d}:{sha256_bytes(units.encode('utf-8'))}")


def assert_raw_sanity(role: str, value: float, lead: int):
    if role == "AIR_TEMPERATURE_2M" and not (180.0 <= value <= 330.0):
        raise RuntimeError(f"RAW_TEMPERATURE_SANITY_FAIL:F{lead:03d}")
    if role == "RELATIVE_HUMIDITY_2M" and not (0.0 <= value <= 100.0):
        raise RuntimeError(f"RAW_RH_SANITY_FAIL:F{lead:03d}")
    if role in {"U_WIND_10M", "V_WIND_10M"} and abs(value) > 100.0:
        raise RuntimeError(f"RAW_WIND_COMPONENT_SANITY_FAIL:{role}:F{lead:03d}")
    if role == "DOWNWARD_SHORTWAVE_SURFACE" and not (0.0 <= value <= 1600.0):
        raise RuntimeError(f"RAW_DSWRF_SANITY_FAIL:F{lead:03d}")
    if role == "TOTAL_PRECIPITATION_SURFACE" and not (0.0 <= value <= 200.0):
        raise RuntimeError(f"RAW_APCP_EXACT_HOUR_SANITY_FAIL:F{lead:03d}")


def hash_series(points):
    safe = [{"valid_time": iso(t), "value": format(v, ".12g")} for t, v in points]
    return sha256_json(safe)


def main():
    subject_sha = os.environ.get("MCFT_SUBJECT_SHA", "").strip()
    if not subject_sha:
        raise RuntimeError("MCFT_SUBJECT_SHA_REQUIRED")
    started = datetime.now(timezone.utc)
    tick = floor_utc_hour(started)
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    result = {
        "schema_version": "geox_mcft_cap09_ea1n_gfs_value_extraction_result_v1",
        "subject_sha": subject_sha,
        "base_main_sha": BASE_MAIN_SHA,
        "status": "FAIL",
        "probe_started_at": iso(started),
        "tick_utc": iso(tick),
        "precipitation_source_candidate": "APCP_EXACT_ONE_HOUR_ACCUMULATION",
        "prate_rolling_precipitation_selected": False,
        "database_write_count": 0,
        "formal_evidence_write_count": 0,
        "future_et0_execution_count": 0,
        "runtime_product_source_delta_count": 0,
        "raw_grib_subset_uploaded": False,
        "decoded_forecast_values_emitted": False,
        "normalized_forecast_values_emitted": False,
        "negative_value_clipping_performed": False,
    }
    try:
        result["decoder"] = {
            "eccodes_python": package_version("eccodes"),
            "eccodeslib": package_version("eccodeslib"),
            "module_version": getattr(eccodes, "__version__", "unknown"),
        }
        if result["decoder"]["eccodes_python"] != "2.47.0":
            raise RuntimeError("ECCODES_PYTHON_VERSION_DRIFT")
        if result["decoder"]["eccodeslib"] != "2.47.3.23":
            raise RuntimeError("ECCODESLIB_VERSION_DRIFT")

        selected = select_complete_cycle(tick)
        result["selected_cycle"] = iso(selected["cycle"])
        result["lead_start"] = selected["lead_start"]
        result["lead_end"] = selected["lead_end"]
        result["support_lead"] = selected["support_lead"]
        result["valid_time_start"] = iso(tick + timedelta(hours=1))
        result["valid_time_end"] = iso(tick + timedelta(hours=72))
        result["source_object_count"] = len(selected["leads"]) * 2
        result["production_last_modified_min"] = iso(selected["last_modified_min"])
        result["production_last_modified_max"] = iso(selected["last_modified_max"])
        result["candidate_cycle_rejection_count"] = len(selected["candidate_rejections"])

        by_lead = {}
        filter_hashes = []
        metadata_for_hash = []
        total_filter_bytes = 0
        extra_message_count = 0
        for lead in selected["leads"]:
            url = filter_url(selected["cycle"], lead)
            status, _headers, body, final_url = request_bytes(url, method="GET", timeout=90, attempts=3)
            if status != 200:
                raise RuntimeError(f"GRIB_FILTER_HTTP_{status}:F{lead:03d}")
            if "nomads.ncep.noaa.gov" not in final_url:
                raise RuntimeError(f"GRIB_FILTER_FINAL_HOST_UNEXPECTED:F{lead:03d}")
            total_filter_bytes += len(body)
            filter_hashes.append({"lead": lead, "sha256": sha256_bytes(body), "bytes": len(body)})
            records, extras = decode_subset(body, selected["cycle"], lead)
            extra_message_count += extras
            by_lead[lead] = records
            for rec in records:
                metadata_for_hash.append({
                    "lead": lead,
                    "role": rec["role"],
                    "short_name": rec["short_name"],
                    "type_of_level": rec["type_of_level"],
                    "level": rec["level"],
                    "step_type": rec["step_type"],
                    "start_step": rec["start_step"],
                    "end_step": rec["end_step"],
                    "units": rec["units"],
                    "valid_time": iso(rec["valid_time"]),
                })
            time.sleep(0.15)

        target_leads = list(range(selected["lead_start"], selected["lead_end"] + 1))
        apcp_exact_hour_counts = [len(exact_hour_apcp_candidates(by_lead[lead], lead)) for lead in target_leads]
        result["apcp_exact_hour_target_count"] = len(target_leads)
        result["apcp_exact_hour_unique_coverage_count"] = sum(1 for count in apcp_exact_hour_counts if count == 1)
        result["apcp_exact_hour_missing_count"] = sum(1 for count in apcp_exact_hour_counts if count == 0)
        result["apcp_exact_hour_ambiguous_count"] = sum(1 for count in apcp_exact_hour_counts if count > 1)
        if result["apcp_exact_hour_unique_coverage_count"] != POINT_COUNT:
            first_bad_index = next(i for i, count in enumerate(apcp_exact_hour_counts) if count != 1)
            bad_lead = target_leads[first_bad_index]
            bad_count = apcp_exact_hour_counts[first_bad_index]
            raise RuntimeError(f"APCP_EXACT_1H_72_OF_72_REQUIRED:F{bad_lead:03d}:COUNT={bad_count}")

        series = {name: [] for name in ["temperature_c", "relative_humidity_percent", "wind_2m_m_s", "solar_mj_m2_h", "precipitation_mm"]}
        direct_dswrf = 0
        diff_dswrf = 0
        direct_apcp = 0
        for lead in target_leads:
            records = by_lead[lead]
            temp = find_instant(records, "AIR_TEMPERATURE_2M", lead)
            rh = find_instant(records, "RELATIVE_HUMIDITY_2M", lead)
            u = find_instant(records, "U_WIND_10M", lead)
            v = find_instant(records, "V_WIND_10M", lead)
            ds = find_average(records, "DOWNWARD_SHORTWAVE_SURFACE", lead)
            apcp = find_exact_hour_apcp(records, lead)
            assert_apcp_unit(apcp["units"], lead)
            for rec in (temp, rh, u, v, ds, apcp):
                assert_raw_sanity(rec["role"], rec["value"], lead)

            start = rolling_start(lead)
            length = lead - start
            if length == 1:
                hourly_ds = ds["value"]
                direct_dswrf += 1
            else:
                previous_records = by_lead.get(lead - 1)
                if previous_records is None:
                    raise RuntimeError(f"MISSING_DERIVATION_PREDECESSOR:F{lead:03d}")
                ds_prev = find_average(previous_records, "DOWNWARD_SHORTWAVE_SURFACE", lead - 1)
                if ds_prev["start_step"] != start:
                    raise RuntimeError(f"CROSS_BLOCK_DIFFERENCE_FORBIDDEN:F{lead:03d}")
                hourly_ds = length * ds["value"] - (length - 1) * ds_prev["value"]
                diff_dswrf += 1

            if not math.isfinite(hourly_ds) or not (0.0 <= hourly_ds <= 1600.0):
                raise RuntimeError(f"DERIVED_DSWRF_SANITY_FAIL_NO_CLIP:F{lead:03d}")
            precip_mm = apcp["value"]
            if not math.isfinite(precip_mm) or not (0.0 <= precip_mm <= 200.0):
                raise RuntimeError(f"DERIVED_PRECIP_SANITY_FAIL_NO_CLIP:F{lead:03d}")
            direct_apcp += 1

            valid_time = selected["cycle"] + timedelta(hours=lead)
            temp_c = temp["value"] - 273.15
            wind10 = math.hypot(u["value"], v["value"])
            wind2 = wind10 * WIND_10M_TO_2M_FACTOR
            solar_mj = hourly_ds * SOLAR_WM2_TO_MJ_M2_H
            series["temperature_c"].append((valid_time, temp_c))
            series["relative_humidity_percent"].append((valid_time, rh["value"]))
            series["wind_2m_m_s"].append((valid_time, wind2))
            series["solar_mj_m2_h"].append((valid_time, solar_mj))
            series["precipitation_mm"].append((valid_time, precip_mm))

        expected_times = [tick + timedelta(hours=i) for i in range(1, POINT_COUNT + 1)]
        for name, points in series.items():
            if len(points) != POINT_COUNT:
                raise RuntimeError(f"NORMALIZED_SERIES_POINT_COUNT_FAIL:{name}:{len(points)}")
            if [point[0] for point in points] != expected_times:
                raise RuntimeError(f"NORMALIZED_SERIES_VALID_TIME_FAIL:{name}")

        result["filter_response_count"] = len(filter_hashes)
        result["filter_response_total_bytes"] = total_filter_bytes
        result["filter_response_hash_chain_sha256"] = sha256_json(filter_hashes)
        result["decoded_message_metadata_hash_chain_sha256"] = sha256_json(metadata_for_hash)
        result["decoded_recognized_message_count"] = len(metadata_for_hash)
        result["decoded_extra_message_count"] = extra_message_count
        result["normalization_counts"] = {
            "dswrf_direct_1h": direct_dswrf,
            "dswrf_weighted_difference": diff_dswrf,
            "apcp_exact_1h_direct": direct_apcp,
            "prate_rolling_used": 0,
        }
        result["normalized_series_point_counts"] = {name: len(points) for name, points in series.items()}
        result["normalized_series_hashes"] = {name: hash_series(points) for name, points in series.items()}
        result["normalized_bundle_sha256"] = sha256_json(result["normalized_series_hashes"])
        result["physical_sanity_pass"] = True
        result["chronology_pass"] = True
        result["single_grid_point_pass"] = True
        result["message_semantics_reconciliation_pass"] = True
        result["precipitation_source_correction_pass"] = True
        result["status"] = "PASS"
        result["qualification_effect"] = "GFS_72H_DECODED_AND_NORMALIZED_VALUE_PIPELINE_AUTHORITY_CANDIDATE_ONLY"
    except Exception as exc:
        result["error"] = f"{type(exc).__name__}:{exc}"[:2000]
        OUTPUT.write_text(json.dumps(result, indent=2, sort_keys=True) + "\n", encoding="utf-8")
        raise

    OUTPUT.write_text(json.dumps(result, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(json.dumps({
        "status": result["status"],
        "subject_sha": subject_sha,
        "tick_utc": result["tick_utc"],
        "selected_cycle": result["selected_cycle"],
        "lead_start": result["lead_start"],
        "lead_end": result["lead_end"],
        "support_lead": result["support_lead"],
        "apcp_exact_hour_unique_coverage_count": result["apcp_exact_hour_unique_coverage_count"],
        "point_counts": result["normalized_series_point_counts"],
        "normalization_counts": result["normalization_counts"],
        "physical_sanity_pass": result["physical_sanity_pass"],
    }, sort_keys=True))


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"EA1N_FAIL:{type(exc).__name__}:{exc}", file=sys.stderr)
        sys.exit(1)
