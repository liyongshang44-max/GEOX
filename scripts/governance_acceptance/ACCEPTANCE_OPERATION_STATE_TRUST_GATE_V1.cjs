#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = process.cwd();
const files = {
  projection: path.join(root, 'apps/server/src/projections/operation_state_v1.ts'),
  acceptanceEngine: path.join(root, 'apps/server/src/domain/acceptance/acceptance_engine_v1.ts'),
  acceptanceRules: path.join(root, 'apps/server/src/domain/acceptance/acceptance_rules_v1.ts'),
  acceptanceTypes: path.join(root, 'apps/server/src/domain/acceptance/types.ts'),
  route: path.join(root, 'apps/server/src/routes/operation_state_v1.ts'),
};

function read(file) {
  return fs.readFileSync(file, 'utf8');
}

function assert(condition, message) {
  if (!condition) {
    console.error(`[operation-state-trust-gate] FAIL: ${message}`);
    process.exit(1);
  }
}

function assertIncludes(text, needle, label) {
  assert(text.includes(needle), `${label} must include ${needle}`);
}

function assertNotIncludes(text, needle, label) {
  assert(!text.includes(needle), `${label} must not include ${needle}`);
}

const projection = read(files.projection);
const acceptanceEngine = read(files.acceptanceEngine);
const acceptanceRules = read(files.acceptanceRules);
const acceptanceTypes = read(files.acceptanceTypes);
const route = read(files.route);

assertIncludes(projection, 'state_source', 'OperationStateV1 trust fields');
assertIncludes(projection, 'formal_status', 'OperationStateV1 trust fields');
assertIncludes(projection, 'formal_acceptance_status', 'OperationStateV1 compatibility fields');
assertIncludes(projection, 'technical_acceptance_hint', 'OperationStateV1 compatibility fields');
assertIncludes(projection, 'TECHNICAL_HINT_NOT_FORMAL_ACCEPTANCE', 'OperationStateV1 technical hint reason');
assertIncludes(projection, 'source_facts', 'OperationStateV1 trust fields');
assertIncludes(projection, 'projection_rule', 'OperationStateV1 trust fields');
assertIncludes(projection, 'freshness', 'OperationStateV1 trust fields');
assertIncludes(projection, 'blocking_reasons', 'OperationStateV1 trust fields');
assertIncludes(projection, 'fallback_limited', 'OperationStateV1 trust fields');
assertIncludes(projection, 'customer_visible_eligible', 'OperationStateV1 trust fields');

assertNotIncludes(projection, 'function finalStatusFromReceipt', 'operation_state projection');
assertNotIncludes(projection, 'finalStatusFromReceipt(', 'operation_state projection');
assertIncludes(projection, 'formalStatus === "FORMAL_PASS"', 'formal-only SUCCESS rule');
assertIncludes(projection, 'formalStatus === "FORMAL_FAIL"', 'formal-only FAILED rule');
assertIncludes(projection, '? "PENDING_ACCEPTANCE"', 'receipt-only pending acceptance rule');

assertNotIncludes(acceptanceEngine, 'verdict: "PASS"', 'buildAcceptanceResult fallback engine');
assertNotIncludes(acceptanceRules, 'verdict: "PASS"', 'evaluateAcceptance fallback rules');
assertIncludes(acceptanceTypes, '"NEEDS_FORMAL_ACCEPTANCE"', 'AcceptanceVerdict');
assertIncludes(acceptanceTypes, '"INSUFFICIENT_EVIDENCE"', 'AcceptanceVerdict');
assertIncludes(acceptanceEngine, '"NEEDS_FORMAL_ACCEPTANCE"', 'buildAcceptanceResult fallback engine');
assertIncludes(acceptanceEngine, '"INSUFFICIENT_EVIDENCE"', 'buildAcceptanceResult fallback engine');
assertIncludes(acceptanceRules, '"NEEDS_FORMAL_ACCEPTANCE"', 'evaluateAcceptance fallback rules');
assertIncludes(acceptanceRules, '"INSUFFICIENT_EVIDENCE"', 'evaluateAcceptance fallback rules');

assertIncludes(projection, 'hasFormalEvidence: evidenceEvaluation.has_formal_evidence', 'fallback acceptance evidence policy input');
assertIncludes(projection, 'formal_evidence_missing', 'blocking reasons for non-formal evidence');
assertIncludes(acceptanceEngine, 'input.hasFormalEvidence === false', 'buildAcceptanceResult non-formal evidence branch');
assertIncludes(acceptanceRules, 'input.hasFormalEvidence === false', 'evaluateAcceptance non-formal evidence branch');

