#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const cp = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const BASE = '1a6ff1b3c2b9974f859fe473b09a49a5c8fdb678';
const OUT = path.join(ROOT, 'acceptance-output/MCFT_CAP_08_S5_FORMAL_CANDIDATE_BOUNDARY_RESULT.json');
const EXPECTED = [
  ".github/workflows/mcft-cap-08-s5-pre-candidate-governance.yml",
  ".github/workflows/mcft-cap-08-s5-residual-calibration-shadow.yml",
  ".github/workflows/mcft-cap-08-s5-exact-sha-attestation.yml",
  "apps/server/src/domain/calibration/cap08_s5_case_builder_v1.ts",
  "apps/server/src/domain/calibration/cap08_s5_envelope_profiles_v1.ts",
  "apps/server/src/domain/calibration/cap08_s5_objective_grid_search_v1.ts",
  "apps/server/src/domain/twin_runtime/cap08_s5_replay_dataset_v2_authority_v1.ts",
  "apps/server/src/domain/twin_runtime/cap08_s5_residual_calibration_shadow_contracts_v1.ts",
  "apps/server/src/infra/mcft_cap08_database_platform_bootstrap_v1.ts",
  "apps/server/src/persistence/twin_runtime/postgres_cap08_s5_exact_source_v1.ts",
  "apps/server/src/runtime/twin_runtime/cap08_s5_replay_prediction_adapter_v1.ts",
  "apps/server/src/runtime/twin_runtime/cap08_s5_residual_calibration_shadow_service_v1.ts",
  "docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S5-CANDIDATE-CHANGED-FILE-BOUNDARY-V1.json",
  "docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S5-IMPLEMENTATION-V1.json",
  "docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S5-DELIVERY-STATUS-V1.json",
  "docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S5-PREDECESSOR-CONSUMPTION-V1.json",
  "docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S5-WORKFLOW-DECLARATION-V1.json",
  "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_08_S5_FORMAL_CANDIDATE_BOUNDARY.cjs",
  "scripts/governance_acceptance/mcft_cap08_s5_artifact_finalize.cjs",
  "scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_08_S5_V2_FORMAL_PREFLIGHT_DB.ts",
  "scripts/runtime_acceptance/mcft_cap08_s5_v2_formal_acceptance_support_v1.ts"
];
const P = {
  taskbook: 'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-TASK.md',
  contract: 'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S5-CONTRACT-V1.json',
  registry: 'docs/digital_twin/mcft/MCFT-CANDIDATE-AUTHORITY-REGISTRY-V1.json',
  s6: 'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S6-DELIVERY-STATUS-V1.json',
  frontier: 'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-CURRENT-FRONTIER-V1.json',
  boundary: 'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S5-CANDIDATE-CHANGED-FILE-BOUNDARY-V1.json',
  status: 'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S5-DELIVERY_STATUS-V1.json',
  predecessor: 'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S5-PREDECESSOR-CONSUMPTION-V1.json',
  implementation: 'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S5-IMPLEMENTATION-V1.json',
  workflows: 'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S5-WORKFLOW-DECLARATION-V1.json',
};
const git=(...args)=>cp.execFileSync('git',args,{cwd:ROOT,encoding:'utf8'}).trim();
const read=(file)=>JSON.parse(fs.readFileSync(path.join(ROOT,file),'utf8'));
const exact=(value,expected,code)=>assert.deepEqual(value,expected,code);
const bool=(value,field,expected)=>assert.equal(value[field],expected,`S5_FORMAL_${field.toUpperCase()}`);
function write(value){fs.mkdirSync(path.dirname(OUT),{recursive:true});fs.writeFileSync(OUT,`${JSON.stringify(value,null,2)}\n`);}

