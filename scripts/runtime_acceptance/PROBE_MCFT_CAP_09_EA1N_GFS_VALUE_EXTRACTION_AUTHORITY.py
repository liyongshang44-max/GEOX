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
from eccodes import codes_get, codes_get_array, codes_get_message, codes_grib_new_from_file, codes_release

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
USER_AGENT = "GEOX-MCFT-CAP-09-EA1N/1.3 (+exact-head qualification)"


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
    return dt.astimezone(timezone.utc).replace(minute=0, second=0, microsecond=0)


def candidate_cycles(tick: datetime):
    base = floor_utc_hour(tick)
    return [base - timedelta(hours=back) for back in range(49) if (base - timedelta(hours=back)).hour in (0, 6, 12, 18)]


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
        try:
            for lead in leads:
                grib_url, idx_url = object_urls(cycle, lead)
                grib = prove_source_object_prior_available(grib_url, tick)
                idx = prove_source_object_prior_available(idx_url, tick)
                last_modified_values.extend([grib["last_modified"], idx["last_modified"]])
            return {
                "cycle": cycle,
                "lead_start": lead_start,
                "lead_end": lead_end,
                "support_lead": support_lead,
                "leads": leads,
                "last_modified_min": min(last_modified_values),
                "last_modified_max": max(last_modified_values),
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
        ("var_TMP", "on"), ("var_RH", "on"), ("var_UGRD", "on"), ("var_VGRD", "on"),
        ("var_DSWRF", "on"), ("var_APCP", "on"),
        ("lev_2_m_above_ground", "on"), ("lev_10_m_above_ground", "on"), ("lev_surface", "on"),
        ("subregion", ""),
        ("leftlon", f"{GRID_LON_NATIVE - GRID_BBOX_HALF_WIDTH:.2f}"),
        ("rightlon", f"{GRID_LON_NATIVE + GRID_BBOX_HALF_WIDTH:.2f}"),
        ("toplat", f"{GRID_LAT + GRID_BBOX_HALF_WIDTH:.2f}"),
        ("bottomlat", f"{GRID_LAT - GRID_BBOX_HALF_WIDTH:.2f}"),
        ("dir", f"/gfs.{date}/{cc}/atmos"),
    ]
    return FILTER_ENDPOINT + "?" + urlencode(params)


def normalize_lon(lon: float) -> float:
    return lon % 360.0


def dt_from_grib_keys(date_value, time_value) -> datetime:
    return datetime.strptime(str(int(date_value)).zfill(8) + str(int(time_value)).zfill(4), "%Y%m%d%H%M").replace(tzinfo=timezone.utc)


def grib2_section(message: bytes, wanted_section: int) -> bytes:
    if len(message) < 20 or message[:4] != b"GRIB":
        raise RuntimeError("GRIB_MESSAGE_HEADER_INVALID")
    offset = 16
    while offset + 5 <= len(message):
        if message[offset:offset + 4] == b"7777":
            break
        section_length = int.from_bytes(message[offset:offset + 4], byteorder="big", signed=False)
        if section_length < 5 or offset + section_length > len(message):
            raise RuntimeError(f"GRIB_SECTION_LENGTH_INVALID:OFFSET={offset}:LENGTH={section_length}")
        section_number = int(message[offset + 4])
        if section_number == wanted_section:
            return message[offset:offset + section_length]
        offset += section_length
    raise RuntimeError(f"GRIB_SECTION_NOT_FOUND:{wanted_section}")


def role_for(short_name: str, name: str, type_of_level: str, level: float):
    short = short_name.lower().strip()
    long_name = name.lower().strip()
    lev = float(level)
    if type_of_level == "heightAboveGround" and abs(lev - 2.0) < 1e-9:
        if short in {"2t", "t"} or long_name == "temperature": return "AIR_TEMPERATURE_2M"
        if short in {"2r", "r"} or "relative humidity" in long_name: return "RELATIVE_HUMIDITY_2M"
    if type_of_level == "heightAboveGround" and abs(lev - 10.0) < 1e-9:
        if short in {"10u", "u"} or "u component of wind" in long_name: return "U_WIND_10M"
        if short in {"10v", "v"} or "v component of wind" in long_name: return "V_WIND_10M"
    if type_of_level == "surface":
        if short == "dswrf" or "downward short-wave radiation flux" in long_name or "downward shortwave radiation flux" in long_name:
            return "DOWNWARD_SHORTWAVE_SURFACE"
        if short in {"tp", "apcp"} or long_name == "total precipitation":
            return "TOTAL_PRECIPITATION_SURFACE"
    return None


