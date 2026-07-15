// scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_05_S10_SETTLEMENT.cjs
// Purpose: verify S10 merged-main effectiveness settlement and explicit governance-only authorization of S11 closure/finalization.
// Boundary: governance and repository-shape checks only; no Runtime execution authority, canonical write path, closure completion, successor authorization or model activation.

'use strict';

const fs = require('node:fs');
const { execFileSync } = require('node:child_process');

const BASELINE = '0c015bad3eb1729000d7f68eb08e00de6ef4afcf';
const S10 = 'MCFT-CAP-05.MCFT-04-16.BOUNDED-EIGHT-TICK-FEEDBACK-CHAIN-V1';
const S11 = 'MCFT-CAP-05.CLOSURE-AND-FINALIZATION-V1';
const ACTIVATION = 'MCFT-CAP-05.S10.SSOT-SETTLEMENT-V1';
const expectedFiles = [
  'docs/digital_twin/GEOX-DT-02-MCFT-IMPLEMENTATION-MAP.md',
  'docs/digital_twin/GEOX-MCFT-VERTICAL-CAPABILITY-LINE-MATRIX.json',
  'docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-AUTHORIZATION-STATUS.json',
  'docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-DELIVERY-SLICE-STATUS.json',
  'docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-S10-SETTLEMENT-STATUS.json',
  'docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-TASK.md',
  'scripts/dev/assert_local_pnpm_runtime.cjs',
  'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_05_S10_SETTLEMENT.cjs',
].sort();

let pass = 0;
let fail = 0;
function check(condition, label) {
  if (condition) {
    pass += 1;
    console.log(`PASS ${label}`);
  } else {
    fail += 1;
    console.error(`FAIL ${label}`);
  }
}
function read(path) { return fs.readFileSync(path, 'utf8'); }
function json(path) { return JSON.parse(read(path)); }
function changedFiles() {
  for (const range of [`${BASELINE}..HEAD`, 'HEAD^1..HEAD', 'origin/main...HEAD', 'origin/main..HEAD']) {
    try {
      return execFileSync('git', ['diff', '--name-only', range], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      }).trim().split(/\r?\n/).filter(Boolean).sort();
    } catch {
      // Continue through frozen-baseline, merge-parent and remote-main fallbacks.
    }
  }
  return null;
}

const settlement = json('docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-S10-SETTLEMENT-STATUS.json');
const s10Status = json('docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-S10-STATUS.json');
const authorization = json('docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-AUTHORIZATION-STATUS.json');
const delivery = json('docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-DELIVERY-SLICE-STATUS.json');
const matrix = json('docs/digital_twin/GEOX-MCFT-VERTICAL-CAPABILITY-LINE-MATRIX.json');
const map = read('docs/digital_twin/GEOX-DT-02-MCFT-IMPLEMENTATION-MAP.md');
const task = read('docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-TASK.md');
const wrapper = read('scripts/dev/assert_local_pnpm_runtime.cjs');
const cap = matrix.capability_lines.find((item) => item.capability_line_id === 'MCFT-CAP-05');
const deliveryS10 = delivery.slices.find((item) => item.delivery_slice_id === S10);
const deliveryS11 = delivery.slices.find((item) => item.delivery_slice_id === S11);
const matrixS10 = cap?.delivery_slices?.find((item) => item.delivery_slice_id === S10);
const matrixS11 = cap?.delivery_slices?.find((item) => item.delivery_slice_id === S11);

