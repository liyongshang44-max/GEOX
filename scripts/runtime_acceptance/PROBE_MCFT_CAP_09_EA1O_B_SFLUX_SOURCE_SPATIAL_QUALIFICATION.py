#!/usr/bin/env python3
from __future__ import annotations

import csv
import hashlib
import io
import json
import math
import os
import re
import subprocess
import tempfile
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path
from typing import Any
from urllib.error import HTTPError
from urllib.request import Request, urlopen

from eccodes import (
    codes_get,
    codes_get_array,
    codes_grib_find_nearest,
    codes_grib_new_from_file,
    codes_release,
)

ROOT = Path.cwd()
AUTHORITY_PATH = ROOT / "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA1O-B-SFLUX-SOURCE-SPATIAL-QUALIFICATION-V1.json"
EA1K_RESULT_PATH = ROOT / "acceptance-output/MCFT_CAP_09_EA1K_GFS_EXACT_CYCLE_72H_AUTHORITY_RESULT.json"
OUTPUT_PATH = ROOT / "acceptance-output/MCFT_CAP_09_EA1O_B_SFLUX_SOURCE_SPATIAL_QUALIFICATION_RESULT.json"
USER_AGENT = "GEOX-MCFT-CAP09-EA1O-B-SFLUX-PROBE/1.0"
REQUEST_TIMEOUT = 45
MAX_IDX_BYTES = 2_000_000
MAX_MESSAGE_BYTES = 12_000_000
CONCURRENCY = 8
EARTH_RADIUS_M = 6371008.8


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
    value = re.sub(r"-?\d+\.\d{5,}", "[COORD_OR_VALUE_REDACTED]", value)
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


def fetch_bytes(url: str, code: str, max_bytes: int, extra_headers: dict[str, str] | None = None) -> tuple[bytes, Any, int]:
    headers = {"User-Agent": USER_AGENT, "Accept": "*/*"}
    if extra_headers:
        headers.update(extra_headers)
    request = Request(url, headers=headers, method="GET")
    with urlopen(request, timeout=REQUEST_TIMEOUT) as response:
        status = int(getattr(response, "status", 200))
        data = response.read(max_bytes + 1)
        require(len(data) <= max_bytes, f"{code}_BODY_TOO_LARGE")
        return data, response.headers, status


def object_metadata(url: str, code: str) -> tuple[datetime, int | None]:
    request = Request(url, headers={"User-Agent": USER_AGENT}, method="HEAD")
    try:
        with urlopen(request, timeout=REQUEST_TIMEOUT) as response:
            modified = http_time(response.headers, code)
            length_raw = response.headers.get("Content-Length")
            length = int(length_raw) if length_raw and length_raw.isdigit() else None
            return modified, length
    except HTTPError as exc:
        if exc.code not in (403, 405):
            raise
    data, headers, status = fetch_bytes(url, code + "_RANGE0", 16, {"Range": "bytes=0-0"})
    require(status == 206 and len(data) == 1, f"{code}_RANGE0_REQUIRED")
    modified = http_time(headers, code)
    content_range = headers.get("Content-Range", "")
    match = re.match(r"bytes\s+0-0/(\d+)$", content_range)
    length = int(match.group(1)) if match else None
    return modified, length


def pad_lead(value: int) -> str:
    return str(value).zfill(3)


def cycle_parts(cycle: datetime) -> tuple[str, str]:
    return cycle.strftime("%Y%m%d"), cycle.strftime("%H")


def sflux_urls(authority: dict[str, Any], cycle: datetime, lead: int) -> tuple[str, str]:
    ymd, hour = cycle_parts(cycle)
    filename = f"gfs.t{hour}z.sfluxgrbf{pad_lead(lead)}.grib2"
    base = f"{authority['source_candidate']['production_root']}/gfs.{ymd}/{hour}/atmos/{filename}"
    return base, base + authority["source_candidate"]["index_object_suffix"]


