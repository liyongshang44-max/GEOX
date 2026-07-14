from pathlib import Path
import json
import re

BASELINE = "5391a3a8f811fc166fa187d7da70342ee36ab5fa"
P1_HEAD = "ca83b67241b4df0082e78d3bfdf45e9338d82ad4"
P1_MERGE = "5391a3a8f811fc166fa187d7da70342ee36ab5fa"
P1_WORKFLOW = 29305092038
P0_SLICE = "MCFT-CAP-05.P0.CAP-04-SETTLEMENT-AND-CAP-05-PROVISIONAL-SSOT-V1"
S0_SLICE = "MCFT-CAP-05.GOV-AUTHORIZATION-AND-PREDECESSOR-LOCK-V1"

matrix_path = Path("docs/digital_twin/GEOX-MCFT-VERTICAL-CAPABILITY-LINE-MATRIX.json")
task_path = Path("docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-TASK.md")
map_path = Path("docs/digital_twin/GEOX-DT-02-MCFT-IMPLEMENTATION-MAP.md")
status_path = Path("docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-P0-STATUS.json")
acceptance_path = Path("scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_05_P0_SETTLEMENT_SSOT.cjs")

matrix = json.loads(matrix_path.read_text(encoding="utf-8"))
matrix["schema_version"] = "geox_mcft_vertical_capability_line_matrix_v7"
matrix["baseline"] = {
    "branch": "main",
    "commit": BASELINE,
    "meaning": "MCFT-CAP-05 P0 CAP-04 settlement and CAP-05 provisional SSOT candidate",
}

cap04 = next((x for x in matrix["capability_lines"] if x.get("capability_line_id") == "MCFT-CAP-04"), None)
if cap04 is None:
    raise SystemExit("MCFT-CAP-04 entry missing")

cap04["status"] = "COMPLETE"
cap04["implementation_status"] = "COMPLETE"
cap04["closure_effective"] = True
cap04["capability_complete"] = True
cap04["active_delivery_slice_id"] = None
cap04["pending_completion_claims"] = []
cap04["next_delivery_slice_id"] = None
cap04["next_delivery_slice_authorized"] = False
cap04["next_authorized_slice_ids"] = []
cap04["latest_effective_slice_id"] = "MCFT-CAP-04.FINALIZATION-MAIN-VERIFICATION-V1"
cap04["latest_effective_delivery_slice_id"] = "MCFT-CAP-04.FINALIZATION-MAIN-VERIFICATION-V1"
cap04["effectiveness_condition"] = "CAP_04_CLOSURE_EFFECTIVE_AND_CAPABILITY_COMPLETE_VERIFIED_ON_MAIN"
cap04["effectiveness_condition_satisfied"] = True
cap04["current_repository_baseline_commit"] = BASELINE
cap04["current_lifecycle_authority"] = "docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-CLOSURE-RECORD.json"
cap04["current_main_verification_authority"] = "docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-MAIN-VERIFICATION.json"
cap04["p0_reconciled_by"] = P0_SLICE
cap04["p0_current_reconciliation"] = {
    "baseline_main_commit": BASELINE,
    "authority": "CAP_04_CLOSURE_RECORD_AND_MAIN_VERIFICATION",
    "status": "COMPLETE",
    "implementation_status": "COMPLETE",
    "closure_effective": True,
    "capability_complete": True,
    "active_delivery_slice_id": None,
    "pending_completion_claims": [],
    "next_delivery_slice_id": None,
    "next_delivery_slice_authorized": False,
    "latest_effective_slice_id": "MCFT-CAP-04.FINALIZATION-MAIN-VERIFICATION-V1",
    "historical_delivery_slice_evidence_preserved": True,
}

