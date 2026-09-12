#!/usr/bin/env python3
from __future__ import annotations

import argparse
import importlib.util
import json
import math
import sys
import tarfile
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path.cwd()
CORE_PATH = ROOT / "apps/server/src/external_evidence/provider/python/mcft_cap09_gfs_scientific_core_v1.py"
SPEC = importlib.util.spec_from_file_location("mcft_cap09_gfs_scientific_core_v1", CORE_PATH)
if SPEC is None or SPEC.loader is None:
    raise RuntimeError("MCFT_CAP09_GFS_PRODUCT_CORE_LOAD_FAILED")
core = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = core
SPEC.loader.exec_module(core)

DECODER_ID = "MCFT_CAP09_GFS_RAW_BUNDLE_PRODUCT_DECODER_V1"
DECODER_VERSION = "1"
SOURCE_MATRIX_REF = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S6-FORMAL-SOURCE-BINDING-MATRIX-V1.json"
AMENDMENT04_REF = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-04-GFS-SFLUX-INSTANTANEOUS-PIECEWISE-LINEAR-SOLAR-AUTHORITY.md"
GFS_WEATHER_BINDING = "noaa_ncep_gfs_pgrb2_kbs_nearest_72h_v1"
GFS_ET0_BINDING = "noaa_ncep_gfs_asce_short_reference_et_same_cycle_72h_v1"
ET0_CANONICAL_DECIMALS = 12
ET0_DECIMAL_NORMALIZATION_ID = "DECIMAL_HALF_AWAY_FROM_ZERO_12_V1"

