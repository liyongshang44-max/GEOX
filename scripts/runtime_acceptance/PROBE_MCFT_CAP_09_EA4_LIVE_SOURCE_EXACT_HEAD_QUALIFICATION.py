#!/usr/bin/env python3
from __future__ import annotations

import csv
import hashlib
import importlib.util
import json
import math
import os
import re
import sys
import tempfile
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
from importlib.metadata import version as package_version
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import unquote, urlencode, urlparse
from urllib.request import Request, urlopen

import eccodes

ROOT = Path.cwd()
AUTH_PATH = ROOT / "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA4-LIVE-SOURCE-EXACT-HEAD-QUALIFICATION-V1.json"
OUT = ROOT / "acceptance-output/MCFT_CAP_09_EA4_LIVE_SOURCE_EXACT_HEAD_QUALIFICATION_RESULT.json"
AUTH = json.loads(AUTH_PATH.read_text(encoding="utf-8"))
SUBJECT_SHA = os.environ.get("MCFT_SUBJECT_SHA", "").strip()
USER_AGENT = "GEOX-MCFT-CAP09-EA4-LIVE-PROOF/1.0"
PRIVATE_ROOT = Path(tempfile.mkdtemp(prefix="mcft-cap09-ea4-private-raw-"))
PRODUCTION_ROOT = AUTH["gfs"]["production_root"]
FILTER_ENDPOINT = AUTH["gfs"]["pgrb2_filter"]
POINT_COUNT = int(AUTH["gfs"]["point_count"])
MAX_LEAD = int(AUTH["gfs"]["max_lead"])
GRID_LAT = float(AUTH["gfs"]["pgrb2_grid_latitude"])
GRID_LON = float(AUTH["gfs"]["pgrb2_grid_longitude_native"])
WIND_FACTOR = float(AUTH["gfs"]["wind_10m_to_2m_factor"])
SOLAR_FACTOR = 0.0036
CONCURRENCY = 8
MAX_IDX_BYTES = 2_000_000
MAX_SFLUX_MESSAGE_BYTES = 12_000_000

GFS_CORE_PATH = ROOT / "apps/server/src/external_evidence/provider/python/mcft_cap09_gfs_scientific_core_v1.py"
GFS_SPEC = importlib.util.spec_from_file_location("mcft_cap09_gfs_scientific_core_v1", GFS_CORE_PATH)
if GFS_SPEC is None or GFS_SPEC.loader is None:
    raise RuntimeError("EA4_PRODUCT_GFS_CORE_LOAD_FAILED")
gfs_core = importlib.util.module_from_spec(GFS_SPEC)
sys.modules[GFS_SPEC.name] = gfs_core
GFS_SPEC.loader.exec_module(gfs_core)
GFS_AUTHORITY = gfs_core.GfsScientificAuthorityV1(
    point_count=POINT_COUNT,
    max_lead=MAX_LEAD,
    pgrb2_grid_latitude=GRID_LAT,
    pgrb2_grid_longitude_native=GRID_LON,
    wind_10m_to_2m_factor=WIND_FACTOR,
    station_elevation_m=float(AUTH["kbs"]["elevation_m"]),
    station_latitude=float(AUTH["kbs"]["station_latitude"]),
    station_longitude=float(AUTH["kbs"]["station_longitude"]),
    solar_native_index=int(AUTH["gfs"]["solar_native_index"]),
    solar_native_latitude=float(AUTH["gfs"]["solar_native_latitude"]),
    solar_native_longitude_signed=float(AUTH["gfs"]["solar_native_longitude_signed"]),
    solar_w_m2_to_mj_m2_h_factor=SOLAR_FACTOR,
)