try {
  const base=String(process.env.MCFT_BASE_SHA||BASE).trim();
  assert.equal(base,BASE,'S5_FORMAL_BASE_MISMATCH');
  assert.equal(git('merge-base',base,'HEAD'),base,'S5_FORMAL_BASE_NOT_ANCESTOR');
  assert.equal(git('diff','--check',`${base}...HEAD`),'','S5_FORMAL_DIFF_CHECK');
  const changed=git('diff','--name-only',`${base}...HEAD`).split(/\r?\n/).filter(Boolean).sort();
  exact(changed,[...EXPECTED].sort(),'S5_FORMAL_CHANGED_FILE_BOUNDARY');
  assert.equal(changed.length,21,'S5_FORMAL_CHANGED_FILE_COUNT');
  assert.equal(git('rev-parse',`HEAD:${P.taskbook}`),'a24114ff629560345b3bd3cda6b4024b9f3d61e4');
  assert.equal(git('rev-parse',`HEAD:${P.contract}`),'ff682f21692859c8121c89611cec561ff491cfb8');
  for (const frozen of [P.registry,P.s6,P.frontier]) {
    assert.equal(git('rev-parse',`HEAD:${frozen}`),git('rev-parse',`${base}:${frozen}`),`S5_FORMAL_FROZEN_FILE:${frozen}`);
  }
  assert.equal(changed.some((f)=>f.includes('migration')||f.startsWith('apps/web/')||f.includes('/routes/')||f.includes('scheduler')),false,'S5_FORMAL_PRODUCT_BOUNDARY');

  const boundary=read(P.boundary),status=read(P.status),pred=read(P.predecessor),impl=read(P.implementation),workflows=read(P.workflows);
  exact(boundary.changed_files,EXPECTED,'S5_FORMAL_BOUNDARY_FILE_LIST');
  assert.equal(boundary.base_sha,base);
  assert.equal(boundary.changed_file_count,21);
  assert.equal(boundary.runtime_source_file_count,9);
  assert.equal(boundary.runtime_acceptance_file_count,2);
  assert.equal(boundary.database_migration_file_count,0);
  bool(boundary,'candidate_declaration_required',true);
  bool(boundary,'s5_candidate_implemented',true);
  bool(boundary,'s5_effective',false);
  bool(boundary,'s6_authorized',false);

  assert.equal(status.record_status,'FORMAL_S5_CANDIDATE_IMPLEMENTED_NOT_EFFECTIVE');
  assert.equal(status.delivery_state,'CANDIDATE_IMPLEMENTED_NOT_EFFECTIVE');
  bool(status,'s5_candidate_implemented',true);
  bool(status,'implementation_authorized',true);
  bool(status,'runtime_source_authorized',true);
  bool(status,'bounded_canonical_transaction_authorized',true);
  bool(status,'independent_review_required',false);
  bool(status,'independent_review_satisfied',false);
  bool(status,'independent_review_performed',false);
  bool(status,'independent_review_waived',true);
  bool(status,'technical_gate_relaxation',false);
  bool(status,'final_s6_independent_review_required',true);
  assert.equal(status.residual_count_expected,24);
  assert.equal(status.calibration_case_count_expected,16);
  assert.equal(status.objective_case_count_expected,15);
  assert.equal(status.diagnostic_only_case_count_expected,1);
  assert.equal(status.holdout_case_count_expected,8);
  assert.equal(status.calibration_candidate_count_expected,1);
  assert.equal(status.shadow_evaluation_count_expected,1);
  assert.equal(status.model_activation_count_expected,0);
  assert.equal(status.active_runtime_config_switch_count_expected,0);
  bool(status,'residual_calibration_shadow_authorized',true);
  bool(status,'production_runtime_source_authorized',false);
  bool(status,'s5_effective',false);
  bool(status,'s6_authorized',false);
  bool(status,'mcft_cap_09_authorized',false);

  assert.equal(pred.record_status,'REPLAY_DATASET_V2_PREQUALIFICATION_EFFECTIVENESS_CONSUMED');
  assert.equal(pred.source_merge_subject_sha,'b94d299851744f589d3c3a6e35111a22c17c79d0');
  assert.equal(pred.source_exact_sha_workflow_run_id,'30193754069');
  assert.equal(pred.source_artifact_id,'8629453895');
  assert.equal(pred.source_artifact_digest,'sha256:14441ad429a875ef5ab713cb3972a37d77f04dcdc9d14c5d810926eeb4e2fed8');
  assert.equal(pred.source_semantic_artifact_digest,'sha256:e9df0575852aecdc66ce1271a7c4cec551e01997dbb8f886a9353844a5799f55');
  assert.equal(pred.source_database_semantic_digest,'sha256:fd19dd2638b8844adfb18f9f78bcc19bf4bcbf010485300667136aad05a53636');
  bool(pred,'source_artifact_readback_verified',true);
  bool(pred,'source_locked_version_delete_denied',true);
  bool(pred,'predecessor_effectiveness_satisfied',true);
  bool(pred,'implementation_entry_authorized',true);
  bool(pred,'formal_candidate_authorized',true);

  assert.equal(impl.record_status,'FORMAL_S5_CANDIDATE_IMPLEMENTED_NOT_EFFECTIVE');
  assert.equal(impl.base_sha,base);
  assert.equal(impl.preflight_provenance.head_sha,'62c77da3634997f32f1f5840a813344c1f7ff483');
  assert.equal(impl.preflight_provenance.workflow_run_id,'30196732745');
  assert.equal(impl.preflight_provenance.artifact_id,'8630347607');
  assert.equal(impl.formal_oracle.residual_count,24);
  assert.equal(impl.formal_oracle.calibration_case_count,16);
  assert.equal(impl.formal_oracle.objective_case_count,15);
  assert.equal(impl.formal_oracle.diagnostic_only_case_count,1);
  exact(impl.formal_oracle.diagnostic_only_observation_refs,['FVO-10'],'S5_FORMAL_FVO10_POLICY');
  assert.equal(impl.formal_oracle.holdout_case_count,8);
  assert.equal(impl.formal_oracle.grid_point_count,21);
  assert.equal(impl.formal_oracle.candidate_parameter_value,'0.034000');
  assert.equal(impl.formal_oracle.sensitive_case_count,7);
  exact(impl.formal_oracle.sensitive_wetness_regimes,['HIGH_EXCESS','MID_EXCESS'],'S5_FORMAL_SENSITIVE_REGIMES');
  assert.equal(impl.formal_oracle.candidate_ref,'twin_calibration_candidate_17643469dcc3562b0b99f4d2');
  assert.equal(impl.formal_oracle.candidate_hash,'sha256:56b12214f5c41310f38ce97b8256651aa76ffcd3b0621a1f79b56bbcad42b86a');
  assert.equal(impl.formal_oracle.shadow_ref,'twin_shadow_evaluation_7cd3b55e0633267e790e05c5');
  assert.equal(impl.formal_oracle.shadow_hash,'sha256:faf7fd5f6856ea008db3e960e82712040feb76d82d4ab2912365805d7ac3cbbd');
  assert.equal(impl.persistence_oracle.model_activation_count,0);
  assert.equal(impl.persistence_oracle.active_runtime_config_switch_count,0);
  bool(impl,'production_runtime_source_authorized',false);
  bool(impl,'s5_effective',false);
  bool(impl,'s6_authorized',false);

  assert.equal(workflows.record_status,'FORMAL_CANDIDATE_WORKFLOWS_PRESENT_NOT_EFFECTIVE');
  bool(workflows.governance_workflow,'formal_candidate_delegation_present',true);
  bool(workflows.candidate_workflow,'present_in_formal_candidate',true);
  bool(workflows.candidate_workflow,'candidate_declaration_required',true);
  bool(workflows.candidate_workflow,'runs_15_objective_1_diagnostic_proof',true);
  bool(workflows.exact_sha_workflow,'present_in_formal_candidate',true);
  assert.equal(workflows.exact_sha_workflow.status_context,'mcft-cap-08/s5-exact-sha-attestation');
  exact(workflows.required_pull_request_workflows,['mcft-cap-08-s5-residual-calibration-shadow','ci'],'S5_FORMAL_REQUIRED_WORKFLOWS');

  const source=changed.map((file)=>fs.readFileSync(path.join(ROOT,file),'utf8')).join('\n');
  for (const token of ['runCap08S5ObjectiveGridSearchV1','validateCap08S5V2PrequalificationEvidenceV1','diagnostic_only_observation_refs: ["FVO-10"]','model_activation_count: 0','active_runtime_config_switch_count: 0']) {
    assert.equal(source.includes(token),true,`S5_FORMAL_TOKEN:${token}`);
  }
  const result={
    schema_version:'geox_mcft_cap08_s5_formal_candidate_boundary_result_v1',
    status:'PASS',base_sha:base,subject_sha:git('rev-parse','HEAD'),
    changed_file_count:changed.length,changed_files:changed,
    predecessor_subject_sha:pred.source_merge_subject_sha,
    candidate_parameter_value:impl.formal_oracle.candidate_parameter_value,
    candidate_ref:impl.formal_oracle.candidate_ref,
    shadow_ref:impl.formal_oracle.shadow_ref,
    owner_review_waived:true,s5_effective:false,s6_authorized:false,
    production_runtime_source_authorized:false,mcft_cap_09_authorized:false
  };
  write(result);console.log(JSON.stringify(result));
} catch(error) {
  write({schema_version:'geox_mcft_cap08_s5_formal_candidate_boundary_result_v1',status:'FAIL',error:error instanceof Error?error.message:String(error)});
  console.error(error);process.exitCode=1;
}