def parse_idx(text: str, lead: int) -> tuple[dict[str, Any], int]:
    rows: list[dict[str, Any]] = []
    for raw in text.splitlines():
        line = raw.strip()
        if not line:
            continue
        parts = line.split(":")
        if len(parts) < 5 or not parts[0].isdigit() or not parts[1].isdigit():
            continue
        rows.append({"record": int(parts[0]), "offset": int(parts[1]), "parts": parts, "line": line})
    require(len(rows) > 1, f"EA1OB_F{lead:03d}_IDX_RECORDS_REQUIRED")
    eligible: list[dict[str, Any]] = []
    forbidden_fcst_count = 0
    expected_average = f"{lead - 1}-{lead} hour ave fcst"
    expected_fcst = f"{lead} hour fcst"
    for index, row in enumerate(rows):
        parts = row["parts"]
        try:
            var_index = parts.index("DSWRF")
        except ValueError:
            continue
        if var_index + 2 >= len(parts) or parts[var_index + 1] != "surface":
            continue
        descriptor = parts[var_index + 2].strip().lower()
        if descriptor == expected_fcst.lower():
            forbidden_fcst_count += 1
        if descriptor == expected_average.lower():
            require(index + 1 < len(rows), f"EA1OB_F{lead:03d}_ELIGIBLE_RECORD_CANNOT_BE_LAST_IDX_RECORD")
            next_offset = rows[index + 1]["offset"]
            require(next_offset > row["offset"], f"EA1OB_F{lead:03d}_IDX_OFFSET_ORDER_INVALID")
            eligible.append({
                "offset": row["offset"],
                "end_offset": next_offset - 1,
                "length": next_offset - row["offset"],
                "line_sha256": sha256_text(row["line"]),
                "descriptor": descriptor,
            })
    require(len(eligible) == 1, f"EA1OB_F{lead:03d}_DIRECT_1H_DSWRF_MATCH_COUNT_{len(eligible)}")
    require(eligible[0]["length"] <= MAX_MESSAGE_BYTES, f"EA1OB_F{lead:03d}_MESSAGE_TOO_LARGE")
    return eligible[0], forbidden_fcst_count


def fetch_lead_inventory(authority: dict[str, Any], cycle: datetime, lead: int, tick: datetime) -> dict[str, Any]:
    grib_url, idx_url = sflux_urls(authority, cycle, lead)
    idx_bytes, idx_headers, idx_status = fetch_bytes(idx_url, f"EA1OB_F{lead:03d}_IDX", MAX_IDX_BYTES, {"Accept": "text/plain,*/*;q=0.5"})
    require(idx_status == 200, f"EA1OB_F{lead:03d}_IDX_HTTP_{idx_status}")
    idx_modified = http_time(idx_headers, f"EA1OB_F{lead:03d}_IDX")
    grib_modified, grib_length = object_metadata(grib_url, f"EA1OB_F{lead:03d}_GRIB")
    require(idx_modified <= tick, f"EA1OB_F{lead:03d}_IDX_PUBLISHED_AFTER_TICK")
    require(grib_modified <= tick, f"EA1OB_F{lead:03d}_GRIB_PUBLISHED_AFTER_TICK")
    text = idx_bytes.decode("utf-8")
    require(not re.match(r"^\s*<(?:!doctype|html)", text, re.I), f"EA1OB_F{lead:03d}_IDX_HTML_FORBIDDEN")
    selected, forbidden_count = parse_idx(text, lead)
    if grib_length is not None:
        require(selected["end_offset"] < grib_length, f"EA1OB_F{lead:03d}_RANGE_EXCEEDS_OBJECT")
    return {
        "lead": lead,
        "grib_url": grib_url,
        "idx_sha256": sha256_bytes(idx_bytes),
        "idx_modified": idx_modified,
        "grib_modified": grib_modified,
        "grib_length": grib_length,
        "selected": selected,
        "forbidden_fcst_count": forbidden_count,
    }


def fetch_message(entry: dict[str, Any]) -> bytes:
    lead = entry["lead"]
    selected = entry["selected"]
    range_header = f"bytes={selected['offset']}-{selected['end_offset']}"
    data, headers, status = fetch_bytes(entry["grib_url"], f"EA1OB_F{lead:03d}_MESSAGE", MAX_MESSAGE_BYTES, {"Range": range_header})
    require(status == 206, f"EA1OB_F{lead:03d}_RANGE_HTTP_{status}")
    require(len(data) == selected["length"], f"EA1OB_F{lead:03d}_RANGE_LENGTH_MISMATCH")
    content_range = headers.get("Content-Range", "")
    require(content_range.startswith(f"bytes {selected['offset']}-{selected['end_offset']}/"), f"EA1OB_F{lead:03d}_CONTENT_RANGE_MISMATCH")
    require(data.startswith(b"GRIB") and data.endswith(b"7777"), f"EA1OB_F{lead:03d}_EXACT_GRIB_MESSAGE_BOUNDARY_REQUIRED")
    return data


