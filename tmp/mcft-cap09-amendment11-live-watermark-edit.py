#!/usr/bin/env python3
from pathlib import Path


def replace_exact(path: str, old: str, new: str, count: int = 1) -> None:
    p = Path(path)
    text = p.read_text(encoding="utf-8")
    actual = text.count(old)
    if actual != count:
        raise RuntimeError(f"REPLACE_COUNT:{path}:expected={count}:actual={actual}:needle={old[:100]!r}")
    p.write_text(text.replace(old, new), encoding="utf-8")

poller = "scripts/runtime_acceptance/POLL_MCFT_CAP_09_EA5E2_KBS_EXACT_T_AVAILABILITY.py"
live = ".github/workflows/mcft-cap-09-ea5e2-live-provider-two-phase-readiness.yml"
viability = "scripts/runtime_acceptance/PREFLIGHT_MCFT_CAP_09_EA5E2_LIVE_WINDOW_VIABILITY.cjs"
full_chain = "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_EA5E2_FULL_CHAIN_PREFLIGHT_V1.cjs"
successor = "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_EA5E2_SUCCESSOR_RUNNER_QUALIFICATION.cjs"
focused = Path("scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_AMENDMENT11_LIVE_WATERMARK.cjs")

# 1) Exact-T availability: retain 6h as a diagnostic only; exact authoritative row drives admission.
replace_exact(
    poller,
    '            latest_age_hours = (retrieved - latest).total_seconds() / 3600.0\n            exact_matches = [row for timestamp, row in timestamped if timestamp == target]\n',
    '            latest_age_hours = (retrieved - latest).total_seconds() / 3600.0\n            freshness_diagnostic_le_6h = latest_age_hours <= float(ea4.AUTH["kbs"]["raw_hourly_latest_max_age_hours"])\n            exact_matches = [row for timestamp, row in timestamped if timestamp == target]\n',
)
replace_exact(
    poller,
    '                "latest_age_hours": round(latest_age_hours, 6),\n                "exact_target_row_count": len(exact_matches),\n',
    '                "latest_age_hours": round(latest_age_hours, 6),\n                "historical_online_freshness_diagnostic_le_6h": freshness_diagnostic_le_6h,\n                "exact_target_row_count": len(exact_matches),\n',
)
replace_exact(
    poller,
    '            if len(exact_matches) == 1 and latest_age_hours <= float(ea4.AUTH["kbs"]["raw_hourly_latest_max_age_hours"]):\n',
    '            if len(exact_matches) == 1:\n',
)
replace_exact(
    poller,
    '                    "latest_age_hours": round(latest_age_hours, 6),\n                    "exact_target_row_count": 1,\n                    "same_source_exact_t_only": True,\n                    "late_semantic_availability_polling": True,\n',
    '                    "latest_age_hours": round(latest_age_hours, 6),\n                    "historical_online_freshness_diagnostic_le_6h": freshness_diagnostic_le_6h,\n                    "freshness_is_late_authoritative_admission_gate": False,\n                    "provider_publication_cadence": "DAILY_BATCH",\n                    "temporal_authority": "PROVIDER_AVAILABILITY_WATERMARK_V1",\n                    "exact_target_row_count": 1,\n                    "same_source_exact_t_only": True,\n                    "late_semantic_availability_polling": True,\n',
)

