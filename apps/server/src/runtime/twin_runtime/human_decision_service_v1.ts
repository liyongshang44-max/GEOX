// apps/server/src/runtime/twin_runtime/human_decision_service_v1.ts
// Purpose: resolve a controlled Human Decision request against the current canonical Scenario Set, build twin_decision_record_v1, enforce immutable second-write policy, and commit through the existing G persistence path.
// Boundary: internal Replay Runtime service only; no public route, Recommendation, approval, Plan, Task, dispatch, State/checkpoint mutation, wall-clock lookup, filesystem, environment or network authority.

import type { Pool } from "pg";
import {
  buildCap05DecisionV1,
  buildCap05ScenarioOptionMemberRefV1,
  resolveCap05ScenarioOptionMemberV1,
  type Cap05DecisionEnvelopeV1,
} from "../../domain/twin_runtime/feedback_canonical_contracts_v1.js";
import { adjudicateCap05DecisionSecondWriteV1 } from "../../domain/twin_runtime/decision_second_write_policy_v1.js";
import type { Cap04ScenarioOptionIdV1 } from "../../domain/twin_runtime/forecast_scenario_contracts_v1.js";
import type { ContinuationScopeV1 } from "../../domain/twin_runtime/continuation_operation_identity_v1.js";
import type { Cap05PersistenceResultV1 } from "../../persistence/twin_runtime/postgres_feedback_persistence_repository_v1.js";
import { PostgresImmutableDecisionActionCommitRepositoryV1 } from "../../persistence/twin_runtime/postgres_immutable_decision_action_commit_repository_v1.js";
import { PostgresForecastScenarioRecoveryRepositoryV1 } from "../../persistence/twin_runtime/postgres_forecast_scenario_recovery_repository_v1.js";

export const CAP05_HUMAN_DECISION_SERVICE_ID_V1 = "MCFT_CAP_05_CONTROLLED_REPLAY_HUMAN_DECISION_SERVICE_V1" as const;
export const CAP05_DECISION_REQUEST_RECORD_TYPE_V1 = "controlled_human_decision_request_v1" as const;
export const CAP05_DECISION_REQUEST_SOURCE_KIND_V1 = "CONTROLLED_REPLAY_DATASET" as const;

export type CommitCap05HumanDecisionInputV1 = {
  scope: ContinuationScopeV1;
  decision_request_evidence_ref: string;
  decision_request_evidence_hash: string;
  decided_at: string;
};

export type CommitCap05HumanDecisionResultV1 = Cap05PersistenceResultV1 & {
  service_id: typeof CAP05_HUMAN_DECISION_SERVICE_ID_V1;
  scenario_set_ref: string;
  selected_option_ref: string;
  selected_option_hash: string;
  actor_ref: string;
};

type DecisionRequestEvidenceV1 = {
  record_type: typeof CAP05_DECISION_REQUEST_RECORD_TYPE_V1;
  source_record_id: string;
  source_record_hash: string;
  origin_source_kind: typeof CAP05_DECISION_REQUEST_SOURCE_KIND_V1;
  tenant_id: string;
  project_id: string;
  group_id: string;
  field_id: string;
  season_id: string;
  zone_id: string;
  available_to_runtime_at: string;
  quality: { status: "PASS" | "LIMITED" | "FAIL" };
  canonical_payload: {
    actor_class: "HUMAN";
    actor_ref: string;
    requested_disposition: "SELECT_OPTION";
    scenario_set_ref: string;
    scenario_set_hash: string;
    selected_option_id: Cap04ScenarioOptionIdV1;
    selected_option_ref: string;
    selected_option_hash: string;
  };
};

type CurrentDecisionAuthorityV1 = {
  active_lineage_ref: string;
  lineage_id: string;
  revision_id: string;
  scenario_set_id: string;
  scenario_set_hash: string;
  source_forecast_ref: string;
  source_forecast_hash: string;
};

function requiredStringV1(value: unknown, code: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(code);
  return value;
}

