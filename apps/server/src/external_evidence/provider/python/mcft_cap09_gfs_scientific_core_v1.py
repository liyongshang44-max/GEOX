#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
import math
import sys
import tempfile
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

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


@dataclass(frozen=True)
class GfsScientificAuthorityV1:
    point_count: int
    max_lead: int
    pgrb2_grid_latitude: float
    pgrb2_grid_longitude_native: float
    wind_10m_to_2m_factor: float
    station_elevation_m: float
    station_latitude: float
    station_longitude: float
    solar_native_index: int
    solar_native_latitude: float
    solar_native_longitude_signed: float
    solar_w_m2_to_mj_m2_h_factor: float = 0.0036


def require_v1(condition: bool, code: str) -> None:
    if not condition:
        raise RuntimeError(code)


def sha256_bytes_v1(body: bytes) -> str:
    return "sha256:" + hashlib.sha256(body).hexdigest()


def canonical_decimal_half_away_from_zero_v1(value: float, decimals: int) -> float:
    require_v1(math.isfinite(value), "MCFT_CAP09_GFS_CANONICAL_DECIMAL_NONFINITE")
    require_v1(isinstance(decimals, int) and 0 <= decimals <= 12, "MCFT_CAP09_GFS_CANONICAL_DECIMAL_SCALE_INVALID")
    factor = 10 ** decimals
    scaled = abs(value) * factor
    rounded = math.floor(scaled + 0.5 + sys.float_info.epsilon * scaled)
    result = (-1.0 if value < 0 else 1.0) * rounded / factor
    return 0.0 if result == 0 else result


def dt_keys_v1(date_value, time_value) -> datetime:
    return datetime.strptime(
        str(int(date_value)).zfill(8) + str(int(time_value)).zfill(4),
        "%Y%m%d%H%M",
    ).replace(tzinfo=timezone.utc)


def grib_section_v1(message: bytes, wanted: int) -> bytes:
    offset = 16
    while offset + 5 <= len(message):
        if message[offset : offset + 4] == b"7777":
            break
        length = int.from_bytes(message[offset : offset + 4], "big")
        require_v1(length >= 5 and offset + length <= len(message), "MCFT_CAP09_GFS_GRIB_SECTION_LENGTH_INVALID")
        if int(message[offset + 4]) == wanted:
            return message[offset : offset + length]
        offset += length
    raise RuntimeError(f"MCFT_CAP09_GFS_GRIB_SECTION_NOT_FOUND:{wanted}")


def normalize_lon_v1(lon: float) -> float:
    return lon % 360.0


def pgrb2_role_v1(short: str, name: str, level_type: str, level: float) -> str | None:
    s, n, lev = short.lower(), name.lower(), float(level)
    if level_type == "heightAboveGround" and abs(lev - 2) < 1e-9:
        if s in {"2t", "t"} or n == "temperature":
            return "T2"
        if s in {"2r", "r"} or "relative humidity" in n:
            return "RH2"
    if level_type == "heightAboveGround" and abs(lev - 10) < 1e-9:
        if s in {"10u", "u"} or "u component of wind" in n:
            return "U10"
        if s in {"10v", "v"} or "v component of wind" in n:
            return "V10"
    if level_type == "surface" and (s in {"tp", "apcp"} or n == "total precipitation"):
        return "APCP"
    return None