ANCHOR_RE = re.compile(r'<a\b[^>]*href\s*=\s*["\'](?P<href>[^"\']+)["\'][^>]*>.*?</a>', re.I | re.S)
OBJECT_RE = re.compile(r'gfs\.t\d{2}z\.(?:pgrb2\.0p25\.f\d{3}|sfluxgrbf\d{3}\.grib2)(?:\.idx)?', re.I)
STAMP_RE = re.compile(r'\b(?P<stamp>\d{2}-[A-Za-z]{3}-\d{4}\s+\d{2}:\d{2})\b')
SIZE_RE = re.compile(r'\b(?P<size>[0-9]+(?:\.[0-9]+)?[KMGTP]?)\b', re.I)
TAG_RE = re.compile(r'<[^>]+>', re.S)

receipts: list[dict] = []


def require(condition: bool, code: str) -> None:
    if not condition:
        raise RuntimeError(code)


def iso(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


def floor_hour(dt: datetime) -> datetime:
    return dt.astimezone(timezone.utc).replace(minute=0, second=0, microsecond=0)


def sha256_bytes(body: bytes) -> str:
    return "sha256:" + hashlib.sha256(body).hexdigest()


def sha256_json(value) -> str:
    return sha256_bytes(json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=True).encode("utf-8"))


def retain_raw(kind: str, identity: str, body: bytes) -> dict:
    digest = sha256_bytes(body)
    filename = hashlib.sha256((kind + "|" + identity).encode("utf-8")).hexdigest() + ".raw"
    path = PRIVATE_ROOT / filename
    path.write_bytes(body)
    reread = path.read_bytes()
    require(sha256_bytes(reread) == digest, f"EA4_RETENTION_DIGEST_MISMATCH:{kind}")
    require(len(reread) == len(body), f"EA4_RETENTION_BYTES_MISMATCH:{kind}")
    receipt = {"kind": kind, "identity_sha256": sha256_bytes(identity.encode("utf-8")), "sha256": digest, "bytes": len(body)}
    receipts.append(receipt)
    return receipt


def request_bytes(url: str, code: str, max_bytes: int, headers: dict[str, str] | None = None, attempts: int = 4):
    parsed = urlparse(url)
    require(parsed.scheme == "https", f"{code}_HTTPS_REQUIRED")
    last = None
    for attempt in range(attempts):
        try:
            request_headers = {"User-Agent": USER_AGENT, "Accept": "*/*", "Cache-Control": "no-cache"}
            if headers:
                request_headers.update(headers)
            req = Request(url, headers=request_headers, method="GET")
            with urlopen(req, timeout=90) as response:
                body = response.read(max_bytes + 1)
                require(len(body) <= max_bytes, f"{code}_BODY_TOO_LARGE")
                final = urlparse(response.geturl())
                require(final.scheme == "https", f"{code}_FINAL_HTTPS_REQUIRED")
                return int(response.status), response.headers, body, response.geturl()
        except (HTTPError, URLError, TimeoutError) as exc:
            last = exc
            if attempt + 1 < attempts:
                time.sleep(0.75 * (attempt + 1))
    raise RuntimeError(f"{code}_HTTP_FAILED:{type(last).__name__}")


def http_last_modified(headers, code: str) -> datetime:
    raw = headers.get("Last-Modified")
    require(bool(raw), f"{code}_LAST_MODIFIED_REQUIRED")
    parsed = parsedate_to_datetime(raw)
    require(parsed.tzinfo is not None, f"{code}_LAST_MODIFIED_TZ_REQUIRED")
    return parsed.astimezone(timezone.utc)


def parse_size(token: str) -> float:
    match = re.fullmatch(r"([0-9]+(?:\.[0-9]+)?)([KMGTP]?)", token.strip(), re.I)
    require(bool(match), "EA4_DIRECTORY_SIZE_UNPARSEABLE")
    factor = {"": 1, "K": 1024, "M": 1024**2, "G": 1024**3, "T": 1024**4, "P": 1024**5}[match.group(2).upper()]
    return float(match.group(1)) * factor