def decode_subset(body: bytes, expected_cycle: datetime, requested_lead: int):
    if not body.startswith(b"GRIB"):
        raise RuntimeError(f"FILTER_RESPONSE_NOT_GRIB:{len(body)}:{sha256_bytes(body[:256])}")
    records, extras = [], 0
    with tempfile.NamedTemporaryFile(prefix="ea1n-", suffix=".grib2", delete=False) as tmp:
        tmp.write(body)
        tmp_path = tmp.name
    try:
        with open(tmp_path, "rb") as handle:
            while True:
                gid = codes_grib_new_from_file(handle)
                if gid is None: break
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
                    lat, lon, value = float(lats[0]), normalize_lon(float(lons[0])), float(values[0])
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
                    raw_message = bytes(codes_get_message(gid))
                    section4 = grib2_section(raw_message, 4)
                    records.append({
                        "role":role,"short_name":short_name,"type_of_level":type_of_level,"level":level,
                        "step_type":step_type,"start_step":start_step,"end_step":end_step,"units":units,
                        "valid_time":valid_dt,"value":value,"section4_sha256":sha256_bytes(section4),"section4_bytes":len(section4)
                    })
                finally:
                    codes_release(gid)
    finally:
        try: os.remove(tmp_path)
        except OSError: pass
    return records, extras


def exact_one(items, message: str):
    if len(items) != 1: raise RuntimeError(f"{message}:COUNT={len(items)}")
    return items[0]


def find_instant(records, role: str, lead: int):
    return exact_one([r for r in records if r["role"] == role and r["step_type"] == "instant" and r["end_step"] == lead], f"INSTANT_RECORD_NOT_UNIQUE:{role}:F{lead:03d}")


