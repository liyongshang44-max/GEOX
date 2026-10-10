import assert from "node:assert/strict";
import test from "node:test";

import { assembleDecisionEpisodeV1 } from "./decision_episode_assembler_v1.js";

const candidate = {
  schema_version: "candidate_decision_v1",
  candidate_id: "candidate_001",
  scope: {
    tenant_id: "tenantA",
    project_id: "projectA",
    group_id: "groupA",
    field_id: "fieldA",
    season_id: "seasonA",
    zone_id: null,
  },
  source_ref: "legacy:recommendation:1",
  source_class: "LEGACY_RECOMMENDATION",
  proposed_action: {
    action_type: "IRRIGATE",
    target: { kind: "field", ref: "fieldA" },
    parameters_hint: {},
    action_spec_ref: null,
  },
  basis: {
    evidence_qualification_refs: [
      "evidence_qualification_v1:eq_soil",
      "evidence_qualification_v1:eq_weather",
    ],
    context_snapshot_ref: "context_snapshot_v1:ctx1",
    crop_stage_state_ref: "qualified_crop_stage_state_v1:stage1",
    calculation_result_refs: ["calculation_result_v1:calc1"],
    interpretation_refs: ["interpretation_v1:int1"],
    legacy_source_refs: ["legacy:recommendation:1"],
  },
  confidence: 0.8,
  reasons: ["IRRIGATION_REQUIREMENT"],
  limitations: [],
  decision_time: "2026-08-28T03:00:00+08:00",
  created_at: "2026-08-28T03:00:10+08:00",
  authority_state: "CANDIDATE_ONLY",
} as const;

const eligibility = {
  schema_version: "decision_eligibility_decision_v1",
  eligibility_id: "eligibility_001",
  scope: candidate.scope,
  inputs: {
    candidate_ref: "candidate_decision_v1:candidate_001",
    evidence_qualification_refs: [
      "evidence_qualification_v1:eq_soil",
      "evidence_qualification_v1:eq_weather",
      "evidence_qualification_v1:eq_pressure",
    ],
    context_snapshot_ref: "context_snapshot_v1:ctx1",
    crop_stage_state_ref: "qualified_crop_stage_state_v1:stage1",
    state_refs: ["qualified_state_v1:state1"],
    forecast_refs: ["forecast_v1:forecast1"],
    scenario_refs: ["scenario_v1:scenario1"],
    knowledge_claim_refs: ["knowledge_claim_v1:claim1"],
    policy_refs: ["policy_v1:policy1"],
    permission_refs: ["permission_v1:operator1"],
    action_window_refs: ["action_window_v1:window1"],
  },
  criteria: [
    {
      criterion: "QUALIFIED_EVIDENCE",
      status: "SATISFIED",
      reason_codes: [],
      support_refs: ["evidence_qualification_v1:eq_pressure"],
    },
  ],
  verdict: "PASS",
  reason_codes: ["ELIGIBILITY_VERDICT:PASS"],
  limitations: ["ELIGIBILITY_PASS_IS_NOT_APPROVAL"],
  remaining_uncertainty: [],
  lifecycle_state: "ACTIVE",
  evaluated_at: "2026-08-28T03:01:00+08:00",
  decision_time: "2026-08-28T03:00:00+08:00",
  authority_state: "ELIGIBILITY_ONLY",
} as const;

function base(overrides: Record<string, unknown> = {}) {
  return {
    episode_id: "episode_001",
    candidate,
    eligibility,
    deterministic_reasoning_refs: ["deterministic_reasoning:1"],
    human_reasoning_refs: [],
    llm_reasoning_refs: [],
    downstream: {},
    source_trace_refs: ["source_trace:1"],
    limitations: [],
    assembled_at: "2026-08-28T03:02:00+08:00",
    ...overrides,
  } as any;
}

