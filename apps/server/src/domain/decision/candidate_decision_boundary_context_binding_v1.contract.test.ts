import assert from "node:assert/strict";
import test from "node:test";

import type { AgronomyEvidenceDependencyShadowBindingV1 } from "./agronomy_evidence_dependency_shadow_binding_v1.js";
import { projectAgronomyQualifiedEvidenceCriterionShadowV1 } from "./agronomy_qualified_evidence_criterion_shadow_v1.js";
import {
  buildCandidateDecisionBoundaryContextBindingV1,
} from "./candidate_decision_boundary_context_binding_v1.js";
import {
  projectDecisionRecommendationCandidateCriterionShadowBindingV1,
} from "./decision_recommendation_candidate_criterion_shadow_binding_v1.js";

type Fact = {
  fact_id: string;
  occurred_at: string;
  source: string;
  record_json: any;
};

function recommendationFact(): Fact {
  return {
    fact_id: "rec-fact-1",
    occurred_at: "2026-08-31T05:00:00.000Z",
    source: "api/v1/recommendations/generate",
    record_json: {
      type: "decision_recommendation_v1",
      payload: {
        tenant_id: "tenantA",
        project_id: "projectA",
        group_id: "groupA",
        recommendation_id: "rec_A",
        field_id: "fieldA",
        season_id: "seasonA",
        device_id: "deviceA",
        action_type: "IRRIGATE",
        status: "proposed",
        confidence: 0.8,
        reason_codes: ["SOIL_WATER_DEFICIT"],
        suggested_action: {
          action_type: "irrigation.start",
          parameters: { amount: 12, unit: "mm" },
        },
      },
    },
  };
}

function fieldProgramFact(
  factId = "program-fact-1",
  programId = "programA",
  fieldId = "fieldA",
): Fact {
  return {
    fact_id: factId,
    occurred_at: "2026-08-31T04:00:00.000Z",
    source: "api/v1/programs",
    record_json: {
      type: "field_program_v1",
      payload: {
        tenant_id: "tenantA",
        project_id: "projectA",
        group_id: "groupA",
        program_id: programId,
        field_id: fieldId,
        season_id: "seasonA",
        crop_code: "corn",
        variety_code: "P1234",
        goal_profile: {
          yield_priority: "high",
          quality_priority: "medium",
          residue_priority: "low",
          water_saving_priority: "high",
          cost_priority: "medium",
        },
        constraints: {
          forbid_pesticide_classes: [],
          forbid_fertilizer_types: [],
          max_irrigation_mm_per_day: 20,
          manual_approval_required_for: ["irrigation"],
          allow_night_irrigation: false,
        },
        budget: {
          max_cost_total: 5000,
          currency: "USD",
        },
        execution_policy: {
          mode: "approval_required",
          auto_execute_allowed_task_types: [],
        },
        acceptance_policy_ref: "acceptance_policy:A",
        evidence_policy_ref: "evidence_policy:A",
        status: "ACTIVE",
        created_ts: Date.parse("2026-05-20T12:00:00Z"),
        updated_ts: Date.parse("2026-08-27T09:00:00Z"),
      },
    },
  };
}

class FakeClient {
  constructor(private readonly facts: Fact[]) {}

  release(): void {}

  async query(sql: string, params: any[] = []): Promise<{ rows: any[] }> {
    if (
      sql === "BEGIN"
      || sql === "COMMIT"
      || sql === "ROLLBACK"
      || sql.includes("pg_advisory_xact_lock")
    ) {
      return { rows: [] };
    }

    if (sql.includes("INSERT INTO facts")) {
      const [factId, occurredAt, source, record] = params;
      this.facts.push({
        fact_id: String(factId),
        occurred_at: String(occurredAt),
        source: String(source),
        record_json: record,
      });
      return { rows: [] };
    }

    if (
      sql.includes("payload,candidate_ref")
      && sql.includes("canonical_decision_boundary_envelope_v1") === false
    ) {
      const [type, candidateRef] = params;
      return {
        rows: this.facts
          .filter((fact) =>
            fact.record_json?.type === type
            && fact.record_json?.payload?.candidate_ref === candidateRef)
          .slice(0, 2),
      };
    }

    if (sql.includes("payload,candidate_ref")) {
      const [type, candidateRef] = params;
      return {
        rows: this.facts
          .filter((fact) =>
            fact.record_json?.type === type
            && fact.record_json?.payload?.candidate_ref === candidateRef)
          .slice(0, 2),
      };
    }

    if (sql.includes("WHERE fact_id = $1")) {
      const [factId, type] = params;
      return {
        rows: this.facts
          .filter((fact) =>
            fact.fact_id === factId
            && (!type || fact.record_json?.type === type))
          .slice(0, 2),
      };
    }

    return { rows: [] };
  }
}

