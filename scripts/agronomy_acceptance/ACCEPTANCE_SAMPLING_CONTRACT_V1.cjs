const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..', '..');
const contractTs = path.join(root, 'apps/server/src/domain/sampling/sampling_contract_v1.ts');
const contractDoc = path.join(root, 'docs/contracts/SAMPLING_DOMAIN_CONTRACT_V1.md');
const samplingRoute = path.join(root, 'apps/server/src/routes/v1/sampling.ts');

function read(file) {
  return fs.readFileSync(file, 'utf8');
}

function hasAll(text, required) {
  return required.every((x) => text.includes(x));
}

(function main() {
  const ts = read(contractTs);
  const md = read(contractDoc);
  const route = read(samplingRoute);

  const requiredFactTypes = [
    'sampling_plan_v1',
    'sample_receipt_v1',
    'lab_result_import_v1',
    'sampling_acceptance_v1',
  ];

  const requiredHardRules = [
    'sample_receipt created ≠ lab result valid',
    'lab_result_imported ≠ agronomy recommendation',
    'sampling_acceptance PASS ≠ operation success',
    'manual sample data 不得直接写 ProblemState conclusion',
    'lab result 不得直接写 ROI / Field Memory / customer success',
  ];
  const requiredSamplingReasons = [
    'LOW_CONFIDENCE',
    'NUTRIENT_CHECK',
    'SOIL_MOISTURE_VALIDATION',
    'MODEL_GAP',
    'MANUAL_REQUEST',
  ];
  const deprecatedSamplingReasons = ['BASELINE', 'DIAGNOSTIC', 'FOLLOWUP', 'COMPLIANCE'];

  assert.equal(hasAll(ts, requiredFactTypes), true, 'sampling_contract_v1.ts missing required fact types');
  assert.equal(hasAll(md, requiredFactTypes), true, 'SAMPLING_DOMAIN_CONTRACT_V1.md missing required fact types');
  assert.equal(hasAll(ts, requiredHardRules), true, 'sampling_contract_v1.ts missing hard rules');
  assert.equal(hasAll(md, requiredHardRules), true, 'SAMPLING_DOMAIN_CONTRACT_V1.md missing hard rules');
  assert.equal(hasAll(ts, ['SAMPLING_REASONS_V1', ...requiredSamplingReasons]), true, 'sampling_contract_v1.ts missing SAMPLING_REASONS_V1');
  assert.equal(hasAll(route, requiredSamplingReasons), true, 'sampling route missing contract sampling reasons');
  assert.equal(deprecatedSamplingReasons.some((reason) => route.includes(reason)), false, 'sampling route contains deprecated sampling reasons');

  console.log('PASS acceptance sampling contract v1', {
    contractTs,
    contractDoc,
    samplingRoute,
    requiredFactTypes: requiredFactTypes.length,
    requiredHardRules: requiredHardRules.length,
    requiredSamplingReasons: requiredSamplingReasons.length,
  });
})();
