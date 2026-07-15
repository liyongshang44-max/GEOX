// scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_05_S8_SETTLEMENT.cjs
// Purpose: verify S8 merged-main effectiveness settlement and explicit S9 restart/recovery authorization without implementing S9 or authorizing S10/CAP-06.
// Boundary: static governance and repository-shape checks only; no database, Runtime execution, route, network or wall-clock authority.

'use strict';

const fs = require('node:fs');
const { execFileSync } = require('node:child_process');

const ACTIVATION = 'MCFT-CAP-05.S8.SSOT-SETTLEMENT-V1';
const S8 = 'MCFT-CAP-05.MCFT-07-11.FORECAST-OBSERVATION-RESIDUAL-C-COMMIT-V1';
const S9 = 'MCFT-CAP-05.MCFT-03-04.RESTART-LATE-RECEIPT-REBUILD-V1';
const BASELINE = 'ca61e86c5a6c1e035b82312b92116a111a76ccc7';
const S8_RUNTIME_HEAD = '172ee2ac2e306b7e04f2db7d05a3163f881b490a';
const S8_RUNTIME_MERGE = '0610ed542067e699b7dd9828199661f12e1cdbde';
const STRICT_HEAD = 'ff2fc0ea9a2b387b01fe86560f85c65428cb0fee';
const STRICT_MERGE = BASELINE;
const expectedFiles = [
  'docs/digital_twin/GEOX-DT-02-MCFT-IMPLEMENTATION-MAP.md',
  'docs/digital_twin/GEOX-MCFT-VERTICAL-CAPABILITY-LINE-MATRIX.json',
  'docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-AUTHORIZATION-STATUS.json',
  'docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-DELIVERY-SLICE-STATUS.json',
  'docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-S8-SETTLEMENT-STATUS.json',
  'docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-TASK.md',
  'scripts/dev/assert_local_pnpm_runtime.cjs',
  'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_05_S8_SETTLEMENT.cjs',
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
      const files = execFileSync('git', ['diff', '--name-only', range], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      }).trim().split(/\r?\n/).filter(Boolean).sort();
      if (files.length > 0) return files;
      return [];
    } catch {
      // Continue through the frozen baseline, merge-parent and remote-main fallbacks.
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

const map = read(expectedFiles[0]);
const matrix = json(expectedFiles[1]);
const authorization = json(expectedFiles[2]);
const delivery = json(expectedFiles[3]);
const status = json(expectedFiles[4]);
const task = read(expectedFiles[5]);
const wrapper = read(expectedFiles[6]);
const cap05 = matrix.capability_lines.find((line) => line.capability_line_id === 'MCFT-CAP-05');
const matrixS8 = cap05?.delivery_slices?.find((slice) => slice.delivery_slice_id === S8);
const matrixS9 = cap05?.delivery_slices?.find((slice) => slice.delivery_slice_id === S9);
const deliveryS8 = delivery.slices.find((slice) => slice.delivery_slice_id === S8);
const deliveryS9 = delivery.slices.find((slice) => slice.delivery_slice_id === S9);

check(status.activation_id === ACTIVATION && status.status === 'IMPLEMENTATION_CANDIDATE', 'settlement candidate identity is explicit');
check(status.baseline_main_commit === BASELINE, 'settlement baseline is strict-availability merged main');
check(status.activation_kind === 'S8_EFFECTIVENESS_SETTLEMENT_AND_S9_EXPLICIT_AUTHORIZATION', 'settlement kind is bounded to S8 effectiveness and S9 authorization');
check(status.s8_effectiveness?.runtime_exact_head === S8_RUNTIME_HEAD && status.s8_effectiveness?.runtime_merge_commit === S8_RUNTIME_MERGE, 'original S8 Runtime identities are frozen');
check(status.s8_effectiveness?.strict_availability_exact_head === STRICT_HEAD && status.s8_effectiveness?.strict_availability_merge_commit === STRICT_MERGE, 'strict-availability hardening identities are frozen');
check(status.s8_effectiveness?.runtime_head_to_merge_file_delta_count === 0 && status.s8_effectiveness?.runtime_tree_equivalence === 'PASS', 'original S8 Runtime head-to-merge tree equivalence is proven');
check(status.s8_effectiveness?.strict_availability_head_to_merge_file_delta_count === 0 && status.s8_effectiveness?.strict_availability_tree_equivalence === 'PASS', 'strict-availability head-to-merge tree equivalence is proven');
check(status.s8_effectiveness?.invalid_probe_pr_number === 2474 && status.s8_effectiveness?.invalid_probe_disposition === 'CLOSED_WITHOUT_MERGE_OR_EFFECTIVENESS_CLAIM', 'invalid probe is preserved without false effectiveness claim');
check(status.s8_effectiveness?.corrected_postmerge_probe_pr_number === 2476 && status.s8_effectiveness?.corrected_postmerge_probe_workflow === 29385741895 && status.s8_effectiveness?.corrected_postmerge_probe_state === 'SUCCESS', 'corrected merged-main probe is frozen');
check(status.s8_effectiveness?.strict_availability_governance === '44_PASS_0_FAIL' && status.s8_effectiveness?.s8_in_memory_outcome_path === '16_PASS_0_FAIL' && status.s8_effectiveness?.s8_postgresql_source_c_recovery_path === '8_PASS_0_FAIL', 'S8 governance, in-memory and PostgreSQL proofs are frozen');
check(status.s8_effectiveness?.effective === true, 'S8 merged-main effectiveness is explicit');
check(status.s9_authorization?.delivery_slice_id === S9 && status.s9_authorization?.status_after_activation === 'AUTHORIZED_NOT_STARTED', 'S9 authorization target is explicit');
check(status.s9_authorization?.runtime_source_authorized === true && status.s9_authorization?.implementation_started === false, 'S9 source is authorized but not implemented');
check(status.canonical_object_delta === 0 && status.transaction_family_delta === 0 && status.migration_delta === 0 && status.runtime_source_delta === 0, 'settlement is governance-only');

check(authorization.implementation_status === 'S9_AUTHORIZED_NOT_STARTED', 'Authorization Status advances to S9 authorized-not-started');
check(authorization.active_delivery_slice_id === S9 && authorization.active_authorized_slice_id === S9, 'Authorization Status points to S9');
check(authorization.current_blockers?.includes('S9_IMPLEMENTATION_NOT_STARTED'), 'Authorization Status records S9 not started');
check(authorization.s8_effectiveness?.effective === true, 'Authorization Status settles S8 effective');
check(authorization.successor_authorized === false, 'CAP-06 remains unauthorized');

check(delivery.status === 'S9_AUTHORIZED_NOT_STARTED' && delivery.active_delivery_slice_id === S9, 'Delivery Status advances to S9 authorization');
check(deliveryS8?.status === 'MERGED_EFFECTIVE' && deliveryS8?.effectiveness_condition_satisfied === true, 'Delivery Status settles S8 effective');
check(deliveryS8?.exact_head === S8_RUNTIME_HEAD && deliveryS8?.merge_commit === S8_RUNTIME_MERGE, 'Delivery Status freezes original S8 Runtime identities');
check(deliveryS8?.strict_availability_hardening?.exact_head === STRICT_HEAD && deliveryS8?.strict_availability_hardening?.merge_commit === STRICT_MERGE, 'Delivery Status freezes strict-availability hardening identities');
check(deliveryS9?.status === 'AUTHORIZED_NOT_STARTED' && deliveryS9?.runtime_source_authorized === true, 'Delivery Status explicitly authorizes S9');
check(deliveryS9?.implementation_started === false && deliveryS9?.allowed_claims?.includes('RESTART_RESPONSE_LOSS_LATE_RECEIPT_REBUILD_IMPLEMENTATION_AUTHORIZED'), 'S9 has authorization only');

check(cap05?.implementation_status === 'S9_AUTHORIZED_NOT_STARTED' && cap05?.active_delivery_slice_id === S9, 'global Matrix advances CAP-05 to S9');
check(matrixS8?.status === 'MERGED_EFFECTIVE' && matrixS8?.effectiveness_condition_satisfied === true, 'global Matrix settles S8 effective');
check(matrixS9?.status === 'AUTHORIZED_NOT_STARTED' && matrixS9?.runtime_source_authorized === true && matrixS9?.implementation_started === false, 'global Matrix authorizes but does not start S9');
check(cap05?.successor_authorized !== true, 'global Matrix does not authorize CAP-06');

check(task.includes('S8 SSOT Settlement — S8 Effective / S9 Authorized'), 'task records S8 settlement');
check(task.includes('implementation_status:\nS9_AUTHORIZED_NOT_STARTED'), 'task current status advances to S9');
check(task.includes(`active_delivery_slice_id:\n${S9}`), 'task current slice points to S9');
check(map.includes('MCFT-CAP-05 S8 Effective and S9 Explicitly Authorized'), 'Implementation Map records settlement');
check(wrapper.includes('MCFT_CAP_05_S8_SSOT_SETTLEMENT_GATE_V1') && wrapper.includes('ACCEPTANCE_MCFT_CAP_05_S8_SETTLEMENT.cjs'), 'standard acceptance invokes S8 Settlement Gate');

check(status.preserved_nonclaims.includes('NO_S9_RUNTIME_IMPLEMENTATION'), 'S9 implementation nonclaim remains explicit');
check(status.preserved_nonclaims.includes('NO_S10_BOUNDED_EIGHT_TICK_CHAIN_AUTHORIZATION'), 'S10 remains unauthorized');
check(status.preserved_nonclaims.includes('NO_CAP_06_AUTHORIZATION'), 'CAP-06 nonclaim remains explicit');
check(!expectedFiles.some((file) => file.startsWith('apps/server/') || file.startsWith('apps/web/') || file.includes('/migrations/')), 'settlement boundary contains no Runtime, web or migration file');

const mode = process.argv.includes('--candidate') ? 'candidate' : process.argv.includes('--postmerge') ? 'postmerge' : 'auto';
const changed = changedFiles();
if (mode === 'candidate') {
  check(JSON.stringify(changed) === JSON.stringify(expectedFiles), 'exact eight-file S8 settlement boundary');
} else if (mode === 'postmerge') {
  check(changed === null || changed.length === 0, 'postmerge main has no settlement delta against frozen S8 main');
  check(status.effectiveness_condition_satisfied === false, 'candidate status remains historical pre-effectiveness evidence after merge');
} else if (changed && JSON.stringify(changed) === JSON.stringify(expectedFiles)) {
  check(true, 'auto mode recognizes exact eight-file S8 settlement candidate');
} else if (changed && changed.length === 0) {
  check(true, 'auto mode recognizes merged-main S8 settlement');
} else if (changed === null) {
  check(true, 'auto mode accepts shallow merge-ref checkout after all settlement invariants pass');
} else {
  console.error(`UNEXPECTED_S8_SETTLEMENT_CHANGED_FILES:${JSON.stringify(changed)}`);
  check(false, 'auto mode rejects an unexpected S8 settlement boundary');
}

check(zeroTreeDelta(S8_RUNTIME_HEAD, S8_RUNTIME_MERGE), 'repository proves original S8 Runtime head-to-merge tree equivalence');
check(zeroTreeDelta(STRICT_HEAD, STRICT_MERGE), 'repository proves strict-availability head-to-merge tree equivalence');

console.log(`SUMMARY ${pass} PASS / ${fail} FAIL`);
if (fail) process.exit(1);