class FakePool {
  readonly facts: Fact[];

  constructor(extra: Fact[] = []) {
    this.facts = [recommendationFact(), fieldProgramFact(), ...extra];
  }

  async connect(): Promise<FakeClient> {
    return new FakeClient(this.facts);
  }

  async query(sql: string, params: any[] = []): Promise<{ rows: any[] }> {
    if (
      sql.includes("payload,recommendation_id")
      && sql.includes("decision_recommendation_v1")
    ) {
      const [tenant, project, group, recommendationId] = params;
      return {
        rows: this.facts
          .filter((fact) =>
            fact.record_json?.type === "decision_recommendation_v1"
            && fact.record_json?.payload?.tenant_id === tenant
            && fact.record_json?.payload?.project_id === project
            && fact.record_json?.payload?.group_id === group
            && fact.record_json?.payload?.recommendation_id === recommendationId)
          .slice(0, 2),
      };
    }

    if (sql.includes("WHERE fact_id = $1")) {
      const [factId] = params;
      return {
        rows: this.facts
          .filter((fact) =>
            fact.fact_id === factId
            && fact.record_json?.type === "field_program_v1")
          .slice(0, 2),
      };
    }

    return { rows: [] };
  }
}

const input = {
  tenant_id: "tenantA",
  project_id: "projectA",
  group_id: "groupA",
  field_id: "fieldA",
  season_id: "seasonA",
  device_id: "deviceA",
  recommendation_id: "rec_A",
  field_program_fact_id: "program-fact-1",
};

function evidenceBinding(): AgronomyEvidenceDependencyShadowBindingV1 {
  return {
    schema_version: "agronomy_evidence_dependency_shadow_binding_v1",
    authority_mode: "SHADOW_NON_AUTHORITATIVE",
    binding_state: "BOUND",
    evidence_judge_id: "ej1",
    evidence_judge_ref: "judge_result_v2:ej1",
    requested_field_id: "fieldA",
    persisted_field_id: "fieldA",
    request_legacy_verdict: "PASS",
    persisted_legacy_verdict: "PASS",
    legacy_verdict_match: true,
    canonical_sufficiency_status: "SUFFICIENT",
    semantic_comparison_state: "MATCH",
    canonical_evidence_qualification_refs: [
      "evidence_qualification_v1:eq1",
      "evidence_qualification_v1:eq2",
    ],
    canonical_evidence_qualification_refs_state:
      "AVAILABLE_FROM_PERSISTED_CANONICAL_SHADOW",
    criterion_shadow_provenance_readiness: "READY_FOR_CRITERION_SHADOW",
    target_boundary: "B07_QUALIFIED_EVIDENCE_CRITERION_THEN_DECISION_ELIGIBILITY",
    migration_readiness: "NOT_READY_FOR_CRITERION_CUTOVER",
    reason_codes: ["READY"],
    limitations: ["SHADOW_ONLY"],
    legacy_consumer_unchanged: true,
    consumer_migration_performed: false,
    authority_removal_permitted: false,
  };
}

test("B-09y creates one server-time boundary from exact recommendation and exact FieldProgram facts", async () => {
  const pool = new FakePool();
  const out = await buildCandidateDecisionBoundaryContextBindingV1(
    pool as any,
    input,
    ["evidence_qualification_v1:eq2", "evidence_qualification_v1:eq1"],
    { now: () => "2026-08-31T06:00:00.000Z" },
  );

  assert.equal(out.binding_state, "BOUND");
  assert.equal(out.persisted_state, "CREATED");
  assert.equal(out.decision_time, "2026-08-31T06:00:00.000Z");
  assert.equal(out.exact_program_binding, true);
  assert.equal(out.legacy_latest_program_reader_used, false);
  assert.equal(out.caller_decision_time_accepted, false);
  assert.equal(out.boundary_envelope?.authority_state, "BOUNDARY_ONLY");
  assert.equal(out.boundary_envelope?.server_created, true);
  assert.deepEqual(out.boundary_envelope?.forecast_refs, []);
  assert.equal(
    out.boundary_envelope?.field_program_fact_ref,
    "field_program_v1:program-fact-1",
  );
  assert.equal(
    out.context_snapshot?.assertions.every(
      (assertion) => assertion.source_ref === "field_program_fact_v1:program-fact-1",
    ),
    true,
  );
  assert.equal(
    out.context_snapshot?.decision_time,
    "2026-08-31T06:00:00.000Z",
  );
  assert.equal(
    pool.facts.filter(
      (fact) => fact.record_json?.type === "canonical_decision_boundary_envelope_v1",
    ).length,
    1,
  );
  assert.equal(
    pool.facts.filter(
      (fact) => fact.record_json?.type === "context_snapshot_v1",
    ).length,
    1,
  );
});

