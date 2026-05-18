const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..', '..');
const routeFile = path.join(root, 'apps/server/src/routes/v1/sampling.ts');
const serviceFile = path.join(root, 'apps/server/src/services/sampling/sampling_service_v1.ts');

const routeText = fs.readFileSync(routeFile, 'utf8');
const serviceText = fs.readFileSync(serviceFile, 'utf8');

const requiredRoutes = [
  '/api/v1/sampling/plan',
  '/api/v1/sampling/receipt',
  '/api/v1/sampling/lab-result',
  '/api/v1/sampling/plan/:plan_id',
  '/api/v1/sampling/sample/:sample_id',
];

for (const route of requiredRoutes) {
  assert.equal(routeText.includes(route), true, `missing route: ${route}`);
}

for (const factType of ['sampling_plan_v1', 'sample_receipt_v1', 'lab_result_import_v1']) {
  assert.equal(serviceText.includes(factType), true, `missing fact writer for ${factType}`);
}

function extractMethodBody(text, methodName) {
  const start = text.indexOf(`async ${methodName}(`);
  assert.notEqual(start, -1, `missing method: ${methodName}`);

  const openBrace = text.indexOf('{', start);
  assert.notEqual(openBrace, -1, `missing method body open brace: ${methodName}`);

  let depth = 0;
  for (let i = openBrace; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === '{') depth += 1;
    if (ch === '}') depth -= 1;
    if (depth === 0) {
      return text.slice(openBrace, i + 1);
    }
  }

  throw new Error(`unterminated method body: ${methodName}`);
}

function expectIncludesAll(text, required, prefix) {
  for (const field of required) {
    assert.equal(text.includes(field), true, `${prefix} missing field: ${field}`);
  }
}

const createPlanBody = extractMethodBody(serviceText, 'createPlan');
expectIncludesAll(
  createPlanBody,
  ['tenant_id', 'project_id', 'group_id', 'field_id', 'reason', 'sample_type', 'required_points', 'evidence_refs'],
  'createPlan',
);

const createReceiptBody = extractMethodBody(serviceText, 'createReceipt');
expectIncludesAll(
  createReceiptBody,
  ['sample_id', 'chain_of_custody_status', 'collector_actor_id', 'sample_type', 'evidence_refs'],
  'createReceipt',
);

const createLabResultBody = extractMethodBody(serviceText, 'createLabResult');
expectIncludesAll(
  createLabResultBody,
  ['import_id', 'units', 'evidence_refs', 'quality_status'],
  'createLabResult',
);

console.log('PASS acceptance sampling api v1', { routeFile, serviceFile, routes: requiredRoutes.length });
