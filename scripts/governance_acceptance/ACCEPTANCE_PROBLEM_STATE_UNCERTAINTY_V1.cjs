#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}
function assert(cond, msg) {
  if (!cond) {
    console.error(`[ACCEPTANCE_PROBLEM_STATE_UNCERTAINTY_V1] FAIL: ${msg}`);
    process.exit(1);
  }
}
function includesAll(text, xs, label) {
  for (const x of xs) assert(text.includes(x), `${label} missing ${x}`);
}

const builder = read('apps/server/src/domain/sensing/problem_state_uncertainty_v1.ts');
const pipeline = read('apps/server/src/services/appleii_problem_state_pipeline_v1.ts');
const gateRoute = read('apps/server/src/routes/appleii_stage1_evidence_gate_v1.ts');
const kernel = read('apps/server/src/domain/control_kernel/control_kernel_input_contract_v1.ts');

includesAll(builder, [
  'ProblemStateV1',
  'UncertaintyEnvelopeV1',
  'kind: "problem_state_v1"',
  'kind: "uncertainty_envelope_v1"',
  'problem_state_v1',
  'uncertainty_envelope_v1',
  'appendProblemStateAndUncertaintyFactsV1',
  'source, record_json',
  '"problem_state_v1"',
  '"uncertainty_envelope_v1"',
], 'problem state fact builder');

includesAll(builder, [
  'subjectRef',
  'window',
  'problem_type',
  'problem_scope',
  'state_layer_hint',
  'rate_class_hint',
  'confidence',
  'supporting_evidence_refs',
  'evidence_sufficiency_ref',
  'time_coverage_ref',
  'device_health_ref',
  'conflict_detection_ref',
], 'ProblemState minimum fields');

includesAll(builder, [
  'problem_state_ref',
  'uncertainty_sources',
  'confidence_level',
  'missing_inputs',
  'conflicting_sources',
  'supporting_evidence_refs',
], 'UncertaintyEnvelope minimum fields');

assert(builder.includes('evidenceOk && hasTimeCoverage ? "ACTIONABLE" : "NEEDS_EVIDENCE"'), 'without evidence_sufficiency/time_coverage ProblemState must not be actionable');
assert(builder.includes('if (!stage1Summary.evidence_sufficiency_v1) out.push("evidence_sufficiency_v1")'), 'missing evidence_sufficiency must be tracked');
assert(builder.includes('if (!stage1Summary.time_coverage_v1) out.push("time_coverage_v1")'), 'missing time_coverage must be tracked');
assert(builder.includes('conflict_status:UNRESOLVED'), 'unresolved conflicts must enter uncertainty sources');
assert(builder.includes('conflicting_sources: conflictingSources'), 'conflicts must be surfaced in uncertainty envelope');
assert(builder.includes('supportRefs'), 'problem and uncertainty must carry supporting evidence refs');
assert(!builder.includes('createTask'), 'ProblemState builder must not create task');
assert(!builder.includes('act_task'), 'ProblemState builder must not create AO-ACT task');
assert(!builder.includes('dispatch'), 'ProblemState builder must not dispatch work');

includesAll(pipeline, [
  'runAppleIIProblemStatePipelineV1',
  'refreshFieldReadModelsWithObservabilityV1',
  'appendProblemStateAndUncertaintyFactsV1',
  'stage1_summary',
  'problem_state_output',
], 'Apple II problem state sensing/judge pipeline');
assert(pipeline.includes('formal producer path for ProblemState / UncertaintyEnvelope facts'), 'Apple II pipeline must document formal producer path');
assert(pipeline.includes('Decision routes may call this pipeline as a compatibility bridge'), 'decision route must be compatibility bridge, not owner');

includesAll(gateRoute, [
  'runAppleIIProblemStatePipelineV1',
  'problem_state_v1: problemStateOutput.problem_state_v1',
  'uncertainty_envelope_v1: problemStateOutput.uncertainty_envelope_v1',
  'problem_state_ref',
  'uncertainty_envelope_ref',
  'fact_ids',
  'FORMAL_STAGE1_TRIGGER_NEEDS_EVIDENCE',
], 'decision route compatibility preflight integration');
assert(!gateRoute.includes('appendProblemStateAndUncertaintyFactsV1'), 'decision route must not append ProblemState facts directly; use Apple II pipeline');
assert(!gateRoute.includes('refreshFieldReadModelsWithObservabilityV1'), 'decision route must not refresh Stage-1 directly; use Apple II pipeline');

includesAll(kernel, [
  'PermissionSetV1',
  'ControlKernelInputV1',
  'problem_state_v1: ProblemStateV1',
  'uncertainty_envelope_v1: UncertaintyEnvelopeV1',
  'permission_set_v1: PermissionSetV1',
  'evaluateControlKernelInputV1',
  'CAN_PROPOSE_ACTION',
  'NEEDS_EVIDENCE',
  'FORBIDDEN',
], 'Control Kernel input contract');

assert(!kernel.includes('raw_samples'), 'Control Kernel must not read raw samples directly');
assert(!kernel.includes('field_sensing_summary_stage1_v1'), 'Control Kernel must not read Stage-1 summary directly');
assert(!kernel.includes('evidence_sufficiency_v1') || kernel.includes('uncertainty_envelope_v1: UncertaintyEnvelopeV1'), 'Control Kernel must read evidence via ProblemState/UncertaintyEnvelope only');
assert(!kernel.includes('createTask'), 'Control Kernel input contract must not create task');
assert(!kernel.includes('INSERT INTO facts'), 'Control Kernel input contract must not write facts or tasks');
assert(!kernel.includes('act_task'), 'Control Kernel input contract must not generate AO-ACT task');

console.log('[ACCEPTANCE_PROBLEM_STATE_UNCERTAINTY_V1] PASSED');
