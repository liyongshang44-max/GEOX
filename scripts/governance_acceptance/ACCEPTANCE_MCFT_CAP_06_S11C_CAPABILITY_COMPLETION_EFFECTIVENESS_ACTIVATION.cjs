// Purpose: validate the S11C capability-completion effectiveness activation candidate without activating claims before merged-main effectiveness.
// Boundary: governance only; no Runtime execution, Model Activation, canonical/projection write, migration, S11D reconciliation or CAP-07 authority.

'use strict';
const assert = require('node:assert/strict');
const cp = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const OUTPUT_DIR = path.join(ROOT, 'acceptance-output');
const RESULT_PATH = path.join(OUTPUT_DIR, 'MCFT_CAP_06_S11C_ACTIVATION_RESULT.json');
const BASE = '00476d1ca9ec33f01ad58555f54daa5d582580f9';
const S11C = 'MCFT-CAP-06.CAPABILITY-COMPLETION-EFFECTIVENESS-ACTIVATION-V1';
const EXPECTED_FILES = [
  '.github/workflows/mcft-cap-06-s11a-closure-candidate.yml',
  '.github/workflows/mcft-cap-06-s11c-capability-completion-effectiveness-activation.yml',
  'docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-CLOSURE-RECORD.json',
  'docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-CURRENT-DELIVERY-AUTHORITY-V2.json',
  'docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-MAIN-VERIFICATION.json',
  'docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-S11A-CLOSURE-CANDIDATE-STATUS.json',
  'docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-S11C-CAPABILITY-COMPLETION-EFFECTIVENESS-ACTIVATION-STATUS.json',
  'docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-TASKBOOK-MANIFEST.json',
  'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_06_S11C_CAPABILITY_COMPLETION_EFFECTIVENESS_ACTIVATION.cjs',
];
const FORBIDDEN = ['apps/server/src/','apps/server/scripts/','apps/server/db/migrations/','apps/web/','scripts/runtime_acceptance/','fixtures/','docker/'];
const ZERO_KEYS = ['canonical_fact_append_count','canonical_fact_update_count','canonical_fact_delete_count','candidate_append_count','evaluation_append_count','projection_write_count','model_activation_count','active_config_switch_count','runtime_parameter_change_count','state_mutation_count','checkpoint_mutation_count','migration_count'];

function git(args) { return cp.execFileSync('git', args, {cwd: ROOT, encoding:'utf8'}).trim(); }
function json(p) { return JSON.parse(fs.readFileSync(path.join(ROOT,p),'utf8')); }
function text(p) { return fs.readFileSync(path.join(ROOT,p),'utf8'); }
function write(r) { fs.mkdirSync(OUTPUT_DIR,{recursive:true}); fs.writeFileSync(RESULT_PATH, JSON.stringify(r,null,2)+'\n'); }
function zero(delta,label) { for (const k of ZERO_KEYS) assert.equal(delta[k],0,`${label}_${k}_NONZERO`); }
function taskbookClaims() {
  const source = text('docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-TASK.md');
  const start = source.indexOf('# 45. Completion Claims Candidate');
  const end = source.indexOf('# 46. Closure lifecycle', start);
  assert.ok(start >= 0 && end > start);
  const m = source.slice(start,end).match(/```text\s*\n([\s\S]*?MCFT_CAP_07_REMAINS_UNAUTHORIZED[\s\S]*?)```/);
  assert.ok(m);
  return m[1].split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
}

