#!/usr/bin/env python3
from __future__ import annotations

import csv
import hashlib
import html
import io
import json
import math
import os
import re
import sys
import time
from dataclasses import dataclass
from datetime import date, datetime, time as dt_time, timedelta, timezone
from html.parser import HTMLParser
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse
from urllib.request import Request, urlopen
from zoneinfo import ZoneInfo

ROOT = Path.cwd()
CONFIG_PATH = ROOT / "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA9A-P0306Q-BOUNDED-GDD-STAGE-QUALIFICATION-V1.json"
OUT = ROOT / "acceptance-output/MCFT_CAP_09_EA9A_P0306Q_BOUNDED_GDD_STAGE_QUALIFICATION_RESULT.json"
CONFIG = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
SUBJECT_SHA = os.environ.get("MCFT_SUBJECT_SHA", "").strip()
USER_AGENT = "GEOX-MCFT-CAP09-EA9A-P0306Q-BOUNDED-GDD/1.0"


def require(condition: bool, code: str) -> None:
    if not condition:
        raise RuntimeError(code)


def sha256_bytes(body: bytes) -> str:
    return "sha256:" + hashlib.sha256(body).hexdigest()


def iso(value: datetime) -> str:
    return value.astimezone(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def safe_error(error: BaseException) -> str:
    return re.sub(r"https?://\S+", "[URL_REDACTED]", str(error))[:500]


def normalize_space(value: str) -> str:
    return re.sub(r"\s+", " ", html.unescape(value or "")).strip()


def normalize_key(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", normalize_space(value).lower()).strip("_")


def request_bytes(url: str, expected_host: str, expected_path: str, code: str, max_bytes: int) -> tuple[bytes, dict[str, str], str]:
    parsed = urlparse(url)
    require(parsed.scheme == "https" and parsed.hostname == expected_host and parsed.path == expected_path, f"{code}_REQUEST_IDENTITY")
    last: BaseException | None = None
    for attempt in range(3):
        try:
            req = Request(url, headers={
                "User-Agent": USER_AGENT,
                "Accept": "text/csv,text/html,text/plain;q=0.9,*/*;q=0.5",
                "Cache-Control": "no-cache",
            })
            with urlopen(req, timeout=90) as response:
                body = response.read(max_bytes + 1)
                require(len(body) <= max_bytes, f"{code}_BODY_TOO_LARGE")
                final_url = response.geturl()
                final = urlparse(final_url)
                require(int(response.status) == 200, f"{code}_HTTP_{response.status}")
                require(final.scheme == "https" and final.hostname == expected_host and final.path == expected_path, f"{code}_FINAL_IDENTITY")
                headers = {str(k).lower(): str(v) for k, v in response.headers.items()}
                return body, headers, final_url
        except (HTTPError, URLError, TimeoutError, RuntimeError) as exc:
            last = exc
            if attempt < 2:
                time.sleep(0.75 * (attempt + 1))
    raise RuntimeError(f"{code}_FETCH_FAILED:{type(last).__name__}:{safe_error(last or RuntimeError('UNKNOWN'))}")


class TextExtractor(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.parts: list[str] = []

    def handle_data(self, data: str) -> None:
        if data.strip():
            self.parts.append(data)

    def text(self) -> str:
        return normalize_space(" ".join(self.parts))


class TableRowExtractor(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.rows: list[list[str]] = []
        self._in_tr = False
        self._in_cell = False
        self._row: list[str] = []
        self._cell: list[str] = []

    def handle_starttag(self, tag: str, attrs) -> None:
        tag = tag.lower()
        if tag == "tr":
            self._in_tr = True
            self._row = []
        elif self._in_tr and tag in {"td", "th"}:
            self._in_cell = True
            self._cell = []

    def handle_endtag(self, tag: str) -> None:
        tag = tag.lower()
        if self._in_tr and self._in_cell and tag in {"td", "th"}:
            self._row.append(normalize_space(" ".join(self._cell)))
            self._in_cell = False
            self._cell = []
        elif self._in_tr and tag == "tr":
            if self._row:
                self.rows.append(self._row)
            self._in_tr = False
            self._row = []

    def handle_data(self, data: str) -> None:
        if self._in_cell and data.strip():
            self._cell.append(data)


def html_text(body: bytes) -> str:
    parser = TextExtractor()
    parser.feed(body.decode("utf-8", errors="strict"))
    return parser.text()


def parse_date(value: str) -> date | None:
    match = re.search(r"\b(\d{4}-\d{2}-\d{2})\b", normalize_space(value))
    if not match:
        return None
    try:
        return date.fromisoformat(match.group(1))
    except ValueError:
        return None


def finite_float(value: str | None) -> float | None:
    try:
        result = float(str(value or "").strip())
    except ValueError:
        return None
    return result if math.isfinite(result) else None


def c_to_f(value_c: float) -> float:
    return value_c * 9.0 / 5.0 + 32.0


def pioneer_base50_daily_gdu(max_c: float, min_c: float) -> float | None:
    if not (-50.0 <= min_c <= max_c <= 60.0):
        return None
    max_f = c_to_f(max_c)
    min_f = c_to_f(min_c)
    adjusted_max = min(max_f, float(CONFIG["base50_method"]["daily_max_f_upper_cap"]))
    adjusted_min = max(min_f, float(CONFIG["base50_method"]["daily_min_f_lower_floor"]))
    value = max(0.0, ((adjusted_max + adjusted_min) / 2.0) - 50.0)
    if value > float(CONFIG["base50_method"]["maximum_allowed_daily_gdu"]) + 1e-9:
        return None
    return value


@dataclass(frozen=True)
class DailyTemperature:
    day: date
    max_c: float
    min_c: float
    gdu: float


def locate_governed_csv_header(text: str, source: dict) -> tuple[int, list[str]]:
    required = list(source["required_csv_columns"])
    max_rows = int(source["maximum_csv_preamble_rows_before_header"])
    require(source["csv_export_format"] == "KBS_METADATA_PREAMBLE_THEN_COMMA_SEPARATED_TABLE", "EA9A_GDD_KBS561_EXPORT_FORMAT_DRIFT")
    require(source["csv_header_must_contain_all_required_columns"] is True, "EA9A_GDD_KBS561_HEADER_POLICY_DRIFT")
    candidates: list[tuple[int, list[str]]] = []
    for row_index, row in enumerate(csv.reader(io.StringIO(text))):
        if row_index >= max_rows:
            break
        normalized = [normalize_key(value) for value in row]
        if all(required_col in normalized for required_col in required):
            candidates.append((row_index, normalized))
    require(len(candidates) == 1, f"EA9A_GDD_KBS561_UNIQUE_HEADER_REQUIRED:found={len(candidates)}")
    return candidates[0]


def qualify_temperature_source() -> tuple[dict, dict[date, DailyTemperature]]:
    source = CONFIG["temperature_source"]
    metadata_body, metadata_headers, metadata_final = request_bytes(
        source["metadata_url"], source["allowed_host"], source["metadata_path"], "EA9A_GDD_KBS561_METADATA", 5_000_000
    )
    lower_meta = html_text(metadata_body).lower()
    marker_results = []
    for marker in source["required_metadata_markers"]:
        present = marker.lower() in lower_meta
        marker_results.append({"marker": marker, "present": present})
        require(present, f"EA9A_GDD_KBS561_METADATA_MARKER_MISSING:{normalize_key(marker)}")

    csv_body, csv_headers, csv_final = request_bytes(
        source["csv_url"], source["allowed_host"], source["csv_path"], "EA9A_GDD_KBS561_CSV", 30_000_000
    )
    text = csv_body.decode("utf-8-sig", errors="strict")
    header_row_index, normalized_headers = locate_governed_csv_header(text, source)
    lines = text.splitlines()
    require(header_row_index < len(lines), "EA9A_GDD_KBS561_HEADER_ROW_OUT_OF_RANGE")
    table_text = "\n".join(lines[header_row_index:])
    reader = csv.DictReader(io.StringIO(table_text))
    require(reader.fieldnames is not None, "EA9A_GDD_KBS561_CSV_HEADER_REQUIRED")
    actual_headers = [normalize_key(name) for name in reader.fieldnames]
    require(actual_headers == normalized_headers, "EA9A_GDD_KBS561_HEADER_REPARSE_DRIFT")
    for required_col in source["required_csv_columns"]:
        require(required_col in actual_headers, f"EA9A_GDD_KBS561_COLUMN_REQUIRED:{required_col}")

    key_map = {raw: normalize_key(raw) for raw in reader.fieldnames}
    records: dict[date, DailyTemperature] = {}
    parsed_date_count = 0
    invalid_temperature_row_count = 0
    duplicate_date_count = 0
    for raw_row in reader:
        row = {key_map[k]: v for k, v in raw_row.items() if k is not None}
        day = parse_date(row.get("date", ""))
        if day is None:
            continue
        parsed_date_count += 1
        max_c = finite_float(row.get("air_temp_107_max"))
        min_c = finite_float(row.get("air_temp_107_min"))
        if max_c is None or min_c is None:
            invalid_temperature_row_count += 1
            continue
        gdu = pioneer_base50_daily_gdu(max_c, min_c)
        if gdu is None:
            invalid_temperature_row_count += 1
            continue
        if day in records:
            duplicate_date_count += 1
            continue
        records[day] = DailyTemperature(day=day, max_c=max_c, min_c=min_c, gdu=gdu)

    require(parsed_date_count > 0, "EA9A_GDD_KBS561_NO_DATED_ROWS")
    require(duplicate_date_count == 0, "EA9A_GDD_KBS561_DUPLICATE_DATE")
    require(bool(records), "EA9A_GDD_KBS561_NO_VALID_DAILY_EXTREMA")
    latest_valid = max(records)
    earliest_valid = min(records)
    proof = {
        "source_id": "KBS_LTER_DATATABLE_561_DAILY_EXTREMA",
        "source_class": source["source_class"],
        "datatable_id": source["datatable_id"],
        "dataset": source["dataset"],
        "sensor": source["sensor"],
        "metadata_final_url": metadata_final,
        "metadata_response_sha256": sha256_bytes(metadata_body),
        "metadata_response_bytes": len(metadata_body),
        "metadata_required_markers": marker_results,
        "csv_final_url": csv_final,
        "csv_response_sha256": sha256_bytes(csv_body),
        "csv_response_bytes": len(csv_body),
        "csv_export_format": source["csv_export_format"],
        "csv_header_row_index_zero_based": header_row_index,
        "csv_preamble_row_count": header_row_index,
        "csv_required_columns_exactly_located": True,
        "csv_parsed_date_row_count": parsed_date_count,
        "csv_valid_daily_extrema_row_count": len(records),
        "csv_invalid_or_missing_daily_extrema_row_count": invalid_temperature_row_count,
        "csv_earliest_valid_date": earliest_valid.isoformat(),
        "csv_latest_valid_date": latest_valid.isoformat(),
        "metadata_last_modified": metadata_headers.get("last-modified"),
        "csv_last_modified": csv_headers.get("last-modified"),
        "raw_provider_body_emitted": False,
        "static_catalog_end_date_used_as_live_row_end_authority": False,
        "synthetic_daily_table_7_used": False,
        "raw_hourly_means_relabelled_daily_extrema": False,
        "spatial_confidence_upgrade_claimed": False,
        "identity_and_extrema_semantics_qualified": True,
    }
    return proof, records


def accumulate_bounded_gdd(records: dict[date, DailyTemperature], observed_at: datetime) -> dict:
    scope = CONFIG["formal_scope_anchor"]
    tz = ZoneInfo(scope["planting_timezone"])
    observed_local = observed_at.astimezone(tz)
    planting_day = date.fromisoformat(scope["planting_local_calendar_date"])
    previous_local_day = observed_local.date() - timedelta(days=1)
    require(previous_local_day >= planting_day, "EA9A_GDD_AUTHORITY_BEFORE_PLANTING")

    lower = 0.0
    upper = 0.0
    valid_exact_days = 0
    missing_or_invalid_days = 0
    planting_day_valid = False
    daily_digest_rows: list[str] = []
    day = planting_day
    while day <= previous_local_day:
        record = records.get(day)
        if day == planting_day:
            if record is None:
                day_lower, day_upper = 0.0, 36.0
                missing_or_invalid_days += 1
            else:
                day_lower, day_upper = 0.0, record.gdu
                planting_day_valid = True
                valid_exact_days += 1
        elif record is None:
            day_lower, day_upper = 0.0, 36.0
            missing_or_invalid_days += 1
        else:
            day_lower = day_upper = record.gdu
            valid_exact_days += 1
        lower += day_lower
        upper += day_upper
        daily_digest_rows.append(f"{day.isoformat()}|{day_lower:.6f}|{day_upper:.6f}|{'VALID' if record else 'UNCERTAIN'}")
        day += timedelta(days=1)

    local_midnight = datetime.combine(observed_local.date(), dt_time.min, tzinfo=tz)
    hours_since_local_midnight = (observed_local - local_midnight).total_seconds() / 3600.0
    return {
        "authority_observed_at_local": observed_local.isoformat(),
        "planting_local_calendar_date": planting_day.isoformat(),
        "previous_complete_local_day": previous_local_day.isoformat(),
        "complete_local_day_count_including_planting_day": (previous_local_day - planting_day).days + 1,
        "valid_daily_extrema_day_count": valid_exact_days,
        "missing_or_invalid_daily_extrema_day_count": missing_or_invalid_days,
        "planting_day_valid_daily_extrema_available": planting_day_valid,
        "current_incomplete_local_day_used": False,
        "minimum_accumulated_base50_gdd": round(lower, 6),
        "maximum_accumulated_base50_gdd": round(upper, 6),
        "daily_bounded_sequence_sha256": sha256_bytes("\n".join(daily_digest_rows).encode("utf-8")),
        "hours_since_start_of_current_local_day": round(hours_since_local_midnight, 6),
        "minimum_gdd_gte_2608": lower >= 2608.0,
        "maximum_gdd_lt_2608": upper < 2608.0,
        "backward_6h_stability_possible_from_previous_complete_day": lower >= 2608.0 and hours_since_local_midnight >= 6.0,
        "future_observations_used": False,
        "silent_imputation_used": False,
        "full_season_ex_post_normalization_used": False,
        "rm_to_gdu_conversion_used": False,
        "canadian_heat_unit_conversion_used": False,
    }


def parse_aglog_rows(body: bytes) -> list[list[str]]:
    parser = TableRowExtractor()
    parser.feed(body.decode("utf-8", errors="strict"))
    return parser.rows


def scan_harvest_guard(observed_at: datetime) -> dict:
    guard = CONFIG["harvest_guard"]
    scope = CONFIG["formal_scope_anchor"]
    planting_day = date.fromisoformat(scope["planting_local_calendar_date"])
    authority_local_date = observed_at.astimezone(ZoneInfo(scope["planting_timezone"])).date()
    area_re = re.compile(guard["area_regex"], re.I)
    tokens = [str(value).lower() for value in guard["termination_observation_type_tokens"]]
    pages: list[dict] = []
    matches: list[dict] = []
    reached_anchor_or_earlier = False
    for page_number in range(1, int(guard["maximum_pages"]) + 1):
        url = guard["index_url"] if page_number == 1 else f"{guard['index_url']}?page={page_number}"
        body, _, final_url = request_bytes(url, guard["allowed_host"], urlparse(url).path, f"EA9A_GDD_AGLOG_PAGE_{page_number}", 8_000_000)
        rows = parse_aglog_rows(body)
        dated_rows = 0
        min_day: date | None = None
        max_day: date | None = None
        for cells in rows:
            if len(cells) < 5:
                continue
            row_day = parse_date(cells[0])
            if row_day is None:
                continue
            dated_rows += 1
            min_day = row_day if min_day is None or row_day < min_day else min_day
            max_day = row_day if max_day is None or row_day > max_day else max_day
            if row_day <= planting_day:
                reached_anchor_or_earlier = True
            if row_day < planting_day or row_day > authority_local_date:
                continue
            obs_type = normalize_space(cells[2]).lower()
            areas = normalize_space(cells[4])
            if area_re.search(areas) and any(token in obs_type for token in tokens):
                matches.append({"observation_date": row_day.isoformat(), "observation_type": normalize_space(cells[2]), "areas": areas, "provider_body_emitted": False})
        pages.append({
            "page_number": page_number,
            "dated_row_count": dated_rows,
            "minimum_observation_date": min_day.isoformat() if min_day else None,
            "maximum_observation_date": max_day.isoformat() if max_day else None,
            "response_sha256": sha256_bytes(body),
            "response_bytes": len(body),
            "final_url": final_url,
            "provider_body_emitted": False,
        })
        if reached_anchor_or_earlier:
            break
    require(reached_anchor_or_earlier, "EA9A_GDD_AGLOG_SCAN_DID_NOT_REACH_PLANTING_ANCHOR")
    return {
        "scan_performed": True,
        "scanned_page_count": len(pages),
        "scanned_page_proofs": pages,
        "scan_reached_planting_anchor_or_earlier": reached_anchor_or_earlier,
        "matching_t1_harvest_or_termination_event_count": len(matches),
        "matching_events": matches,
        "no_retrievable_t1_harvest_or_termination_event_as_of_authority_time": len(matches) == 0,
        "global_absence_claimed": False,
        "future_observations_used": False,
    }


def write_result(result: dict) -> None:
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(result, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def main() -> None:
    require(bool(re.fullmatch(r"[0-9a-f]{40}", SUBJECT_SHA)), "EA9A_GDD_EXACT_SUBJECT_SHA_REQUIRED")
    require(CONFIG["schema_version"] == "geox_mcft_cap09_ea9a_p0306q_bounded_gdd_stage_qualification_v1", "EA9A_GDD_SCHEMA_REQUIRED")
    require(CONFIG["formal_scope_anchor"]["hybrid_product_code"] == "P0306Q", "EA9A_GDD_P0306Q_SCOPE_REQUIRED")
    require(CONFIG["formal_scope_anchor"]["relative_maturity_days"] == 103, "EA9A_GDD_RM103_SCOPE_REQUIRED")
    require(CONFIG["bounded_proxy"]["physiological_maturity_interval_gdu"] == [2392, 2608], "EA9A_GDD_R6_PROXY_INTERVAL_REQUIRED")
    require(CONFIG["bounded_proxy"]["late_stage_deterministic_minimum_rule_gdu"] == 2608, "EA9A_GDD_LATE_MINIMUM_RULE_REQUIRED")

    observed_at = datetime.now(timezone.utc)
    source_proof, records = qualify_temperature_source()
    accumulation = accumulate_bounded_gdd(records, observed_at)
    thermal_late_candidate = bool(accumulation["minimum_gdd_gte_2608"] and accumulation["backward_6h_stability_possible_from_previous_complete_day"])
    harvest_guard = {
        "scan_performed": False,
        "reason": "THERMAL_LATE_CANDIDATE_NOT_REACHED",
        "no_retrievable_t1_harvest_or_termination_event_as_of_authority_time": None,
        "global_absence_claimed": False,
        "future_observations_used": False,
    }
    if thermal_late_candidate:
        try:
            harvest_guard = scan_harvest_guard(observed_at)
        except Exception as exc:
            harvest_guard = {
                "scan_performed": True,
                "scan_failed_closed": True,
                "error": safe_error(exc),
                "no_retrievable_t1_harvest_or_termination_event_as_of_authority_time": False,
                "global_absence_claimed": False,
                "future_observations_used": False,
            }

    positive = bool(
        source_proof["identity_and_extrema_semantics_qualified"]
        and accumulation["minimum_gdd_gte_2608"]
        and accumulation["backward_6h_stability_possible_from_previous_complete_day"]
        and harvest_guard.get("no_retrievable_t1_harvest_or_termination_event_as_of_authority_time") is True
    )
    result_code = "CURRENT_SEASON_LATE_STAGE_AUTHORITY_ESTABLISHED_UNDER_BOUNDED_GDD_PROXY" if positive else "CURRENT_SEASON_FOUR_STAGE_AUTHORITY_NOT_ESTABLISHED_UNDER_BOUNDED_GDD_PROXY"

    negative_reason = None
    if not positive:
        if accumulation["minimum_accumulated_base50_gdd"] < 2608:
            negative_reason = "CONSERVATIVE_ACCUMULATED_GDD_LOWER_BOUND_BELOW_2608"
        elif not accumulation["backward_6h_stability_possible_from_previous_complete_day"]:
            negative_reason = "AMENDMENT09_BACKWARD_6H_STABILITY_NOT_ESTABLISHED"
        elif harvest_guard.get("scan_failed_closed"):
            negative_reason = "HARVEST_OR_TERMINATION_GUARD_FETCH_FAILED_CLOSED"
        elif harvest_guard.get("no_retrievable_t1_harvest_or_termination_event_as_of_authority_time") is False:
            negative_reason = "HARVEST_OR_TERMINATION_GUARD_NOT_SATISFIED"
        else:
            negative_reason = "BOUNDED_GDD_STAGE_INVARIANCE_NOT_ESTABLISHED"

    result = {
        "schema_version": "geox_mcft_cap09_ea9a_p0306q_bounded_gdd_stage_qualification_result_v1",
        "status": "PASS",
        "subject_head_sha": SUBJECT_SHA,
        "authority_observed_at_utc": iso(observed_at),
        "algorithm_id": CONFIG["stage_decision_policy"]["algorithm_id"],
        "result": result_code,
        "negative_reason": negative_reason,
        "formal_scope": CONFIG["formal_scope_anchor"],
        "temperature_source_proof": source_proof,
        "bounded_gdd_accumulation": accumulation,
        "bounded_proxy": CONFIG["bounded_proxy"],
        "harvest_guard": harvest_guard,
        "stage_decision": {
            "stage_authority_established": positive,
            "stage_code": "LATE" if positive else None,
            "stage_is_observed_biological_stage": False,
            "stage_epistemic_class": CONFIG["stage_decision_policy"]["positive_stage_epistemic_class"] if positive else None,
            "full_continuous_gdd_to_four_stage_mapping_used": False,
            "silking_used_as_mid_late_boundary": False,
            "physiological_maturity_used_as_mid_late_boundary": False,
            "threshold_center_used_instead_of_full_interval": False,
            "current_ea9a_bounded_gdd_attempt_terminal": not positive,
        },
        "authority_effect": {
            "current_season_2026_recovery_reopened": positive,
            "current_season_stage_authority_established": positive,
            "new_natural_season_created": False,
            "successor_epoch_selected": False,
            "database_write_count": 0,
            "formal_evidence_write_count": 0,
            "raw_object_write_count": 0,
            "runtime_config_write_count": 0,
            "scheduler_write_count": 0,
            "canonical_runtime_write_count": 0,
            "ea5e2_operational_activation_qualified": False,
            "ea5e3_effective": False,
            "formal_execution_count": "0/24",
            "mcft_cap09_completed": False,
        },
        "next_primary_successor": CONFIG["stage_decision_policy"]["positive_successor"] if positive else CONFIG["stage_decision_policy"]["negative_successor"],
        "parallel_operational_successor": CONFIG["stage_decision_policy"]["parallel_operational_successor"],
        "provider_raw_body_emitted": False,
        "future_observations_used": False,
    }
    write_result(result)
    print(json.dumps(result, indent=2, sort_keys=True))


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        failure = {
            "schema_version": "geox_mcft_cap09_ea9a_p0306q_bounded_gdd_stage_qualification_result_v1",
            "status": "FAIL",
            "subject_head_sha": SUBJECT_SHA or None,
            "observed_at_utc": iso(datetime.now(timezone.utc)),
            "error": safe_error(exc),
            "current_season_stage_authority_established": False,
            "database_write_count": 0,
            "formal_evidence_write_count": 0,
            "raw_object_write_count": 0,
            "runtime_config_write_count": 0,
            "scheduler_write_count": 0,
            "canonical_runtime_write_count": 0,
            "successor_epoch_selected": False,
            "formal_execution_count": "0/24",
            "provider_raw_body_emitted": False,
            "future_observations_used": False,
        }
        write_result(failure)
        print(json.dumps(failure, indent=2, sort_keys=True), file=sys.stderr)
        raise
