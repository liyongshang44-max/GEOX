const fs = require('node:fs');
const path = require('node:path');
const { assert, env, fetchJson, requireOk } = require('./_common.cjs');

function read(rel) {
  return fs.readFileSync(path.resolve(process.cwd(), rel), 'utf8');
}

(async () => {
  const base = env('BASE_URL', 'http://127.0.0.1:3001');
  const token = env('AO_ACT_TOKEN', '');

  const healthz = requireOk(await fetchJson(`${base}/api/admin/healthz`, { method: 'GET', token }), 'admin healthz');
  const openapiResp = await fetchJson(`${base}/api/v1/openapi.json`, { method: 'GET', token });
  assert.equal(openapiResp.status, 200, `openapi status=${openapiResp.status}`);

  const openapi = openapiResp.json ?? {};
  const paths = openapi.paths ?? {};
  const schemas = openapi.components?.schemas ?? {};

  const skillContractSchema = schemas.SkillContractV1 ?? {};
  const skillRunSchema = schemas.SkillRunV1 ?? {};
  const skillTraceSchema = schemas.SkillTraceV1 ?? {};

  const requiredSkillPaths = [
    '/api/v1/skills',
    '/api/v1/skills/{skill_id}',
    '/api/v1/skills/bindings',
    '/api/v1/skills/bindings/override',
    '/api/v1/skill-runs',
  ];

  const categoryEnum = skillContractSchema?.properties?.skill_category?.enum ?? [];
  const requiredContractFields = [
    'skill_id',
    'skill_version',
    'skill_category',
    'input_schema',
    'output_schema',
  ];
  const requiredContractSet = new Set(skillContractSchema?.required ?? []);

  const traceProperties = skillTraceSchema?.properties ?? {};
  const runProperties = skillRunSchema?.properties ?? {};
  const hasMainChainRefs = [
    'recommendation_id',
    'prescription_id',
    'task_id',
    'operation_id',
    'field_id',
    'device_id',
    'trigger_stage',
  ].every((k) => Object.prototype.hasOwnProperty.call(runProperties, k));

  const recommendationContract = read('packages/contracts/src/agronomy/recommendation_v2.ts');
  const prescriptionDomain = read('apps/server/src/domain/prescription/prescription_contract_v1.ts');
  const skillTraceService = read('apps/server/src/services/skill_trace_service.ts');

  const checks = {
    skill_architecture_layer_registered: (
      Object.prototype.hasOwnProperty.call(schemas, 'SkillContractV1')
      && Object.prototype.hasOwnProperty.call(schemas, 'SkillRunV1')
      && Object.prototype.hasOwnProperty.call(schemas, 'SkillTraceV1')
    ),
    skill_registry_service_exists: Object.prototype.hasOwnProperty.call(paths, '/api/v1/skills'),
    skill_binding_service_exists: Object.prototype.hasOwnProperty.call(paths, '/api/v1/skills/bindings'),
    skill_runtime_service_exists: Object.prototype.hasOwnProperty.call(paths, '/api/v1/skill-runs'),
    skill_trace_service_has_trace_responsibility: (
      Object.prototype.hasOwnProperty.call(paths, '/api/v1/skills/{skill_id}')
      && Object.prototype.hasOwnProperty.call(traceProperties, 'trace_id')
      && Object.prototype.hasOwnProperty.call(traceProperties, 'skill_id')
      && Object.prototype.hasOwnProperty.call(traceProperties, 'inputs')
      && Object.prototype.hasOwnProperty.call(traceProperties, 'outputs')
      && /export function buildSkillTraceRef\(/.test(skillTraceService)
      && /export function extractSkillTraceRef\(/.test(skillTraceService)
      && /export function normalizeSkillTrace\(/.test(skillTraceService)
    ),
    skill_categories_supported: (
      categoryEnum.includes('sensing')
      && categoryEnum.includes('agronomy')
      && categoryEnum.includes('device')
      && categoryEnum.includes('acceptance')
      && categoryEnum.includes('roi')
    ),
    skill_contract_shape_supported: requiredContractFields.every((k) => requiredContractSet.has(k)),
    skill_run_query_available: (
      Object.prototype.hasOwnProperty.call(paths, '/api/v1/skill-runs')
      && Boolean(skillRunSchema?.properties?.skill_run_id)
    ),
    skill_run_has_main_chain_refs: hasMainChainRefs,
    recommendation_contains_skill_trace: /skill_trace\?:\s*SkillTraceV1/.test(recommendationContract),
    prescription_contains_skill_trace: /skill_trace:\s*recommendationSkillTrace/.test(prescriptionDomain),
    openapi_contains_skill_paths: requiredSkillPaths.every((p) => Object.prototype.hasOwnProperty.call(paths, p)),
    healthz_ok: Boolean(healthz.ok),
  };

  Object.entries(checks).forEach(([k, v]) => assert.equal(v, true, `check failed: ${k}`));
  process.stdout.write(`${JSON.stringify({ ok: true, checks }, null, 2)}\n`);
})().catch((err) => {
  console.error('[FAIL] ACCEPTANCE_SKILL_ARCHITECTURE_ALIGNMENT_V1', err?.stack || String(err));
  process.exit(1);
});