test("B-08c assembles trace from real Candidate and Eligibility without new authority", () => {
  const episode = assembleDecisionEpisodeV1(base());

  assert.equal(episode.authority_state, "TRACE_ONLY");
  assert.deepEqual(episode.scope, candidate.scope);
  assert.equal(episode.decision_time, candidate.decision_time);
  assert.equal(episode.decision_authority_refs.candidate_ref, "candidate_decision_v1:candidate_001");
  assert.equal(
    episode.decision_authority_refs.eligibility_ref,
    "decision_eligibility_decision_v1:eligibility_001",
  );
  assert.equal("verdict" in episode, false);
  assert.equal("approved" in episode, false);
  assert.equal("device_command" in episode, false);
});

test("B-08c derives canonical authority and reasoning refs from upstream objects", () => {
  const episode = assembleDecisionEpisodeV1(base());

  assert.deepEqual(
    episode.authority_inputs.evidence_qualification_refs,
    eligibility.inputs.evidence_qualification_refs,
  );
  assert.equal(
    episode.authority_inputs.context_snapshot_ref,
    candidate.basis.context_snapshot_ref,
  );
  assert.deepEqual(
    episode.reasoning_refs.calculation_result_refs,
    candidate.basis.calculation_result_refs,
  );
  assert.deepEqual(
    episode.reasoning_refs.interpretation_refs,
    candidate.basis.interpretation_refs,
  );
});

test("B-08c rejects Candidate/Eligibility identity and scope drift", () => {
  assert.throws(
    () => assembleDecisionEpisodeV1(base({
      eligibility: {
        ...eligibility,
        inputs: { ...eligibility.inputs, candidate_ref: "candidate_decision_v1:other" },
      },
    })),
    /B08C_ELIGIBILITY_CANDIDATE_REF_MISMATCH/,
  );

  assert.throws(
    () => assembleDecisionEpisodeV1(base({
      eligibility: {
        ...eligibility,
        scope: { ...eligibility.scope, field_id: "fieldB" },
      },
    })),
    /B08C_SCOPE_MISMATCH/,
  );
});

test("B-08c rejects context/stage/evidence continuity drift", () => {
  assert.throws(
    () => assembleDecisionEpisodeV1(base({
      eligibility: {
        ...eligibility,
        inputs: { ...eligibility.inputs, context_snapshot_ref: "context_snapshot_v1:other" },
      },
    })),
    /B08C_CONTEXT_SNAPSHOT_REF_MISMATCH/,
  );

  assert.throws(
    () => assembleDecisionEpisodeV1(base({
      eligibility: {
        ...eligibility,
        inputs: { ...eligibility.inputs, crop_stage_state_ref: null },
      },
    })),
    /B08C_CROP_STAGE_STATE_REF_MISMATCH/,
  );

  assert.throws(
    () => assembleDecisionEpisodeV1(base({
      eligibility: {
        ...eligibility,
        inputs: {
          ...eligibility.inputs,
          evidence_qualification_refs: ["evidence_qualification_v1:eq_soil"],
        },
      },
    })),
    /B08C_CANDIDATE_EVIDENCE_REF_MISSING_FROM_ELIGIBILITY:evidence_qualification_v1:eq_weather/,
  );
});

test("B-08c requires one explicit consistent decision_time", () => {
  assert.throws(
    () => assembleDecisionEpisodeV1(base({
      candidate: { ...candidate, decision_time: null },
    })),
    /B08C_CANDIDATE_DECISION_TIME_REQUIRED/,
  );

  assert.throws(
    () => assembleDecisionEpisodeV1(base({
      eligibility: {
        ...eligibility,
        decision_time: "2026-08-28T03:00:01+08:00",
      },
    })),
    /B08C_DECISION_TIME_MISMATCH/,
  );
});

test("B-08c assembly time cannot precede candidate or eligibility", () => {
  assert.throws(
    () => assembleDecisionEpisodeV1(base({
      assembled_at: "2026-08-28T03:00:05+08:00",
    })),
    /B08C_ASSEMBLY_PRECEDES_CANDIDATE_CREATION/,
  );

  assert.throws(
    () => assembleDecisionEpisodeV1(base({
      assembled_at: "2026-08-28T03:00:30+08:00",
    })),
    /B08C_ASSEMBLY_PRECEDES_ELIGIBILITY_EVALUATION/,
  );
});