function canonicalInstantV1(value: unknown, code: string): string {
  const text = requiredStringV1(value, code);
  const parsed = Date.parse(text);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== text) throw new Error(code);
  return text;
}

function scopeValuesV1(scope: ContinuationScopeV1): string[] {
  return [scope.tenant_id, scope.project_id, scope.group_id, scope.field_id, scope.season_id, scope.zone_id];
}

function assertExactScopeV1(scope: ContinuationScopeV1, evidence: DecisionRequestEvidenceV1): void {
  for (const field of ["tenant_id", "project_id", "group_id", "field_id", "season_id", "zone_id"] as const) {
    if (evidence[field] !== scope[field]) throw new Error(`CAP05_DECISION_REQUEST_SCOPE_MISMATCH:${field}`);
  }
}

function parseEvidenceRecordV1(value: unknown): DecisionRequestEvidenceV1 {
  const parsed = typeof value === "string" ? JSON.parse(value) : value;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("CAP05_DECISION_REQUEST_FACT_INVALID");
  const record = parsed as { type?: unknown; payload?: unknown };
  if (record.type !== CAP05_DECISION_REQUEST_RECORD_TYPE_V1) throw new Error("CAP05_DECISION_REQUEST_FACT_TYPE_MISMATCH");
  if (!record.payload || typeof record.payload !== "object" || Array.isArray(record.payload)) throw new Error("CAP05_DECISION_REQUEST_PAYLOAD_REQUIRED");
  return record.payload as DecisionRequestEvidenceV1;
}

export class Cap05HumanDecisionServiceV1 {
  private readonly scenarioRepository: PostgresForecastScenarioRecoveryRepositoryV1;
  private readonly feedbackRepository: PostgresImmutableDecisionActionCommitRepositoryV1;

  constructor(private readonly pool: Pool) {
    this.scenarioRepository = new PostgresForecastScenarioRecoveryRepositoryV1(pool);
    this.feedbackRepository = new PostgresImmutableDecisionActionCommitRepositoryV1(pool);
  }

  private async readDecisionRequestEvidenceV1(
    evidenceRef: string,
    evidenceHash: string,
  ): Promise<DecisionRequestEvidenceV1> {
    const result = await this.pool.query(
      `SELECT record_json FROM facts
       WHERE record_json->>'type'=$1
         AND record_json->'payload'->>'source_record_id'=$2
       LIMIT 2`,
      [CAP05_DECISION_REQUEST_RECORD_TYPE_V1, evidenceRef],
    );
    if (result.rows.length !== 1) throw new Error("CAP05_DECISION_REQUEST_EVIDENCE_CARDINALITY");
    const evidence = parseEvidenceRecordV1(result.rows[0].record_json);
    if (evidence.source_record_id !== evidenceRef || evidence.source_record_hash !== evidenceHash) {
      throw new Error("CAP05_DECISION_REQUEST_EVIDENCE_IDENTITY_MISMATCH");
    }
    if (evidence.record_type !== CAP05_DECISION_REQUEST_RECORD_TYPE_V1) throw new Error("CAP05_DECISION_REQUEST_RECORD_TYPE_MISMATCH");
    if (evidence.origin_source_kind !== CAP05_DECISION_REQUEST_SOURCE_KIND_V1) throw new Error("CAP05_DECISION_REQUEST_SOURCE_CLASS_FORBIDDEN");
    if (evidence.quality?.status !== "PASS") throw new Error("CAP05_DECISION_REQUEST_QUALITY_PASS_REQUIRED");
    if (evidence.canonical_payload?.actor_class !== "HUMAN") throw new Error("CAP05_DECISION_REQUEST_HUMAN_ACTOR_REQUIRED");
    if (evidence.canonical_payload?.requested_disposition !== "SELECT_OPTION") throw new Error("CAP05_DECISION_REQUEST_SELECT_OPTION_REQUIRED");
    return evidence;
  }

