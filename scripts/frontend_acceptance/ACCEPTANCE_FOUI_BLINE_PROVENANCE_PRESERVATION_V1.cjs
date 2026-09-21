'use strict';

const fs = require('node:fs');
const path = require('node:path');
const ROOT = process.cwd();
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const fail = (code) => { throw new Error(code); };
const hasAll = (src, xs) => xs.every((x) => src.includes(x));

const files = {
  approvalsApi: 'apps/web/src/api/operatorApprovals.ts',
  approvalsVm: 'apps/web/src/viewmodels/operatorApprovalsVm.ts',
  approvalsPage: 'apps/web/src/views/operator/OperatorApprovalsPage.tsx',
  dispatchApi: 'apps/web/src/api/operatorDispatch.ts',
  dispatchVm: 'apps/web/src/viewmodels/operatorDispatchVm.ts',
  dispatchPage: 'apps/web/src/views/operator/OperatorDispatchPage.tsx',
  acceptanceApi: 'apps/web/src/api/operatorAcceptance.ts',
  acceptanceVm: 'apps/web/src/viewmodels/operatorAcceptanceVm.ts',
  acceptancePage: 'apps/web/src/views/operator/OperatorAcceptancePage.tsx',
};

for (const p of Object.values(files)) if (!fs.existsSync(path.join(ROOT, p))) fail('BLINE_PROVENANCE_FILE_MISSING:' + p);
const s = Object.fromEntries(Object.entries(files).map(([k,p]) => [k, read(p)]));

if (!hasAll(s.approvalsApi, [
  'requestId?: string | null',
  'operationId?: string | null',
  'operationPlanId?: string | null',
  'requestedByActorId?: string | null',
  'approverId?: string | null',
  'row.request_id ?? row.approval_request_id',
  'row.operation_id ?? row.operationId',
  'row.operation_plan_id ?? row.operationPlanId',
  'row.requested_by_actor_id',
  'row.approver_id',
])) fail('APPROVAL_PROVENANCE_NOT_PRESERVED');

if (!hasAll(s.approvalsVm, [
  'requestIdText',
  'operationIdText',
  'operationPlanIdText',
  'requestedByActorIdText',
  'approverIdText',
])) fail('APPROVAL_VM_PROVENANCE_NOT_PRESERVED');

if (!hasAll(s.approvalsPage, ['请求 ID','作业 ID','作业计划 ID','发起 actor','审批 actor'])) fail('APPROVAL_TECHNICAL_READBACK_MISSING');

if (!hasAll(s.dispatchApi, [
  'actTaskId?: string | null',
  'operationPlanId?: string | null',
  'fieldId?: string | null',
  'row.act_task_id ?? row.task_id',
  'row.operation_plan_id ?? row.operationPlanId',
  'row.field_id ?? row.fieldId',
])) fail('DISPATCH_PROVENANCE_NOT_PRESERVED');

if (!hasAll(s.dispatchVm, ['actTaskIdText','operationIdText','operationPlanIdText','fieldIdText','receiptIdText'])) fail('DISPATCH_VM_PROVENANCE_NOT_PRESERVED');
if (!hasAll(s.dispatchPage, ['AO-ACT 任务 ID','作业计划 ID','田块 ID','执行回执 ID'])) fail('DISPATCH_TECHNICAL_READBACK_MISSING');

if (!hasAll(s.acceptanceApi, [
  'operationPlanId?: string | null',
  'fieldId?: string | null',
  'row.operation_plan_id ?? row.operationPlanId',
  'row.field_id ?? row.fieldId',
])) fail('ACCEPTANCE_PROVENANCE_NOT_PRESERVED');

if (!hasAll(s.acceptanceVm, ['operationPlanIdText','fieldIdText','acceptanceIdText','operationStateText'])) fail('ACCEPTANCE_VM_PROVENANCE_NOT_PRESERVED');
if (!hasAll(s.acceptancePage, ['作业计划 ID','田块 ID','验收记录 ID'])) fail('ACCEPTANCE_TECHNICAL_READBACK_MISSING');

for (const source of [s.approvalsApi, s.dispatchApi, s.acceptanceApi]) {
  if (/operationPlanId:\s*text\(row\.field_name/i.test(source)) fail('PROVENANCE_HEURISTIC_FROM_FIELD_NAME');
  if (/operationPlanId:\s*text\(row\.updated_at/i.test(source)) fail('PROVENANCE_HEURISTIC_FROM_TIMESTAMP');
}

console.log(JSON.stringify({
  status: 'PASS',
  gate: 'FOUI-BLINE-PROVENANCE-PRESERVATION-V1',
  approval_refs: ['approval_request_id','request_id','operation_id','operation_plan_id','prescription_id','recommendation_id','requested_by_actor_id','approver_id'],
  dispatch_refs: ['task_id','act_task_id','operation_id','operation_plan_id','field_id','receipt_id'],
  acceptance_refs: ['operation_id','operation_plan_id','field_id','acceptance_id'],
  raw_payload_passthrough: false,
  heuristic_linkage: false,
  backend_change: 'NONE'
}, null, 2));