def rolling_start(lead: int) -> int:
    return 6 * ((lead - 1) // 6)


def find_dswrf_average(records, lead: int):
    start = rolling_start(lead)
    return exact_one([r for r in records if r["role"] == "DOWNWARD_SHORTWAVE_SURFACE" and r["step_type"] == "avg" and r["start_step"] == start and r["end_step"] == lead], f"DSWRF_BLOCK_AVERAGE_NOT_UNIQUE:S{start}:E{lead}")


def apcp_block_candidates(records, lead: int):
    start = rolling_start(lead)
    return [r for r in records if r["role"] == "TOTAL_PRECIPITATION_SURFACE" and r["step_type"] == "accum" and r["start_step"] == start and r["end_step"] == lead]


def resolve_logical_apcp_block(records, lead: int):
    start = rolling_start(lead)
    candidates = apcp_block_candidates(records, lead)
    if not candidates:
        raise RuntimeError(f"APCP_BLOCK_LOGICAL_RECORD_MISSING:S{start}:E{lead}")
    section4_hashes = {r["section4_sha256"] for r in candidates}
    if len(section4_hashes) != 1:
        raise RuntimeError(f"APCP_BLOCK_DISTINCT_SECTION4_AMBIGUITY:S{start}:E{lead}:COUNT={len(candidates)}:SECTION4={len(section4_hashes)}")
    value_hex = {float(r["value"]).hex() for r in candidates}
    if len(value_hex) != 1:
        raise RuntimeError(f"APCP_BLOCK_DUPLICATE_VALUE_MISMATCH:S{start}:E{lead}:COUNT={len(candidates)}")
    units = {r["units"] for r in candidates}
    if len(units) != 1:
        raise RuntimeError(f"APCP_BLOCK_DUPLICATE_UNIT_MISMATCH:S{start}:E{lead}:COUNT={len(candidates)}")
    return candidates[0], len(candidates) - 1


def assert_apcp_unit(units: str, lead: int):
    normalized = units.lower().replace(" ", "").replace("*", "").replace("^", "")
    if normalized not in {"kgm-2", "kg/m2"}:
        raise RuntimeError(f"APCP_UNIT_NOT_KG_M2:F{lead:03d}:{sha256_bytes(units.encode('utf-8'))}")


def assert_raw_sanity(rec, lead: int):
    role, value = rec["role"], rec["value"]
    if role == "AIR_TEMPERATURE_2M" and not 180 <= value <= 330: raise RuntimeError(f"RAW_TEMPERATURE_SANITY_FAIL:F{lead:03d}")
    if role == "RELATIVE_HUMIDITY_2M" and not 0 <= value <= 100: raise RuntimeError(f"RAW_RH_SANITY_FAIL:F{lead:03d}")
    if role in {"U_WIND_10M","V_WIND_10M"} and abs(value) > 100: raise RuntimeError(f"RAW_WIND_COMPONENT_SANITY_FAIL:{role}:F{lead:03d}")
    if role == "DOWNWARD_SHORTWAVE_SURFACE" and not 0 <= value <= 1600: raise RuntimeError(f"RAW_DSWRF_SANITY_FAIL:F{lead:03d}")
    if role == "TOTAL_PRECIPITATION_SURFACE" and not 0 <= value <= 1200: raise RuntimeError(f"RAW_APCP_BLOCK_SANITY_FAIL:F{lead:03d}")


def hash_series(points):
    return sha256_json([{"valid_time":iso(t),"value":format(v,".12g")} for t,v in points])


def main():
    subject_sha = os.environ.get("MCFT_SUBJECT_SHA", "").strip()
    if not subject_sha: raise RuntimeError("MCFT_SUBJECT_SHA_REQUIRED")
    started = datetime.now(timezone.utc)
    tick = floor_utc_hour(started)
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    result = {
        "schema_version":"geox_mcft_cap09_ea1n_gfs_value_extraction_result_v1",
        "subject_sha":subject_sha,"base_main_sha":BASE_MAIN_SHA,"status":"FAIL","probe_started_at":iso(started),"tick_utc":iso(tick),
        "precipitation_source_candidate":"APCP_SIX_HOUR_BLOCK_CUMULATIVE_DIFFERENCE_WITH_NCEP_SEMANTIC_DUPLICATE_COLLAPSE",
        "rejected_precipitation_candidates":["PRATE_SIX_HOUR_ROLLING_AVERAGE_DIFFERENCE","APCP_EXACT_ONE_HOUR_ACCUMULATION_ONLY"],
        "provider_duplicate_semantics_commit":"58f99e14f2922d1ae3e05d2c41ea28c599a8c81d",
        "provider_unmerge_source_blob":"df2be678da7d7855d38897592a18be154100fa92",
        "provider_section_compare_source_blob":"2081a81dfe216604f614f82b48fa9af109a61039",
        "database_write_count":0,"formal_evidence_write_count":0,"future_et0_execution_count":0,"runtime_product_source_delta_count":0,
        "raw_grib_subset_uploaded":False,"decoded_forecast_values_emitted":False,"normalized_forecast_values_emitted":False,"negative_value_clipping_performed":False,
        "physical_message_order_used_as_authority":False,"first_record_wins":False,
    }
    try:
        result["decoder"] = {"eccodes_python":package_version("eccodes"),"eccodeslib":package_version("eccodeslib"),"module_version":getattr(eccodes,"__version__","unknown")}
        if result["decoder"]["eccodes_python"] != "2.47.0": raise RuntimeError("ECCODES_PYTHON_VERSION_DRIFT")
        if result["decoder"]["eccodeslib"] != "2.47.3.23": raise RuntimeError("ECCODESLIB_VERSION_DRIFT")

        selected = select_complete_cycle(tick)
        result.update({"selected_cycle":iso(selected["cycle"]),"lead_start":selected["lead_start"],"lead_end":selected["lead_end"],"support_lead":selected["support_lead"],"valid_time_start":iso(tick+timedelta(hours=1)),"valid_time_end":iso(tick+timedelta(hours=72)),"source_object_count":len(selected["leads"])*2,"production_last_modified_min":iso(selected["last_modified_min"]),"production_last_modified_max":iso(selected["last_modified_max"]),"candidate_cycle_rejection_count":len(selected["candidate_rejections"])})

        by_lead, filter_hashes, metadata_for_hash, section4_identities = {}, [], [], []
        total_filter_bytes = extra_message_count = 0
        for lead in selected["leads"]:
            url = filter_url(selected["cycle"], lead)
            status, _headers, body, final_url = request_bytes(url, method="GET", timeout=90, attempts=3)
            if status != 200: raise RuntimeError(f"GRIB_FILTER_HTTP_{status}:F{lead:03d}")
            if "nomads.ncep.noaa.gov" not in final_url: raise RuntimeError(f"GRIB_FILTER_FINAL_HOST_UNEXPECTED:F{lead:03d}")
            total_filter_bytes += len(body)
            filter_hashes.append({"lead":lead,"sha256":sha256_bytes(body),"bytes":len(body)})
            records, extras = decode_subset(body, selected["cycle"], lead)
            by_lead[lead] = records
            extra_message_count += extras
            for rec in records:
                metadata_for_hash.append({k:(iso(rec[k]) if k=="valid_time" else rec[k]) for k in ["role","short_name","type_of_level","level","step_type","start_step","end_step","units","valid_time","section4_sha256","section4_bytes"]} | {"lead":lead})
                section4_identities.append({"lead":lead,"role":rec["role"],"step_type":rec["step_type"],"start_step":rec["start_step"],"end_step":rec["end_step"],"section4_sha256":rec["section4_sha256"]})
            time.sleep(0.15)

        target_leads = list(range(selected["lead_start"], selected["lead_end"]+1))
        logical_apcp = {}
        target_physical_count = target_semantic_duplicate_collapse_count = 0
        for lead in target_leads:
            candidates = apcp_block_candidates(by_lead[lead], lead)
            target_physical_count += len(candidates)
            rec, collapsed = resolve_logical_apcp_block(by_lead[lead], lead)
            logical_apcp[lead] = rec
            target_semantic_duplicate_collapse_count += collapsed
        result["apcp_logical_target_count"] = len(logical_apcp)
        result["apcp_target_physical_message_count"] = target_physical_count
        result["apcp_target_semantic_duplicate_collapse_count"] = target_semantic_duplicate_collapse_count
        if len(logical_apcp) != POINT_COUNT:
            raise RuntimeError(f"APCP_LOGICAL_BLOCK_72_OF_72_REQUIRED:COUNT={len(logical_apcp)}")

        series = {name:[] for name in ["temperature_c","relative_humidity_percent","wind_2m_m_s","solar_mj_m2_h","precipitation_mm"]}
        ds_direct = ds_diff = apcp_direct = apcp_diff = support_duplicate_collapses = 0
        for lead in target_leads:
            records = by_lead[lead]
            temp = find_instant(records,"AIR_TEMPERATURE_2M",lead); rh = find_instant(records,"RELATIVE_HUMIDITY_2M",lead)
            u = find_instant(records,"U_WIND_10M",lead); v = find_instant(records,"V_WIND_10M",lead)
            ds = find_dswrf_average(records,lead); apcp = logical_apcp[lead]
            assert_apcp_unit(apcp["units"],lead)
            for rec in (temp,rh,u,v,ds,apcp): assert_raw_sanity(rec,lead)

            start = rolling_start(lead); length = lead-start
            if length == 1:
                hourly_ds = ds["value"]; precip_mm = apcp["value"]
                ds_direct += 1; apcp_direct += 1
            else:
                prev_records = by_lead.get(lead-1)
                if prev_records is None: raise RuntimeError(f"MISSING_DERIVATION_PREDECESSOR:F{lead:03d}")
                ds_prev = find_dswrf_average(prev_records,lead-1)
                apcp_prev, support_collapsed = resolve_logical_apcp_block(prev_records,lead-1)
                support_duplicate_collapses += support_collapsed
                if ds_prev["start_step"] != start or apcp_prev["start_step"] != start:
                    raise RuntimeError(f"CROSS_BLOCK_DIFFERENCE_FORBIDDEN:F{lead:03d}")
                hourly_ds = length*ds["value"] - (length-1)*ds_prev["value"]
                precip_mm = apcp["value"] - apcp_prev["value"]
                ds_diff += 1; apcp_diff += 1
            if not math.isfinite(hourly_ds) or not 0 <= hourly_ds <= 1600:
                raise RuntimeError(f"DERIVED_DSWRF_SANITY_FAIL_NO_CLIP:F{lead:03d}")
            if not math.isfinite(precip_mm) or not 0 <= precip_mm <= 200:
                raise RuntimeError(f"APCP_BLOCK_MONOTONICITY_OR_HOURLY_SANITY_FAIL_NO_CLIP:F{lead:03d}")

            valid_time = selected["cycle"] + timedelta(hours=lead)
            series["temperature_c"].append((valid_time,temp["value"]-273.15))
            series["relative_humidity_percent"].append((valid_time,rh["value"]))
            series["wind_2m_m_s"].append((valid_time,math.hypot(u["value"],v["value"])*WIND_10M_TO_2M_FACTOR))
            series["solar_mj_m2_h"].append((valid_time,hourly_ds*SOLAR_WM2_TO_MJ_M2_H))
            series["precipitation_mm"].append((valid_time,precip_mm))

        expected_times = [tick+timedelta(hours=i) for i in range(1,POINT_COUNT+1)]
        for name,points in series.items():
            if len(points) != POINT_COUNT: raise RuntimeError(f"NORMALIZED_SERIES_POINT_COUNT_FAIL:{name}:{len(points)}")
            if [p[0] for p in points] != expected_times: raise RuntimeError(f"NORMALIZED_SERIES_VALID_TIME_FAIL:{name}")

        result.update({
            "filter_response_count":len(filter_hashes),"filter_response_total_bytes":total_filter_bytes,
            "filter_response_hash_chain_sha256":sha256_json(filter_hashes),"decoded_message_metadata_hash_chain_sha256":sha256_json(metadata_for_hash),
            "section4_identity_hash_chain_sha256":sha256_json(section4_identities),
            "decoded_recognized_message_count":len(metadata_for_hash),"decoded_extra_message_count":extra_message_count,
            "apcp_support_semantic_duplicate_collapse_count":support_duplicate_collapses,
            "normalization_counts":{"dswrf_direct_1h":ds_direct,"dswrf_weighted_difference":ds_diff,"apcp_block_direct_1h":apcp_direct,"apcp_block_cumulative_difference":apcp_diff,"prate_used":0},
            "normalized_series_point_counts":{name:len(points) for name,points in series.items()},
            "normalized_series_hashes":{name:hash_series(points) for name,points in series.items()},
            "physical_sanity_pass":True,"chronology_pass":True,"single_grid_point_pass":True,"message_semantics_reconciliation_pass":True,"provider_semantic_duplicate_rule_pass":True,"precipitation_source_correction_pass":True,
            "status":"PASS","qualification_effect":"GFS_72H_DECODED_AND_NORMALIZED_VALUE_PIPELINE_AUTHORITY_CANDIDATE_ONLY"
        })
        result["normalized_bundle_sha256"] = sha256_json(result["normalized_series_hashes"])
    except Exception as exc:
        result["error"] = f"{type(exc).__name__}:{exc}"[:2000]
        OUTPUT.write_text(json.dumps(result,indent=2,sort_keys=True)+"\n",encoding="utf-8")
        raise

    OUTPUT.write_text(json.dumps(result,indent=2,sort_keys=True)+"\n",encoding="utf-8")
    print(json.dumps({"status":result["status"],"subject_sha":subject_sha,"tick_utc":result["tick_utc"],"selected_cycle":result["selected_cycle"],"lead_start":result["lead_start"],"lead_end":result["lead_end"],"apcp_logical_target_count":result["apcp_logical_target_count"],"semantic_duplicate_collapses":result["apcp_target_semantic_duplicate_collapse_count"],"normalization_counts":result["normalization_counts"],"physical_sanity_pass":result["physical_sanity_pass"]},sort_keys=True))


if __name__ == "__main__":
    try: main()
    except Exception as exc:
        print(f"EA1N_FAIL:{type(exc).__name__}:{exc}",file=sys.stderr)
        sys.exit(1)
