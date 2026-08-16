#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

const fail = (m) => { throw new Error(m); };
const eq = (a, e, c) => { if (a !== e) fail(`${c}: expected=${JSON.stringify(e)} actual=${JSON.stringify(a)}`); };
const yes = (v, c) => eq(v, true, c);
const no = (v, c) => eq(v, false, c);
const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();
const blob = (ref, p) => git("rev-parse", `${ref}:${p}`);
const json = (p) => JSON.parse(fs.readFileSync(p, "utf8"));

const base = process.env.MCFT_BASE_SHA;
eq(base, "b60345a4ff26fe5f99c054c154c77e5b39796902", "AM11_V3_SERVICE_EXACT_BASE_REQUIRED");

const servicePath = "apps/server/src/runtime/twin_runtime/external_formal_v3_amendment11_persistent_tick_service_v1.ts";
const acceptancePath = "scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_09_EXTERNAL_FORMAL_V3_AMENDMENT11_PERSISTENT_TICK.ts";
const authorityPath = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EXTERNAL-FORMAL-V3-AMENDMENT11-PERSISTENT-TICK-IMPLEMENTATION-QUALIFICATION-V1.json";
const gatePath = "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_EXTERNAL_FORMAL_V3_AMENDMENT11_PERSISTENT_TICK_QUALIFICATION.cjs";
const workflowPath = ".github/workflows/mcft-cap-09-external-formal-v3-amendment11-persistent-tick-qualification.yml";

const changed = git("diff", "--name-only", `${base}...HEAD`).split(/\r?\n/).filter(Boolean).sort();
eq(JSON.stringify(changed), JSON.stringify([servicePath, acceptancePath, authorityPath, gatePath, workflowPath].sort()), "AM11_V3_SERVICE_EXACT_FIVE_FILE_BOUNDARY_REQUIRED");

const frozen = {
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-11-PROVIDER-AVAILABILITY-WATERMARK-AUTHORITY.md": "a037b24757992987fc24ce8b6afac6c8eabca3ed",
  "apps/server/src/runtime/twin_runtime/external_formal_cap04_amendment11_candidate_execution_service_v1.ts": "faa544823f2d824aafe8bdac9e6be5a7bcbc8cc6",
  "apps/server/src/runtime/twin_runtime/postgres_external_formal_evidence_source_v1.ts": "1327e4c818db482ac3fc3e3ebc1061319d8d229f",
  "apps/server/src/runtime/twin_runtime/external_formal_v3_persistent_tick_service_v1.ts": "306f7b9bc895f732fca54eaab13cb285617b78d0",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-T3R1-SUCCESSOR-FORMAL-WINDOW-INPUT-MANIFEST-V2.json": "eda053531b2f9164466d41f19ada2a25fc3dd04a"
};
for (const [p, expected] of Object.entries(frozen)) {
  eq(blob(base, p), expected, `AM11_V3_SERVICE_BASE_PIN:${p}`);
  eq(blob("HEAD", p), expected, `AM11_V3_SERVICE_PREDECESSOR_MUTATED:${p}`);
}

const service = fs.readFileSync(servicePath, "utf8");
const acceptance = fs.readFileSync(acceptancePath, "utf8");