check(settlement.schema_version === 'geox_mcft_cap_05_s10_settlement_status_v1', 'settlement schema is exact');
check(settlement.activation_id === ACTIVATION && settlement.pr_number === 2486, 'settlement identity and PR are frozen');
check(settlement.baseline_main_commit === BASELINE, 'settlement baseline is the effective S10 main');
check(settlement.status === 'IMPLEMENTATION_CANDIDATE', 'settlement remains a candidate before merge');
check(settlement.target_state === 'S11_AUTHORIZED_NOT_STARTED', 'settlement target state is exact');
check(settlement.s10_effectiveness?.implementation_pr_number === 2483, 'S10 implementation PR is frozen');
check(settlement.s10_effectiveness?.implementation_exact_head === '2b22e209472237f198fc52fc103d5401fac9c28a', 'S10 implementation exact head is frozen');
check(settlement.s10_effectiveness?.implementation_exact_head_workflow === 29401613098, 'S10 exact-head workflow is frozen');
check(settlement.s10_effectiveness?.implementation_merge_commit === '9acfab667ea51d812fd9f644c0f6634b0e45a673', 'S10 implementation merge is frozen');
check(settlement.s10_effectiveness?.implementation_head_to_merge_file_delta_count === 0, 'S10 implementation tree equivalence is frozen');
check(settlement.s10_effectiveness?.postmerge_gate_remediation_pr_number === 2484, 'postmerge Gate remediation PR is frozen');
check(settlement.s10_effectiveness?.postmerge_gate_remediation_workflow === 29402130372, 'postmerge Gate remediation workflow is frozen');
check(settlement.s10_effectiveness?.postmerge_gate_remediation_merge_commit === BASELINE, 'effective main is the remediation merge');
check(settlement.s10_effectiveness?.merged_main_probe_pr_number === 2485, 'S10 merged-main probe PR is frozen');
check(settlement.s10_effectiveness?.merged_main_probe_exact_head === '0fb4998cef86b1c42735b8fde652b1b2cadd1d24', 'S10 merged-main probe head is frozen');
check(settlement.s10_effectiveness?.merged_main_probe_workflow === 29403060957, 'S10 merged-main probe workflow is frozen');
check(settlement.s10_effectiveness?.merged_main_probe_closed_without_merge === true, 'S10 probe is proof-only and closed without merge');
check(settlement.s10_effectiveness?.bounded_chain_runtime_acceptance === '14_PASS_0_FAIL', 'S10 fourteen-check Runtime acceptance is frozen');
check(settlement.s10_effectiveness?.standard_acceptance === 'PASS', 'S10 standard acceptance is frozen');
check(settlement.s10_effectiveness?.commercial_mvp0_release_gate === 'PASS', 'S10 Commercial MVP0 Gate is frozen');
check(settlement.s10_effectiveness?.effective === true, 'S10 effectiveness is established');

check(s10Status.status === 'IMPLEMENTATION_CANDIDATE', 'historical S10 candidate record remains immutable');
check(s10Status.validation?.candidate_workflow === 29401226732, 'S10 candidate workflow remains frozen');
check(s10Status.validation?.bounded_chain_runtime_acceptance === '14_PASS_0_FAIL', 'S10 status preserves fourteen-check proof');
check(s10Status.effectiveness_condition_satisfied === false, 'historical S10 candidate does not self-claim settlement');

check(authorization.implementation_status === 'S11_AUTHORIZED_NOT_STARTED', 'Authorization Status advances to S11 authorized-not-started');
check(authorization.active_delivery_slice_id === S11, 'Authorization Status points to S11');
check(authorization.active_authorized_slice_id === S11, 'active authorized slice is S11');
check(authorization.successor_authorized === false, 'Authorization Status keeps CAP-06 unauthorized');
check(authorization.current_blockers?.includes('S11_CLOSURE_FINALIZATION_NOT_STARTED'), 'S11 not-started blocker is explicit');
check(authorization.repository_write_scope === 'S10_EFFECTIVENESS_SETTLEMENT_AND_S11_EXPLICIT_ACTIVATION_ONLY', 'repository scope is governance-only settlement');
check(authorization.preserved_nonclaims?.includes('NO_CAP_05_COMPLETION_CLAIM'), 'CAP-05 completion remains a nonclaim');
check(authorization.preserved_nonclaims?.includes('NO_CLOSURE_FINALIZATION'), 'closure finalization remains a nonclaim');
check(authorization.preserved_nonclaims?.includes('NO_CAP_06_AUTHORIZATION'), 'CAP-06 authority remains a nonclaim');

check(delivery.status === 'S11_AUTHORIZED_NOT_STARTED', 'Delivery Status advances to S11 authorized-not-started');
check(delivery.active_delivery_slice_id === S11, 'Delivery Status points to S11');
check(delivery.runtime_source_authorized === false, 'active S11 slice has no Runtime source authority');
check(deliveryS10?.status === 'MERGED_EFFECTIVE' && deliveryS10?.implementation_started === true, 'S10 delivery slice is merged-effective');
check(deliveryS10?.effectiveness_condition_satisfied === true, 'S10 delivery effectiveness condition is satisfied');
check(deliveryS10?.exact_changed_file_boundary?.length === 8, 'S10 delivery preserves exact eight-file implementation boundary');
check(deliveryS11?.status === 'AUTHORIZED_NOT_STARTED', 'S11 delivery slice is explicitly authorized');
check(deliveryS11?.runtime_source_authorized === false, 'S11 cannot change Runtime source');
check(deliveryS11?.implementation_started === false, 'S11 implementation has not started');
check(deliveryS11?.effectiveness_condition_satisfied === true, 'S11 explicit activation condition is satisfied');

