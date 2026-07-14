// scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_05_CONTROLLED_REPLAY_DATASET.cjs
// Purpose: validate deterministic MCFT-CAP-05 S1 feedback Replay Evidence generation, linkage, negative coverage, materialized bytes, and the exact no-canonical-write boundary.
// Boundary: acceptance only; temporary files are allowed, but no database, Runtime, canonical Twin object, network, or wall-clock write.

'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const childProcess = require('node:child_process');
const { generate, sha256 } = require('../mcft/GENERATE_MCFT_CAP_05_FEEDBACK_DATASET.cjs');

const ROOT = path.resolve(__dirname, '../..');
const BASELINE = process.env.MCFT_CAP_05_S1_BASELINE || '55b61b36a7d408ab68c2786499e14bab886d01e2';
const POSTMERGE = process.argv.includes('--postmerge');
const PRECOMMIT = process.argv.includes('--precommit');
const MATERIALIZED = path.join(ROOT, 'fixtures/mcft/water_state/feedback_v1');
const NEGATIVE = path.join(ROOT, 'fixtures/mcft/water_state/negative/MCFT_CAP_05_NEGATIVE_FIXTURES.json');
const STATUS = path.join(ROOT, 'docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-S1-STATUS.json');
const POSITIVE_FILES = ['approval_assertions.jsonl','approved_plans.jsonl','decision_requests.jsonl','et0_context.jsonl','execution_receipts.jsonl','external_dispatch.jsonl','manifest.json','rainfall_context.jsonl','soil_observations.jsonl'];
const EXPECTED_NEGATIVE_CASES = ['CONFLICTING_DUPLICATE','CROSS_HOUR_EXECUTION','EVIDENCE_IDENTITY_CONFLICT','LATE_AFTER_EVIDENCE_WINDOW_FREEZE','LATE_AFTER_LOGICAL_TIME_CUTOFF','MISSING_APPROVAL_ASSERTION','MULTIPLE_EVENT','PLAN_ASSERTION_MISMATCH','WRONG_BINDING','WRONG_SCOPE','WRONG_STATUS','WRONG_UNIT'];
const TEMPORARY_PRECOMMIT_FILES = new Set(['.github/workflows/mcft-cap-05-s1-materialize.yml','.mcft_cap05_s1_materializer.py']);
let pass = 0;
let fail = 0;
function check(condition, label, detail = '') { if (condition) { pass += 1; console.log(`PASS ${label}`); } else { fail += 1; console.error(`FAIL ${label}${detail ? `: ${detail}` : ''}`); } }
function git(args) { return childProcess.execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim(); }
function lines(file) { return fs.readFileSync(file, 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse); }
function compareDirectory(a, b) {
  const af = fs.readdirSync(a).sort();
  const bf = fs.readdirSync(b).sort();
  assert.deepEqual(af, bf);
  for (const file of af) assert.equal(sha256(fs.readFileSync(path.join(a, file), 'utf8')), sha256(fs.readFileSync(path.join(b, file), 'utf8')), file);
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mcft-cap05-s1-'));
const a = path.join(tmp, 'a');
const b = path.join(tmp, 'b');
const na = path.join(tmp, 'negative-a.json');
const nb = path.join(tmp, 'negative-b.json');
const ma = generate({ outputDirectory: a, negativePath: na });
const mb = generate({ outputDirectory: b, negativePath: nb });
check(ma.dataset_id === 'mcft_cap05_feedback_replay_v1', 'dataset identity exact');
check(ma.top_level_evidence_record_count === 8, 'eight positive Replay Evidence records');
check(ma.file_count === 8, 'eight positive JSONL files');
check(ma.negative_fixture_count === 12, 'twelve negative fixtures');
check(ma.whole_dataset_semantic_hash === mb.whole_dataset_semantic_hash, 'whole-dataset semantic hash deterministic');
try { compareDirectory(a, b); check(true, 'independent positive generation byte-identical'); } catch (error) { console.error(error); check(false, 'independent positive generation byte-identical'); }
check(sha256(fs.readFileSync(na, 'utf8')) === sha256(fs.readFileSync(nb, 'utf8')), 'independent negative generation byte-identical');
try { compareDirectory(a, MATERIALIZED); check(true, 'committed positive bytes match generator'); } catch (error) { console.error(error); check(false, 'committed positive bytes match generator'); }
check(sha256(fs.readFileSync(na, 'utf8')) === sha256(fs.readFileSync(NEGATIVE, 'utf8')), 'committed negative bytes match generator');
check(JSON.stringify(fs.readdirSync(MATERIALIZED).sort()) === JSON.stringify(POSITIVE_FILES), 'materialized file inventory exact');

const records = POSITIVE_FILES.filter((file) => file.endsWith('.jsonl')).flatMap((file) => lines(path.join(MATERIALIZED, file)));
const byType = new Map(records.map((record) => [record.record_type, record]));
for (const record of records) {
  check(record.source_record_hash && record.source_record_hash.startsWith('sha256:'), `source semantic hash ${record.record_type}`);
  check(record.evidence_identity_key && record.idempotency_key?.startsWith('sha256:'), `identity and idempotency ${record.record_type}`);
  check(record.available_to_runtime_at === record.role_time.available_to_runtime_at, `availability duplicated exactly ${record.record_type}`);
  check(record.origin_source_kind === 'CONTROLLED_REPLAY_DATASET', `controlled source class ${record.record_type}`);
  check(!('object_type' in record), `no canonical object envelope ${record.record_type}`);
}
const decision = byType.get('controlled_human_decision_request_v1');
const approval = byType.get('approval_assertion_evidence_v1');
const plan = byType.get('approved_irrigation_plan_snapshot_v1');
const dispatch = byType.get('external_dispatch_evidence_v1');
const receipt = byType.get('irrigation_execution_receipt_evidence_v1');
const observation = byType.get('soil_moisture_observation_v1');
check(Boolean(decision && approval && plan && dispatch && receipt && observation), 'all controlled feedback roles present');
check(approval.canonical_payload.decision_request_ref === decision.source_record_id && approval.canonical_payload.decision_request_hash === decision.source_record_hash, 'approval references decision request');
check(plan.canonical_payload.approval_assertion_ref === approval.source_record_id && plan.canonical_payload.approval_assertion_hash === approval.source_record_hash, 'plan references approval assertion');
check(dispatch.canonical_payload.approved_plan_ref === plan.source_record_id && dispatch.canonical_payload.approved_plan_hash === plan.source_record_hash, 'dispatch references approved plan');
check(receipt.canonical_payload.approved_plan_ref === plan.source_record_id && receipt.canonical_payload.external_dispatch_ref === dispatch.source_record_id, 'receipt references plan and dispatch');
check(receipt.available_to_runtime_at < '2026-06-04T02:00:00.000Z', 'receipt available before target State tick cutoff');
check(observation.role_time.observed_at === '2026-06-04T03:00:00.000Z', 'post-execution soil observation exact 03:00');
check(receipt.canonical_payload.actual_amount_mm === 13.6, 'actual amount 13.6 mm');
check(receipt.canonical_payload.spatial_coverage_fraction === 0.91, 'coverage fraction 0.91');
check(receipt.canonical_payload.target_scope_equivalent_irrigation_mm === 12.376, 'target-scope-equivalent irrigation 12.376 mm');
check(plan.canonical_payload.scenario_amount_mm === 15 && plan.canonical_payload.approved_amount_mm === 14, 'scenario and approved amounts separated');
check(plan.canonical_payload.amount_difference_reason_codes.includes('WATER_AVAILABILITY_LIMIT'), 'nonzero amount difference has reason code');
check(records.every((record) => !['twin_decision_record_v1','twin_action_feedback_v1','twin_forecast_residual_v1'].includes(record.record_type)), 'S1 creates no Decision Feedback or Residual canonical objects');

const negative = JSON.parse(fs.readFileSync(NEGATIVE, 'utf8'));
check(JSON.stringify(negative.cases.map((item) => item.case_id).sort()) === JSON.stringify(EXPECTED_NEGATIVE_CASES), 'negative case inventory exact');
const status = JSON.parse(fs.readFileSync(STATUS, 'utf8'));
check(status.status === 'IMPLEMENTATION_CANDIDATE', 'S1 status implementation candidate');
check(status.s0_effectiveness.merged_main_gate === 'PASS', 'S0 merged-main effectiveness recorded');
check(status.runtime_source_changed === false, 'S1 changes no Runtime source');
check(status.canonical_twin_object_fact_delta === 0, 'S1 canonical Twin object fact delta zero');
check(status.replay_evidence_fact_delta === 8, 'S1 Replay Evidence fact delta eight');

let changed = [];
try {
  const range = POSTMERGE ? `${BASELINE}..HEAD` : `${BASELINE}...HEAD`;
  const committed = git(['diff', '--name-only', range]).split(/\r?\n/).filter(Boolean);
  const working = PRECOMMIT ? git(['diff', '--name-only']).split(/\r?\n/).filter(Boolean) : [];
  const untracked = PRECOMMIT ? git(['ls-files', '--others', '--exclude-standard']).split(/\r?\n/).filter(Boolean) : [];
  changed = [...new Set([...committed, ...working, ...untracked])].filter((file) => !PRECOMMIT || !TEMPORARY_PRECOMMIT_FILES.has(file)).sort();
  check(JSON.stringify(changed) === JSON.stringify([...status.exact_changed_file_boundary].sort()), PRECOMMIT ? 'precommit exact final changed-file boundary' : 'git exact changed-file boundary', JSON.stringify(changed));
} catch (error) { console.error(error); check(false, PRECOMMIT ? 'precommit exact final changed-file boundary' : 'git exact changed-file boundary'); }
for (const file of changed) check(!file.startsWith('apps/server/src/') && !file.startsWith('apps/server/db/migrations/') && !file.startsWith('apps/web/'), `no forbidden path ${file}`);
try { git(['diff', '--check', POSTMERGE ? `${BASELINE}..HEAD` : `${BASELINE}...HEAD`]); check(true, 'git diff --check'); } catch (error) { console.error(error); check(false, 'git diff --check'); }
fs.rmSync(tmp, { recursive: true, force: true });
console.log(`MCFT-CAP-05 S1: ${pass} PASS, ${fail} FAIL`);
if (fail) process.exit(1);