def parse_directory(body: bytes):
    text = body.decode("utf-8", errors="strict")
    anchors = list(ANCHOR_RE.finditer(text))
    entries: dict[str, list[dict]] = {}
    for index, anchor in enumerate(anchors):
        href = anchor.group("href")
        basename = unquote(urlparse(href).path.rsplit("/", 1)[-1])
        if not OBJECT_RE.fullmatch(basename):
            continue
        next_start = anchors[index + 1].start() if index + 1 < len(anchors) else len(text)
        tail = " ".join(TAG_RE.sub(" ", text[anchor.end():min(next_start, anchor.end() + 1200)]).split())
        stamp = STAMP_RE.search(tail)
        if not stamp:
            continue
        size = SIZE_RE.search(tail, stamp.end())
        if not size:
            continue
        minute = datetime.strptime(stamp.group("stamp"), "%d-%b-%Y %H:%M").replace(tzinfo=timezone.utc)
        entries.setdefault(basename, []).append({"minute": minute, "upper": minute + timedelta(seconds=59, microseconds=999999), "size": parse_size(size.group("size"))})
    require(bool(entries), "EA4_DIRECTORY_ENTRIES_REQUIRED")
    return entries


def candidate_cycles(tick: datetime):
    return gfs_core.candidate_cycles_v1(tick)


def pgrb2_names(cycle: datetime, lead: int):
    return gfs_core.pgrb2_names_v1(cycle, lead)


def sflux_names(cycle: datetime, lead: int):
    return gfs_core.sflux_names_v1(cycle, lead)


def directory_url(cycle: datetime):
    return f"{PRODUCTION_ROOT}/gfs.{cycle:%Y%m%d}/{cycle:%H}/atmos/"


def select_cycle(tick: datetime):
    rejections = []
    for cycle in candidate_cycles(tick):
        if gfs_core.lead_window_v1(tick, cycle, GFS_AUTHORITY) is None:
            continue
        try:
            url = directory_url(cycle)
            status, _, body, final_url = request_bytes(url, "EA4_GFS_DIRECTORY", 20_000_000)
            require(status == 200, f"EA4_DIRECTORY_HTTP_{status}")
            final = urlparse(final_url)
            require(final.hostname == "nomads.ncep.noaa.gov" and final.path == urlparse(url).path, "EA4_DIRECTORY_IDENTITY_DRIFT")
            retain_raw("GFS_DIRECTORY_LISTING", iso(cycle), body)
            entries = parse_directory(body)
            window = gfs_core.validate_complete_cycle_inventory_v1(
                entries=entries,
                tick=tick,
                cycle=cycle,
                authority=GFS_AUTHORITY,
                code_prefix="EA4",
            )
            return {
                "cycle": cycle,
                "lead_start": window["lead_start"],
                "lead_end": window["lead_end"],
                "support": window["support"],
                "directory_sha256": sha256_bytes(body),
                "rejections": rejections,
            }
        except Exception as exc:
            rejections.append({"cycle": iso(cycle), "reason": str(exc)[:240]})
            if "EA4_SFLUX_" in str(exc):
                raise RuntimeError(f"EA4_SELECTED_PGRB2_CYCLE_SFLUX_NOT_READY:{iso(cycle)}:{str(exc)}")
    raise RuntimeError("EA4_NO_COMPLETE_GFS_CYCLE:" + json.dumps(rejections, separators=(",", ":")))


def filter_url(cycle: datetime, lead: int):
    params = [
        ("file", f"gfs.t{cycle:%H}z.pgrb2.0p25.f{lead:03d}"),
        ("var_TMP", "on"), ("var_RH", "on"), ("var_UGRD", "on"), ("var_VGRD", "on"), ("var_APCP", "on"),
        ("lev_2_m_above_ground", "on"), ("lev_10_m_above_ground", "on"), ("lev_surface", "on"), ("subregion", ""),
        ("leftlon", f"{GRID_LON - 0.01:.2f}"), ("rightlon", f"{GRID_LON + 0.01:.2f}"),
        ("toplat", f"{GRID_LAT + 0.01:.2f}"), ("bottomlat", f"{GRID_LAT - 0.01:.2f}"),
        ("dir", f"/gfs.{cycle:%Y%m%d}/{cycle:%H}/atmos"),
    ]
    return FILTER_ENDPOINT + "?" + urlencode(params)