# 2) Live candidate proof: require the Amendment-11 watermark contract, not latest-age <= 6h.
replace_exact(
    live,
    "          if(availability.status!=='PASS'||availability.target_t!==process.env.TARGET_T||availability.same_source_exact_t_only!==true||Number(availability.latest_age_hours)>6) throw new Error('EA5E2_ACTIVATION_LATE_AVAILABILITY_AND_FRESHNESS_AUTHORITY_REQUIRED');\n",
    "          if(availability.status!=='PASS'||availability.target_t!==process.env.TARGET_T||availability.same_source_exact_t_only!==true||availability.temporal_authority!=='PROVIDER_AVAILABILITY_WATERMARK_V1'||availability.provider_publication_cadence!=='DAILY_BATCH'||availability.freshness_is_late_authoritative_admission_gate!==false) throw new Error('EA5E2_ACTIVATION_LATE_AVAILABILITY_WATERMARK_REQUIRED');\n",
)
replace_exact(
    live,
    "            kbs_max_age_hours:6,\n",
    "            kbs_historical_online_freshness_diagnostic_hours:6,\n            kbs_freshness_is_late_authoritative_admission_gate:false,\n            kbs_late_temporal_authority:'PROVIDER_AVAILABILITY_WATERMARK_V1',\n",
)

# 3) Viability preflight: remove the unused hard-freshness helper and make diagnostic semantics explicit.
old_helper = '''function runKbsFreshness() {
  const python = process.env.PYTHON || "python3";
  const stdout = execFileSync(python, [PROVIDER, "precheck-kbs"], { encoding: "utf8", timeout: 120_000 });
  const lines = stdout.trim().split(/\\r?\\n/).filter(Boolean);
  if (!lines.length) throw new Error("EA5E2_VIABILITY_KBS_PREFLIGHT_OUTPUT_REQUIRED");
  const result = JSON.parse(lines[lines.length - 1]);
  if (result.status !== "PASS" || finite(result.configured_max_age_hours, "EA5E2_VIABILITY_KBS_MAX_AGE_REQUIRED") !== 6) {
    throw new Error("EA5E2_VIABILITY_KBS_CURRENT_AUTHORITY_FAILED");
  }
  return result;
}

'''
replace_exact(viability, old_helper, "")
replace_exact(
    viability,
    '      authority_max_age_hours: 6,\n      current_authority_status: kbs.production_authority_pass ? "PASS" : "FAIL_NOT_USED_FOR_PHASE_AWARE_PREBOUNDARY_ADMISSION",\n',
    '      historical_online_freshness_diagnostic_max_age_hours: 6,\n      historical_online_freshness_diagnostic_status: kbs.production_authority_pass ? "LE_6H" : "GT_6H",\n      freshness_is_late_authoritative_admission_gate: false,\n',
)
replace_exact(
    viability,
    '      late_actual_retrieval_must_reprove_same_source_exact_t_and_freshness: true,\n',
    '      late_actual_retrieval_must_reprove_same_source_exact_t_quality_and_chronology: true,\n',
)
replace_exact(
    viability,
    '      kbs_operational_headroom_is_authority: false,\n      daily_batch_protocol_compatibility_used_as_safety_gate_only: true,\n',
    '      kbs_operational_headroom_is_authority: false,\n      kbs_freshness_is_late_authoritative_admission_gate: false,\n      daily_batch_protocol_compatibility_used_as_safety_gate_only: true,\n',
)
replace_exact(
    viability,
    '      kbs_raw_hourly_max_age_hours: 6,\n',
    '      kbs_historical_online_freshness_diagnostic_hours: 6,\n',
)

# 4) Static full-chain/successor wiring follows the renamed fail-closed watermark guard.
replace_exact(
    full_chain,
    '    && has(live, "EA5E2_ACTIVATION_LATE_AVAILABILITY_AND_FRESHNESS_AUTHORITY_REQUIRED")\n',
    '    && has(live, "EA5E2_ACTIVATION_LATE_AVAILABILITY_WATERMARK_REQUIRED")\n',
)
replace_exact(
    successor,
    '  has(live, "EA5E2_ACTIVATION_LATE_AVAILABILITY_AND_FRESHNESS_AUTHORITY_REQUIRED", "LIVE_LATE_ACTUAL_AUTHORITY_REPROOF_MISSING");\n',
    '  has(live, "EA5E2_ACTIVATION_LATE_AVAILABILITY_WATERMARK_REQUIRED", "LIVE_LATE_ACTUAL_AUTHORITY_REPROOF_MISSING");\n',
)

