// scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_04_S8_ACTIVATION.cjs
// Purpose: verify S7 merged-main effectiveness reconciliation and the exact governance-only activation boundary for CAP-04 S8 restart/backfill/failure recovery.
// Boundary: governance verification only; no Runtime execution, persistence, route, scheduler, web, recommendation, decision, or field claim.
'use strict';
const cp = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '../..');
const BASELINE = '413908eadf1016d879760da3afc968abdee82342';
const BRANCH = 'agent/mcft-cap-04-s8-activation-v1';
const S7 = 'MCFT-CAP-04.MCFT-04-07-09-10.TWENTY-FOUR-TICK-FORECAST-SCENARIO-RANGE-V1';
const S8 = 'MCFT-CAP-04.MCFT-03-04-07-09-10.RESTART-BACKFILL-FAILURE-RECOVERY-V1';
const S9 = 'MCFT-CAP-04.CLOSURE-CANDIDATE-V1';
const TASK_SHA = 'ea63e92a64b760b84c49428b1d3a245ce5cd94bb08daa9c6b971a53861b90a63';
const MODE = process.argv.includes('--postmerge') ? 'postmerge' : 'final';
const FILES = ["docs/digital_twin/GEOX-DT-02-MCFT-IMPLEMENTATION-MAP.md", "docs/digital_twin/GEOX-MCFT-VERTICAL-CAPABILITY-LINE-MATRIX.json", "docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-AUTHORIZATION-STATUS.json", "docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-DELIVERY-SLICE-STATUS.json", "docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-S7-RANGE-STATUS.json", "docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-S8-RESTART-BACKFILL-RECOVERY-STATUS.json", "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_04_S8_ACTIVATION.cjs"];
const IMPLEMENTATION_FILES = ["apps/server/src/runtime/twin_runtime/forecast_scenario_restart_resume_service_v1.ts", "docs/digital_twin/GEOX-DT-02-MCFT-IMPLEMENTATION-MAP.md", "docs/digital_twin/GEOX-MCFT-VERTICAL-CAPABILITY-LINE-MATRIX.json", "docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-AUTHORIZATION-STATUS.json", "docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-DELIVERY-SLICE-STATUS.json", "docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-FAILURE-RECOVERY-CONTRACT.md", "docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-S8-RESTART-BACKFILL-RECOVERY-STATUS.json", "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_04_S8_RESTART_BACKFILL_RECOVERY.cjs", "scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_04_FAILURE_RECOVERY.ts", "scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_04_RESTART_BACKFILL.ts", "scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_04_RESTART_BACKFILL_DB.ts", "scripts/runtime_acceptance/mcft_cap_04_restart_backfill_recovery_fixture_v1.ts"];
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
const s7 = json('docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-S7-RANGE-STATUS.json');
const s8 = json('docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-S8-RESTART-BACKFILL-RECOVERY-STATUS.json');
const auth = json('docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-AUTHORIZATION-STATUS.json');
const delivery = json('docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-DELIVERY-SLICE-STATUS.json');
const matrix = json('docs/digital_twin/GEOX-MCFT-VERTICAL-CAPABILITY-LINE-MATRIX.json');
const cap04 = matrix.capability_lines.find((line) => line.capability_line_id === 'MCFT-CAP-04');
const d7 = delivery.slices.find((slice) => slice.delivery_slice_id === S7);
const d8 = delivery.slices.find((slice) => slice.delivery_slice_id === S8);
const d9 = delivery.slices.find((slice) => slice.delivery_slice_id === S9);
check(s7.status === 'MERGED_EFFECTIVE' && s7.effectiveness_condition_satisfied === true, 'S7 merged effective exact');
check(s7.implementation_effectiveness.merge_commit === BASELINE, 'S7 merge commit exact');
check(s7.implementation_effectiveness.postmerge_workflow_run === 29248764378, 'S7 postmerge Gate evidence exact');
check(s8.status === 'IMPLEMENTATION_AUTHORIZED' && s8.runtime_source_authorized === true, 'S8 implementation authorized exact');
check(s8.baseline_main_commit === BASELINE && s8.implementation_branch === 'agent/mcft-cap-04-s8-restart-backfill-recovery-v1', 'S8 identity exact');
check(s8.frozen_runtime_objective.process_1_tick_count === 12 && s8.frozen_runtime_objective.fresh_process_tick_count === 12, 'S8 12 plus 12 restart proof frozen');
check(s8.failure_recovery_objective.a1_postcommit_response_loss.startsWith('IDEMPOTENT_'), 'A1 response-loss objective frozen');
check(s8.failure_recovery_objective.b_postcommit_response_loss.startsWith('IDEMPOTENT_'), 'B response-loss objective frozen');
check(s8.failure_recovery_objective.projection_divergence.startsWith('FAIL_CLOSED'), 'projection divergence fail closed frozen');
check(same(s8.exact_activation_changed_file_boundary, FILES), 'activation exact boundary authority');
check(same(s8.frozen_implementation_changed_file_boundary, IMPLEMENTATION_FILES), 'implementation exact boundary frozen');
check(auth.active_delivery_slice_id === S8 && auth.implementation_status === 'S8_IMPLEMENTATION_AUTHORIZED', 'authorization active S8');
check(same(auth.exact_changed_file_boundary, IMPLEMENTATION_FILES), 'authorization implementation boundary mirror');
check(delivery.status === 'S8_IMPLEMENTATION_AUTHORIZED' && delivery.active_delivery_slice_id === S8, 'delivery active S8');
check(d7.status === 'MERGED_EFFECTIVE' && d7.effectiveness_condition_satisfied === true, 'delivery S7 effective');
check(d8.status === 'IMPLEMENTATION_AUTHORIZED' && d8.runtime_source_authorized === true, 'delivery S8 authorized');
check(same(d8.exact_changed_file_boundary, IMPLEMENTATION_FILES), 'delivery S8 boundary mirror');
check(d9.status === 'BLOCKED' && d9.runtime_source_authorized === false, 'S9 remains blocked');
check(cap04.active_delivery_slice_id === S8 && cap04.implementation_status === 'S8_IMPLEMENTATION_AUTHORIZED', 'matrix active S8');
check(cap04.next_delivery_slice_id === S9 && cap04.next_delivery_slice_authorized === false, 'matrix S9 unauthorized');
check(read('docs/digital_twin/GEOX-DT-02-MCFT-IMPLEMENTATION-MAP.md').includes('MCFT-CAP-04 S8 Activation — Restart, Backfill and Failure Recovery'), 'implementation map S8 marker');
const range = MODE === 'postmerge' ? `${BASELINE}...HEAD` : BASELINE;
const tracked = git(['diff', '--name-only', range]).split(/\r?\n/).filter(Boolean);
const untracked = MODE === 'postmerge' ? [] : git(['ls-files', '--others', '--exclude-standard']).split(/\r?\n/).filter(Boolean);
const changed = [...new Set([...tracked, ...untracked])].sort();
check(same(changed, FILES), `${MODE} exact activation boundary`);
check(changed.every((file) => !file.startsWith('.github/workflows/')), 'no workflow in final boundary');
check(changed.every((file) => !file.startsWith('.cap04-s8/')), 'no temporary materializer in final boundary');
if (MODE === 'postmerge') {
  check(git(['branch', '--show-current']) === 'main', 'postmerge runs on main');
  check(git(['rev-parse', 'HEAD']) === git(['rev-parse', 'origin/main']), 'postmerge main equals origin/main');
} else {
  check(git(['branch', '--show-current']) === BRANCH, 'activation branch exact');
  check(git(['rev-parse', 'origin/main']) === BASELINE, 'origin main baseline exact');
}
try { git(['diff', '--check', range]); check(true, 'git diff --check PASS'); } catch { check(false, 'git diff --check PASS'); }
console.log(`MCFT-CAP-04 S8 activation ${MODE}: ${pass} PASS, ${fail} FAIL`);
if (fail > 0) process.exit(1);
