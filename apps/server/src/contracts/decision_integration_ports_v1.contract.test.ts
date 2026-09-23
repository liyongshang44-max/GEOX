import assert from "node:assert/strict";
import test from "node:test";

import {
  contextAuthorityPortOutputV1Schema,
  decisionProducerPortOutputV1Schema,
  futureDecisionIntegrationBindingV1Schema,
  governedEvidencePortOutputV1Schema,
  knowledgeClaimInputPortOutputV1Schema,
  twinDecisionInputPortOutputV1Schema,
} from "./decision_integration_ports_v1.js";

const scope = {
  tenant_id: "tenantA",
  project_id: "projectA",
  group_id: "groupA",
  field_id: "fieldA",
  season_id: "seasonA",
  zone_id: null,
};

const candidate = {
  schema_version: "candidate_decision_v1",
  candidate_id: "candidate_001",
  scope,
  source_ref: "recommendation_v1:rec1",
  source_class: "LEGACY_RECOMMENDATION",
  proposed_action: {
    action_type: "IRRIGATE",
    target: {
      kind: "field",
      ref: "fieldA",
    },
    parameters_hint: {},
    action_spec_ref: null,
  },
  basis: {
    evidence_qualification_refs: ["evidence_qualification_v1:eq1"],
    context_snapshot_ref: "context_snapshot_v1:ctx1",
    crop_stage_state_ref: "qualified_crop_stage_state_v1:stage1",
    calculation_result_refs: ["calculation_result_v1:calc1"],
    interpretation_refs: [],
    legacy_source_refs: ["recommendation_v1:rec1"],
  },
  confidence: 0.8,
  reasons: ["IRRIGATION_REQUIREMENT"],
  limitations: [],
  decision_time: "2026-08-28T03:00:00+08:00",
  created_at: "2026-08-28T03:00:01+08:00",
  authority_state: "CANDIDATE_ONLY",
} as const;

test("B-08b GovernedEvidencePort is reference-only", () => {
  const parsed = governedEvidencePortOutputV1Schema.parse({
    schema_version: "governed_evidence_port_output_v1",
    port_kind: "GOVERNED_EVIDENCE",
    scope,
    decision_time: "2026-08-28T03:00:00+08:00",
    evidence_qualification_refs: ["evidence_qualification_v1:eq1"],
    limitations: [],
    authority_state: "REFERENCE_ONLY",
  });

  assert.equal(parsed.authority_state, "REFERENCE_ONLY");
  assert.deepEqual(parsed.evidence_qualification_refs, ["evidence_qualification_v1:eq1"]);
});

test("B-08b ContextAuthorityPort is reference-only and preserves UNKNOWN as null", () => {
  const parsed = contextAuthorityPortOutputV1Schema.parse({
    schema_version: "context_authority_port_output_v1",
    port_kind: "CONTEXT_AUTHORITY",
    scope,
    decision_time: "2026-08-28T03:00:00+08:00",
    context_snapshot_ref: "context_snapshot_v1:ctx1",
    crop_stage_state_ref: null,
    limitations: ["CROP_STAGE_UNKNOWN"],
    authority_state: "REFERENCE_ONLY",
  });

  assert.equal(parsed.crop_stage_state_ref, null);
  assert.equal(parsed.authority_state, "REFERENCE_ONLY");
});

test("B-08b TwinDecisionInputPort carries only state/forecast/scenario refs", () => {
  const parsed = twinDecisionInputPortOutputV1Schema.parse({
    schema_version: "twin_decision_input_port_output_v1",
    port_kind: "TWIN_DECISION_INPUT",
    scope,
    decision_time: "2026-08-28T03:00:00+08:00",
    state_refs: ["qualified_state_v1:state1"],
    forecast_refs: ["forecast_v1:forecast1"],
    scenario_refs: ["scenario_v1:scenario1"],
    limitations: [],
    authority_state: "REFERENCE_ONLY",
  });

  assert.deepEqual(parsed.state_refs, ["qualified_state_v1:state1"]);
  assert.equal("candidate" in parsed, false);
  assert.equal("approval" in parsed, false);
});

test("B-08b KnowledgeClaimInputPort carries only knowledge/policy refs", () => {
  const parsed = knowledgeClaimInputPortOutputV1Schema.parse({
    schema_version: "knowledge_claim_input_port_output_v1",
    port_kind: "KNOWLEDGE_CLAIM_INPUT",
    scope,
    decision_time: "2026-08-28T03:00:00+08:00",
    knowledge_claim_refs: ["knowledge_claim_v1:claim1"],
    policy_refs: ["policy_v1:policy1"],
    limitations: [],
    authority_state: "REFERENCE_ONLY",
  });

  assert.deepEqual(parsed.knowledge_claim_refs, ["knowledge_claim_v1:claim1"]);
  assert.deepEqual(parsed.policy_refs, ["policy_v1:policy1"]);
});

