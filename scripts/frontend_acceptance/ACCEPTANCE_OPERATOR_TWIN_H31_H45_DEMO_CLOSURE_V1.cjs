#!/usr/bin/env node
// scripts/frontend_acceptance/ACCEPTANCE_OPERATOR_TWIN_H31_H45_DEMO_CLOSURE_V1.cjs
'use strict';

// Purpose: verify the Operator Twin demo closure wires H31-H45 read surfaces.
// Boundary: this static check must not write facts, create approvals, dispatch, create tasks, write ROI, or write Field Memory.
// H51.3 boundary: the seed must contain a schema-contract preflight before writing projection index rows.
// H51.4 boundary: the read model must project H45 verification verdict fields into response_summary.
// H51.5 boundary: the H40-H45 operator frontend must render Chinese readable copy, not raw engineering-only labels.
// H51.6 boundary: forecast and scenario pages must render Chinese readable labels while preserving audit codes.

const fs = require('node:fs');
const { spawnSync } = require('node:child_process');

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

function ok(condition, message) {
  if (!condition) throw new Error(message);
  console.log('[operator-twin-h31-h45-demo-closure] ok:', message);
}

const route = read('apps/server/src/routes/v1/operator_twin_h31_h45_closure.ts');
const register = read('apps/server/src/modules/operator/registerOperatorModule.ts');
const api = read('apps/web/src/api/operatorTwinClosure.ts');
const workspace = read('apps/web/src/features/operator/pages/OperatorFieldTwinWorkspacePage.tsx');
const post = read('apps/web/src/features/operator/pages/OperatorFieldTwinPostIrrigationPage.tsx');
const forecast = read('apps/web/src/features/operator/pages/OperatorFieldTwinForecastPage.tsx');
const scenario = read('apps/web/src/features/operator/pages/OperatorFieldTwinScenarioComparePage.tsx');
const scenarioSubmit = read('apps/web/src/features/operator/components/SubmitScenarioToRecommendationPanel.tsx');
const evidenceTrace = read('apps/web/src/features/operator/components/EvidenceTracePanel.tsx');
const coverageMatrix = read('apps/web/src/features/operator/components/DataCoverageMatrix.tsx');
const qualitySummary = read('apps/web/src/features/operator/components/QualitySummaryPanel.tsx');
const seed = read('scripts/demo_seed/SEED_OPERATOR_TWIN_H31_H45_DEMO_CLOSURE_V1.cjs');

ok(route.includes('/api/v1/operator/twin/fields/:fieldId/h31-h45-closure'), 'closure route exists');
ok(register.includes('registerOperatorTwinH31H45ClosureRoutes'), 'closure route registered');
ok(route.includes('field_c8_demo') && api.includes('field_c8_demo'), 'literal field id fallback uses field_c8_demo');
ok(workspace.includes('fetchOperatorTwinH31H45Closure'), 'workspace reads closure');
ok(post.includes('fetchOperatorTwinH31H45Closure'), 'post-irrigation page reads closure');

for (const forbidden of ['TASK_NOT_LINKED', 'RECEIPT_MISSING', 'AS_EXECUTED_MISSING', 'ACCEPTANCE_MISSING']) {
  ok(!post.includes(forbidden), forbidden + ' not rendered');
}

ok(post.includes('灌后结论'), 'H51.5 post page has Chinese conclusion card');
ok(post.includes('这次灌溉是否有效'), 'H51.5 post page asks operator-facing question');
ok(post.includes('已观察到灌后响应'), 'H51.5 post page translates RESPONSE_OBSERVED');
ok(post.includes('灌前中度缺水，灌后恢复正常'), 'H51.5 post page translates class transition');
ok(post.includes('查看') && post.includes('条证据引用'), 'H51.5 post page collapses long evidence refs');
ok(post.includes('本页不会执行的动作'), 'H51.5 post page renders Chinese boundary copy');
ok(evidenceTrace.includes('证据追踪'), 'H51.5 evidence trace component is Chinese');
ok(coverageMatrix.includes('数据覆盖矩阵'), 'H51.5 coverage matrix component is Chinese');
ok(qualitySummary.includes('证据质量结论'), 'H51.5 quality summary component is Chinese');
ok(api.includes('class_transition?: string | null'), 'H51.5 web client types expose class_transition');
ok(api.includes('available_water_fraction_delta?: number | string | null'), 'H51.5 web client types expose water fraction delta');