def decode_pgrb2_v1(body: bytes, cycle: datetime, lead: int, authority: GfsScientificAuthorityV1) -> list[dict]:
    require_v1(cycle.tzinfo is not None, "MCFT_CAP09_GFS_PGRB2_CYCLE_TZ_REQUIRED")
    require_v1(body.startswith(b"GRIB"), f"MCFT_CAP09_GFS_PGRB2_NOT_GRIB:F{lead:03d}")
    cycle = cycle.astimezone(timezone.utc)
    records: list[dict] = []
    with tempfile.TemporaryFile() as handle:
        handle.write(body)
        handle.seek(0)
        while True:
            gid = codes_grib_new_from_file(handle)
            if gid is None:
                break
            try:
                role = pgrb2_role_v1(
                    str(codes_get(gid, "shortName")),
                    str(codes_get(gid, "name")),
                    str(codes_get(gid, "typeOfLevel")),
                    float(codes_get(gid, "level")),
                )
                if role is None:
                    continue
                step_type = str(codes_get(gid, "stepType"))
                start_step = int(codes_get(gid, "startStep"))
                end_step = int(codes_get(gid, "endStep"))
                data_dt = dt_keys_v1(codes_get(gid, "dataDate"), codes_get(gid, "dataTime"))
                valid_dt = dt_keys_v1(codes_get(gid, "validityDate"), codes_get(gid, "validityTime"))
                values = codes_get_array(gid, "values")
                lats = codes_get_array(gid, "latitudes")
                lons = codes_get_array(gid, "longitudes")
                require_v1(len(values) == 1 and len(lats) == 1 and len(lons) == 1, f"MCFT_CAP09_GFS_PGRB2_POINT_COUNT:{role}:F{lead:03d}")
                require_v1(
                    abs(float(lats[0]) - authority.pgrb2_grid_latitude) < 1e-6
                    and abs(normalize_lon_v1(float(lons[0])) - authority.pgrb2_grid_longitude_native) < 1e-6,
                    f"MCFT_CAP09_GFS_PGRB2_GRID_NODE_DRIFT:{role}:F{lead:03d}",
                )
                require_v1(
                    data_dt == cycle and valid_dt == cycle + timedelta(hours=lead) and end_step == lead,
                    f"MCFT_CAP09_GFS_PGRB2_CHRONOLOGY_DRIFT:{role}:F{lead:03d}",
                )
                value = float(values[0])
                require_v1(math.isfinite(value), f"MCFT_CAP09_GFS_PGRB2_NONFINITE:{role}:F{lead:03d}")
                records.append(
                    {
                        "role": role,
                        "step_type": step_type,
                        "start_step": start_step,
                        "end_step": end_step,
                        "units": str(codes_get(gid, "units")),
                        "value": value,
                        "section4": sha256_bytes_v1(grib_section_v1(bytes(codes_get_message(gid)), 4)),
                    }
                )
            finally:
                codes_release(gid)
    return records


def exactly_one_v1(items: list[dict], code: str) -> dict:
    require_v1(len(items) == 1, f"{code}:COUNT={len(items)}")
    return items[0]


def instant_v1(records: list[dict], role: str, lead: int) -> dict:
    return exactly_one_v1(
        [row for row in records if row["role"] == role and row["step_type"] == "instant" and row["end_step"] == lead],
        f"MCFT_CAP09_GFS_INSTANT_NOT_UNIQUE:{role}:F{lead:03d}",
    )


