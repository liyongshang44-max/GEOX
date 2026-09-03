#!/usr/bin/env python3
import csv
import hashlib
import io
import json
import math
import re
import sys
import urllib.request
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

CONFIG_PATH = Path("docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-T4R1-THERMAL-BIOLOGICAL-STAGE-AUTHORITY-V1.json")
OUT_PATH = Path("acceptance-output/MCFT_CAP09_T4R1_THERMAL_BIOLOGICAL_STAGE_PROBE_RESULT.json")

def fail(code, detail=""):
    raise RuntimeError(code + (":" + detail if detail else ""))

def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": "GEOX-MCFT-CAP09-stage-authority-qualification/1.0"})
    with urllib.request.urlopen(req, timeout=30) as response:
        body = response.read()
        final_url = response.geturl()
        status = getattr(response, "status", 200)
    if status != 200:
        fail("SOURCE_HTTP_STATUS", str(status))
    return body, final_url

def digest(body):
    return "sha256:" + hashlib.sha256(body).hexdigest()

def text(body):
    return body.decode("utf-8", errors="replace")

def require_markers(body_text, markers, source_id):
    normalized = re.sub(r"\s+", " ", body_text)
    missing = [m for m in markers if m.lower() not in normalized.lower()]
    if missing:
        fail("SOURCE_REQUIRED_MARKER_MISSING", source_id + ":" + ",".join(missing))

def parse_date(value):
    return date.fromisoformat(value)

def daterange(start, end):
    cursor = start
    while cursor <= end:
        yield cursor
        cursor += timedelta(days=1)

def finite(v):
    try:
        n = float(v)
    except Exception:
        return None
    return n if math.isfinite(n) else None

def daily_gdu(max_f, min_f):
    if max_f < min_f:
        fail("GDU_EXTREMA_INVERTED")
    return max(0.0, ((min(max_f, 86.0) + max(min_f, 50.0)) / 2.0) - 50.0)

config = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))

source_results = {}

plant = config["planting_authority"]
plant_body, plant_final = fetch(plant["official_url"])
require_markers(text(plant_body), plant["required_markers"], "KBS_AGLOG_PLANTING")
source_results["planting"] = {
    "status": "PASS",
    "final_url": plant_final,
    "response_digest": digest(plant_body),
    "response_byte_count": len(plant_body),
    "provider_body_emitted": False,
}

hybrid = config["hybrid_thermal_landmark_candidate"]
hybrid_body, hybrid_final = fetch(hybrid["official_url"])
require_markers(text(hybrid_body), hybrid["required_markers"], "ALBERT_LEA_43_96P")
source_results["hybrid_thermal_landmark"] = {
    "status": "PASS_SECONDARY_EXACT_PRODUCT_SPECIFICATION_CANDIDATE",
    "final_url": hybrid_final,
    "response_digest": digest(hybrid_body),
    "response_byte_count": len(hybrid_body),
    "hybrid_product_code": hybrid["hybrid_product_code"],
    "crm_days": hybrid["crm_days"],
    "gdu_to_black_layer": hybrid["gdu_to_black_layer"],
    "direct_field_truth": False,
    "provider_body_emitted": False,
}

black = config["black_layer_semantics"]
black_body, black_final = fetch(black["official_url"])
require_markers(text(black_body), black["required_markers"], "PURDUE_R6_BLACK_LAYER")
source_results["black_layer_semantics"] = {
    "status": "PASS_EXTENSION_SEMANTIC_MAPPING",
    "final_url": black_final,
    "response_digest": digest(black_body),
    "response_byte_count": len(black_body),
    "mapping": black["semantic_mapping"],
    "direct_t4r1_observation": False,
    "provider_body_emitted": False,
}

weather = config["temperature_source_candidate"]
meta_body, meta_final = fetch(weather["station_metadata_url"])
require_markers(text(meta_body), [weather["station_id"], weather["station_name"]], "IEM_KBSM4_METADATA")
source_results["temperature_station"] = {
    "status": "PASS_NEAR_SITE_STATION_IDENTITY_CANDIDATE",
    "final_url": meta_final,
    "response_digest": digest(meta_body),
    "response_byte_count": len(meta_body),
    "station_id": weather["station_id"],
    "network": weather["network"],
    "direct_t4r1_field_truth": False,
    "provider_body_emitted": False,
}

snapshot = config["qualification_snapshot"]
start = parse_date(snapshot["temperature_start_local_date"])
end = parse_date(snapshot["last_complete_temperature_local_date"])
api_url = weather["daily_api_url_template"].format(start_date=start.isoformat(), end_date=end.isoformat())
weather_body, weather_final = fetch(api_url)
weather_text = text(weather_body)
reader = csv.DictReader(io.StringIO(weather_text))
rows = list(reader)
if not rows:
    fail("IEM_DAILY_ROWS_EMPTY")

