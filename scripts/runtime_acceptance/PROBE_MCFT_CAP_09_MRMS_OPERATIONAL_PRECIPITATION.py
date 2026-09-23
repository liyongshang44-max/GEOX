#!/usr/bin/env python3
from __future__ import annotations

import gzip
import hashlib
import html.parser
import json
import math
import os
import re
import statistics
import sys
import tempfile
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

from eccodes import codes_get, codes_grib_find_nearest, codes_grib_new_from_file, codes_release

ROOT = Path.cwd()
CONFIG_PATH = ROOT / "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-MRMS-OPERATIONAL-PRECIPITATION-QUALIFICATION-V1.json"
OUTPUT = ROOT / "acceptance-output/MCFT_CAP_09_MRMS_OPERATIONAL_PRECIPITATION_QUALIFICATION_RESULT.json"
USER_AGENT = "GEOX-MCFT-CAP09-MRMS-QUALIFICATION/1.0"
SUBJECT = os.environ.get("MCFT_SUBJECT_SHA", "").strip()


def require(condition: bool, code: str) -> None:
    if not condition:
        raise RuntimeError(code)


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def sha256_bytes(value: bytes) -> str:
    return "sha256:" + hashlib.sha256(value).hexdigest()


def safe_error(exc: BaseException) -> str:
    text = f"{type(exc).__name__}:{exc}"
    return re.sub(r"https?://\S+", "[URL_REDACTED]", text)[:500]


def write_result(value: dict) -> None:
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(value, indent=2, sort_keys=True) + "\n", encoding="utf-8")