def decode_pgrb2(body: bytes, cycle: datetime, lead: int):
    return gfs_core.decode_pgrb2_v1(body, cycle, lead, GFS_AUTHORITY)


def instant(records, role: str, lead: int):
    return gfs_core.instant_v1(records, role, lead)


def block_start(lead: int):
    return gfs_core.block_start_v1(lead)


def apcp(records, lead: int):
    return gfs_core.apcp_v1(records, lead)


def fetch_pgrb2_lead(cycle: datetime, lead: int):
    url = filter_url(cycle, lead)
    status, _, body, final_url = request_bytes(url, f"EA4_PGRB2_F{lead:03d}", 20_000_000)
    require(status == 200, f"EA4_PGRB2_HTTP_{status}:F{lead:03d}")
    final = urlparse(final_url)
    require(final.hostname == "nomads.ncep.noaa.gov" and final.path == "/cgi-bin/filter_gfs_0p25.pl", f"EA4_PGRB2_FILTER_IDENTITY_DRIFT:F{lead:03d}")
    receipt = retain_raw("GFS_PGRB2_FILTER_RESPONSE", f"{iso(cycle)}|F{lead:03d}", body)
    return lead, decode_pgrb2(body, cycle, lead), receipt


def sflux_urls(cycle: datetime, lead: int):
    base = f"{PRODUCTION_ROOT}/gfs.{cycle:%Y%m%d}/{cycle:%H}/atmos/gfs.t{cycle:%H}z.sfluxgrbf{lead:03d}.grib2"
    return base, base + ".idx"


def parse_sflux_idx(text: str, lead: int):
    rows = []
    for line in text.splitlines():
        parts = line.strip().split(":")
        if len(parts) >= 5 and parts[1].isdigit():
            rows.append({"offset": int(parts[1]), "parts": parts, "line": line.strip()})
    expected = f"{lead} hour fcst".lower()
    eligible = []
    for idx, row in enumerate(rows):
        parts = row["parts"]
        try:
            vi = parts.index("DSWRF")
        except ValueError:
            continue
        if vi + 2 >= len(parts) or parts[vi + 1] != "surface" or parts[vi + 2].strip().lower() != expected:
            continue
        require(idx + 1 < len(rows), f"EA4_SFLUX_IDX_LAST_RECORD:F{lead:03d}")
        end = rows[idx + 1]["offset"] - 1
        eligible.append({"offset": row["offset"], "end": end, "length": end - row["offset"] + 1, "line_sha256": sha256_bytes(row["line"].encode())})
    require(len(eligible) == 1, f"EA4_SFLUX_INSTANT_RECORD_COUNT:F{lead:03d}:{len(eligible)}")
    require(eligible[0]["length"] <= MAX_SFLUX_MESSAGE_BYTES, f"EA4_SFLUX_MESSAGE_TOO_LARGE:F{lead:03d}")
    return eligible[0]


def decode_sflux(message: bytes, cycle: datetime, lead: int):
    return gfs_core.decode_sflux_v1(message, cycle, lead, GFS_AUTHORITY)


