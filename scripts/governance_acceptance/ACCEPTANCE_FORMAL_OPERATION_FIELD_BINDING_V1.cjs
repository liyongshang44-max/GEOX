#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
let failed = false;

function read(rel) {
  const file = path.join(ROOT, rel);
  if (!fs.existsSync(file)) {
    console.error(`[formal-operation-field-binding] missing file: ${rel}`);
    failed = true;
    return '';
  }
  return fs.readFileSync(file, 'utf8');
}

function must(text, pattern, label) {
  if (!pattern.test(text)) {
    console.error(`[formal-operation-field-binding] missing: ${label}`);
    failed = true;
  }
}

function mustNot(text, pattern, label) {
  if (pattern.test(text)) {
    console.error(`[formal-operation-field-binding] forbidden: ${label}`);
    failed = true;
  }
}

const scopeContract = read('packages/contracts/src/schema/formal_operation_spatial_scope_v1.ts');
const planContract = read('packages/contracts/src/schema/operation_plan_v1.ts');
const transitionContract = read('packages/contracts/src/schema/operation_plan_transition_v1.ts');
const aoActV1 = read('apps/server/src/routes/v1/ao_act.ts');
const aoActCore = read('apps/server/src/routes/control_ao_act.ts');
const chainValidator = read('apps/server/src/projections/operation_chain_validator_v1.ts');
const operationReportChain = read('apps/server/src/projections/operation_report_chain_v1.ts');
const operationReportVm = read('apps/web/src/viewmodels/operationReportVm.ts');
const dashboardVm = read('apps/web/src/viewmodels/customerDashboardVm.ts');

must(scopeContract, /FormalOperationSpatialScopeV1/, 'formal operation spatial scope contract');
must(scopeContract, /kind:\s*FormalOperationSpatialScopeKindV1/, 'spatial scope kind field');
must(scopeContract, /"field"[\s\S]*"management_zone"[\s\S]*"prescription_zone"[\s\S]*"device_affected_fields"[\s\S]*"aggregate_only"/, 'spatial scope allowed kinds');
must(scopeContract, /FORMAL_OPERATION_NEEDS_FIELD_BINDING_ERROR_V1\s*=\s*"NEEDS_FIELD_BINDING"/, 'NEEDS_FIELD_BINDING contract constant');
must(scopeContract, /scope\.kind === "aggregate_only"\) return false/, 'aggregate_only is not a formal field binding');
must(scopeContract, /field_id\.trim\(\) !== "\.\.\."/, 'field_id placeholder rejected by contract helper');

must(planContract, /spatial_scope\?:\s*FormalOperationSpatialScopeV1 \| null/, 'operation_plan_v1 exposes spatial_scope');
must(planContract, /"DRAFT"[\s\S]*"UNBOUND"[\s\S]*"NEEDS_FIELD_BINDING"[\s\S]*"AGGREGATE_ONLY"[\s\S]*"INSUFFICIENT_CONTEXT"[\s\S]*"READ_ONLY"/, 'operation_plan_v1 allowed unbound states');
must(transitionContract, /spatial_scope\?:\s*FormalOperationSpatialScopeV1 \| null/, 'operation_plan_transition_v1 exposes spatial_scope');

must(aoActV1, /FORMAL_OPERATION_FIELD_BINDING_ERROR_V1\s*=\s*"NEEDS_FIELD_BINDING"/, 'AO-ACT v1 field binding error');
must(aoActV1, /FORMAL_OPERATION_FIELD_BINDING_MESSAGE_V1\s*=\s*"正式农业作业必须绑定地块或明确空间范围"/, 'AO-ACT v1 customer-safe binding message');
must(aoActV1, /app\.addHook\("preValidation"/, 'AO-ACT v1 preValidation field binding gate');
must(aoActV1, /path !== "\/api\/v1\/actions\/task" && path !== "\/api\/v1\/actions\/task\/from-variable-prescription"/, 'AO-ACT v1 gate covers task creation and variable prescription task creation');
must(aoActV1, /isFormalAgriculturalTask\(body\)/, 'AO-ACT v1 detects formal agricultural task');
must(aoActV1, /hasExplicitFieldBinding\(body\)/, 'AO-ACT v1 requires explicit field binding');
must(aoActV1, /normalizeExplicitFieldBinding\(body\)/, 'AO-ACT v1 normalizes explicit spatial_scope into field_id');
must(aoActV1, /body\.field_id = scopeFieldId/, 'AO-ACT v1 writes spatial_scope field_id into body.field_id');
must(aoActV1, /reply\.status\(422\)\.send\(\{ ok: false, error: FORMAL_OPERATION_FIELD_BINDING_ERROR_V1/, 'AO-ACT v1 rejects missing field binding with 422');
must(aoActV1, /"\.\.\."/, 'AO-ACT v1 rejects placeholder ids');
mustNot(aoActV1, /target\?\.ref[^\n]*\|\|[^\n]*(field_id|fieldId)|field_id[^\n]*\?\?[^\n]*target\?\.ref/, 'AO-ACT v1 must not accept target.ref as field_id fallback');

must(aoActCore, /field_id:\s*String\(parsedBody\.field_id \?\? parsedBody\.meta\?\.field_id \?\? parsedBody\.target\?\.ref \?\? ""\)/, 'legacy core still has target.ref fallback, requiring v1 preValidation guard');

must(chainValidator, /function operationHasFieldBinding/, 'operation chain validates field binding');
must(chainValidator, /node\("field_binding", "地块绑定"/, 'operation chain status includes field_binding node');
must(chainValidator, /chain_flags\.push\("NEEDS_FIELD_BINDING"\)/, 'operation chain emits NEEDS_FIELD_BINDING flag');
must(chainValidator, /operationPlanAuthorized = operationPlanExists[\s\S]*fieldBindingPresent/, 'operation plan cannot authorize without field binding');
must(chainValidator, /roiStatus:[\s\S]*acceptanceStatus === "DONE"/, 'ROI remains downstream of formal acceptance');
must(chainValidator, /memoryStatus:[\s\S]*acceptanceStatus === "DONE"/, 'Field Memory remains downstream of formal acceptance');
must(chainValidator, /raw !== "\.\.\."/, 'chain validator rejects placeholder field ids');

must(operationReportChain, /guardRoiLike\(base\.roi, validation\)/, 'customer report guard blocks ROI when chain validation fails');
must(operationReportChain, /guardFieldMemoryLike\(base\.field_memory, validation\)/, 'customer report guard blocks Field Memory when chain validation fails');
must(operationReportChain, /customer_visible_eligible: passed/, 'customer report visibility follows chain pass');

must(operationReportVm, /chainPassed \? allRoiItems\(roi\)\.filter\(isTrustedCustomerValue\) : \[\]/, 'operation report VM hides ROI unless chain passed');
must(operationReportVm, /const memory = chainPassed \? \(\(report as any\)\.field_memory \?\? \{\}\) : \{\}/, 'operation report VM hides Field Memory unless chain passed');
must(operationReportVm, /后端链路校验未通过，暂不进入客户学习闭环/, 'operation report VM exposes safe Field Memory blocked text');
must(dashboardVm, /未完成复核前不展示执行成功或价值结论/, 'customer dashboard preserves no fake success / no value boundary');

if (failed) {
  console.error('[formal-operation-field-binding] FAIL');
  process.exit(1);
}

console.log('[formal-operation-field-binding] PASS');
