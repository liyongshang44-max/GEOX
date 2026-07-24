// Purpose: rebuild the MCFT-CAP-08.S3 semantic completion tuple exclusively from PostgreSQL canonical facts and exact projections.
// Boundary: read-only bounded reconstruction only; no fact append, authority write, Tick execution, State/Forecast/Scenario mutation, route, scheduler, wall clock, filesystem, environment, or production authority.

import {
  validateCanonicalObjectV1,
  type CanonicalObjectEnvelopeV1,
} from "../../domain/twin_runtime/canonical_object_contracts_v1.js";
import {
  buildCap08S3CompletionTupleV1,
  type Cap08S3CompletionTupleV1,
  type Cap08S3PersistedTickBindingV1,
} from "../../domain/twin_runtime/cap08_s3_completion_tuple_v1.js";
import {
  CAP08_S1_TICK_COUNT_V1,
  cap08TickLogicalTimeV1,
} from "../../domain/twin_runtime/cap08_phase_engine_contracts_v1.js";
import {
  CAP08_S3_OUTCOME_FVO_ID_V1,
  buildCap08S3ProviderTickTraceV1,
  type Cap08S3ProviderTickTraceV1,
} from "../../domain/twin_runtime/cap08_s3_formal_provider_contracts_v1.js";
import {
  Cap08S3EpisodeInspectorV1,
  type Cap08S3EpisodeInspectionV1,
  type Cap08S3ReadQueryPortV1,
} from "./cap08_s3_episode_inspector_v1.js";
import { Cap08S3OutcomeCompletionEvidenceServiceV1 } from "./cap08_s3_outcome_completion_evidence_service_v1.js";
import type { TwinScopeKeyV1 } from "./ports.js";

type PersistedTickGraphV1 = {
  tick: CanonicalObjectEnvelopeV1;
  evidence: CanonicalObjectEnvelopeV1;
  assimilation: CanonicalObjectEnvelopeV1;
};

function requiredStringV1(value: unknown, code: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(code);
  return value;
}

function requiredArrayV1(value: unknown, code: string): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new Error(code);
  }
  return [...value] as string[];
}

function exactScopeValuesV1(scope: TwinScopeKeyV1): string[] {
  return [scope.tenant_id, scope.project_id, scope.group_id, scope.field_id, scope.season_id, scope.zone_id];
}

function exactScopeV1(expected: TwinScopeKeyV1, actual: TwinScopeKeyV1, code: string): void {
  for (const field of ["tenant_id", "project_id", "group_id", "field_id", "season_id", "zone_id"] as const) {
    if (expected[field] !== actual[field]) throw new Error(`${code}:${field}`);
  }
}

function exactEpisodeV1(episode: Cap08S3EpisodeInspectionV1): asserts episode is Cap08S3EpisodeInspectionV1 & {
  disposition: "EXACT_COMPLETE";
  decision: NonNullable<Cap08S3EpisodeInspectionV1["decision"]>;
  approval_assertion: NonNullable<Cap08S3EpisodeInspectionV1["approval_assertion"]>;
  approved_plan: NonNullable<Cap08S3EpisodeInspectionV1["approved_plan"]>;
  execution_receipt: NonNullable<Cap08S3EpisodeInspectionV1["execution_receipt"]>;
  action_feedback: NonNullable<Cap08S3EpisodeInspectionV1["action_feedback"]>;
} {
  if (episode.disposition !== "EXACT_COMPLETE"
    || !episode.decision
    || !episode.approval_assertion
    || !episode.approved_plan
    || !episode.execution_receipt
    || !episode.action_feedback) {
    throw new Error("CAP08_S3_COMPLETION_EPISODE_NOT_EXACT");
  }
}