test("B-08b deterministic/human/LLM producer ports can output CandidateDecision only", () => {
  for (const port_kind of ["DETERMINISTIC_CALCULATOR", "HUMAN_REASONING", "LLM_REASONING"]) {
    const parsed = decisionProducerPortOutputV1Schema.parse({
      schema_version: "decision_producer_port_output_v1",
      port_kind,
      candidate: {
        ...candidate,
        candidate_id: "candidate_" + port_kind,
      },
      reasoning_trace_refs: ["reasoning_trace:" + port_kind],
      limitations: [],
      authority_state: "CANDIDATE_ONLY",
    });

    assert.equal(parsed.authority_state, "CANDIDATE_ONLY");
    assert.equal(parsed.candidate.authority_state, "CANDIDATE_ONLY");
  }
});

test("B-08b producer port strict schema rejects eligibility Approval Task and device authority", () => {
  for (const extra of [
    { eligibility_verdict: "PASS" },
    { approved: true },
    { approval_request_id: "apr1" },
    { operation_plan_id: "opl1" },
    { task_id: "task1" },
    { device_command: "START" },
  ]) {
    assert.throws(() => decisionProducerPortOutputV1Schema.parse({
      schema_version: "decision_producer_port_output_v1",
      port_kind: "LLM_REASONING",
      candidate,
      reasoning_trace_refs: ["reasoning_trace:1"],
      limitations: [],
      authority_state: "CANDIDATE_ONLY",
      ...extra,
    }));
  }
});

test("B-08b producer port rejects non-candidate authority inside candidate", () => {
  assert.throws(() => decisionProducerPortOutputV1Schema.parse({
    schema_version: "decision_producer_port_output_v1",
    port_kind: "HUMAN_REASONING",
    candidate: {
      ...candidate,
      authority_state: "APPROVED",
    },
    reasoning_trace_refs: [],
    limitations: [],
    authority_state: "CANDIDATE_ONLY",
  }));
});

test("B-08b real MCFT ADR LLM bindings are structurally disconnected", () => {
  const cases = [
    ["MCFT", "TWIN_DECISION_INPUT"],
    ["ADR", "KNOWLEDGE_CLAIM_INPUT"],
    ["LLM", "LLM_REASONING"],
  ] as const;

  for (const [integration_target, port_kind] of cases) {
    const parsed = futureDecisionIntegrationBindingV1Schema.parse({
      schema_version: "future_decision_integration_binding_v1",
      integration_target,
      port_kind,
      binding_state: "DISCONNECTED",
      adapter_ref: null,
      provider_ref: null,
      runtime_edge: "INTENTIONAL_NONE",
      limitations: ["REAL_INTEGRATION_NOT_CONNECTED_IN_B08"],
    });

    assert.equal(parsed.binding_state, "DISCONNECTED");
    assert.equal(parsed.adapter_ref, null);
    assert.equal(parsed.provider_ref, null);
    assert.equal(parsed.runtime_edge, "INTENTIONAL_NONE");
  }
});

test("B-08b target-to-port mapping is exact", () => {
  for (const [integration_target, wrong_port_kind] of [
    ["MCFT", "KNOWLEDGE_CLAIM_INPUT"],
    ["ADR", "LLM_REASONING"],
    ["LLM", "TWIN_DECISION_INPUT"],
  ]) {
    assert.throws(() => futureDecisionIntegrationBindingV1Schema.parse({
      schema_version: "future_decision_integration_binding_v1",
      integration_target,
      port_kind: wrong_port_kind,
      binding_state: "DISCONNECTED",
      adapter_ref: null,
      provider_ref: null,
      runtime_edge: "INTENTIONAL_NONE",
      limitations: [],
    }), /B08B_INTEGRATION_TARGET_PORT_KIND_MISMATCH/);
  }
});

test("B-08b real integration descriptor rejects connected/non-null bindings", () => {
  for (const bad of [
    { binding_state: "CONNECTED" },
    { adapter_ref: "mcft_adapter_v1" },
    { provider_ref: "provider_v1" },
    { runtime_edge: "PROVEN" },
  ]) {
    assert.throws(() => futureDecisionIntegrationBindingV1Schema.parse({
      schema_version: "future_decision_integration_binding_v1",
      integration_target: "MCFT",
      port_kind: "TWIN_DECISION_INPUT",
      binding_state: "DISCONNECTED",
      adapter_ref: null,
      provider_ref: null,
      runtime_edge: "INTENTIONAL_NONE",
      limitations: [],
      ...bad,
    }));
  }
});
