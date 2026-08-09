#!/usr/bin/env python3
from __future__ import annotations

import csv
import hashlib
import json
import math
import os
import re
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
import numpy as np
import refet
from eccodes import (
    codes_get,
    codes_get_array,
    codes_get_message,
    codes_grib_find_nearest,
    codes_grib_new_from_file,
    codes_release,
)

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
                require(final.scheme == "https:", f"{code}_FINAL_HTTPS_REQUIRED")
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
    return [tick - timedelta(hours=back) for back in range(49) if (tick - timedelta(hours=back)).hour in (0, 6, 12, 18)]


def pgrb2_names(cycle: datetime, lead: int):
    stem = f"gfs.t{cycle:%H}z.pgrb2.0p25.f{lead:03d}"
    return (stem, stem + ".idx")


def sflux_names(cycle: datetime, lead: int):
    stem = f"gfs.t{cycle:%H}z.sfluxgrbf{lead:03d}.grib2"
    return (stem, stem + ".idx")


def directory_url(cycle: datetime):
    return f"{PRODUCTION_ROOT}/gfs.{cycle:%Y%m%d}/{cycle:%H}/atmos/"


def select_cycle(tick: datetime):
    rejections = []
    for cycle in candidate_cycles(tick):
        lead_start = int((tick - cycle).total_seconds() // 3600) + 1
        lead_end = lead_start + POINT_COUNT - 1
        support = lead_start - 1
        if support < 0 or lead_end > MAX_LEAD:
            continue
        try:
            url = directory_url(cycle)
            status, _, body, final_url = request_bytes(url, "EA4_GFS_DIRECTORY", 20_000_000)
            require(status == 200, f"EA4_DIRECTORY_HTTP_{status}")
            final = urlparse(final_url)
            require(final.hostname == "nomads.ncep.noaa.gov" and final.path == urlparse(url).path, "EA4_DIRECTORY_IDENTITY_DRIFT")
            retain_raw("GFS_DIRECTORY_LISTING", iso(cycle), body)
            entries = parse_directory(body)
            # EA1K authority selects latest complete pgrb2 cycle first.
            for lead in range(support, lead_end + 1):
                for name in pgrb2_names(cycle, lead):
                    match = entries.get(name, [])
                    require(len(match) == 1 and match[0]["size"] > 0, f"EA4_PGRB2_DIRECTORY_ENTRY_MISSING:{name}")
                    require(match[0]["upper"] <= tick, f"EA4_PGRB2_DIRECTORY_ENTRY_AFTER_TICK:{name}")
            # Same selected cycle must also have sflux support+targets before tick; no older-cycle substitution.
            for lead in range(support, lead_end + 1):
                for name in sflux_names(cycle, lead):
                    match = entries.get(name, [])
                    require(len(match) == 1 and match[0]["size"] > 0, f"EA4_SFLUX_DIRECTORY_ENTRY_MISSING:{name}")
                    require(match[0]["upper"] <= tick, f"EA4_SFLUX_DIRECTORY_ENTRY_AFTER_TICK:{name}")
            return {"cycle": cycle, "lead_start": lead_start, "lead_end": lead_end, "support": support, "directory_sha256": sha256_bytes(body), "rejections": rejections}
        except Exception as exc:
            rejections.append({"cycle": iso(cycle), "reason": str(exc)[:240]})
            # If pgrb2 was complete but sflux failed this is a same-cycle hard fail, not an older-cycle fallback.
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


def dt_keys(date_value, time_value):
    return datetime.strptime(str(int(date_value)).zfill(8) + str(int(time_value)).zfill(4), "%Y%m%d%H%M").replace(tzinfo=timezone.utc)


def grib_section(message: bytes, wanted: int):
    offset = 16
    while offset + 5 <= len(message):
        if message[offset:offset + 4] == b"7777":
            break
        length = int.from_bytes(message[offset:offset + 4], "big")
        require(length >= 5 and offset + length <= len(message), "EA4_GRIB_SECTION_LENGTH_INVALID")
        if int(message[offset + 4]) == wanted:
            return message[offset:offset + length]
        offset += length
    raise RuntimeError(f"EA4_GRIB_SECTION_NOT_FOUND:{wanted}")


def normalize_lon(lon: float):
    return lon % 360.0


def pgrb2_role(short: str, name: str, level_type: str, level: float):
    s, n, lev = short.lower(), name.lower(), float(level)
    if level_type == "heightAboveGround" and abs(lev - 2) < 1e-9:
        if s in {"2t", "t"} or n == "temperature": return "T2"
        if s in {"2r", "r"} or "relative humidity" in n: return "RH2"
    if level_type == "heightAboveGround" and abs(lev - 10) < 1e-9:
        if s in {"10u", "u"} or "u component of wind" in n: return "U10"
        if s in {"10v", "v"} or "v component of wind" in n: return "V10"
    if level_type == "surface" and (s in {"tp", "apcp"} or n == "total precipitation"):
        return "APCP"
    return None


def decode_pgrb2(body: bytes, cycle: datetime, lead: int):
    require(body.startswith(b"GRIB"), f"EA4_PGRB2_NOT_GRIB:F{lead:03d}")
    records = []
    with tempfile.NamedTemporaryFile(suffix=".grib2", delete=False) as tmp:
        tmp.write(body); tmp_path = tmp.name
    try:
        with open(tmp_path, "rb") as handle:
            while True:
                gid = codes_grib_new_from_file(handle)
                if gid is None: break
                try:
                    role = pgrb2_role(str(codes_get(gid,"shortName")), str(codes_get(gid,"name")), str(codes_get(gid,"typeOfLevel")), float(codes_get(gid,"level")))
                    if role is None: continue
                    step_type = str(codes_get(gid,"stepType"))
                    start_step, end_step = int(codes_get(gid,"startStep")), int(codes_get(gid,"endStep"))
                    data_dt = dt_keys(codes_get(gid,"dataDate"), codes_get(gid,"dataTime"))
                    valid_dt = dt_keys(codes_get(gid,"validityDate"), codes_get(gid,"validityTime"))
                    values, lats, lons = codes_get_array(gid,"values"), codes_get_array(gid,"latitudes"), codes_get_array(gid,"longitudes")
                    require(len(values)==1 and len(lats)==1 and len(lons)==1, f"EA4_PGRB2_POINT_COUNT:{role}:F{lead:03d}")
                    require(abs(float(lats[0])-GRID_LAT)<1e-6 and abs(normalize_lon(float(lons[0]))-GRID_LON)<1e-6, f"EA4_PGRB2_GRID_NODE_DRIFT:{role}:F{lead:03d}")
                    require(data_dt == cycle and valid_dt == cycle + timedelta(hours=lead) and end_step == lead, f"EA4_PGRB2_CHRONOLOGY_DRIFT:{role}:F{lead:03d}")
                    value = float(values[0]); require(math.isfinite(value), f"EA4_PGRB2_NONFINITE:{role}:F{lead:03d}")
                    records.append({"role":role,"step_type":step_type,"start_step":start_step,"end_step":end_step,"units":str(codes_get(gid,"units")),"value":value,"section4":sha256_bytes(grib_section(bytes(codes_get_message(gid)),4))})
                finally:
                    codes_release(gid)
    finally:
        try: os.remove(tmp_path)
        except OSError: pass
    return records


def exactly_one(items, code: str):
    require(len(items)==1, f"{code}:COUNT={len(items)}")
    return items[0]


def instant(records, role: str, lead: int):
    return exactly_one([r for r in records if r["role"]==role and r["step_type"]=="instant" and r["end_step"]==lead], f"EA4_INSTANT_NOT_UNIQUE:{role}:F{lead:03d}")


def block_start(lead: int):
    return 6 * ((lead - 1)//6)


def apcp(records, lead: int):
    start = block_start(lead)
    candidates = [r for r in records if r["role"]=="APCP" and r["step_type"]=="accum" and r["start_step"]==start and r["end_step"]==lead]
    require(bool(candidates), f"EA4_APCP_MISSING:S{start}:E{lead}")
    require(len({r["section4"] for r in candidates})==1, f"EA4_APCP_SECTION4_AMBIGUITY:S{start}:E{lead}")
    require(len({float(r["value"]).hex() for r in candidates})==1, f"EA4_APCP_VALUE_AMBIGUITY:S{start}:E{lead}")
    require(len({r["units"] for r in candidates})==1, f"EA4_APCP_UNIT_AMBIGUITY:S{start}:E{lead}")
    return candidates[0], len(candidates)-1


def fetch_pgrb2_lead(cycle: datetime, lead: int):
    url = filter_url(cycle, lead)
    status, _, body, final_url = request_bytes(url, f"EA4_PGRB2_F{lead:03d}", 20_000_000)
    require(status==200, f"EA4_PGRB2_HTTP_{status}:F{lead:03d}")
    final=urlparse(final_url); require(final.hostname=="nomads.ncep.noaa.gov" and final.path=="/cgi-bin/filter_gfs_0p25.pl", f"EA4_PGRB2_FILTER_IDENTITY_DRIFT:F{lead:03d}")
    receipt=retain_raw("GFS_PGRB2_FILTER_RESPONSE", f"{iso(cycle)}|F{lead:03d}", body)
    return lead, decode_pgrb2(body, cycle, lead), receipt


def sflux_urls(cycle: datetime, lead: int):
    base=f"{PRODUCTION_ROOT}/gfs.{cycle:%Y%m%d}/{cycle:%H}/atmos/gfs.t{cycle:%H}z.sfluxgrbf{lead:03d}.grib2"
    return base, base+".idx"


def parse_sflux_idx(text: str, lead: int):
    rows=[]
    for line in text.splitlines():
        parts=line.strip().split(":")
        if len(parts)>=5 and parts[1].isdigit(): rows.append({"offset":int(parts[1]),"parts":parts,"line":line.strip()})
    expected=f"{lead} hour fcst".lower(); eligible=[]
    for idx,row in enumerate(rows):
        parts=row["parts"]
        try: vi=parts.index("DSWRF")
        except ValueError: continue
        if vi+2>=len(parts) or parts[vi+1]!="surface" or parts[vi+2].strip().lower()!=expected: continue
        require(idx+1<len(rows), f"EA4_SFLUX_IDX_LAST_RECORD:F{lead:03d}")
        end=rows[idx+1]["offset"]-1
        eligible.append({"offset":row["offset"],"end":end,"length":end-row["offset"]+1,"line_sha256":sha256_bytes(row["line"].encode())})
    require(len(eligible)==1, f"EA4_SFLUX_INSTANT_RECORD_COUNT:F{lead:03d}:{len(eligible)}")
    require(eligible[0]["length"]<=MAX_SFLUX_MESSAGE_BYTES, f"EA4_SFLUX_MESSAGE_TOO_LARGE:F{lead:03d}")
    return eligible[0]


def decode_sflux(message: bytes, cycle: datetime, lead: int):
    with tempfile.TemporaryFile() as handle:
        handle.write(message); handle.seek(0)
        gid=codes_grib_new_from_file(handle); require(gid is not None, f"EA4_SFLUX_GRIB_REQUIRED:F{lead:03d}")
        try:
            discipline=int(codes_get(gid,"discipline")); category=int(codes_get(gid,"parameterCategory")); number=int(codes_get(gid,"parameterNumber"))
            require(discipline==0 and category==4 and number in (7,192), f"EA4_SFLUX_PARAMETER_DRIFT:F{lead:03d}")
            require(str(codes_get(gid,"typeOfLevel")).lower()=="surface" and str(codes_get(gid,"stepType")).lower()=="instant", f"EA4_SFLUX_STEP_DRIFT:F{lead:03d}")
            require(int(codes_get(gid,"forecastTime"))==lead and int(codes_get(gid,"endStep"))==lead, f"EA4_SFLUX_LEAD_DRIFT:F{lead:03d}")
            data_dt=dt_keys(codes_get(gid,"dataDate"),codes_get(gid,"dataTime")); valid_dt=dt_keys(codes_get(gid,"validityDate"),codes_get(gid,"validityTime"))
            require(data_dt==cycle and valid_dt==cycle+timedelta(hours=lead), f"EA4_SFLUX_TIME_DRIFT:F{lead:03d}")
            nearest=codes_grib_find_nearest(gid, float(AUTH["kbs"]["station_latitude"]), float(AUTH["kbs"]["station_longitude"]))[0]
            require(int(nearest.index)==int(AUTH["gfs"]["solar_native_index"]), f"EA4_SFLUX_NATIVE_INDEX_DRIFT:F{lead:03d}:{int(nearest.index)}")
            require(abs(float(nearest.lat)-float(AUTH["gfs"]["solar_native_latitude"]))<1e-8, f"EA4_SFLUX_NATIVE_LAT_DRIFT:F{lead:03d}")
            signed=((float(nearest.lon)%360)+540)%360-180
            require(abs(signed-float(AUTH["gfs"]["solar_native_longitude_signed"]))<1e-8, f"EA4_SFLUX_NATIVE_LON_DRIFT:F{lead:03d}")
            value=float(nearest.value); require(math.isfinite(value) and value>=0, f"EA4_SFLUX_VALUE_INVALID:F{lead:03d}")
            require(str(codes_get(gid,"gridType"))=="regular_gg" and int(codes_get(gid,"N"))==768 and int(codes_get(gid,"numberOfDataPoints"))==4718592, f"EA4_SFLUX_GRID_DEFINITION_DRIFT:F{lead:03d}")
            return {"value":value,"param_number":number,"param_id":int(codes_get(gid,"paramId")),"short_name":str(codes_get(gid,"shortName")),"native_index":int(nearest.index)}
        finally: codes_release(gid)


def fetch_sflux_lead(cycle: datetime, lead: int, tick: datetime):
    grib_url, idx_url=sflux_urls(cycle,lead)
    status, headers, idx_body, _=request_bytes(idx_url,f"EA4_SFLUX_IDX_F{lead:03d}",MAX_IDX_BYTES,{"Accept":"text/plain,*/*;q=0.5"})
    require(status==200 and http_last_modified(headers,f"EA4_SFLUX_IDX_F{lead:03d}")<=tick, f"EA4_SFLUX_IDX_NOT_AVAILABLE:F{lead:03d}")
    retain_raw("GFS_SFLUX_IDX",f"{iso(cycle)}|F{lead:03d}",idx_body)
    selected=parse_sflux_idx(idx_body.decode("utf-8"),lead)
    range_header=f"bytes={selected['offset']}-{selected['end']}"
    status, headers, message, _=request_bytes(grib_url,f"EA4_SFLUX_RANGE_F{lead:03d}",MAX_SFLUX_MESSAGE_BYTES,{"Range":range_header})
    require(status==206, f"EA4_SFLUX_RANGE_HTTP_{status}:F{lead:03d}")
    cr=headers.get("Content-Range",""); match=re.fullmatch(r"bytes\s+(\d+)-(\d+)/(\d+)",cr)
    require(bool(match) and int(match.group(1))==selected["offset"] and int(match.group(2))==selected["end"], f"EA4_SFLUX_CONTENT_RANGE_DRIFT:F{lead:03d}")
    require(http_last_modified(headers,f"EA4_SFLUX_RANGE_F{lead:03d}")<=tick, f"EA4_SFLUX_RANGE_AFTER_TICK:F{lead:03d}")
    require(len(message)==selected["length"] and message.startswith(b"GRIB") and message.endswith(b"7777"), f"EA4_SFLUX_MESSAGE_BOUNDARY:F{lead:03d}")
    receipt=retain_raw("GFS_SFLUX_EXACT_GRIB_MESSAGE",f"{iso(cycle)}|F{lead:03d}",message)
    return lead, decode_sflux(message,cycle,lead), receipt, selected["line_sha256"]


def normalize_key(value: str):
    return re.sub(r"[^a-z0-9]+","_",str(value or "").lstrip("\ufeff").strip().lower()).strip("_")


def parse_provider_utc(value: str):
    raw=str(value or "").replace("\u00a0"," ").strip()
    if not raw: return None
    cleaned=re.sub(r"\s+(?:UTC|GMT|\+0000|\+00:00|\+00)$","",raw,flags=re.I).rstrip("Zz").strip()
    for fmt in ("%Y-%m-%d %H:%M:%S","%Y-%m-%d %H:%M","%m/%d/%Y %H:%M:%S","%m/%d/%Y %H:%M"):
        try: return datetime.strptime(cleaned,fmt).replace(tzinfo=timezone.utc)
        except ValueError: pass
    try:
        dt=datetime.fromisoformat(raw.replace("Z","+00:00")); return dt.astimezone(timezone.utc) if dt.tzinfo else None
    except ValueError: return None


def finite(value):
    try:
        v=float(str(value).strip()); return v if math.isfinite(v) else None
    except Exception: return None


def parse_kbs_csv(body: bytes):
    text=body.decode("utf-8-sig"); lines=text.splitlines(); required=["datetime_utc","solrad_avg","wind_speed","ah","airtmp_107_avg","rain_mm"]
    for idx,line in enumerate(lines[:80]):
        for delim in (",","\t",";","|"):
            cells=next(csv.reader([line],delimiter=delim)); headers=[normalize_key(c) for c in cells]
            if all(x in headers for x in required):
                rows=[]
                for values in csv.reader(lines[idx+1:],delimiter=delim):
                    if len(values)<len(headers): continue
                    rows.append({h:values[i] for i,h in enumerate(headers)})
                return rows
    raise RuntimeError("EA4_KBS_RAW_HOURLY_HEADER_NOT_FOUND")


def scalar_eto(t_c: float, ea_kpa: float, rs: float, wind2: float, interval_end: datetime):
    start=interval_end-timedelta(hours=1)
    obj=refet.Hourly(tmean=t_c,ea=ea_kpa,rs=rs,uz=wind2,zw=2,elev=float(AUTH["kbs"]["elevation_m"]),lat=float(AUTH["kbs"]["station_latitude"]),lon=float(AUTH["kbs"]["station_longitude"]),doy=start.timetuple().tm_yday,time=start.hour,method="asce")
    raw=obj.eto(); arr=np.asarray(raw,dtype=float).reshape(-1); require(arr.size==1 and math.isfinite(float(arr[0])),"EA4_REFET_NONFINITE")
    return float(arr[0])


def hash_series(points):
    return sha256_json([{"time":iso(t),"value":format(v,".12g")} for t,v in points])


def qualify_kbs(now: datetime):
    status,_,soil_body,final=request_bytes(AUTH["kbs"]["soil_endpoint"],"EA4_KBS_SOIL",5_000_000,{"Accept":"application/json,*/*;q=0.5"})
    require(status==200 and urlparse(final).hostname=="lter.kbs.msu.edu","EA4_KBS_SOIL_IDENTITY")
    soil_receipt=retain_raw("KBS_SOIL_ENDPOINT25",AUTH["kbs"]["soil_endpoint"],soil_body)
    payload=json.loads(soil_body.decode("utf-8")); require(isinstance(payload,list),"EA4_KBS_SOIL_ARRAY_REQUIRED")
    points=[]
    for item in payload:
        if not isinstance(item,dict): continue
        try: t=datetime.fromisoformat(str(item.get("time","")).replace("Z","+00:00")).astimezone(timezone.utc); v=float(item.get("value"))
        except Exception: continue
        if math.isfinite(v): points.append((t,v))
    points.sort(); require(points,"EA4_KBS_SOIL_POINTS_REQUIRED")
    latest=points[-1][0]; age=(now-latest).total_seconds()/60
    require(-5<=age<=float(AUTH["kbs"]["soil_latest_max_age_minutes"]),f"EA4_KBS_SOIL_AGE:{age:.2f}")
    window=[p for p in points if latest-timedelta(hours=24)<=p[0]<=latest]
    require(len(window)>=24 and all(0<=v<=1 for _,v in window),"EA4_KBS_SOIL_24H_VALIDITY")
    max_gap=max((window[i][0]-window[i-1][0]).total_seconds()/60 for i in range(1,len(window)))
    require(max_gap<=30,"EA4_KBS_SOIL_MAX_GAP")

    status,_,csv_body,final=request_bytes(AUTH["kbs"]["raw_hourly_csv"],"EA4_KBS_HOURLY",110_000_000,{"Accept":"text/csv,text/plain;q=0.9,*/*;q=0.5"})
    require(status==200 and urlparse(final).hostname=="lter.kbs.msu.edu" and urlparse(final).path=="/datatables/13.csv","EA4_KBS_HOURLY_IDENTITY")
    hourly_receipt=retain_raw("KBS_RAW_HOURLY_13",AUTH["kbs"]["raw_hourly_csv"],csv_body)
    rows=parse_kbs_csv(csv_body); parsed=[]
    for row in rows:
        t=parse_provider_utc(row.get("datetime_utc",""));
        if t is None or t>now+timedelta(minutes=5): continue
        parsed.append((t,row))
    require(parsed,"EA4_KBS_HOURLY_TIMESTAMPED_REQUIRED"); parsed.sort(key=lambda x:x[0]); latest_hour=parsed[-1][0]
    require((now-latest_hour).total_seconds()/3600<=float(AUTH["kbs"]["raw_hourly_latest_max_age_hours"]),"EA4_KBS_HOURLY_STALE")
    recent=[x for x in parsed if latest_hour-timedelta(hours=36)<=x[0]<=latest_hour]
    rain=[]; hist_et0=[]
    for t,row in recent:
        rain_v=finite(row.get("rain_mm"));
        if rain_v is not None and 0<=rain_v<=100: rain.append((t,rain_v))
        air=finite(row.get("airtmp_107_avg")); ah=finite(row.get("ah")); sol=finite(row.get("solrad_avg")); wind=finite(row.get("wind_speed"))
        if None in (air,ah,sol,wind): continue
        if not (-50<=air<=60 and 0<ah<=10 and 0<=sol<=1600 and 0<=wind<=100): continue
        et=scalar_eto(air,ah,sol*SOLAR_FACTOR,wind*WIND_FACTOR,t)
        hist_et0.append((t,et))
    rain_hours=len({int(t.timestamp()//3600) for t,_ in rain}); et_hours=len({int(t.timestamp()//3600) for t,_ in hist_et0})
    require(rain_hours>=int(AUTH["kbs"]["minimum_recent_numeric_rain_hours"]),f"EA4_KBS_RAIN_HOURS:{rain_hours}")
    require(et_hours>=int(AUTH["kbs"]["minimum_recent_complete_hourly_et0_intervals"]),f"EA4_KBS_HIST_ET0_HOURS:{et_hours}")
    return {
        "soil_response_sha256":soil_receipt["sha256"],"soil_response_bytes":soil_receipt["bytes"],"soil_latest_timestamp":iso(latest),"soil_latest_age_minutes":round(age,3),"soil_24h_point_count":len(window),"soil_24h_max_gap_minutes":round(max_gap,3),"soil_sequence_sha256":hash_series(window),
        "raw_hourly_response_sha256":hourly_receipt["sha256"],"raw_hourly_response_bytes":hourly_receipt["bytes"],"raw_hourly_latest_timestamp":iso(latest_hour),"rain_numeric_distinct_hours":rain_hours,"rain_sequence_sha256":hash_series(rain),"historical_et0_complete_distinct_hours":et_hours,"historical_et0_sequence_sha256":hash_series(hist_et0),"historical_et0_negative_count":sum(1 for _,v in hist_et0 if v<0)
    }


def main():
    OUT.parent.mkdir(parents=True,exist_ok=True)
    result={"schema_version":"geox_mcft_cap09_ea4_live_source_exact_head_result_v1","status":"FAIL","subject_sha":SUBJECT_SHA or None,"database_write_count":0,"formal_evidence_write_count":0,"runtime_public_provider_fetch_count":0,"public_raw_value_emission_count":0,"formal_window_started":False,"mcft_cap09_completed":False}
    try:
        require(re.fullmatch(r"[0-9a-f]{40}",SUBJECT_SHA) is not None,"EA4_EXACT_SUBJECT_SHA_REQUIRED")
        require(package_version("eccodes")==AUTH["decoder_environment"]["eccodes"],"EA4_ECCODES_VERSION_DRIFT")
        require(package_version("eccodeslib")==AUTH["decoder_environment"]["eccodeslib"],"EA4_ECCODESLIB_VERSION_DRIFT")
        require(package_version("numpy")==AUTH["decoder_environment"]["numpy"],"EA4_NUMPY_VERSION_DRIFT")
        require(package_version("refet")==AUTH["decoder_environment"]["refet"],"EA4_REFET_VERSION_DRIFT")
        now=datetime.now(timezone.utc); tick=floor_hour(now)
        result["probe_started_at_utc"]=iso(now); result["tick_utc"]=iso(tick)
        result["decoder"]={"eccodes":package_version("eccodes"),"eccodeslib":package_version("eccodeslib"),"numpy":package_version("numpy"),"refet":package_version("refet"),"eccodes_module":getattr(eccodes,"__version__","unknown")}
        result["kbs"]=qualify_kbs(now)
        selected=select_cycle(tick); cycle=selected["cycle"]; support=selected["support"]; targets=list(range(selected["lead_start"],selected["lead_end"]+1)); leads=list(range(support,selected["lead_end"]+1))
        result["gfs_chronology"]={"selected_cycle_utc":iso(cycle),"lead_start":selected["lead_start"],"lead_end":selected["lead_end"],"support_lead":support,"valid_time_start":iso(tick+timedelta(hours=1)),"valid_time_end":iso(tick+timedelta(hours=72)),"directory_sha256":selected["directory_sha256"],"candidate_rejection_count":len(selected["rejections"])}

        by_lead={}; pgrb2_receipts=[]
        with ThreadPoolExecutor(max_workers=CONCURRENCY) as pool:
            futures=[pool.submit(fetch_pgrb2_lead,cycle,lead) for lead in leads]
            for future in as_completed(futures):
                lead,records,receipt=future.result(); by_lead[lead]=records; pgrb2_receipts.append(receipt)
        require(len(by_lead)==73,"EA4_PGRB2_LEAD_COUNT")
        weather={"temperature_c":[],"rh_percent":[],"wind_2m":[],"precip_mm":[]}; duplicate_collapses=0
        for lead in targets:
            temp=instant(by_lead[lead],"T2",lead); rh=instant(by_lead[lead],"RH2",lead); u=instant(by_lead[lead],"U10",lead); v=instant(by_lead[lead],"V10",lead); precip,collapsed=apcp(by_lead[lead],lead); duplicate_collapses+=collapsed
            require(180<=temp["value"]<=330 and 0<=rh["value"]<=100 and abs(u["value"])<=100 and abs(v["value"])<=100,"EA4_GFS_RAW_SANITY")
            length=lead-block_start(lead)
            if length==1: hourly_precip=precip["value"]
            else:
                prev,_=apcp(by_lead[lead-1],lead-1); require(prev["start_step"]==precip["start_step"],f"EA4_APCP_CROSS_BLOCK:F{lead:03d}"); hourly_precip=precip["value"]-prev["value"]
            require(math.isfinite(hourly_precip) and 0<=hourly_precip<=200,f"EA4_APCP_HOURLY_INVALID:F{lead:03d}")
            vt=cycle+timedelta(hours=lead); weather["temperature_c"].append((vt,temp["value"]-273.15)); weather["rh_percent"].append((vt,rh["value"])); weather["wind_2m"].append((vt,math.hypot(u["value"],v["value"])*WIND_FACTOR)); weather["precip_mm"].append((vt,hourly_precip))
        expected=[tick+timedelta(hours=i) for i in range(1,73)]
        for name,points in weather.items(): require(len(points)==72 and [t for t,_ in points]==expected,f"EA4_WEATHER_SERIES_ALIGNMENT:{name}")

        sflux={}; sflux_receipts=[]; idx_hashes=[]
        with ThreadPoolExecutor(max_workers=CONCURRENCY) as pool:
            futures=[pool.submit(fetch_sflux_lead,cycle,lead,tick) for lead in leads]
            for future in as_completed(futures):
                lead,item,receipt,line_hash=future.result(); sflux[lead]=item; sflux_receipts.append(receipt); idx_hashes.append({"lead":lead,"line_sha256":line_hash})
        require(len(sflux)==73,"EA4_SFLUX_ENDPOINT_COUNT")
        solar=[]
        for lead in targets:
            value=(sflux[lead-1]["value"]+sflux[lead]["value"])/2*SOLAR_FACTOR; require(math.isfinite(value) and value>=0,f"EA4_SOLAR_INTERVAL_INVALID:F{lead:03d}"); solar.append((cycle+timedelta(hours=lead),value))
        require([t for t,_ in solar]==expected,"EA4_SOLAR_ALIGNMENT")

        temp_map=dict(weather["temperature_c"]); rh_map=dict(weather["rh_percent"]); wind_map=dict(weather["wind_2m"]); solar_map=dict(solar)
        future_et0=[]
        for vt in expected:
            t=temp_map[vt]; rh=rh_map[vt]; ea=(rh/100.0)*0.6108*math.exp(17.27*t/(t+237.3)); et=scalar_eto(t,ea,solar_map[vt],wind_map[vt],vt); future_et0.append((vt,et))
        require(len(future_et0)==72 and all(math.isfinite(v) for _,v in future_et0),"EA4_FUTURE_ET0_72_FINITE_REQUIRED")

        retention_chain=sha256_json(sorted(receipts,key=lambda x:(x["kind"],x["identity_sha256"])))
        result.update({
            "future_weather":{"point_count":72,"temperature_c_sha256":hash_series(weather["temperature_c"]),"relative_humidity_percent_sha256":hash_series(weather["rh_percent"]),"wind_2m_m_s_sha256":hash_series(weather["wind_2m"]),"precipitation_mm_sha256":hash_series(weather["precip_mm"]),"apcp_semantic_duplicate_collapse_count":duplicate_collapses,"all_finite":True,"precipitation_nonnegative":True},
            "future_solar":{"endpoint_count":73,"interval_count":72,"endpoint_sequence_sha256":hash_series([(cycle+timedelta(hours=lead),sflux[lead]["value"]) for lead in leads]),"solar_energy_sequence_sha256":hash_series(solar),"param_number_set":sorted({x["param_number"] for x in sflux.values()}),"param_id_set":sorted({x["param_id"] for x in sflux.values()}),"short_name_set":sorted({x["short_name"] for x in sflux.values()}),"native_index_set":sorted({x["native_index"] for x in sflux.values()}),"quality_status":"LIMITED"},
            "future_et0":{"point_count":72,"sequence_sha256":hash_series(future_et0),"finite_count":72,"negative_count":sum(1 for _,v in future_et0 if v<0),"negative_clipping_performed":False,"algorithm_id":"ASCE_STANDARDIZED_REFERENCE_ET_SHORT_HOURLY_V1","qualification_oracle":"refet-0.4.2-asce"},
            "raw_retention":{"qualification_class":AUTH["raw_retention_qualification"]["class"],"receipt_count":len(receipts),"total_retained_bytes":sum(x["bytes"] for x in receipts),"receipt_chain_sha256":retention_chain,"private_root_publicly_emitted":False,"raw_bytes_uploaded":False,"ea5_durable_retention_still_required":True},
            "live_source_qualified":True,"gfs_72h_full_value_pipeline_qualified":True,"future_et0_72h_value_execution_qualified":True,"ea2_package_formal_eligible":False,"ea5_candidate_development_authorized":True,
            "decision":AUTH["live_qualification"]["success_decision"],"status":"PASS"
        })
    except Exception as exc:
        result["error"]=f"{type(exc).__name__}:{exc}"[:1200]
        result["decision"]=AUTH["live_qualification"]["failure_decision"]
        OUT.write_text(json.dumps(result,indent=2,sort_keys=True)+"\n",encoding="utf-8")
        raise
    OUT.write_text(json.dumps(result,indent=2,sort_keys=True)+"\n",encoding="utf-8")
    print(json.dumps({"status":result["status"],"decision":result["decision"],"tick":result["tick_utc"],"cycle":result["gfs_chronology"]["selected_cycle_utc"],"retention_receipts":result["raw_retention"]["receipt_count"],"future_et0_points":result["future_et0"]["point_count"]},sort_keys=True))


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"EA4_FAIL:{type(exc).__name__}:{exc}",file=os.sys.stderr)
        raise SystemExit(1)