assertIncludes(projection, 'isFormalAcceptancePayload', 'strict formal acceptance predicate');
assertIncludes(projection, 'formal_acceptance === true', 'strict formal acceptance predicate');
assertIncludes(projection, 'formal_evidence_passed === true', 'strict formal acceptance predicate');
assertIncludes(projection, 'source_lane === "FORMAL_OPERATION"', 'strict formal acceptance predicate');
assertIncludes(projection, 'const fallbackLimited = !hasFormalAcceptance', 'fallback limited assignment');
assertIncludes(projection, 'fallback_limited: fallbackLimited', 'fallback limited output');
assertIncludes(projection, 'customer_visible_eligible: formalStatus === "FORMAL_PASS" && !fallbackLimited', 'customer visibility formal pass rule');
assertIncludes(projection, 'formal_acceptance_required', 'formal acceptance blocking reason');
assertIncludes(projection, 'toNonFormalAcceptanceRawStatus', 'non-formal raw acceptance status mapper');
assertIncludes(projection, 'status: receipt ? "PENDING"', 'non-formal acceptance status downgrade');
assertIncludes(projection, 'raw_status: nonFormalRawAcceptanceStatus', 'non-formal acceptance raw status downgrade');
assertNotIncludes(projection, 'status: toProjectionAcceptanceStatus(fallbackAcceptance.verdict)', 'operation_state fallback acceptance status');
assertNotIncludes(projection, 'raw_status: fallbackAcceptance.verdict', 'operation_state fallback acceptance raw status');

assertIncludes(route, 'projectOperationStateV1(pool, tenant)', 'operation state route projection usage');
assertNotIncludes(route, 'customer_visible_eligible:', 'operation_state route must not derive customer_visible_eligible');
assertNotIncludes(route, 'fallback_limited:', 'operation_state route must not derive fallback_limited');