  private async readCurrentAuthorityV1(scope: ContinuationScopeV1): Promise<CurrentDecisionAuthorityV1> {
    const values = scopeValuesV1(scope);
    const [active, state, scenario, successfulForecast] = await Promise.all([
      this.pool.query(
        `SELECT active_lineage_ref FROM twin_active_lineage_index_v1
         WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6`, values),
      this.pool.query(
        `SELECT lineage_id,revision_id FROM twin_state_latest_index_v1
         WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6`, values),
      this.pool.query(
        `SELECT scenario_set_id,source_forecast_ref,source_forecast_hash,determinism_hash FROM twin_scenario_latest_index_v1
         WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6`, values),
      this.pool.query(
        `SELECT forecast_object_id,determinism_hash FROM twin_forecast_success_latest_index_v1
         WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6`, values),
    ]);
    for (const [name, rows] of [["ACTIVE_LINEAGE", active.rows], ["STATE", state.rows], ["SCENARIO", scenario.rows], ["SUCCESSFUL_FORECAST", successfulForecast.rows]] as const) {
      if (rows.length !== 1) throw new Error(`CAP05_DECISION_CURRENT_${name}_CARDINALITY`);
    }
    if (scenario.rows[0].source_forecast_ref !== successfulForecast.rows[0].forecast_object_id
      || scenario.rows[0].source_forecast_hash !== successfulForecast.rows[0].determinism_hash) {
      throw new Error("CAP05_DECISION_SCENARIO_NOT_FROM_LATEST_SUCCESSFUL_FORECAST");
    }
    return {
      active_lineage_ref: requiredStringV1(active.rows[0].active_lineage_ref, "CAP05_DECISION_ACTIVE_LINEAGE_REQUIRED"),
      lineage_id: requiredStringV1(state.rows[0].lineage_id, "CAP05_DECISION_LINEAGE_ID_REQUIRED"),
      revision_id: requiredStringV1(state.rows[0].revision_id, "CAP05_DECISION_REVISION_ID_REQUIRED"),
      scenario_set_id: requiredStringV1(scenario.rows[0].scenario_set_id, "CAP05_DECISION_CURRENT_SCENARIO_REQUIRED"),
      scenario_set_hash: requiredStringV1(scenario.rows[0].determinism_hash, "CAP05_DECISION_CURRENT_SCENARIO_HASH_REQUIRED"),
      source_forecast_ref: requiredStringV1(scenario.rows[0].source_forecast_ref, "CAP05_DECISION_CURRENT_FORECAST_REQUIRED"),
      source_forecast_hash: requiredStringV1(scenario.rows[0].source_forecast_hash, "CAP05_DECISION_CURRENT_FORECAST_HASH_REQUIRED"),
    };
  }

  private async readExistingDecisionForScenarioV1(scenarioSetRef: string): Promise<Cap05DecisionEnvelopeV1 | null> {
    const projection = await this.pool.query(
      `SELECT decision_object_id FROM twin_decision_record_projection_v1
       WHERE scenario_set_ref=$1 LIMIT 2`,
      [scenarioSetRef],
    );
    if (projection.rows.length === 0) return null;
    if (projection.rows.length !== 1) throw new Error("CAP05_DECISION_EXISTING_SCENARIO_CARDINALITY");
    const object = await this.feedbackRepository.readCanonicalObject(projection.rows[0].decision_object_id);
    if (!object || object.object_type !== "twin_decision_record_v1") throw new Error("CAP05_DECISION_EXISTING_CANONICAL_MISSING");
    return object;
  }