ok(forecast.includes('预测窗口数据加载中'), 'H51.6 forecast page loading copy is Chinese');
ok(forecast.includes('可用预测窗口') && forecast.includes('预测窗口是否受限'), 'H51.6 forecast window labels are Chinese');
ok(forecast.includes('不可用窗口') && forecast.includes('限制原因') && forecast.includes('证据引用'), 'H51.6 forecast evidence and reason labels are Chinese');
ok(forecast.includes('预测风险时间线') && forecast.includes('风险：') && forecast.includes('置信度：'), 'H51.6 forecast risk timeline labels are Chinese');
ok(forecast.includes('预测页只展示预测窗口和风险时间线'), 'H51.6 forecast boundary copy is Chinese');
ok(!forecast.includes('Forecast Panel 数据加载中') && !forecast.includes('available_horizon：') && !forecast.includes('evidence_refs：'), 'H51.6 forecast raw English labels are not rendered');

ok(scenario.includes('情景比较数据加载中'), 'H51.6 scenario page loading copy is Chinese');
ok(scenario.includes('无动作基线是否存在') && scenario.includes('不可用原因'), 'H51.6 scenario status labels are Chinese');
ok(scenario.includes('<th>选项 ID</th>') && scenario.includes('<th>风险变化</th>') && scenario.includes('<th>失败条件</th>'), 'H51.6 scenario table labels are Chinese');
ok(scenario.includes('情景比较可以提交为建议候选'), 'H51.6 scenario boundary copy is Chinese');
ok(!scenario.includes('Scenario Compare 数据加载中') && !scenario.includes('no_action_baseline_present：') && !scenario.includes('evidence_refs：'), 'H51.6 scenario raw English labels are not rendered');
ok(scenarioSubmit.includes('提交情景为建议候选') && scenarioSubmit.includes('选择情景选项'), 'H51.6 scenario submit panel title and selector are Chinese');
ok(scenarioSubmit.includes('操作员 ID') && scenarioSubmit.includes('提交理由') && scenarioSubmit.includes('提交为建议候选'), 'H51.6 scenario submit form labels are Chinese');
ok(scenarioSubmit.includes('仅生成建议候选') && scenarioSubmit.includes('approval_created=false'), 'H51.6 scenario submit boundary remains explicit');

ok(route.includes('responseSummaryFromWaterResponse'), 'route centralizes H45 response summary mapping');
ok(route.includes('firstNumber'), 'route preserves numeric H45 response deltas');
ok(route.includes('waterResponse?.response_verdict'), 'route reads index response_verdict');
ok(route.includes('waterResponse?.class_transition'), 'route reads index class_transition');
ok(route.includes('available_water_fraction_delta'), 'route reads available water fraction delta');
ok(route.includes('weighted_matric_potential_kpa_delta'), 'route reads weighted matric potential delta');
ok(route.includes('response_verdict: responseVerdict || null'), 'response_summary exposes response_verdict');
ok(route.includes('class_transition: classTransition || null'), 'response_summary exposes class_transition');
ok(route.includes('status: firstText(responseVerdict, "UNKNOWN")'), 'response_summary status uses response verdict before UNKNOWN');
ok(route.includes('verification_id: firstText(waterResponsePayload.verification_id, waterResponse?.verification_id)'), 'response_summary exposes verification id');
ok(route.includes('row.verification_id'), 'index verification id is included in evidence refs');
ok(route.includes('firstText(responseSummary.response_verdict, responseSummary.class_transition'), 'H45 stage summary reads response verdict and class transition');

