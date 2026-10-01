#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
import re
import subprocess
import sys
import time
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import unquote, urlparse
from urllib.request import Request, urlopen

AUTHORITY_COMMIT = "f1c43c5c7379748c5609184cd8acc86ff9b1608e"
HISTORICAL_HELPER_REF = "scripts/runtime_acceptance/MCFT_CAP_09_EA5E2_LIVE_PROVIDER_TWO_PHASE.py"
HISTORICAL_HELPER_BLOB = "c9bab62c980273ba3669b2bff002d66244916d1b"
HISTORICAL_EA4_REF = "scripts/runtime_acceptance/PROBE_MCFT_CAP_09_EA4_LIVE_SOURCE_EXACT_HEAD_QUALIFICATION.py"
HISTORICAL_EA4_BLOB = "ff2ad210387402a74731968e14746210fd2440dd"
AUTH_REF = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA4-LIVE-SOURCE-EXACT-HEAD-QUALIFICATION-V1.json"
AUTH_BLOB = "791e3d24bdc862641c77ddd26778495cb8e6a7dd"
USER_AGENT = "GEOX-MCFT-CAP09-EA4-LIVE-PROOF/1.0"

ANCHOR_RE = re.compile(r'<a\b[^>]*href\s*=\s*["\'](?P<href>[^"\']+)["\'][^>]*>.*?</a>', re.I | re.S)
OBJECT_RE = re.compile(r'gfs\.t\d{2}z\.(?:pgrb2\.0p25\.f\d{3}|sfluxgrbf\d{3}\.grib2)(?:\.idx)?', re.I)
STAMP_RE = re.compile(r'\b(?P<stamp>\d{2}-[A-Za-z]{3}-\d{4}\s+\d{2}:\d{2})\b')
SIZE_RE = re.compile(r'\b(?P<size>[0-9]+(?:\.[0-9]+)?[KMGTP]?)\b', re.I)
TAG_RE = re.compile(r'<[^>]+>', re.S)


def fail(code: str) -> None:
    raise RuntimeError(code)


def require(condition: bool, code: str) -> None:
    if not condition:
        fail(code)


def sha256_bytes(body: bytes) -> str:
    return "sha256:" + hashlib.sha256(body).hexdigest()


def git(root: Path, *args: str) -> str:
    return subprocess.check_output(["git", *args], cwd=root, text=True).strip()


def repo_root() -> Path:
    return Path(git(Path.cwd(), "rev-parse", "--show-toplevel"))


def parse_utc(raw: str) -> datetime:
    value = raw.strip().replace("Z", "+00:00")
    dt = datetime.fromisoformat(value)
    require(dt.tzinfo is not None, "SFLUX_DIAGNOSTIC_TIMESTAMP_TZ_REQUIRED")
    return dt.astimezone(timezone.utc)


def canonical_hour(raw: str) -> datetime:
    dt = parse_utc(raw)
    require(dt.minute == 0 and dt.second == 0 and dt.microsecond == 0, "SFLUX_DIAGNOSTIC_TARGET_CANONICAL_HOUR_REQUIRED")
    return dt


