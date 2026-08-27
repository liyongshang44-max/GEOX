import assert from "node:assert/strict";
import test from "node:test";

import { decisionEpisodeV1Schema } from "./decision_episode_v1.js";

const base = {
  schema_version: "decision_episode_v1" as const,
  episode_id: "episode_001",
  scope: {
    tenant_id: "tenantA",
    project_id: "projectA",
    group_id: "groupA",
    field_id: "fieldA",
    season_id: "seasonA",
    zone_id: null,
  },
  decision_time: "2026-08-28T03:00:00+08:00",
  authority_inputs: {
    evidence_qualification_refs: [
      "evidence_qualification_v1:eq_soil",
      "evidence_qualification_v1:eq_weather",
    ],
    context_snapshot_ref: "context_snapshot_v1:ctx1",
    crop_stage_state_ref: "qualified_crop_stage_state_v1:stage1",
    state_refs: ["qualified_state_v1:state1"],
    forecast_refs: ["forecast_v1:forecast1"],
    scenario_refs: ["scenario_v1:scenario1"],
    knowledge_claim_refs: ["knowledge_claim_v1:claim1"],
    policy_refs: ["policy_v1:eligibility_irrigation_v1"],
    permission_refs: ["permission_v1:operator1"],
    action_window_refs: ["action_window_v1:window1"],
  },
  reasoning_refs: {
    calculation_result_refs: ["calculation_result_v1:calc1"],
    interpretation_refs: ["agronomy_interpretation_v1:int1"],
    deterministic_reasoning_refs: ["deterministic_reasoning_v1:r1"],
    human_reasoning_refs: [],
    llm_reasoning_refs: [],
  },
  decision_authority_refs: {
    candidate_ref: "candidate_decision_v1:candidate_001",
    eligibility_ref: "decision_eligibility_decision_v1:eligibility_001",
    approval_request_ref: null,
    approval_decision_ref: null,
    approved_operation_plan_ref: null,
  },
  execution_refs: {
    task_refs: [],
    receipt_refs: [],
    as_executed_refs: [],
    as_applied_refs: [],
    acceptance_refs: [],
    outcome_evidence_refs: [],
    field_memory_refs: [],
  },
  source_trace_refs: ["trace:source:001"],
  limitations: [],
  assembled_at: "2026-08-28T03:00:10+08:00",
  authority_state: "TRACE_ONLY" as const,
};

test("B-08a DecisionEpisode represents a complete typed decision-time trace", () => {
  const episode = decisionEpisodeV1Schema.parse(base);

  assert.equal(episode.authority_state, "TRACE_ONLY");
  assert.equal(episode.decision_authority_refs.candidate_ref, "candidate_decision_v1:candidate_001");
  assert.equal(episode.decision_authority_refs.eligibility_ref, "decision_eligibility_decision_v1:eligibility_001");
  assert.deepEqual(episode.authority_inputs.evidence_qualification_refs, base.authority_inputs.evidence_qualification_refs);
  assert.deepEqual(episode.reasoning_refs.calculation_result_refs, ["calculation_result_v1:calc1"]);
});

test("B-08a core decision_time, CandidateDecision and DecisionEligibility refs are mandatory", () => {
  assert.throws(() => decisionEpisodeV1Schema.parse({
    ...base,
    decision_time: "",
  }));

  assert.throws(() => decisionEpisodeV1Schema.parse({
    ...base,
    decision_authority_refs: {
      ...base.decision_authority_refs,
      candidate_ref: "",
    },
  }));

  assert.throws(() => decisionEpisodeV1Schema.parse({
    ...base,
    decision_authority_refs: {
      ...base.decision_authority_refs,
      eligibility_ref: "",
    },
  }));
});

test("B-08a DecisionEpisode stores authority references rather than embedded authority objects", () => {
  const episode = decisionEpisodeV1Schema.parse(base);

  assert.equal(typeof episode.decision_authority_refs.candidate_ref, "string");
  assert.equal(typeof episode.decision_authority_refs.eligibility_ref, "string");
  assert.equal("candidate" in episode, false);
  assert.equal("eligibility" in episode, false);
  assert.equal("approval" in episode, false);
  assert.equal("operation_plan" in episode, false);
});

