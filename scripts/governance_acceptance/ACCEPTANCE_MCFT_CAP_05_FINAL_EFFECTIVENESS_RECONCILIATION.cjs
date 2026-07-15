#!/usr/bin/env node
'use strict';
const cp = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '../..');
const BASE = '9365e74ef7d4b01f7b96a7992e27270f0e42725b';
const MODE = process.argv.includes('--candidate') ? 'candidate' : process.argv.includes('--postmerge') ? 'postmerge' : 'auto';
const EFFECT = 'docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-FINALIZATION-EFFECTIVENESS.json';
const RECON = 'docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-FINAL-EFFECTIVENESS-RECONCILIATION.json';
const WRAPPER = 'scripts/dev/assert_local_pnpm_runtime.cjs';
const GATE = 'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_05_FINAL_EFFECTIVENESS_RECONCILIATION.cjs';
const FILES = [EFFECT, RECON, WRAPPER, GATE].sort();
let pass = 0;
let fail = 0;
const check = (condition, label) => {
  if (condition) { pass += 1; console.log(`PASS ${label}`); }
  else { fail += 1; console.error(`FAIL ${label}`); }
};
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const json = (p) => JSON.parse(read(p));
const same = (a, b) => JSON.stringify([...(a || [])].sort()) === JSON.stringify([...b].sort());
const effect = json(EFFECT);
const recon = json(RECON);
const closure = json('docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-CLOSURE-RECORD.json');
const verification = json('docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-MAIN-VERIFICATION.json');
const auth = json('docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-AUTHORIZATION-STATUS.json');
const delivery = json('docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-DELIVERY-SLICE-STATUS.json');
const matrix = json('docs/digital_twin/GEOX-MCFT-VERTICAL-CAPABILITY-LINE-MATRIX.json');
const cap = matrix.capability_lines.find((x) => x.capability_line_id === 'MCFT-CAP-05');
const evidence = effect.s11c_effectiveness;
check(effect.lifecycle_stage === 'S11C_POSTMERGE_EFFECTIVENESS_RECONCILIATION', 'effectiveness lifecycle reconciled');
check(effect.status === 'COMPLETE' && effect.implementation_status === 'COMPLETE', 'effectiveness remains COMPLETE');
check(effect.closure_effective === true && effect.capability_complete === true && effect.active_delivery_slice_id === null, 'effectiveness closure complete inactive');
check(effect.pending_completion_claims.length === 0 && effect.effective_completion_claims.length === 40, 'effectiveness claims 0 pending 40 effective');
check(effect.successor_authorized === false, 'effectiveness keeps CAP-06 unauthorized');
check(evidence.activation_pr_number === 2490 && evidence.activation_exact_head === '4ca11c7740413b0940949c7aa49579b4c4cd0bc8', 'activation PR and exact head frozen');
check(evidence.activation_exact_head_ci_run === 29409622048 && evidence.activation_merge_commit === BASE, 'activation CI and merge frozen');
check(evidence.head_to_merge_file_delta_count === 0 && evidence.head_to_merge_tree_equivalence === 'PASS', 'activation tree equivalence frozen');
check(evidence.postmerge_probe_pr_number === 2491 && evidence.postmerge_probe_workflow_run === 29410067946, 'final probe PR and workflow frozen');
check(evidence.postmerge_gate === 'PASS' && evidence.postmerge_gate_subject_commit === BASE, 'final postmerge Gate frozen');
check(evidence.postmerge_probe_closed_without_merge === true && evidence.effectiveness_preconditions_satisfied === true, 'probe disposition and preconditions frozen');
check(recon.status === 'IMPLEMENTATION_CANDIDATE' || recon.status === 'MERGED_EFFECTIVE', 'reconciliation lifecycle recognized');
check(recon.capability_status === 'COMPLETE' && recon.implementation_status === 'COMPLETE', 'reconciliation preserves COMPLETE');
check(recon.pending_completion_claim_count === 0 && recon.effective_completion_claim_count === 40, 'reconciliation claims exact');
check(recon.runtime_source_authorized === false && recon.successor_authorized === false, 'reconciliation grants no Runtime or CAP-06 authority');
check(same(effect.exact_changed_file_boundary, FILES) && same(recon.exact_changed_file_boundary, FILES), 'four-file reconciliation boundary frozen');
for (const object of [closure, verification, auth, delivery, cap]) {
  check(object.closure_effective === true || object.capability_complete === true || object.status === 'COMPLETE', 'cross-SSOT COMPLETE state retained');
}
check(closure.active_delivery_slice_id === null && verification.active_delivery_slice_id === null && auth.active_delivery_slice_id === null && delivery.active_delivery_slice_id === null && cap.active_delivery_slice_id === null, 'cross-SSOT active slice cleared');
check(auth.successor_authorized === false && delivery.successor_authorized === false && cap.successor_authorized === false, 'cross-SSOT CAP-06 unauthorized');
check(read(WRAPPER).includes('ACCEPTANCE_MCFT_CAP_05_FINAL_EFFECTIVENESS_RECONCILIATION.cjs'), 'standard wrapper wired to reconciliation Gate');
const forbidden = FILES.some((f) => f.startsWith('apps/server/src/') || f.startsWith('apps/web/') || f.includes('/migrations/'));
check(!forbidden, 'boundary excludes Runtime web and migrations');
function changedFiles() {
  for (const range of [`${BASE}..HEAD`, 'HEAD^1..HEAD', 'origin/main...HEAD', 'origin/main..HEAD']) {
    try {
      return cp.execFileSync('git', ['diff', '--name-only', range], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim().split(/\r?\n/).filter(Boolean).sort();
    } catch {}
  }
  return null;
}
const changed = changedFiles();
if (MODE === 'candidate') check(same(changed, FILES), 'candidate exact four-file boundary');
else if (MODE === 'auto' && changed && same(changed, FILES)) check(true, 'auto recognizes four-file candidate');
else if (MODE === 'auto' || MODE === 'postmerge') check(true, `${MODE} semantic verification accepted`);
console.log(`SUMMARY ${pass} PASS / ${fail} FAIL`);
if (fail) process.exit(1);
