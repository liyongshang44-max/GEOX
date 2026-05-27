#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const files = {
  aoActPrimary: path.join(root, 'apps/server/src/routes/v1/ao_act.ts'),
  aoActControl: path.join(root, 'apps/server/src/routes/control_ao_act.ts'),
  variableTask: path.join(root, 'apps/server/src/domain/prescription/variable_action_task_v1.ts'),
  sensePrimary: path.join(root, 'apps/server/src/routes/v1/sense.ts'),
  senseControl: path.join(root, 'apps/server/src/routes/control_ao_sense.ts'),
  inspection: path.join(root, 'apps/server/src/routes/v1/inspection.ts'),
  variableAcceptance: path.join(root, 'scripts/agronomy_acceptance/ACCEPTANCE_VARIABLE_ACTION_TASK_V1.cjs'),
};

function read(file) { return fs.readFileSync(file, 'utf8'); }
function fail(message) { console.error(`[ao-act-sense-boundary] FAIL: ${message}`); process.exit(1); }
function assert(condition, message) { if (!condition) fail(message); }
function assertIncludes(source, needle, label) { assert(source.includes(needle), `${label} must include ${needle}`); }
function assertNotIncludes(source, needle, label) { assert(!source.includes(needle), `${label} must not include ${needle}`); }
function bodyOf(source, startNeedle, endNeedle) {
  const start = source.indexOf(startNeedle);
  assert(start >= 0, `missing section start: ${startNeedle}`);
  const end = endNeedle ? source.indexOf(endNeedle, start + startNeedle.length) : source.length;
  assert(end > start, `missing section end: ${endNeedle}`);
  return source.slice(start, end);
}

const aoActPrimary = read(files.aoActPrimary);
const aoActControl = read(files.aoActControl);
const variableTask = read(files.variableTask);
const sensePrimary = read(files.sensePrimary);
const senseControl = read(files.senseControl);
const inspection = read(files.inspection);
const variableAcceptance = read(files.variableAcceptance);

assertIncludes(aoActPrimary, 'registerAoActV1Routes(app, pool)', 'AO-ACT primary route must delegate to control AO-ACT v1 routes');
assertNotIncludes(aoActPrimary, 'app.addHook("preHandler"', 'AO-ACT primary route must not intercept variable prescription via preHandler');
assertNotIncludes(aoActPrimary, 'interceptVariablePrescriptionTaskV1', 'AO-ACT primary route must not own variable prescription response');
assertNotIncludes(aoActPrimary, 'writeVariableTaskCandidateV1', 'AO-ACT primary route must not write variable task facts directly');
assertNotIncludes(aoActPrimary, 'reply.send(', 'AO-ACT primary route must not send responses directly');

const fromVariableRouteBlock = bodyOf(
  aoActControl,
  'app.post("/api/v1/actions/task/from-variable-prescription"',
  'app.post("/api/v1/actions/receipt"'
);
assertIncludes(fromVariableRouteBlock, 'createAoActTaskCoreV1', 'from-variable-prescription must use shared AO-ACT task core');
assertIncludes(fromVariableRouteBlock, 'buildVariableActionTaskPayloadV1', 'from-variable-prescription must build variable task payload');
assertIncludes(fromVariableRouteBlock, 'ensureVariableOperationPlanV1', 'from-variable-prescription must anchor variable operation plan');
assertIncludes(fromVariableRouteBlock, 'source: "api/v1/actions/task/from-variable-prescription"', 'from-variable-prescription source must be explicit');
assertNotIncludes(fromVariableRouteBlock, 'postJsonInternal(req', 'from-variable-prescription must not use internal subrequest helper');
assertNotIncludes(fromVariableRouteBlock, 'postJsonInternal(', 'from-variable-prescription must not use internal HTTP subrequest');
assertNotIncludes(fromVariableRouteBlock, 'reply.send(', 'from-variable-prescription must not explicitly send response');
assertNotIncludes(fromVariableRouteBlock, 'sendErrorReply(', 'from-variable-prescription must not use explicit sendErrorReply');
assertNotIncludes(fromVariableRouteBlock, 'status: "ACKED"', 'from-variable route must not write ACKED');
assertNotIncludes(fromVariableRouteBlock, 'to_status: "ACKED"', 'from-variable route must not transition to ACKED');

for (const value of ['FORMAL_PRESCRIPTION', 'EXPLICIT_OPERATOR_INPUT', 'DEMO_DEFAULT']) {
  assertIncludes(variableTask, `"${value}"`, 'variable action parameter source enum');
}
assertIncludes(variableTask, 'time_window: demoDefaultSource', 'time_window source must be declared');
assertIncludes(variableTask, 'duration_sec: demoDefaultSource', 'duration source must be declared');
assertIncludes(variableTask, 'coverage_percent: demoDefaultSource', 'coverage source must be declared');
assertIncludes(variableTask, 'amount: formalPrescriptionSource', 'amount source must be formal prescription');
assertNotIncludes(variableTask, '"helper default"', 'helper default string must be replaced by DEMO_DEFAULT');