check(cap?.implementation_status === 'S11_AUTHORIZED_NOT_STARTED', 'Matrix advances implementation status to S11');
check(cap?.active_delivery_slice_id === S11, 'Matrix active delivery slice is S11');
check(cap?.next_delivery_slice_id === S11 && cap?.next_delivery_slice_authorized === true, 'Matrix authorizes only S11');
check(cap?.latest_effective_slice_id === S10 && cap?.latest_effective_main_commit === BASELINE, 'Matrix latest effective slice and main are corrected');
check(cap?.successor_authorized === false, 'Matrix keeps CAP-06 unauthorized');
check(Array.isArray(cap?.pending_completion_claims) && cap.pending_completion_claims.length === 0, 'Matrix activates no completion claims');
check(matrixS10?.status === 'MERGED_EFFECTIVE', 'Matrix S10 slice is merged-effective');
check(matrixS11?.status === 'AUTHORIZED_NOT_STARTED' && matrixS11?.runtime_source_authorized === false, 'Matrix S11 authorization is governance-only');

check(map.includes('MCFT-CAP-05 S10 Effective and S11 Explicitly Authorized'), 'implementation map records S10 settlement');
check(map.includes('S10_bounded_chain_acceptance: 14 PASS / 0 FAIL'), 'implementation map records S10 Runtime proof');
check(map.includes('CAP_05_completion_claim_effective: false'), 'implementation map preserves non-completion');
check(task.includes('S11_AUTHORIZED_NOT_STARTED'), 'Task top-level current state advances to S11');
check(task.includes('S10 SSOT Settlement — S10 Effective / S11 Closure Authorized'), 'Task records the S10 settlement');
check(task.includes('closure_finalization_executed:\nfalse'), 'Task states closure was not executed');
check(task.includes('CAP_06_authorized:\nfalse'), 'Task keeps CAP-06 unauthorized');
check(wrapper.includes('ACCEPTANCE_MCFT_CAP_05_S10_SETTLEMENT.cjs'), 'standard acceptance permanently wires the S10 settlement Gate');
check(wrapper.includes('s10SettlementActive && !cap05ClosureActive'), 'wrapper retires static settlement Gate only after canonical closure materializes');

check(settlement.canonical_object_type_delta === 0, 'settlement adds no canonical object type');
check(settlement.transaction_family_delta === 0, 'settlement adds no transaction family');
check(settlement.migration_delta === 0, 'settlement adds no migration');
check(settlement.runtime_source_delta === 0, 'settlement adds no Runtime source');
check(settlement.public_route_delta === 0 && settlement.web_delta === 0 && settlement.scheduler_delta === 0, 'settlement adds no route, web or scheduler');
check(settlement.completion_claim_delta === 0, 'settlement activates no completion claim');
check(settlement.cap_06_authorized === false, 'settlement does not authorize CAP-06');
check(JSON.stringify(settlement.exact_changed_file_boundary.slice().sort()) === JSON.stringify(expectedFiles), 'settlement status freezes exact eight-file boundary');
check(!expectedFiles.some((file) => file.startsWith('apps/server/src/') || file.startsWith('apps/web/') || file.includes('/migrations/')), 'exact boundary contains no Runtime, web or migration file');

const mode = process.argv.includes('--candidate') ? 'candidate' : process.argv.includes('--postmerge') ? 'postmerge' : 'auto';
const changed = changedFiles();
if (mode === 'candidate' || mode === 'postmerge') {
  check(JSON.stringify(changed) === JSON.stringify(expectedFiles), `${mode} retains exact eight-file S10 settlement boundary`);
} else if (changed && JSON.stringify(changed) === JSON.stringify(expectedFiles)) {
  check(true, 'auto mode recognizes exact eight-file S10 settlement');
} else if (changed === null) {
  check(true, 'auto mode accepts shallow merge-ref checkout after all settlement invariants pass');
} else {
  console.error(`UNEXPECTED_S10_SETTLEMENT_CHANGED_FILES:${JSON.stringify(changed)}`);
  check(false, 'auto mode rejects an unexpected S10 settlement boundary');
}

console.log(`SUMMARY ${pass} PASS / ${fail} FAIL`);
if (fail) process.exit(1);
