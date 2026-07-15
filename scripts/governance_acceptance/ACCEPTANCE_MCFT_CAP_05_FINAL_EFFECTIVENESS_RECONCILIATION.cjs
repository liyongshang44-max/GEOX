#!/usr/bin/env node
'use strict';
const cp = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '../..');
const BASE = '49e282cdc91cb8a0aba177dc1099239e5155994b';
const MODE = process.argv.includes('--candidate') ? 'candidate' : process.argv.includes('--postmerge') ? 'postmerge' : 'auto';
const TASK = 'docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-TASK.md';
const CLOSURE = 'docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-CLOSURE-RECORD.json';
const EFFECT = 'docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-FINALIZATION-EFFECTIVENESS.json';
const RECON = 'docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-FINAL-EFFECTIVENESS-RECONCILIATION.json';
const GATE = 'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_05_FINAL_EFFECTIVENESS_RECONCILIATION.cjs';
const PRIOR_RECON_FILES = [EFFECT, RECON, 'scripts/dev/assert_local_pnpm_runtime.cjs', GATE].sort();
const HYGIENE_FILES = [TASK, CLOSURE, EFFECT, RECON, GATE].sort();
let pass = 0;
let fail = 0;
const check = (condition, label) => {
  if (condition) { pass += 1; console.log(`PASS ${label}`); }
  else { fail += 1; console.error(`FAIL ${label}`); }
};
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const json = (p) => JSON.parse(read(p));
const same = (a, b) => JSON.stringify([...(a || [])].sort()) === JSON.stringify([...b].sort());
const noPending = (value) => !JSON.stringify(value).includes('PENDING');
const validationPass = (value) => value?.state === 'SUCCESS'
  && value?.candidate_state === 'SUCCESS'
  && value?.governance_gate === 'PASS'
  && value?.repository_typecheck === 'PASS'
  && value?.repository_build === 'PASS'
  && value?.server_selfcheck === 'PASS'
  && value?.standard_acceptance === 'PASS'
  && value?.commercial_mvp0_release_gate === 'PASS';

const task = read(TASK);
const closure = json(CLOSURE);
const effect = json(EFFECT);
const recon = json(RECON);
const verification = json('docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-MAIN-VERIFICATION.json');
const auth = json('docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-AUTHORIZATION-STATUS.json');
const delivery = json('docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-DELIVERY-SLICE-STATUS.json');
const matrix = json('docs/digital_twin/GEOX-MCFT-VERTICAL-CAPABILITY-LINE-MATRIX.json');
const cap = matrix.capability_lines.find((x) => x.capability_line_id === 'MCFT-CAP-05');

check(task.includes('implementation_status:\nCOMPLETE'), 'task implementation COMPLETE');
check(task.includes('active_delivery_slice_id:\nnull'), 'task active delivery slice null');
check(task.includes('next_repository_action:\nnull'), 'task next repository action null');
check(!task.includes('first_permitted_repository_action:'), 'task stale permitted action removed');
check(task.includes('S11C 已将冻结的 40 项完成声明'), 'task lifecycle summary uses completed tense');

check(closure.lifecycle_stage === 'S11C_COMPLETE_AND_RECONCILED', 'Closure Record lifecycle reconciled');
check(closure.status === 'COMPLETE' && closure.implementation_status === 'COMPLETE', 'Closure Record COMPLETE');
check(closure.closure_effective === true && closure.capability_complete === true && closure.active_delivery_slice_id === null, 'Closure Record effective and inactive');
check(!('branch' in closure) && !('pr_number' in closure), 'Closure Record mixed generic PR identity removed');
check(closure.closure_candidate_pr_number === 2488 && closure.closure_candidate_branch === 'agent/mcft-cap-05-s11a-closure-candidate-v1', 'Closure candidate identity explicit');
check(closure.completion_activation_pr_number === 2490 && closure.completion_activation_branch === 'agent/mcft-cap-05-s11c-complete-activation-v1', 'Completion activation identity explicit');
check(closure.hard_acceptance?.accumulated_evidence_status === 'SATISFIED_EFFECTIVE', 'hard acceptance effective');
check(validationPass(closure.validation) && noPending(closure.validation), 'Closure Record validation current and successful');
check(closure.current_authority?.authority_kind === 'FINAL_EFFECTIVENESS_RECONCILIATION', 'Closure Record current authority reconciled');
check(closure.current_authority?.reconciliation_merge_commit === BASE && closure.current_authority?.reconciliation_postmerge_workflow === 29411318737, 'Closure Record final evidence exact');

