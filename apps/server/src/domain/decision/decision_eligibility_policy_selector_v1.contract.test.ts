import assert from "node:assert/strict";
import test from "node:test";

import type { Pool } from "pg";

import type { CandidateDecisionV1 } from "../../contracts/canonical_decision_v1.js";
import type { ContextSnapshotV1 } from "../../contracts/canonical_context_v1.js";
import type { DecisionEligibilityPolicyDeclarationV1 } from "../../contracts/decision_eligibility_policy_declaration_v1.js";
import {
  readAndSelectDecisionEligibilityPolicyV1,
  selectDecisionEligibilityPolicyFromFactsV1,
  type DecisionEligibilityPolicyDeclarationFactRowV1,
} from "./decision_eligibility_policy_selector_v1.js";

const scope = {
  tenant_id: "tenant-1",
  project_id: "project-1",
  group_id: "group-1",
  field_id: "field-1",
  season_id: "season-1",
  zone_id: null,
};

function candidate(overrides: Partial<CandidateDecisionV1> = {}): CandidateDecisionV1 {
  return {
    schema_version: "candidate_decision_v1",
    candidate_id: "candidate-1",
    scope,
    source_ref: "source-fact-1",
    source_class: "LEGACY_RECOMMENDATION",
    proposed_action: {
      action_type: "IRRIGATE",
      target: { kind: "FIELD", ref: "field-1" },
      parameters_hint: {},
      action_spec_ref: null,
    },
    basis: {
      evidence_qualification_refs: ["eq-1"],
      context_snapshot_ref: "context-1",
      crop_stage_state_ref: null,
      calculation_result_refs: [],
      interpretation_refs: [],
      legacy_source_refs: ["legacy-1"],
    },
    confidence: 0.8,
    reasons: ["fixture"],
    limitations: [],
    decision_time: "2026-08-30T12:00:00.000Z",
    created_at: "2026-08-30T11:00:00.000Z",
    authority_state: "CANDIDATE_ONLY",
    ...overrides,
  };
}

function context(programIds: string[] = ["program-1"]): ContextSnapshotV1 {
  return {
    schema_version: "context_snapshot_v1",
    snapshot_id: "context-1",
    scope,
    decision_time: "2026-08-30T12:00:00.000Z",
    assertions: programIds.map((programId, index) => ({
      schema_version: "context_assertion_v1",
      assertion_id: `assertion-${index + 1}`,
      scope,
      kind: "DECLARED_FIELD_PROGRAM",
      value: { program_id: programId },
      source_ref: `field_program_v1:${programId}`,
      source_class: "COMPATIBILITY_LEGACY",
      asserted_at: "2026-08-30T10:00:00.000Z",
      effective_at: null,
      limitations: ["fixture"],
      reason_codes: [],
    })),
    limitations: [],
    reason_codes: [],
  };
}

function declaration(input: {
  policy_id?: string;
  policy_version?: string;
  action_types?: string[];
  decision_scope?: CandidateDecisionV1["scope"];
  anchor_ref?: string;
  declared_at?: string;
  effective_from?: string;
  effective_until?: string | null;
  supersedes_policy_ref?: string | null;
} = {}): DecisionEligibilityPolicyDeclarationV1 {
  const policyId = input.policy_id ?? "irrigation-eligibility";
  const version = input.policy_version ?? "v1";
  return {
    schema_version: "decision_eligibility_policy_declaration_v1",
    declaration_id: `decision_eligibility_policy_declaration_v1:${policyId}:${version}`,
    policy_id: policyId,
    policy_version: version,
    policy_ref: `decision_eligibility_policy_v1:${policyId}:${version}`,
    scope: {
      decision_scope: input.decision_scope ?? scope,
      scope_anchor_type: "PROGRAM",
      scope_anchor_ref: input.anchor_ref ?? "program-1",
    },
    applicable_action_types: input.action_types ?? ["IRRIGATE"],
    required_criteria: ["QUALIFIED_EVIDENCE"],
    lifecycle_semantics: "B07D_LIFECYCLE_STATE_V1",
    declaration_source_type: "AUTHORIZED_HUMAN_API",
    declaration_source_ref: "actor:agronomist-1",
    provenance_refs: ["provenance-1"],
    declared_at: input.declared_at ?? "2026-08-30T10:00:00.000Z",
    effective_from: input.effective_from ?? "2026-08-30T10:00:00.000Z",
    effective_until: input.effective_until ?? null,
    supersedes_policy_ref: input.supersedes_policy_ref ?? null,
    limitations: [],
    authority_state: "POLICY_DECLARATION_ONLY",
  };
}

