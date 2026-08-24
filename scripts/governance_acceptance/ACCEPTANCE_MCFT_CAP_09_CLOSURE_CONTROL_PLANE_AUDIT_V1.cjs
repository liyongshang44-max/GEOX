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
};
function text(key) { const p=FILES[key]; if(!fs.existsSync(p)) throw new Error(`AM19_CLOSURE_AUDIT_FILE_REQUIRED:${p}`); return fs.readFileSync(p,"utf8"); }
function need(value, code) { if(!value) throw new Error(code); }
function has(value, token, code) { need(value.includes(token), code); }
function no(value, token, code) { need(!value.includes(token), code); }
function noOperationalReference(value, token, code) {
  const hits = value.split("\n").filter((line) => line.includes(token));
  const nonGuardHits = hits.filter((line) => {
    const trimmed = line.trim();
    return !(
      trimmed.startsWith("! grep ") ||
      trimmed.startsWith("forbidden=") ||
      trimmed.includes("grep -Fq") && trimmed.startsWith("!")
    );
  });
  need(nonGuardHits.length === 0, `${code}:${nonGuardHits.join(" || ")}`);
}

function main() {
  const graduation=text("graduation"), armWorkflow=text("formalArmWorkflow"), arm=text("formalArmAssembler"), a0=text("a0"), hourly=text("hourly"), live=text("live"), finalReadback=text("finalReadback"), completion=text("completion"), contract=text("contract");

  // Historical v11 compatibility contract remains immutable carry-forward evidence.
  has(contract,'"governed_semantic_digest"',"AM19_CLOSURE_AUDIT_SEMANTIC_DIGEST_CONTRACT_REQUIRED");
  has(contract,'"qualification_subject_sha"',"AM19_CLOSURE_AUDIT_QUALIFICATION_IDENTITY_REQUIRED");
  has(contract,'"deployment_subject_sha"',"AM19_CLOSURE_AUDIT_DEPLOYMENT_IDENTITY_REQUIRED");
  has(contract,'"execution_run_id"',"AM19_CLOSURE_AUDIT_EXECUTION_IDENTITY_REQUIRED");
  has(contract,'"evidence_generation_id"',"AM19_CLOSURE_AUDIT_EVIDENCE_GENERATION_REQUIRED");
  has(contract,'"formal_database": "geox_mcft_cap09_s6_formal_t4r1_24h_v3"',"AM19_CLOSURE_AUDIT_CONTRACT_FORMAL_V3_REQUIRED");
  has(contract,'"qualification_subject_sha": "abf0aa121001480f01ad4e39364b1df13f3c26eb"',"AM19_CLOSURE_AUDIT_V11_SUBJECT_REQUIRED");
  has(contract,'"persistent_workflow_run_id": 32638502092',"AM19_CLOSURE_AUDIT_V11_RUN_REQUIRED");
  has(contract,'"persistent_artifact_id": 9493316708',"AM19_CLOSURE_AUDIT_V11_ARTIFACT_REQUIRED");
  has(contract,'"persistent_artifact_digest": "sha256:3a6f01a9c1da1de4522ba9d745e3619b7c116ece45bde39ebec10d8637cb4544"',"AM19_CLOSURE_AUDIT_V11_DIGEST_REQUIRED");
  has(contract,'"qualification_database": "geox_mcft_cap09_s6_accel24t_am19_v11"',"AM19_CLOSURE_AUDIT_V11_DATABASE_REQUIRED");
  has(contract,'"blocked_database": "geox_mcft_cap09_s6_accel24t_am19_blocked_v11"',"AM19_CLOSURE_AUDIT_V11_BLOCKED_DATABASE_REQUIRED");
  no(contract,'"qualification_database": "geox_mcft_cap09_s6_accel24t_am19_v10"',"AM19_CLOSURE_AUDIT_V10_CURRENT_QUALIFICATION_FORBIDDEN");
  no(contract,'"formal_database": "geox_mcft_cap09_s6_formal_t4r1_24h_v2"',"AM19_CLOSURE_AUDIT_FORMAL_V2_CURRENT_CONTRACT_FORBIDDEN");

  // The historical compatible-replay Graduation lane remains auditable but is not authority for the fresh-v12 successor.
  has(graduation,"workflow_dispatch:","AM19_CLOSURE_AUDIT_COMPATIBLE_REPLAY_ENTRY_REQUIRED");
  has(graduation,"ATTEST_MCFT_CAP_09_NON_SEMANTIC_CONTROL_PLANE_COMPATIBILITY_V1.cjs","AM19_CLOSURE_AUDIT_COMPAT_ATTESTATION_WIRING_REQUIRED");
  has(graduation,"ASSEMBLE_MCFT_CAP_09_AMENDMENT_19_COMPATIBLE_GRADUATION_INPUT_V1.cjs","AM19_CLOSURE_AUDIT_COMPAT_INPUT_REQUIRED");
  has(graduation,"ASSEMBLE_MCFT_CAP_09_AMENDMENT_19_COMPATIBLE_GRADUATION_ENVELOPE_V1.cjs","AM19_CLOSURE_AUDIT_COMPAT_ENVELOPE_REQUIRED");
  has(graduation,"Download real frozen v11 qualification artifact in PR","AM19_CLOSURE_AUDIT_PREMERGE_REAL_ARTIFACT_TEST_REQUIRED");
  has(graduation,"CLOSURE_QUALIFICATION_SHA: abf0aa121001480f01ad4e39364b1df13f3c26eb","AM19_CLOSURE_AUDIT_GRADUATION_V11_SUBJECT_REQUIRED");
  has(graduation,"CLOSURE_PERSISTENT_RUN_ID: '32638502092'","AM19_CLOSURE_AUDIT_GRADUATION_V11_RUN_REQUIRED");
  has(graduation,"CLOSURE_PERSISTENT_ARTIFACT_ID: '9493316708'","AM19_CLOSURE_AUDIT_GRADUATION_V11_ARTIFACT_REQUIRED");
  has(graduation,"CLOSURE_PERSISTENT_ARTIFACT_DIGEST: sha256:3a6f01a9c1da1de4522ba9d745e3619b7c116ece45bde39ebec10d8637cb4544","AM19_CLOSURE_AUDIT_GRADUATION_V11_DIGEST_REQUIRED");
  has(graduation,"geox_mcft_cap09_s6_accel24t_am19_v11","AM19_CLOSURE_AUDIT_GRADUATION_V11_DB_REQUIRED");
  no(graduation,"Download real frozen v10 qualification artifact in PR","AM19_CLOSURE_AUDIT_STALE_V10_ARTIFACT_ROUTE_FORBIDDEN");
  has(graduation,"mcft-cap09-t4r1-am19-persistent24-","AM19_CLOSURE_AUDIT_T4_PERSISTENT_PREFIX_REQUIRED");
  no(graduation,"mcft-cap09-am19-persistent24-","AM19_CLOSURE_AUDIT_OLD_PERSISTENT_PREFIX_FORBIDDEN");

  has(arm,"gateSubject === rollingSubject && gateSubject === currentMain","AM19_CLOSURE_AUDIT_DEPLOYMENT_SUBJECT_CHAIN_REQUIRED");
  no(arm,"qualification_subject_sha === currentMain","AM19_CLOSURE_AUDIT_QUALIFICATION_DEPLOYMENT_RECOLLAPSE_FORBIDDEN");
  has(arm,'mcft-cap09-am19-formal-graduation-${currentMain}-',"AM19_CLOSURE_AUDIT_GATE_ARTIFACT_DEPLOYMENT_BINDING_REQUIRED");
  has(arm,'mcft-cap09-t4r1-rolling-preboundary-',"AM19_CLOSURE_AUDIT_T4_ROLLING_PREFIX_REQUIRED");

  // Active successor control plane must use only T4R1 Formal-v4 physical storage.
  for (const [name,value] of [["armWorkflow",armWorkflow],["a0",a0],["hourly",hourly],["live",live],["finalReadback",finalReadback]]) {
    noOperationalReference(value,"GEOX_MCFT_CAP09_T3R1_S6_DATABASE_URL",`AM19_CLOSURE_AUDIT_T3_SECRET_FORBIDDEN:${name}`);
    noOperationalReference(value,"geox_mcft_cap09_s6_formal_t3r1_24h",`AM19_CLOSURE_AUDIT_T3_DATABASE_FORBIDDEN:${name}`);
    noOperationalReference(value,"geox_mcft_cap09_s6_formal_t4r1_24h_v2",`AM19_CLOSURE_AUDIT_FORMAL_V2_FORBIDDEN:${name}`);
    noOperationalReference(value,"geox_mcft_cap09_s6_formal_t4r1_24h_v3",`AM19_CLOSURE_AUDIT_FORMAL_V3_ACTIVE_ROUTE_FORBIDDEN:${name}`);
  }
  has(a0,"geox_mcft_cap09_s6_formal_t4r1_24h_v4","AM19_CLOSURE_AUDIT_A0_T4_FORMAL_V4_DB_REQUIRED");
  has(hourly,"GEOX_MCFT_CAP09_T4R1_S6_DATABASE_URL","AM19_CLOSURE_AUDIT_HOURLY_T4_PARENT_SECRET_REQUIRED");
  has(hourly,"geox_mcft_cap09_s6_formal_t4r1_24h_v4","AM19_CLOSURE_AUDIT_HOURLY_T4_FORMAL_V4_DB_REQUIRED");
  has(live,"geox_mcft_cap09_s6_formal_t4r1_24h_v4","AM19_CLOSURE_AUDIT_LIVE_T4_FORMAL_V4_DB_REQUIRED");
  has(finalReadback,"geox_mcft_cap09_s6_formal_t4r1_24h_v4","AM19_CLOSURE_AUDIT_READBACK_T4_FORMAL_V4_DB_REQUIRED");

  // Production execution paths must never bind qualification stores, including the fresh v12 stores.
  for (const generation of ["v12","v11","v10","v9","v4"]) {
    no(a0,`geox_mcft_cap09_s6_accel24t_am19_${generation}`,`AM19_CLOSURE_AUDIT_A0_QUAL_DB_COUPLING_FORBIDDEN:${generation}`);
    no(live,`geox_mcft_cap09_s6_accel24t_am19_${generation}`,`AM19_CLOSURE_AUDIT_LIVE_QUAL_DB_COUPLING_FORBIDDEN:${generation}`);
    no(finalReadback,`geox_mcft_cap09_s6_accel24t_am19_${generation}`,`AM19_CLOSURE_AUDIT_READBACK_QUAL_DB_COUPLING_FORBIDDEN:${generation}`);
  }

  has(a0,"triggering arm subject is exact current protected main","AM19_CLOSURE_AUDIT_A0_DEPLOYMENT_MAIN_BINDING_REQUIRED");
  has(live,"Freeze exact current protected-main subject","AM19_CLOSURE_AUDIT_LIVE_DEPLOYMENT_MAIN_BINDING_REQUIRED");
  has(completion,"mcft_cap09_completed","AM19_CLOSURE_AUDIT_COMPLETION_BOUNDARY_REQUIRED");

  console.log(JSON.stringify({
    schema_version:"geox_mcft_cap09_closure_control_plane_audit_v1",
    status:"PASS",
    audited_file_count:Object.keys(FILES).length,
    qualification_and_deployment_identity_separated:true,
    historical_carry_forward_qualification_generation:"v11",
    historical_carry_forward_qualification_subject_sha:"abf0aa121001480f01ad4e39364b1df13f3c26eb",
    historical_persistent_run_id:32638502092,
    historical_persistent_artifact_id:9493316708,
    actual_formal_generation:"v4",
    fresh_qualification_required_separately:true,
    stale_v10_current_authority_absent:true,
    compatible_replay_lane_remains_historical_only:true,
    downstream_formal_chain_bound_to_deployment_subject:true,
    active_formal_chain_bound_to_v4:true,
    stale_formal_v3_operational_route_absent:true,
    stale_formal_v2_operational_route_absent:true,
    stale_t3_operational_route_absent:true,
    negative_static_guards_not_misclassified_as_operational_routes:true,
    qualification_store_generation_not_used_by_a0_or_live_runner:true
  }));
}

main();