const fixture = String.raw`
(async () => {
const mod = await import('./src/projections/operation_state_v1.ts');
const { projectOperationStateFromFacts } = mod;
const ts = '2026-01-01T00:00:00.000Z';
function fact(fact_id, occurred_at, type, payload) {
  return { fact_id, occurred_at, record_json: { type, payload } };
}
function assertRuntime(condition, message) {
  if (!condition) throw new Error(message);
}
const baseFacts = [
  fact('plan_1', ts, 'operation_plan_v1', {
    tenant_id: 'tenantA', project_id: 'projectA', group_id: 'groupA',
    operation_plan_id: 'op_trust_1', act_task_id: 'task_trust_1', field_id: 'field_1'
  }),
  fact('task_1', '2026-01-01T00:01:00.000Z', 'ao_act_task_v0', {
    tenant_id: 'tenantA', project_id: 'projectA', group_id: 'groupA', act_task_id: 'task_trust_1'
  }),
  fact('receipt_1', '2026-01-01T00:02:00.000Z', 'ao_act_receipt_v0', {
    tenant_id: 'tenantA', project_id: 'projectA', group_id: 'groupA', act_task_id: 'task_trust_1', status: 'SUCCESS', logs_refs: ['sim_trace']
  }),
  fact('evidence_1', '2026-01-01T00:03:00.000Z', 'evidence_artifact_v1', {
    tenant_id: 'tenantA', project_id: 'projectA', group_id: 'groupA', operation_plan_id: 'op_trust_1', act_task_id: 'task_trust_1', kind: 'image'
  })
];
const state = projectOperationStateFromFacts(baseFacts)[0];
assertRuntime(state.final_status !== 'SUCCESS', 'receipt SUCCESS must not become formal SUCCESS');
assertRuntime(state.final_status !== 'FAILED', 'receipt SUCCESS must not become formal FAILED');
assertRuntime(state.final_status === 'PENDING_ACCEPTANCE', 'receipt executed without formal acceptance must remain PENDING_ACCEPTANCE');
assertRuntime(state.acceptance.status !== 'PASS', 'fallback acceptance must not PASS');
assertRuntime(state.acceptance.status !== 'FAIL', 'fallback acceptance must not FAIL');
assertRuntime(state.acceptance.raw_status !== 'PASS', 'fallback acceptance raw_status must not PASS');
assertRuntime(state.acceptance.raw_status !== 'FAIL', 'fallback acceptance raw_status must not FAIL');
assertRuntime(['NEEDS_FORMAL_ACCEPTANCE', 'INSUFFICIENT_EVIDENCE'].includes(state.acceptance.raw_status), 'fallback raw_status must be weak/non-formal');
assertRuntime(state.technical_acceptance_hint && state.technical_acceptance_hint.reason === 'TECHNICAL_HINT_NOT_FORMAL_ACCEPTANCE', 'fallback technical hint must be present');
assertRuntime(state.formal_acceptance_status === 'NOT_FORMAL', 'fallback formal_acceptance_status must be NOT_FORMAL');
assertRuntime(state.fallback_limited === true, 'fallback_limited must be true without formal acceptance');
assertRuntime(state.customer_visible_eligible === false, 'fallback state must not be customer visible');
assertRuntime(Array.isArray(state.blocking_reasons) && state.blocking_reasons.includes('formal_acceptance_required'), 'blocking_reasons must include formal_acceptance_required');

const weakAcceptanceFacts = baseFacts.concat([
  fact('acceptance_weak_1', '2026-01-01T00:04:00.000Z', 'acceptance_result_v1', {
    tenant_id: 'tenantA', project_id: 'projectA', group_id: 'groupA', operation_plan_id: 'op_trust_1', verdict: 'PASS'
  })
]);
const weakState = projectOperationStateFromFacts(weakAcceptanceFacts)[0];
assertRuntime(weakState.final_status !== 'SUCCESS', 'weak acceptance_result_v1 PASS without formal metadata must not become SUCCESS');
assertRuntime(weakState.acceptance.status !== 'PASS', 'weak acceptance_result_v1 PASS must not surface as acceptance.status PASS');
assertRuntime(weakState.acceptance.raw_status !== 'PASS', 'weak acceptance_result_v1 PASS must not surface as acceptance.raw_status PASS');
assertRuntime(weakState.formal_status === 'NOT_FORMAL', 'weak acceptance_result_v1 PASS must not be FORMAL_PASS');
assertRuntime(weakState.formal_acceptance_status === 'NOT_FORMAL', 'weak acceptance_result_v1 PASS must not be formal_acceptance_status FORMAL_PASS');
assertRuntime(weakState.fallback_limited === true, 'weak acceptance_result_v1 PASS must remain fallback_limited');
assertRuntime(weakState.customer_visible_eligible === false, 'weak acceptance_result_v1 PASS must not be customer visible');

const formalAcceptanceFacts = baseFacts.concat([
  fact('acceptance_formal_1', '2026-01-01T00:04:00.000Z', 'acceptance_result_v1', {
    tenant_id: 'tenantA', project_id: 'projectA', group_id: 'groupA', operation_plan_id: 'op_trust_1', verdict: 'PASS', formal_acceptance: true
  })
]);
const formalState = projectOperationStateFromFacts(formalAcceptanceFacts)[0];
assertRuntime(formalState.final_status === 'SUCCESS', 'explicit formal PASS may become SUCCESS');
assertRuntime(formalState.acceptance.status === 'PASS', 'explicit formal PASS may surface as acceptance.status PASS');
assertRuntime(formalState.acceptance.raw_status === 'PASS', 'explicit formal PASS may surface as acceptance.raw_status PASS');
assertRuntime(formalState.formal_status === 'FORMAL_PASS', 'explicit formal PASS must become FORMAL_PASS');
assertRuntime(formalState.formal_acceptance_status === 'FORMAL_PASS', 'explicit formal PASS must become formal_acceptance_status FORMAL_PASS');
assertRuntime(formalState.technical_acceptance_hint === undefined, 'explicit formal PASS must not include technical acceptance hint');
assertRuntime(formalState.fallback_limited === false, 'explicit formal PASS must not be fallback limited');
assertRuntime(formalState.customer_visible_eligible === true, 'explicit formal PASS may be customer visible');
})();
`;

const runtime = spawnSync('pnpm', ['--filter', '@geox/server', 'exec', 'tsx', '-e', fixture], {
  cwd: root,
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'pipe'],
});
if (runtime.status !== 0) {
  process.stderr.write(runtime.stdout || '');
  process.stderr.write(runtime.stderr || '');
  assert(false, 'runtime fixture failed');
}

console.log('[operation-state-trust-gate] PASS');