cap05_value = {
    "capability_line_id": "MCFT-CAP-05",
    "display_alias": "MCFT-5",
    "name": "Human Decision and Execution-Receipt Feedback",
    "runtime_mode": "REPLAY",
    "target_completion_level": "Level A",
    "status": "NOT_AUTHORIZED",
    "design_status": "P_MINUS_1_MERGED_EFFECTIVE",
    "implementation_status": "NOT_AUTHORIZED",
    "authorization_effective": False,
    "runtime_source_authorized": False,
    "active_delivery_slice_id": None,
    "predecessor_capability_line_id": "MCFT-CAP-04",
    "successor_capability_line_id": "MCFT-CAP-06",
    "successor_authorized": False,
    "p_minus_1_adjudication": {
        "delivery_slice_id": "MCFT-CAP-05.P-1.DT02-OBJECT-TRANSACTION-ADJUDICATION-V1",
        "status": "MERGED_EFFECTIVE",
        "result": "REUSE_WITHOUT_AMENDMENT",
        "dt02_architecture_amendment_03_required": False,
        "exact_head": P1_HEAD,
        "merge_commit": P1_MERGE,
        "head_to_merge_file_delta_count": 0,
        "tree_equivalence": "PASS",
        "merged_main_gate_workflow_run": P1_WORKFLOW,
        "merged_main_gate": "PASS",
    },
    "p0": {
        "delivery_slice_id": P0_SLICE,
        "status": "READY_FOR_MERGE",
        "baseline_main_commit": BASELINE,
        "runtime_source_authorized": False,
        "s0_authorized": False,
    },
    "next_delivery_slice_id": S0_SLICE,
    "next_delivery_slice_authorized": False,
    "delivery_slices": [
        {
            "delivery_slice_id": "MCFT-CAP-05.P-1.DT02-OBJECT-TRANSACTION-ADJUDICATION-V1",
            "status": "MERGED_EFFECTIVE",
            "primary_owner_work_package_id": "MCFT-13",
            "contributing_owner_work_package_ids": ["MCFT-02", "MCFT-03", "MCFT-11", "MCFT-15", "MCFT-16"],
            "merge_commit": P1_MERGE,
            "merged_main_gate": "PASS",
        },
        {
            "delivery_slice_id": P0_SLICE,
            "status": "READY_FOR_MERGE",
            "primary_owner_work_package_id": "MCFT-16",
            "contributing_owner_work_package_ids": ["MCFT-00", "MCFT-03", "MCFT-13", "MCFT-15"],
            "baseline_main_commit": BASELINE,
            "runtime_source_authorized": False,
        },
    ],
    "preserved_nonclaims": [
        "NO_RUNTIME_SOURCE_AUTHORIZED",
        "NO_PREDECESSOR_POSTGRESQL_LOCK",
        "NO_HUMAN_DECISION_CANONICAL_WRITE",
        "NO_APPROVAL_AUTHORITY_EXERCISE",
        "NO_ACTION_FEEDBACK_CANONICAL_WRITE",
        "NO_FORECAST_RESIDUAL_CANONICAL_WRITE",
        "NO_MIGRATION",
        "NO_ROUTE",
        "NO_WEB",
        "NO_AO_ACT_CHANGE",
        "NO_CAP_06_AUTHORIZATION",
    ],
    "effectiveness_condition": "S0_PR_MERGED_TO_MAIN_AND_MERGED_MAIN_AUTHORIZATION_GATE_PASS_BEFORE_RUNTIME_SOURCE",
    "effectiveness_condition_satisfied": False,
}
cap05 = next((x for x in matrix["capability_lines"] if x.get("capability_line_id") == "MCFT-CAP-05"), None)
if cap05 is None:
    matrix["capability_lines"].append(cap05_value)
else:
    cap05.clear()
    cap05.update(cap05_value)

