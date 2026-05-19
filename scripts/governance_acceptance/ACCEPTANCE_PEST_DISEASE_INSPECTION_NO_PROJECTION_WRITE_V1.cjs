#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..', '..');
const scanFiles = [
  'apps/server/src/services/inspection/pest_disease_inspection_service_v1.ts',
  'apps/server/src/routes/v1/inspection.ts',
  'scripts/agronomy_acceptance/ACCEPTANCE_PEST_DISEASE_INSPECTION_API_V1.cjs',
];

const forbiddenTargets = [
  'operation_state_v1',
  'customer_report',
  'roi_ledger',
  'field_memory',
  'derived_sensing_state_index_v1',
  'device_observation_index_v1',
  'spray_prescription',
  'ao_act_task',
];

function read(rel) {
  const file = path.join(root, rel);
  assert.equal(fs.existsSync(file), true, `missing required file: ${file}`);
  return { rel, file, text: fs.readFileSync(file, 'utf8') };
}

function stripCommentsAndStrings(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\/\/.*$/gm, ' ')
    .replace(/`(?:\\.|[^`])*`/g, '`template`')
    .replace(/"(?:\\.|[^"])*"/g, '"string"')
    .replace(/'(?:\\.|[^'])*'/g, "'string'");
}

(function main() {
  const files = scanFiles.map(read);
  const violations = [];

  for (const file of files) {
    const codeOnly = stripCommentsAndStrings(file.text);
    for (const target of forbiddenTargets) {
      const writePattern = new RegExp(`\\b(INSERT\\s+INTO|UPDATE|DELETE\\s+FROM|UPSERT\\s+INTO|CREATE\\s+TABLE|ALTER\\s+TABLE)\\s+[^;]*\\b${target}\\b`, 'i');
      if (writePattern.test(codeOnly)) violations.push(`${file.rel}: forbidden projection write target ${target}`);
    }
  }

  const service = read('apps/server/src/services/inspection/pest_disease_inspection_service_v1.ts').text;
  assert.equal(service.includes('INSERT INTO facts'), true, 'inspection service must append facts');
  assert.equal(service.includes('SELECT fact_id, occurred_at, source, record_json::jsonb AS record_json'), true, 'inspection service must read facts');
  assert.equal(service.includes('INSERT INTO operation_state_v1'), false, 'service must not write operation_state_v1');
  assert.equal(service.includes('INSERT INTO roi_ledger'), false, 'service must not write roi_ledger');
  assert.equal(service.includes('INSERT INTO field_memory'), false, 'service must not write field_memory');
  assert.equal(service.includes('INSERT INTO spray_prescription'), false, 'service must not write spray_prescription');
  assert.equal(service.includes('INSERT INTO ao_act_task'), false, 'service must not write ao_act_task');

  assert.deepEqual(violations, [], `projection write violations:\n${violations.join('\n')}`);

  console.log('PASS acceptance pest disease inspection no projection write v1', {
    scanned: scanFiles,
    forbiddenTargets,
  });
})();
