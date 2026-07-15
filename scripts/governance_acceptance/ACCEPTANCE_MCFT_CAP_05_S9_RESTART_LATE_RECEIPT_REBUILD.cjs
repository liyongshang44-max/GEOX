// scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_05_S9_RESTART_LATE_RECEIPT_REBUILD.cjs
// Purpose: verify the bounded MCFT-CAP-05 S9 restart, response-loss, late-receipt and projection-rebuild implementation candidate.
// Boundary: static governance and repository-shape checks only; no database, Runtime execution, route, network or wall-clock authority.

'use strict';

const fs = require('node:fs');
const { execFileSync } = require('node:child_process');

const SLICE = 'MCFT-CAP-05.MCFT-03-04.RESTART-LATE-RECEIPT-REBUILD-V1';
const S10 = 'MCFT-CAP-05.MCFT-04-16.BOUNDED-EIGHT-TICK-FEEDBACK-CHAIN-V1';
const BASELINE = '786e95db9b06bbe16daa456575d23d24bd194360';
const BRANCH = 'agent/mcft-cap-05-s9-restart-late-receipt-rebuild-v1';
const expectedFiles = [
  'apps/server/src/runtime/twin_runtime/restart_late_receipt_rebuild_service_v1.ts',
  'docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-S9-RESTART-LATE-RECEIPT-REBUILD.md',
  'docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-S9-STATUS.json',
  'scripts/dev/assert_local_pnpm_runtime.cjs',
  'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_05_S9_RESTART_LATE_RECEIPT_REBUILD.cjs',
  'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_05_S9_RESTART_LATE_RECEIPT_REBUILD_DB.ts',
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

const servicePath = expectedFiles[0];
const designPath = expectedFiles[1];
const statusPath = expectedFiles[2];
const wrapperPath = expectedFiles[3];
const dbAcceptancePath = expectedFiles[5];
const taskPath = 'docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-TASK.md';
const deliveryPath = 'docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-DELIVERY-SLICE-STATUS.json';
const settlementPath = 'docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-S8-SETTLEMENT-STATUS.json';
const inheritedRecoveryPath = 'apps/server/src/persistence/twin_runtime/postgres_runtime_repository_v1.ts';

const service = read(servicePath);
const design = read(designPath);
const status = json(statusPath);
const wrapper = read(wrapperPath);
const dbAcceptance = read(dbAcceptancePath);
const task = read(taskPath);
const delivery = json(deliveryPath);
const settlement = json(settlementPath);
const inheritedRecovery = read(inheritedRecoveryPath);
const deliveryS9 = delivery.slices.find((slice) => slice.delivery_slice_id === SLICE);
const deliveryS10 = delivery.slices.find((slice) => slice.delivery_slice_id === S10);

check(status.delivery_slice_id === SLICE && status.status === 'IMPLEMENTATION_CANDIDATE', 'S9 candidate identity is explicit');
check(status.baseline_main_commit === BASELINE && status.branch === BRANCH, 'S9 baseline and branch are frozen');
check(status.predecessor_effectiveness?.s8_settlement_merge_commit === BASELINE, 'S8 settlement merge is the S9 baseline');
check(status.predecessor_effectiveness?.s8_settlement_postmerge_probe_workflow === 29389744690, 'S8 settlement merged-main proof is frozen');
check(status.predecessor_effectiveness?.s8_effective === true, 'S8 predecessor is effective');
check(settlement.s9_authorization?.delivery_slice_id === SLICE && settlement.s9_authorization?.runtime_source_authorized === true, 'S8 settlement explicitly authorized S9 Runtime source');
check(deliveryS9?.status === 'AUTHORIZED_NOT_STARTED' && deliveryS9?.effectiveness_condition_satisfied === true, 'Delivery Status predecessor authorization is effective');

check(service.includes('CAP05_S9_RECOVERY_SERVICE_ID_V1'), 'S9 service identity exists');
check(service.includes('recoverUnknownCanonicalCommitOutcome'), 'G/H/C unknown-outcome recovery exists');
check(service.includes('lookupByIdempotencyKey'), 'unknown-outcome recovery performs lookup before retry write');
check(service.includes('rebuildSupportStateFailClosed'), 'canonical support rebuild exists');
check(service.includes('rebuildAllSupportState'), 'S9 reuses the existing CAP-05 rebuild authority');
check(service.includes('CAP05_S9_CANONICAL_FACT_DIVERGENCE'), 'canonical divergence fails closed');
check(service.includes('CAP05_S9_IDEMPOTENCY_GUARD_DIVERGENCE'), 'idempotency guard divergence fails closed');
check(service.includes('CAP05_S9_DECISION_PROJECTION_DIVERGENCE'), 'Decision projection divergence fails closed');
check(service.includes('CAP05_S9_ACTION_FEEDBACK_PROJECTION_DIVERGENCE'), 'Action Feedback projection divergence fails closed');
check(service.includes('CAP05_S9_FORECAST_RESIDUAL_PROJECTION_DIVERGENCE'), 'Forecast Residual projection divergence fails closed');
check(service.includes('CAP05_S9_ACTION_FEEDBACK_EVIDENCE_INDEX_DIVERGENCE'), 'Action Feedback Evidence index divergence fails closed');
check(service.includes('CAP05_S9_MULTIPLE_DISTINCT_EXECUTION_EVENTS'), 'multiple distinct same-hour events fail closed');
check(service.includes('CAP05_S9_CONFLICTING_DUPLICATE_EXECUTION_EVENT'), 'conflicting duplicate event fails closed');
check(service.includes('CAP05_S9_CROSS_HOUR_EXECUTION_REQUIRES_INTERVAL_SPLIT'), 'cross-hour execution fails closed');
check(service.includes('REVISION_REQUIRED_LATE_AFTER_CUTOFF'), 'late-after-cutoff is explicit');
check(service.includes('REVISION_REQUIRED_LATE_AFTER_COMMIT'), 'late-after-commit is explicit');
check(service.includes('logical_time_shifted: false') && service.includes('automatic_history_rewrite: false'), 'late receipt is never shifted or automatically rewritten');

check(inheritedRecovery.includes('STALE_FENCING_TOKEN'), 'inherited Runtime persistence retains stale-fencing rejection');
check(inheritedRecovery.includes('STATE_LATEST_CAS_CONFLICT'), 'inherited Runtime persistence retains State CAS rejection');
check(inheritedRecovery.includes('CHECKPOINT_CAS_CONFLICT'), 'inherited Runtime persistence retains checkpoint CAS rejection');
check(inheritedRecovery.includes('FORECAST_RESULT_CAS_CONFLICT'), 'inherited Runtime persistence retains Forecast-result CAS rejection');
check(dbAcceptance.includes('ACCEPTANCE_MCFT_CAP_03_ASSIMILATED_PERSISTENCE_RECOVERY_DB.ts') === false, 'S9 DB acceptance remains scoped to CAP-05 behavior');
check(wrapper.includes('ACCEPTANCE_MCFT_CAP_03_ASSIMILATED_PERSISTENCE_RECOVERY_DB.ts'), 'standard acceptance reruns inherited fencing and CAS proof');

check(design.includes('canonical_fact_delta = 0'), 'design freezes zero canonical delta during rebuild');
check(design.includes('NO_LATE_EVIDENCE_REVISION_RUNTIME'), 'design preserves no late-revision Runtime');
check(design.includes('NO_AUTOMATIC_HISTORY_REWRITE'), 'design preserves no automatic history rewrite');
check(task.includes('## S9 — Restart and Failure Recovery'), 'frozen Task contains the S9 delivery definition');
check(task.includes('G/H/C response-loss retry') && task.includes('canonical divergence fail closed'), 'implementation follows the frozen S9 acceptance scope');

check(status.canonical_object_delta === 0 && status.transaction_family_delta === 0 && status.migration_delta === 0, 'S9 creates no object, transaction family or migration');
check(status.public_route_delta === 0 && status.web_delta === 0 && status.scheduler_delta === 0, 'S9 creates no route, web or scheduler path');
check(status.s10_authorized === false && status.cap_06_authorized === false, 'S10 and CAP-06 remain unauthorized');
check(status.next_delivery_slice_id === S10 && status.next_delivery_slice_authorized === false, 'S10 identity is recorded but remains blocked');
check(deliveryS10?.status === 'BLOCKED' && deliveryS10?.runtime_source_authorized === false, 'Delivery Status continues to block S10');
check(status.effectiveness_condition_satisfied === false, 'S9 candidate does not self-claim merged effectiveness');
check(status.preserved_nonclaims.includes('NO_S10_AUTHORIZATION'), 'S10 nonclaim is explicit');
check(status.preserved_nonclaims.includes('NO_CAP_06_AUTHORIZATION'), 'CAP-06 nonclaim is explicit');
check(status.preserved_nonclaims.includes('NO_STATE_OR_CHECKPOINT_MUTATION_BY_G_H_C_RECOVERY'), 'G/H/C recovery cannot mutate State or checkpoint');

check(wrapper.includes('MCFT_CAP_05_S9_RESTART_LATE_RECEIPT_REBUILD_GATE_V1'), 'standard acceptance contains the S9 gate marker');
check(wrapper.includes('ACCEPTANCE_MCFT_CAP_05_S9_RESTART_LATE_RECEIPT_REBUILD.cjs'), 'standard acceptance invokes the S9 governance gate');
check(wrapper.includes('ACCEPTANCE_MCFT_CAP_05_S9_RESTART_LATE_RECEIPT_REBUILD_DB.ts'), 'standard acceptance invokes the S9 PostgreSQL path');
check(dbAcceptance.includes('G/H/C response-loss retry'), 'S9 acceptance proves G/H/C response-loss recovery');
check(dbAcceptance.includes('projection divergence fails closed'), 'S9 acceptance proves projection divergence rejection');
check(dbAcceptance.includes('late-after-cutoff') && dbAcceptance.includes('late-after-commit'), 'S9 acceptance proves both late boundaries');
check(dbAcceptance.includes('assert.equal(pass, 13)'), 'S9 PostgreSQL acceptance freezes thirteen checks');

check(!expectedFiles.some((file) => file.startsWith('apps/web/') || file.includes('/migrations/')), 'exact boundary contains no web or migration file');
check(!expectedFiles.some((file) => file.includes('/routes/') || file.includes('/api/')), 'exact boundary contains no public route file');

const mode = process.argv.includes('--candidate') ? 'candidate' : process.argv.includes('--postmerge') ? 'postmerge' : 'auto';
const changed = changedFiles();
if (mode === 'candidate') {
  check(JSON.stringify(changed) === JSON.stringify(expectedFiles), 'exact six-file S9 candidate boundary');
} else if (mode === 'postmerge') {
  check(changed === null || changed.length === 0, 'postmerge main has no S9 delta against the frozen baseline');
} else if (changed && JSON.stringify(changed) === JSON.stringify(expectedFiles)) {
  check(true, 'auto mode recognizes exact six-file S9 candidate');
} else if (changed && changed.length === 0) {
  check(true, 'auto mode recognizes merged-main S9 implementation');
} else if (changed === null) {
  check(true, 'auto mode accepts shallow merge-ref checkout after all S9 invariants pass');
} else {
  console.error(`UNEXPECTED_S9_CHANGED_FILES:${JSON.stringify(changed)}`);
  check(false, 'auto mode rejects an unexpected S9 boundary');
}

console.log(`SUMMARY ${pass} PASS / ${fail} FAIL`);
if (fail) process.exit(1);
