const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..', '..');

function collectTsFiles(dir) {
  const out = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...collectTsFiles(full));
    else if (entry.isFile() && full.endsWith('.ts')) out.push(full);
  }
  return out;
}

const files = [
  ...collectTsFiles(path.join(root, 'apps/server/src/services/sampling')),
  path.join(root, 'apps/server/src/routes/v1/sampling.ts'),
  path.join(root, 'scripts/agronomy_acceptance/ACCEPTANCE_FORMAL_SAMPLING_E2E_V1.cjs'),
];

const forbiddenPatterns = [
  /INSERT\s+INTO\s+operation_state_v1/i,
  /UPDATE\s+operation_state_v1/i,
  /INSERT\s+INTO\s+customer_report/i,
  /UPDATE\s+customer_report/i,
  /INSERT\s+INTO\s+roi_ledger/i,
  /UPDATE\s+roi_ledger/i,
  /INSERT\s+INTO\s+field_memory/i,
  /UPDATE\s+field_memory/i,
  /INSERT\s+INTO\s+derived_sensing_state_index_v1/i,
  /UPDATE\s+derived_sensing_state_index_v1/i,
  /INSERT\s+INTO\s+device_observation_index_v1/i,
  /UPDATE\s+device_observation_index_v1/i,
];

let factsInsertSeen = false;
let factsSelectSeen = false;

for (const file of files) {
  const text = fs.readFileSync(file, 'utf8');
  for (const p of forbiddenPatterns) {
    assert.equal(p.test(text), false, `forbidden projection write found in ${file}: ${p}`);
  }
  if (/INSERT\s+INTO\s+facts/i.test(text)) factsInsertSeen = true;
  if (/SELECT[\s\S]{0,500}FROM\s+facts/i.test(text)) factsSelectSeen = true;
}

assert.equal(factsInsertSeen, true, 'append-only insert into facts missing in sampling scope');
assert.equal(factsSelectSeen, true, 'read model from facts missing in sampling scope');

console.log('PASS acceptance sampling no projection write v1', {
  scanned_files: files.length,
  factsInsertSeen,
  factsSelectSeen,
  forbidden_patterns: forbiddenPatterns.length,
});
