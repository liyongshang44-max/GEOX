#!/usr/bin/env node
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
