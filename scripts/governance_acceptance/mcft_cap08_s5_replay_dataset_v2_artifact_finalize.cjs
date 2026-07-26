#!/usr/bin/env node
// Purpose: finalize the exact merge-SHA R1 authority artifact for replay-dataset v2 prequalification.
// Boundary: artifact identity and immutable retention metadata only; no Runtime, Candidate, Shadow, activation, or repository authority mutation.

const fs = require('node:fs');
const crypto = require('node:crypto');
const cp = require('node:child_process');

const out = 'acceptance-output/MCFT_CAP_08_S5_REPLAY_DATASET_V2_AUTHORITY_ARTIFACT.json';
const result = JSON.parse(fs.readFileSync('acceptance-output/MCFT_CAP_08_S5_REPLAY_DATASET_V2_PREQUALIFICATION_RESULT.json','utf8'));
const git = (...args) => cp.execFileSync('git',args,{encoding:'utf8'}).trim();
const subject = process.env.MCFT_SUBJECT_SHA || git('rev-parse','HEAD');
const parents = git('rev-list','--parents','-n','1',subject).split(/\s+/);
if (parents.length !== 3) throw new Error(`CAP08_S5_V2_PQ_TWO_PARENT_MERGE_REQUIRED:${parents.length-1}`);
const base = parents[1];
const candidate = parents[2];
const tree = (sha) => git('rev-parse',`${sha}^{tree}`);
const candidateTree = tree(candidate);
const subjectTree = tree(subject);
if (candidateTree !== subjectTree) throw new Error('CAP08_S5_V2_PQ_TREE_MISMATCH');
if (result.status !== 'PASS' || result.eligibility_aware_surface?.selected_parameter_value !== '0.034000' || result.eligibility_aware_surface?.canonical_append_allowed !== true) {
  throw new Error('CAP08_S5_V2_PQ_DB_RESULT_NOT_EFFECTIVE');
}

const implementationParents = git('rev-list','--parents','-n','1',base).split(/\s+/);
if (implementationParents.length !== 3) {
  throw new Error(`CAP08_S5_V2_PQ_IMPLEMENTATION_MERGE_REQUIRED:${implementationParents.length-1}`);
}
const implementationBase = implementationParents[1];
const implementationCandidate = implementationParents[2];
const implementationCandidateTree = tree(implementationCandidate);
const implementationMergeTree = tree(base);
if (implementationCandidateTree !== implementationMergeTree) {
  throw new Error('CAP08_S5_V2_PQ_IMPLEMENTATION_TREE_MISMATCH');
}

const stable = (v) => Array.isArray(v) ? v.map(stable) : v && typeof v === 'object'
  ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, stable(v[k])])) : v;
const hash = (v) => `sha256:${crypto.createHash('sha256').update(JSON.stringify(stable(v))).digest('hex')}`;
const semantic = {
  schema_version: 'geox_mcft_cap08_s5_replay_dataset_v2_authority_artifact_v1',
  status: 'PASS',
  capability_line_id: 'MCFT-CAP-08',
  slice_id: 'MCFT-CAP-08.S5-PQ',
  action_id: 'MCFT_CAP_08_S5_REPLAY_DATASET_V2_PREQUALIFICATION',
  subject_sha: subject,
  base_head_sha: base,
  candidate_head_sha: candidate,
  candidate_tree_sha: candidateTree,
  merge_tree_sha: subjectTree,
  candidate_to_merge_tree_delta: 0,
  prequalification_implementation_subject_sha: base,
  prequalification_implementation_base_sha: implementationBase,
  prequalification_implementation_candidate_sha: implementationCandidate,
  prequalification_implementation_candidate_tree_sha: implementationCandidateTree,
  prequalification_implementation_merge_tree_sha: implementationMergeTree,
  prequalification_implementation_tree_delta: 0,
  retention_metadata_hotfix_candidate_sha: candidate,
  workflow_run_id: Number(process.env.GITHUB_RUN_ID || 0),
  workflow_run_attempt: Number(process.env.GITHUB_RUN_ATTEMPT || 0),
  database_result_semantic_digest: result.semantic_digest,
  database_result_digest: hash(result),
  residual_count: result.residual_count,
  calibration_case_count: result.calibration_case_count,
  holdout_case_count: result.holdout_case_count,
  objective_case_count: result.objective_case_count,
  diagnostic_only_case_count: result.diagnostic_only_case_count,
  selected_parameter_value: result.eligibility_aware_surface.selected_parameter_value,
  selected_parameter_delta: result.eligibility_aware_surface.selected_parameter_delta,
  sensitive_case_count: result.eligibility_aware_surface.excitation_summary.sensitive_case_count,
  sensitive_wetness_regimes: result.eligibility_aware_surface.excitation_summary.represented_sensitive_wetness_regimes,
  candidate_append_count: 0,
  shadow_append_count: 0,
  model_activation_count: 0,
  active_runtime_config_switch_count: 0,
  retention_class: 'R1_180_DAYS',
  effective_delivery_frontier_projection: {
    effective_status: 'REPLAY_DATASET_V2_PREQUALIFICATION_EFFECTIVE',
    next_legal_action: 'MCFT_CAP_08_S5_FORMAL_CANDIDATE_FROM_EXACT_REQUALIFIED_MAIN',
    s5_formal_candidate_authorized_by_external_attestation: true,
    s5_candidate_implemented: false,
    s5_effective: false,
    s6_implementation_authorized: false,
    mcft_cap_09_authorized: false
  },
  production_runtime_source_authorized: false,
  candidate_transition: false
};
const artifact = { ...semantic, semantic_artifact_digest: hash(semantic) };
fs.mkdirSync('acceptance-output',{recursive:true});
fs.writeFileSync(out, `${JSON.stringify(artifact,null,2)}\n`);
console.log(JSON.stringify(artifact,null,2));
