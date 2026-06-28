// scripts/governance_acceptance/POSTV1_PHASE_LINE_FREEZE.cjs
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = process.cwd();
const ACCEPTANCE = 'POSTV1_PHASE_LINE_FREEZE';

const FILES = {
  taskLine: 'docs/tasks/POST-TWIN-KERNEL-V1-TASK-LINE.md',
  postv101: 'docs/tasks/POSTV1-01-Production-Hardening-Baseline.md',
  completionReview: 'docs/tasks/TWIN-KERNEL-V1-COMPLETION-REVIEW.md',
  postv101Acceptance: 'scripts/governance_acceptance/POSTV1_01_PRODUCTION_HARDENING_BASELINE.cjs',
};

const assertions = [];

function abs(file) {
  return path.resolve(ROOT, file);
}

function read(file) {
  return fs.readFileSync(abs(file), 'utf8');
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

function containsAll(text, tokens) {
  return tokens.every((token) => text.includes(token));
}

function ordered(text, tokens) {
  let previous = -1;
  for (const token of tokens) {
    const next = text.indexOf(token);
    if (next <= previous) return false;
    previous = next;
  }
  return true;
}

function main() {
  for (const [key, file] of Object.entries(FILES)) {
    assert(`${key}_exists`, fs.existsSync(abs(file)), { file });
  }

  const taskLine = read(FILES.taskLine);
  const completionReview = read(FILES.completionReview);
  const postv101Acceptance = read(FILES.postv101Acceptance);

  assert('stage_name_frozen', taskLine.includes('Post-Twin-Kernel-v1 Productionization'), { file: FILES.taskLine });
  assert('v1_baseline_preserved', containsAll(taskLine, ['tag: twin_kernel_v1_completion_review', 'Twin Kernel v1 bounded human-gated execution-to-learning loop', 'business closure readback']), { file: FILES.taskLine });
  assert('formal_phase_line_present', containsAll(taskLine, ['P1 Production Hardening', 'P2 Real Adapter Integration', 'P3 Operator UX Refinement', 'P4 Policy-Controlled ROI', 'P5 Policy-Controlled Field Memory Governance', 'P6 Execution System Integration']), { file: FILES.taskLine });
  assert('phase_order_is_p1_to_p6', ordered(taskLine, ['P1 Production Hardening', 'P2 Real Adapter Integration', 'P3 Operator UX Refinement', 'P4 Policy-Controlled ROI', 'P5 Policy-Controlled Field Memory Governance', 'P6 Execution System Integration']), { file: FILES.taskLine });
  assert('dependency_layers_declared', containsAll(taskLine, ['P1 → P2 → P3', 'P4 → P5 → P6', 'P1 → P2 → P3 → P4 → P5 → P6']), { file: FILES.taskLine });
  assert('p1_declared_prerequisite', containsAll(taskLine, ['P1 is the prerequisite for every later phase.', 'Move the system from acceptance fixture happy path to production-interface stability.']), { file: FILES.taskLine });
  assert('tk16_correction_preserved', containsAll(taskLine, ['TK16 is accepted as a configurable multi-scope regression harness framework.', 'TK16 must not be described as full strong fixture coverage.', 'At least 3 project/group/field scopes.', 'At least 2 seasons.', 'At least 2 crops.']), { file: FILES.taskLine });
  assert('p1_internal_tasks_present', containsAll(taskLine, ['POSTV1-02 Strong Multi-Scope Fixture Pack', 'POSTV1-03 Ingestion Idempotency & Error Taxonomy', 'POSTV1-04 Route Negative Runtime Matrix', 'POSTV1-05 DB Index / Query Cost Audit', 'POSTV1-06 Docker Startup / Migration Runner Baseline']), { file: FILES.taskLine });
  assert('p2_adapter_boundary_present', containsAll(taskLine, ['source_system registry', 'source_event_id duplicate semantics', 'raw payload pointer policy', 'opaque payload boundary', 'Adapters cannot create AO-ACT tasks.']), { file: FILES.taskLine });
  assert('p3_operator_ux_boundary_present', containsAll(taskLine, ['business closure status cards', 'No automatic formalization.', 'No priority scoring.', 'No autonomous next action.']), { file: FILES.taskLine });
  assert('p4_roi_hard_boundary_present', containsAll(taskLine, ['ROI preview is not formal ROI.', 'ROI dry-run is not a decision.', 'ROI policy cannot advance decision_cycle_v1.', 'Operator formalization action remains the only formal ROI path.']), { file: FILES.taskLine });
  assert('p5_memory_hard_boundary_present', containsAll(taskLine, ['Field Memory governance is not model update governance.', 'Writing memory and updating a model are two separate gates.', 'No automatic model update.', 'No silent overwrite of existing memory.']), { file: FILES.taskLine });
  assert('p6_execution_hard_boundary_present', containsAll(taskLine, ['operation plan → AO-ACT task requires human review.', 'AO-ACT task is not created automatically by Twin Kernel.', 'Receipt adapter only ingests receipts.', 'Acceptance gate cannot auto-pass.', 'Trace readback cannot cause execution side effects.']), { file: FILES.taskLine });
  assert('v1_completion_review_still_frozen', containsAll(completionReview, ['Twin Kernel v1', 'human-gated', 'business closure readback', 'autonomous execution: absent by design']), { file: FILES.completionReview });
  assert('postv101_acceptance_still_points_to_postv102', containsAll(postv101Acceptance, ['POSTV1_01_PRODUCTION_HARDENING_BASELINE', 'POSTV1-02_STRONG_MULTI_SCOPE_FIXTURE_PACK']), { file: FILES.postv101Acceptance });

  console.log(JSON.stringify({
    ok: true,
    acceptance: ACCEPTANCE,
    stage: 'Post-Twin-Kernel-v1 Productionization',
    formal_phase_line: [
      'P1 Production Hardening',
      'P2 Real Adapter Integration',
      'P3 Operator UX Refinement',
      'P4 Policy-Controlled ROI',
      'P5 Policy-Controlled Field Memory Governance',
      'P6 Execution System Integration',
    ],
    merge_order: 'P1 -> P2 -> P3 -> P4 -> P5 -> P6',
    current_phase: 'P1 Production Hardening',
    next_step: 'POSTV1-02_STRONG_MULTI_SCOPE_FIXTURE_PACK',
    assertions,
  }, null, 2));
}

try {
  main();
} catch (error) {
  console.error(JSON.stringify({
    ok: false,
    acceptance: ACCEPTANCE,
    error: error.message,
    details: error.details || null,
    assertions,
  }, null, 2));
  process.exit(1);
}