def iso(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


def parse_size(token: str) -> float:
    match = re.fullmatch(r"([0-9]+(?:\.[0-9]+)?)([KMGTP]?)", token.strip(), re.I)
    require(bool(match), "SFLUX_DIAGNOSTIC_DIRECTORY_SIZE_UNPARSEABLE")
    factor = {"": 1, "K": 1024, "M": 1024**2, "G": 1024**3, "T": 1024**4, "P": 1024**5}[match.group(2).upper()]
    return float(match.group(1)) * factor


def parse_directory(body: bytes) -> dict[str, list[dict]]:
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
        entries.setdefault(basename, []).append({
            "minute": minute,
            "upper": minute + timedelta(seconds=59, microseconds=999999),
            "size": parse_size(size.group("size")),
        })
    require(bool(entries), "SFLUX_DIAGNOSTIC_DIRECTORY_ENTRIES_REQUIRED")
    return entries


def candidate_cycles(target: datetime) -> list[datetime]:
    return [target - timedelta(hours=back) for back in range(49) if (target - timedelta(hours=back)).hour in (0, 6, 12, 18)]


def pgrb2_names(cycle: datetime, lead: int) -> tuple[str, str]:
    stem = f"gfs.t{cycle:%H}z.pgrb2.0p25.f{lead:03d}"
    return stem, stem + ".idx"


def sflux_names(cycle: datetime, lead: int) -> tuple[str, str]:
    stem = f"gfs.t{cycle:%H}z.sfluxgrbf{lead:03d}.grib2"
    return stem, stem + ".idx"


def request_bytes(url: str, code: str, max_bytes: int, headers: dict[str, str] | None, counters: dict[str, int], attempts: int = 4):
    parsed = urlparse(url)
    require(parsed.scheme == "https", f"{code}_HTTPS_REQUIRED")
    last = None
    for attempt in range(attempts):
        counters["http_attempt_count"] += 1
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
                counters["provider_read_request_count"] += 1
                return int(response.status), response.headers, body, response.geturl()
        except (HTTPError, URLError, TimeoutError) as exc:
            last = exc
            if attempt + 1 < attempts:
                time.sleep(0.75 * (attempt + 1))
    raise RuntimeError(f"{code}_HTTP_FAILED:{type(last).__name__}")


def header_utc(headers, name: str) -> str | None:
    raw = headers.get(name)
    if not raw:
        return None
    parsed = parsedate_to_datetime(raw)
    require(parsed.tzinfo is not None, f"SFLUX_DIAGNOSTIC_{name.upper().replace('-', '_')}_TZ_REQUIRED")
    return iso(parsed.astimezone(timezone.utc))


def directory_url(root: str, cycle: datetime) -> str:
    return f"{root}/gfs.{cycle:%Y%m%d}/{cycle:%H}/atmos/"


def select_cycle(auth: dict, target: datetime, counters: dict[str, int], forced_cycle: datetime | None) -> tuple[datetime, list[dict]]:
    point_count = int(auth["gfs"]["point_count"])
    max_lead = int(auth["gfs"]["max_lead"])
    production_root = auth["gfs"]["production_root"]
    cycles = [forced_cycle] if forced_cycle else candidate_cycles(target)
    rejections: list[dict] = []
    for cycle in cycles:
        require(cycle is not None, "SFLUX_DIAGNOSTIC_CYCLE_REQUIRED")
        lead_start = int((target - cycle).total_seconds() // 3600) + 1
        lead_end = lead_start + point_count - 1
        support = lead_start - 1
        if support < 0 or lead_end > max_lead:
            rejections.append({"cycle": iso(cycle), "reason": "LEAD_WINDOW_OUT_OF_RANGE"})
            continue
        try:
            url = directory_url(production_root, cycle)
            status, _, body, final_url = request_bytes(url, "SFLUX_DIAGNOSTIC_DIRECTORY", 20_000_000, None, counters)
            require(status == 200, f"SFLUX_DIAGNOSTIC_DIRECTORY_HTTP_{status}")
            final = urlparse(final_url)
            require(final.hostname == "nomads.ncep.noaa.gov" and final.path == urlparse(url).path, "SFLUX_DIAGNOSTIC_DIRECTORY_IDENTITY_DRIFT")
            entries = parse_directory(body)
            for lead in range(support, lead_end + 1):
                for name in pgrb2_names(cycle, lead):
                    match = entries.get(name, [])
                    require(len(match) == 1 and match[0]["size"] > 0, f"PGRB2_DIRECTORY_ENTRY_MISSING:{name}")
                    require(match[0]["upper"] <= target, f"PGRB2_DIRECTORY_ENTRY_AFTER_TARGET:{name}")
            for lead in range(support, lead_end + 1):
                for name in sflux_names(cycle, lead):
                    match = entries.get(name, [])
                    require(len(match) == 1 and match[0]["size"] > 0, f"SFLUX_DIRECTORY_ENTRY_MISSING:{name}")
                    require(match[0]["upper"] <= target, f"SFLUX_DIRECTORY_ENTRY_AFTER_TARGET:{name}")
            return cycle, rejections
        except Exception as exc:
            rejections.append({"cycle": iso(cycle), "reason": str(exc)[:240]})
    raise RuntimeError("SFLUX_DIAGNOSTIC_NO_COMPLETE_GFS_CYCLE:" + json.dumps(rejections, separators=(",", ":")))


def parse_sflux_idx(text: str, lead: int) -> dict:
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
        require(idx + 1 < len(rows), f"SFLUX_DIAGNOSTIC_IDX_LAST_RECORD:F{lead:03d}")
        end = rows[idx + 1]["offset"] - 1
        eligible.append({
            "offset": row["offset"],
            "end": end,
            "length": end - row["offset"] + 1,
            "line_sha256": sha256_bytes(row["line"].encode("utf-8")),
        })
    require(len(eligible) == 1, f"SFLUX_DIAGNOSTIC_INSTANT_RECORD_COUNT:F{lead:03d}:{len(eligible)}")
    return eligible[0]


def selftest() -> None:
    idx = "\n".join([
        "1:0:d=2026100100:DSWRF:surface:15 hour fcst:",
        "2:120:d=2026100100:TMP:surface:15 hour fcst:",
    ])
    selected = parse_sflux_idx(idx, 15)
    require(selected["offset"] == 0, "SFLUX_DIAGNOSTIC_SELFTEST_OFFSET")
    require(selected["end"] == 119, "SFLUX_DIAGNOSTIC_SELFTEST_END")
    require(selected["length"] == 120, "SFLUX_DIAGNOSTIC_SELFTEST_LENGTH")
    require(canonical_hour("2026-10-01T09:00:00Z") == datetime(2026, 10, 1, 9, tzinfo=timezone.utc), "SFLUX_DIAGNOSTIC_SELFTEST_TARGET")
    require(parse_utc("2026-10-01T08:37:15Z") < datetime(2026, 10, 1, 9, tzinfo=timezone.utc), "SFLUX_DIAGNOSTIC_SELFTEST_NONCANONICAL_LAST_MODIFIED")
    print(json.dumps({
        "schema_version": "geox_mcft_cap09_sflux_boundary_diagnostic_selftest_v1",
        "status": "PASS",
        "network_request_count": 0,
        "database_write_count": 0,
        "r2_write_count": 0,
        "provider_semantics_changed": False,
    }, sort_keys=True))


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--target")
    parser.add_argument("--lead", type=int, default=15)
    parser.add_argument("--cycle")
    parser.add_argument("--out")
    parser.add_argument("--selftest", action="store_true")
    args = parser.parse_args()

    if args.selftest:
        selftest()
        return

    require(bool(args.target), "SFLUX_DIAGNOSTIC_TARGET_REQUIRED")
    require(0 <= args.lead <= 120, "SFLUX_DIAGNOSTIC_LEAD_RANGE")
    target = canonical_hour(args.target)
    forced_cycle = canonical_hour(args.cycle) if args.cycle else None

    root = repo_root()
    helper_blob = git(root, "rev-parse", f"{AUTHORITY_COMMIT}:{HISTORICAL_HELPER_REF}")
    ea4_blob = git(root, "rev-parse", f"{AUTHORITY_COMMIT}:{HISTORICAL_EA4_REF}")
    auth_blob = git(root, "rev-parse", f"{AUTHORITY_COMMIT}:{AUTH_REF}")
    require(helper_blob == HISTORICAL_HELPER_BLOB, f"SFLUX_DIAGNOSTIC_HELPER_BLOB_DRIFT:{helper_blob}")
    require(ea4_blob == HISTORICAL_EA4_BLOB, f"SFLUX_DIAGNOSTIC_EA4_BLOB_DRIFT:{ea4_blob}")
    require(auth_blob == AUTH_BLOB, f"SFLUX_DIAGNOSTIC_AUTH_BLOB_DRIFT:{auth_blob}")
    auth = json.loads(git(root, "show", f"{AUTHORITY_COMMIT}:{AUTH_REF}"))

    counters = {"provider_read_request_count": 0, "http_attempt_count": 0}
    observed_at = datetime.now(timezone.utc)
    selected_cycle, cycle_rejections = select_cycle(auth, target, counters, forced_cycle)

    production_root = auth["gfs"]["production_root"]
    grib_url = f"{production_root}/gfs.{selected_cycle:%Y%m%d}/{selected_cycle:%H}/atmos/gfs.t{selected_cycle:%H}z.sfluxgrbf{args.lead:03d}.grib2"
    idx_url = grib_url + ".idx"

    idx_status, idx_headers, idx_body, idx_final = request_bytes(
        idx_url,
        f"SFLUX_DIAGNOSTIC_IDX_F{args.lead:03d}",
        2_000_000,
        {"Accept": "text/plain,*/*;q=0.5"},
        counters,
    )
    selected_range = parse_sflux_idx(idx_body.decode("utf-8"), args.lead)
    range_header = f"bytes={selected_range['offset']}-{selected_range['end']}"

    grib_status, grib_headers, message, grib_final = request_bytes(
        grib_url,
        f"SFLUX_DIAGNOSTIC_RANGE_F{args.lead:03d}",
        12_000_000,
        {"Range": range_header},
        counters,
    )

    content_range = grib_headers.get("Content-Range", "")
    match = re.fullmatch(r"bytes\s+(\d+)-(\d+)/(\d+)", content_range)
    content_range_matches = bool(match) and int(match.group(1)) == selected_range["offset"] and int(match.group(2)) == selected_range["end"]
    length_matches = len(message) == selected_range["length"]
    starts_grib = message.startswith(b"GRIB")
    ends_7777 = message.endswith(b"7777")
    idx_last_modified = header_utc(idx_headers, "Last-Modified")
    grib_last_modified = header_utc(grib_headers, "Last-Modified")
    idx_not_after_target = parse_utc(idx_last_modified) <= target if idx_last_modified else False
    grib_not_after_target = parse_utc(grib_last_modified) <= target if grib_last_modified else False

    failures = []
    if idx_status != 200:
        failures.append("IDX_HTTP_STATUS")
    if grib_status != 206:
        failures.append("RANGE_HTTP_STATUS")
    if not content_range_matches:
        failures.append("CONTENT_RANGE")
    if not idx_not_after_target:
        failures.append("IDX_LAST_MODIFIED_AFTER_TARGET_OR_MISSING")
    if not grib_not_after_target:
        failures.append("RANGE_LAST_MODIFIED_AFTER_TARGET_OR_MISSING")
    if not length_matches:
        failures.append("BODY_LENGTH")
    if not starts_grib:
        failures.append("BODY_PREFIX")
    if not ends_7777:
        failures.append("BODY_SUFFIX")

    result = {
        "schema_version": "geox_mcft_cap09_sflux_boundary_diagnostic_v1",
        "status": "PASS",
        "diagnostic_scope": "READ_ONLY_PROVIDER_BOUNDARY_DIAGNOSTIC_NOT_QUALIFICATION_EVIDENCE",
        "retroactive_failure_proof": False,
        "observed_at": iso(observed_at),
        "target_t": iso(target),
        "lead": args.lead,
        "selected_cycle": iso(selected_cycle),
        "forced_cycle": iso(forced_cycle) if forced_cycle else None,
        "cycle_rejections": cycle_rejections,
        "historical_provider_source_commit_sha": AUTHORITY_COMMIT,
        "historical_provider_helper_blob_sha": helper_blob,
        "historical_ea4_dependency_blob_sha": ea4_blob,
        "historical_ea4_authority_blob_sha": auth_blob,
        "idx": {
            "status": idx_status,
            "final_host": urlparse(idx_final).hostname,
            "final_path": urlparse(idx_final).path,
            "sha256": sha256_bytes(idx_body),
            "bytes": len(idx_body),
            "last_modified": idx_last_modified,
            "last_modified_not_after_target": idx_not_after_target,
            "selected_line_sha256": selected_range["line_sha256"],
            "selected_offset": selected_range["offset"],
            "selected_end": selected_range["end"],
            "selected_length": selected_range["length"],
        },
        "range_response": {
            "status": grib_status,
            "final_host": urlparse(grib_final).hostname,
            "final_path": urlparse(grib_final).path,
            "content_range": content_range,
            "content_range_matches_selected_idx": content_range_matches,
            "last_modified": grib_last_modified,
            "last_modified_not_after_target": grib_not_after_target,
            "actual_length": len(message),
            "expected_length": selected_range["length"],
            "length_matches": length_matches,
            "starts_grib": starts_grib,
            "ends_7777": ends_7777,
            "sha256": sha256_bytes(message),
        },
        "historical_boundary_guard_equivalent_pass": len(failures) == 0,
        "boundary_failure_components": failures,
        "provider_read_request_count": counters["provider_read_request_count"],
        "http_attempt_count": counters["http_attempt_count"],
        "raw_body_emitted": False,
        "database_write_count": 0,
        "r2_write_count": 0,
        "formal_effect": False,
        "runtime_mutation": False,
        "production_mutation": False,
        "provider_semantics_changed": False,
    }

    text = json.dumps(result, indent=2, sort_keys=True) + "\n"
    if args.out:
        out = Path(args.out)
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(text, encoding="utf-8")
    sys.stdout.write(text)


if __name__ == "__main__":
    main()
