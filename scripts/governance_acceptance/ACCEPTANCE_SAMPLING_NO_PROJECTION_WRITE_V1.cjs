const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..', '..');
const serviceFile = path.join(root, 'apps/server/src/services/sampling/sampling_service_v1.ts');
const text = fs.readFileSync(serviceFile, 'utf8');

const forbidden = [
  'operation_state_v1',
  'customer_report',
  'roi_ledger',
  'field_memory',
  'derived_sensing_state_index_v1',
  'device_observation_index_v1',
];

for (const token of forbidden) {
  assert.equal(text.includes(token), false, `forbidden projection write token found: ${token}`);
}

assert.equal(text.includes('INSERT INTO facts'), true, 'facts append-only write missing');
console.log('PASS acceptance sampling no projection write v1', { serviceFile, forbidden: forbidden.length });