focused.write_text(r'''#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const assert = require("node:assert/strict");

const POLLER = "scripts/runtime_acceptance/POLL_MCFT_CAP_09_EA5E2_KBS_EXACT_T_AVAILABILITY.py";
const LIVE = ".github/workflows/mcft-cap-09-ea5e2-live-provider-two-phase-readiness.yml";
const VIABILITY = "scripts/runtime_acceptance/PREFLIGHT_MCFT_CAP_09_EA5E2_LIVE_WINDOW_VIABILITY.cjs";
const AMENDMENT = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-11-PROVIDER-AVAILABILITY-WATERMARK-AUTHORITY.md";

const read = (p) => fs.readFileSync(p, "utf8");
const poller = read(POLLER);
const live = read(LIVE);
const viability = read(VIABILITY);
const amendment = read(AMENDMENT);

assert(amendment.includes("Age alone MUST NOT invalidate an otherwise exact authoritative-late observation."), "AMENDMENT11_AGE_NOT_AUTHORITY_CLAUSE_REQUIRED");
assert(amendment.includes("PROVIDER_AVAILABILITY_WATERMARK_V1"), "AMENDMENT11_WATERMARK_REQUIRED");
assert(poller.includes("if len(exact_matches) == 1:"), "EXACT_T_ROW_MUST_DRIVE_LATE_ADMISSION");
assert(!poller.includes('if len(exact_matches) == 1 and latest_age_hours <='), "LATEST_AGE_HARD_GATE_FORBIDDEN");
assert(poller.includes('"freshness_is_late_authoritative_admission_gate": False'), "POLLER_DIAGNOSTIC_ONLY_FLAG_REQUIRED");
assert(poller.includes('"temporal_authority": "PROVIDER_AVAILABILITY_WATERMARK_V1"'), "POLLER_WATERMARK_REQUIRED");
assert(poller.includes('"provider_publication_cadence": "DAILY_BATCH"'), "POLLER_DAILY_BATCH_REQUIRED");
assert(!live.includes("Number(availability.latest_age_hours)>6"), "LIVE_LATEST_AGE_HARD_GATE_FORBIDDEN");
assert(live.includes("EA5E2_ACTIVATION_LATE_AVAILABILITY_WATERMARK_REQUIRED"), "LIVE_WATERMARK_FAIL_CLOSED_GUARD_REQUIRED");
assert(live.includes("availability.freshness_is_late_authoritative_admission_gate!==false"), "LIVE_DIAGNOSTIC_ONLY_ASSERTION_REQUIRED");
assert(live.includes("kbs_freshness_is_late_authoritative_admission_gate:false"), "LIVE_PROOF_DIAGNOSTIC_ONLY_FIELD_REQUIRED");
assert(!viability.includes("function runKbsFreshness()"), "VIABILITY_UNUSED_HARD_FRESHNESS_HELPER_FORBIDDEN");
assert(viability.includes("kbs_freshness_is_late_authoritative_admission_gate: false"), "VIABILITY_DIAGNOSTIC_ONLY_FIELD_REQUIRED");
assert(viability.includes("kbs_historical_online_freshness_diagnostic_hours: 6"), "VIABILITY_6H_DIAGNOSTIC_PRESERVATION_REQUIRED");

console.log(JSON.stringify({
  schema_version: "geox_mcft_cap09_amendment11_live_watermark_acceptance_v1",
  status: "PASS",
  six_hour_freshness_role: "HISTORICAL_ONLINE_DIAGNOSTIC_ONLY",
  delayed_evidence_authority: "PROVIDER_AVAILABILITY_WATERMARK_V1",
  formal_authority_effect: false,
}));
''', encoding="utf-8")

print("AMENDMENT11_LIVE_WATERMARK_EDIT_APPLIED")
