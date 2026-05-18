const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..', '..');

function collectFiles(dir, suffixes) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...collectFiles(full, suffixes));
    else if (entry.isFile() && suffixes.some((suffix) => full.endsWith(suffix))) out.push(full);
  }
  return out;
}

const files = [
  ...collectFiles(path.join(root, 'apps/server/src/services/fertilization'), ['.ts']),
  path.join(root, 'apps/server/src/routes/v1/fertilization.ts'),
  path.join(root, 'scripts/agronomy_acceptance/ACCEPTANCE_FERTILIZATION_API_V1.cjs'),
].filter((file) => fs.existsSync(file));

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
let fertilizationFactWritesSeen = false;

for (const file of files) {
  const text = fs.readFileSync(file, 'utf8');
  for (const pattern of forbiddenPatterns) {
    assert.equal(pattern.test(text), false, `forbidden projection write found in ${file}: ${pattern}`);
  }
  if (/INSERT\s+INTO\s+facts/i.test(text)) factsInsertSeen = true;
  if (/SELECT[\s\S]{0,900}FROM\s+facts/i.test(text)) factsSelectSeen = true;
  if (/fertilization_recommendation_v1|fertilization_prescription_v1|fertilization_acceptance_v1|nitrogen_need_assessment_v1/.test(text)) fertilizationFactWritesSeen = true;
}

assert.equal(files.length >= 3, true, 'fertilization no-projection scope should scan service, route, and API gate');
assert.equal(factsInsertSeen, true, 'append-only insert into facts missing in fertilization scope');
assert.equal(factsSelectSeen, true, 'read model from facts missing in fertilization scope');
assert.equal(fertilizationFactWritesSeen, true, 'formal fertilization facts missing in fertilization scope');

console.log('PASS acceptance fertilization no projection write v1', {
  scanned_files: files.length,
  factsInsertSeen,
  factsSelectSeen,
  fertilizationFactWritesSeen,
  forbidden_patterns: forbiddenPatterns.length,
});