ok(seed.includes('as_executed_record_v1'), 'seed includes as_executed_record_v1');
ok(seed.includes('evidence_artifact_v1'), 'seed includes evidence_artifact_v1');
ok(seed.includes('acceptance_result_v1'), 'seed includes acceptance_result_v1');
ok(seed.includes('water_response_verification_v1'), 'seed includes water_response_verification_v1');
ok(seed.includes('water_response_verification_index_v1'), 'seed includes water_response_verification_index_v1');
ok(seed.includes('skipped_by_default'), 'seed skips base seed by default');
ok(seed.includes("const ZONE_ID = 'zone_c8_root_zone_001'"), 'seed defines zone id');
ok(seed.includes("const SEASON_ID = 'season_2026_c8_corn'"), 'seed defines season id');
ok(seed.includes("const ZONE_ID = 'zone_c8_root_zone_001'"), 'seed defines zone id');
ok(seed.includes("const PRE_WATER_STATE_ID = 'wstate_c8_irrigation_pre_001'"), 'seed defines pre-state id');
ok(seed.includes("const POST_WATER_STATE_ID = 'wstate_c8_irrigation_post_response_001'"), 'seed defines post-state id');
ok(seed.includes("const POST_SENSING_WINDOW_ID = 'sw_c8_soil_moisture_post_irrigation_001'"), 'seed defines sensing window id');
ok(seed.includes('season_id: SEASON_ID'), 'seed writes season id into closure rows');
ok(seed.includes('expected_interval_ms: 60000'), 'seed supplies expected_interval_ms');
ok(seed.includes('min_total_samples_required: 3'), 'seed supplies min_total_samples_required');
ok(seed.includes('max_allowed_gap_ms: 120000'), 'seed supplies max_allowed_gap_ms');
ok(seed.includes('SEED_ROW_MISSING_REQUIRED_COLUMNS'), 'seed defines required-column preflight error');
ok(seed.includes('loadTableSchema'), 'seed loads table schema before index writes');
ok(seed.includes('preflightSeedRow'), 'seed preflights each row before insert');
ok(seed.includes('preflightIndexRows'), 'seed runs projection preflight before facts/index insert');
ok(seed.includes('zone_id: ids.zone_id'), 'seed writes response verification zone_id');
ok(seed.includes('acceptance_result_fact_id: acceptanceResultFactId'), 'seed writes response verification acceptance_result_fact_id');
ok(seed.includes('pre_state_id: ids.pre_state_id'), 'seed writes response verification pre_state_id');
ok(seed.includes('post_state_id: ids.post_state_id'), 'seed writes response verification post_state_id');
ok(seed.includes("response_verdict: 'RESPONSE_OBSERVED'"), 'seed writes response_verdict');
ok(seed.includes("class_transition: 'MODERATE_DEFICIT_TO_NORMAL'"), 'seed writes class_transition');
ok(seed.includes('source_fact_id: waterResponseFactId'), 'seed writes response verification source_fact_id');
ok(seed.includes('created_at: occurredAt'), 'seed writes created_at');
ok(seed.includes('deleteExistingRow'), 'seed deletes matching demo row before insert');
ok(!seed.includes("insertRows(client, 'roi_ledger_v1'"), 'seed does not write roi_ledger_v1');
ok(!seed.includes("insertRows(client, 'field_memory_v1'"), 'seed does not write field_memory_v1');
ok(!seed.includes("insertRows(client, 'operation_state_v1'"), 'seed does not write operation_state_v1');

const run = spawnSync(process.execPath, ['scripts/demo_seed/SEED_OPERATOR_TWIN_H31_H45_DEMO_CLOSURE_V1.cjs', '--dry-run', '--tenant', 'tenantA'], { encoding: 'utf8' });

ok(run.status === 0, 'seed dry-run succeeds');

const payload = JSON.parse(run.stdout);

ok(payload.base_seed === 'skipped_by_default', 'dry-run declares base seed skipped by default');
ok(payload.contract_pass === 'H51.3_DEMO_SEED_SCHEMA_CONTRACT_PASS', 'dry-run declares H51.3 contract pass');
ok(payload.season_id === 'season_2026_c8_corn', 'dry-run declares season id');
ok(payload.zone_id === 'zone_c8_root_zone_001', 'dry-run declares zone id');
ok(payload.pre_state_id === 'wstate_c8_irrigation_pre_001', 'dry-run declares pre-state id');
ok(payload.post_state_id === 'wstate_c8_irrigation_post_response_001', 'dry-run declares post-state id');
ok(payload.sensing_window_id === 'sw_c8_soil_moisture_post_irrigation_001', 'dry-run declares sensing window id');
ok(payload.as_executed_id === 'as_executed_c8_irrigation_formal_001', 'dry-run declares as-executed id');
ok(payload.verification_id === 'wrv_c8_irrigation_formal_001', 'dry-run declares verification id');
ok(payload.preflight_error_code === 'SEED_ROW_MISSING_REQUIRED_COLUMNS', 'dry-run declares preflight error code');
ok(payload.generated_facts.includes('as_executed_record_v1'), 'dry-run lists as_executed_record_v1');
ok(payload.generated_facts.includes('evidence_artifact_v1'), 'dry-run lists evidence_artifact_v1');
ok(payload.generated_facts.includes('acceptance_result_v1'), 'dry-run lists acceptance_result_v1');
ok(payload.generated_facts.includes('water_response_verification_v1'), 'dry-run lists water_response_verification_v1');
ok(payload.written_index_tables.includes('water_response_verification_index_v1'), 'dry-run lists water_response_verification_index_v1');
ok(payload.not_written.includes('roi_ledger_v1'), 'dry-run declares roi_ledger_v1 not written');
ok(payload.not_written.includes('field_memory_v1'), 'dry-run declares field_memory_v1 not written');

console.log('[operator-twin-h31-h45-demo-closure] PASS');