for (const forbidden of [
  "EXTERNAL_FORMAL_V3_SCHEDULER_ELIGIBILITY_OFFSET_MINUTES_V1",
  "EXTERNAL_FORMAL_V3_EXACT_INTERVAL_CUTOFF_OFFSET_MINUTES_V1",
  "EXTERNAL_FORMAL_V3_RUNTIME_OBSERVER_OFFSET_MINUTES_V1",
  "executeExternalFormalCap04CandidateV1",
]) {
  if (service.includes(forbidden)) fail(`AM11_V3_SERVICE_FIXED_LAG_REGRESSION:${forbidden}`);
}
for (const required of [
  "executeExternalFormalCap04Amendment11CandidateV1",
  "evidence_snapshot_time: string",
  "PROVIDER_AVAILABILITY_WATERMARK_V1",
  "fixed_lag_authority_used: false",
  "scheduler_claim_reused_as_runtime_lease: true",
  "second_runtime_write_lease_acquired: false",
]) {
  if (!service.includes(required)) fail(`AM11_V3_SERVICE_REQUIRED_SEMANTIC_MISSING:${required}`);
}
for (const required of [
  "addMinutesV1(EA5B5B_LOGICAL_TIME_V1, 490)",
  "addMinutesV1(EA5B5B_LOGICAL_TIME_V1, 491)",
  "addMinutesV1(EA5B5B_LOGICAL_TIME_V1, 500)",
  "legacy_420_432_437_authority_used: false",
  "EXTERNAL_FORMAL_V3_AM11_OBSERVER_BEFORE_EVIDENCE_SNAPSHOT",
  "RECOVERED_PENDING_SCENARIO",
]) {
  if (!acceptance.includes(required)) fail(`AM11_V3_SERVICE_ACCEPTANCE_COVERAGE_MISSING:${required}`);
}

const authority = json(authorityPath);
eq(authority.schema_version, "geox_mcft_cap09_external_formal_v3_amendment11_persistent_tick_implementation_qualification_v1", "AM11_V3_SERVICE_AUTHORITY_SCHEMA");
eq(authority.record_status, "IMPLEMENTATION_QUALIFICATION_CANDIDATE_NOT_EFFECTIVE", "AM11_V3_SERVICE_AUTHORITY_STATUS");
eq(authority.base_protected_main_sha, base, "AM11_V3_SERVICE_AUTHORITY_BASE");
eq(authority.authority_inputs.amendment_11_blob_sha, frozen["docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-11-PROVIDER-AVAILABILITY-WATERMARK-AUTHORITY.md"], "AM11_V3_SERVICE_AMENDMENT11_PIN");
eq(authority.authority_inputs.amendment_11_candidate_service_blob_sha, frozen["apps/server/src/runtime/twin_runtime/external_formal_cap04_amendment11_candidate_execution_service_v1.ts"], "AM11_V3_SERVICE_CANDIDATE_PIN");
eq(authority.authority_inputs.postgres_external_evidence_source_blob_sha, frozen["apps/server/src/runtime/twin_runtime/postgres_external_formal_evidence_source_v1.ts"], "AM11_V3_SERVICE_DB_EVIDENCE_PIN");
eq(authority.authority_inputs.historical_v3_service_blob_sha, frozen["apps/server/src/runtime/twin_runtime/external_formal_v3_persistent_tick_service_v1.ts"], "AM11_V3_SERVICE_HISTORICAL_PIN");
yes(authority.authority_inputs.historical_v3_service_remains_unmodified, "AM11_V3_SERVICE_HISTORICAL_UNMODIFIED");
eq(authority.candidate_implementation.service_blob_sha, blob("HEAD", servicePath), "AM11_V3_SERVICE_NEW_SERVICE_BLOB");
eq(authority.candidate_implementation.acceptance_blob_sha, blob("HEAD", acceptancePath), "AM11_V3_SERVICE_ACCEPTANCE_BLOB");
eq(authority.candidate_implementation.governance_gate_blob_sha, blob("HEAD", gatePath), "AM11_V3_SERVICE_GATE_BLOB");
eq(authority.candidate_implementation.workflow_blob_sha, blob("HEAD", workflowPath), "AM11_V3_SERVICE_WORKFLOW_BLOB");