class LinkParser(html.parser.HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.links: list[str] = []

    def handle_starttag(self, tag: str, attrs) -> None:
        if tag.lower() != "a":
            return
        for key, value in attrs:
            if key.lower() == "href" and value:
                self.links.append(str(value))


def request_bytes(url: str, max_bytes: int, accept: str = "*/*") -> tuple[bytes, dict[str, str], str]:
    parsed = urllib.parse.urlparse(url)
    require(parsed.scheme == "https" and parsed.hostname == "mrms.ncep.noaa.gov", "MRMS_QUALIFICATION_OFFICIAL_NCEP_HOST_REQUIRED")
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept": accept, "Cache-Control": "no-cache"}, method="GET")
    with urllib.request.urlopen(req, timeout=90) as response:
        require(200 <= int(response.status) < 300, f"MRMS_QUALIFICATION_HTTP_{response.status}")
        final = urllib.parse.urlparse(response.geturl())
        require(final.scheme == "https" and final.hostname == "mrms.ncep.noaa.gov", "MRMS_QUALIFICATION_REDIRECT_HOST_DRIFT")
        body = response.read(max_bytes + 1)
        require(len(body) <= max_bytes, "MRMS_QUALIFICATION_BODY_TOO_LARGE")
        headers = {str(k).lower(): str(v) for k, v in response.headers.items()}
        return body, headers, response.geturl()


def parse_file_time(filename: str, prefix: str) -> datetime:
    match = re.fullmatch(re.escape(prefix) + r"(\d{8})-(\d{6})\.grib2\.gz", filename)
    require(match is not None, f"MRMS_QUALIFICATION_FILENAME_INVALID:{filename}")
    return datetime.strptime(match.group(1) + match.group(2), "%Y%m%d%H%M%S").replace(tzinfo=timezone.utc)


def percentile(values: list[float], p: float) -> float | None:
    if not values:
        return None
    ordered = sorted(values)
    index = (len(ordered) - 1) * p
    lo = math.floor(index)
    hi = math.ceil(index)
    if lo == hi:
        return ordered[lo]
    return ordered[lo] + (ordered[hi] - ordered[lo]) * (index - lo)


def safe_get(gid, key: str):
    try:
        value = codes_get(gid, key)
        if isinstance(value, (str, int, float, bool)) or value is None:
            return value
    except Exception:
        return None
    return None


def nearest_field(point, key: str):
    if isinstance(point, dict):
        return point[key]
    return getattr(point, key)


def decode_grib(body_gz: bytes, product: dict, target: dict) -> dict:
    raw = gzip.decompress(body_gz)
    require(raw.startswith(b"GRIB"), "MRMS_QUALIFICATION_GRIB_MAGIC_REQUIRED")
    temp_path = None
    try:
        with tempfile.NamedTemporaryFile(prefix="mcft-cap09-mrms-", suffix=".grib2", delete=False) as temp:
            temp.write(raw)
            temp.flush()
            temp_path = temp.name
        with open(temp_path, "rb") as grib_file:
            gid = codes_grib_new_from_file(grib_file)
            require(gid is not None, "MRMS_QUALIFICATION_GRIB_MESSAGE_REQUIRED")
            try:
                metadata_keys = [
                    "shortName", "name", "units", "discipline", "parameterCategory", "parameterNumber",
                    "dataDate", "dataTime", "validityDate", "validityTime", "stepType", "startStep", "endStep", "stepUnits",
                    "gridType", "Ni", "Nj", "iDirectionIncrementInDegrees", "jDirectionIncrementInDegrees",
                    "latitudeOfFirstGridPointInDegrees", "longitudeOfFirstGridPointInDegrees",
                    "latitudeOfLastGridPointInDegrees", "longitudeOfLastGridPointInDegrees",
                ]
                metadata = {key: safe_get(gid, key) for key in metadata_keys}
                nearest = codes_grib_find_nearest(gid, float(target["latitude"]), float(target["longitude"]))
                require(nearest is not None and len(nearest) >= 1, "MRMS_QUALIFICATION_NEAREST_GRID_POINT_REQUIRED")
                point = nearest[0]
                value = float(nearest_field(point, "value"))
                if value == float(product["documented_missing"]):
                    value_class = "DOCUMENTED_MISSING_SENTINEL"
                elif value == float(product["documented_no_coverage"]):
                    value_class = "DOCUMENTED_NO_COVERAGE_SENTINEL"
                elif math.isfinite(value):
                    value_class = "FINITE_GRID_VALUE_PRESENT"
                else:
                    value_class = "NONFINITE_GRID_VALUE"
                return {
                    "uncompressed_sha256": sha256_bytes(raw),
                    "uncompressed_bytes": len(raw),
                    "grib_metadata": metadata,
                    "spatial_point_probe": {
                        "target_kind": target["kind"],
                        "target_latitude": target["latitude"],
                        "target_longitude": target["longitude"],
                        "nearest_grid_latitude": round(float(nearest_field(point, "lat")), 6),
                        "nearest_grid_longitude": round(float(nearest_field(point, "lon")), 6),
                        "nearest_grid_distance_km": round(float(nearest_field(point, "distance")), 6),
                        "grid_value_class": value_class,
                        "raw_grid_value_emitted": False,
                        "field_polygon_mapping_claimed": False,
                        "area_weighted_aggregation_claimed": False,
                    },
                }
            finally:
                codes_release(gid)
    finally:
        if temp_path:
            try:
                os.unlink(temp_path)
            except FileNotFoundError:
                pass


def qualify_product(product: dict, config: dict) -> dict:
    started = now_iso()
    listing_body, listing_headers, final_listing = request_bytes(product["directory"], 2_000_000, "text/html")
    parser = LinkParser()
    parser.feed(listing_body.decode("utf-8", errors="replace"))
    files: list[tuple[datetime, str]] = []
    for href in parser.links:
        name = urllib.parse.unquote(urllib.parse.urlparse(href).path.rsplit("/", 1)[-1])
        if not name.startswith(product["filename_prefix"]) or not name.endswith(".grib2.gz") or ".latest." in name:
            continue
        try:
            files.append((parse_file_time(name, product["filename_prefix"]), name))
        except RuntimeError:
            continue
    files.sort()
    require(len(files) >= int(config["retrieval_policy"]["minimum_recent_files_for_cadence"]), f"MRMS_QUALIFICATION_INSUFFICIENT_LISTING_FILES:{product['product_id']}:{len(files)}")

    sample = files[-int(config["retrieval_policy"]["recent_gap_sample_size"]):]
    gaps = [(sample[i][0] - sample[i - 1][0]).total_seconds() / 60 for i in range(1, len(sample))]
    latest_time, latest_name = files[-1]
    exact_url = urllib.parse.urljoin(final_listing, latest_name)
    retrieved_at = datetime.now(timezone.utc)
    body, headers, final_file = request_bytes(exact_url, int(config["retrieval_policy"]["maximum_compressed_bytes"]), "application/octet-stream,*/*;q=0.5")
    decoded = decode_grib(body, product, config["spatial_probe"])
    lag_seconds = int((retrieved_at - latest_time).total_seconds())
    expected = float(product["documented_frequency_minutes"])
    median_gap = statistics.median(gaps) if gaps else None
    exact_frequency_match_fraction = (sum(1 for gap in gaps if abs(gap - expected) < 1e-9) / len(gaps)) if gaps else 0.0

    return {
        "product_id": product["product_id"],
        "candidate_role": product["candidate_role"],
        "status": "PASS",
        "probe_started_at": started,
        "retrieved_at": retrieved_at.isoformat(timespec="milliseconds").replace("+00:00", "Z"),
        "directory_host": urllib.parse.urlparse(final_listing).hostname,
        "directory_path": urllib.parse.urlparse(final_listing).path,
        "listing_sha256": sha256_bytes(listing_body),
        "listing_etag_if_present": listing_headers.get("etag"),
        "listing_last_modified_if_present": listing_headers.get("last-modified"),
        "timestamped_file_count": len(files),
        "latest_event_time_from_filename": latest_time.isoformat(timespec="milliseconds").replace("+00:00", "Z"),
        "latest_exact_filename": latest_name,
        "latest_alias_used_for_download": False,
        "exact_file_host": urllib.parse.urlparse(final_file).hostname,
        "exact_file_path": urllib.parse.urlparse(final_file).path,
        "compressed_sha256": sha256_bytes(body),
        "compressed_bytes": len(body),
        "file_etag_if_present": headers.get("etag"),
        "file_last_modified_if_present": headers.get("last-modified"),
        "first_seen_at_by_geox_probe": retrieved_at.isoformat(timespec="milliseconds").replace("+00:00", "Z"),
        "first_seen_latency_upper_bound_seconds_relative_to_filename_event_time": lag_seconds,
        "documented_frequency_minutes": product["documented_frequency_minutes"],
        "documented_latency_minutes": product.get("documented_latency_minutes"),
        "recent_gap_count": len(gaps),
        "recent_gap_median_minutes": round(float(median_gap), 6) if median_gap is not None else None,
        "recent_gap_p95_minutes": round(float(percentile(gaps, 0.95)), 6) if gaps else None,
        "documented_frequency_exact_match_fraction": round(exact_frequency_match_fraction, 6),
        "documented_missing_sentinel": product["documented_missing"],
        "documented_no_coverage_sentinel": product["documented_no_coverage"],
        "raw_grid_values_emitted": False,
        **decoded,
    }


def main() -> None:
    require(re.fullmatch(r"[0-9a-f]{40}", SUBJECT) is not None, "MRMS_QUALIFICATION_EXACT_SUBJECT_SHA_REQUIRED")
    config = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
    require(config["exact_base_protected_main"] == "cf6bf3e69f2d7f40e7586308f4d846b3350efb1c", "MRMS_QUALIFICATION_BASE_DRIFT")
    results = [qualify_product(product, config) for product in config["products"]]
    output = {
        "schema_version": "geox_mcft_cap09_mrms_operational_precipitation_qualification_result_v1",
        "status": "PASS",
        "qualification_effect": "NONE",
        "subject_sha": SUBJECT,
        "provider": config["provider"],
        "product_count": len(results),
        "products": results,
        "technical_adjudication": "OPERATIONAL_PRECIPITATION_SOURCE_CANDIDATES_RETRIEVABLE_PRODUCT_SPECIFIC_SPATIAL_FIELD_MAPPING_STILL_PENDING",
        "field_polygon_spatial_mapping": "NOT_CLAIMED_BY_THIS_POINT_PROBE",
        "pass1_pass2_identity_collapsed": False,
        "raw_grid_values_emitted": False,
        "database_connection_opened": False,
        "database_write_count": 0,
        "runtime_write_count": 0,
        "scheduler_write_count": 0,
        "formal_write_count": 0,
        "runtime_authority_changed": False,
        "formal_window_started": False,
        "observed_at": now_iso(),
    }
    write_result(output)
    print(json.dumps({
        "status": output["status"],
        "product_count": output["product_count"],
        "technical_adjudication": output["technical_adjudication"],
        "raw_grid_values_emitted": False,
    }, sort_keys=True))


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        failure = {
            "schema_version": "geox_mcft_cap09_mrms_operational_precipitation_qualification_result_v1",
            "status": "FAIL",
            "qualification_effect": "NONE",
            "subject_sha": SUBJECT or None,
            "error": safe_error(exc),
            "raw_grid_values_emitted": False,
            "database_write_count": 0,
            "runtime_write_count": 0,
            "scheduler_write_count": 0,
            "formal_write_count": 0,
            "runtime_authority_changed": False,
            "formal_window_started": False,
            "observed_at": now_iso(),
        }
        write_result(failure)
        print(json.dumps(failure, sort_keys=True), file=sys.stderr)
        raise
