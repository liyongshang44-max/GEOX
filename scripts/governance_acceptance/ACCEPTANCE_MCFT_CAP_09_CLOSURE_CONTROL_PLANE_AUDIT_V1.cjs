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

  has(contract,'"governed_semantic_digest"',"AM19_CLOSURE_AUDIT_SEMANTIC_DIGEST_CONTRACT_REQUIRED");
  has(contract,'"qualification_subject_sha"',"AM19_CLOSURE_AUDIT_QUALIFICATION_IDENTITY_REQUIRED");
  has(contract,'"deployment_subject_sha"',"AM19_CLOSURE_AUDIT_DEPLOYMENT_IDENTITY_REQUIRED");
  has(contract,'"execution_run_id"',"AM19_CLOSURE_AUDIT_EXECUTION_IDENTITY_REQUIRED");
  has(contract,'"evidence_generation_id"',"AM19_CLOSURE_AUDIT_EVIDENCE_GENERATION_REQUIRED");

  has(graduation,"workflow_dispatch:","AM19_CLOSURE_AUDIT_COMPATIBLE_REPLAY_ENTRY_REQUIRED");
  has(graduation,"ATTEST_MCFT_CAP_09_NON_SEMANTIC_CONTROL_PLANE_COMPATIBILITY_V1.cjs","AM19_CLOSURE_AUDIT_COMPAT_ATTESTATION_WIRING_REQUIRED");
  has(graduation,"ASSEMBLE_MCFT_CAP_09_AMENDMENT_19_COMPATIBLE_GRADUATION_INPUT_V1.cjs","AM19_CLOSURE_AUDIT_COMPAT_INPUT_REQUIRED");
  has(graduation,"ASSEMBLE_MCFT_CAP_09_AMENDMENT_19_COMPATIBLE_GRADUATION_ENVELOPE_V1.cjs","AM19_CLOSURE_AUDIT_COMPAT_ENVELOPE_REQUIRED");
  has(graduation,"Download real frozen v9 qualification artifact in PR","AM19_CLOSURE_AUDIT_PREMERGE_REAL_ARTIFACT_TEST_REQUIRED");
  has(graduation,"mcft-cap09-t4r1-am19-persistent24-","AM19_CLOSURE_AUDIT_T4_PERSISTENT_PREFIX_REQUIRED");
  no(graduation,"mcft-cap09-am19-persistent24-","AM19_CLOSURE_AUDIT_OLD_PERSISTENT_PREFIX_FORBIDDEN");

  has(arm,"gateSubject === rollingSubject && gateSubject === currentMain","AM19_CLOSURE_AUDIT_DEPLOYMENT_SUBJECT_CHAIN_REQUIRED");
  no(arm,"qualification_subject_sha === currentMain","AM19_CLOSURE_AUDIT_QUALIFICATION_DEPLOYMENT_RECOLLAPSE_FORBIDDEN");
  has(arm,'mcft-cap09-am19-formal-graduation-${currentMain}-',"AM19_CLOSURE_AUDIT_GATE_ARTIFACT_DEPLOYMENT_BINDING_REQUIRED");
  has(arm,'mcft-cap09-t4r1-rolling-preboundary-',"AM19_CLOSURE_AUDIT_T4_ROLLING_PREFIX_REQUIRED");

  for (const [name,value] of [["armWorkflow",armWorkflow],["a0",a0],["hourly",hourly],["live",live],["finalReadback",finalReadback]]) {
    noOperationalReference(value,"GEOX_MCFT_CAP09_T3R1_S6_DATABASE_URL",`AM19_CLOSURE_AUDIT_T3_SECRET_FORBIDDEN:${name}`);
    noOperationalReference(value,"geox_mcft_cap09_s6_formal_t3r1_24h",`AM19_CLOSURE_AUDIT_T3_DATABASE_FORBIDDEN:${name}`);
  }
  has(a0,"geox_mcft_cap09_s6_formal_t4r1_24h_v2","AM19_CLOSURE_AUDIT_A0_T4_FORMAL_DB_REQUIRED");
  has(hourly,"GEOX_MCFT_CAP09_T4R1_S6_DATABASE_URL","AM19_CLOSURE_AUDIT_HOURLY_T4_PARENT_SECRET_REQUIRED");
  has(live,"geox_mcft_cap09_s6_formal_t4r1_24h_v2","AM19_CLOSURE_AUDIT_LIVE_T4_FORMAL_DB_REQUIRED");
  has(finalReadback,"geox_mcft_cap09_s6_formal_t4r1_24h_v2","AM19_CLOSURE_AUDIT_READBACK_T4_FORMAL_DB_REQUIRED");

  no(a0,"geox_mcft_cap09_s6_accel24t_am19_v4","AM19_CLOSURE_AUDIT_A0_QUAL_DB_COUPLING_FORBIDDEN");
  no(live,"geox_mcft_cap09_s6_accel24t_am19_v9","AM19_CLOSURE_AUDIT_LIVE_QUAL_DB_COUPLING_FORBIDDEN");
  no(finalReadback,"geox_mcft_cap09_s6_accel24t_am19_v9","AM19_CLOSURE_AUDIT_READBACK_QUAL_DB_COUPLING_FORBIDDEN");

  has(a0,"triggering arm subject is exact current protected main","AM19_CLOSURE_AUDIT_A0_DEPLOYMENT_MAIN_BINDING_REQUIRED");
  has(live,"Freeze exact current protected-main subject","AM19_CLOSURE_AUDIT_LIVE_DEPLOYMENT_MAIN_BINDING_REQUIRED");
  has(completion,"mcft_cap09_completed","AM19_CLOSURE_AUDIT_COMPLETION_BOUNDARY_REQUIRED");

  console.log(JSON.stringify({
    schema_version:"geox_mcft_cap09_closure_control_plane_audit_v1",
    status:"PASS",
    audited_file_count:Object.keys(FILES).length,
    qualification_and_deployment_identity_separated:true,
    premerge_real_artifact_graduation_replay_required:true,
    downstream_formal_chain_bound_to_deployment_subject:true,
    stale_t3_operational_route_absent:true,
    negative_static_guards_not_misclassified_as_operational_routes:true,
    qualification_store_generation_not_used_by_a0_or_live_runner:true
  }));
}

main();
