from __future__ import annotations

import json
import pathlib
import subprocess

ROOT = pathlib.Path(__file__).resolve().parents[1]
BASELINE = "bdc3e93ce755e237655f7bfc98b117a6e842d030"
BRANCH = "agent/mcft-cap-04-s8-restart-backfill-recovery-v1"
S8 = "MCFT-CAP-04.MCFT-03-04-07-09-10.RESTART-BACKFILL-FAILURE-RECOVERY-V1"
S9 = "MCFT-CAP-04.CLOSURE-CANDIDATE-V1"
MAP = "docs/digital_twin/GEOX-DT-02-MCFT-IMPLEMENTATION-MAP.md"
MATRIX = "docs/digital_twin/GEOX-MCFT-VERTICAL-CAPABILITY-LINE-MATRIX.json"
AUTH = "docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-AUTHORIZATION-STATUS.json"
DELIVERY = "docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-DELIVERY-SLICE-STATUS.json"
CONTRACT = "docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-FAILURE-RECOVERY-CONTRACT.md"
STATUS = "docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-S8-RESTART-BACKFILL-RECOVERY-STATUS.json"
GATE = "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_04_S8_RESTART_BACKFILL_RECOVERY.cjs"
FILES = sorted([
    "apps/server/src/runtime/twin_runtime/forecast_scenario_restart_resume_service_v1.ts",
    MAP,
    MATRIX,
    AUTH,
    DELIVERY,
    CONTRACT,
    STATUS,
    GATE,
    "scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_04_FAILURE_RECOVERY.ts",
    "scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_04_RESTART_BACKFILL.ts",
    "scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_04_RESTART_BACKFILL_DB.ts",
    "scripts/runtime_acceptance/mcft_cap_04_restart_backfill_recovery_fixture_v1.ts",
])


def load(path: str):
    return json.loads((ROOT / path).read_text(encoding="utf-8"))


