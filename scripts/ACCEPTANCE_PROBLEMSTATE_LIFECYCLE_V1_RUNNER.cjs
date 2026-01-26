/**
 * File: scripts/ACCEPTANCE_PROBLEMSTATE_LIFECYCLE_V1_RUNNER.cjs
 *
 * GEOX · Sprint 9 · ProblemState Lifecycle v1 Acceptance Runner
 *
 * Notes:
 * - CommonJS runner to avoid ESM/CJS loader edge cases.
 * - Emits deterministic PASS lines per case.
 * - On JSON parse errors, reports the exact file path for fast triage.
 */

const fs = require("node:fs"); // Read fixture files from disk
const path = require("node:path"); // Build file paths
const assert = require("node:assert/strict"); // Deterministic assertions

// Load TS module via require() (ts-node hooks are set up by the PowerShell wrapper).
const lifecycleMod = require("../apps/judge/src/lifecycle/problem_state_lifecycle_v1.ts"); // Lifecycle engine module

// Support both shapes: named export OR default export.
const computeProblemStateIndexV1 =
  lifecycleMod.computeProblemStateIndexV1 || // Prefer named export when present
  (lifecycleMod.default && lifecycleMod.default.computeProblemStateIndexV1); // Fallback to default export

if (typeof computeProblemStateIndexV1 !== "function") {
  throw new Error("computeProblemStateIndexV1 export not found"); // Hard fail if export shape changes
}

const REPO_ROOT = path.resolve(__dirname, ".."); // Repo root
const CASES_DIR = path.join(REPO_ROOT, "acceptance", "problem_state_lifecycle_v1", "cases"); // Case directory

function readJson(p) {
  const raw = fs.readFileSync(p, "utf8"); // Read file text
  try {
    return JSON.parse(raw); // Parse JSON
  } catch (e) {
    const msg = e && e.message ? e.message : String(e); // Normalize error message
    throw new Error(`JSON parse failed: ${p} :: ${msg}`); // Attach file path for deterministic debugging
  }
}

function sortById(rows) {
  return [...rows].sort((a, b) => String(a.problem_state_id).localeCompare(String(b.problem_state_id))); // Stable ordering
}

function pickComparable(rows) {
  return rows.map((r) => ({
    problem_state_id: r.problem_state_id, // Compare key
    lifecycle_state: r.lifecycle_state, // Compare derived state
    superseded_by: r.superseded_by ?? null, // Compare pointer
  }));
}

function runCase(casePath) {
  const c = readJson(casePath); // Load fixture
  const idx = computeProblemStateIndexV1({
    problem_states: c.problem_states, // Input ProblemStates
    asOfTs: c.asOfTs, // Deterministic "now"
    constants: c.constants, // Frozen constants
    frozen_ids: c.frozen_ids, // Freeze set
  });

  const got = pickComparable(sortById(idx)); // Actual
  const exp = pickComparable(sortById(c.expected_index)); // Expected
  assert.deepEqual(got, exp); // Exact match
}

const files = fs.readdirSync(CASES_DIR).filter((f) => f.endsWith(".json")).sort(); // Deterministic order
assert.ok(files.length > 0, "No lifecycle acceptance cases found"); // Ensure cases exist

for (const f of files) {
  const p = path.join(CASES_DIR, f); // Absolute case path
  console.log(`[RUN] ${f}`); // Emit deterministic run line (helps identify failing case)
  try {
    runCase(p); // Execute case
  } catch (e) {
    const msg = e && e.message ? e.message : String(e); // Normalize error message
    throw new Error(`Case failed: ${f} :: ${msg}`); // Attach filename for deterministic triage
  }
  console.log(`[OK] ${f}`); // Emit PASS line
}

console.log(`[OK] ProblemState Lifecycle v1 acceptance passed (cases=${files.length})`); // Final PASS
