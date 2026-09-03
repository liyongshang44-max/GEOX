#!/usr/bin/env python3
import csv
import hashlib
import io
import json
import math
import re
import sys
import urllib.request
import urllib.error
import time
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

CONFIG_PATH = Path("docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-T4R1-THERMAL-BIOLOGICAL-STAGE-AUTHORITY-V1.json")
OUT_PATH = Path("acceptance-output/MCFT_CAP09_T4R1_THERMAL_BIOLOGICAL_STAGE_PROBE_RESULT.json")
CONFIG_MATRIX_PATH = Path("docs/digital_twin/mcft/GEOX-MCFT-00-CONFIGURATION-BINDING-MATRIX.json")

def fail(code, detail=""):
    raise RuntimeError(code + (":" + detail if detail else ""))

def fetch(url):
    last_error = None
    for attempt in range(3):
        req = urllib.request.Request(url, headers={"User-Agent": "GEOX-MCFT-CAP09-stage-authority-qualification/1.0"})
        try:
            with urllib.request.urlopen(req, timeout=30) as response:
                body = response.read()
                final_url = response.geturl()
                status = getattr(response, "status", 200)
            if status != 200:
                fail("SOURCE_HTTP_STATUS", str(status))
            return body, final_url
        except urllib.error.HTTPError as exc:
            last_error = exc
            if exc.code < 500 or attempt == 2:
                raise
        except urllib.error.URLError as exc:
            last_error = exc
            if attempt == 2:
                raise
        time.sleep(2 ** attempt)
    fail("SOURCE_FETCH_RETRY_EXHAUSTED", str(last_error))

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
brand_body, brand_final = fetch(hybrid["brand_authority_url"])
require_markers(text(brand_body), hybrid["brand_authority_required_markers"], "ALBERT_LEA_BLUE_RIVER_BRAND_AUTHORITY")
source_results["hybrid_brand_authority"] = {
    "status": "PASS_FIRST_PARTY_BRAND_OWNER_AUTHORITY",
    "final_url": brand_final,
    "response_digest": digest(brand_body),
    "response_byte_count": len(brand_body),
    "provider_body_emitted": False,
}
source_results["hybrid_thermal_landmark"] = {
    "status": "PASS_FIRST_PARTY_BRAND_OWNER_EXACT_PRODUCT_SPECIFICATION",
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

r5_model = config["r5_residual_to_maturity_model"]
for source in r5_model["sources"]:
    body, final_url = fetch(source["official_url"])
    require_markers(text(body), source["required_markers"], source["source_id"])
    source_results[source["source_id"]] = {
        "status": "PASS",
        "final_url": final_url,
        "response_digest": digest(body),
        "response_byte_count": len(body),
        "role": source["role"],
        "provider_body_emitted": False,
    }

r5_reference = float(r5_model["regional_reference_envelope"]["conservative_r5_reference_min_gdu_to_maturity"])
remaining_lower = max(0.0, threshold - upper)
remaining_upper = max(0.0, threshold - lower)

if lower >= threshold:
    biological_candidates = ["R6_OR_LATER_MODEL_ESTIMATE"]
    biological_resolved = biological_candidates[0]
    water_use_candidates = ["LATE"]
    water_use_resolved = "LATE"
    candidate_outcome = "THERMAL_STAGE_R6_OR_LATER_LATE_CANDIDATE"
elif upper >= threshold:
    biological_candidates = ["R5_DENT_OR_LATER_PRE_R6_MODEL_ESTIMATE", "R6_OR_LATER_MODEL_ESTIMATE"]
    biological_resolved = None
    water_use_candidates = ["LATE"]
    water_use_resolved = "LATE"
    candidate_outcome = "THERMAL_STAGE_THRESHOLD_STRADDLE_LATE_CANDIDATE"
elif remaining_upper < r5_reference:
    biological_candidates = ["R5_DENT_OR_LATER_PRE_R6_MODEL_ESTIMATE"]
    biological_resolved = biological_candidates[0]
    water_use_candidates = ["LATE"]
    water_use_resolved = "LATE"
    candidate_outcome = "THERMAL_STAGE_R5_DENT_OR_LATER_LATE_CANDIDATE"
else:
    biological_candidates = ["PRE_R5_MODEL_ESTIMATE", "R5_DENT_OR_LATER_PRE_R6_MODEL_ESTIMATE"]
    biological_resolved = None
    water_use_candidates = ["MID", "LATE"]
    water_use_resolved = None
    candidate_outcome = "THERMAL_STAGE_PRE_R5_WATER_USE_UNRESOLVED"

kc_binding = config["crop_model_parameter_binding"]
matrix = json.loads(CONFIG_MATRIX_PATH.read_text(encoding="utf-8"))
sources = [
    row for row in matrix.get("configuration_source_definitions", [])
    if row.get("configuration_source_id") == kc_binding["configuration_source_id"]
]
if len(sources) != 1:
    fail("KC_CONFIGURATION_SOURCE_EXACT_SINGLETON_REQUIRED")
kc_source = sources[0]
if kc_source.get("configuration_semantic_hash") != kc_binding["configuration_semantic_hash"]:
    fail("KC_CONFIGURATION_SEMANTIC_HASH_DRIFT")
schedule = kc_source.get("parameters", {}).get("kc_schedule", {}).get("value")
if not isinstance(schedule, list) or not schedule:
    fail("KC_SCHEDULE_REQUIRED")

resolved_kc = None
if water_use_resolved is not None:
    matches = [row for row in schedule if row.get("stage_code") == water_use_resolved]
    if len(matches) != 1:
        fail("KC_STAGE_EXACT_SINGLETON_LOOKUP_REQUIRED", str(water_use_resolved))
    try:
        resolved_kc = float(matches[0]["kc"])
    except Exception:
        fail("KC_VALUE_INVALID", str(matches[0].get("kc")))
    if not math.isfinite(resolved_kc) or resolved_kc < 0:
        fail("KC_VALUE_INVALID", str(resolved_kc))

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
        "remaining_gdu_lower": round(remaining_lower, 6),
        "remaining_gdu_upper": round(remaining_upper, 6),
        "conservative_r5_reference_min_remaining_gdu": r5_reference,
    },
    "candidate_biological_stages": biological_candidates,
    "resolved_biological_stage": biological_resolved,
    "candidate_water_use_stages": water_use_candidates,
    "resolved_water_use_stage": water_use_resolved,
    "candidate_crop_model_parameter_authority": {
        "status": "RESOLVED_CANDIDATE" if resolved_kc is not None else "UNRESOLVED",
        "parameter": "Kc",
        "stage_code": water_use_resolved,
        "value": resolved_kc,
        "configuration_source_id": kc_binding["configuration_source_id"],
        "configuration_semantic_hash": kc_binding["configuration_semantic_hash"],
        "production_effective": False,
    },
    "lifecycle_authority_established_by_thermal_model": False,
    "production_stage_authority_established": False,
    "candidate_water_use_stage_authority_established": water_use_resolved is not None,
    "reason_production_not_established": [
        "DT02_AMENDMENT03_CANDIDATE_NOT_EFFECTIVE",
        "THERMAL_STAGE_AND_LIFECYCLE_MUST_BE_SEPARATELY_ADJUDICATED",
        "RUNTIME_CONSUMPTION_REQUIRES_SEPARATE_EFFECTIVENESS_AND_LIFECYCLE_GUARD"
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
