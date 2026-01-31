import path from "node:path"; // Node path: resolve fixture file paths deterministically.
import "./no_runtime_imports"; // Negative guard: ensure no runtime package depends on this harness.
import { evaluateControlFromRepoConstFileV0 } from "../ruleset_file_harness"; // Harness entry: explicit file path -> admission -> kernel eval.

function assert(cond: boolean, msg: string): void { // Small assertion helper for CI-visible failures.
  if (!cond) throw new Error(msg); // Fail fast so CI cannot ignore broken invariants.
}

// --- Repo-Const ruleset fixtures (explicit paths; no discovery) ---
// All fixture paths are anchored under THIS harness package to avoid cross-package directory drift.
const okFile = path.resolve(__dirname, "../../fixtures/rulesets_v0/ruleset_ok_001.json"); // S1: valid ruleset that should apply.
const invalidFile = path.resolve(__dirname, "../../fixtures/rulesets_v0/ruleset_invalid_001.json"); // S3: file exists but should be INVALID at admission.
const missingFile = path.resolve(__dirname, "../../fixtures/rulesets_v0/DOES_NOT_EXIST.json"); // S2: file missing -> MISSING (path must point to harness tree).

// --- Minimal kernel inputs (test-constructed; NOT from system) ---
const subjectRef = { projectId: "P0", groupId: "G0" }; // Output anchor only (opaque; not interpreted by rules).
const window = { startTs: 1700000000000, endTs: 1700003600000 }; // Output anchor only (opaque; not interpreted by rules).

const problemState = { // Minimal ProblemState-like input for projector + rule evaluation.
  subjectRef, // Provide subjectRef so projector can populate allowed paths.
  window, // Provide window so projector can populate allowed paths.
  problem_type: "DEMO" // Top-level field that projector maps to "problem_state.problem_type".
} as const; // Freeze literal shape to avoid accidental mutations during the test.

const uncertaintyEnvelope = {} as const; // Minimal envelope: empty is acceptable for allowlisted projection.
const permissionSet = { candidate_actions: [{ action_code: "AO-SENSE" }] } as const; // Minimal permission set for allowlisted candidate action paths.

const input = { // Align to EvaluateHarnessInputV0 shape consumed by ruleset_file_harness.ts.
  subjectRef, // Output anchor (opaque).
  window, // Output anchor (opaque).
  action_code: "AO-SENSE", // Action code used to select the ruleset action section.
  problemState, // Kernel input: projected to FieldMap.
  uncertaintyEnvelope, // Kernel input: projected to FieldMap.
  permissionSet // Kernel input: projected to FieldMap.
} as const; // Freeze literal shape for determinism.

// --- S1: ruleset applied -> DENY (APPLIED anchors must exist) ---
const s1 = evaluateControlFromRepoConstFileV0(okFile, input); // Scenario S1: valid ruleset exists -> APPLIED.
assert(s1.verdict.ruleset_status === "APPLIED", "S1 expected ruleset_status=APPLIED"); // Must be APPLIED.
assert(typeof s1.verdict.ruleset_ref === "string" && s1.verdict.ruleset_ref.startsWith("sha256:"), "S1 expected sha256 ruleset_ref"); // Must be offline-recomputable ref.
assert(s1.verdict.verdict === "DENY", `S1 expected verdict=DENY, got ${s1.verdict.verdict}`); // Contract: demo ok ruleset must DENY.
console.log("[OK] S1 applied -> verdict: DENY"); // Stable acceptance output.

// --- S2: ruleset missing -> UNDETERMINED + MISSING ---
const s2 = evaluateControlFromRepoConstFileV0(missingFile, input); // Scenario S2: missing file -> MISSING.
assert(s2.verdict.verdict === "UNDETERMINED", "S2 expected verdict=UNDETERMINED"); // Missing ruleset must not ALLOW/DENY.
assert(s2.verdict.ruleset_status === "MISSING", "S2 expected ruleset_status=MISSING"); // Must be MISSING.
assert(s2.verdict.ruleset_ref === "MISSING", "S2 expected ruleset_ref=MISSING"); // Must be literal "MISSING".
console.log("[OK] S2 missing -> UNDETERMINED + MISSING"); // Stable acceptance output.

// --- S3: invalid ruleset -> UNDETERMINED + INVALID ---
const s3 = evaluateControlFromRepoConstFileV0(invalidFile, input); // Scenario S3: file exists but admission fails -> INVALID.
assert(s3.verdict.verdict === "UNDETERMINED", "S3 expected verdict=UNDETERMINED"); // Invalid ruleset must not ALLOW/DENY.
assert(s3.verdict.ruleset_status === "INVALID", "S3 expected ruleset_status=INVALID"); // Must be INVALID.
assert(typeof s3.verdict.ruleset_ref === "string" && s3.verdict.ruleset_ref.startsWith("sha256:"), "S3 expected sha256 ruleset_ref"); // Must still be a sha256 ref of file bytes.
console.log("[OK] S3 invalid -> UNDETERMINED + INVALID (status=INVALID)"); // Stable acceptance output.
