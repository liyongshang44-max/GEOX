// scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_01_REPLAY_DATASET.cjs
// Purpose: validate deterministic S1 generation, role coverage, standard bootstrap Evidence, and optional byte comparison with committed materialized shards.
// Boundary: acceptance only; creates temporary files and performs no database or Runtime write.

'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { generate, sha256 } = require('../mcft/GENERATE_MCFT_CAP_01_REPLAY_DATASET.cjs');

const ROOT = path.resolve(__dirname, '../..');
const MATERIALIZED = path.join(ROOT, 'fixtures/mcft/water_state/replay_v1/materialized');
let pass = 0;
let fail = 0;
function check(condition, message) { if (condition) { pass += 1; console.log(`PASS ${message}`); } else { fail += 1; console.error(`FAIL ${message}`); } }
function files(directory) { return fs.readdirSync(directory, { recursive: true }).filter((entry) => fs.statSync(path.join(directory, entry)).isFile()).map(String).sort(); }
function compareDirectories(a, b) {
  const af = files(a); const bf = files(b); assert.deepEqual(af, bf);
  for (const file of af) assert.equal(sha256(fs.readFileSync(path.join(a, file), 'utf8')), sha256(fs.readFileSync(path.join(b, file), 'utf8')), file);
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mcft-cap-01-s1-'));
const a = path.join(tmp, 'a'); const b = path.join(tmp, 'b');
const ma = generate({ outputDirectory: a }); const mb = generate({ outputDirectory: b });
check(ma.hourly_interval_count === 720, '720 hourly intervals');
check(ma.top_level_record_count === 3604, '3604 top-level records');
check(ma.file_count === 152, '152 deterministic JSONL shards');
check(Object.keys(ma.role_counts).length === 7 && Object.values(ma.role_counts).every((value) => value > 0), 'seven governed roles present');
check(ma.whole_dataset_semantic_hash === mb.whole_dataset_semantic_hash, 'whole-dataset semantic hash deterministic');
try { compareDirectories(a, b); check(true, 'independent generation byte-identical'); } catch (error) { console.error(error); check(false, 'independent generation byte-identical'); }
const firstSoilFile = path.join(a, 'soil_moisture/2026-06-01.jsonl');
const soilRecords = fs.readFileSync(firstSoilFile, 'utf8').trim().split('\n').map(JSON.parse);
const standard = soilRecords.find((record) => record.role_time.observed_at === '2026-06-01T00:50:00.000Z');
check(Boolean(standard), 'standard bootstrap soil observation exists');
check(standard?.canonical_payload?.value === 0.184, 'standard observation canonical value 0.184');
const firstWeather = fs.readFileSync(path.join(a, 'future_weather/2026-06-01.jsonl'), 'utf8').trim().split('\n').map(JSON.parse).find((record) => record.role_time.issued_at === '2026-06-01T00:45:00.000Z');
check(firstWeather?.available_to_runtime_at === '2026-06-01T01:05:00.000Z', 'first future-weather snapshot unavailable at bootstrap tick');
check(firstWeather?.canonical_payload?.points?.length === 72, 'future-weather snapshot has 72 points');
if (process.argv.includes('--require-materialized')) {
  try { compareDirectories(a, MATERIALIZED); check(true, 'committed materialized bytes match generator'); } catch (error) { console.error(error); check(false, 'committed materialized bytes match generator'); }
} else {
  console.log('WARN materialized byte comparison skipped; pass --require-materialized for S1 closure');
}
fs.rmSync(tmp, { recursive: true, force: true });
console.log(`MCFT-CAP-01 S1: ${pass} PASS, ${fail} FAIL`);
if (fail) process.exit(1);