eq(authority.required_semantics.provider_availability_watermark, "PROVIDER_AVAILABILITY_WATERMARK_V1", "AM11_V3_SERVICE_WATERMARK");
yes(authority.required_semantics.evidence_snapshot_time_is_caller_supplied_actual_snapshot, "AM11_V3_SERVICE_ACTUAL_SNAPSHOT_REQUIRED");
no(authority.required_semantics.fixed_scheduler_eligibility_offset_is_authority, "AM11_V3_SERVICE_420_FORBIDDEN");
no(authority.required_semantics.fixed_exact_interval_cutoff_offset_is_authority, "AM11_V3_SERVICE_432_FORBIDDEN");
no(authority.required_semantics.fixed_runtime_observer_offset_is_authority, "AM11_V3_SERVICE_437_FORBIDDEN");
eq(authority.required_semantics.historical_online_freshness_diagnostic_hours, 6, "AM11_V3_SERVICE_6H_DIAGNOSTIC");
no(authority.required_semantics.freshness_is_late_authoritative_admission_gate, "AM11_V3_SERVICE_6H_GATE_FORBIDDEN");
yes(authority.required_semantics.scheduler_claim_reused_as_runtime_lease, "AM11_V3_SERVICE_FENCE_REUSE");
no(authority.required_semantics.second_runtime_write_lease_acquired, "AM11_V3_SERVICE_SECOND_LEASE_FORBIDDEN");
no(authority.required_semantics.runtime_provider_fetch_allowed, "AM11_V3_SERVICE_PROVIDER_FETCH_FORBIDDEN");
no(authority.required_semantics.runtime_r2_access_allowed, "AM11_V3_SERVICE_R2_FORBIDDEN");

eq(authority.focused_acceptance_contract.actual_evidence_snapshot_minutes_after_t, 500, "AM11_V3_SERVICE_T500_POSITIVE_CONTROL");
yes(authority.focused_acceptance_contract.proves_execution_beyond_historical_t_plus_432, "AM11_V3_SERVICE_BEYOND_432");
yes(authority.focused_acceptance_contract.proves_execution_beyond_historical_t_plus_437, "AM11_V3_SERVICE_BEYOND_437");
yes(authority.focused_acceptance_contract.proves_fixed_lag_authority_used_false, "AM11_V3_SERVICE_FIXED_LAG_FALSE");

const effect = authority.effect_if_exact_head_proof_passes_and_candidate_merges_to_protected_main;
yes(effect.amendment11_persistent_tick_service_implementation_qualified, "AM11_V3_SERVICE_EFFECT_QUALIFIED");
yes(effect.historical_v3_fixed_lag_service_superseded_for_new_formal_runner_binding, "AM11_V3_SERVICE_EFFECT_SUPERSEDES_FIXED_LAG");
no(effect.external_formal_v3_runner_exact_binding_qualified, "AM11_V3_SERVICE_NO_RUNNER_BINDING");
no(effect.ea5e3_authorized, "AM11_V3_SERVICE_NO_EA5E3");
no(effect.formal_window_started, "AM11_V3_SERVICE_NO_FORMAL_START");
eq(effect.formal_execution_count, "0/24", "AM11_V3_SERVICE_ZERO_OF_24");
no(effect.mcft_cap09_completed, "AM11_V3_SERVICE_NO_COMPLETION");

eq(authority.next_legal_frontier_after_effectiveness, "EXTERNAL_FORMAL_V3_RUNNER_EXACT_BINDING_QUALIFICATION", "AM11_V3_SERVICE_NEXT_FRONTIER");

fs.mkdirSync("acceptance-output", { recursive: true });
fs.writeFileSync("acceptance-output/MCFT_CAP_09_EXTERNAL_FORMAL_V3_AMENDMENT11_PERSISTENT_TICK_GOVERNANCE_RESULT.json", JSON.stringify({
  schema_version: "geox_mcft_cap09_external_formal_v3_amendment11_persistent_tick_governance_result_v1",
  status: "PASS",
  base_sha: base,
  subject_sha: git("rev-parse", "HEAD"),
  exact_changed_file_count: changed.length,
  provider_availability_watermark: authority.required_semantics.provider_availability_watermark,
  fixed_lag_authority_used: false,
  historical_v3_service_unchanged: true,
  ea5e3_authorized: false,
  formal_window_started: false,
  formal_execution_count: "0/24",
  mcft_cap09_completed: false
}, null, 2) + "\n");
console.log(JSON.stringify({ status: "PASS", fixed_lag_authority_used: false, next: authority.next_legal_frontier_after_effectiveness }));
