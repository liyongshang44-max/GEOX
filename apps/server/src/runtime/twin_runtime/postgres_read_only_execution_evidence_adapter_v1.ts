// MCFT-CAP-09.S5 read-only ExecutionFeedbackPort adapter.
// Boundary: canonical H readback and deterministic trust classification only.
// No H creation, fact append, projection mutation, approval, dispatch, State mutation,
// scheduler, route, background loop, model activation, or controlled action.

import type { Pool } from "pg";

import {
  validateCap05ActionFeedbackV1,
  type Cap05ActionFeedbackEnvelopeV1,
} from "../../domain/twin_runtime/feedback_canonical_contracts_v1.js";
import { PostgresActionFeedbackTickSourceV1 } from "../../persistence/twin_runtime/postgres_action_feedback_tick_source_v1.js";
import {
  CAP08_S3_ACTION_FEEDBACK_LATE_POLICY_ID_V1,
  selectCap05ActionFeedbackForTickV1,
} from "./action_feedback_tick_selector_v1.js";
import type {
  ExecutionFeedbackPortV1,
  ExistingExecutionEvidenceV1,
  ShadowOnlineBoundaryV1,
  TwinScopeKeyV1,
} from "./ports.js";

type ActionFeedbackSourceV1 = Pick<
  PostgresActionFeedbackTickSourceV1,
  "loadActionFeedbackCandidates"
>;

const SCOPE_FIELDS = [
  "tenant_id", "project_id", "group_id", "field_id", "season_id", "zone_id",
] as const;

function assertScopeV1(left: TwinScopeKeyV1, right: TwinScopeKeyV1, code: string): void {
  if (!SCOPE_FIELDS.every((field) => left[field] === right[field])) {
    throw new Error(code);
  }
}

function canonicalInstantV1(value: string, code: string): string {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== value) {
    throw new Error(code);
  }
  return value;
}

function trustworthyCanonicalFeedbackV1(input: {
  feedback: Cap05ActionFeedbackEnvelopeV1;
  boundary: ShadowOnlineBoundaryV1;
}): boolean {
  const payload = input.feedback.payload;
  const executionEnd = canonicalInstantV1(
    payload.execution_end,
    "S5_EXECUTION_FEEDBACK_EXECUTION_END_INVALID",
  );
  const availableAt = canonicalInstantV1(
    payload.available_to_runtime_at,
    "S5_EXECUTION_FEEDBACK_AVAILABLE_AT_INVALID",
  );
  const ingestedAt = canonicalInstantV1(
    payload.ingested_at,
    "S5_EXECUTION_FEEDBACK_INGESTED_AT_INVALID",
  );
  const cutoff = canonicalInstantV1(
    input.boundary.logical_time,
    "S5_EXECUTION_FEEDBACK_BOUNDARY_INVALID",
  );
  return payload.eligible_for_state_input === true
    && (payload.execution_status === "EXECUTED"
      || payload.execution_status === "PARTIALLY_EXECUTED")
    && (payload.validation_status === "VALIDATED"
      || payload.validation_status === "VALIDATED_WITH_LIMITATIONS")
    && (payload.source_quality === "PASS" || payload.source_quality === "LIMITED")
    && Date.parse(executionEnd) <= Date.parse(cutoff)
    && Date.parse(availableAt) <= Date.parse(cutoff)
    && Date.parse(ingestedAt) <= Date.parse(cutoff);
}

export class PostgresReadOnlyExecutionEvidenceAdapterV1
implements ExecutionFeedbackPortV1 {
  private readonly source: ActionFeedbackSourceV1;

  constructor(
    pool: Pool,
    source?: ActionFeedbackSourceV1,
  ) {
    this.source = source ?? new PostgresActionFeedbackTickSourceV1(pool);
  }

  async readExistingExecutionEvidence(input: {
    scope: TwinScopeKeyV1;
    boundary: ShadowOnlineBoundaryV1;
  }): Promise<readonly ExistingExecutionEvidenceV1[]> {
    assertScopeV1(
      input.scope,
      input.boundary.scope,
      "S5_EXECUTION_FEEDBACK_BOUNDARY_SCOPE_MISMATCH",
    );
    canonicalInstantV1(
      input.boundary.logical_time,
      "S5_EXECUTION_FEEDBACK_BOUNDARY_TIME_INVALID",
    );
    const feedbackObjects = await this.source.loadActionFeedbackCandidates({
      scope: input.scope,
      logical_time: input.boundary.logical_time,
    });
    const seen = new Set<string>();
    const results = feedbackObjects.map((feedback) => {
      validateCap05ActionFeedbackV1(feedback);
      assertScopeV1(
        feedback,
        input.scope,
        "S5_EXECUTION_FEEDBACK_OBJECT_SCOPE_MISMATCH",
      );
      if (seen.has(feedback.object_id)) {
        throw new Error("S5_EXECUTION_FEEDBACK_DUPLICATE_OBJECT");
      }
      seen.add(feedback.object_id);

      // Reuse the canonical H selector for each immutable H object so cutoff,
      // timing and eligibility semantics remain aligned without collapsing
      // distinct historical execution events into a new selection authority.
      const selection = selectCap05ActionFeedbackForTickV1({
        scope: input.scope,
        logical_time: input.boundary.logical_time,
        feedback_objects: [feedback],
        late_policy_id: CAP08_S3_ACTION_FEEDBACK_LATE_POLICY_ID_V1,
      });
      const entry = selection.trace.entries[0];
      if (!entry || entry.action_feedback_ref !== feedback.object_id) {
        throw new Error("S5_EXECUTION_FEEDBACK_SELECTOR_TRACE_MISMATCH");
      }
      const selectorRejected = entry.disposition === "EXCLUDED_SCOPE"
        || entry.disposition === "EXCLUDED_FUTURE"
        || entry.disposition === "EXCLUDED_LATE"
        || entry.disposition === "EXCLUDED_INELIGIBLE";
      return {
        evidence_ref: feedback.object_id,
        evidence_hash: feedback.determinism_hash,
        executed_at: feedback.payload.execution_end,
        trustworthy: !selectorRejected
          && trustworthyCanonicalFeedbackV1({
            feedback,
            boundary: input.boundary,
          }),
        source_kind: `CANONICAL_TWIN_ACTION_FEEDBACK:${feedback.payload.origin_kind}`,
      } satisfies ExistingExecutionEvidenceV1;
    });
    return results.sort((left, right) =>
      left.executed_at.localeCompare(right.executed_at)
        || left.evidence_ref.localeCompare(right.evidence_ref));
  }
}