AUTHORITY = core.GfsScientificAuthorityV1(
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


def require(condition: bool, code: str) -> None:
    if not condition:
        raise RuntimeError(code)


def parse_iso(value: str, code: str) -> datetime:
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except (TypeError, ValueError) as exc:
        raise RuntimeError(code) from exc
    require(parsed.tzinfo is not None, code)
    return parsed.astimezone(timezone.utc)


def canonical_hour(value: str, code: str) -> datetime:
    parsed = parse_iso(value, code)
    require(parsed.minute == 0 and parsed.second == 0 and parsed.microsecond == 0, code)
    return parsed


def iso(value: datetime) -> str:
    return value.astimezone(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def load_tar_v1(path: Path) -> tuple[dict, dict[str, bytes]]:
    members: dict[str, bytes] = {}
    with tarfile.open(path, "r") as tar:
        for member in tar.getmembers():
            if not member.isfile():
                continue
            extracted = tar.extractfile(member)
            require(extracted is not None, f"MCFT_CAP09_GFS_BUNDLE_MEMBER_READ:{member.name}")
            members[member.name] = extracted.read()
    require("manifest.json" in members, "MCFT_CAP09_GFS_BUNDLE_MANIFEST_REQUIRED")
    manifest = json.loads(members.pop("manifest.json").decode("utf-8"))
    require(isinstance(manifest, dict), "MCFT_CAP09_GFS_BUNDLE_MANIFEST_OBJECT_REQUIRED")
    return manifest, members


def build_drafts_v1(
    *,
    scientific: dict,
    manifest: dict,
    target: datetime,
    cycle: datetime,
    available_at: datetime,
    decoded_at: datetime,
    normalize_et0: bool,
) -> list[dict]:
    support = int(manifest["support_lead"])
    lead_start = int(manifest["lead_start"])
    lead_end = int(manifest["lead_end"])
    require(scientific["support_lead"] == support, "MCFT_CAP09_GFS_PRODUCT_SUPPORT_LEAD_MISMATCH")
    require(scientific["lead_start"] == lead_start, "MCFT_CAP09_GFS_PRODUCT_LEAD_START_MISMATCH")
    require(scientific["lead_end"] == lead_end, "MCFT_CAP09_GFS_PRODUCT_LEAD_END_MISMATCH")
    require(available_at <= decoded_at, "MCFT_CAP09_GFS_DECODE_BEFORE_AVAILABLE")

    weather = scientific["weather"]
    future_et0 = scientific["future_et0"]
    expected = scientific["expected"]
    duplicate_collapses = scientific["apcp_semantic_duplicate_collapse_count"]
    require(len(expected) == 72 and len(future_et0) == 72, "MCFT_CAP09_GFS_PRODUCT_POINT_CARDINALITY")

    weather_points: list[dict] = []
    et0_points: list[dict] = []
    for index, valid in enumerate(expected):
        start = valid - timedelta(hours=1)
        weather_points.append({
            "horizon": index + 1,
            "valid_from": iso(start),
            "valid_to": iso(valid),
            "precipitation_mm": weather["precip_mm"][index][1],
            "air_temperature_c": weather["temperature_c"][index][1],
            "relative_humidity_percent": weather["rh_percent"][index][1],
            "wind_speed_2m_m_s": weather["wind_2m"][index][1],
        })
        et0_points.append({
            "horizon": index + 1,
            "valid_from": iso(start),
            "valid_to": iso(valid),
            "et0_mm_per_hour": future_et0[index][1],
        })

    issued_at = iso(cycle)
    valid_to = iso(target + timedelta(hours=72))
    common_source_payload = {
        "provider": "NOAA_NCEP_NOMADS",
        "model": "GFS",
        "selected_cycle": issued_at,
        "target_logical_time": iso(target),
        "lead_start": lead_start,
        "lead_end": lead_end,
        "support_lead": support,
        "raw_provider_object_count": int(manifest["member_count"]),
        "raw_member_chain_sha256": manifest["member_chain_sha256"],
        "pgrb2_grid_latitude": AUTHORITY.pgrb2_grid_latitude,
        "pgrb2_grid_longitude_native": AUTHORITY.pgrb2_grid_longitude_native,
        "sflux_native_index": AUTHORITY.solar_native_index,
        "product_scientific_core": "apps/server/src/external_evidence/provider/python/mcft_cap09_gfs_scientific_core_v1.py",
        "product_bundle_decoder": "apps/server/src/external_evidence/provider/python/mcft_cap09_gfs_raw_bundle_decoder_v1.py",
    }
    time_key = target.strftime("%Y%m%dT%H%M%SZ").lower()
    cycle_key = cycle.strftime("%Y%m%dT%H%M%SZ").lower()
    et0_quality = {
        "status": "LIMITED",
        "point_count": 72,
        "solar_temporal_method": "PIECEWISE_LINEAR_ENDPOINT_INTEGRATION_V1",
    }
    et0_limitations = [
        "MODEL_DERIVED_FORECAST_ASSUMPTION",
        "SFLUX_SOLAR_PIECEWISE_LINEAR_LIMITED",
    ]
    if normalize_et0:
        et0_quality.update({
            "et0_decimal_normalization_id": ET0_DECIMAL_NORMALIZATION_ID,
            "et0_decimal_places": ET0_CANONICAL_DECIMALS,
        })
        et0_limitations.append("CANONICAL_ET0_DECIMAL_HALF_AWAY_FROM_ZERO_12")

    return [
        {
            "role": "FUTURE_WEATHER_ASSUMPTION",
            "source_record_id": f"gfs_future_weather_{cycle_key}_{time_key}",
            "binding_id": GFS_WEATHER_BINDING,
            "origin_source_kind": "NOAA_NCEP_NOMADS_GFS",
            "origin_source_id": f"gfs_{cycle_key}_pgrb2_0p25_kbs",
            "epistemic_class": "ASSUMED",
            "available_to_runtime_at": iso(available_at),
            "role_time": {
                "issued_at": issued_at,
                "retrieved_at": iso(available_at),
                "available_to_runtime_at": iso(available_at),
                "ingested_at": iso(decoded_at),
                "valid_from": iso(target),
                "valid_to": valid_to,
            },
            "quality": {
                "status": "PASS",
                "point_count": 72,
                "apcp_semantic_duplicate_collapse_count": duplicate_collapses,
            },
            "source_payload": common_source_payload,
            "canonical_payload": {
                "snapshot_kind": "FUTURE_WEATHER_ASSUMPTION",
                "points": weather_points,
            },
            "source_unit": "GFS_NATIVE_MIXED",
            "canonical_unit": "mm_and_meteorological_support",
            "conversion_rule": {
                "conversion_rule_id": "GFS_PGRB2_72H_KBS_NEAREST_AND_APCP_BLOCK_DIFFERENCE_V1",
                "conversion_rule_version": "1",
                "authority_ref": SOURCE_MATRIX_REF,
            },
            "source_binding_version": 1,
            "limitations": [
                "NEAR_SITE_MODEL_GRID_POINT_SUPPORT",
                "DIRECT_FIELD_EQUIVALENCE_FALSE",
            ],
        },
        {
            "role": "FUTURE_ET0_ASSUMPTION",
            "source_record_id": f"gfs_future_et0_{cycle_key}_{time_key}",
            "binding_id": GFS_ET0_BINDING,
            "origin_source_kind": "NOAA_NCEP_NOMADS_GFS_DERIVED",
            "origin_source_id": f"gfs_{cycle_key}_asce_short_reference_et0_kbs",
            "epistemic_class": "ASSUMED",
            "available_to_runtime_at": iso(available_at),
            "role_time": {
                "issued_at": issued_at,
                "retrieved_at": iso(available_at),
                "available_to_runtime_at": iso(available_at),
                "ingested_at": iso(decoded_at),
                "valid_from": iso(target),
                "valid_to": valid_to,
            },
            "quality": et0_quality,
            "source_payload": {
                **common_source_payload,
                "algorithm_id": "ASCE_STANDARDIZED_REFERENCE_ET_SHORT_HOURLY_V1",
                "qualification_oracle": "refet-0.4.2-asce",
            },
            "canonical_payload": {
                "snapshot_kind": "FUTURE_ET0_ASSUMPTION",
                "points": et0_points,
            },
            "source_unit": "GFS_METEOROLOGICAL_INPUTS",
            "canonical_unit": "mm_per_hour",
            "conversion_rule": {
                "conversion_rule_id": "ASCE_SHORT_REFERENCE_ET0_GFS_SAME_CYCLE_WITH_SFLUX_PWL_SOLAR_V1",
                "conversion_rule_version": "1",
                "authority_ref": AMENDMENT04_REF,
            },
            "source_binding_version": 1,
            "limitations": et0_limitations,
        },
    ]


def decode_bundle_v1(
    *,
    target_text: str,
    available_at_text: str,
    input_path: Path,
    normalize_et0: bool,
    decoded_at: datetime | None = None,
) -> list[dict]:
    target = canonical_hour(target_text, "MCFT_CAP09_GFS_DECODE_TARGET_INVALID")
    available_at = parse_iso(available_at_text, "MCFT_CAP09_GFS_AVAILABLE_AT_INVALID")
    manifest, members = load_tar_v1(input_path)
    require(manifest.get("target_logical_time") == iso(target).replace(".000Z", "Z"), "MCFT_CAP09_GFS_BUNDLE_TARGET_MISMATCH")
    cycle = parse_iso(str(manifest["selected_cycle"]), "MCFT_CAP09_GFS_CYCLE_INVALID")
    support = int(manifest["support_lead"])
    lead_start = int(manifest["lead_start"])
    lead_end = int(manifest["lead_end"])
    leads = list(range(support, lead_end + 1))
    targets = list(range(lead_start, lead_end + 1))
    require(len(targets) == 72 and len(leads) == 73, "MCFT_CAP09_GFS_LEAD_CARDINALITY")

    by_lead: dict[int, list[dict]] = {}
    sflux: dict[int, dict] = {}
    for lead in leads:
        key = f"pgrb2/f{lead:03d}.grib2"
        require(key in members, f"MCFT_CAP09_GFS_PGRB2_MEMBER_REQUIRED:{key}")
        by_lead[lead] = core.decode_pgrb2_v1(members[key], cycle, lead, AUTHORITY)
    for lead in leads:
        key = f"sflux/f{lead:03d}.grib2"
        require(key in members, f"MCFT_CAP09_GFS_SFLUX_MEMBER_REQUIRED:{key}")
        sflux[lead] = core.decode_sflux_v1(members[key], cycle, lead, AUTHORITY)

    scientific = core.assemble_72h_scientific_series_v1(
        by_lead=by_lead,
        sflux=sflux,
        cycle=cycle,
        target=target,
        authority=AUTHORITY,
        normalize_et0_decimals=ET0_CANONICAL_DECIMALS if normalize_et0 else None,
    )
    return build_drafts_v1(
        scientific=scientific,
        manifest=manifest,
        target=target,
        cycle=cycle,
        available_at=available_at,
        decoded_at=decoded_at or datetime.now(timezone.utc),
        normalize_et0=normalize_et0,
    )


def selftest_v1() -> None:
    target = datetime(2026, 8, 27, 12, 0, tzinfo=timezone.utc)
    cycle = datetime(2026, 8, 27, 6, 0, tzinfo=timezone.utc)
    expected = [target + timedelta(hours=i) for i in range(1, 73)]
    scientific = {
        "support_lead": 6,
        "lead_start": 7,
        "lead_end": 78,
        "expected": expected,
        "weather": {
            "precip_mm": [(t, 0.1) for t in expected],
            "temperature_c": [(t, 20.0) for t in expected],
            "rh_percent": [(t, 50.0) for t in expected],
            "wind_2m": [(t, 2.0) for t in expected],
        },
        "solar": [(t, 0.36) for t in expected],
        "future_et0": [(t, core.canonical_decimal_half_away_from_zero_v1(0.1234567890125, 12)) for t in expected],
        "apcp_semantic_duplicate_collapse_count": 1,
    }
    manifest = {
        "support_lead": 6,
        "lead_start": 7,
        "lead_end": 78,
        "member_count": 220,
        "member_chain_sha256": "sha256:" + "a" * 64,
    }
    drafts = build_drafts_v1(
        scientific=scientific,
        manifest=manifest,
        target=target,
        cycle=cycle,
        available_at=datetime(2026, 8, 27, 11, 50, tzinfo=timezone.utc),
        decoded_at=datetime(2026, 8, 27, 11, 51, tzinfo=timezone.utc),
        normalize_et0=True,
    )
    require(len(drafts) == 2, "MCFT_CAP09_GFS_SELFTEST_DRAFT_COUNT")
    require(drafts[0]["role"] == "FUTURE_WEATHER_ASSUMPTION", "MCFT_CAP09_GFS_SELFTEST_WEATHER_ROLE")
    require(drafts[1]["role"] == "FUTURE_ET0_ASSUMPTION", "MCFT_CAP09_GFS_SELFTEST_ET0_ROLE")
    require(len(drafts[0]["canonical_payload"]["points"]) == 72, "MCFT_CAP09_GFS_SELFTEST_WEATHER_POINTS")
    require(len(drafts[1]["canonical_payload"]["points"]) == 72, "MCFT_CAP09_GFS_SELFTEST_ET0_POINTS")
    require(drafts[1]["quality"]["et0_decimal_places"] == 12, "MCFT_CAP09_GFS_SELFTEST_DECIMAL_POLICY")
    require(math.isfinite(drafts[1]["canonical_payload"]["points"][0]["et0_mm_per_hour"]), "MCFT_CAP09_GFS_SELFTEST_ET0_FINITE")
    print(json.dumps({
        "schema_version": "geox_mcft_cap09_gfs_raw_bundle_product_decoder_selftest_v1",
        "status": "PASS",
        "decoder_id": DECODER_ID,
        "draft_count": 2,
        "weather_point_count": 72,
        "et0_point_count": 72,
        "product_scientific_core_used": True,
        "runtime_tick_cursor_mutation": False,
        "twin_state_mutation": False,
    }, sort_keys=True))


def main() -> None:
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("selftest")
    decode = sub.add_parser("decode-bundle")
    decode.add_argument("--target", required=True)
    decode.add_argument("--available-at", required=True)
    decode.add_argument("--input", required=True)
    decode.add_argument("--output", required=True)
    decode.add_argument("--normalize-et0", action="store_true")
    args = parser.parse_args()
    if args.command == "selftest":
        selftest_v1()
        return
    if args.command == "decode-bundle":
        drafts = decode_bundle_v1(
            target_text=args.target,
            available_at_text=args.available_at,
            input_path=Path(args.input),
            normalize_et0=bool(args.normalize_et0),
        )
        Path(args.output).write_text(json.dumps({"drafts": drafts}, separators=(",", ":")) + "\n", encoding="utf-8")
        print(json.dumps({
            "status": "PASS",
            "draft_count": len(drafts),
            "product_gfs_scientific_core_used": True,
            "product_gfs_raw_bundle_decoder_used": True,
        }, sort_keys=True))
        return
    raise RuntimeError("MCFT_CAP09_GFS_PRODUCT_DECODER_COMMAND_UNSUPPORTED")


if __name__ == "__main__":
    main()