test("B-09y same Candidate + same exact refs is idempotent and preserves original decision_time", async () => {
  const pool = new FakePool();
  const first = await buildCandidateDecisionBoundaryContextBindingV1(
    pool as any,
    input,
    ["evidence_qualification_v1:eq1"],
    { now: () => "2026-08-31T06:00:00.000Z" },
  );
  const second = await buildCandidateDecisionBoundaryContextBindingV1(
    pool as any,
    input,
    ["evidence_qualification_v1:eq1"],
    { now: () => "2026-08-31T07:00:00.000Z" },
  );

  assert.equal(first.binding_state, "BOUND");
  assert.equal(second.binding_state, "BOUND");
  assert.equal(second.persisted_state, "EXISTING_IDEMPOTENT");
  assert.equal(second.decision_time, first.decision_time);
  assert.equal(second.boundary_fact_id, first.boundary_fact_id);
});

test("B-09y same Candidate cannot silently switch to another FieldProgram fact", async () => {
  const secondProgram = fieldProgramFact("program-fact-2", "programB");
  const pool = new FakePool([secondProgram]);
  const first = await buildCandidateDecisionBoundaryContextBindingV1(
    pool as any,
    input,
    ["evidence_qualification_v1:eq1"],
    { now: () => "2026-08-31T06:00:00.000Z" },
  );
  assert.equal(first.binding_state, "BOUND");

  const conflict = await buildCandidateDecisionBoundaryContextBindingV1(
    pool as any,
    { ...input, field_program_fact_id: "program-fact-2" },
    ["evidence_qualification_v1:eq1"],
    { now: () => "2026-08-31T07:00:00.000Z" },
  );
  assert.equal(conflict.binding_state, "BOUNDARY_CONFLICT");
});

test("B-09y requires exact FieldProgram fact selector and never falls back to latest", async () => {
  const pool = new FakePool();
  const out = await buildCandidateDecisionBoundaryContextBindingV1(
    pool as any,
    { ...input, field_program_fact_id: null },
    ["evidence_qualification_v1:eq1"],
    { now: () => "2026-08-31T06:00:00.000Z" },
  );
  assert.equal(out.binding_state, "NOT_REQUESTED");
  assert.equal(out.legacy_latest_program_reader_used, false);
  assert.equal(
    pool.facts.some(
      (fact) => fact.record_json?.type === "canonical_decision_boundary_envelope_v1",
    ),
    false,
  );
});

test("B-09y exact FieldProgram scope mismatch fails closed", async () => {
  const wrongProgram = fieldProgramFact("program-wrong", "programWrong", "fieldB");
  const pool = new FakePool([wrongProgram]);
  const out = await buildCandidateDecisionBoundaryContextBindingV1(
    pool as any,
    { ...input, field_program_fact_id: "program-wrong" },
    ["evidence_qualification_v1:eq1"],
    { now: () => "2026-08-31T06:00:00.000Z" },
  );
  assert.equal(out.binding_state, "SCOPE_MISMATCH");
});

test("B-09j accepts only server-bound exact source fact and propagates B-09y Context + decision_time", async () => {
  const pool = new FakePool();
  const boundary = await buildCandidateDecisionBoundaryContextBindingV1(
    pool as any,
    input,
    [
      "evidence_qualification_v1:eq1",
      "evidence_qualification_v1:eq2",
    ],
    { now: () => "2026-08-31T06:00:00.000Z" },
  );
  assert.equal(boundary.binding_state, "BOUND");

  const evidence = evidenceBinding();
  const criterion = projectAgronomyQualifiedEvidenceCriterionShadowV1(evidence);
  const candidate = projectDecisionRecommendationCandidateCriterionShadowBindingV1(
    {
      ...input,
      expected_source_fact_id: boundary.source_recommendation_fact_id,
      context_snapshot_ref: boundary.context_snapshot_ref,
      decision_time: boundary.decision_time,
    },
    [recommendationFact()],
    evidence,
    criterion,
  );

  assert.equal(candidate.binding_state, "BOUND");
  assert.equal(candidate.source_fact_id, boundary.source_recommendation_fact_id);
  assert.equal(
    candidate.candidate_decision?.basis.context_snapshot_ref,
    boundary.context_snapshot_ref,
  );
  assert.equal(
    candidate.candidate_decision?.decision_time,
    boundary.decision_time,
  );
  assert.equal(candidate.decision_eligibility_runtime_connected, false);
});
