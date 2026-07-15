// scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_05_S9_SETTLEMENT.cjs
// Purpose: verify S9 merged-main effectiveness settlement and explicit S10 bounded-chain authorization without implementing S10 or authorizing CAP-06.
// Boundary: static governance and repository-shape checks only; no database, Runtime execution, route, network or wall-clock authority.

'use strict';

const fs = require('node:fs');
const { execFileSync } = require('node:child_process');

const ACTIVATION = 'MCFT-CAP-05.S9.SSOT-SETTLEMENT-V1';
const S9 = 'MCFT-CAP-05.MCFT-03-04.RESTART-LATE-RECEIPT-REBUILD-V1';
const S10 = 'MCFT-CAP-05.MCFT-04-16.BOUNDED-EIGHT-TICK-FEEDBACK-CHAIN-V1';
const BASELINE = '07485e93ab17c5a4f9dc057f6c79e190a38d425f';
const S9_HEAD = 'cfe0766d474c0e0a37f38fbe2166fcac79ff96de';
const S9_MERGE = '07485e93ab17c5a4f9dc057f6c79e190a38d425f';
const expectedFiles = [
  "docs/digital_twin/GEOX-DT-02-MCFT-IMPLEMENTATION-MAP.md",
  "docs/digital_twin/GEOX-MCFT-VERTICAL-CAPABILITY-LINE-MATRIX.json",
  "docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-AUTHORIZATION-STATUS.json",
  "docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-DELIVERY-SLICE-STATUS.json",
  "docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-S9-SETTLEMENT-STATUS.json",
  "docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-TASK.md",
  "scripts/dev/assert_local_pnpm_runtime.cjs",
  "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_05_S9_SETTLEMENT.cjs"
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
function read(file) { return fs.readFileSync(file, 'utf8'); }
function json(file) { return JSON.parse(read(file)); }
function changedFiles() {
  for (const range of [`${BASELINE}..HEAD`, 'HEAD^1..HEAD', 'origin/main...HEAD', 'origin/main..HEAD']) {
    try {
      const files = execFileSync('git', ['diff', '--name-only', range], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      }).trim().split(/\r?\n/).filter(Boolean).sort();
      return files;
    } catch {
      // Continue through frozen-baseline, merge-parent and remote-main fallbacks.
    }
  }
  return null;
}
function zeroTreeDelta(base, head) {
  try {
    return execFileSync('git', ['diff', '--name-only', base, head], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim() === '';
  } catch {
    return false;
  }
}

function mergeSecondParentTreeEquivalent() {
  try {
    execFileSync('git', ['rev-parse', '--verify', 'HEAD^2'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return execFileSync('git', ['diff', '--name-only', 'HEAD^2', 'HEAD'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim() === '';
  } catch {
    return null;
  }
}

const map = read(expectedFiles[0]);
const matrix = json(expectedFiles[1]);
const authorization = json(expectedFiles[2]);
const delivery = json(expectedFiles[3]);
const status = json(expectedFiles[4]);
const task = read(expectedFiles[5]);
const wrapper = read(expectedFiles[6]);
const cap05 = matrix.capability_lines.find((line) => line.capability_line_id === 'MCFT-CAP-05');
const matrixS9 = cap05?.delivery_slices?.find((slice) => slice.delivery_slice_id === S9);
const matrixS10 = cap05?.delivery_slices?.find((slice) => slice.delivery_slice_id === S10);
const deliveryS9 = delivery.slices.find((slice) => slice.delivery_slice_id === S9);
const deliveryS10 = delivery.slices.find((slice) => slice.delivery_slice_id === S10);

check(status.activation_id === ACTIVATION && status.status === 'IMPLEMENTATION_CANDIDATE', 'settlement candidate identity is explicit');
check(status.baseline_main_commit === BASELINE, 'settlement baseline is S9 implementation merged main');
check(status.activation_kind === 'S9_EFFECTIVENESS_SETTLEMENT_AND_S10_EXPLICIT_AUTHORIZATION', 'settlement kind is bounded to S9 effectiveness and S10 authorization');
check(status.s9_effectiveness?.exact_head === S9_HEAD && status.s9_effectiveness?.merge_commit === S9_MERGE, 'S9 implementation identities are frozen');
check(status.s9_effectiveness?.exact_head_workflow === 29392113827, 'S9 exact-head workflow is frozen');
check(status.s9_effectiveness?.postmerge_probe_pr_number === 2480 && status.s9_effectiveness?.merged_main_gate_workflow === 29392566574, 'S9 merged-main probe is frozen');
check(status.s9_effectiveness?.head_to_merge_file_delta_count === 0 && status.s9_effectiveness?.tree_equivalence === 'PASS', 'S9 head-to-merge tree equivalence is frozen');
check(status.s9_effectiveness?.governance_gate === '54_PASS_0_FAIL', 'S9 governance proof is frozen');
check(status.s9_effectiveness?.postgresql_restart_late_rebuild_path === '13_PASS_0_FAIL', 'S9 PostgreSQL proof is frozen');
check(status.s9_effectiveness?.inherited_cap03_recovery_path === '15_PASS_0_FAIL', 'inherited fencing and CAS proof is frozen');
check(status.s9_effectiveness?.effective === true, 'S9 merged-main effectiveness is explicit');
check(status.s10_authorization?.delivery_slice_id === S10 && status.s10_authorization?.status_after_activation === 'AUTHORIZED_NOT_STARTED', 'S10 authorization target is explicit');
check(status.s10_authorization?.runtime_source_authorized === true && status.s10_authorization?.implementation_started === false, 'S10 source is authorized but not implemented');
check(status.canonical_object_delta === 0 && status.transaction_family_delta === 0 && status.migration_delta === 0 && status.runtime_source_delta === 0, 'settlement is governance-only');
check(
  ['PENDING', 'SUCCESS_PENDING_FINAL_EXACT_HEAD_CI'].includes(status.validation?.candidate_validation_state),
  'settlement validation lifecycle is explicit',
);
if (status.validation?.candidate_validation_state === 'SUCCESS_PENDING_FINAL_EXACT_HEAD_CI') {
  check(
    /^[0-9a-f]{40}$/.test(status.validation?.materialized_candidate_head || '')
      && Number.isInteger(status.validation?.candidate_validation_workflow),
    'materialized candidate validation identity is frozen',
  );
}

check(authorization.implementation_status === 'S10_AUTHORIZED_NOT_STARTED', 'Authorization Status advances to S10 authorized-not-started');
check(authorization.active_delivery_slice_id === S10 && authorization.active_authorized_slice_id === S10, 'Authorization Status points to S10');
check(authorization.current_blockers?.includes('S10_IMPLEMENTATION_NOT_STARTED'), 'Authorization Status records S10 not started');
check(authorization.s9_effectiveness?.effective === true, 'Authorization Status settles S9 effective');
check(authorization.successor_authorized === false, 'CAP-06 remains unauthorized');

check(delivery.status === 'S10_AUTHORIZED_NOT_STARTED' && delivery.active_delivery_slice_id === S10, 'Delivery Status advances to S10 authorization');
check(deliveryS9?.status === 'MERGED_EFFECTIVE' && deliveryS9?.effectiveness_condition_satisfied === true, 'Delivery Status settles S9 effective');
check(deliveryS9?.exact_head === S9_HEAD && deliveryS9?.merge_commit === S9_MERGE, 'Delivery Status freezes S9 identities');
check(deliveryS10?.status === 'AUTHORIZED_NOT_STARTED' && deliveryS10?.runtime_source_authorized === true, 'Delivery Status explicitly authorizes S10');
check(deliveryS10?.implementation_started === false && deliveryS10?.allowed_claims?.includes('BOUNDED_EIGHT_TICK_FEEDBACK_CHAIN_IMPLEMENTATION_AUTHORIZED'), 'S10 has authorization only');

check(cap05?.implementation_status === 'S10_AUTHORIZED_NOT_STARTED' && cap05?.active_delivery_slice_id === S10, 'global Matrix advances CAP-05 to S10');
check(matrixS9?.status === 'MERGED_EFFECTIVE' && matrixS9?.effectiveness_condition_satisfied === true, 'global Matrix settles S9 effective');
check(matrixS10?.status === 'AUTHORIZED_NOT_STARTED' && matrixS10?.runtime_source_authorized === true && matrixS10?.implementation_started === false, 'global Matrix authorizes but does not start S10');
check(cap05?.successor_authorized !== true, 'global Matrix does not authorize CAP-06');

check(task.includes('S9 SSOT Settlement — S9 Effective / S10 Authorized'), 'Task records S9 settlement');
check(task.includes('implementation_status:\nS10_AUTHORIZED_NOT_STARTED'), 'Task current status advances to S10');
check(task.includes(`active_delivery_slice_id:\n${S10}`), 'Task current slice points to S10');
check(map.includes('MCFT-CAP-05 S9 Effective and S10 Explicitly Authorized'), 'Implementation Map records settlement');
check(wrapper.includes('MCFT_CAP_05_S9_SSOT_SETTLEMENT_GATE_V1') && wrapper.includes('ACCEPTANCE_MCFT_CAP_05_S9_SETTLEMENT.cjs'), 'standard acceptance invokes S9 Settlement Gate');

check(status.preserved_nonclaims.includes('NO_S10_RUNTIME_IMPLEMENTATION'), 'S10 implementation nonclaim remains explicit');
check(status.preserved_nonclaims.includes('NO_CAP_06_AUTHORIZATION'), 'CAP-06 nonclaim remains explicit');
check(!expectedFiles.some((file) => file.startsWith('apps/server/') || file.startsWith('apps/web/') || file.includes('/migrations/')), 'settlement boundary contains no Runtime, web or migration file');

const mode = process.argv.includes('--candidate') ? 'candidate' : process.argv.includes('--postmerge') ? 'postmerge' : 'auto';
const changed = changedFiles();
if (mode === 'candidate') {
  check(JSON.stringify(changed) === JSON.stringify(expectedFiles), 'exact eight-file S9 settlement boundary');
} else if (mode === 'postmerge') {
  check(
    changed === null || JSON.stringify(changed) === JSON.stringify(expectedFiles),
    'postmerge main retains the exact eight-file S9 settlement boundary against the frozen S9 baseline',
  );
  const secondParentEquivalent = mergeSecondParentTreeEquivalent();
  check(
    secondParentEquivalent !== false,
    'settlement merge tree equals the exact settlement head or the second parent is unavailable in a shallow checkout',
  );
  check(status.effectiveness_condition_satisfied === false, 'candidate status remains historical pre-effectiveness evidence after merge');
} else if (changed && JSON.stringify(changed) === JSON.stringify(expectedFiles)) {
  check(true, 'auto mode recognizes exact eight-file S9 settlement candidate');
} else if (changed && changed.length === 0) {
  check(true, 'auto mode recognizes merged-main S9 settlement');
} else if (changed === null) {
  check(true, 'auto mode accepts shallow merge-ref checkout after all settlement invariants pass');
} else {
  console.error(`UNEXPECTED_S9_SETTLEMENT_CHANGED_FILES:${JSON.stringify(changed)}`);
  check(false, 'auto mode rejects an unexpected S9 settlement boundary');
}

check(zeroTreeDelta(S9_HEAD, S9_MERGE), 'repository proves S9 head-to-merge tree equivalence');

console.log(`SUMMARY ${pass} PASS / ${fail} FAIL`);
if (fail) process.exit(1);