function fact(
  declarationValue: DecisionEligibilityPolicyDeclarationV1,
  occurredAt = declarationValue.declared_at,
  factId = `fact:${declarationValue.policy_ref}`,
): DecisionEligibilityPolicyDeclarationFactRowV1 {
  return {
    fact_id: factId,
    occurred_at: occurredAt,
    record_json: {
      type: "decision_eligibility_policy_declaration_v1",
      payload: declarationValue,
      audit: {},
    },
  };
}

test("selects exactly one policy under canonical ContextSnapshot Program anchor", () => {
  const selected = selectDecisionEligibilityPolicyFromFactsV1({
    candidate: candidate(),
    context_snapshot: context(),
    policy_facts: [fact(declaration())],
  });
  assert.equal(selected.state, "POLICY_SELECTED");
  assert.equal(selected.program_id, "program-1");
  assert.equal(selected.selected_policy_ref, "decision_eligibility_policy_v1:irrigation-eligibility:v1");
});

test("fails closed when candidate has no canonical ContextSnapshot binding", () => {
  const c = candidate({
    basis: {
      ...candidate().basis,
      context_snapshot_ref: null,
    },
  });
  const selected = selectDecisionEligibilityPolicyFromFactsV1({
    candidate: c,
    context_snapshot: context(),
    policy_facts: [fact(declaration())],
  });
  assert.equal(selected.state, "POLICY_CONTEXT_MISSING");
});

test("fails closed when ContextSnapshot carries multiple Program assertions", () => {
  const selected = selectDecisionEligibilityPolicyFromFactsV1({
    candidate: candidate(),
    context_snapshot: context(["program-1", "program-2"]),
    policy_facts: [fact(declaration())],
  });
  assert.equal(selected.state, "POLICY_SCOPE_AMBIGUOUS");
});

test("requires CandidateDecision.decision_time with no fallback", () => {
  const selected = selectDecisionEligibilityPolicyFromFactsV1({
    candidate: candidate({ decision_time: null }),
    context_snapshot: context(),
    policy_facts: [fact(declaration())],
  });
  assert.equal(selected.state, "POLICY_TIME_BOUNDARY_MISSING");
});

test("null scope is exact null and never wildcard", () => {
  const zonePolicy = declaration({
    decision_scope: { ...scope, zone_id: "zone-1" },
  });
  const selected = selectDecisionEligibilityPolicyFromFactsV1({
    candidate: candidate(),
    context_snapshot: context(),
    policy_facts: [fact(zonePolicy)],
  });
  assert.equal(selected.state, "POLICY_NOT_FOUND");
});

test("rejects a declaration persisted after the candidate boundary", () => {
  const selected = selectDecisionEligibilityPolicyFromFactsV1({
    candidate: candidate(),
    context_snapshot: context(),
    policy_facts: [fact(declaration(), "2026-08-30T12:00:00.001Z")],
  });
  assert.equal(selected.state, "POLICY_NOT_FOUND");
});

test("uses half-open [effective_from,effective_until) semantics", () => {
  const ending = declaration({
    effective_until: "2026-08-30T12:00:00.000Z",
  });
  const selected = selectDecisionEligibilityPolicyFromFactsV1({
    candidate: candidate(),
    context_snapshot: context(),
    policy_facts: [fact(ending)],
  });
  assert.equal(selected.state, "POLICY_NOT_FOUND");
});

