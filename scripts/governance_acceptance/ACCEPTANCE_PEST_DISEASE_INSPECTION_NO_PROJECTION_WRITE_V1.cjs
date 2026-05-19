#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..', '..');
const scanFiles = [
  'apps/server/src/services/inspection/pest_disease_inspection_service_v1.ts',
  'apps/server/src/routes/v1/inspection.ts',
  'scripts/agronomy_acceptance/ACCEPTANCE_PEST_DISEASE_INSPECTION_API_V1.cjs',
  'scripts/agronomy_acceptance/ACCEPTANCE_PEST_DISEASE_INSPECTION_API_LIVE_V1.cjs',
  'scripts/agronomy_acceptance/ACCEPTANCE_PEST_DISEASE_AO_SENSE_BRIDGE_V1.cjs',
  'scripts/agronomy_acceptance/ACCEPTANCE_FORMAL_PEST_DISEASE_INSPECTION_E2E_V1.cjs',
  'scripts/agronomy_acceptance/ACCEPTANCE_PEST_DISEASE_INSPECTION_REPORT_PROJECTION_V1.cjs',
  'scripts/agronomy_acceptance/ACCEPTANCE_PEST_DISEASE_INSPECTION_GET_CONSISTENCY_V1.cjs',
];

const forbiddenTargets = [
  'operation_state_v1',
  'customer_report',
  'roi_ledger',
  'field_memory',
  'derived_sensing_state_index_v1',
  'device_observation_index_v1',
  'spray_prescription',
  'spot_spray_prescription',
  'ao_act_task',
  'dispatch_command',
];

function read(rel) {
  const file = path.join(root, rel);
  assert.equal(fs.existsSync(file), true, `missing required file: ${file}`);
  return { rel, file, text: fs.readFileSync(file, 'utf8') };
}

function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\/\/.*$/gm, ' ');
}

function assertOnlyFactsInsertions(file) {
  const code = stripComments(file.text);
  const writeMatches = [...code.matchAll(/\b(INSERT\s+INTO|UPDATE|DELETE\s+FROM|UPSERT\s+INTO|CREATE\s+TABLE|ALTER\s+TABLE)\s+([`"']?)([a-zA-Z0-9_\.]+)/gi)];
  const illegal = [];
  for (const match of writeMatches) {
    const op = String(match[1] ?? '').replace(/\s+/g, ' ').toUpperCase();
    const target = String(match[3] ?? '').toLowerCase();
    if (op === 'INSERT INTO' && target === 'facts') continue;
    illegal.push(`${op} ${target}`);
  }
  assert.deepEqual(illegal, [], `${file.rel}: inspection/acceptance code may only write INSERT INTO facts; found ${illegal.join(', ')}`);
}

(function main() {
  const files = scanFiles.map(read);
  const violations = [];

  for (const file of files) {
    const code = stripComments(file.text);
    assertOnlyFactsInsertions(file);
    for (const target of forbiddenTargets) {
      const writePattern = new RegExp(`\\b(INSERT\\s+INTO|UPDATE|DELETE\\s+FROM|UPSERT\\s+INTO|CREATE\\s+TABLE|ALTER\\s+TABLE)\\s+[^;]*\\b${target}\\b`, 'i');
      if (writePattern.test(code)) violations.push(`${file.rel}: forbidden projection write target ${target}`);
    }
  }

  const service = read('apps/server/src/services/inspection/pest_disease_inspection_service_v1.ts').text;
  assert.equal(service.includes('INSERT INTO facts'), true, 'inspection service must append facts');
  assert.equal(service.includes('SELECT fact_id, occurred_at, source, record_json::jsonb AS record_json'), true, 'inspection service must read facts');
  assert.equal(service.includes('INSERT INTO operation_state_v1'), false, 'service must not write operation_state_v1');
  assert.equal(service.includes('INSERT INTO roi_ledger'), false, 'service must not write roi_ledger');
  assert.equal(service.includes('INSERT INTO field_memory'), false, 'service must not write field_memory');
  assert.equal(service.includes('INSERT INTO spray_prescription'), false, 'service must not write spray_prescription');
  assert.equal(service.includes('INSERT INTO spot_spray_prescription'), false, 'service must not write spot_spray_prescription');
  assert.equal(service.includes('INSERT INTO ao_act_task'), false, 'service must not write ao_act_task');
  assert.equal(service.includes('INSERT INTO dispatch_command'), false, 'service must not write dispatch_command');

  assert.deepEqual(violations, [], `projection write violations:\n${violations.join('\n')}`);

  console.log('PASS acceptance pest disease inspection no projection write v1', {
    scanned: scanFiles,
    forbiddenTargets,
    allowedWriteTarget: 'facts',
  });
})();
