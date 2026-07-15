// scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_05_S10_BOUNDED_EIGHT_TICK_FEEDBACK_CHAIN.cjs
// Purpose: verify the authorized MCFT-CAP-05 S10 bounded eight-tick feedback-chain implementation candidate and its exact repository boundary.
// Boundary: static governance and repository-shape checks only; no database, Runtime execution, route, network, wall-clock authority, closure or CAP-06 authorization.

'use strict';

const fs = require('node:fs');
const { execFileSync } = require('node:child_process');

const SLICE = 'MCFT-CAP-05.MCFT-04-16.BOUNDED-EIGHT-TICK-FEEDBACK-CHAIN-V1';
const NEXT = 'MCFT-CAP-05.CLOSURE-AND-FINALIZATION-V1';
const BASELINE = '679a1442cc130c174951eb0330b0c82592e4a6df';
const BRANCH = 'agent/mcft-cap-05-s10-bounded-eight-tick-feedback-chain-v1';
const configPath = 'apps/server/src/runtime/twin_runtime/effective_feedback_runtime_config_v1.ts';
const servicePath = 'apps/server/src/runtime/twin_runtime/bounded_feedback_chain_service_v1.ts';
const runnerPath = 'apps/server/scripts/mcft/MCFT_CAP_05_HUMAN_DECISION_FEEDBACK_RUNNER.ts';
const designPath = 'docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-S10-BOUNDED-EIGHT-TICK-FEEDBACK-CHAIN.md';
const statusPath = 'docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-S10-STATUS.json';
const wrapperPath = 'scripts/dev/assert_local_pnpm_runtime.cjs';
const gatePath = 'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_05_S10_BOUNDED_EIGHT_TICK_FEEDBACK_CHAIN.cjs';
const runtimeAcceptancePath = 'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_05_BOUNDED_EIGHT_TICK_FEEDBACK_CHAIN.ts';
const expectedFiles = [
  configPath,
  servicePath,
  runnerPath,
  designPath,
  statusPath,
  wrapperPath,
  gatePath,
  runtimeAcceptancePath,
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

const authorizationPath = 'docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-AUTHORIZATION-STATUS.json';
const deliveryPath = 'docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-DELIVERY-SLICE-STATUS.json';
const settlementPath = 'docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-S9-SETTLEMENT-STATUS.json';
const taskPath = 'docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-TASK.md';

const config = read(configPath);
const service = read(servicePath);
const runner = read(runnerPath);
const design = read(designPath);
const status = json(statusPath);
const wrapper = read(wrapperPath);
const runtimeAcceptance = read(runtimeAcceptancePath);
const authorization = json(authorizationPath);
const delivery = json(deliveryPath);
const settlement = json(settlementPath);
const task = read(taskPath);
const deliveryS10 = delivery.slices.find((slice) => slice.delivery_slice_id === SLICE);
const deliveryNext = delivery.slices.find((slice) => slice.delivery_slice_id === NEXT);

check(status.delivery_slice_id === SLICE && status.status === 'IMPLEMENTATION_CANDIDATE', 'S10 candidate identity is explicit');
check(status.baseline_main_commit === BASELINE && status.branch === BRANCH, 'S10 baseline and branch are frozen');
check(status.predecessor_effectiveness?.s9_settlement_pr_number === 2481, 'S9 settlement PR identity is frozen');
check(status.predecessor_effectiveness?.s9_settlement_exact_head_workflow === 29398001124, 'S9 settlement exact-head workflow is frozen');
check(status.predecessor_effectiveness?.s9_settlement_merge_commit === BASELINE, 'S9 settlement merge is the S10 baseline');
check(status.predecessor_effectiveness?.s9_settlement_head_to_merge_file_delta_count === 0, 'S9 settlement tree equivalence is frozen');
check(status.predecessor_effectiveness?.s9_settlement_postmerge_probe_pr_number === 2482, 'S9 settlement merged-main probe PR is frozen');
check(status.predecessor_effectiveness?.s9_settlement_postmerge_probe_workflow === 29398544450, 'S9 settlement merged-main probe workflow is frozen');
check(status.predecessor_effectiveness?.s9_settlement_postmerge_probe_closed_without_merge === true, 'S9 settlement probe disposition is frozen');
check(status.predecessor_effectiveness?.s10_runtime_source_authorized === true, 'S10 Runtime source authority is effective');

check(authorization.implementation_status === 'S10_AUTHORIZED_NOT_STARTED', 'Authorization Status authorizes S10');
check(authorization.active_delivery_slice_id === SLICE && authorization.runtime_source_authorized === true, 'Authorization Status points to the exact S10 slice');
check(authorization.successor_authorized === false, 'Authorization Status keeps CAP-06 unauthorized');
check(delivery.status === 'S10_AUTHORIZED_NOT_STARTED' && delivery.active_delivery_slice_id === SLICE, 'Delivery Status authorizes S10');
check(deliveryS10?.status === 'AUTHORIZED_NOT_STARTED' && deliveryS10?.runtime_source_authorized === true, 'S10 Delivery Slice is authorized');
check(deliveryS10?.implementation_started === false && deliveryS10?.effectiveness_condition_satisfied === true, 'S10 authorization was effective before implementation');
check(deliveryNext?.status === 'BLOCKED' && deliveryNext?.runtime_source_authorized === false, 'closure slice remains blocked');
check(settlement.s10_authorization?.delivery_slice_id === SLICE && settlement.s10_authorization?.implementation_started === false, 'S9 settlement records authorization without prior implementation');

check(config.includes('CAP05_EFFECTIVE_RUNTIME_CONFIG_PROFILE_ID_V1'), 'effective Runtime Config profile identity exists');
check(config.includes('compileCap05RuntimeConfigV1'), 'effective profile reuses the existing CAP-05 compiler');
check(config.includes('CAP05_EFFECTIVE_CONFIG_CHAIN_EXACTLY_EIGHT_REQUIRED'), 'effective profile enforces exactly eight configs');
check(config.includes('action_feedback_state_input_policy_id'), 'effective profile carries S7 receipt policy aliases');
check(config.includes('forecast_residual_matching_policy_id'), 'effective profile carries S8 residual policy aliases');
check(config.includes('parentRef = config.object_id') && config.includes('parentHash = config.determinism_hash'), 'effective config parent chain uses finalized identities');

check(service.includes('CAP05_S10_BOUNDED_CHAIN_SERVICE_ID_V1'), 'S10 bounded service identity exists');
check(service.includes('CAP05_S10_PREDECESSOR_SEQUENCE_V1 = 72'), 'S10 predecessor checkpoint is frozen at 72');
check(service.includes('CAP05_S10_FINAL_SEQUENCE_V1 = 80'), 'S10 final checkpoint is frozen at 80');
check(service.includes('CAP05_S10_TICK_COUNT_V1 = 8'), 'S10 exact tick count is frozen');
check(service.includes('CAP05_S10_FORECAST_POINT_COUNT_V1 = 576'), 'S10 Forecast point count is frozen');
check(service.includes('CAP05_S10_SCENARIO_POINT_COUNT_V1 = 1728'), 'S10 Scenario point count is frozen');
check(service.includes('compileCap05EffectiveRuntimeConfigChainV1'), 'S10 service compiles the exact effective config chain');
check(service.includes('receiptTickService.executeOneTick'), 'S10 reuses the S7 receipt-consuming tick');
check(service.includes('outcomeTickService.executeOneTickAndCommitResidual'), 'S10 reuses the S8 outcome plus C commit');
check(service.includes('continuationTickService.executeOneTick'), 'S10 reuses existing continuation tick authority');
check(service.includes('CAP05_S10_BLOCKED_TICK_FORBIDDEN'), 'blocked A2 tick fails closed');
check(service.includes('CAP05_S10_RUNTIME_CONFIG_READBACK_MISMATCH'), 'config commit/readback divergence fails closed');
check(service.includes('initialCompleted === CAP05_S10_TICK_COUNT_V1'), 'completed replay short-circuits before tick execution');
check(service.includes('automatic_history_rewrite: false'), 'automatic history rewrite remains false');
check(service.includes('causal_effect_claimed: false'), 'causal-effect nonclaim remains explicit');

check(runner.includes('PostgresRuntimeRepositoryV1'), 'runner uses production Runtime repository');
check(runner.includes('PostgresActionFeedbackTickSourceV1'), 'runner uses production H source');
check(runner.includes('PostgresForecastResidualSourceV1'), 'runner uses production historical Forecast source');
check(runner.includes('PostgresFeedbackPersistenceRepositoryV1'), 'runner uses production G/H/C persistence authority');
check(runner.includes('CanonicalReplayFileSourceV1'), 'runner uses canonical Replay Evidence files');
check(runner.includes('Cap05BoundedEightTickFeedbackChainServiceV1'), 'runner invokes the bounded S10 service');
check(!runner.includes('fastify') && !runner.includes('setInterval') && !runner.includes('setTimeout'), 'runner creates no route, server or scheduler');

check(design.includes('checkpoint 73') && design.includes('checkpoints 75–80'), 'design freezes checkpoint 73–80 semantics');
check(design.includes('forecast_point_count = 576') && design.includes('scenario_point_count = 1728'), 'design freezes output counts');
check(design.includes('81 canonical Twin object facts') && design.includes('83 canonical Twin object facts'), 'design separates orchestrator and full-path fact accounting');
check(design.includes('NO_S11_AUTHORIZATION') && design.includes('NO_CAP_06_AUTHORIZATION'), 'design preserves successor nonclaims');
check(
  task.includes('## S10 — Bounded 8-Tick Chain')
    && task.includes('8 posterior States')
    && task.includes('checkpoint 73..80')
    && task.includes('next logical tick 2026-06-04T10:00:00.000Z'),
  'frozen Task contains the S10 delivery definition',
);

check(status.implementation?.runtime_config_count === 8, 'status freezes eight Runtime Configs');
check(status.implementation?.posterior_state_count === 8, 'status freezes eight posterior States');
check(status.implementation?.successful_forecast_run_count === 8, 'status freezes eight Forecast Runs');
check(status.implementation?.scenario_set_count === 8, 'status freezes eight Scenario Sets');
check(status.implementation?.forecast_point_count === 576 && status.implementation?.scenario_point_count === 1728, 'status freezes 576/1728 points');
check(status.implementation?.orchestrator_canonical_twin_object_fact_delta === 81, 'status freezes S10 orchestrator fact delta');
check(status.implementation?.full_capability_path_canonical_twin_object_fact_delta === 83, 'status freezes full path fact delta');
check(status.canonical_object_type_delta === 0 && status.transaction_family_delta === 0 && status.migration_delta === 0, 'S10 adds no object type, transaction family or migration');
check(status.public_route_delta === 0 && status.web_delta === 0 && status.scheduler_delta === 0, 'S10 adds no route, web or scheduler');
check(status.s11_authorized === false && status.cap_06_authorized === false, 'S11 and CAP-06 remain unauthorized');
check(status.effectiveness_condition_satisfied === false, 'S10 candidate does not self-claim merged effectiveness');
check(status.preserved_nonclaims.includes('NO_CAP_05_COMPLETION_CLAIM'), 'CAP-05 completion nonclaim is explicit');
check(status.preserved_nonclaims.includes('NO_MODEL_ACTIVATION'), 'model activation nonclaim is explicit');

check(wrapper.includes('MCFT_CAP_05_S10_BOUNDED_EIGHT_TICK_FEEDBACK_CHAIN_GATE_V1'), 'standard acceptance contains the S10 marker');
check(wrapper.includes('ACCEPTANCE_MCFT_CAP_05_S10_BOUNDED_EIGHT_TICK_FEEDBACK_CHAIN.cjs'), 'standard acceptance invokes the S10 governance gate');
check(wrapper.includes('ACCEPTANCE_MCFT_CAP_05_BOUNDED_EIGHT_TICK_FEEDBACK_CHAIN.ts'), 'standard acceptance invokes the S10 Runtime acceptance');
check(runtimeAcceptance.includes('assert.equal(pass, 14)'), 'S10 Runtime acceptance freezes fourteen checks');
check(runtimeAcceptance.includes('ALREADY_COMPLETE'), 'S10 Runtime acceptance proves completed rerun');
check(runtimeAcceptance.includes('partial restart'), 'S10 Runtime acceptance proves bounded resume');
check(runtimeAcceptance.includes('CAP05_S10_BLOCKED_TICK_FORBIDDEN'), 'S10 Runtime acceptance proves blocked-tick rejection');

check(!expectedFiles.some((file) => file.startsWith('apps/web/') || file.includes('/migrations/')), 'exact boundary contains no web or migration file');
check(!expectedFiles.some((file) => file.includes('/routes/') || file.includes('/api/')), 'exact boundary contains no public route file');

const mode = process.argv.includes('--candidate') ? 'candidate' : process.argv.includes('--postmerge') ? 'postmerge' : 'auto';
const changed = changedFiles();
if (mode === 'candidate') {
  check(JSON.stringify(changed) === JSON.stringify(expectedFiles), 'exact eight-file S10 candidate boundary');
} else if (mode === 'postmerge') {
  check(
    JSON.stringify(changed) === JSON.stringify(expectedFiles),
    'postmerge main retains the exact eight-file S10 implementation boundary',
  );
} else if (changed && JSON.stringify(changed) === JSON.stringify(expectedFiles)) {
  check(true, 'auto mode recognizes exact eight-file S10 candidate');
} else if (changed && changed.length === 0) {
  check(true, 'auto mode recognizes merged-main S10 implementation');
} else if (changed === null) {
  check(true, 'auto mode accepts shallow merge-ref checkout after all S10 invariants pass');
} else {
  console.error(`UNEXPECTED_S10_CHANGED_FILES:${JSON.stringify(changed)}`);
  check(false, 'auto mode rejects an unexpected S10 boundary');
}

console.log(`SUMMARY ${pass} PASS / ${fail} FAIL`);
if (fail) process.exit(1);