function traceForTickV1(input: {
  formal_run_id: string;
  scope: TwinScopeKeyV1;
  index: number;
  episode: Cap08S3EpisodeInspectionV1 & {
    disposition: "EXACT_COMPLETE";
    decision: NonNullable<Cap08S3EpisodeInspectionV1["decision"]>;
    approval_assertion: NonNullable<Cap08S3EpisodeInspectionV1["approval_assertion"]>;
    approved_plan: NonNullable<Cap08S3EpisodeInspectionV1["approved_plan"]>;
    execution_receipt: NonNullable<Cap08S3EpisodeInspectionV1["execution_receipt"]>;
    action_feedback: NonNullable<Cap08S3EpisodeInspectionV1["action_feedback"]>;
  };
  t08_consumed: boolean;
}): Cap08S3ProviderTickTraceV1 {
  const index = input.index;
  return buildCap08S3ProviderTickTraceV1({
    formal_run_id: input.formal_run_id,
    scope: structuredClone(input.scope),
    tick_id: `T${String(index).padStart(2, "0")}`,
    logical_time: cap08TickLogicalTimeV1(index),
    decision_ref: index === 5 ? input.episode.decision.object_id : null,
    decision_hash: index === 5 ? input.episode.decision.determinism_hash : null,
    approval_assertion_ref: index === 6 ? input.episode.approval_assertion.source_record_id : null,
    approval_assertion_hash: index === 6 ? input.episode.approval_assertion.source_record_hash : null,
    approved_plan_ref: index === 6 ? input.episode.approved_plan.source_record_id : null,
    approved_plan_hash: index === 6 ? input.episode.approved_plan.source_record_hash : null,
    receipt_ref: index === 8 ? input.episode.execution_receipt.source_record_id : null,
    receipt_hash: index === 8 ? input.episode.execution_receipt.source_record_hash : null,
    action_feedback_ref: index >= 8 && index <= 10 ? input.episode.action_feedback.object_id : null,
    action_feedback_hash: index >= 8 && index <= 10 ? input.episode.action_feedback.determinism_hash : null,
    action_feedback_consumed_by_a: index === 8 && input.t08_consumed,
    outcome_fvo10_ref: index === 10 ? CAP08_S3_OUTCOME_FVO_ID_V1 : null,
    outcome_fvo10_value: index === 10 ? "0.3045" : null,
    recommendation_count: 0,
    ao_act_count: 0,
    dispatch_count: 0,
    residual_count: 0,
    model_activation_count: 0,
  });
}

export class Cap08S3CompletionTupleServiceV1 {
  private readonly episodeInspector: Cap08S3EpisodeInspectorV1;
  private readonly outcomeEvidence: Cap08S3OutcomeCompletionEvidenceServiceV1;

  constructor(private readonly database: Cap08S3ReadQueryPortV1) {
    this.episodeInspector = new Cap08S3EpisodeInspectorV1(database);
    this.outcomeEvidence = new Cap08S3OutcomeCompletionEvidenceServiceV1(database);
  }

  private async readCanonicalV1(ref: string, expectedType: string): Promise<CanonicalObjectEnvelopeV1> {
    const rows = await this.database.query(
      `SELECT record_json->'payload' AS payload
         FROM facts
        WHERE record_json->'payload'->>'object_id'=$1
        LIMIT 2`,
      [ref],
    );
    if (rows.rows.length !== 1) {
      throw new Error(`CAP08_S3_COMPLETION_CANONICAL_CARDINALITY:${expectedType}:${ref}`);
    }
    const object = structuredClone(rows.rows[0].payload as CanonicalObjectEnvelopeV1);
    validateCanonicalObjectV1(object);
    if (object.object_type !== expectedType) {
      throw new Error(`CAP08_S3_COMPLETION_CANONICAL_TYPE_MISMATCH:${expectedType}`);
    }
    return object;
  }

  private async loadTickGraphV1(input: { scope: TwinScopeKeyV1 }): Promise<PersistedTickGraphV1[]> {
    const rows = await this.database.query(
      `SELECT record_json->'payload' AS payload
         FROM facts
        WHERE record_json->>'type'='twin_runtime_tick_v1'
          AND record_json->'payload'->>'tenant_id'=$1
          AND record_json->'payload'->>'project_id'=$2
          AND record_json->'payload'->>'group_id'=$3
          AND record_json->'payload'->>'field_id'=$4
          AND record_json->'payload'->>'season_id'=$5
          AND record_json->'payload'->>'zone_id'=$6
          AND record_json->'payload'->>'logical_time'>=$7
          AND record_json->'payload'->>'logical_time'<=$8
        ORDER BY record_json->'payload'->>'logical_time', fact_id`,
      [
        ...exactScopeValuesV1(input.scope),
        cap08TickLogicalTimeV1(0),
        cap08TickLogicalTimeV1(CAP08_S1_TICK_COUNT_V1 - 1),
      ],
    );
    if (rows.rows.length !== CAP08_S1_TICK_COUNT_V1) {
      throw new Error(`CAP08_S3_COMPLETION_TICK_CARDINALITY:${rows.rows.length}`);
    }
    const output: PersistedTickGraphV1[] = [];
    for (let index = 0; index < rows.rows.length; index += 1) {
      const tick = structuredClone(rows.rows[index].payload as CanonicalObjectEnvelopeV1);
      validateCanonicalObjectV1(tick);
      exactScopeV1(input.scope, tick, "CAP08_S3_COMPLETION_TICK_SCOPE_MISMATCH");
      if (tick.object_type !== "twin_runtime_tick_v1"
        || tick.logical_time !== cap08TickLogicalTimeV1(index)) {
        throw new Error(`CAP08_S3_COMPLETION_TICK_IDENTITY_MISMATCH:T${String(index).padStart(2, "0")}`);
      }
      const evidenceRef = requiredStringV1(
        tick.payload.evidence_window_ref,
        "CAP08_S3_COMPLETION_EVIDENCE_REF_REQUIRED",
      );
      const assimilationRef = requiredStringV1(
        tick.payload.assimilation_update_ref,
        "CAP08_S3_COMPLETION_ASSIMILATION_REF_REQUIRED",
      );
      const [evidence, assimilation] = await Promise.all([
        this.readCanonicalV1(evidenceRef, "twin_evidence_window_v1"),
        this.readCanonicalV1(assimilationRef, "twin_assimilation_update_v1"),
      ]);
      if (evidence.logical_time !== tick.logical_time || assimilation.logical_time !== tick.logical_time) {
        throw new Error(`CAP08_S3_COMPLETION_TICK_CHILD_TIME_MISMATCH:${tick.logical_time}`);
      }
      output.push({ tick, evidence, assimilation });
    }
    return output;
  }

