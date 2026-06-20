#!/usr/bin/env node
const chain = ['FIELD_DEMO','operator_scenario_recommendation_submission_v1','decision_recommendation_v1','approval_request_v1','operation_plan_v1','ao_act_task_v0','ao_act_receipt_v1','as_executed_record_v1','evidence_artifact_v1','acceptance_result_v1','roi_ledger_v1'];
console.log(JSON.stringify({ ok: true, seed: 'THREE_SURFACE_LOCAL_DEMO_V1', mode: 'contract-placeholder', field_id: 'FIELD_DEMO', chain, note: 'Local demo seed command is wired; database-specific upserts are intentionally boundary-safe/read-only in this hotfix.' }, null, 2));
