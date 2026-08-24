#!/usr/bin/env node
"use strict";

const fs = require("node:fs");

const FILES = {
  graduation: ".github/workflows/mcft-cap-09-amendment19-formal-graduation-wiring.yml",
  formalArmWorkflow: ".github/workflows/mcft-cap-09-amendment19-formal-arm.yml",
  formalArmAssembler: "scripts/governance_acceptance/ASSEMBLE_MCFT_CAP_09_AMENDMENT_19_FORMAL_ARM_V1.cjs",
  a0: ".github/workflows/mcft-cap-09-amendment19-formal-a0-bootstrap.yml",
  hourly: ".github/workflows/mcft-cap-09-amendment19-formal-hourly-evidence.yml",
  live: ".github/workflows/mcft-cap-09-amendment19-formal-live-runner.yml",
  finalReadback: ".github/workflows/mcft-cap-09-amendment19-formal-final-readback.yml",
  completion: "scripts/governance_acceptance/ASSEMBLE_MCFT_CAP_09_AMENDMENT_19_FORMAL_COMPLETION_V1.cjs",
  contract: "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-19-QUALIFICATION-COMPATIBILITY-CONTRACT-V1.json",
  historicalAttester: "scripts/governance_acceptance/ATTEST_MCFT_CAP_09_NON_SEMANTIC_CONTROL_PLANE_COMPATIBILITY_V1.cjs",
  storeAuthority: "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-T4R1-ACTUAL-FORMAL-STORE-AUTHORITY-V2.json",
};

function need(value, code) { if (!value) throw new Error(code); }
function read(key) {
  const file = FILES[key];
  need(fs.existsSync(file), `AM19_CLOSURE_AUDIT_FILE_REQUIRED:${file}`);
  return fs.readFileSync(file, "utf8");
}
function has(value, token, code) { need(value.includes(token), code); }
function lacks(value, token, code) { need(!value.includes(token), code); }
function lacksTopLevelWorkflowDispatch(value, code) {
  need(!/^  workflow_dispatch:\s*$/m.test(value), code);
}
function noOperationalReference(value, token, code) {
  const offending = value.split("\n").filter((line) => {
    if (!line.includes(token)) return false;
    const trimmed = line.trim();
    if (trimmed.startsWith("! grep ")) return false;
    if (trimmed.startsWith("forbidden=")) return false;
    if (trimmed.startsWith("legacy_")) return false;
    return true;
  });
  need(offending.length === 0, `${code}:${offending.join(" || ")}`);
}