  async rebuild(input: {
    formal_run_id: string;
    scope: TwinScopeKeyV1;
    phase_engine_source_digest: string;
  }): Promise<Cap08S3CompletionTupleV1> {
    const formalRunId = requiredStringV1(
      input.formal_run_id,
      "CAP08_S3_COMPLETION_FORMAL_RUN_REQUIRED",
    );
    if (!/^sha256:[0-9a-f]{64}$/.test(input.phase_engine_source_digest)) {
      throw new Error("CAP08_S3_COMPLETION_SOURCE_DIGEST_INVALID");
    }
    const [episode, tickGraph, witness, outcome] = await Promise.all([
      this.episodeInspector.inspect({ formal_run_id: formalRunId, scope: input.scope }),
      this.loadTickGraphV1({ scope: input.scope }),
      this.outcomeEvidence.readOutcomeAbsenceWitness({ formal_run_id: formalRunId, scope: input.scope }),
      this.outcomeEvidence.readOutcomeFvo10({ formal_run_id: formalRunId, scope: input.scope }),
    ]);
    exactEpisodeV1(episode);
    if (!witness) throw new Error("CAP08_S3_COMPLETION_ABSENCE_WITNESS_REQUIRED");
    if (!outcome) throw new Error("CAP08_S3_COMPLETION_OUTCOME_FVO10_REQUIRED");
    if (outcome.available_to_runtime_at <= cap08TickLogicalTimeV1(9)) {
      throw new Error("CAP08_S3_COMPLETION_OUTCOME_VISIBLE_AT_T09");
    }

    const t08 = tickGraph[8];
    const t09 = tickGraph[9];
    const t10 = tickGraph[10];
    const t08Consumed = requiredArrayV1(
      t08.evidence.payload.dynamics_consumed_evidence_refs,
      "CAP08_S3_COMPLETION_T08_DYNAMICS_REFS_REQUIRED",
    );
    if (!t08Consumed.includes(episode.action_feedback.object_id)) {
      throw new Error("CAP08_S3_COMPLETION_T08_H_NOT_CONSUMED");
    }
    const t09Selection = t09.evidence.payload.observation_selection as Record<string, unknown> | undefined;
    const t09Applied = requiredArrayV1(
      t09.evidence.payload.assimilation_applied_evidence_refs,
      "CAP08_S3_COMPLETION_T09_APPLIED_REFS_REQUIRED",
    );
    if (!t09Selection
      || t09Selection.selected_observation_ref !== null
      || t09Applied.length !== 0
      || t09.assimilation.payload.selected_observation_ref !== null
      || requiredArrayV1(
        t09.assimilation.payload.applied_observation_refs,
        "CAP08_S3_COMPLETION_T09_ASSIMILATION_APPLIED_REQUIRED",
      ).length !== 0) {
      throw new Error("CAP08_S3_COMPLETION_T09_ABSENCE_NOT_REBUILT");
    }
    const t10Selection = t10.evidence.payload.observation_selection as Record<string, unknown> | undefined;
    const t10Applied = requiredArrayV1(
      t10.evidence.payload.assimilation_applied_evidence_refs,
      "CAP08_S3_COMPLETION_T10_APPLIED_REFS_REQUIRED",
    );
    if (!t10Selection
      || t10Selection.selected_observation_ref !== CAP08_S3_OUTCOME_FVO_ID_V1
      || JSON.stringify(t10Applied) !== JSON.stringify([CAP08_S3_OUTCOME_FVO_ID_V1])
      || t10.assimilation.payload.selected_observation_ref !== CAP08_S3_OUTCOME_FVO_ID_V1
      || JSON.stringify(requiredArrayV1(
        t10.assimilation.payload.applied_observation_refs,
        "CAP08_S3_COMPLETION_T10_ASSIMILATION_APPLIED_REQUIRED",
      )) !== JSON.stringify([CAP08_S3_OUTCOME_FVO_ID_V1])) {
      throw new Error("CAP08_S3_COMPLETION_T10_ASSIMILATION_NOT_REBUILT");
    }

    const traces = tickGraph.map((_, index) => traceForTickV1({
      formal_run_id: formalRunId,
      scope: input.scope,
      index,
      episode,
      t08_consumed: t08Consumed.includes(episode.action_feedback.object_id),
    }));
    const bindings: Cap08S3PersistedTickBindingV1[] = tickGraph.map((graph, index) => ({
      tick_id: `T${String(index).padStart(2, "0")}`,
      logical_time: graph.tick.logical_time,
      tick_ref: graph.tick.object_id,
      tick_hash: graph.tick.determinism_hash,
      evidence_window_ref: graph.evidence.object_id,
      evidence_window_hash: graph.evidence.determinism_hash,
      assimilation_update_ref: graph.assimilation.object_id,
      assimilation_update_hash: graph.assimilation.determinism_hash,
      provider_trace_digest: traces[index].trace_digest,
    }));

    return buildCap08S3CompletionTupleV1({
      formal_run_id: formalRunId,
      scope: input.scope,
      phase_engine_source_digest: input.phase_engine_source_digest,
      decision: {
        ref: episode.decision.object_id,
        hash: episode.decision.determinism_hash,
        logical_time: episode.decision.logical_time,
      },
      approval_assertion: {
        ref: episode.approval_assertion.source_record_id,
        hash: episode.approval_assertion.source_record_hash,
        logical_time: episode.approval_assertion.role_time.approved_at,
        available_to_runtime_at: episode.approval_assertion.available_to_runtime_at,
      },
      approved_plan: {
        ref: episode.approved_plan.source_record_id,
        hash: episode.approved_plan.source_record_hash,
        logical_time: episode.approved_plan.role_time.approved_at,
        available_to_runtime_at: episode.approved_plan.available_to_runtime_at,
        effective_from: episode.approved_plan.role_time.plan_effective_from,
      },
      execution_receipt: {
        ref: episode.execution_receipt.source_record_id,
        hash: episode.execution_receipt.source_record_hash,
        logical_time: episode.execution_receipt.role_time.execution_end,
        available_to_runtime_at: episode.execution_receipt.available_to_runtime_at,
      },
      action_feedback: {
        ref: episode.action_feedback.object_id,
        hash: episode.action_feedback.determinism_hash,
        logical_time: episode.action_feedback.logical_time,
        available_to_runtime_at: episode.action_feedback.payload.available_to_runtime_at,
      },
      t08: {
        tick_ref: t08.tick.object_id,
        tick_hash: t08.tick.determinism_hash,
        evidence_window_ref: t08.evidence.object_id,
        evidence_window_hash: t08.evidence.determinism_hash,
        action_feedback_ref: episode.action_feedback.object_id,
        action_feedback_hash: episode.action_feedback.determinism_hash,
        dynamics_consumed_evidence_refs: t08Consumed,
      },
      t09: {
        tick_ref: t09.tick.object_id,
        tick_hash: t09.tick.determinism_hash,
        evidence_window_ref: t09.evidence.object_id,
        evidence_window_hash: t09.evidence.determinism_hash,
        assimilation_update_ref: t09.assimilation.object_id,
        assimilation_update_hash: t09.assimilation.determinism_hash,
        absence_witness_ref: witness.source_record_id,
        absence_witness_hash: witness.source_record_hash,
        selected_observation_ref: null,
        assimilation_applied_evidence_refs: [],
      },
      t10: {
        tick_ref: t10.tick.object_id,
        tick_hash: t10.tick.determinism_hash,
        evidence_window_ref: t10.evidence.object_id,
        evidence_window_hash: t10.evidence.determinism_hash,
        assimilation_update_ref: t10.assimilation.object_id,
        assimilation_update_hash: t10.assimilation.determinism_hash,
        outcome_fvo10_ref: CAP08_S3_OUTCOME_FVO_ID_V1,
        outcome_fvo10_hash: outcome.source_record_hash,
        selected_observation_ref: CAP08_S3_OUTCOME_FVO_ID_V1,
        assimilation_applied_evidence_refs: [CAP08_S3_OUTCOME_FVO_ID_V1],
      },
      tick_bindings: bindings,
      tick_traces: traces,
    });
  }
}