check(effect.lifecycle_stage === 'S11C_POSTMERGE_EFFECTIVENESS_RECONCILIATION', 'Finalization Effectiveness lifecycle reconciled');
check(effect.status === 'COMPLETE' && effect.implementation_status === 'COMPLETE', 'Finalization Effectiveness COMPLETE');
check(effect.activation_pr_number === 2490 && effect.reconciliation_pr_number === 2492, 'Finalization Effectiveness stage identities explicit');
check(!('branch' in effect) && !('pr_number' in effect), 'Finalization Effectiveness mixed generic PR identity removed');
check(validationPass(effect.validation) && noPending(effect.validation), 'Finalization Effectiveness validation current and successful');
check(effect.pending_completion_claims.length === 0 && effect.effective_completion_claims.length === 40, 'Finalization Effectiveness claims exact');
check(effect.successor_authorized === false, 'Finalization Effectiveness keeps CAP-06 unauthorized');

check(recon.status === 'MERGED_EFFECTIVE' && recon.effectiveness_condition_satisfied === true, 'Final Reconciliation merged effective');
check(recon.effective_main_commit === BASE, 'Final Reconciliation effective main exact');
check(validationPass(recon.validation) && noPending(recon.validation), 'Final Reconciliation validation successful');
check(recon.reconciliation_effectiveness?.reconciliation_pr_number === 2492, 'Final Reconciliation PR exact');
check(recon.reconciliation_effectiveness?.reconciliation_exact_head === '29a407163eb6121a4ebdee50a666f87cff0af032', 'Final Reconciliation exact head frozen');
check(recon.reconciliation_effectiveness?.reconciliation_exact_head_ci_run === 29410897504, 'Final Reconciliation exact-head CI frozen');
check(recon.reconciliation_effectiveness?.reconciliation_merge_commit === BASE, 'Final Reconciliation merge frozen');
check(recon.reconciliation_effectiveness?.postmerge_probe_pr_number === 2493 && recon.reconciliation_effectiveness?.postmerge_probe_workflow_run === 29411318737, 'Final Reconciliation postmerge proof frozen');
check(recon.reconciliation_effectiveness?.postmerge_gate === 'PASS' && recon.reconciliation_effectiveness?.effectiveness_preconditions_satisfied === true, 'Final Reconciliation postmerge effective');
check(recon.runtime_source_authorized === false && recon.successor_authorized === false, 'Final Reconciliation grants no Runtime or CAP-06 authority');

check(same(effect.exact_changed_file_boundary, PRIOR_RECON_FILES) && same(recon.exact_changed_file_boundary, PRIOR_RECON_FILES), 'historical four-file reconciliation boundary preserved');
for (const object of [closure, verification, auth, delivery, cap]) {
  check(object.closure_effective === true || object.capability_complete === true || object.status === 'COMPLETE', 'cross-SSOT COMPLETE state retained');
}
check(closure.active_delivery_slice_id === null && verification.active_delivery_slice_id === null && auth.active_delivery_slice_id === null && delivery.active_delivery_slice_id === null && cap.active_delivery_slice_id === null, 'cross-SSOT active slice cleared');
check(auth.successor_authorized === false && delivery.successor_authorized === false && cap.successor_authorized === false, 'cross-SSOT CAP-06 unauthorized');
check(!HYGIENE_FILES.some((f) => f.startsWith('apps/server/src/') || f.startsWith('apps/web/') || f.includes('/migrations/')), 'hygiene boundary excludes Runtime web and migrations');

function changedFiles() {
  for (const range of [`${BASE}..HEAD`, 'HEAD^1..HEAD', 'origin/main...HEAD', 'origin/main..HEAD']) {
    try {
      return cp.execFileSync('git', ['diff', '--name-only', range], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim().split(/\r?\n/).filter(Boolean).sort();
    } catch {}
  }
  return null;
}
const changed = changedFiles();
if ((MODE === 'candidate' || MODE === 'auto') && changed && same(changed, HYGIENE_FILES)) check(true, 'exact five-file SSOT hygiene boundary');
else if (MODE === 'candidate') check(false, `candidate boundary mismatch: ${JSON.stringify(changed)}`);
else check(true, `${MODE} semantic verification accepted`);
console.log(`SUMMARY ${pass} PASS / ${fail} FAIL`);
if (fail) process.exit(1);