function main() {
  const graduation = read("graduation");
  const armWorkflow = read("formalArmWorkflow");
  const arm = read("formalArmAssembler");
  const a0 = read("a0");
  const hourly = read("hourly");
  const live = read("live");
  const finalReadback = read("finalReadback");
  const completion = read("completion");
  const contract = read("contract");
  const historicalAttester = read("historicalAttester");
  const storeAuthority = JSON.parse(read("storeAuthority"));

  // Historical v11 compatibility evidence remains immutable/auditable, but is not active gate authority.
  has(contract, '"governed_semantic_digest"', "AM19_CLOSURE_AUDIT_SEMANTIC_DIGEST_CONTRACT_REQUIRED");
  has(contract, '"qualification_subject_sha": "abf0aa121001480f01ad4e39364b1df13f3c26eb"', "AM19_CLOSURE_AUDIT_V11_SUBJECT_REQUIRED");
  has(contract, '"persistent_workflow_run_id": 32638502092', "AM19_CLOSURE_AUDIT_V11_RUN_REQUIRED");
  has(contract, '"persistent_artifact_id": 9493316708', "AM19_CLOSURE_AUDIT_V11_ARTIFACT_REQUIRED");
  has(contract, '"persistent_artifact_digest": "sha256:3a6f01a9c1da1de4522ba9d745e3619b7c116ece45bde39ebec10d8637cb4544"', "AM19_CLOSURE_AUDIT_V11_DIGEST_REQUIRED");
  has(contract, '"qualification_database": "geox_mcft_cap09_s6_accel24t_am19_v11"', "AM19_CLOSURE_AUDIT_V11_DATABASE_REQUIRED");
  has(contract, '"blocked_database": "geox_mcft_cap09_s6_accel24t_am19_blocked_v11"', "AM19_CLOSURE_AUDIT_V11_BLOCKED_DATABASE_REQUIRED");
  has(contract, '"formal_database": "geox_mcft_cap09_s6_formal_t4r1_24h_v3"', "AM19_CLOSURE_AUDIT_HISTORICAL_FORMAL_V3_REQUIRED");
  has(historicalAttester, "GEOX-MCFT-CAP-09-AMENDMENT-19-QUALIFICATION-COMPATIBILITY-CONTRACT-V1.json", "AM19_CLOSURE_AUDIT_HISTORICAL_ATTESTER_CONTRACT_REQUIRED");
  has(historicalAttester, "NON_SEMANTIC_CONTROL_PLANE_COMPATIBILITY_ATTESTATION_V1", "AM19_CLOSURE_AUDIT_HISTORICAL_ATTESTER_ID_REQUIRED");
  has(historicalAttester, "qualification_reexecution_required: false", "AM19_CLOSURE_AUDIT_HISTORICAL_ATTESTER_SCOPE_REQUIRED");
  has(historicalAttester, "formal_effect: false", "AM19_CLOSURE_AUDIT_HISTORICAL_ATTESTER_ZERO_EFFECT_REQUIRED");

  // Authority V2 makes fresh v12 active and explicitly forbids predecessor generation reuse.
  need(storeAuthority?.schema_version === "geox_mcft_cap09_t4r1_actual_formal_store_authority_v2", "AM19_CLOSURE_AUDIT_STORE_AUTHORITY_V2_REQUIRED");
  const q = storeAuthority.qualification_generation;
  need(q?.qualification_database === "geox_mcft_cap09_s6_accel24t_am19_v12", "AM19_CLOSURE_AUDIT_ACTIVE_V12_REQUIRED");
  need(q?.blocked_database === "geox_mcft_cap09_s6_accel24t_am19_blocked_v12", "AM19_CLOSURE_AUDIT_ACTIVE_BLOCKED_V12_REQUIRED");
  need(q?.previous_qualification_database === "geox_mcft_cap09_s6_accel24t_am19_v11", "AM19_CLOSURE_AUDIT_PREDECESSOR_V11_REQUIRED");
  need(q?.fresh_qualification_required === true, "AM19_CLOSURE_AUDIT_FRESH_V12_REQUIRED");
  need(q?.previous_generation_reuse_forbidden === true, "AM19_CLOSURE_AUDIT_PREVIOUS_GENERATION_REUSE_FORBIDDEN");

  // Active Graduation is exact-subject v12 only. Static grep guards must not be mistaken for active YAML triggers.
  lacksTopLevelWorkflowDispatch(graduation, "AM19_CLOSURE_AUDIT_ACTIVE_MANUAL_REPLAY_FORBIDDEN");
  has(graduation, "workflows: ['mcft-cap-09-t4r1-amendment19-persistent-24t-qualification']", "AM19_CLOSURE_AUDIT_ACTIVE_V12_WORKFLOW_SOURCE_REQUIRED");
  has(graduation, "CLASSIFY_MCFT_CAP_09_AMENDMENT_19_PERSISTENT_GRADUATION_TRIGGER_V2.cjs", "AM19_CLOSURE_AUDIT_ACTIVE_V12_CLASSIFIER_REQUIRED");
  has(graduation, "mcft-cap09-t4r1-am19-persistent24-${process.env.SUBJECT_SHA}-", "AM19_CLOSURE_AUDIT_ACTIVE_EXACT_SUBJECT_ARTIFACT_REQUIRED");
  has(graduation, "AM19_GRADUATION_WIRING_PROTECTED_MAIN_DRIFT", "AM19_CLOSURE_AUDIT_ACTIVE_PROTECTED_MAIN_BINDING_REQUIRED");
  has(graduation, "new_machine_gate_claim", "AM19_CLOSURE_AUDIT_ACTIVE_MACHINE_GATE_CLAIM_REQUIRED");
  lacks(graduation, "ATTEST_MCFT_CAP_09_NON_SEMANTIC_CONTROL_PLANE_COMPATIBILITY_V1.cjs", "AM19_CLOSURE_AUDIT_HISTORICAL_ATTESTER_ACTIVE_WIRING_FORBIDDEN");
  lacks(graduation, "ASSEMBLE_MCFT_CAP_09_AMENDMENT_19_COMPATIBLE_GRADUATION_INPUT_V1.cjs", "AM19_CLOSURE_AUDIT_HISTORICAL_COMPAT_INPUT_ACTIVE_WIRING_FORBIDDEN");
  lacks(graduation, "ASSEMBLE_MCFT_CAP_09_AMENDMENT_19_COMPATIBLE_GRADUATION_ENVELOPE_V1.cjs", "AM19_CLOSURE_AUDIT_HISTORICAL_COMPAT_ENVELOPE_ACTIVE_WIRING_FORBIDDEN");
  for (const token of [
    "abf0aa121001480f01ad4e39364b1df13f3c26eb",
    "32638502092",
    "9493316708",
    "sha256:3a6f01a9c1da1de4522ba9d745e3619b7c116ece45bde39ebec10d8637cb4544",
    "geox_mcft_cap09_s6_accel24t_am19_v11",
    "mcft-cap09-am19-persistent24-",
  ]) lacks(graduation, token, `AM19_CLOSURE_AUDIT_STALE_ACTIVE_GRADUATION_TOKEN_FORBIDDEN:${token}`);

  // Existing arm consumer contract remains bound to the deployment subject and the same Graduation artifact prefix.
  has(arm, "gateSubject === rollingSubject && gateSubject === currentMain", "AM19_CLOSURE_AUDIT_DEPLOYMENT_SUBJECT_CHAIN_REQUIRED");
  lacks(arm, "qualification_subject_sha === currentMain", "AM19_CLOSURE_AUDIT_QUALIFICATION_DEPLOYMENT_RECOLLAPSE_FORBIDDEN");
  has(arm, 'mcft-cap09-am19-formal-graduation-${currentMain}-', "AM19_CLOSURE_AUDIT_GATE_ARTIFACT_DEPLOYMENT_BINDING_REQUIRED");
  has(arm, "mcft-cap09-t4r1-rolling-preboundary-", "AM19_CLOSURE_AUDIT_T4_ROLLING_PREFIX_REQUIRED");

  // Active production control plane is physical Formal-v4 only; old v3 remains historical recovery evidence.
  for (const [name, value] of [["armWorkflow", armWorkflow], ["a0", a0], ["hourly", hourly], ["live", live], ["finalReadback", finalReadback]]) {
    noOperationalReference(value, "GEOX_MCFT_CAP09_T3R1_S6_DATABASE_URL", `AM19_CLOSURE_AUDIT_T3_SECRET_FORBIDDEN:${name}`);
    noOperationalReference(value, "geox_mcft_cap09_s6_formal_t3r1_24h", `AM19_CLOSURE_AUDIT_T3_DATABASE_FORBIDDEN:${name}`);
    noOperationalReference(value, "geox_mcft_cap09_s6_formal_t4r1_24h_v2", `AM19_CLOSURE_AUDIT_FORMAL_V2_FORBIDDEN:${name}`);
    noOperationalReference(value, "geox_mcft_cap09_s6_formal_t4r1_24h_v3", `AM19_CLOSURE_AUDIT_FORMAL_V3_ACTIVE_ROUTE_FORBIDDEN:${name}`);
  }
  has(a0, "geox_mcft_cap09_s6_formal_t4r1_24h_v4", "AM19_CLOSURE_AUDIT_A0_T4_FORMAL_V4_DB_REQUIRED");
  has(hourly, "GEOX_MCFT_CAP09_T4R1_S6_DATABASE_URL", "AM19_CLOSURE_AUDIT_HOURLY_T4_PARENT_SECRET_REQUIRED");
  has(hourly, "geox_mcft_cap09_s6_formal_t4r1_24h_v4", "AM19_CLOSURE_AUDIT_HOURLY_T4_FORMAL_V4_DB_REQUIRED");
  has(live, "geox_mcft_cap09_s6_formal_t4r1_24h_v4", "AM19_CLOSURE_AUDIT_LIVE_T4_FORMAL_V4_DB_REQUIRED");
  has(finalReadback, "geox_mcft_cap09_s6_formal_t4r1_24h_v4", "AM19_CLOSURE_AUDIT_READBACK_T4_FORMAL_V4_DB_REQUIRED");

  // Accelerated qualification stores may never become A0/live/final production stores.
  for (const generation of ["v12", "v11", "v10", "v9", "v4"]) {
    lacks(a0, `geox_mcft_cap09_s6_accel24t_am19_${generation}`, `AM19_CLOSURE_AUDIT_A0_QUAL_DB_COUPLING_FORBIDDEN:${generation}`);
    lacks(live, `geox_mcft_cap09_s6_accel24t_am19_${generation}`, `AM19_CLOSURE_AUDIT_LIVE_QUAL_DB_COUPLING_FORBIDDEN:${generation}`);
    lacks(finalReadback, `geox_mcft_cap09_s6_accel24t_am19_${generation}`, `AM19_CLOSURE_AUDIT_READBACK_QUAL_DB_COUPLING_FORBIDDEN:${generation}`);
  }

  has(a0, "triggering arm subject is exact current protected main", "AM19_CLOSURE_AUDIT_A0_DEPLOYMENT_MAIN_BINDING_REQUIRED");
  has(live, "Freeze exact current protected-main subject", "AM19_CLOSURE_AUDIT_LIVE_DEPLOYMENT_MAIN_BINDING_REQUIRED");
  has(completion, "mcft_cap09_completed", "AM19_CLOSURE_AUDIT_COMPLETION_BOUNDARY_REQUIRED");

  console.log(JSON.stringify({
    schema_version: "geox_mcft_cap09_closure_control_plane_audit_v1",
    status: "PASS",
    audited_file_count: Object.keys(FILES).length,
    qualification_and_deployment_identity_separated: true,
    historical_carry_forward_qualification_generation: "v11",
    historical_carry_forward_qualification_subject_sha: "abf0aa121001480f01ad4e39364b1df13f3c26eb",
    historical_persistent_run_id: 32638502092,
    historical_persistent_artifact_id: 9493316708,
    historical_compatibility_attester_preserved: true,
    historical_compatibility_attester_active_gate_authority: false,
    active_qualification_generation: "v12",
    active_previous_generation_reuse_forbidden: true,
    actual_formal_generation: "v4",
    fresh_qualification_required_separately: true,
    active_graduation_exact_subject_v12_only: true,
    downstream_formal_chain_bound_to_deployment_subject: true,
    active_formal_chain_bound_to_v4: true,
    stale_formal_v3_operational_route_absent: true,
    stale_formal_v2_operational_route_absent: true,
    stale_t3_operational_route_absent: true,
    negative_static_guards_not_misclassified_as_operational_routes: true,
    qualification_store_generation_not_used_by_a0_or_live_runner: true,
  }));
}

main();
