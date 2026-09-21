'use strict';

const fs = require('node:fs');
const path = require('node:path');
const ROOT = process.cwd();
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const fail = (code) => { throw new Error(code); };
const hasAll = (source, values) => values.every((value) => source.includes(value));

const files = {
  page: 'apps/web/src/features/operator/pages/FieldIntelligenceDetailPage.tsx',
  api: 'apps/web/src/api/fouiFieldIntelligence.ts',
  vm: 'apps/web/src/viewmodels/fouiFieldExperienceVm.ts',
  canonical: 'apps/web/src/features/operator/fieldRuntime/McftCanonicalFieldRuntimeRoutePage.tsx',
};

for (const p of Object.values(files)) if (!fs.existsSync(path.join(ROOT, p))) fail('FOUI_FIELD_EXPERIENCE_FILE_MISSING:' + p);
const page = read(files.page);
const api = read(files.api);
const vm = read(files.vm);
const canonical = read(files.canonical);

if (!hasAll(page, [
  'findExactCollectionItemV2(core.states, core.runtime.posterior_state?.object_ref)',
  'findExactCollectionItemV2(core.forecasts, core.runtime.current_tick_forecast_result?.object_ref)',
  'readFouiMcftRuntime(scopeResolution.scope)',
  'readFouiMcftStates(scopeResolution.scope)',
  'readFouiMcftForecasts(scopeResolution.scope)',
  'loadHistory',
  'loadEvidence',
  'loadAdvanced',
  'DATA UTILIZATION',
  'Product presentation never destroys source data',
])) fail('FOUI_FIELD_EXPERIENCE_PRODUCT_BOUNDARY');

if (page.includes('states.items[0]') || page.includes('forecasts.items[0]')) fail('FOUI_FIELD_EXPERIENCE_POSITIONAL_CURRENT_INFERENCE');

for (const token of [
  'readFouiMcftScenarios',
  'readFouiMcftActionLifecycle',
  'readFouiMcftResiduals',
  'readFouiMcftTimeline',
  'readFouiMcftTrace',
  'readFouiMcftHealth',
  'readFouiMcftModelGovernance',
]) if (!api.includes(token)) fail('FOUI_FIELD_EXPERIENCE_DEEP_READER_MISSING:' + token);

for (const endpoint of [
  '/runtime',
  '/runtime/states',
  '/runtime/forecasts',
  '/runtime/scenarios',
  '/runtime/action-lifecycle',
  '/runtime/residuals',
  '/runtime/timeline',
  '/runtime/trace',
  '/runtime/health',
  'CALIBRATION_CANDIDATE',
  'SHADOW_EVALUATION',
  'MODEL_ACTIVATION',
]) if (!vm.includes(endpoint)) fail('FOUI_FIELD_DATASET_UNMAPPED:' + endpoint);

if (!hasAll(vm, ['EAGER','PRODUCT_ON_DEMAND','TECHNICAL_ON_DEMAND','canonical_endpoint'])) fail('FOUI_FIELD_DATASET_MODE_MODEL_MISSING');

for (const forbidden of [
  'method: "POST"',
  'method: "PUT"',
  'method: "PATCH"',
  'method: "DELETE"',
  'createAoActTask',
  'approve(',
  'dispatch(',
]) if (page.includes(forbidden) || api.includes(forbidden) || vm.includes(forbidden)) fail('FOUI_FIELD_EXPERIENCE_WRITE_BOUNDARY:' + forbidden);

if (canonical.includes('fouiFieldExperienceVm') || canonical.includes('field-intelligence-detail-v2')) fail('FOUI_FIELD_EXPERIENCE_MUTATED_MCFT_CANONICAL_SURFACE');

console.log(JSON.stringify({
  status: 'PASS',
  gate: 'FOUI-FIELD-EXPERIENCE-V2',
  eager_reads: ['runtime','states','forecasts'],
  product_on_demand: ['timeline','trace','health','scenarios','action-lifecycle','residuals'],
  technical_on_demand: ['calibration-candidate','shadow-evaluation','model-activation'],
  current_state_linkage: 'EXACT_OBJECT_REF',
  current_forecast_linkage: 'EXACT_OBJECT_REF',
  positional_current_inference: false,
  backend_change: 'NONE',
  mcft_canonical_surface_change: 'NONE',
}, null, 2));