  async commitHumanDecision(input: CommitCap05HumanDecisionInputV1): Promise<CommitCap05HumanDecisionResultV1> {
    const decidedAt = canonicalInstantV1(input.decided_at, "CAP05_DECISION_SERVICE_DECIDED_AT_INVALID");
    const evidenceRef = requiredStringV1(input.decision_request_evidence_ref, "CAP05_DECISION_SERVICE_EVIDENCE_REF_REQUIRED");
    const evidenceHash = requiredStringV1(input.decision_request_evidence_hash, "CAP05_DECISION_SERVICE_EVIDENCE_HASH_REQUIRED");
    const evidence = await this.readDecisionRequestEvidenceV1(evidenceRef, evidenceHash);
    assertExactScopeV1(input.scope, evidence);
    const availableAt = canonicalInstantV1(evidence.available_to_runtime_at, "CAP05_DECISION_REQUEST_AVAILABLE_AT_INVALID");
    if (availableAt > decidedAt) throw new Error("CAP05_DECISION_REQUEST_NOT_AVAILABLE_AT_DECISION_TIME");

    const current = await this.readCurrentAuthorityV1(input.scope);
    const requested = evidence.canonical_payload;
    if (requested.scenario_set_ref !== current.scenario_set_id || requested.scenario_set_hash !== current.scenario_set_hash) {
      throw new Error("CAP05_DECISION_REQUEST_NON_CURRENT_SCENARIO");
    }
    const scenarioRecord = await this.scenarioRepository.readScenarioSet(current.scenario_set_id);
    if (!scenarioRecord) throw new Error("CAP05_DECISION_CURRENT_SCENARIO_CANONICAL_MISSING");
    const scenarioSet = scenarioRecord.scenario_set;
    if (scenarioSet.determinism_hash !== current.scenario_set_hash) throw new Error("CAP05_DECISION_CURRENT_SCENARIO_HASH_MISMATCH");
    if (scenarioSet.lineage_id !== current.lineage_id || scenarioSet.revision_id !== current.revision_id) {
      throw new Error("CAP05_DECISION_CURRENT_SCENARIO_CONTEXT_MISMATCH");
    }
    if (scenarioSet.payload.source_forecast_ref !== current.source_forecast_ref
      || scenarioSet.payload.source_forecast_hash !== current.source_forecast_hash) {
      throw new Error("CAP05_DECISION_CURRENT_SCENARIO_FORECAST_MISMATCH");
    }

    const expectedOptionRef = buildCap05ScenarioOptionMemberRefV1(scenarioSet.object_id, requested.selected_option_id);
    const resolvedOption = resolveCap05ScenarioOptionMemberV1(scenarioSet, expectedOptionRef);
    if (requested.selected_option_ref !== expectedOptionRef || requested.selected_option_hash !== resolvedOption.option_hash) {
      throw new Error("CAP05_DECISION_REQUEST_OPTION_IDENTITY_MISMATCH");
    }

    const candidate = buildCap05DecisionV1({
      scope: input.scope,
      scenario_set: scenarioSet,
      selected_option_id: requested.selected_option_id,
      decision_request_evidence_ref: evidence.source_record_id,
      decision_request_evidence_hash: evidence.source_record_hash,
      actor_ref: requiredStringV1(requested.actor_ref, "CAP05_DECISION_REQUEST_ACTOR_REF_REQUIRED"),
      decided_at: decidedAt,
      context_lineage_ref: current.active_lineage_ref,
      context_revision_ref: current.revision_id,
      created_at: decidedAt,
    });

    const existing = await this.readExistingDecisionForScenarioV1(scenarioSet.object_id);
    adjudicateCap05DecisionSecondWriteV1(existing, candidate);
    const persisted = await this.feedbackRepository.commitCanonicalObject({ object: candidate });
    if (persisted.object.object_type !== "twin_decision_record_v1") throw new Error("CAP05_DECISION_SERVICE_PERSISTED_TYPE_MISMATCH");
    return {
      ...persisted,
      service_id: CAP05_HUMAN_DECISION_SERVICE_ID_V1,
      scenario_set_ref: scenarioSet.object_id,
      selected_option_ref: candidate.payload.selected_option_ref,
      selected_option_hash: candidate.payload.selected_option_hash,
      actor_ref: candidate.payload.actor_ref,
    };
  }
}
