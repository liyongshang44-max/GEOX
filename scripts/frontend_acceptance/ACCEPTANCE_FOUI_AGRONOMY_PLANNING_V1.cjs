'use strict';

const fs = require('node:fs');
const path = require('node:path');
const ROOT = process.cwd();
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const fail = (code) => { throw new Error(code); };
const hasAll = (source, values) => values.every((value) => source.includes(value));
const lacksAll = (source, values) => values.every((value) => !source.includes(value));

const files = {
  page: 'apps/web/src/features/operator/pages/AgronomyPlanningPage.tsx',
  vm: 'apps/web/src/viewmodels/fouiAgronomyPlanningVm.ts',
  fieldDetail: 'apps/web/src/features/operator/pages/FieldIntelligenceDetailPage.tsx',
};

for (const p of Object.values(files)) if (!fs.existsSync(path.join(ROOT, p))) fail('FOUI_AGRONOMY_FILE_MISSING:' + p);
const page = read(files.page);
const vm = read(files.vm);
const fieldDetail = read(files.fieldDetail);

if (!hasAll(page, [
  'fetchOperatorTwinOverview',
  'fetchOperatorFieldTwinWorkspace',
  'fetchOperatorFieldTwinScenarioCompare',
  'loadWorkspace',
  'loadScenario',
  'READ-ONLY · NO ADR PROMOTION',
  'OPERATOR TWIN RECOMMENDATION CANDIDATE',
  'Candidate ≠ ADR DecisionResult',
  'Scenario 不是 Recommendation，也不是 Decision',
  '/programs',
  '/agronomy/recommendations',
  'recommendation.read',
])) fail('FOUI_AGRONOMY_PRODUCT_BOUNDARY');

if (!hasAll(vm, [
  'FIELD_CONTEXT',
  'SCENARIO_COMPARE',
  'PLANNING_WORKSPACE',
  'RECOMMENDATION_REVIEW',
  'ADR_DECISION_RESULT',
  'NOT_AUTHORIZED_HERE',
  'SPECIALIST_ROUTE',
])) fail('FOUI_AGRONOMY_CAPABILITY_MODEL');

if (!lacksAll(page, [
  'fetchPrograms',
  'fetchProgramPortfolio',
  'fetchAgronomyRecommendations',
  'fetchAgronomyRecommendationsControlPlane',
  'fetchAgronomyRecommendationDetail',
  'submitRecommendationApproval',
  'submitOperatorScenarioRecommendation',
  '../../../api/programs',
])) fail('FOUI_AGRONOMY_FORBIDDEN_SPECIALIST_API_IMPORT');

for (const forbidden of [
  'method: "POST"',
  'method: "PUT"',
  'method: "PATCH"',
  'method: "DELETE"',
  'approve(',
  'dispatch(',
  'createAoActTask',
]) if (page.includes(forbidden) || vm.includes(forbidden)) fail('FOUI_AGRONOMY_WRITE_BOUNDARY:' + forbidden);

if (!hasAll(fieldDetail, [
  'agronomyParams.set("field_id", fieldId)',
  'const agronomyHref',
  'to={agronomyHref}',
])) fail('FOUI_FIELD_TO_AGRONOMY_CONTEXT_LOST');

if (page.includes('ADR DecisionResult =') || page.includes('ADR DecisionResult: AVAILABLE')) fail('FOUI_AGRONOMY_SILENT_ADR_PROMOTION');

console.log(JSON.stringify({
  status: 'PASS',
  gate: 'FOUI-AGRONOMY-PLANNING-V1',
  eager_reads: ['operator_twin_overview'],
  on_demand_reads: ['operator_field_twin_workspace','operator_field_twin_scenario_compare'],
  specialist_routes: ['/programs','/agronomy/recommendations'],
  adr_decision_result: 'NOT_AUTHORIZED_HERE',
  candidate_promoted_to_decision: false,
  write_methods: 'NONE',
  backend_change: 'NONE'
}, null, 2));