def save(path: str, value) -> None:
    (ROOT / path).write_text(json.dumps(value, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def append_unique(values: list[str], *items: str) -> list[str]:
    for item in items:
        if item not in values:
            values.append(item)
    return values


status = load(STATUS)
status["schema_version"] = "geox_mcft_cap_04_s8_restart_backfill_recovery_status_v2"
status["status_identity"] = "GEOX-MCFT-CAP-04-S8-RESTART-BACKFILL-RECOVERY-STATUS-V2"
status["baseline_main_commit"] = BASELINE
status["implementation_branch"] = BRANCH
status["status"] = "IMPLEMENTATION_CANDIDATE"
status["implementation_status"] = "VALIDATED_PENDING_MERGE"
status["activation_effectiveness"] = {
    "activation_pr_number": 2401,
    "activation_exact_head_commit": "06d0ccab3f1d287f8187c4cec6f4862cbda6291b",
    "activation_exact_head_ci_run": 29249814636,
    "activation_merge_commit": BASELINE,
    "activation_postmerge_probe_pr_number": 2402,
    "activation_postmerge_workflow_run": 29250261737,
    "effectiveness_condition_satisfied": True,
}
status["runtime_proof"] = {
    "uninterrupted_tick_count": 24,
    "process_1_tick_count": 12,
    "fresh_process_tick_count": 12,
    "process_1_checkpoint_sequence_end": 60,
    "fresh_process_checkpoint_sequence_start": 61,
    "final_checkpoint_sequence": 72,
    "fresh_process_persisted_start_logical_time": "2026-06-03T14:00:00.000Z",
    "final_next_logical_time": "2026-06-04T02:00:00.000Z",
    "restart_a1_hashes_equal_uninterrupted": True,
    "restart_scenario_hashes_equal_uninterrupted": True,
    "bounded_backfill_a1_hashes_equal_uninterrupted": True,
    "bounded_backfill_scenario_hashes_equal_uninterrupted": True,
    "completed_target_retry": "ALREADY_COMPLETE_ZERO_EVIDENCE_ZERO_WRITE",
}
status["failure_recovery_proof"] = {
    "a_postcommit_response_loss": "RECOVERED_PENDING_SCENARIO_NO_DUPLICATE_A",
    "b_postcommit_response_loss": "EXISTING_IDEMPOTENT_SUCCESS_NO_DUPLICATE_B",
    "a_success_b_failure": "PENDING_B_CLEARED_BEFORE_NEW_TICK",
    "a2_blocked_stop": "EXPLICIT_BLOCKED_STOP_SUCCESS_POINTER_PRESERVED",
    "cross_variant_terminal_uniqueness": "PASS",
    "scenario_canonical_uniqueness": "PASS",
    "stale_fencing": "PASS",
    "lease_owner_mismatch": "PASS",
    "expired_lease": "PASS",
    "checkpoint_state_forecast_cas": "PASS",
    "projection_divergence": "FAIL_CLOSED_BEFORE_RANGE_DELEGATION",
    "explicit_forecast_scenario_rebuild": "PASS_FROM_APPEND_ONLY_CANONICAL_FACTS",
    "late_evidence_revision": "FORBIDDEN",
}
status["candidate_validation"] = {
    "recursive_typecheck": "PASS",
    "restart_backfill_in_memory": "PASS",
    "failure_recovery_in_memory": "PASS",
    "in_memory_workflow_run": 29251031846,
    "postgresql_restart_resume": "PASS",
    "postgresql_restart_workflow_run": 29252000320,
    "postgresql_process_1_tick_count": 12,
    "postgresql_fresh_process_tick_count": 12,
    "postgresql_final_checkpoint_sequence": 72,
    "postgresql_operation_fact_count": 216,
    "postgresql_config_plus_operation_fact_count": 240,
    "postgresql_forecast_point_count": 1728,
    "postgresql_scenario_point_count": 5184,
    "cap04_persistence_uniqueness_and_rebuild_regression": "PASS",
    "runtime_fencing_and_cas_regression": "PASS",
    "shared_postgresql_regression_workflow_run": 29251564080,
    "governance_final_gate": "PASS_REQUIRED_ON_FINAL_HEAD",
    "repository_exact_head_ci": "PASS_REQUIRED_BEFORE_MERGE",
    "temporary_workflow_removed": True,
    "temporary_trigger_removed": True,
}
status["allowed_claims"] = [
    "CAP04_S8_RESTART_RESUME_PROVEN",
    "CAP04_S8_BOUNDED_FORWARD_BACKFILL_PROVEN",
    "CAP04_S8_RESTART_CHAIN_HASH_EQUIVALENCE_ESTABLISHED",
    "CAP04_S8_A1_RESPONSE_LOSS_IDEMPOTENCY_PROVEN",
    "CAP04_S8_B_RESPONSE_LOSS_IDEMPOTENCY_PROVEN",
    "CAP04_S8_PENDING_SCENARIO_RECOVERY_BARRIER_PROVEN",
    "CAP04_S8_A2_BLOCKED_STOP_PROVEN",
    "CAP04_S8_CROSS_VARIANT_UNIQUENESS_PROVEN",
    "CAP04_S8_STALE_FENCING_FAIL_CLOSED_PROVEN",
    "CAP04_S8_CAS_CONFLICT_FAIL_CLOSED_PROVEN",
    "CAP04_S8_PROJECTION_DIVERGENCE_FAIL_CLOSED_PROVEN",
    "CAP04_S8_EXPLICIT_CANONICAL_REBUILD_PROVEN",
]
status["preserved_nonclaims"] = [
    "NO_ROUTE", "NO_WEB", "NO_SCHEDULER", "NO_NEW_MIGRATION",
    "NO_RECOMMENDATION", "NO_POLICY_EVALUATION", "NO_DECISION", "NO_AO_ACT",
    "NO_CALIBRATION_CANDIDATE", "NO_SHADOW_EVALUATION", "NO_MODEL_ACTIVATION",
    "NO_ACTIVE_MODEL_PARAMETER_CHANGE", "NO_LATE_EVIDENCE_REVISION",
    "NO_CONTINUOUS_RUNTIME", "NO_LIVE_FIELD_CLAIM", "NO_MCFT_GATE_A_CLOSURE",
    "NO_MINIMUM_COMPLETE_FIELD_TWIN_CLAIM",
]
status["boundary_authority"] = "THIS_STATUS_FILE_IS_THE_EXACT_S8_IMPLEMENTATION_FILE_BOUNDARY_AUTHORITY"
status["exact_changed_file_boundary"] = FILES
status["activation_effectiveness_condition_satisfied"] = True
status["implementation_effectiveness_condition_satisfied"] = False
status["successor_authorized"] = False
save(STATUS, status)

contract = '''# GEOX MCFT-CAP-04 S8 Restart, Backfill and Failure-Recovery Contract\n\n## Identity\n\n```text\ncontract_id: MCFT_CAP_04_RESTART_BACKFILL_FAILURE_RECOVERY_V1\ndelivery_slice: MCFT-CAP-04.MCFT-03-04-07-09-10.RESTART-BACKFILL-FAILURE-RECOVERY-V1\nbaseline: bdc3e93ce755e237655f7bfc98b117a6e842d030\nruntime_mode: REPLAY\n```\n\n## Restart authority\n\nRestart starts exclusively from `PrepareNextTickInputServiceV1.resumeFromCheckpointV1`. The persisted checkpoint, terminal Tick, posterior State, latest Forecast result, latest successful Forecast, Runtime Config and Reality Binding are authority. Wall-clock time, caller-provided prior State and reconstruction from projections are forbidden.\n\nThe standard proof is `12 ticks -> fresh service composition -> 12 ticks`. Process 1 ends at checkpoint sequence 60. The fresh composition starts at `2026-06-03T14:00:00.000Z`, ends at sequence 72 and hands off `2026-06-04T02:00:00.000Z`. All 24 A1 aggregate hashes and all 24 Scenario Set aggregate hashes must equal uninterrupted execution.\n\n## Bounded forward backfill\n\nBackfill is forward-only missed-schedule catch-up. Its requested start, when supplied, must equal the persisted `next_tick_logical_time`. Backfill before bootstrap, backward execution, skipped hours and late-Evidence revision are rejected. Completed-target retry returns `ALREADY_COMPLETE` with zero Evidence loads and zero canonical writes.\n\n## Lease and fencing\n\nA fresh process may take authority only after the previous lease has expired or otherwise been lawfully released. The new process acquires a new fencing token. Stale token, foreign owner, expired claim and checkpoint/state/Forecast CAS mismatch fail closed before canonical writes.\n\n## Failure matrix\n\n- A1 committed and response lost: recover canonical A1, create only missing B, no duplicate A facts.\n- B committed and response lost: return existing canonical A1+B, no duplicate B fact.\n- A1 committed and B failed before commit: pending-Scenario barrier creates B before any new tick reads Evidence.\n- Legal A2: return explicit `BLOCKED`, stop the range, write no B and preserve the prior successful-Forecast pointer.\n- A1/A2 cross-variant conflict: reject the second terminal variant.\n- Scenario Set conflict: reject a second canonical Scenario Set for the same Forecast authority.\n- Projection divergence: restart fails closed. Repair is an explicit operator-invoked rebuild from append-only canonical facts; automatic repair in the restart orchestrator is forbidden.\n\n## Implementation boundary\n\nThe S8 service is a thin intent and persisted-authority validator. It delegates execution to `Cap04ForecastScenarioRangeServiceV1`. A second tick loop, direct persistence, new canonical object types, new transaction families, migrations, routes, scheduler, web behavior and late-Evidence revision are forbidden.\n\n## Preserved nonclaims\n\nS8 does not establish continuous Runtime, live-field operation, recommendation, decision, AO-ACT, calibration, model activation, MCFT Gate A closure or Minimum Complete Field Twin completion.\n'''
(ROOT / CONTRACT).write_text(contract, encoding="utf-8")

auth = load(AUTH)
auth["implementation_status"] = "S8_IMPLEMENTATION_CANDIDATE"
auth["baseline_main_commit"] = BASELINE
auth["branch"] = BRANCH
auth["active_delivery_slice_id"] = S8
auth["repository_write_scope"] = "S8_RESTART_BACKFILL_FAILURE_RECOVERY_ONLY"
auth["exact_changed_file_boundary"] = FILES
auth["current_blockers"] = ["MCFT_CAP_04_S8_IMPLEMENTATION_NOT_YET_MERGED", "MCFT_CAP_04_S8_MERGED_MAIN_GATE_NOT_YET_PASS"]
auth["next_authorized_slice_id_after_effectiveness"] = S9
auth["satisfied_conditions"] = append_unique(auth.get("satisfied_conditions", []), "MCFT_CAP_04_S8_ACTIVATION_MERGED_MAIN_EFFECTIVE", "MCFT_CAP_04_S8_IMPLEMENTATION_VALIDATED_PENDING_MERGE")
save(AUTH, auth)

delivery = load(DELIVERY)
delivery["status"] = "S8_IMPLEMENTATION_CANDIDATE"
delivery["baseline_main_commit"] = BASELINE
delivery["branch"] = BRANCH
delivery["active_delivery_slice_id"] = S8
for item in delivery["slices"]:
    if item["delivery_slice_id"] == S8:
        item["status"] = "IMPLEMENTATION_CANDIDATE"
        item["implementation_status"] = "VALIDATED_PENDING_MERGE"
        item["baseline_main_commit"] = BASELINE
        item["branch"] = BRANCH
        item["runtime_source_authorized"] = True
        item["allowed_claims"] = status["allowed_claims"]
        item["preserved_nonclaims"] = status["preserved_nonclaims"]
        item["exact_changed_file_boundary"] = FILES
        item["effectiveness_condition"] = status["implementation_effectiveness_condition"]
        item["effectiveness_condition_satisfied"] = False
    if item["delivery_slice_id"] == S9:
        item["status"] = "BLOCKED"
        item["runtime_source_authorized"] = False
delivery["next_authorized_slice_ids"] = [S8]
delivery["next_authorized_slice_id_after_merge_and_postmerge_gate"] = S9
save(DELIVERY, delivery)

matrix = load(MATRIX)
cap04 = next(line for line in matrix["capability_lines"] if line["capability_line_id"] == "MCFT-CAP-04")
cap04["status"] = "IN_PROGRESS"
cap04["implementation_status"] = "S8_IMPLEMENTATION_CANDIDATE"
cap04["active_delivery_slice_id"] = S8
cap04["baseline_main_commit"] = BASELINE
cap04["branch"] = BRANCH
cap04["next_delivery_slice_id"] = S9
cap04["next_delivery_slice_authorized"] = False
for item in cap04.get("delivery_slices", []):
    if item.get("delivery_slice_id") == S8:
        item["status"] = "IMPLEMENTATION_CANDIDATE"
        item["baseline_main_commit"] = BASELINE
        item["branch"] = BRANCH
save(MATRIX, matrix)

map_path = ROOT / MAP
map_text = map_path.read_text(encoding="utf-8")
marker = "## MCFT-CAP-04 S8 Candidate — Restart, Backfill and Failure Recovery"
if marker not in map_text:
    map_text = map_text.rstrip() + f'''\n\n{marker}\n\n```text\nactivation merge: {BASELINE}\nactivation postmerge Gate: 29250261737 PASS\nimplementation: VALIDATED_PENDING_MERGE\nin-memory restart/backfill + failure recovery: 29251031846 PASS\nPostgreSQL uniqueness/rebuild + fencing/CAS: 29251564080 PASS\nPostgreSQL fresh-process restart: 29252000320 PASS\nS9: BLOCKED\n```\n'''
map_path.write_text(map_text, encoding="utf-8")

gate = r'''// scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_04_S8_RESTART_BACKFILL_RECOVERY.cjs
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
const FILES = __FILES__;
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
'''.replace('__FILES__', json.dumps(FILES))
(ROOT / GATE).parent.mkdir(parents=True, exist_ok=True)
(ROOT / GATE).write_text(gate, encoding="utf-8")

for relative in [
    ".github/workflows/cap04-s8-runtime-diagnostic.yml",
    ".github/workflows/cap04-s8-db-diagnostic.yml",
    ".github/workflows/cap04-s8-db-recheck.yml",
    ".github/workflows/cap04-s8-db-lease-fix.yml",
    ".github/workflows/cap04-s8-finalizer.yml",
    ".cap04-s8-runtime-trigger",
    ".cap04-s8-db-trigger",
    ".cap04-s8/finalize.py",
]:
    path = ROOT / relative
    if path.exists():
        path.unlink()
try:
    (ROOT / ".cap04-s8").rmdir()
except OSError:
    pass

subprocess.run(["node", GATE, "--final"], cwd=ROOT, check=True)
subprocess.run(["git", "config", "user.name", "github-actions[bot]"], cwd=ROOT, check=True)
subprocess.run(["git", "config", "user.email", "41898282+github-actions[bot]@users.noreply.github.com"], cwd=ROOT, check=True)
subprocess.run(["git", "add", "-A"], cwd=ROOT, check=True)
subprocess.run(["git", "commit", "-m", "gov(mcft-cap-04): finalize S8 restart backfill recovery"], cwd=ROOT, check=True)
subprocess.run(["git", "push", "origin", f"HEAD:{BRANCH}"], cwd=ROOT, check=True)
