#!/usr/bin/env python3
from __future__ import annotations

import json
import os
import subprocess
from pathlib import Path

ROOT = Path.cwd()
AUTHORITY = ROOT / "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA1N-GFS-VALUE-EXTRACTION-AUTHORITY-V1.json"
OUTPUT = ROOT / "acceptance-output/MCFT_CAP_09_EA1N_GFS_VALUE_EXTRACTION_AUTHORITY_RESULT.json"
EXPECTED_STATUS = "EA1N_PGRB2_DSWRF_EXACT_HOURLY_SCALAR_REJECTED"
EXPECTED_EFFECT = "EA1N_FAIL_CLOSED_PGRB2_DSWRF_REJECTION_EA1O_REQUIRED"


def git(*args: str) -> str:
    return subprocess.check_output(["git", *args], cwd=ROOT, text=True).strip()


def require(condition: bool, message: str) -> None:
    if not condition:
        raise RuntimeError(message)


def main() -> None:
    subject_sha = os.environ.get("MCFT_SUBJECT_SHA", "").strip()
    require(bool(subject_sha), "MCFT_SUBJECT_SHA_REQUIRED")
    require(git("rev-parse", "HEAD") == subject_sha, "SUBJECT_SHA_NOT_CHECKED_OUT_HEAD")

    authority = json.loads(AUTHORITY.read_text(encoding="utf-8"))
    evidence = authority["dswrf_adjudication"]["exact_head_evidence"]
    evidence_sha = evidence["subject_sha"]
    ancestor = subprocess.run(
        ["git", "merge-base", "--is-ancestor", evidence_sha, subject_sha],
        cwd=ROOT,
        check=False,
    )
    require(ancestor.returncode == 0, "EVIDENCE_SUBJECT_NOT_ANCESTOR_OF_CURRENT_HEAD")

    require(authority["record_status"] == EXPECTED_STATUS, "ADJUDICATION_STATUS_DRIFT")
    require(authority["qualification_effect"] == EXPECTED_EFFECT, "QUALIFICATION_EFFECT_DRIFT")
    require(authority["gfs_72h_value_pipeline_qualified"] is False, "FALSE_QUALIFICATION_CLAIM")

    dswrf = authority["dswrf_adjudication"]
    require(dswrf["decision"] == "REJECTED_AS_EXACT_HOURLY_SCALAR_AUTHORITY", "DSWRF_REJECTION_DRIFT")
    require(dswrf["no_negative_clipping"] is True, "NEGATIVE_CLIPPING_POLICY_WEAKENED")
    require(dswrf["no_zero_thresholding"] is True, "ZERO_THRESHOLDING_ENABLED")
    require(dswrf["no_silent_imputation"] is True, "SILENT_IMPUTATION_ENABLED")

    require(evidence["workflow_run_id"] == 31257010218, "EVIDENCE_RUN_DRIFT")
    require(evidence["job_id"] == 93101818088, "EVIDENCE_JOB_DRIFT")
    require(evidence["failure_lead"] == 20, "EVIDENCE_FAILURE_LEAD_DRIFT")
    require(evidence["derived_sign"] == "NEGATIVE", "EVIDENCE_SIGN_DRIFT")
    require(evidence["negative_magnitude_within_propagated_quantization_error"] is True, "QUANTIZATION_BOUND_NOT_PROVEN")
    require(evidence["physical_zero_inside_quantization_interval"] is True, "ZERO_NOT_INSIDE_INTERVAL")

    same_grid = dswrf["same_grid_alternative"]
    require(same_grid["product"] == "pgrb2b.0p25", "SAME_GRID_ALTERNATIVE_DRIFT")
    require(same_grid["f020_dswrf_surface_count"] == 0, "PGRB2B_DSWRF_ABSENCE_DRIFT")
    require(same_grid["result"] == "NO_DSWRF_SURFACE_ALTERNATIVE", "PGRB2B_ADJUDICATION_DRIFT")

    next_candidate = authority["next_candidate"]
    require(next_candidate["stage"] == "EA1O", "NEXT_STAGE_DRIFT")
    require(next_candidate["source"] == "GFS_SFLUX_DIRECT_1H_DSWRF", "NEXT_SOURCE_DRIFT")
    require(next_candidate["provider_semantics"] == "SURFACE_DSWRF_0_TO_1_HOUR_AVERAGE", "SFLUX_SEMANTICS_DRIFT")
    require(next_candidate["spatial_authority_refreeze_required"] is True, "SILENT_SPATIAL_EQUIVALENCE_ENABLED")
    require(next_candidate["authority_created"] is False, "EA1O_AUTHORITY_PREMATURELY_CREATED")

    boundary = authority["data_boundary"]
    require(boundary["database_writes"] == 0, "DATABASE_WRITE_ENABLED")
    require(boundary["formal_evidence_writes"] == 0, "FORMAL_EVIDENCE_WRITE_ENABLED")
    require(boundary["canonical_evidence_writes"] == 0, "CANONICAL_EVIDENCE_WRITE_ENABLED")
    require(boundary["future_et0_executions"] == 0, "FUTURE_ET0_EXECUTION_ENABLED")
    require(boundary["runtime_source_delta"] == 0, "RUNTIME_SOURCE_DELTA_ENABLED")
    require(boundary["decoded_values_emitted"] is False, "DECODED_VALUES_EMITTED")
    require(boundary["normalized_values_emitted"] is False, "NORMALIZED_VALUES_EMITTED")
    require(authority["formal_window_started"] is False, "FORMAL_WINDOW_STARTED")
    require(authority["mcft_cap09_completed"] is False, "CAP09_COMPLETION_CLAIM_ENABLED")

    result = {
        "schema_version": "geox_mcft_cap09_ea1n_fail_close_result_v1",
        "status": "PASS",
        "subject_sha": subject_sha,
        "evidence_subject_sha": evidence_sha,
        "evidence_workflow_run_id": evidence["workflow_run_id"],
        "evidence_job_id": evidence["job_id"],
        "adjudication": dswrf["decision"],
        "reason": dswrf["reason"],
        "same_grid_alternative": same_grid["result"],
        "next_stage": next_candidate["stage"],
        "next_source": next_candidate["source"],
        "spatial_authority_refreeze_required": next_candidate["spatial_authority_refreeze_required"],
        "negative_clipping_performed": False,
        "zero_thresholding_performed": False,
        "database_write_count": 0,
        "formal_evidence_write_count": 0,
        "canonical_evidence_write_count": 0,
        "future_et0_execution_count": 0,
        "runtime_source_delta_count": 0,
        "decoded_forecast_values_emitted": False,
        "normalized_forecast_values_emitted": False,
        "gfs_72h_value_pipeline_qualified": False,
        "formal_window_started": False,
    }
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(result, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(json.dumps(result, sort_keys=True, separators=(",", ":")))


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        OUTPUT.parent.mkdir(parents=True, exist_ok=True)
        failure = {
            "schema_version": "geox_mcft_cap09_ea1n_fail_close_result_v1",
            "status": "FAIL",
            "error": f"{type(exc).__name__}:{exc}",
        }
        OUTPUT.write_text(json.dumps(failure, indent=2, sort_keys=True) + "\n", encoding="utf-8")
        raise