def fetch_sflux_lead(cycle: datetime, lead: int, tick: datetime):
    grib_url, idx_url = sflux_urls(cycle, lead)
    status, headers, idx_body, _ = request_bytes(idx_url, f"EA4_SFLUX_IDX_F{lead:03d}", MAX_IDX_BYTES, {"Accept": "text/plain,*/*;q=0.5"})
    require(status == 200 and http_last_modified(headers, f"EA4_SFLUX_IDX_F{lead:03d}") <= tick, f"EA4_SFLUX_IDX_NOT_AVAILABLE:F{lead:03d}")
    retain_raw("GFS_SFLUX_IDX", f"{iso(cycle)}|F{lead:03d}", idx_body)
    selected = parse_sflux_idx(idx_body.decode("utf-8"), lead)
    range_header = f"bytes={selected['offset']}-{selected['end']}"
    status, headers, message, _ = request_bytes(grib_url, f"EA4_SFLUX_RANGE_F{lead:03d}", MAX_SFLUX_MESSAGE_BYTES, {"Range": range_header})
    require(status == 206, f"EA4_SFLUX_RANGE_HTTP_{status}:F{lead:03d}")
    cr = headers.get("Content-Range", "")
    match = re.fullmatch(r"bytes\s+(\d+)-(\d+)/(\d+)", cr)
    require(bool(match) and int(match.group(1)) == selected["offset"] and int(match.group(2)) == selected["end"], f"EA4_SFLUX_CONTENT_RANGE_DRIFT:F{lead:03d}")
    require(http_last_modified(headers, f"EA4_SFLUX_RANGE_F{lead:03d}") <= tick, f"EA4_SFLUX_RANGE_AFTER_TICK:F{lead:03d}")
    require(len(message) == selected["length"] and message.startswith(b"GRIB") and message.endswith(b"7777"), f"EA4_SFLUX_MESSAGE_BOUNDARY:F{lead:03d}")
    receipt = retain_raw("GFS_SFLUX_EXACT_GRIB_MESSAGE", f"{iso(cycle)}|F{lead:03d}", message)
    return lead, decode_sflux(message, cycle, lead), receipt, selected["line_sha256"]


def normalize_key(value: str):
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
        dt = datetime.fromisoformat(raw.replace("Z", "+00:00"))
        return dt.astimezone(timezone.utc) if dt.tzinfo else None
    except ValueError:
        return None


def finite(value):
    try:
        parsed = float(str(value).strip())
        return parsed if math.isfinite(parsed) else None
    except Exception:
        return None


def parse_kbs_csv(body: bytes):
    text = body.decode("utf-8-sig")
    lines = text.splitlines()
    required = ["datetime_utc", "solrad_avg", "wind_speed", "ah", "airtmp_107_avg", "rain_mm"]
    for idx, line in enumerate(lines[:80]):
        for delim in (",", "\t", ";", "|"):
            cells = next(csv.reader([line], delimiter=delim))
            headers = [normalize_key(cell) for cell in cells]
            if all(name in headers for name in required):
                rows = []
                for values in csv.reader(lines[idx + 1 :], delimiter=delim):
                    if len(values) < len(headers):
                        continue
                    rows.append({header: values[position] for position, header in enumerate(headers)})
                return rows
    raise RuntimeError("EA4_KBS_RAW_HOURLY_HEADER_NOT_FOUND")


def scalar_eto(t_c: float, ea_kpa: float, rs: float, wind2: float, interval_end: datetime):
    return gfs_core.compute_asce_short_hourly_et0_v1(
        air_temperature_c=t_c,
        actual_vapor_pressure_kpa=ea_kpa,
        solar_radiation_mj_m2_h=rs,
        wind_speed_2m=wind2,
        interval_end=interval_end,
        authority=GFS_AUTHORITY,
    )


def hash_series(points):
    return sha256_json([{"time": iso(t), "value": format(v, ".12g")} for t, v in points])


