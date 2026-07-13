from __future__ import annotations

import json
import pathlib
import subprocess

ROOT = pathlib.Path(__file__).resolve().parents[1]
BASELINE = "413908eadf1016d879760da3afc968abdee82342"
S7 = "MCFT-CAP-04.MCFT-04-07-09-10.TWENTY-FOUR-TICK-FORECAST-SCENARIO-RANGE-V1"
S8 = "MCFT-CAP-04.MCFT-03-04-07-09-10.RESTART-BACKFILL-FAILURE-RECOVERY-V1"
S9 = "MCFT-CAP-04.CLOSURE-CANDIDATE-V1"
ACTIVATION_BRANCH = "agent/mcft-cap-04-s8-activation-v1"
IMPLEMENTATION_BRANCH = "agent/mcft-cap-04-s8-restart-backfill-recovery-v1"
S7_HEAD = "9f65b0a1eb12eb92a123bb495bd1ff3701e042fd"
S7_CI = 29248055931
S7_MERGE = "413908eadf1016d879760da3afc968abdee82342"
S7_POSTMERGE_PR = 2400
S7_POSTMERGE_RUN = 29248764378

MAP = "docs/digital_twin/GEOX-DT-02-MCFT-IMPLEMENTATION-MAP.md"
MATRIX = "docs/digital_twin/GEOX-MCFT-VERTICAL-CAPABILITY-LINE-MATRIX.json"
AUTH = "docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-AUTHORIZATION-STATUS.json"
DELIVERY = "docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-DELIVERY-SLICE-STATUS.json"
S7_STATUS = "docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-S7-RANGE-STATUS.json"
S8_STATUS = "docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-S8-RESTART-BACKFILL-RECOVERY-STATUS.json"
GATE = "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_04_S8_ACTIVATION.cjs"

ACTIVATION_FILES = sorted([MAP, MATRIX, AUTH, DELIVERY, S7_STATUS, S8_STATUS, GATE])
IMPLEMENTATION_FILES = sorted([
    "apps/server/src/runtime/twin_runtime/forecast_scenario_restart_resume_service_v1.ts",
    MAP,
    MATRIX,
    AUTH,
    DELIVERY,
    "docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-FAILURE-RECOVERY-CONTRACT.md",
    S8_STATUS,
    "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_04_S8_RESTART_BACKFILL_RECOVERY.cjs",
    "scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_04_RESTART_BACKFILL.ts",
    "scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_04_FAILURE_RECOVERY.ts",
    "scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_04_RESTART_BACKFILL_DB.ts",
    "scripts/runtime_acceptance/mcft_cap_04_restart_backfill_recovery_fixture_v1.ts",
])


def load(path: str):
    return json.loads((ROOT / path).read_text(encoding="utf-8"))


