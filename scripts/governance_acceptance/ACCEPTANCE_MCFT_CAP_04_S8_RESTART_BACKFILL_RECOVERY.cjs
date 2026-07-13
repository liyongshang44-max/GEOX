// scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_04_S8_RESTART_BACKFILL_RECOVERY.cjs
// Purpose: verify the exact CAP-04 S8 restart, bounded backfill and failure-recovery implementation, evidence and file boundary.
// Boundary: repository governance verification only; no Runtime execution, database mutation, route, scheduler, recommendation, decision or field claim.
'use strict';
const cp = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '../..');
const BASELINE = 'bdc3e93ce755e237655f7bfc98b117a6e842d030';
const BRANCH = 'agent/mcft-cap-04-s8-restart-backfill-recovery-v1';
const S8 = 'MCFT-CAP-04.MCFT-03-04-07-09-10.RESTART-BACKFILL-FAILURE-RECOVERY-V1';
const S9 = 'MCFT-CAP-04.CLOSURE-CANDIDATE-V1';
const TASK_SHA = 'ea63e92a64b760b84c49428b1d3a245ce5cd94bb08daa9c6b971a53861b90a63';
const MODE = process.argv.includes('--postmerge') ? 'postmerge' : 'final';
const FILES = ["apps/server/src/runtime/twin_runtime/forecast_scenario_restart_resume_service_v1.ts", "docs/digital_twin/GEOX-DT-02-MCFT-IMPLEMENTATION-MAP.md", "docs/digital_twin/GEOX-MCFT-VERTICAL-CAPABILITY-LINE-MATRIX.json", "docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-AUTHORIZATION-STATUS.json", "docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-DELIVERY-SLICE-STATUS.json", "docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-FAILURE-RECOVERY-CONTRACT.md", "docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-S8-RESTART-BACKFILL-RECOVERY-STATUS.json", "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_04_S8_RESTART_BACKFILL_RECOVERY.cjs", "scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_04_FAILURE_RECOVERY.ts", "scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_04_RESTART_BACKFILL.ts", "scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_04_RESTART_BACKFILL_DB.ts", "scripts/runtime_acceptance/mcft_cap_04_restart_backfill_recovery_fixture_v1.ts"];
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');
const json = (file) => JSON.parse(read(file));
const run = (exe, args) => { const r = cp.spawnSync(exe, args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 128 * 1024 * 1024 }); if (r.error) throw r.error; if (r.status !== 0) throw new Error(`${exe} ${args.join(' ')}\n${r.stdout || ''}\n${r.stderr || ''}`); return String(r.stdout || '').trim(); };
const git = (args) => run(process.platform === 'win32' ? 'git.exe' : 'git', args);
const same = (a, b) => JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());
let pass = 0; let fail = 0;
const check = (v, m) => { if (v) { pass += 1; console.log(`PASS ${m}`); } else { fail += 1; console.error(`FAIL ${m}`); } };
for (const file of FILES) check(fs.existsSync(path.join(ROOT, file)), `file exists: ${file}`);
const task = read('docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-TASK.md');
check(Buffer.byteLength(task, 'utf8') === 77603, 'complete task byte length exact');
check(crypto.createHash('sha256').update(task).digest('hex') === TASK_SHA, 'complete task SHA exact');
const status = json('docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-S8-RESTART-BACKFILL-RECOVERY-STATUS.json');
const auth = json('docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-AUTHORIZATION-STATUS.json');
const delivery = json('docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-DELIVERY-SLICE-STATUS.json');
const matrix = json('docs/digital_twin/GEOX-MCFT-VERTICAL-CAPABILITY-LINE-MATRIX.json');
const cap04 = matrix.capability_lines.find((line) => line.capability_line_id === 'MCFT-CAP-04');
const s8 = delivery.slices.find((slice) => slice.delivery_slice_id === S8);
const s9 = delivery.slices.find((slice) => slice.delivery_slice_id === S9);
check(status.schema_version === 'geox_mcft_cap_04_s8_restart_backfill_recovery_status_v2', 'S8 status schema v2 exact');
check(status.status === 'IMPLEMENTATION_CANDIDATE' && status.implementation_status === 'VALIDATED_PENDING_MERGE', 'S8 candidate status exact');
check(status.baseline_main_commit === BASELINE && status.implementation_branch === BRANCH, 'S8 identity exact');
check(status.activation_effectiveness.activation_postmerge_workflow_run === 29250261737, 'activation postmerge evidence exact');
check(status.runtime_proof.process_1_tick_count === 12 && status.runtime_proof.fresh_process_tick_count === 12, '12 plus 12 restart proof exact');
check(status.runtime_proof.final_checkpoint_sequence === 72, 'final sequence 72 exact');
check(status.runtime_proof.restart_a1_hashes_equal_uninterrupted === true, 'restart A1 hash equality exact');
check(status.runtime_proof.restart_scenario_hashes_equal_uninterrupted === true, 'restart Scenario hash equality exact');
check(status.runtime_proof.bounded_backfill_a1_hashes_equal_uninterrupted === true, 'backfill A1 hash equality exact');
check(status.failure_recovery_proof.stale_fencing === 'PASS', 'stale fencing proof exact');
check(status.failure_recovery_proof.checkpoint_state_forecast_cas === 'PASS', 'CAS proof exact');
check(status.failure_recovery_proof.explicit_forecast_scenario_rebuild.startsWith('PASS_'), 'explicit rebuild proof exact');
check(status.candidate_validation.in_memory_workflow_run === 29251031846, 'in-memory workflow evidence exact');
check(status.candidate_validation.postgresql_restart_workflow_run === 29252000320, 'PostgreSQL restart evidence exact');
check(status.candidate_validation.shared_postgresql_regression_workflow_run === 29251564080, 'shared PostgreSQL regressions exact');
check(same(status.exact_changed_file_boundary, FILES), 'status exact changed-file boundary');
check(auth.active_delivery_slice_id === S8 && auth.implementation_status === 'S8_IMPLEMENTATION_CANDIDATE', 'authorization active S8 candidate');
check(same(auth.exact_changed_file_boundary, FILES), 'authorization exact boundary mirror');
check(delivery.status === 'S8_IMPLEMENTATION_CANDIDATE' && delivery.active_delivery_slice_id === S8, 'delivery active S8 candidate');
check(s8.status === 'IMPLEMENTATION_CANDIDATE' && s8.runtime_source_authorized === true, 'delivery S8 candidate authorized');
check(same(s8.exact_changed_file_boundary, FILES), 'delivery S8 exact boundary mirror');
check(s9.status === 'BLOCKED' && s9.runtime_source_authorized === false, 'S9 remains blocked');
check(cap04.active_delivery_slice_id === S8 && cap04.implementation_status === 'S8_IMPLEMENTATION_CANDIDATE', 'matrix active S8 candidate');
check(cap04.next_delivery_slice_id === S9 && cap04.next_delivery_slice_authorized === false, 'matrix S9 unauthorized');
const service = read('apps/server/src/runtime/twin_runtime/forecast_scenario_restart_resume_service_v1.ts');
for (const marker of ['resumeFromCheckpointV1', 'runContiguousRange', 'LATE_EVIDENCE_FORWARD_BACKFILL_FORBIDDEN', 'CAP04_BACKFILL_START_NOT_PERSISTED_NEXT_TICK', 'CHECKPOINT_PROJECTION_DIVERGENCE']) check(service.includes(marker), `service marker ${marker}`);
check(!service.includes('commitARecordSet(') && !service.includes('commitScenarioSet('), 'orchestrator performs no direct persistence');
const contract = read('docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-FAILURE-RECOVERY-CONTRACT.md');
for (const marker of ['12 ticks -> fresh service composition -> 12 ticks', 'ALREADY_COMPLETE', 'Stale token', 'Projection divergence']) check(contract.includes(marker), `contract marker ${marker}`);
for (const [file, markers] of Object.entries({
  'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_04_RESTART_BACKFILL.ts': ['fresh service composition uses explicit RESUME intent', 'bounded forward backfill A1 hashes equal uninterrupted hashes', 'completed target retry performs zero Evidence loads'],
  'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_04_FAILURE_RECOVERY.ts': ['A response-loss retry creates no duplicate A fact', 'pending-B barrier clears B before exactly one genuinely new tick', 'projection divergence fails closed before range delegation'],
  'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_04_RESTART_BACKFILL_DB.ts': ['process 1 crash fixture explicitly expires its lease', 'fresh PostgreSQL service composition resumes at tick 13', 'canonical facts equal 192 A members + 24 B sets + 24 Configs'],
})) { const content = read(file); for (const marker of markers) check(content.includes(marker), `${file} marker ${marker}`); }
const range = MODE === 'postmerge' ? `${BASELINE}...HEAD` : BASELINE;
const tracked = git(['diff', '--name-only', range]).split(/\r?\n/).filter(Boolean);
const untracked = MODE === 'postmerge' ? [] : git(['ls-files', '--others', '--exclude-standard']).split(/\r?\n/).filter(Boolean);
const changed = [...new Set([...tracked, ...untracked])].sort();
check(same(changed, FILES), `${MODE} exact changed-file boundary`);
check(changed.every((file) => !file.startsWith('.github/workflows/')), 'no workflow changed');
check(changed.every((file) => !file.startsWith('.cap04-s8')), 'no temporary S8 file changed');
check(changed.every((file) => !file.startsWith('apps/server/db/migrations/')), 'no migration changed');
check(changed.every((file) => !file.startsWith('apps/server/src/routes/')), 'no route changed');
check(changed.every((file) => !file.startsWith('apps/web/')), 'no web changed');
if (MODE === 'postmerge') {
  check(git(['branch', '--show-current']) === 'main', 'postmerge runs on main');
  check(git(['rev-parse', 'HEAD']) === git(['rev-parse', 'origin/main']), 'postmerge main equals origin/main');
} else {
  check(git(['branch', '--show-current']) === BRANCH, 'candidate branch exact');
  check(git(['rev-parse', 'origin/main']) === BASELINE, 'origin main baseline exact');
}
try { git(['diff', '--check', range]); check(true, 'git diff --check PASS'); } catch { check(false, 'git diff --check PASS'); }
console.log(`MCFT-CAP-04 S8 governance ${MODE}: ${pass} PASS, ${fail} FAIL`);
if (fail > 0) process.exit(1);