test("never resolves overlapping policies by latest/version precedence", () => {
  const selected = selectDecisionEligibilityPolicyFromFactsV1({
    candidate: candidate(),
    context_snapshot: context(),
    policy_facts: [
      fact(declaration({ policy_id: "policy-a", policy_version: "v1" })),
      fact(declaration({ policy_id: "policy-b", policy_version: "v99" }), "2026-08-30T11:59:59.000Z"),
    ],
  });
  assert.equal(selected.state, "POLICY_SCOPE_AMBIGUOUS");
});

test("validated successor deactivates predecessor at successor effective_from", () => {
  const v1 = declaration({ policy_version: "v1" });
  const v2 = declaration({
    policy_version: "v2",
    declared_at: "2026-08-30T11:00:00.000Z",
    effective_from: "2026-08-30T11:30:00.000Z",
    supersedes_policy_ref: v1.policy_ref,
  });
  const selected = selectDecisionEligibilityPolicyFromFactsV1({
    candidate: candidate(),
    context_snapshot: context(),
    policy_facts: [fact(v1), fact(v2)],
  });
  assert.equal(selected.state, "POLICY_SELECTED");
  assert.equal(selected.selected_policy_ref, v2.policy_ref);
});

test("ambiguous successors fail closed", () => {
  const v1 = declaration({ policy_version: "v1" });
  const v2 = declaration({
    policy_version: "v2",
    declared_at: "2026-08-30T10:30:00.000Z",
    effective_from: "2026-08-30T10:30:00.000Z",
    supersedes_policy_ref: v1.policy_ref,
  });
  const v3 = declaration({
    policy_version: "v3",
    declared_at: "2026-08-30T11:00:00.000Z",
    effective_from: "2026-08-30T11:00:00.000Z",
    supersedes_policy_ref: v1.policy_ref,
  });
  const selected = selectDecisionEligibilityPolicyFromFactsV1({
    candidate: candidate(),
    context_snapshot: context(),
    policy_facts: [fact(v1), fact(v2), fact(v3)],
  });
  assert.equal(selected.state, "POLICY_SUPERSESSION_AMBIGUOUS");
});

test("cross-policy supersession fails closed as invalid declaration topology", () => {
  const predecessor = declaration({ policy_id: "policy-a", policy_version: "v1" });
  const successor = declaration({
    policy_id: "policy-b",
    policy_version: "v2",
    declared_at: "2026-08-30T11:00:00.000Z",
    effective_from: "2026-08-30T11:00:00.000Z",
    supersedes_policy_ref: predecessor.policy_ref,
  });
  const selected = selectDecisionEligibilityPolicyFromFactsV1({
    candidate: candidate(),
    context_snapshot: context(),
    policy_facts: [fact(predecessor), fact(successor)],
  });
  assert.equal(selected.state, "POLICY_DECLARATION_INVALID");
});

test("read model uses exact nullable scope/Program anchor/as-of SQL and stays B-07e disconnected", async () => {
  let sql = "";
  let params: unknown[] = [];
  const pool = {
    async query(queryText: string, queryParams: unknown[]) {
      sql = queryText;
      params = queryParams;
      return { rows: [fact(declaration())] };
    },
  } as unknown as Pool;

  const selected = await readAndSelectDecisionEligibilityPolicyV1(pool, {
    candidate: candidate(),
    context_snapshot: context(),
  });

  assert.equal(selected.state, "POLICY_SELECTED");
  assert.match(sql, /IS NOT DISTINCT FROM \$7/);
  assert.match(sql, /scope_anchor_type.*PROGRAM/s);
  assert.match(sql, /occurred_at <= \$9::timestamptz/);
  assert.deepEqual(params.slice(1, 7), [
    scope.tenant_id,
    scope.project_id,
    scope.group_id,
    scope.field_id,
    scope.season_id,
    scope.zone_id,
  ]);
  assert.equal(params[7], "program-1");
  assert.equal(params[8], candidate().decision_time);
});