def parse_polygon(raw: str, required_srid: int) -> list[tuple[float, float]]:
    value = raw.strip()
    match = re.match(r"^SRID=(\d+);POLYGON\(\(([^()]+)\)\)$", value, re.I)
    require(bool(match), "EA1OB_SIMPLE_EWKT_POLYGON_REQUIRED")
    require(int(match.group(1)) == required_srid, "EA1OB_POLYGON_SRID_MISMATCH")
    points: list[tuple[float, float]] = []
    for token in match.group(2).split(","):
        values = token.strip().split()
        require(len(values) == 2, "EA1OB_POLYGON_COORDINATE_INVALID")
        lon, lat = float(values[0]), float(values[1])
        require(-180 <= lon <= 180 and -90 <= lat <= 90, "EA1OB_POLYGON_COORDINATE_OUT_OF_RANGE")
        points.append((lon, lat))
    require(len(points) >= 4 and points[0] == points[-1], "EA1OB_POLYGON_CLOSED_REQUIRED")
    vertices = points[:-1]
    require(len(vertices) >= 3, "EA1OB_POLYGON_VERTICES_REQUIRED")
    return vertices


def polygon_centroid(vertices: list[tuple[float, float]]) -> tuple[float, float]:
    twice_area = 0.0
    cx = 0.0
    cy = 0.0
    for index, (x1, y1) in enumerate(vertices):
        x2, y2 = vertices[(index + 1) % len(vertices)]
        cross = x1 * y2 - x2 * y1
        twice_area += cross
        cx += (x1 + x2) * cross
        cy += (y1 + y2) * cross
    require(abs(twice_area) > 1e-12, "EA1OB_POLYGON_AREA_DEGENERATE")
    return cx / (3.0 * twice_area), cy / (3.0 * twice_area)


def haversine_m(a: tuple[float, float], b: tuple[float, float]) -> float:
    lon1, lat1 = a
    lon2, lat2 = b
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    h = math.sin(dlat / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlon / 2) ** 2
    return 2 * EARTH_RADIUS_M * math.asin(min(1.0, math.sqrt(h)))