def save(path: str, value) -> None:
    (ROOT / path).parent.mkdir(parents=True, exist_ok=True)
    (ROOT / path).write_text(json.dumps(value, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def append_unique(values: list[str], *items: str) -> list[str]:
    for item in items:
        if item not in values:
            values.append(item)
    return values


def replace_nonclaim(values: list[str], old: str, new: str) -> list[str]:
    return [new if value == old else value for value in values]


def s7_effectiveness():
    return {
        "pr_number": 2399,
        "exact_head_commit": S7_HEAD,
        "exact_head_ci_run": S7_CI,
        "merge_commit": S7_MERGE,
        "postmerge_probe_pr_number": S7_POSTMERGE_PR,
        "postmerge_workflow_run": S7_POSTMERGE_RUN,
        "postmerge_gate": "PASS",
        "effectiveness_condition_satisfied": True,
    }


s7 = load(S7_STATUS)
s7["status"] = "MERGED_EFFECTIVE"
s7["implementation_status"] = "MERGED_EFFECTIVE"
s7["implementation_effectiveness"] = s7_effectiveness()
s7["effectiveness_condition_satisfied"] = True
s7["next_delivery_slice_authorized"] = True
s7.setdefault("candidate_validation", {})["repository_exact_head_ci"] = "PASS"
s7["candidate_validation"]["repository_exact_head_ci_run"] = S7_CI
save(S7_STATUS, s7)

s8_status = {
    "schema_version": "geox_mcft_cap_04_s8_restart_backfill_recovery_status_v1",
    "status_identity": "GEOX-MCFT-CAP-04-S8-RESTART-BACKFILL-RECOVERY-STATUS-V1",
    "capability_line_id": "MCFT-CAP-04",
    "delivery_slice_id": S8,
    "runtime_mode": "REPLAY",
    "target_completion_level": "Level A — Deterministic Replay Twin",
    "baseline_main_commit": BASELINE,
    "activation_branch": ACTIVATION_BRANCH,
    "implementation_branch": IMPLEMENTATION_BRANCH,
    "status": "IMPLEMENTATION_AUTHORIZED",
    "design_status": "DESIGN_FROZEN",
    "implementation_status": "NOT_STARTED",
    "activation_fields_status": "FROZEN",
    "explicit_activation_authority": "OWNER_EXPLICIT_AUTHORIZATION_2026_07_13",
    "authorization_effective": True,
    "runtime_source_authorized": True,
    "predecessor_effectiveness": s7_effectiveness(),
    "frozen_runtime_objective": {
        "execution_direction": "FORWARD_ONLY",
        "contiguity": "EXACT_PT1H",
        "alignment": "UTC_HOUR_ALIGNED",
        "start_source": "PERSISTED_CHECKPOINT_NEXT_TICK_LOGICAL_TIME",
        "first_tick_logical_time": "2026-06-03T02:00:00.000Z",
        "process_1_last_tick_logical_time": "2026-06-03T13:00:00.000Z",
        "fresh_process_first_tick_logical_time": "2026-06-03T14:00:00.000Z",
        "last_tick_logical_time": "2026-06-04T01:00:00.000Z",
        "next_handoff_logical_time": "2026-06-04T02:00:00.000Z",
        "process_1_tick_count": 12,
        "fresh_process_tick_count": 12,
        "total_tick_count": 24,
        "process_1_checkpoint_sequence_range": "49..60",
        "fresh_process_checkpoint_sequence_range": "61..72",
        "uninterrupted_and_restarted_hashes": "MUST_BE_IDENTICAL_FOR_ALL_24_A1_RECORD_SETS_AND_24_SCENARIO_SETS",
        "bounded_forward_backfill": "MUST_MATCH_UNINTERRUPTED_CANONICAL_HASHES",
        "completed_target_retry": "ZERO_MUTATION_ALREADY_COMPLETE",
        "late_evidence_policy": "NO_RECOMPUTE_NO_REVISION",
        "wall_clock_logical_time": "FORBIDDEN",
    },
    "failure_recovery_objective": {
        "a1_postcommit_response_loss": "IDEMPOTENT_EIGHT_OBJECT_CANONICAL_READBACK_WITHOUT_DUPLICATE_FACTS",
        "b_postcommit_response_loss": "IDEMPOTENT_SCENARIO_SET_CANONICAL_READBACK_WITHOUT_DUPLICATE_FACTS",
        "a1_success_b_failure": "PENDING_SCENARIO_BARRIER_THEN_B_ONLY_RECOVERY",
        "a2_blocked_stop": "EXPLICIT_BLOCKED_RANGE_STOP_WITH_SUCCESS_POINTER_PRESERVED",
        "cross_variant_terminal_uniqueness": "FAIL_CLOSED",
        "stale_fencing": "FAIL_CLOSED",
        "cas_conflict": "FAIL_CLOSED",
        "projection_divergence": "FAIL_CLOSED_UNTIL_EXPLICIT_CANONICAL_REBUILD",
        "canonical_rebuild": "EXPLICIT_FORECAST_SCENARIO_PROJECTION_AND_GUARD_REBUILD_FROM_CANONICAL_FACTS",
    },
    "implementation_boundary": {
        "thin_forecast_scenario_restart_resume_orchestrator": "AUTHORIZED",
        "prepared_restart_input_v1_reuse": "REQUIRED",
        "prepare_next_tick_input_service_v1_reuse": "REQUIRED",
        "cap04_forecast_scenario_range_service_v1_reuse": "REQUIRED",
        "postgres_next_tick_repository_v1_reuse": "REQUIRED",
        "postgres_forecast_scenario_recovery_repository_v1_reuse": "REQUIRED",
        "new_tick_loop": "FORBIDDEN",
        "direct_persistence_from_orchestrator": "FORBIDDEN",
        "automatic_projection_repair": "FORBIDDEN",
        "schema_migration": "FORBIDDEN",
        "new_canonical_object_type": "FORBIDDEN",
        "new_transaction_family": "FORBIDDEN",
        "new_projection": "FORBIDDEN",
        "route": "FORBIDDEN",
        "scheduler": "FORBIDDEN",
        "web": "FORBIDDEN",
        "late_evidence_revision": "FORBIDDEN",
    },
    "exact_activation_changed_file_boundary": ACTIVATION_FILES,
    "frozen_implementation_changed_file_boundary": IMPLEMENTATION_FILES,
    "allowed_claims_after_implementation_merge_and_postmerge_gate": [
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
    ],
    "preserved_nonclaims": [
        "NO_ROUTE", "NO_WEB", "NO_SCHEDULER", "NO_NEW_MIGRATION",
        "NO_RECOMMENDATION", "NO_POLICY_EVALUATION", "NO_DECISION", "NO_AO_ACT",
        "NO_CALIBRATION_CANDIDATE", "NO_SHADOW_EVALUATION", "NO_MODEL_ACTIVATION",
        "NO_ACTIVE_MODEL_PARAMETER_CHANGE", "NO_LATE_EVIDENCE_REVISION",
        "NO_CONTINUOUS_RUNTIME", "NO_LIVE_FIELD_CLAIM", "NO_MCFT_GATE_A_CLOSURE",
        "NO_MINIMUM_COMPLETE_FIELD_TWIN_CLAIM",
    ],
    "activation_validation": {
        "activation_governance_gate": "PASS_REQUIRED_ON_FINAL_HEAD",
        "repository_exact_head_ci": "PASS_REQUIRED_BEFORE_MERGE",
        "activation_pr_governance_only": True,
        "temporary_workflow_removed": True,
        "temporary_materializer_removed": True,
    },
    "activation_effectiveness_condition": "S8_ACTIVATION_PR_MERGED_TO_MAIN_AND_MERGED_MAIN_S8_ACTIVATION_GATE_PASS",
    "activation_effectiveness_condition_satisfied": False,
    "implementation_effectiveness_condition": "S8_IMPLEMENTATION_PR_MERGED_TO_MAIN_AND_MERGED_MAIN_S8_GATE_PASS",
    "implementation_effectiveness_condition_satisfied": False,
    "successor_delivery_slice_id": S9,
    "successor_authorized": False,
}
save(S8_STATUS, s8_status)

auth = load(AUTH)
auth["status"] = "AUTHORIZATION_EFFECTIVE"
auth["implementation_status"] = "S8_IMPLEMENTATION_AUTHORIZED"
auth["baseline_main_commit"] = BASELINE
auth["branch"] = IMPLEMENTATION_BRANCH
auth["active_delivery_slice_id"] = S8
auth["runtime_source_authorized"] = True
auth["repository_write_scope"] = "S8_RESTART_BACKFILL_FAILURE_RECOVERY_ONLY"
auth["exact_changed_file_boundary"] = IMPLEMENTATION_FILES
auth["current_blockers"] = ["MCFT_CAP_04_S8_IMPLEMENTATION_NOT_YET_MERGED", "MCFT_CAP_04_S8_MERGED_MAIN_GATE_NOT_YET_PASS"]
auth["s7_effectiveness"] = s7_effectiveness()
auth["next_authorized_slice_id_after_effectiveness"] = S9
auth["preserved_nonclaims"] = replace_nonclaim(auth.get("preserved_nonclaims", []), "NO_RESTART_BACKFILL_MODE", "NO_RESTART_BACKFILL_EXECUTION_YET")
auth["satisfied_conditions"] = append_unique(auth.get("satisfied_conditions", []), "MCFT_CAP_04_S7_MERGED_MAIN_EFFECTIVE", "MCFT_CAP_04_RUNTIME_SOURCE_AUTHORIZED_FOR_S8", "MCFT_CAP_04_S8_EXPLICIT_OWNER_ACTIVATION")
save(AUTH, auth)

delivery = load(DELIVERY)
delivery["status"] = "S8_IMPLEMENTATION_AUTHORIZED"
delivery["baseline_main_commit"] = BASELINE
delivery["branch"] = IMPLEMENTATION_BRANCH
delivery["active_delivery_slice_id"] = S8
delivery["runtime_source_authorized"] = True
delivery["authorization_effective"] = True
delivery["s7_effectiveness"] = s7_effectiveness()
for item in delivery["slices"]:
    if item["delivery_slice_id"] == S7:
        item["status"] = "MERGED_EFFECTIVE"
        item["implementation_status"] = "MERGED_EFFECTIVE"
        item["effectiveness_condition_satisfied"] = True
        item.update(s7_effectiveness())
    if item["delivery_slice_id"] == S8:
        item["baseline_main_commit"] = BASELINE
        item["branch"] = IMPLEMENTATION_BRANCH
        item["status"] = "IMPLEMENTATION_AUTHORIZED"
        item["activation_fields_status"] = "FROZEN"
        item["runtime_source_authorized"] = True
        item["allowed_claims"] = ["CAP04_S7_MERGED_MAIN_EFFECTIVE_VERIFIED", "CAP04_S8_IMPLEMENTATION_AUTHORIZED", "CAP04_S8_RUNTIME_SOURCE_AUTHORIZED"]
        item["preserved_nonclaims"] = s8_status["preserved_nonclaims"] + ["NO_RESTART_BACKFILL_EXECUTION_YET"]
        item["exact_changed_file_boundary"] = IMPLEMENTATION_FILES
        item["effectiveness_condition"] = s8_status["implementation_effectiveness_condition"]
        item["effectiveness_condition_satisfied"] = False
        item["explicit_activation_authority"] = "OWNER_EXPLICIT_AUTHORIZATION_2026_07_13"
        item["implementation_status"] = "NOT_STARTED"
delivery["next_authorized_slice_ids"] = [S8]
delivery["next_authorized_slice_id_after_merge_and_postmerge_gate"] = S9
save(DELIVERY, delivery)

matrix = load(MATRIX)
cap04 = next(line for line in matrix["capability_lines"] if line["capability_line_id"] == "MCFT-CAP-04")
cap04["status"] = "IN_PROGRESS"
cap04["implementation_status"] = "S8_IMPLEMENTATION_AUTHORIZED"
cap04["active_delivery_slice_id"] = S8
cap04["baseline_main_commit"] = BASELINE
cap04["branch"] = IMPLEMENTATION_BRANCH
cap04["next_delivery_slice_id"] = S9
cap04["next_delivery_slice_authorized"] = False
cap04["s7_effectiveness"] = s7_effectiveness()
for item in cap04.get("delivery_slices", []):
    if item.get("delivery_slice_id") == S7:
        item["status"] = "MERGED_EFFECTIVE"
    if item.get("delivery_slice_id") == S8:
        item["status"] = "IMPLEMENTATION_AUTHORIZED"
        item["baseline_main_commit"] = BASELINE
        item["branch"] = IMPLEMENTATION_BRANCH
save(MATRIX, matrix)

map_path = ROOT / MAP
map_text = map_path.read_text(encoding="utf-8")
marker = "## MCFT-CAP-04 S8 Activation — Restart, Backfill and Failure Recovery"
if marker not in map_text:
    map_text = map_text.rstrip() + "\n\n" + marker + "\n\n```text\nS7: MERGED_EFFECTIVE\nS7 merge: " + S7_MERGE + "\nS7 postmerge Gate: 29248764378 PASS\nS8: IMPLEMENTATION_AUTHORIZED\nS8 baseline: " + BASELINE + "\nS8 implementation branch: " + IMPLEMENTATION_BRANCH + "\nS9: BLOCKED\n```\n"
map_path.write_text(map_text, encoding="utf-8")

gate = r'''// scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_04_S8_ACTIVATION.cjs
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
const FILES = __ACTIVATION_FILES__;
const IMPLEMENTATION_FILES = __IMPLEMENTATION_FILES__;
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
const changed = git(['diff', '--name-only', range]).split(/\r?\n/).filter(Boolean).sort();
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
'''
gate = gate.replace("__ACTIVATION_FILES__", json.dumps(ACTIVATION_FILES)).replace("__IMPLEMENTATION_FILES__", json.dumps(IMPLEMENTATION_FILES))
(ROOT / GATE).parent.mkdir(parents=True, exist_ok=True)
(ROOT / GATE).write_text(gate, encoding="utf-8")

for temporary in [ROOT / ".github/workflows/cap04-s8-activation.yml", ROOT / ".cap04-s8/activate.py", ROOT / ".cap04-s8-placeholder"]:
    if temporary.exists():
        temporary.unlink()
try:
    (ROOT / ".cap04-s8").rmdir()
except OSError:
    pass

subprocess.run(["node", GATE, "--final"], cwd=ROOT, check=True)
subprocess.run(["git", "config", "user.name", "github-actions[bot]"], cwd=ROOT, check=True)
subprocess.run(["git", "config", "user.email", "41898282+github-actions[bot]@users.noreply.github.com"], cwd=ROOT, check=True)
subprocess.run(["git", "add", "-A"], cwd=ROOT, check=True)
subprocess.run(["git", "commit", "-m", "gov(mcft-cap-04): activate S8 restart backfill recovery"], cwd=ROOT, check=True)
subprocess.run(["git", "push", "origin", f"HEAD:{ACTIVATION_BRANCH}"], cwd=ROOT, check=True)
