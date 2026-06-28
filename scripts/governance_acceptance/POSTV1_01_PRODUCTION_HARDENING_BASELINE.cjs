// scripts/governance_acceptance/POSTV1_01_PRODUCTION_HARDENING_BASELINE.cjs
// Purpose: statically verify the post Twin Kernel v1 production hardening baseline.
// Boundary: this script does not call runtime APIs and does not create repository data.

const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();

const FILES = {
  postV1TaskLine: "docs/tasks/POST-TWIN-KERNEL-V1-TASK-LINE.md",
  postV101Doc: "docs/tasks/POSTV1-01-Production-Hardening-Baseline.md",
  completionReview: "docs/tasks/TWIN-KERNEL-V1-COMPLETION-REVIEW.md",
  oldTaskLine: "docs/tasks/TWIN-KERNEL-NEXT-TASK-LINE.md",
  runtimeHardening: "docs/security/GEOX_RUNTIME_HARDENING_V1.md",
  tk16Acceptance: "scripts/governance_acceptance/TK16_MULTI_SCOPE_REGRESSION_HARNESS.cjs",
  tk18Acceptance: "scripts/governance_acceptance/TK18_EXECUTION_TO_LEARNING_BUSINESS_CLOSURE_V0.cjs",
  completionAcceptance: "scripts/governance_acceptance/TWIN_KERNEL_V1_COMPLETION_REVIEW.cjs",
};

const assertions = [];

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

function exists(relativePath) {
  return fs.existsSync(path.join(ROOT, relativePath));
}

function assert(name, condition, details = {}) {
  const passed = condition === true;
  assertions.push({ name, passed, details });
  if (!passed) {
    const error = new Error(`ASSERTION_FAILED:${name}`);
    error.details = details;
    throw error;
  }
}

function containsAll(content, tokens) {
  return tokens.every((token) => content.includes(token));
}

function forbiddenRuntimeMutationFiles() {
  const forbiddenPrefixes = [
    "apps/server/src/routes/",
    "apps/server/db/migrations/",
    "apps/web/src/",
  ];
  return Object.values(FILES).filter((file) => forbiddenPrefixes.some((prefix) => file.startsWith(prefix)));
}

function main() {
  for (const [key, file] of Object.entries(FILES)) {
    assert(`${key}_exists`, exists(file), { file });
  }

  const postV1TaskLine = read(FILES.postV1TaskLine);
  const postV101Doc = read(FILES.postV101Doc);
  const completionReview = read(FILES.completionReview);
  const oldTaskLine = read(FILES.oldTaskLine);
  const runtimeHardening = read(FILES.runtimeHardening);
  const tk16Acceptance = read(FILES.tk16Acceptance);
  const tk18Acceptance = read(FILES.tk18Acceptance);
  const completionAcceptance = read(FILES.completionAcceptance);

  assert("completion_review_baseline_present", containsAll(completionReview, ["Twin Kernel v1", "bounded", "human-gated", "not autonomous", "business closure readback"]), { file: FILES.completionReview });
  assert("old_task_line_strong_fixture_requirement_detected", containsAll(oldTaskLine, ["At least 3 project/group/field scopes.", "At least 2 seasons.", "At least 2 crops."]), { file: FILES.oldTaskLine });
  assert("tk16_default_is_configurable_not_strong_fixture", containsAll(tk16Acceptance, ["DEFAULT_CANDIDATE_ID", "TK16_FIELD_LEARNING_CANDIDATE_IDS", "candidate_count"]), { file: FILES.tk16Acceptance });
  assert("postv1_task_line_records_tk16_correction", containsAll(postV1TaskLine, ["TK16 must not be described as full strong fixture coverage.", "POSTV1-02 Strong Multi-Scope Fixture Pack", "At least 3 project/group/field scopes.", "At least 2 seasons.", "At least 2 crops."]), { file: FILES.postV1TaskLine });
  assert("postv101_doc_records_baseline_correction", containsAll(postV101Doc, ["TK16 completed the configurable multi-scope harness framework.", "TK16 did not complete the strong 3-scope / 2-season / 2-crop fixture pack.", "The strong fixture pack is moved to POSTV1-02."]), { file: FILES.postV101Doc });
  assert("postv1_remaining_tasks_present", containsAll(postV1TaskLine, ["POSTV1-03 Ingestion Idempotency & Error Taxonomy", "POSTV1-04 Route Negative Runtime Matrix", "POSTV1-05 Adapter Contract Registry", "POSTV1-06 Operator UX Closure Cards", "POSTV1-07 Policy-Controlled ROI Preview", "POSTV1-08 Field Memory Governance Policy", "POSTV1-09 Execution Adapter Bridge"]), { file: FILES.postV1TaskLine });
  assert("runtime_hardening_doc_available", containsAll(runtimeHardening, ["Runtime env", "CORS", "Secret", "healthz"]), { file: FILES.runtimeHardening });
  assert("tk18_business_closure_acceptance_still_present", containsAll(tk18Acceptance, ["TK18_EXECUTION_TO_LEARNING_BUSINESS_CLOSURE_V0", "business_closure_complete", "forbidden_auto_writes_absent"]), { file: FILES.tk18Acceptance });
  assert("completion_acceptance_still_present", containsAll(completionAcceptance, ["TWIN_KERNEL_V1_COMPLETION_REVIEW", "completion_tags_present_locally"]), { file: FILES.completionAcceptance });
  assert("postv101_has_no_runtime_mutation_file_scope", forbiddenRuntimeMutationFiles().length === 0, { forbidden_files: forbiddenRuntimeMutationFiles() });

  console.log(JSON.stringify({
    ok: true,
    acceptance: "POSTV1_01_PRODUCTION_HARDENING_BASELINE",
    baseline: "Post Twin Kernel v1 production hardening baseline",
    correction: "TK16 harness framework is accepted; strong 3-scope / 2-season / 2-crop fixture coverage remains POSTV1-02.",
    remaining_tasks: [
      "POSTV1-02 Strong Multi-Scope Fixture Pack",
      "POSTV1-03 Ingestion Idempotency & Error Taxonomy",
      "POSTV1-04 Route Negative Runtime Matrix",
      "POSTV1-05 Adapter Contract Registry",
      "POSTV1-06 Operator UX Closure Cards",
      "POSTV1-07 Policy-Controlled ROI Preview",
      "POSTV1-08 Field Memory Governance Policy",
      "POSTV1-09 Execution Adapter Bridge",
    ],
    assertions,
    next_step: "POSTV1-02_STRONG_MULTI_SCOPE_FIXTURE_PACK",
  }, null, 2));
}

try {
  main();
} catch (error) {
  console.error(JSON.stringify({
    ok: false,
    acceptance: "POSTV1_01_PRODUCTION_HARDENING_BASELINE",
    error: error.message,
    details: error.details ?? null,
    assertions,
  }, null, 2));
  process.exit(1);
}
