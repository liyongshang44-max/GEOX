#!/usr/bin/env python3
from __future__ import annotations

import importlib.util
import json
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path.cwd()
DECODER_PATH = ROOT / "scripts/runtime_acceptance/MCFT_CAP_09_KBS_AUTHORITATIVE_LATE_DECODER_V1.py"
SPEC = importlib.util.spec_from_file_location("mcft_cap09_kbs_authoritative_late", DECODER_PATH)
if SPEC is None or SPEC.loader is None:
    raise RuntimeError("EA5E2_TIMING_AMENDMENT11_DECODER_LOAD_FAILED")
kbs = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(kbs)
KBS_URL = kbs.ea4.AUTH["kbs"]["raw_hourly_csv"]


def require(condition: bool, code: str) -> None:
    if not condition:
        raise RuntimeError(code)


def main() -> None:
    requested_at = datetime.now(timezone.utc)
    status, _, body, final = kbs.ea4.request_bytes(
        KBS_URL,
        "EA5E2_TIMING_AMENDMENT11_KBS_HOURLY",
        110_000_000,
        {"Accept": "text/csv,text/plain;q=0.9,*/*;q=0.5"},
    )
    require(status == 200, "EA5E2_TIMING_AMENDMENT11_KBS_HTTP")
    retrieved_at = datetime.now(timezone.utc)
    parsed_final = urlparse(final)
    require(parsed_final.hostname == "lter.kbs.msu.edu" and parsed_final.path == "/datatables/13.csv", "EA5E2_TIMING_AMENDMENT11_KBS_IDENTITY")
    latest, selected, _, skipped, selection_mode = kbs.select_complete_exact_row(kbs.ea4.parse_kbs_csv(body), retrieved_at)
    latest_age_hours = (retrieved_at - latest).total_seconds() / 3600.0
    proof = {
        "schema_version": "geox_mcft_cap09_ea5e2_timing_target_amendment11_v1",
        "status": "PASS",
        "temporal_authority": "PROVIDER_AVAILABILITY_WATERMARK_V1",
        "provider_publication_cadence": "DAILY_BATCH",
        "observation_resolution": "HOURLY",
        "requested_at": kbs.iso(requested_at),
        "retrieved_at": kbs.iso(retrieved_at),
        "latest_raw_hourly_timestamp": kbs.iso(latest),
        "latest_age_hours": round(latest_age_hours, 6),
        "historical_online_freshness_diagnostic_le_6h": latest_age_hours <= kbs.HISTORICAL_FRESHNESS_HOURS,
        "freshness_is_late_authoritative_admission_gate": False,
        "selected_target_t": kbs.iso(selected),
        "selected_target_lag_hours_from_latest": (latest - selected).total_seconds() / 3600.0,
        "skipped_newer_incomplete_or_duplicate_row_count": skipped,
        "selection_mode": selection_mode,
        "selection_scope": "QUALIFICATION_TIMING_ONLY_NOT_LIVE_TARGET_ADMISSION",
        "same_source_exact_t_decoder_still_required": True,
        "authority_effect": False,
        "raw_values_emitted": False,
    }
    print(json.dumps(proof, sort_keys=True))


if __name__ == "__main__":
    main()