def normalize_key(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", str(value or "").lstrip("\ufeff").strip().lower()).strip("_")


def parse_kbs_table(text: str, required_columns: tuple[str, ...]) -> list[dict[str, str]]:
    lines = text.splitlines()
    delimiters = (",", "\t", ";", "|")
    headers: list[str] | None = None
    delimiter: str | None = None
    header_index = -1
    nonempty = 0
    for index, line in enumerate(lines):
        if not line.strip():
            continue
        nonempty += 1
        if nonempty > 40:
            break
        for candidate in delimiters:
            cells = next(csv.reader([line], delimiter=candidate))
            normalized = [normalize_key(cell) for cell in cells]
            if all(column in normalized for column in required_columns):
                headers = normalized
                delimiter = candidate
                header_index = index
                break
        if headers is not None:
            break
    require(headers is not None and delimiter is not None and header_index >= 0, "EA1OB_KBS_REQUIRED_CSV_HEADER_NOT_FOUND")
    rows: list[dict[str, str]] = []
    for cells in csv.reader(lines[header_index + 1 :], delimiter=delimiter):
        if not any(str(cell).strip() for cell in cells):
            continue
        if len(cells) < len(headers):
            continue
        rows.append({header: cells[index] if index < len(cells) else "" for index, header in enumerate(headers)})
    require(bool(rows), "EA1OB_KBS_CSV_ROWS_REQUIRED")
    return rows


def load_current_kbs_geometry(authority: dict[str, Any]) -> tuple[list[tuple[float, float]], dict[str, Any]]:
    source = authority["site_geometry_source"]
    csv_bytes, _, status = fetch_bytes(source["download_url"], "EA1OB_KBS_GEOMETRY", 20 * 1024 * 1024, {"Accept": "text/csv,text/plain;q=0.9,*/*;q=0.5"})
    require(status == 200, f"EA1OB_KBS_CSV_HTTP_{status}")
    text = csv_bytes.decode("utf-8-sig")
    require(not re.match(r"^\s*<(?:!doctype|html)", text, re.I), "EA1OB_KBS_CSV_HTML_FORBIDDEN")
    rows = parse_kbs_table(text, ("treatment", "replicate", "subplot", "geometry"))
    target = source["selected_row"]
    matches: list[dict[str, str]] = []
    for row in rows:
        treatment = str(row.get("treatment", "")).strip().upper()
        replicate = str(row.get("replicate", "")).strip().upper()
        subplot = str(row.get("subplot", "")).strip().lower()
        if treatment == target["treatment"] and replicate == target["replicate"] and subplot == target["subplot"]:
            matches.append(row)
    require(len(matches) == target["expected_match_count"], f"EA1OB_KBS_TARGET_ROW_MATCH_COUNT_{len(matches)}")
    raw_geometry = str(matches[0].get("geometry", "")).strip()
    vertices = parse_polygon(raw_geometry, source["required_srid"])
    diameter = max(haversine_m(a, b) for i, a in enumerate(vertices) for b in vertices[i + 1 :])
    row_material = "|".join([target["treatment"], target["replicate"], target["subplot"], raw_geometry])
    return vertices, {
        "csv_sha256": sha256_bytes(csv_bytes),
        "selected_row_sha256": sha256_text(row_material),
        "polygon_unique_vertex_count": len(vertices),
        "polygon_diameter_m": round(diameter, 3),
    }


def get_optional(gid: int, key: str) -> Any:
    try:
        return codes_get(gid, key)
    except Exception:
        return None


def grid_definition(gid: int) -> dict[str, Any]:
    keys = [
        "gridType",
        "N",
        "Ni",
        "Nj",
        "numberOfDataPoints",
        "latitudeOfFirstGridPointInDegrees",
        "longitudeOfFirstGridPointInDegrees",
        "latitudeOfLastGridPointInDegrees",
        "longitudeOfLastGridPointInDegrees",
        "iScansNegatively",
        "jScansPositively",
        "jPointsAreConsecutive",
        "alternativeRowScanning",
    ]
    result = {key: get_optional(gid, key) for key in keys}
    try:
        pl = codes_get_array(gid, "pl")
        result["pl_count"] = len(pl)
        result["pl_sha256"] = sha256_text("\n".join(str(int(value)) for value in pl))
    except Exception:
        result["pl_count"] = 0
        result["pl_sha256"] = None
    return result


def signed_lon(value: float) -> float:
    normalized = value % 360.0
    return normalized - 360.0 if normalized > 180.0 else normalized


def decode_message(message: bytes, lead: int, centroid: tuple[float, float], vertices: list[tuple[float, float]]) -> dict[str, Any]:
    with tempfile.TemporaryFile() as handle:
        handle.write(message)
        handle.seek(0)
        gid = codes_grib_new_from_file(handle)
        require(gid is not None, f"EA1OB_F{lead:03d}_ECCODES_MESSAGE_REQUIRED")
        try:
            short_name = str(codes_get(gid, "shortName")).lower()
            type_of_level = str(codes_get(gid, "typeOfLevel")).lower()
            step_type = str(codes_get(gid, "stepType")).lower()
            start_step = int(codes_get(gid, "startStep"))
            end_step = int(codes_get(gid, "endStep"))
            units = str(codes_get(gid, "units"))
            require(short_name == "dswrf", f"EA1OB_F{lead:03d}_SHORTNAME_DRIFT")
            require(type_of_level == "surface", f"EA1OB_F{lead:03d}_LEVEL_DRIFT")
            require(step_type == "avg", f"EA1OB_F{lead:03d}_STEPTYPE_NOT_AVG")
            require(start_step == lead - 1 and end_step == lead, f"EA1OB_F{lead:03d}_STEP_WINDOW_MISMATCH")
            require(units in ("W m**-2", "W/m^2", "W m-2"), f"EA1OB_F{lead:03d}_UNITS_DRIFT")

            centroid_nearest = codes_grib_find_nearest(gid, centroid[1], centroid[0])[0]
            vertex_nearest = [codes_grib_find_nearest(gid, vertex[1], vertex[0])[0] for vertex in vertices]
            selected_index = int(centroid_nearest.index)
            require(all(int(item.index) == selected_index for item in vertex_nearest), f"EA1OB_F{lead:03d}_POLYGON_CROSSES_NATIVE_NEAREST_PARTITION")
            value = float(centroid_nearest.value)
            require(math.isfinite(value), f"EA1OB_F{lead:03d}_VALUE_NOT_FINITE")
            require(value >= 0.0, f"EA1OB_F{lead:03d}_NEGATIVE_DSWRF_FAIL_CLOSED")
            definition = grid_definition(gid)
            definition_digest = sha256_text(json.dumps(definition, sort_keys=True, separators=(",", ":")))
            max_vertex_distance_km = max(float(item.distance) for item in vertex_nearest)
            return {
                "value": value,
                "selected_index": selected_index,
                "selected_lat": float(centroid_nearest.lat),
                "selected_native_lon": float(centroid_nearest.lon),
                "selected_signed_lon": signed_lon(float(centroid_nearest.lon)),
                "centroid_distance_km": float(centroid_nearest.distance),
                "max_vertex_distance_km": max_vertex_distance_km,
                "grid_definition": definition,
                "grid_definition_digest": definition_digest,
            }
        finally:
            codes_release(gid)


def main() -> None:
    subject_sha = os.environ.get("MCFT_SUBJECT_SHA", "").strip()
    require(bool(re.fullmatch(r"[0-9a-f]{40}", subject_sha)), "EA1OB_EXACT_SUBJECT_SHA_REQUIRED")
    require(git("rev-parse", "HEAD") == subject_sha, "EA1OB_SUBJECT_SHA_NOT_CHECKED_OUT_HEAD")
    authority = json.loads(AUTHORITY_PATH.read_text(encoding="utf-8"))
    require(authority["base_main_sha"] == "ce38bc250fb9ddb1aabd0475baafc85939046695", "EA1OB_BASE_MAIN_DRIFT")

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

    vertices, geometry_safe = load_current_kbs_geometry(authority)
    centroid = polygon_centroid(vertices)
    leads = list(range(lead_start, lead_end + 1))

    inventories: list[dict[str, Any]] = []
    with ThreadPoolExecutor(max_workers=CONCURRENCY) as pool:
        futures = {pool.submit(fetch_lead_inventory, authority, cycle, lead, tick): lead for lead in leads}
        for future in as_completed(futures):
            inventories.append(future.result())
    inventories.sort(key=lambda item: item["lead"])
    require([item["lead"] for item in inventories] == leads, "EA1OB_INVENTORY_LEAD_ORDER_MISMATCH")

    messages: dict[int, bytes] = {}
    with ThreadPoolExecutor(max_workers=CONCURRENCY) as pool:
        futures = {pool.submit(fetch_message, entry): entry["lead"] for entry in inventories}
        for future in as_completed(futures):
            lead = futures[future]
            messages[lead] = future.result()
    require(sorted(messages) == leads, "EA1OB_MESSAGE_LEAD_SET_MISMATCH")

    decoded: list[dict[str, Any]] = []
    message_hashes: list[str] = []
    for entry in inventories:
        lead = entry["lead"]
        message = messages.pop(lead)
        message_hashes.append(sha256_bytes(message))
        decoded_entry = decode_message(message, lead, centroid, vertices)
        decoded_entry["lead"] = lead
        decoded.append(decoded_entry)

    first = decoded[0]
    grid_digest = first["grid_definition_digest"]
    selected_index = first["selected_index"]
    selected_lat = first["selected_lat"]
    selected_lon = first["selected_native_lon"]
    for item in decoded:
        require(item["grid_definition_digest"] == grid_digest, f"EA1OB_F{item['lead']:03d}_GRID_DEFINITION_DRIFT")
        require(item["selected_index"] == selected_index, f"EA1OB_F{item['lead']:03d}_SELECTED_NATIVE_INDEX_DRIFT")
        require(abs(item["selected_lat"] - selected_lat) < 1e-10, f"EA1OB_F{item['lead']:03d}_SELECTED_LAT_DRIFT")
        require(abs(item["selected_native_lon"] - selected_lon) < 1e-10, f"EA1OB_F{item['lead']:03d}_SELECTED_LON_DRIFT")

    values = [item["value"] for item in decoded]
    value_hash = sha256_text("\n".join(format(value, ".17g") for value in values))
    idx_chain = sha256_text("\n".join(item["idx_sha256"] + "|" + item["selected"]["line_sha256"] for item in inventories))
    message_chain = sha256_text("\n".join(message_hashes))
    last_modified_values = [item["idx_modified"] for item in inventories] + [item["grib_modified"] for item in inventories]
    max_centroid_distance = max(item["centroid_distance_km"] for item in decoded)
    max_vertex_distance = max(item["max_vertex_distance_km"] for item in decoded)
    forbidden_count = sum(item["forbidden_fcst_count"] for item in inventories)

    result = {
        "schema_version": "geox_mcft_cap09_ea1o_b_sflux_source_spatial_qualification_result_v1",
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
            "canonical_point_count": 72,
        },
        "source_qualification": {
            "product_family": "sflux",
            "parameter": "DSWRF",
            "level": "surface",
            "required_statistical_semantics": "DIRECT_PRECEDING_ONE_HOUR_AVERAGE",
            "required_object_count": 72,
            "available_before_tick_count": 72,
            "unique_direct_1h_average_record_count": 72,
            "forbidden_n_hour_fcst_record_presence_count": forbidden_count,
            "minimum_object_last_modified_utc": min(last_modified_values).isoformat().replace("+00:00", "Z"),
            "maximum_object_last_modified_utc": max(last_modified_values).isoformat().replace("+00:00", "Z"),
            "idx_and_selected_record_chain_sha256": idx_chain,
            "exact_grib_message_chain_sha256": message_chain,
            "full_global_grib_download_performed": False,
            "future_file_wait_performed": False,
            "valid_time_rewrite_performed": False,
        },
        "live_sflux_spatial_authority_candidate": {
            "grid_type": first["grid_definition"].get("gridType"),
            "grid_definition_sha256": grid_digest,
            "gaussian_n": first["grid_definition"].get("N"),
            "grid_point_count": first["grid_definition"].get("numberOfDataPoints"),
            "pl_count": first["grid_definition"].get("pl_count"),
            "pl_sha256": first["grid_definition"].get("pl_sha256"),
            "selection_method": "NONE_NEAREST_NATIVE_GRID_POINT",
            "selected_native_grid_index": selected_index,
            "selected_native_grid_latitude": selected_lat,
            "selected_native_grid_longitude": selected_lon,
            "selected_signed_grid_longitude": first["selected_signed_lon"],
            "maximum_centroid_to_selected_point_distance_km": round(max_centroid_distance, 6),
            "maximum_vertex_to_selected_point_distance_km": round(max_vertex_distance, 6),
            "centroid_and_all_vertices_same_native_point_for_all_72_messages": True,
            "direct_field_equivalence": False,
            "model_grid_is_observation_truth": False,
            "pgrb2_grid_coordinate_reused": False,
            "interpolation_performed": False,
        },
        "site_geometry_evidence": {
            **geometry_safe,
            "raw_polygon_emitted": False,
            "centroid_coordinate_emitted": False,
            "raw_kbs_row_emitted": False,
        },
        "value_sanity": {
            "decoded_message_count": 72,
            "finite_value_count": 72,
            "nonnegative_value_count": 72,
            "negative_clipping_performed": False,
            "zero_thresholding_performed": False,
            "silent_imputation_performed": False,
            "decoded_values_emitted": False,
            "normalized_value_sequence_sha256": value_hash,
        },
        "qualification_effect": "EA1O_B_LIVE_SFLUX_SOURCE_AND_SPATIAL_QUALIFICATION_CANDIDATE_PASS",
        "sflux_source_authority_candidate_qualified": True,
        "sflux_spatial_authority_candidate_qualified": True,
        "future_et0_executed": False,
        "database_write_count": 0,
        "formal_evidence_write_count": 0,
        "canonical_evidence_write_count": 0,
        "runtime_product_source_delta_count": 0,
        "formal_window_started": False,
        "mcft_cap09_completed": False,
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
            "schema_version": "geox_mcft_cap09_ea1o_b_sflux_source_spatial_qualification_result_v1",
            "status": "FAIL",
            "error": safe_error(exc),
            "raw_provider_payload_emitted": False,
            "decoded_values_emitted": False,
            "database_write_count": 0,
            "formal_evidence_write_count": 0,
            "formal_window_started": False,
        }
        OUTPUT_PATH.write_text(json.dumps(failure, indent=2, sort_keys=True) + "\n", encoding="utf-8")
        raise
