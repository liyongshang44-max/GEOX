const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');
const fixturePath = path.join(root, 'scripts', 'agronomy_acceptance', '_stage1_formal_irrigation_fixture.cjs');
const fixture = fs.readFileSync(fixturePath, 'utf8');

function fail(message) {
  console.error(`[stage1-fixture-raw-sample-contract] FAIL: ${message}`);
  process.exit(1);
}

function assert(condition, message) {
  if (!condition) fail(message);
}

const compact = fixture.replace(/\s+/g, ' ');

assert(!fixture.includes("qc_quality: 'good'"), 'fixture must not use illegal qc_quality good');
assert(!fixture.includes('qc_quality: "good"'), 'fixture must not use illegal qc_quality good');
assert(fixture.includes("qc_quality: 'ok'") || fixture.includes('qc_quality: "ok"'), 'fixture must use qc_quality ok');

const illegalQualityRegexes = [
  /qc_quality\s*:\s*['"]good['"]/,
  /qc_quality\s*:\s*['"]pass['"]/,
  /qc_quality\s*:\s*['"]healthy['"]/,
];
for (const re of illegalQualityRegexes) {
  assert(!re.test(fixture), `fixture contains illegal raw sample quality matching ${re}`);
}

const rawSampleInsert = fixture.match(/INSERT INTO raw_samples[\s\S]*?VALUES[\s\S]*?ON CONFLICT \(sample_id\) DO NOTHING/);
assert(rawSampleInsert, 'fixture must insert raw_samples through explicit raw_samples insert');
assert(rawSampleInsert[0].includes('qc_quality'), 'raw_samples insert must include qc_quality column');
assert(rawSampleInsert[0].includes('source'), 'raw_samples insert must include source column');

const illegalSourceRegexes = [
  /source\s*:\s*['"]sim['"]/,
  /source\s*:\s*['"]simulation['"]/,
  /source\s*:\s*['"]debug['"]/,
  /source\s*:\s*['"]flight_table['"]/,
  /source\s*:\s*['"]human['"]/,
  /source\s*:\s*['"]import['"]/,
  /source\s*:\s*['"]unknown['"]/,
];
for (const re of illegalSourceRegexes) {
  assert(!re.test(fixture), `fixture contains non-formal raw sample source matching ${re}`);
}

assert(/source\s*:\s*['"]device['"]/.test(fixture), 'fixture must use formal raw sample source device');
assert(!compact.includes('ALTER TABLE raw_samples'), 'fixture must not alter raw_samples contract');
assert(!compact.includes('raw_samples_qc_quality_v1_check'), 'fixture must not modify raw_samples qc constraint');

console.log('[stage1-fixture-raw-sample-contract] PASS');