function main() {
  const baseline = String(process.env.MCFT_CAP_06_S11C_BASE_REF || BASE).trim();
  git(['cat-file','-e',`${baseline}^{commit}`]);
  const head = git(['rev-parse','HEAD']);
  const raw = git(['diff','--name-only',`${baseline}...HEAD`]);
  const changed = raw ? raw.split(/\r?\n/).filter(Boolean).sort() : [];
  assert.deepEqual(changed,[...EXPECTED_FILES].sort(),'S11C_CHANGED_FILE_BOUNDARY_INVALID');
  assert.equal(changed.some(f=>FORBIDDEN.some(p=>f.startsWith(p))),false,'S11C_RUNTIME_OR_MIGRATION_FILE_CHANGED');

  const closure = json('docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-CLOSURE-RECORD.json');
  const verification = json('docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-MAIN-VERIFICATION.json');
  const s11a = json('docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-S11A-CLOSURE-CANDIDATE-STATUS.json');
  const status = json('docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-S11C-CAPABILITY-COMPLETION-EFFECTIVENESS-ACTIVATION-STATUS.json');
  const frontier = json('docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-CURRENT-DELIVERY-AUTHORITY-V2.json');
  const manifest = json('docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-TASKBOOK-MANIFEST.json');
  const ledger = json('docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-HARD-ACCEPTANCE-EVIDENCE-LEDGER.json');
  const claims = taskbookClaims();
  const frozenS11A = text('.github/workflows/mcft-cap-06-s11a-closure-candidate.yml');

  assert.equal(claims.length,48);
  assert.equal(ledger.total_check_count,255);
  assert.deepEqual(ledger.status_counts,{PASS:255,FAIL:0,NOT_APPLICABLE:0});
  assert.equal(frozenS11A.includes('00476d1ca9ec33f01ad58555f54daa5d582580f9'),true);
  assert.equal(frozenS11A.includes('s11a_implementation_merged'),true);

  assert.equal(status.status,'CAPABILITY_COMPLETION_EFFECTIVENESS_ACTIVATION_CANDIDATE');
  assert.equal(status.implementation_status,'COMPLETE_CANDIDATE');
  assert.equal(status.activation_candidate_pr_number,2587);
  assert.equal(status.s11a_implementation_merged,true);
  assert.equal(status.s11a_merged_main_proven,true);
  assert.equal(status.s11b_finalization_gate_passed,true);
  assert.equal(status.s11c_candidate_implemented,true);
  assert.equal(status.s11c_implementation_merged,false);
  assert.equal(status.s11c_merged_main_proven,false);
  assert.equal(status.s11d_authorized,false);
  assert.equal(status.pending_completion_claim_count,48);
  assert.equal(status.effective_completion_claim_count,0);
  assert.equal(status.closure_effective,false);
  assert.equal(status.closure_effective_status,'PENDING_MERGE_EFFECTIVENESS');
  assert.equal(status.capability_complete,false);
  assert.equal(status.capability_complete_status,'PENDING_MERGE_EFFECTIVENESS');
  assert.equal(status.unknown_s11c_merge_or_postmerge_evidence_recorded,false);
  assert.equal(status.runtime_source_authorized,false);
  assert.equal(status.successor_capability_line_authorized,false);
  zero(status.runtime_delta,'S11C_STATUS');

  assert.equal(closure.delivery_slice_id,S11C);
  assert.equal(closure.status,'CAPABILITY_COMPLETION_EFFECTIVENESS_ACTIVATION_CANDIDATE');
  assert.equal(closure.implementation_status,'COMPLETE_CANDIDATE');
  assert.equal(closure.activation_candidate_pr_number,null);
  assert.deepEqual(closure.pending_completion_claims,claims);
  assert.deepEqual(closure.effective_completion_claims,[]);
  assert.equal(closure.closure_effective,false);
  assert.equal(closure.capability_complete,false);
  assert.equal(closure.s11b_finalization_evidence.finalization_gate,'PASS');
  assert.equal(closure.finalization_evidence.s11c_activation_exact_head,null);
  assert.equal(closure.finalization_evidence.s11c_activation_merge_commit,null);
  assert.equal(closure.finalization_evidence.s11c_postmerge_workflow_run,null);
  assert.equal(closure.unknown_s11c_merge_or_postmerge_evidence_recorded,false);
  assert.equal(closure.runtime_source_authorized,false);
  assert.equal(closure.successor_authorized,false);
  assert.deepEqual([...closure.exact_changed_file_boundary].sort(),[...EXPECTED_FILES].sort());

  assert.equal(verification.delivery_slice_id,S11C);
  assert.equal(verification.status,'CAPABILITY_COMPLETION_EFFECTIVENESS_ACTIVATION_CANDIDATE');
  assert.equal(verification.implementation_status,'COMPLETE_CANDIDATE');
  assert.equal(verification.activation_candidate_pr_number,null);
  assert.equal(verification.current_slice.closure_effective,false);
  assert.equal(verification.current_slice.capability_complete,false);
  assert.equal(verification.completion_claims.pending_count,48);
  assert.equal(verification.completion_claims.effective_count,0);
  assert.deepEqual(verification.completion_claims.effective,[]);
  assert.equal(verification.s11c_unknown_evidence.exact_head,null);
  assert.equal(verification.s11c_unknown_evidence.merge_commit,null);
  assert.equal(verification.s11c_unknown_evidence.postmerge_workflow_run,null);
  assert.equal(verification.runtime_source_authorized,false);
  assert.equal(verification.successor_authorized,false);

  assert.equal(s11a.s11a_implementation_merged,true);
  assert.equal(s11a.s11a_merged_main_proven,true);
  assert.equal(s11a.s11b_finalization_gate_passed,true);
  assert.equal(s11a.s11c_candidate_implemented,true);
  assert.equal(s11a.s11c_implementation_merged,false);
  assert.equal(s11a.s11d_authorized,false);
  zero(s11a.runtime_delta,'S11A_STATUS');

  assert.equal(frontier.active_delivery_slice_id,S11C);
  assert.equal(frontier.s11c_candidate.activation_candidate_pr_number,null);
  assert.equal(frontier.s11c_candidate.pending_completion_claim_count,48);
  assert.equal(frontier.s11c_candidate.effective_completion_claim_count,0);
  assert.equal(frontier.s11c_candidate.unknown_merge_or_postmerge_evidence_recorded,false);
  assert.equal(frontier.implementation_state.s11c_candidate_implemented,true);
  assert.equal(frontier.implementation_state.s11c_implementation_merged,false);
  assert.equal(frontier.implementation_state.s11d_authorized,false);
  zero(frontier.runtime_delta,'FRONTIER');

  assert.equal(manifest.execution_control.active_delivery_slice_id,S11C);
  assert.equal(manifest.s11a.implementation_merged,true);
  assert.equal(manifest.s11a.merged_main_proven,true);
  assert.equal(manifest.s11b.finalization_gate,'PASS');
  assert.equal(manifest.s11c.activation_candidate_pr_number,null);
  assert.equal(manifest.s11c.candidate_implemented,true);
  assert.equal(manifest.s11c.implementation_merged,false);
  assert.equal(manifest.s11c.pending_completion_claim_count,48);
  assert.equal(manifest.s11c.effective_completion_claim_count,0);
  assert.equal(manifest.s11c.unknown_merge_or_postmerge_evidence_recorded,false);
  assert.equal(manifest.s11d_authorized,false);
  assert.equal(manifest.successor_capability_line_authorized,false);

  const result = {
    schema_version:'geox_mcft_cap_06_s11c_activation_result_v1',
    status:'PASS', baseline, exact_head:head,
    changed_file_count:changed.length, changed_files:changed,
    hard_acceptance_total_check_count:255,
    pending_completion_claim_count:48,
    effective_completion_claim_count:0,
    activation_status:status.status,
    implementation_status:status.implementation_status,
    closure_effective:false,
    capability_complete:false,
    s11d_authorized:false,
    runtime_source_authorized:false,
    successor_capability_line_authorized:false,
    unknown_s11c_merge_or_postmerge_evidence_recorded:false,
    runtime_delta:status.runtime_delta
  };
  write(result);
  console.log(JSON.stringify(result,null,2));
}
try { main(); } catch (e) {
  const r={schema_version:'geox_mcft_cap_06_s11c_activation_result_v1',status:'FAIL',error:e instanceof Error?e.message:String(e),closure_effective:false,capability_complete:false,s11d_authorized:false,successor_capability_line_authorized:false};
  write(r); console.error(JSON.stringify(r,null,2)); process.exitCode=1;
}