def qualify_kbs(now: datetime):
    status, _, soil_body, final = request_bytes(AUTH["kbs"]["soil_endpoint"], "EA4_KBS_SOIL", 5_000_000, {"Accept": "application/json,*/*;q=0.5"})
    require(status == 200 and urlparse(final).hostname == "lter.kbs.msu.edu", "EA4_KBS_SOIL_IDENTITY")
    soil_receipt = retain_raw("KBS_SOIL_ENDPOINT25", AUTH["kbs"]["soil_endpoint"], soil_body)
    payload = json.loads(soil_body.decode("utf-8"))
    require(isinstance(payload, list), "EA4_KBS_SOIL_ARRAY_REQUIRED")
    points = []
    for item in payload:
        if not isinstance(item, dict):
            continue
        try:
            t = datetime.fromisoformat(str(item.get("time", "")).replace("Z", "+00:00")).astimezone(timezone.utc)
            v = float(item.get("value"))
        except Exception:
            continue
        if math.isfinite(v):
            points.append((t, v))
    points.sort()
    require(points, "EA4_KBS_SOIL_POINTS_REQUIRED")
    latest = points[-1][0]
    age = (now - latest).total_seconds() / 60
    require(-5 <= age <= float(AUTH["kbs"]["soil_latest_max_age_minutes"]), f"EA4_KBS_SOIL_AGE:{age:.2f}")
    window = [point for point in points if latest - timedelta(hours=24) <= point[0] <= latest]
    require(len(window) >= 24 and all(0 <= value <= 1 for _, value in window), "EA4_KBS_SOIL_24H_VALIDITY")
    max_gap = max((window[index][0] - window[index - 1][0]).total_seconds() / 60 for index in range(1, len(window)))
    require(max_gap <= 30, "EA4_KBS_SOIL_MAX_GAP")

    status, _, csv_body, final = request_bytes(AUTH["kbs"]["raw_hourly_csv"], "EA4_KBS_HOURLY", 110_000_000, {"Accept": "text/csv,text/plain;q=0.9,*/*;q=0.5"})
    require(status == 200 and urlparse(final).hostname == "lter.kbs.msu.edu" and urlparse(final).path == "/datatables/13.csv", "EA4_KBS_HOURLY_IDENTITY")
    hourly_receipt = retain_raw("KBS_RAW_HOURLY_13", AUTH["kbs"]["raw_hourly_csv"], csv_body)
    rows = parse_kbs_csv(csv_body)
    parsed = []
    for row in rows:
        t = parse_provider_utc(row.get("datetime_utc", ""))
        if t is None or t > now + timedelta(minutes=5):
            continue
        parsed.append((t, row))
    require(parsed, "EA4_KBS_HOURLY_TIMESTAMPED_REQUIRED")
    parsed.sort(key=lambda item: item[0])
    latest_hour = parsed[-1][0]
    require((now - latest_hour).total_seconds() / 3600 <= float(AUTH["kbs"]["raw_hourly_latest_max_age_hours"]), "EA4_KBS_HOURLY_STALE")
    recent = [item for item in parsed if latest_hour - timedelta(hours=36) <= item[0] <= latest_hour]
    rain = []
    hist_et0 = []
    for t, row in recent:
        rain_v = finite(row.get("rain_mm"))
        if rain_v is not None and 0 <= rain_v <= 100:
            rain.append((t, rain_v))
        air = finite(row.get("airtmp_107_avg"))
        ah = finite(row.get("ah"))
        sol = finite(row.get("solrad_avg"))
        wind = finite(row.get("wind_speed"))
        if None in (air, ah, sol, wind):
            continue
        if not (-50 <= air <= 60 and 0 < ah <= 10 and 0 <= sol <= 1600 and 0 <= wind <= 100):
            continue
        et = scalar_eto(air, ah, sol * SOLAR_FACTOR, wind * WIND_FACTOR, t)
        hist_et0.append((t, et))
    rain_hours = len({int(t.timestamp() // 3600) for t, _ in rain})
    et_hours = len({int(t.timestamp() // 3600) for t, _ in hist_et0})
    require(rain_hours >= int(AUTH["kbs"]["minimum_recent_numeric_rain_hours"]), f"EA4_KBS_RAIN_HOURS:{rain_hours}")
    require(et_hours >= int(AUTH["kbs"]["minimum_recent_complete_hourly_et0_intervals"]), f"EA4_KBS_HIST_ET0_HOURS:{et_hours}")
    return {
        "soil_response_sha256": soil_receipt["sha256"],
        "soil_response_bytes": soil_receipt["bytes"],
        "soil_latest_timestamp": iso(latest),
        "soil_latest_age_minutes": round(age, 3),
        "soil_24h_point_count": len(window),
        "soil_24h_max_gap_minutes": round(max_gap, 3),
        "soil_sequence_sha256": hash_series(window),
        "raw_hourly_response_sha256": hourly_receipt["sha256"],
        "raw_hourly_response_bytes": hourly_receipt["bytes"],
        "raw_hourly_latest_timestamp": iso(latest_hour),
        "rain_numeric_distinct_hours": rain_hours,
        "rain_sequence_sha256": hash_series(rain),
        "historical_et0_complete_distinct_hours": et_hours,
        "historical_et0_sequence_sha256": hash_series(hist_et0),
        "historical_et0_negative_count": sum(1 for _, value in hist_et0 if value < 0),
    }


def main():
    OUT.parent.mkdir(parents=True, exist_ok=True)
    result = {
        "schema_version": "geox_mcft_cap09_ea4_live_source_exact_head_result_v1",
        "status": "FAIL",
        "subject_sha": SUBJECT_SHA or None,
        "database_write_count": 0,
        "formal_evidence_write_count": 0,
        "runtime_public_provider_fetch_count": 0,
        "public_raw_value_emission_count": 0,
        "formal_window_started": False,
        "mcft_cap09_completed": False,
    }
    try:
        require(re.fullmatch(r"[0-9a-f]{40}", SUBJECT_SHA) is not None, "EA4_EXACT_SUBJECT_SHA_REQUIRED")
        require(package_version("eccodes") == AUTH["decoder_environment"]["eccodes"], "EA4_ECCODES_VERSION_DRIFT")
        require(package_version("eccodeslib") == AUTH["decoder_environment"]["eccodeslib"], "EA4_ECCODESLIB_VERSION_DRIFT")
        require(package_version("numpy") == AUTH["decoder_environment"]["numpy"], "EA4_NUMPY_VERSION_DRIFT")
        require(package_version("refet") == AUTH["decoder_environment"]["refet"], "EA4_REFET_VERSION_DRIFT")
        now = datetime.now(timezone.utc)
        tick = floor_hour(now)
        result["probe_started_at_utc"] = iso(now)
        result["tick_utc"] = iso(tick)
        result["decoder"] = {
            "eccodes": package_version("eccodes"),
            "eccodeslib": package_version("eccodeslib"),
            "numpy": package_version("numpy"),
            "refet": package_version("refet"),
            "eccodes_module": getattr(eccodes, "__version__", "unknown"),
            "gfs_scientific_core": "apps/server/src/external_evidence/provider/python/mcft_cap09_gfs_scientific_core_v1.py",
        }
        result["kbs"] = qualify_kbs(now)
        selected = select_cycle(tick)
        cycle = selected["cycle"]
        support = selected["support"]
        leads = list(range(support, selected["lead_end"] + 1))
        result["gfs_chronology"] = {
            "selected_cycle_utc": iso(cycle),
            "lead_start": selected["lead_start"],
            "lead_end": selected["lead_end"],
            "support_lead": support,
            "valid_time_start": iso(tick + timedelta(hours=1)),
            "valid_time_end": iso(tick + timedelta(hours=72)),
            "directory_sha256": selected["directory_sha256"],
            "candidate_rejection_count": len(selected["rejections"]),
        }

        by_lead = {}
        pgrb2_receipts = []
        with ThreadPoolExecutor(max_workers=CONCURRENCY) as pool:
            futures = [pool.submit(fetch_pgrb2_lead, cycle, lead) for lead in leads]
            for future in as_completed(futures):
                lead, records, receipt = future.result()
                by_lead[lead] = records
                pgrb2_receipts.append(receipt)
        require(len(by_lead) == POINT_COUNT + 1, "EA4_PGRB2_LEAD_COUNT")

        sflux = {}
        sflux_receipts = []
        idx_hashes = []
        with ThreadPoolExecutor(max_workers=CONCURRENCY) as pool:
            futures = [pool.submit(fetch_sflux_lead, cycle, lead, tick) for lead in leads]
            for future in as_completed(futures):
                lead, item, receipt, line_hash = future.result()
                sflux[lead] = item
                sflux_receipts.append(receipt)
                idx_hashes.append({"lead": lead, "line_sha256": line_hash})
        require(len(sflux) == POINT_COUNT + 1, "EA4_SFLUX_ENDPOINT_COUNT")

        scientific = gfs_core.assemble_72h_scientific_series_v1(
            by_lead=by_lead,
            sflux=sflux,
            cycle=cycle,
            target=tick,
            authority=GFS_AUTHORITY,
            normalize_et0_decimals=None,
        )
        weather = scientific["weather"]
        solar = scientific["solar"]
        future_et0 = scientific["future_et0"]
        duplicate_collapses = scientific["apcp_semantic_duplicate_collapse_count"]

        retention_chain = sha256_json(sorted(receipts, key=lambda item: (item["kind"], item["identity_sha256"])))
        result.update(
            {
                "future_weather": {
                    "point_count": POINT_COUNT,
                    "temperature_c_sha256": hash_series(weather["temperature_c"]),
                    "relative_humidity_percent_sha256": hash_series(weather["rh_percent"]),
                    "wind_2m_m_s_sha256": hash_series(weather["wind_2m"]),
                    "precipitation_mm_sha256": hash_series(weather["precip_mm"]),
                    "apcp_semantic_duplicate_collapse_count": duplicate_collapses,
                    "all_finite": True,
                    "precipitation_nonnegative": True,
                },
                "future_solar": {
                    "endpoint_count": POINT_COUNT + 1,
                    "interval_count": POINT_COUNT,
                    "endpoint_sequence_sha256": hash_series([(cycle + timedelta(hours=lead), sflux[lead]["value"]) for lead in leads]),
                    "solar_energy_sequence_sha256": hash_series(solar),
                    "param_number_set": sorted({item["param_number"] for item in sflux.values()}),
                    "param_id_set": sorted({item["param_id"] for item in sflux.values()}),
                    "short_name_set": sorted({item["short_name"] for item in sflux.values()}),
                    "native_index_set": sorted({item["native_index"] for item in sflux.values()}),
                    "quality_status": "LIMITED",
                },
                "future_et0": {
                    "point_count": POINT_COUNT,
                    "sequence_sha256": hash_series(future_et0),
                    "finite_count": POINT_COUNT,
                    "negative_count": sum(1 for _, value in future_et0 if value < 0),
                    "negative_clipping_performed": False,
                    "algorithm_id": "ASCE_STANDARDIZED_REFERENCE_ET_SHORT_HOURLY_V1",
                    "qualification_oracle": "refet-0.4.2-asce",
                    "product_scientific_core_used": True,
                },
                "raw_retention": {
                    "qualification_class": AUTH["raw_retention_qualification"]["class"],
                    "receipt_count": len(receipts),
                    "total_retained_bytes": sum(item["bytes"] for item in receipts),
                    "receipt_chain_sha256": retention_chain,
                    "private_root_publicly_emitted": False,
                    "raw_bytes_uploaded": False,
                    "ea5_durable_retention_still_required": True,
                },
                "live_source_qualified": True,
                "gfs_72h_full_value_pipeline_qualified": True,
                "future_et0_72h_value_execution_qualified": True,
                "ea2_package_formal_eligible": False,
                "ea5_candidate_development_authorized": True,
                "decision": AUTH["live_qualification"]["success_decision"],
                "status": "PASS",
            }
        )
    except Exception as exc:
        result["error"] = f"{type(exc).__name__}:{exc}"[:1200]
        result["decision"] = AUTH["live_qualification"]["failure_decision"]
        OUT.write_text(json.dumps(result, indent=2, sort_keys=True) + "\n", encoding="utf-8")
        raise
    OUT.write_text(json.dumps(result, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(
        json.dumps(
            {
                "status": result["status"],
                "decision": result["decision"],
                "tick": result["tick_utc"],
                "cycle": result["gfs_chronology"]["selected_cycle_utc"],
                "retention_receipts": result["raw_retention"]["receipt_count"],
                "future_et0_points": result["future_et0"]["point_count"],
                "product_gfs_scientific_core": True,
            },
            sort_keys=True,
        )
    )


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"EA4_FAIL:{type(exc).__name__}:{exc}", file=os.sys.stderr)
        raise SystemExit(1)