by_day = {}
for row in rows:
    station = str(row.get("station") or row.get("Station") or "").strip()
    if station and station.upper() != weather["station_id"].upper():
        continue
    raw_day = str(row.get("day") or row.get("date") or row.get("valid") or "").strip()
    try:
        d = date.fromisoformat(raw_day[:10])
    except Exception:
        continue
    max_v = None
    min_v = None
    for key in ("max_temp_f", "max_tmpf", "max_temp", "max"):
        if key in row:
            max_v = finite(row.get(key))
            if max_v is not None:
                break
    for key in ("min_temp_f", "min_tmpf", "min_temp", "min"):
        if key in row:
            min_v = finite(row.get(key))
            if min_v is not None:
                break
    if d in by_day:
        fail("IEM_DUPLICATE_DAILY_ROW", d.isoformat())
    by_day[d] = (max_v, min_v)

lower = 0.0
upper = 0.0
complete = 0
missing = 0
planting_uncertain = 0
valid_days = []
missing_dates = []

for d in daterange(start, end):
    max_v, min_v = by_day.get(d, (None, None))
    valid = max_v is not None and min_v is not None and max_v >= min_v
    if d == start:
        planting_uncertain += 1
        if valid:
            gdu = daily_gdu(max_v, min_v)
            upper += gdu
            valid_days.append(d.isoformat())
        else:
            upper += 36.0
            missing_dates.append(d.isoformat())
        continue
    if not valid:
        lower += 0.0
        upper += 36.0
        missing += 1
        missing_dates.append(d.isoformat())
        continue
    gdu = daily_gdu(max_v, min_v)
    lower += gdu
    upper += gdu
    complete += 1
    valid_days.append(d.isoformat())

threshold = float(hybrid["gdu_to_black_layer"])
if lower >= threshold:
    biological_candidates = ["R6_OR_LATER_MODEL_ESTIMATE"]
    biological_resolved = biological_candidates[0]
    water_use_candidates = ["LATE"]
    water_use_resolved = "LATE"
    candidate_outcome = "THERMAL_STAGE_R6_OR_LATER_LATE_CANDIDATE"
elif upper < threshold:
    biological_candidates = ["PRE_R6_MODEL_ESTIMATE"]
    biological_resolved = biological_candidates[0]
    water_use_candidates = ["MID", "LATE"]
    water_use_resolved = None
    candidate_outcome = "THERMAL_STAGE_PRE_R6_WATER_USE_UNRESOLVED"
else:
    biological_candidates = ["PRE_R6_MODEL_ESTIMATE", "R6_OR_LATER_MODEL_ESTIMATE"]
    biological_resolved = None
    water_use_candidates = ["MID", "LATE"]
    water_use_resolved = None
    candidate_outcome = "THERMAL_STAGE_THRESHOLD_STRADDLE_UNRESOLVED"

source_results["temperature_daily"] = {
    "status": "PASS_WITH_BOUNDED_MISSING_DAY_UNCERTAINTY",
    "final_url": weather_final,
    "response_digest": digest(weather_body),
    "response_byte_count": len(weather_body),
    "requested_start_local_date": start.isoformat(),
    "requested_end_local_date": end.isoformat(),
    "complete_day_count": complete,
    "planting_uncertain_day_count": planting_uncertain,
    "missing_or_invalid_day_count": missing,
    "missing_dates": missing_dates,
    "raw_payload_emitted": False,
}

result = {
    "schema_version": "geox_mcft_cap09_t4r1_thermal_biological_stage_probe_result_v1",
    "status": "PASS",
    "candidate_outcome": candidate_outcome,
    "scope": config["formal_scope"],
    "as_of_logical_time": snapshot["as_of_logical_time"],
    "epistemic_class": "THERMAL_MODEL_DERIVED",
    "observed_biological_stage_claimed": False,
    "thermal_method": config["thermal_method"]["algorithm_id"],
    "gdu_bounds": {
        "lower_gdu": round(lower, 6),
        "upper_gdu": round(upper, 6),
        "black_layer_reference_gdu": threshold,
        "distance_lower_to_reference_gdu": round(threshold - lower, 6),
        "distance_upper_to_reference_gdu": round(threshold - upper, 6),
    },
    "candidate_biological_stages": biological_candidates,
    "resolved_biological_stage": biological_resolved,
    "candidate_water_use_stages": water_use_candidates,
    "resolved_water_use_stage": water_use_resolved,
    "lifecycle_authority_established_by_thermal_model": False,
    "production_stage_authority_established": False,
    "reason_production_not_established": [
        "DT02_AMENDMENT03_CANDIDATE_NOT_EFFECTIVE",
        "THERMAL_STAGE_AND_LIFECYCLE_MUST_BE_SEPARATELY_ADJUDICATED",
        "SECONDARY_PRODUCT_SPECIFICATION_RETAINS_LIMITATION"
    ],
    "source_results": source_results,
    "writes": 0,
    "runtime_start_authorized": False,
    "formal_v5_authorized": False,
    "a0_o00_authorized": False,
}

OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
OUT_PATH.write_text(json.dumps(result, indent=2, sort_keys=True) + "\n", encoding="utf-8")
print(json.dumps(result, indent=2, sort_keys=True))