matrix_path.write_text(json.dumps(matrix, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

task = task_path.read_text(encoding="utf-8")
status_pattern = re.compile(
    r"当前状态：\n\n```text\narchitecture_direction:\n.*?\nfirst_permitted_repository_action:\n.*?\n```",
    re.S,
)
new_status = """当前状态：

```text
architecture_direction:
CONFORMANT

design_status:
P_MINUS_1_MERGED_EFFECTIVE

implementation_status:
NOT_AUTHORIZED

runtime_source_authorized:
false

active_delivery_slice_id:
MCFT-CAP-05.P0.CAP-04-SETTLEMENT-AND-CAP-05-PROVISIONAL-SSOT-V1

dt02_architecture_amendment_status:
NOT_REQUIRED_MERGED_EFFECTIVE

first_permitted_repository_action:
MCFT-CAP-05.P0.CAP-04-SETTLEMENT-AND-CAP-05-PROVISIONAL-SSOT-V1
```"""
task, count = status_pattern.subn(new_status, task, count=1)
if count != 1:
    raise SystemExit("task current-status block not replaced")

task = task.replace(
    "本文件记录 P-1 架构治理裁决候选；不授权 Runtime source、migration、route、runner、canonical write implementation、P0 或 CAP-06。P0 只有在 P-1 合并且 merged-main Gate PASS 后才可激活。",
    "P-1 已 merged-effective，裁决结果为 REUSE_WITHOUT_AMENDMENT。当前文件记录 P0 settlement / provisional SSOT candidate；仍不授权 Runtime source、migration、route、runner、canonical write implementation、S0 或 CAP-06。",
    1,
)
task = task.replace("## P-1 adjudication candidate result", "## P-1 adjudication merged-effective result", 1)
task = task.replace(
    "repository_effectiveness:\nPENDING_P_MINUS_1_MERGE_AND_MERGED_MAIN_GATE\n\nP0_authorized:\nfalse",
    "repository_effectiveness:\nMERGED_EFFECTIVE\n\nP0_permitted:\ntrue",
    1,
)
task = task.replace("P-1 是当前唯一允许的下一步。", "P-1 已 merged-effective；P0 是当前唯一允许的下一步。", 1)
task = task.replace(
    "该结果必须由 P-1 Gate 证明；v0.4 不预先激活该结论。",
    "该结果已由 P-1 exact-head、tree-equivalence 和 merged-main Gate 证明并生效。",
    1,
)

p0_anchor = """```text
delivery_slice_id:
MCFT-CAP-05.P0.CAP-04-SETTLEMENT-AND-CAP-05-PROVISIONAL-SSOT-V1
```"""
p0_candidate = """

P0 candidate identity：

```text
baseline_main_commit:
5391a3a8f811fc166fa187d7da70342ee36ab5fa

P-1 exact head:
ca83b67241b4df0082e78d3bfdf45e9338d82ad4

P-1 merge commit:
5391a3a8f811fc166fa187d7da70342ee36ab5fa

P-1 merged-main Gate workflow:
29305092038 SUCCESS

P-1 adjudication result:
REUSE_WITHOUT_AMENDMENT

P0 status:
READY_FOR_MERGE

Runtime source authorized:
false

S0 authorized:
false
```
"""
if "P0 candidate identity" not in task:
    if p0_anchor not in task:
        raise SystemExit("P0 anchor missing")
    task = task.replace(p0_anchor, p0_anchor + p0_candidate, 1)
task_path.write_text(task, encoding="utf-8")

implementation_map = map_path.read_text(encoding="utf-8")
map_marker = "<!-- MCFT-CAP-05-P0-SETTLEMENT-START -->"
if map_marker not in implementation_map:
    implementation_map += """

<!-- MCFT-CAP-05-P0-SETTLEMENT-START -->

## MCFT-CAP-05 P0 CAP-04 settlement and CAP-05 provisional SSOT candidate

```text
baseline main: 5391a3a8f811fc166fa187d7da70342ee36ab5fa
P-1 exact head: ca83b67241b4df0082e78d3bfdf45e9338d82ad4
P-1 merge commit: 5391a3a8f811fc166fa187d7da70342ee36ab5fa
P-1 head-to-merge file delta count: 0
P-1 tree equivalence: PASS
P-1 merged-main Gate workflow: 29305092038 SUCCESS
P-1 adjudication result: REUSE_WITHOUT_AMENDMENT
DT-02 Architecture Amendment 03 required: false
active delivery slice: MCFT-CAP-05.P0.CAP-04-SETTLEMENT-AND-CAP-05-PROVISIONAL-SSOT-V1
P0 status: READY_FOR_MERGE
Runtime source authorized: false
S0 authorized: false
```

P0 reconciles only the current CAP-04 lifecycle view to its Closure Record and Main Verification authority. Historical delivery-slice baselines, merge commits, Gates and predecessor identities remain unchanged.

```text
CAP-04 status: COMPLETE
CAP-04 implementation status: COMPLETE
CAP-04 closure effective: true
CAP-04 capability complete: true
CAP-04 active delivery slice: null
CAP-04 pending completion claims: 0
CAP-04 current next delivery slice: null
CAP-04 current next delivery authorization: false
CAP-04 current latest effective slice: MCFT-CAP-04.FINALIZATION-MAIN-VERIFICATION-V1
```

The provisional CAP-05 capability entry remains `NOT_AUTHORIZED`. P0 creates no Runtime authority, predecessor PostgreSQL lock, migration, canonical write, route, web or CAP-06 authorization. S0 remains the next independent authorization boundary.

<!-- MCFT-CAP-05-P0-SETTLEMENT-END -->
"""
map_path.write_text(implementation_map, encoding="utf-8")

changed_files = [
    "docs/digital_twin/GEOX-DT-02-MCFT-IMPLEMENTATION-MAP.md",
    "docs/digital_twin/GEOX-MCFT-VERTICAL-CAPABILITY-LINE-MATRIX.json",
    "docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-P0-STATUS.json",
    "docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-TASK.md",
    "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_05_P0_SETTLEMENT_SSOT.cjs",
]
p0_status = {
    "schema_version": "geox_mcft_cap_05_p0_status_v1",
    "capability_line_id": "MCFT-CAP-05",
    "delivery_slice_id": P0_SLICE,
    "slice_kind": "GOVERNANCE_SSOT_SETTLEMENT_ONLY",
    "status": "READY_FOR_MERGE",
    "baseline_main_commit": BASELINE,
    "p_minus_1_effectiveness": {
        "pr_number": 2430,
        "exact_head": P1_HEAD,
        "merge_commit": P1_MERGE,
        "head_to_merge_file_delta_count": 0,
        "tree_equivalence": "PASS",
        "merged_main_gate_workflow_run": P1_WORKFLOW,
        "merged_main_gate": "PASS",
        "adjudication_result": "REUSE_WITHOUT_AMENDMENT",
        "dt02_architecture_amendment_03_required": False,
        "effective": True,
    },
    "cap_04_authority": {
        "closure_record_ref": "docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-CLOSURE-RECORD.json",
        "main_verification_ref": "docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-MAIN-VERIFICATION.json",
        "finalization_status_ref": "docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-FINALIZATION-STATUS.json",
        "package_remediation_pr": 2422,
        "package_remediation_merge_commit": "dbedff0eaa44cd638d461abbfd420f8f7b9fdc8d",
        "repository_ci_stabilization_pr": 2428,
        "repository_ci_stabilization_merge_commit": "3eba797307388bd652dc5c65e91d634375e1b8c2",
    },
    "cap_04_reconciled_current_fields": {
        "status": "COMPLETE",
        "implementation_status": "COMPLETE",
        "closure_effective": True,
        "capability_complete": True,
        "active_delivery_slice_id": None,
        "pending_completion_claims": [],
        "next_delivery_slice_id": None,
        "next_delivery_slice_authorized": False,
        "latest_effective_slice_id": "MCFT-CAP-04.FINALIZATION-MAIN-VERIFICATION-V1",
        "effectiveness_condition_satisfied": True,
        "current_repository_baseline_commit": BASELINE,
    },
    "historical_evidence_preserved": {
        "delivery_slices": True,
        "baseline_main_commits": True,
        "merge_commits": True,
        "gate_evidence": True,
        "predecessor_refs": True,
        "authorization_and_closure_evidence": True,
    },
    "cap_05_provisional_entry": {
        "status": "NOT_AUTHORIZED",
        "design_status": "P_MINUS_1_MERGED_EFFECTIVE",
        "implementation_status": "NOT_AUTHORIZED",
        "runtime_source_authorized": False,
        "active_delivery_slice_id": None,
        "predecessor_capability_line_id": "MCFT-CAP-04",
        "successor_capability_line_id": "MCFT-CAP-06",
        "successor_authorized": False,
        "next_delivery_slice_id": S0_SLICE,
        "next_delivery_slice_authorized": False,
    },
    "runtime_source_authorized": False,
    "migration_authorized": False,
    "canonical_write_authorized": False,
    "s0_authorized": False,
    "cap_06_authorized": False,
    "exact_changed_file_boundary": changed_files,
    "preserved_boundaries": [
        "NO_RUNTIME_SOURCE_CHANGE",
        "NO_MIGRATION",
        "NO_CANONICAL_FACT_WRITE",
        "NO_ROUTE",
        "NO_WEB",
        "NO_AO_ACT_CHANGE",
        "NO_CAP_04_SOURCE_CHANGE",
        "NO_PREDECESSOR_POSTGRESQL_LOCK",
        "NO_CAP_06_AUTHORIZATION",
    ],
}
status_path.parent.mkdir(parents=True, exist_ok=True)
status_path.write_text(json.dumps(p0_status, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

acceptance = r'''// scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_05_P0_SETTLEMENT_SSOT.cjs
// Purpose: verify MCFT-CAP-05 P0 current-SSOT settlement without rewriting CAP-04 historical delivery evidence.
// Boundary: governance files only; no Runtime source, migration, canonical write, route, web, AO-ACT, PostgreSQL or network mutation.

const fs = require("node:fs");
const path = require("node:path");
const childProcess = require("node:child_process");

const repoRoot = process.cwd();
const baseline = process.env.MCFT_CAP_05_P0_BASELINE || "5391a3a8f811fc166fa187d7da70342ee36ab5fa";
const postmerge = process.argv.includes("--postmerge");
const p0Slice = "MCFT-CAP-05.P0.CAP-04-SETTLEMENT-AND-CAP-05-PROVISIONAL-SSOT-V1";
const files = {
  map: "docs/digital_twin/GEOX-DT-02-MCFT-IMPLEMENTATION-MAP.md",
  matrix: "docs/digital_twin/GEOX-MCFT-VERTICAL-CAPABILITY-LINE-MATRIX.json",
  task: "docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-TASK.md",
  status: "docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-P0-STATUS.json",
  acceptance: "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_05_P0_SETTLEMENT_SSOT.cjs",
};
const expectedChangedFiles = Object.values(files).sort();
let passCount = 0;
let failCount = 0;
function pass(label) { passCount += 1; console.log(`PASS ${label}`); }
function fail(label, detail = "") { failCount += 1; console.error(`FAIL ${label}${detail ? `: ${detail}` : ""}`); }
function assert(condition, label, detail = "") { if (condition) pass(label); else fail(label, detail); }
function read(relativePath) { return fs.readFileSync(path.join(repoRoot, relativePath), "utf8"); }
function git(args) { return childProcess.execFileSync("git", args, { cwd: repoRoot, encoding: "utf8" }).trim(); }
function canonical(value) { return JSON.stringify(value); }
function findCapability(matrix, id) { return matrix.capability_lines.find((entry) => entry.capability_line_id === id); }

for (const relativePath of expectedChangedFiles) assert(fs.existsSync(path.join(repoRoot, relativePath)), `file exists ${relativePath}`);
const matrix = JSON.parse(read(files.matrix));
const status = JSON.parse(read(files.status));
const task = read(files.task);
const implementationMap = read(files.map);
const baselineMatrix = JSON.parse(git(["show", `${baseline}:${files.matrix}`]));
const cap04 = findCapability(matrix, "MCFT-CAP-04");
const baseCap04 = findCapability(baselineMatrix, "MCFT-CAP-04");
const cap05Entries = matrix.capability_lines.filter((entry) => entry.capability_line_id === "MCFT-CAP-05");
const cap05 = cap05Entries[0];

assert(matrix.schema_version === "geox_mcft_vertical_capability_line_matrix_v7", "matrix schema v7");
assert(matrix.baseline.branch === "main" && matrix.baseline.commit === baseline, "matrix current baseline exact");
assert(Boolean(cap04) && Boolean(baseCap04), "CAP-04 entries exist");
assert(cap04.status === "COMPLETE", "CAP-04 status COMPLETE");
assert(cap04.implementation_status === "COMPLETE", "CAP-04 implementation COMPLETE");
assert(cap04.closure_effective === true && cap04.capability_complete === true, "CAP-04 completion effective");
assert(cap04.active_delivery_slice_id === null, "CAP-04 active slice null");
assert(Array.isArray(cap04.pending_completion_claims) && cap04.pending_completion_claims.length === 0, "CAP-04 pending claims empty");
assert(cap04.next_delivery_slice_id === null && cap04.next_delivery_slice_authorized === false, "CAP-04 stale next delivery cleared");
assert(Array.isArray(cap04.next_authorized_slice_ids) && cap04.next_authorized_slice_ids.length === 0, "CAP-04 next authorized list empty");
assert(cap04.latest_effective_slice_id === "MCFT-CAP-04.FINALIZATION-MAIN-VERIFICATION-V1", "CAP-04 latest effective slice reconciled");
assert(cap04.effectiveness_condition_satisfied === true, "CAP-04 effectiveness satisfied");
assert(cap04.current_repository_baseline_commit === baseline, "CAP-04 current baseline exact");
assert(cap04.p0_reconciled_by === p0Slice, "CAP-04 P0 identity exact");
assert(canonical(cap04.delivery_slices) === canonical(baseCap04.delivery_slices), "CAP-04 historical delivery slices unchanged");

const mutableCap04Keys = new Set(["status", "implementation_status", "closure_effective", "capability_complete", "active_delivery_slice_id", "pending_completion_claims", "next_delivery_slice_id", "next_delivery_slice_authorized", "next_authorized_slice_ids", "latest_effective_slice_id", "latest_effective_delivery_slice_id", "effectiveness_condition", "effectiveness_condition_satisfied", "current_repository_baseline_commit", "current_lifecycle_authority", "current_main_verification_authority", "p0_reconciled_by", "p0_current_reconciliation"]);
function historicalView(entry) { const copy = structuredClone(entry); for (const key of mutableCap04Keys) delete copy[key]; return copy; }
assert(canonical(historicalView(cap04)) === canonical(historicalView(baseCap04)), "CAP-04 non-current historical fields unchanged");
for (const id of ["MCFT-CAP-01", "MCFT-CAP-02", "MCFT-CAP-03"]) assert(canonical(findCapability(matrix, id)) === canonical(findCapability(baselineMatrix, id)), `${id} entry unchanged`);

assert(cap05Entries.length === 1, "exactly one CAP-05 provisional entry");
assert(cap05.status === "NOT_AUTHORIZED", "CAP-05 status NOT_AUTHORIZED");
assert(cap05.design_status === "P_MINUS_1_MERGED_EFFECTIVE", "CAP-05 design status exact");
assert(cap05.implementation_status === "NOT_AUTHORIZED" && cap05.runtime_source_authorized === false, "CAP-05 implementation blocked");
assert(cap05.active_delivery_slice_id === null, "CAP-05 active slice null");
assert(cap05.predecessor_capability_line_id === "MCFT-CAP-04" && cap05.successor_capability_line_id === "MCFT-CAP-06", "CAP-05 adjacency exact");
assert(cap05.successor_authorized === false, "CAP-06 unauthorized");
assert(cap05.p_minus_1_adjudication.status === "MERGED_EFFECTIVE" && cap05.p_minus_1_adjudication.result === "REUSE_WITHOUT_AMENDMENT", "P-1 effective result exact");
assert(cap05.p_minus_1_adjudication.merged_main_gate_workflow_run === 29305092038, "P-1 Gate workflow pinned");
assert(cap05.p0.delivery_slice_id === p0Slice && cap05.p0.status === "READY_FOR_MERGE", "P0 matrix status exact");
assert(cap05.next_delivery_slice_id === "MCFT-CAP-05.GOV-AUTHORIZATION-AND-PREDECESSOR-LOCK-V1" && cap05.next_delivery_slice_authorized === false, "S0 remains unauthorized");

assert(status.schema_version === "geox_mcft_cap_05_p0_status_v1", "P0 status schema exact");
assert(status.status === "READY_FOR_MERGE" && status.baseline_main_commit === baseline, "P0 status and baseline exact");
assert(status.p_minus_1_effectiveness.effective === true && status.p_minus_1_effectiveness.merged_main_gate === "PASS", "P-1 effectiveness recorded");
assert(status.p_minus_1_effectiveness.adjudication_result === "REUSE_WITHOUT_AMENDMENT", "P-1 adjudication recorded");
assert(status.cap_04_reconciled_current_fields.implementation_status === "COMPLETE", "P0 status CAP-04 reconciled");
assert(status.cap_05_provisional_entry.status === "NOT_AUTHORIZED", "P0 status CAP-05 unauthorized");
assert(status.runtime_source_authorized === false && status.migration_authorized === false && status.canonical_write_authorized === false, "P0 write authority blocked");
assert(status.s0_authorized === false && status.cap_06_authorized === false, "successor boundaries blocked");
assert(JSON.stringify([...status.exact_changed_file_boundary].sort()) === JSON.stringify(expectedChangedFiles), "status exact changed-file boundary");

assert(task.includes("design_status:\nP_MINUS_1_MERGED_EFFECTIVE"), "task records P-1 effective");
assert(task.includes(`active_delivery_slice_id:\n${p0Slice}`), "task records P0 candidate");
assert(task.includes("P-1 merged-main Gate workflow:\n29305092038 SUCCESS"), "task pins P-1 Gate");
assert(task.includes("P0 status:\nREADY_FOR_MERGE"), "task records P0 readiness");
assert(implementationMap.includes("MCFT-CAP-05-P0-SETTLEMENT-START"), "implementation map P0 section exists");
assert(implementationMap.includes("P-1 merged-main Gate workflow: 29305092038 SUCCESS"), "implementation map pins P-1 Gate");
assert(implementationMap.includes("P0 status: READY_FOR_MERGE") && implementationMap.includes("S0 authorized: false"), "implementation map boundaries exact");

let changedFiles = [];
try {
  const range = postmerge ? `${baseline}..HEAD` : `${baseline}...HEAD`;
  changedFiles = git(["diff", "--name-only", range]).split(/\r?\n/).filter(Boolean).sort();
  assert(JSON.stringify(changedFiles) === JSON.stringify(expectedChangedFiles), "git exact changed-file boundary", JSON.stringify(changedFiles));
} catch (error) { fail("git exact changed-file boundary", error.message); }
const forbiddenPrefixes = ["apps/server/src/", "apps/server/db/migrations/", "apps/web/", "fixtures/", "scripts/runtime_acceptance/"];
for (const changed of changedFiles) assert(!forbiddenPrefixes.some((prefix) => changed.startsWith(prefix)), `no forbidden path ${changed}`);
try { git(["diff", "--check", postmerge ? `${baseline}..HEAD` : `${baseline}...HEAD`]); pass("git diff --check"); } catch (error) { fail("git diff --check", error.message); }
console.log(`SUMMARY ${passCount} PASS, ${failCount} FAIL`);
if (failCount > 0) process.exit(1);
'''
acceptance_path.parent.mkdir(parents=True, exist_ok=True)
acceptance_path.write_text(acceptance, encoding="utf-8")