assertIncludes(sensePrimary, 'registerAoSenseV1Routes', 'sense primary route registration');
assertIncludes(senseControl, 'receipt_success_is_observation_only: true', 'AO-SENSE receipt observation-only boundary');
assertIncludes(senseControl, 'does_not_imply_ao_act_execution_success: true', 'AO-SENSE not AO-ACT success');
assertIncludes(senseControl, 'does_not_imply_acceptance_pass: true', 'AO-SENSE not acceptance pass');
assertIncludes(senseControl, 'allowed_evidence_ref: "observation_fact_only"', 'AO-SENSE evidence boundary');
assertIncludes(senseControl, 'evidence_validation: "db_fact_type_observation_allowlist_v1"', 'AO-SENSE evidence DB type validation label');
assertIncludes(senseControl, 'validateObservationEvidenceRefShape', 'AO-SENSE receipt structural ref validation helper');
assertIncludes(senseControl, 'validateObservationOnlyEvidenceRefs', 'AO-SENSE receipt DB ref validation helper');
assertIncludes(senseControl, 'SELECT fact_id, record_json::jsonb AS record_json', 'AO-SENSE receipt must query facts table');
assertIncludes(senseControl, 'WHERE fact_id = ANY($1::text[])', 'AO-SENSE receipt must validate referenced facts by id');
assertIncludes(senseControl, 'allowedObservationFactTypes', 'AO-SENSE receipt must use explicit fact type allowlist');
assertIncludes(senseControl, 'new Set(["device_observation_v1", "pest_disease_observation_v1"])', 'AO-SENSE receipt allowlist must include device and pest_disease observation facts');
assertIncludes(senseControl, 'AO_SENSE_OBSERVATION_FACT_NOT_FOUND', 'AO-SENSE missing observation fact guard');
assertIncludes(senseControl, 'AO_SENSE_RECEIPT_REQUIRES_OBSERVATION_FACT_TYPE', 'AO-SENSE wrong fact type guard');
assertIncludes(senseControl, 'ao_act_execution_success: false', 'AO-SENSE explicit non AO-ACT success');
assertIncludes(senseControl, 'acceptance_pass: false', 'AO-SENSE explicit non acceptance pass');
const senseReceiptBlock = bodyOf(senseControl, 'async function handleCreateSenseReceipt', 'async function handleListSenseTasks');
assertNotIncludes(senseReceiptBlock, 'startsWith("obs_")', 'AO-SENSE receipt must not use obs_ prefix validation');
assertNotIncludes(senseReceiptBlock, 'startsWith("observation_")', 'AO-SENSE receipt must not use observation_ prefix validation');
assertNotIncludes(senseReceiptBlock, 'ao_act_receipt_v0', 'AO-SENSE receipt must not write AO-ACT receipt');
assertNotIncludes(senseReceiptBlock, 'operation_plan_v1', 'AO-SENSE receipt must not write operation plan');
assertNotIncludes(senseReceiptBlock, 'operation_plan_transition_v1', 'AO-SENSE receipt must not write operation transition');
assertNotIncludes(senseReceiptBlock, 'SUCCESS', 'AO-SENSE receipt must not write execution success');
assertNotIncludes(senseReceiptBlock, 'SUCCEEDED', 'AO-SENSE receipt must not write execution succeeded');

const pdiAcceptanceBlock = bodyOf(inspection, 'app.post("/api/v1/inspection/pest-disease/acceptance/evaluate"', 'app.get("/api/v1/inspection/pest-disease/:inspection_id"');
assertNotIncludes(pdiAcceptanceBlock, '/api/v1/actions/task', 'PDI acceptance must not call AO-ACT task API');
assertNotIncludes(pdiAcceptanceBlock, 'ao_act_task_v0', 'PDI acceptance must not write AO-ACT task');
assertNotIncludes(pdiAcceptanceBlock, 'SPRAY', 'PDI acceptance must not synthesize spray');
assertNotIncludes(pdiAcceptanceBlock, 'spray', 'PDI acceptance must not synthesize spray');

assertIncludes(variableAcceptance, 'operation_plan_not_auto_acked', 'variable acceptance not auto acked check');
assertIncludes(variableAcceptance, 'operation_plan_transition_not_auto_acked', 'variable acceptance transition not auto acked check');
assertIncludes(variableAcceptance, 'dispatch_ack_not_synthesized', 'variable acceptance dispatch ack check');
assertIncludes(variableAcceptance, 'DEMO_DEFAULT', 'variable acceptance exact demo default check');
assertIncludes(variableAcceptance, 'FORMAL_PRESCRIPTION', 'variable acceptance exact formal prescription source check');

console.log('[ao-act-sense-boundary] PASS');