test("B-08c can represent full commercial chain as refs only", () => {
  const episode = assembleDecisionEpisodeV1(base({
    downstream: {
      approval_request_ref: "approval_request_v1:req1",
      approval_decision_ref: "approval_decision_v1:dec1",
      approved_operation_plan_ref: "operation_plan_v1:plan1",
      task_refs: ["ao_act_task_v0:task1"],
      receipt_refs: ["receipt_v1:receipt1"],
      as_executed_refs: ["as_executed_v1:exec1"],
      as_applied_refs: ["as_applied_v1:applied1"],
      acceptance_refs: ["acceptance_v1:acc1"],
      outcome_evidence_refs: ["outcome_evidence_v1:out1"],
      field_memory_refs: ["field_memory_v1:mem1"],
    },
  }));

  assert.equal(episode.decision_authority_refs.approval_request_ref, "approval_request_v1:req1");
  assert.equal(
    episode.decision_authority_refs.approved_operation_plan_ref,
    "operation_plan_v1:plan1",
  );
  assert.deepEqual(episode.execution_refs.task_refs, ["ao_act_task_v0:task1"]);
  assert.deepEqual(episode.execution_refs.acceptance_refs, ["acceptance_v1:acc1"]);
  assert.equal(
    episode.limitations.includes("REFERENCE_EXISTENCE_DOES_NOT_CREATE_OR_REPLACE_AUTHORITY"),
    true,
  );
});

test("B-08c downstream trace ordering fails closed", () => {
  const cases = [
    {
      downstream: { approval_decision_ref: "approval_decision_v1:dec1" },
      re: /B08C_APPROVAL_DECISION_REQUIRES_REQUEST_REF/,
    },
    {
      downstream: {
        approval_request_ref: "approval_request_v1:req1",
        approved_operation_plan_ref: "operation_plan_v1:plan1",
      },
      re: /B08C_APPROVED_PLAN_REQUIRES_APPROVAL_DECISION_REF/,
    },
    {
      downstream: { task_refs: ["ao_act_task_v0:task1"] },
      re: /B08C_TASK_TRACE_REQUIRES_APPROVED_PLAN_REF/,
    },
    {
      downstream: { receipt_refs: ["receipt_v1:r1"] },
      re: /B08C_EXECUTION_TRACE_REQUIRES_TASK_REF/,
    },
    {
      downstream: { acceptance_refs: ["acceptance_v1:a1"] },
      re: /B08C_ACCEPTANCE_TRACE_REQUIRES_EXECUTION_EVIDENCE_REF/,
    },
    {
      downstream: { outcome_evidence_refs: ["outcome_v1:o1"] },
      re: /B08C_OUTCOME_TRACE_REQUIRES_ACCEPTANCE_REF/,
    },
  ];

  for (const c of cases) {
    assert.throws(() => assembleDecisionEpisodeV1(base(c)), c.re);
  }
});

test("B-08c LLM reasoning refs are trace refs only and do not imply a connected provider", () => {
  const episode = assembleDecisionEpisodeV1(base({
    llm_reasoning_refs: ["llm_reasoning_trace:future_or_manual_1"],
  }));

  assert.deepEqual(
    episode.reasoning_refs.llm_reasoning_refs,
    ["llm_reasoning_trace:future_or_manual_1"],
  );
  assert.equal(
    episode.limitations.includes("REAL_MCFT_ADR_LLM_INTEGRATIONS_REMAIN_DISCONNECTED"),
    true,
  );
});

test("B-08c invalid upstream authority objects fail closed", () => {
  assert.throws(
    () => assembleDecisionEpisodeV1(base({
      candidate: { ...candidate, authority_state: "APPROVED" },
    })),
    /B08C_INVALID_CANDIDATE_DECISION/,
  );

  assert.throws(
    () => assembleDecisionEpisodeV1(base({
      eligibility: { ...eligibility, authority_state: "APPROVED" },
    })),
    /B08C_INVALID_DECISION_ELIGIBILITY/,
  );
});
