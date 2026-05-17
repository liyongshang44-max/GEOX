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

console.log('PASS acceptance sampling api v1', { routeFile, serviceFile, routes: requiredRoutes.length });
