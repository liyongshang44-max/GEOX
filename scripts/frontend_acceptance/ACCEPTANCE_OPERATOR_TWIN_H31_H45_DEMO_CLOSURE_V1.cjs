#!/usr/bin/env node
'use strict';

// scripts/frontend_acceptance/ACCEPTANCE_OPERATOR_TWIN_H31_H45_DEMO_CLOSURE_V1.cjs
// Purpose: verify the Operator Twin demo closure wires H31-H45 read surfaces.
// Boundary: this static check must not write facts, create approvals, dispatch, create tasks, write ROI, or write Field Memory.

const fs = require('node:fs');
const { spawnSync } = require('node:child_process');

function read(path) { return fs.readFileSync(path, 'utf8'); }
function ok(condition, message) { if (!condition) throw new Error(message); console.log('[operator-twin-h31-h45-demo-closure] ok:', message); }

const route = read('apps/server/src/routes/v1/operator_twin_h31_h45_closure.ts');
const register = read('apps/server/src/modules/operator/registerOperatorModule.ts');
const api = read('apps/web/src/api/operatorTwinClosure.ts');
const workspace = read('apps/web/src/features/operator/pages/OperatorFieldTwinWorkspacePage.tsx');
const post = read('apps/web/src/features/operator/pages/OperatorFieldTwinPostIrrigationPage.tsx');
const seed = read('scripts/demo_seed/SEED_OPERATOR_TWIN_H31_H45_DEMO_CLOSURE_V1.cjs');

ok(route.includes('/api/v1/operator/twin/fields/:fieldId/h31-h45-closure'), 'closure route exists');
ok(register.includes('registerOperatorTwinH31H45ClosureRoutes'), 'closure route registered');
ok(route.includes('field_c8_demo') && api.includes('field_c8_demo'), 'literal field id fallback uses field_c8_demo');
ok(workspace.includes('fetchOperatorTwinH31H45Closure'), 'workspace reads closure');
ok(post.includes('fetchOperatorTwinH31H45Closure'), 'post-irrigation page reads closure');
for (const forbidden of ['TASK_NOT_LINKED', 'RECEIPT_MISSING', 'AS_EXECUTED_MISSING', 'ACCEPTANCE_MISSING']) ok(!post.includes(forbidden), forbidden + ' not rendered');
ok(seed.includes('SEED_ROW_MISSING_REQUIRED_COLUMNS'), 'seed preflights required schema columns');
ok(seed.includes('requiredColumns'), 'seed reads local required columns');
ok(seed.includes('zone_c8_root_zone_001'), 'seed includes zone id');
ok(seed.includes('pre_state_id') && seed.includes('post_state_id'), 'seed links response verification to pre/post states');
ok(seed.includes('response_verdict') && seed.includes('class_transition'), 'seed fills response verdict fields');
ok(seed.includes('acceptance_result_fact_id'), 'seed fills acceptance result fact id');
for (const type of ['weather_forecast_fact_v1','irrigation_scenario_set_v1','decision_recommendation_v1','approval_request_v1','approval_decision_v1','operation_plan_v1','operation_plan_transition_v1','ao_act_task_v0','ao_act_receipt_v1','as_executed_record_v1','evidence_artifact_v1','acceptance_result_v1','water_response_verification_v1']) ok(seed.includes(type), 'seed includes ' + type);
ok(!seed.includes("insertRows(client, 'roi_ledger_v1'"), 'seed does not write roi_ledger_v1');
ok(!seed.includes("insertRows(client, 'field_memory_v1'"), 'seed does not write field_memory_v1');
ok(!seed.includes("insertRows(client, 'operation_state_v1'"), 'seed does not write operation_state_v1');

const run = spawnSync(process.execPath, ['scripts/demo_seed/SEED_OPERATOR_TWIN_H31_H45_DEMO_CLOSURE_V1.cjs', '--dry-run', '--tenant', 'tenantA'], { encoding: 'utf8' });
ok(run.status === 0, 'seed dry-run succeeds');
const payload = JSON.parse(run.stdout);
ok(payload.base_seed === 'skipped_by_default', 'dry-run declares base seed skipped by default');
ok(payload.zone_id === 'zone_c8_root_zone_001', 'dry-run declares zone id');
ok(payload.season_id === 'season_2026_c8_corn', 'dry-run declares season id');
for (const type of ['weather_forecast_fact_v1','irrigation_scenario_set_v1','decision_recommendation_v1','approval_request_v1','approval_decision_v1','operation_plan_v1','operation_plan_transition_v1','ao_act_task_v0','ao_act_receipt_v1','as_executed_record_v1','evidence_artifact_v1','acceptance_result_v1','water_response_verification_v1']) ok(payload.generated_facts.includes(type), 'dry-run lists ' + type);
ok(payload.written_index_tables.includes('water_response_verification_index_v1'), 'dry-run lists water_response_verification_index_v1');
ok(payload.not_written.includes('roi_ledger_v1'), 'dry-run declares roi_ledger_v1 not written');
ok(payload.not_written.includes('field_memory_v1'), 'dry-run declares field_memory_v1 not written');
console.log('[operator-twin-h31-h45-demo-closure] PASS');