def block_start_v1(lead: int) -> int:
    return 6 * ((lead - 1) // 6)


def apcp_v1(records: list[dict], lead: int) -> tuple[dict, int]:
    start = block_start_v1(lead)
    candidates = [
        row
        for row in records
        if row["role"] == "APCP"
        and row["step_type"] == "accum"
        and row["start_step"] == start
        and row["end_step"] == lead
    ]
    require_v1(bool(candidates), f"MCFT_CAP09_GFS_APCP_MISSING:S{start}:E{lead}")
    require_v1(len({row["section4"] for row in candidates}) == 1, f"MCFT_CAP09_GFS_APCP_SECTION4_AMBIGUITY:S{start}:E{lead}")
    require_v1(len({float(row["value"]).hex() for row in candidates}) == 1, f"MCFT_CAP09_GFS_APCP_VALUE_AMBIGUITY:S{start}:E{lead}")
    require_v1(len({row["units"] for row in candidates}) == 1, f"MCFT_CAP09_GFS_APCP_UNIT_AMBIGUITY:S{start}:E{lead}")
    return candidates[0], len(candidates) - 1


def decode_sflux_v1(message: bytes, cycle: datetime, lead: int, authority: GfsScientificAuthorityV1) -> dict:
    require_v1(cycle.tzinfo is not None, "MCFT_CAP09_GFS_SFLUX_CYCLE_TZ_REQUIRED")
    cycle = cycle.astimezone(timezone.utc)
    with tempfile.TemporaryFile() as handle:
        handle.write(message)
        handle.seek(0)
        gid = codes_grib_new_from_file(handle)
        require_v1(gid is not None, f"MCFT_CAP09_GFS_SFLUX_GRIB_REQUIRED:F{lead:03d}")
        try:
            discipline = int(codes_get(gid, "discipline"))
            category = int(codes_get(gid, "parameterCategory"))
            number = int(codes_get(gid, "parameterNumber"))
            require_v1(discipline == 0 and category == 4 and number in (7, 192), f"MCFT_CAP09_GFS_SFLUX_PARAMETER_DRIFT:F{lead:03d}")
            require_v1(
                str(codes_get(gid, "typeOfLevel")).lower() == "surface"
                and str(codes_get(gid, "stepType")).lower() == "instant",
                f"MCFT_CAP09_GFS_SFLUX_STEP_DRIFT:F{lead:03d}",
            )
            require_v1(
                int(codes_get(gid, "forecastTime")) == lead and int(codes_get(gid, "endStep")) == lead,
                f"MCFT_CAP09_GFS_SFLUX_LEAD_DRIFT:F{lead:03d}",
            )
            data_dt = dt_keys_v1(codes_get(gid, "dataDate"), codes_get(gid, "dataTime"))
            valid_dt = dt_keys_v1(codes_get(gid, "validityDate"), codes_get(gid, "validityTime"))
            require_v1(data_dt == cycle and valid_dt == cycle + timedelta(hours=lead), f"MCFT_CAP09_GFS_SFLUX_TIME_DRIFT:F{lead:03d}")
            nearest = codes_grib_find_nearest(gid, authority.station_latitude, authority.station_longitude)[0]
            require_v1(int(nearest.index) == authority.solar_native_index, f"MCFT_CAP09_GFS_SFLUX_NATIVE_INDEX_DRIFT:F{lead:03d}:{int(nearest.index)}")
            require_v1(abs(float(nearest.lat) - authority.solar_native_latitude) < 1e-8, f"MCFT_CAP09_GFS_SFLUX_NATIVE_LAT_DRIFT:F{lead:03d}")
            signed = ((float(nearest.lon) % 360) + 540) % 360 - 180
            require_v1(abs(signed - authority.solar_native_longitude_signed) < 1e-8, f"MCFT_CAP09_GFS_SFLUX_NATIVE_LON_DRIFT:F{lead:03d}")
            value = float(nearest.value)
            require_v1(math.isfinite(value) and value >= 0, f"MCFT_CAP09_GFS_SFLUX_VALUE_INVALID:F{lead:03d}")
            require_v1(
                str(codes_get(gid, "gridType")) == "regular_gg"
                and int(codes_get(gid, "N")) == 768
                and int(codes_get(gid, "numberOfDataPoints")) == 4718592,
                f"MCFT_CAP09_GFS_SFLUX_GRID_DEFINITION_DRIFT:F{lead:03d}",
            )
            return {
                "value": value,
                "param_number": number,
                "param_id": int(codes_get(gid, "paramId")),
                "short_name": str(codes_get(gid, "shortName")),
                "native_index": int(nearest.index),
            }
        finally:
            codes_release(gid)


def compute_asce_short_hourly_et0_v1(
    *,
    air_temperature_c: float,
    actual_vapor_pressure_kpa: float,
    solar_radiation_mj_m2_h: float,
    wind_speed_2m: float,
    interval_end: datetime,
    authority: GfsScientificAuthorityV1,
) -> float:
    require_v1(interval_end.tzinfo is not None, "MCFT_CAP09_GFS_ET0_INTERVAL_END_TZ_REQUIRED")
    normalized_end = interval_end.astimezone(timezone.utc)
    start = normalized_end - timedelta(hours=1)
    hourly = refet.Hourly(
        tmean=air_temperature_c,
        ea=actual_vapor_pressure_kpa,
        rs=solar_radiation_mj_m2_h,
        uz=wind_speed_2m,
        zw=2,
        elev=authority.station_elevation_m,
        lat=authority.station_latitude,
        lon=authority.station_longitude,
        doy=start.timetuple().tm_yday,
        time=start.hour,
        method="asce",
    )
    raw = hourly.eto()
    values = np.asarray(raw, dtype=float).reshape(-1)
    require_v1(values.size == 1 and math.isfinite(float(values[0])), "MCFT_CAP09_GFS_REFET_NONFINITE")
    return float(values[0])


def candidate_cycles_v1(tick: datetime) -> list[datetime]:
    require_v1(tick.tzinfo is not None, "MCFT_CAP09_GFS_TICK_TZ_REQUIRED")
    tick = tick.astimezone(timezone.utc)
    return [tick - timedelta(hours=back) for back in range(49) if (tick - timedelta(hours=back)).hour in (0, 6, 12, 18)]


def pgrb2_names_v1(cycle: datetime, lead: int) -> tuple[str, str]:
    stem = f"gfs.t{cycle:%H}z.pgrb2.0p25.f{lead:03d}"
    return stem, stem + ".idx"


def sflux_names_v1(cycle: datetime, lead: int) -> tuple[str, str]:
    stem = f"gfs.t{cycle:%H}z.sfluxgrbf{lead:03d}.grib2"
    return stem, stem + ".idx"


def lead_window_v1(tick: datetime, cycle: datetime, authority: GfsScientificAuthorityV1) -> dict | None:
    tick = tick.astimezone(timezone.utc)
    cycle = cycle.astimezone(timezone.utc)
    lead_start = int((tick - cycle).total_seconds() // 3600) + 1
    lead_end = lead_start + authority.point_count - 1
    support = lead_start - 1
    if support < 0 or lead_end > authority.max_lead:
        return None
    return {"lead_start": lead_start, "lead_end": lead_end, "support": support}


def validate_complete_cycle_inventory_v1(
    *,
    entries: dict[str, list[dict]],
    tick: datetime,
    cycle: datetime,
    authority: GfsScientificAuthorityV1,
    code_prefix: str = "MCFT_CAP09_GFS",
) -> dict:
    window = lead_window_v1(tick, cycle, authority)
    require_v1(window is not None, f"{code_prefix}_LEAD_WINDOW_UNAVAILABLE")
    assert window is not None
    for lead in range(window["support"], window["lead_end"] + 1):
        for name in pgrb2_names_v1(cycle, lead):
            match = entries.get(name, [])
            require_v1(len(match) == 1 and match[0]["size"] > 0, f"{code_prefix}_PGRB2_DIRECTORY_ENTRY_MISSING:{name}")
            require_v1(match[0]["upper"] <= tick, f"{code_prefix}_PGRB2_DIRECTORY_ENTRY_AFTER_TARGET:{name}")
    for lead in range(window["support"], window["lead_end"] + 1):
        for name in sflux_names_v1(cycle, lead):
            match = entries.get(name, [])
            require_v1(len(match) == 1 and match[0]["size"] > 0, f"{code_prefix}_SFLUX_DIRECTORY_ENTRY_MISSING:{name}")
            require_v1(match[0]["upper"] <= tick, f"{code_prefix}_SFLUX_DIRECTORY_ENTRY_AFTER_TARGET:{name}")
    return window


def assemble_72h_scientific_series_v1(
    *,
    by_lead: dict[int, list[dict]],
    sflux: dict[int, dict],
    cycle: datetime,
    target: datetime,
    authority: GfsScientificAuthorityV1,
    normalize_et0_decimals: int | None = None,
) -> dict:
    require_v1(cycle.tzinfo is not None and target.tzinfo is not None, "MCFT_CAP09_GFS_SERIES_TZ_REQUIRED")
    cycle = cycle.astimezone(timezone.utc)
    target = target.astimezone(timezone.utc)
    window = lead_window_v1(target, cycle, authority)
    require_v1(window is not None, "MCFT_CAP09_GFS_SERIES_LEAD_WINDOW_UNAVAILABLE")
    assert window is not None
    support = window["support"]
    lead_start = window["lead_start"]
    lead_end = window["lead_end"]
    leads = list(range(support, lead_end + 1))
    targets = list(range(lead_start, lead_end + 1))
    require_v1(len(targets) == authority.point_count and len(leads) == authority.point_count + 1, "MCFT_CAP09_GFS_LEAD_CARDINALITY")
    require_v1(all(lead in by_lead for lead in leads), "MCFT_CAP09_GFS_PGRB2_LEAD_SET_INCOMPLETE")
    require_v1(all(lead in sflux for lead in leads), "MCFT_CAP09_GFS_SFLUX_LEAD_SET_INCOMPLETE")

    weather = {"temperature_c": [], "rh_percent": [], "wind_2m": [], "precip_mm": []}
    duplicate_collapses = 0
    for lead in targets:
        temp = instant_v1(by_lead[lead], "T2", lead)
        rh = instant_v1(by_lead[lead], "RH2", lead)
        u = instant_v1(by_lead[lead], "U10", lead)
        v = instant_v1(by_lead[lead], "V10", lead)
        precip, collapsed = apcp_v1(by_lead[lead], lead)
        duplicate_collapses += collapsed
        require_v1(
            180 <= temp["value"] <= 330
            and 0 <= rh["value"] <= 100
            and abs(u["value"]) <= 100
            and abs(v["value"]) <= 100,
            "MCFT_CAP09_GFS_RAW_SANITY",
        )
        length = lead - block_start_v1(lead)
        if length == 1:
            hourly_precip = precip["value"]
        else:
            previous, _ = apcp_v1(by_lead[lead - 1], lead - 1)
            require_v1(previous["start_step"] == precip["start_step"], f"MCFT_CAP09_GFS_APCP_CROSS_BLOCK:{lead}")
            hourly_precip = precip["value"] - previous["value"]
        require_v1(math.isfinite(hourly_precip) and 0 <= hourly_precip <= 200, f"MCFT_CAP09_GFS_APCP_HOURLY_INVALID:{lead}")
        valid = cycle + timedelta(hours=lead)
        weather["temperature_c"].append((valid, temp["value"] - 273.15))
        weather["rh_percent"].append((valid, rh["value"]))
        weather["wind_2m"].append((valid, math.hypot(u["value"], v["value"]) * authority.wind_10m_to_2m_factor))
        weather["precip_mm"].append((valid, hourly_precip))

    expected = [target + timedelta(hours=index) for index in range(1, authority.point_count + 1)]
    for name, points in weather.items():
        require_v1(len(points) == authority.point_count and [time for time, _ in points] == expected, f"MCFT_CAP09_GFS_SERIES_ALIGNMENT:{name}")

    solar = []
    for lead in targets:
        value = (
            (float(sflux[lead - 1]["value"]) + float(sflux[lead]["value"]))
            / 2
            * authority.solar_w_m2_to_mj_m2_h_factor
        )
        require_v1(math.isfinite(value) and value >= 0, f"MCFT_CAP09_GFS_SOLAR_INTERVAL_INVALID:{lead}")
        solar.append((cycle + timedelta(hours=lead), value))
    require_v1([time for time, _ in solar] == expected, "MCFT_CAP09_GFS_SOLAR_ALIGNMENT")

    temp_map = dict(weather["temperature_c"])
    rh_map = dict(weather["rh_percent"])
    wind_map = dict(weather["wind_2m"])
    solar_map = dict(solar)
    future_et0 = []
    for valid in expected:
        temperature = temp_map[valid]
        rh = rh_map[valid]
        actual_vapor_pressure = (rh / 100.0) * 0.6108 * math.exp(17.27 * temperature / (temperature + 237.3))
        et0 = compute_asce_short_hourly_et0_v1(
            air_temperature_c=temperature,
            actual_vapor_pressure_kpa=actual_vapor_pressure,
            solar_radiation_mj_m2_h=solar_map[valid],
            wind_speed_2m=wind_map[valid],
            interval_end=valid,
            authority=authority,
        )
        require_v1(math.isfinite(et0), "MCFT_CAP09_GFS_ET0_NONFINITE")
        if normalize_et0_decimals is not None:
            et0 = canonical_decimal_half_away_from_zero_v1(et0, normalize_et0_decimals)
        future_et0.append((valid, et0))

    return {
        "lead_start": lead_start,
        "lead_end": lead_end,
        "support_lead": support,
        "expected": expected,
        "weather": weather,
        "solar": solar,
        "future_et0": future_et0,
        "apcp_semantic_duplicate_collapse_count": duplicate_collapses,
    }


def selftest_v1() -> None:
    authority = GfsScientificAuthorityV1(
        point_count=72,
        max_lead=120,
        pgrb2_grid_latitude=42.5,
        pgrb2_grid_longitude_native=274.75,
        wind_10m_to_2m_factor=0.747951075,
        station_elevation_m=286.43,
        station_latitude=42.408537,
        station_longitude=-85.373637,
        solar_native_index=1246503,
        solar_native_latitude=42.46664219574727,
        solar_native_longitude_signed=-85.42968711854513,
    )
    target = datetime(2026, 8, 27, 12, 0, tzinfo=timezone.utc)
    cycle = datetime(2026, 8, 27, 6, 0, tzinfo=timezone.utc)
    window = lead_window_v1(target, cycle, authority)
    require_v1(window == {"lead_start": 7, "lead_end": 78, "support": 6}, "MCFT_CAP09_GFS_SELFTEST_WINDOW")

    entry = {"upper": target - timedelta(minutes=1), "size": 1024}
    inventory: dict[str, list[dict]] = {}
    for lead in range(6, 79):
        for name in (*pgrb2_names_v1(cycle, lead), *sflux_names_v1(cycle, lead)):
            inventory[name] = [entry]
    require_v1(validate_complete_cycle_inventory_v1(entries=inventory, tick=target, cycle=cycle, authority=authority) == window, "MCFT_CAP09_GFS_SELFTEST_INVENTORY")
    broken = dict(inventory)
    broken.pop(sflux_names_v1(cycle, 6)[0])
    try:
        validate_complete_cycle_inventory_v1(entries=broken, tick=target, cycle=cycle, authority=authority)
        raise RuntimeError("MCFT_CAP09_GFS_SELFTEST_MISSING_SFLUX_NOT_REJECTED")
    except RuntimeError as exc:
        require_v1("SFLUX_DIRECTORY_ENTRY_MISSING" in str(exc), "MCFT_CAP09_GFS_SELFTEST_MISSING_SFLUX_CODE")

    by_lead: dict[int, list[dict]] = {}
    sflux: dict[int, dict] = {}
    for lead in range(6, 79):
        start = block_start_v1(lead)
        cumulative = (lead - start) * 0.1
        by_lead[lead] = [
            {"role": "T2", "step_type": "instant", "start_step": lead, "end_step": lead, "units": "K", "value": 293.15, "section4": "sha256:t2"},
            {"role": "RH2", "step_type": "instant", "start_step": lead, "end_step": lead, "units": "%", "value": 50.0, "section4": "sha256:rh"},
            {"role": "U10", "step_type": "instant", "start_step": lead, "end_step": lead, "units": "m s-1", "value": 2.0, "section4": "sha256:u"},
            {"role": "V10", "step_type": "instant", "start_step": lead, "end_step": lead, "units": "m s-1", "value": 0.0, "section4": "sha256:v"},
            {"role": "APCP", "step_type": "accum", "start_step": start, "end_step": lead, "units": "kg m-2", "value": cumulative, "section4": f"sha256:apcp-{lead}"},
        ]
        sflux[lead] = {"value": 100.0, "param_number": 7, "param_id": 260087, "short_name": "dswrf", "native_index": authority.solar_native_index}
    by_lead[7].append(dict(by_lead[7][-1]))
    result = assemble_72h_scientific_series_v1(
        by_lead=by_lead,
        sflux=sflux,
        cycle=cycle,
        target=target,
        authority=authority,
        normalize_et0_decimals=12,
    )
    require_v1(len(result["weather"]["precip_mm"]) == 72, "MCFT_CAP09_GFS_SELFTEST_WEATHER_COUNT")
    require_v1(len(result["solar"]) == 72 and all(abs(value - 0.36) < 1e-12 for _, value in result["solar"]), "MCFT_CAP09_GFS_SELFTEST_SOLAR")
    require_v1(len(result["future_et0"]) == 72 and all(math.isfinite(value) for _, value in result["future_et0"]), "MCFT_CAP09_GFS_SELFTEST_ET0")
    require_v1(result["apcp_semantic_duplicate_collapse_count"] == 1, "MCFT_CAP09_GFS_SELFTEST_DUPLICATE_COLLAPSE")
    require_v1(canonical_decimal_half_away_from_zero_v1(0.1234567890125, 12) == 0.123456789013, "MCFT_CAP09_GFS_SELFTEST_DECIMAL")

    print(
        json.dumps(
            {
                "schema_version": "geox_mcft_cap09_gfs_scientific_core_selftest_v1",
                "status": "PASS",
                "weather_points": 72,
                "solar_intervals": 72,
                "future_et0_points": 72,
                "apcp_semantic_duplicate_collapse_count": result["apcp_semantic_duplicate_collapse_count"],
                "provider_request_count": 0,
                "database_write_count": 0,
                "runtime_tick_cursor_mutation": False,
                "twin_state_mutation": False,
            },
            sort_keys=True,
        )
    )


def main() -> None:
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("selftest")
    args = parser.parse_args()
    if args.command == "selftest":
        selftest_v1()
        return
    raise RuntimeError("MCFT_CAP09_GFS_COMMAND_UNSUPPORTED")


if __name__ == "__main__":
    main()