test("B-08a strict schema rejects authority or execution shortcuts", () => {
  for (const extra of [
    { verdict: "PASS" },
    { approved: true },
    { eligibility_pass: true },
    { approval_authorized: true },
    { task_id: "task1" },
    { execute: true },
    { device_command: "START" },
  ]) {
    assert.throws(() => decisionEpisodeV1Schema.parse({
      ...base,
      ...extra,
    }));
  }
});

test("B-08a reasoning refs cannot directly carry candidate or authority payloads", () => {
  assert.throws(() => decisionEpisodeV1Schema.parse({
    ...base,
    reasoning_refs: {
      ...base.reasoning_refs,
      candidate: {
        proposed_action: { action_type: "IRRIGATE" },
      },
    },
  }));

  assert.throws(() => decisionEpisodeV1Schema.parse({
    ...base,
    reasoning_refs: {
      ...base.reasoning_refs,
      eligibility_verdict: "PASS",
    },
  }));
});

test("B-08a downstream commercial chain is traceable by refs without becoming authority", () => {
  const episode = decisionEpisodeV1Schema.parse({
    ...base,
    decision_authority_refs: {
      ...base.decision_authority_refs,
      approval_request_ref: "approval_request_v1:apr1",
      approval_decision_ref: "approval_decision_v1:apd1",
      approved_operation_plan_ref: "operation_plan_v1:opl1",
    },
    execution_refs: {
      task_refs: ["ao_act_task_v0:task1"],
      receipt_refs: ["receipt_v1:r1"],
      as_executed_refs: ["as_executed_v1:e1"],
      as_applied_refs: ["as_applied_v1:a1"],
      acceptance_refs: ["acceptance_v1:acc1"],
      outcome_evidence_refs: ["outcome_evidence_v1:o1"],
      field_memory_refs: ["field_memory_v1:m1"],
    },
  });

  assert.equal(episode.authority_state, "TRACE_ONLY");
  assert.equal(episode.decision_authority_refs.approval_decision_ref, "approval_decision_v1:apd1");
  assert.deepEqual(episode.execution_refs.task_refs, ["ao_act_task_v0:task1"]);
});

test("B-08a missing/unknown context remains representable without fabrication", () => {
  const episode = decisionEpisodeV1Schema.parse({
    ...base,
    authority_inputs: {
      ...base.authority_inputs,
      context_snapshot_ref: null,
      crop_stage_state_ref: null,
      state_refs: [],
      forecast_refs: [],
      scenario_refs: [],
    },
    limitations: ["CONTEXT_OR_STATE_UNKNOWN"],
  });

  assert.equal(episode.authority_inputs.context_snapshot_ref, null);
  assert.equal(episode.authority_inputs.crop_stage_state_ref, null);
  assert.deepEqual(episode.authority_inputs.state_refs, []);
});

test("B-08a timestamps are offset-aware", () => {
  assert.throws(() => decisionEpisodeV1Schema.parse({
    ...base,
    decision_time: "2026-08-28T03:00:00",
  }));

  assert.throws(() => decisionEpisodeV1Schema.parse({
    ...base,
    assembled_at: "2026-08-28T03:00:10",
  }));
});

test("B-08a real provider/adapter configuration is not part of DecisionEpisode", () => {
  for (const extra of [
    { mcft_adapter: { endpoint: "real" } },
    { adr_runtime: { endpoint: "real" } },
    { llm_provider: { model: "real" } },
  ]) {
    assert.throws(() => decisionEpisodeV1Schema.parse({
      ...base,
      ...extra,
    }));
  }
});

test("B-08a authority_state is fixed to TRACE_ONLY", () => {
  for (const authority_state of ["CANDIDATE_ONLY", "ELIGIBILITY_ONLY", "APPROVED", "EXECUTABLE"]) {
    assert.throws(() => decisionEpisodeV1Schema.parse({
      ...base,
      authority_state,
    }));
  }
});
