// apps/server/src/runtime/twin_runtime/restart_late_receipt_rebuild_service_v1.ts
// Purpose: recover unknown G/H/C commit outcomes, classify late execution receipts without logical-time shifting, collapse identical same-hour duplicates, and rebuild CAP-05 support state from canonical facts with divergence checks.
// Boundary: internal controlled Replay Runtime service only; no public route, scheduler, automatic history rewrite, State mutation, Forecast math, Recommendation, AO-ACT, calibration, model activation or CAP-06 authority.

import type { Pool } from "pg";
import type { ContinuationScopeV1 } from "../../domain/twin_runtime/continuation_operation_identity_v1.js";
import {
  CAP05_ACTION_FEEDBACK_OBJECT_TYPE_V1,
} from "../../domain/twin_runtime/feedback_canonical_contracts_v1.js";
import {
  CAP05_DECISION_OBJECT_TYPE_V1,
} from "../../domain/twin_runtime/feedback_canonical_contracts_v1.js";
import {
  CAP05_FORECAST_RESIDUAL_OBJECT_TYPE_V1,
} from "../../domain/twin_runtime/forecast_observation_residual_v1.js";
import {
  buildCap05ActionFeedbackProjectionRowsV1,
} from "../../projections/twin_runtime/feedback_persistence_projection_v1.js";
import {
  PostgresFeedbackPersistenceRepositoryV1,
  type Cap05PersistedObjectV1,
  type Cap05PersistenceResultV1,
  type Cap05RecoverySummaryV1,
} from "../../persistence/twin_runtime/postgres_feedback_persistence_repository_v1.js";

export const CAP05_S9_RECOVERY_SERVICE_ID_V1 = "MCFT_CAP_05_RESTART_LATE_RECEIPT_REBUILD_SERVICE_V1" as const;
export const CAP05_S9_LATE_RECEIPT_POLICY_ID_V1 = "NO_SHIFT_REVISION_REQUIRED_LATE_RECEIPT_V1" as const;
export const CAP05_S9_MULTIPLE_EVENT_POLICY_ID_V1 = "IDENTICAL_DUPLICATE_COLLAPSE_DISTINCT_EVENT_REJECT_V1" as const;
export const CAP05_S9_REBUILD_POLICY_ID_V1 = "CANONICAL_FACTS_FAIL_CLOSED_SUPPORT_REBUILD_V1" as const;

export type Cap05ReceiptRecoveryCandidateV1 = {
  scope: ContinuationScopeV1;
  receipt_ref: string;
  receipt_hash: string;
  event_id: string;
  execution_start: string;
  execution_end: string;
  available_to_runtime_at: string;
};

export type Cap05ReceiptSelectionResultV1 = {
  selected: Cap05ReceiptRecoveryCandidateV1;
  identical_duplicate_count: number;
  policy_id: typeof CAP05_S9_MULTIPLE_EVENT_POLICY_ID_V1;
};

export type Cap05LateReceiptReasonCodeV1 =
  | "REVISION_REQUIRED_LATE_AFTER_CUTOFF"
  | "REVISION_REQUIRED_LATE_AFTER_COMMIT";

export type Cap05ReceiptCutoffResultV1 = {
  receipt_ref: string;
  target_logical_time: string;
  eligible_for_state_input: boolean;
  reason_code: Cap05LateReceiptReasonCodeV1 | null;
  logical_time_shifted: false;
  shifted_to_logical_time: null;
  automatic_history_rewrite: false;
  policy_id: typeof CAP05_S9_LATE_RECEIPT_POLICY_ID_V1;
};

export type Cap05SupportRebuildResultV1 = {
  service_id: typeof CAP05_S9_RECOVERY_SERVICE_ID_V1;
  policy_id: typeof CAP05_S9_REBUILD_POLICY_ID_V1;
  canonical_fact_count_before: number;
  canonical_fact_count_after: number;
  canonical_fact_delta: 0;
  summary: Cap05RecoverySummaryV1;
};

type CanonicalFactRowV1 = {
  fact_id: string;
  record_json: {
    type?: unknown;
    payload?: unknown;
  };
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

function scopeKeyV1(scope: ContinuationScopeV1): string {
  return [
    scope.tenant_id,
    scope.project_id,
    scope.group_id,
    scope.field_id,
    scope.season_id,
    scope.zone_id,
  ].map((value) => requiredStringV1(value, "CAP05_S9_RECEIPT_SCOPE_REQUIRED")).join("\u001f");
}

function candidateSemanticKeyV1(candidate: Cap05ReceiptRecoveryCandidateV1): string {
  return JSON.stringify({
    scope: scopeKeyV1(candidate.scope),
    receipt_ref: candidate.receipt_ref,
    receipt_hash: candidate.receipt_hash,
    event_id: candidate.event_id,
    execution_start: candidate.execution_start,
    execution_end: candidate.execution_end,
    available_to_runtime_at: candidate.available_to_runtime_at,
  });
}

function validateReceiptCandidateV1(
  candidate: Cap05ReceiptRecoveryCandidateV1,
  targetLogicalTime: string,
): Cap05ReceiptRecoveryCandidateV1 {
  const target = canonicalInstantV1(targetLogicalTime, "CAP05_S9_TARGET_LOGICAL_TIME_INVALID");
  const executionStart = canonicalInstantV1(candidate.execution_start, "CAP05_S9_EXECUTION_START_INVALID");
  const executionEnd = canonicalInstantV1(candidate.execution_end, "CAP05_S9_EXECUTION_END_INVALID");
  const availableAt = canonicalInstantV1(candidate.available_to_runtime_at, "CAP05_S9_AVAILABLE_AT_INVALID");
  requiredStringV1(candidate.receipt_ref, "CAP05_S9_RECEIPT_REF_REQUIRED");
  requiredStringV1(candidate.receipt_hash, "CAP05_S9_RECEIPT_HASH_REQUIRED");
  requiredStringV1(candidate.event_id, "CAP05_S9_EVENT_ID_REQUIRED");
  scopeKeyV1(candidate.scope);
  if (executionStart > executionEnd) throw new Error("CAP05_S9_EXECUTION_TIME_ORDER_INVALID");
  if (executionStart.slice(0, 13) !== executionEnd.slice(0, 13)) {
    throw new Error("CAP05_S9_CROSS_HOUR_EXECUTION_REQUIRES_INTERVAL_SPLIT");
  }
  const intervalStart = new Date(Date.parse(target) - 60 * 60 * 1000).toISOString();
  if (executionStart < intervalStart || executionEnd > target) {
    throw new Error("CAP05_S9_RECEIPT_TARGET_INTERVAL_MISMATCH");
  }
  return {
    ...candidate,
    execution_start: executionStart,
    execution_end: executionEnd,
    available_to_runtime_at: availableAt,
  };
}

export function selectCap05SingleReceiptForTargetTickV1(input: {
  target_logical_time: string;
  candidates: readonly Cap05ReceiptRecoveryCandidateV1[];
}): Cap05ReceiptSelectionResultV1 {
  if (input.candidates.length === 0) throw new Error("CAP05_S9_RECEIPT_CANDIDATE_REQUIRED");
  const validated = input.candidates.map((candidate) => validateReceiptCandidateV1(candidate, input.target_logical_time));
  const expectedScope = scopeKeyV1(validated[0].scope);
  for (const candidate of validated) {
    if (scopeKeyV1(candidate.scope) !== expectedScope) throw new Error("CAP05_S9_RECEIPT_SCOPE_MISMATCH");
  }
  const byEvent = new Map<string, Cap05ReceiptRecoveryCandidateV1>();
  let duplicateCount = 0;
  for (const candidate of validated) {
    const existing = byEvent.get(candidate.event_id);
    if (!existing) {
      byEvent.set(candidate.event_id, candidate);
      continue;
    }
    if (candidateSemanticKeyV1(existing) !== candidateSemanticKeyV1(candidate)) {
      throw new Error("CAP05_S9_CONFLICTING_DUPLICATE_EXECUTION_EVENT");
    }
    duplicateCount += 1;
  }
  if (byEvent.size !== 1) throw new Error("CAP05_S9_MULTIPLE_DISTINCT_EXECUTION_EVENTS");
  return {
    selected: structuredClone([...byEvent.values()][0]),
    identical_duplicate_count: duplicateCount,
    policy_id: CAP05_S9_MULTIPLE_EVENT_POLICY_ID_V1,
  };
}

export function classifyCap05ReceiptCutoffV1(input: {
  candidate: Cap05ReceiptRecoveryCandidateV1;
  target_logical_time: string;
  evidence_window_frozen: boolean;
  frozen_action_feedback_refs: readonly string[];
  action_feedback_ref: string;
  terminal_tick_committed: boolean;
}): Cap05ReceiptCutoffResultV1 {
  const candidate = validateReceiptCandidateV1(input.candidate, input.target_logical_time);
  const target = canonicalInstantV1(input.target_logical_time, "CAP05_S9_TARGET_LOGICAL_TIME_INVALID");
  const actionFeedbackRef = requiredStringV1(input.action_feedback_ref, "CAP05_S9_ACTION_FEEDBACK_REF_REQUIRED");
  const included = input.frozen_action_feedback_refs.includes(actionFeedbackRef);
  let reasonCode: Cap05LateReceiptReasonCodeV1 | null = null;
  if (input.terminal_tick_committed) {
    reasonCode = "REVISION_REQUIRED_LATE_AFTER_COMMIT";
  } else if (candidate.available_to_runtime_at > target || (input.evidence_window_frozen && !included)) {
    reasonCode = "REVISION_REQUIRED_LATE_AFTER_CUTOFF";
  }
  return {
    receipt_ref: candidate.receipt_ref,
    target_logical_time: target,
    eligible_for_state_input: reasonCode === null,
    reason_code: reasonCode,
    logical_time_shifted: false,
    shifted_to_logical_time: null,
    automatic_history_rewrite: false,
    policy_id: CAP05_S9_LATE_RECEIPT_POLICY_ID_V1,
  };
}

export class Cap05RestartLateReceiptRebuildServiceV1 {
  private readonly repository: PostgresFeedbackPersistenceRepositoryV1;

  constructor(private readonly pool: Pool) {
    this.repository = new PostgresFeedbackPersistenceRepositoryV1(pool);
  }

  async recoverUnknownCanonicalCommitOutcome(
    object: Cap05PersistedObjectV1,
  ): Promise<Cap05PersistenceResultV1> {
    const existing = await this.repository.lookupByIdempotencyKey(object.idempotency_key);
    if (existing) {
      if (existing.object_id !== object.object_id
        || existing.object_type !== object.object_type
        || existing.determinism_hash !== object.determinism_hash) {
        throw new Error("CAP05_S9_UNKNOWN_OUTCOME_IDEMPOTENCY_CONFLICT");
      }
      return {
        status: "EXISTING_IDEMPOTENT_SUCCESS",
        object: existing,
        fact_id: `fact_${existing.object_id}`,
      };
    }
    return this.repository.commitCanonicalObject({ object });
  }

  private async loadCanonicalFactsV1(): Promise<CanonicalFactRowV1[]> {
    const result = await this.pool.query(
      `SELECT fact_id,record_json FROM facts
       WHERE record_json->>'type' IN ('twin_decision_record_v1','twin_action_feedback_v1','twin_forecast_residual_v1')
       ORDER BY fact_id`,
    );
    return result.rows as CanonicalFactRowV1[];
  }

  private async assertProjectionIdentityV1(input: {
    table: string;
    id_column: string;
    object_id: string;
    determinism_hash: string;
    source_fact_id: string;
    error_code: string;
  }): Promise<void> {
    const allowed = new Set([
      "twin_decision_record_projection_v1:decision_object_id",
      "twin_action_feedback_projection_v1:action_feedback_object_id",
      "twin_forecast_residual_projection_v1:residual_object_id",
    ]);
    if (!allowed.has(`${input.table}:${input.id_column}`)) throw new Error("CAP05_S9_PROJECTION_TABLE_FORBIDDEN");
    const result = await this.pool.query(
      `SELECT determinism_hash,source_fact_id FROM ${input.table} WHERE ${input.id_column}=$1 LIMIT 2`,
      [input.object_id],
    );
    if (result.rows.length === 0) return;
    if (result.rows.length !== 1
      || result.rows[0].determinism_hash !== input.determinism_hash
      || result.rows[0].source_fact_id !== input.source_fact_id) {
      throw new Error(input.error_code);
    }
  }

  private async assertNoCanonicalSupportDivergenceV1(facts: readonly CanonicalFactRowV1[]): Promise<void> {
    const seenKeys = new Map<string, string>();
    for (const fact of facts) {
      const payload = fact.record_json?.payload as Cap05PersistedObjectV1 | undefined;
      if (!payload || typeof payload !== "object") throw new Error("CAP05_S9_CANONICAL_FACT_PAYLOAD_INVALID");
      const canonical = await this.repository.readCanonicalObject(payload.object_id);
      if (!canonical || canonical.determinism_hash !== payload.determinism_hash || canonical.object_type !== payload.object_type) {
        throw new Error("CAP05_S9_CANONICAL_FACT_DIVERGENCE");
      }
      const prior = seenKeys.get(canonical.idempotency_key);
      if (prior && prior !== canonical.object_id) throw new Error("CAP05_S9_CANONICAL_IDEMPOTENCY_DIVERGENCE");
      seenKeys.set(canonical.idempotency_key, canonical.object_id);

      const guard = await this.pool.query(
        `SELECT identity_kind,record_set_id,determinism_hash FROM twin_object_idempotency_index_v1
         WHERE idempotency_key=$1 LIMIT 2`,
        [canonical.idempotency_key],
      );
      const expectedKind = canonical.object_type === CAP05_DECISION_OBJECT_TYPE_V1
        ? "G_DECISION_RECORD"
        : canonical.object_type === CAP05_ACTION_FEEDBACK_OBJECT_TYPE_V1
          ? "H_ACTION_FEEDBACK"
          : "C_FORECAST_RESIDUAL";
      if (guard.rows.length > 0 && (guard.rows.length !== 1
        || guard.rows[0].identity_kind !== expectedKind
        || guard.rows[0].record_set_id !== canonical.object_id
        || guard.rows[0].determinism_hash !== canonical.determinism_hash)) {
        throw new Error("CAP05_S9_IDEMPOTENCY_GUARD_DIVERGENCE");
      }

      if (canonical.object_type === CAP05_DECISION_OBJECT_TYPE_V1) {
        await this.assertProjectionIdentityV1({
          table: "twin_decision_record_projection_v1",
          id_column: "decision_object_id",
          object_id: canonical.object_id,
          determinism_hash: canonical.determinism_hash,
          source_fact_id: fact.fact_id,
          error_code: "CAP05_S9_DECISION_PROJECTION_DIVERGENCE",
        });
      } else if (canonical.object_type === CAP05_ACTION_FEEDBACK_OBJECT_TYPE_V1) {
        await this.assertProjectionIdentityV1({
          table: "twin_action_feedback_projection_v1",
          id_column: "action_feedback_object_id",
          object_id: canonical.object_id,
          determinism_hash: canonical.determinism_hash,
          source_fact_id: fact.fact_id,
          error_code: "CAP05_S9_ACTION_FEEDBACK_PROJECTION_DIVERGENCE",
        });
        const expectedEvidence = buildCap05ActionFeedbackProjectionRowsV1(canonical, fact.fact_id).evidence
          .map((row) => `${row.evidence_kind}\u001f${row.evidence_ref}\u001f${row.evidence_hash}\u001f${row.source_fact_id}`)
          .sort();
        const evidence = await this.pool.query(
          `SELECT evidence_kind,evidence_ref,evidence_hash,source_fact_id
           FROM twin_action_feedback_evidence_index_v1
           WHERE action_feedback_object_id=$1`,
          [canonical.object_id],
        );
        const actualEvidence = evidence.rows
          .map((row) => `${row.evidence_kind}\u001f${row.evidence_ref}\u001f${row.evidence_hash}\u001f${row.source_fact_id}`)
          .sort();
        for (const row of actualEvidence) {
          if (!expectedEvidence.includes(row)) throw new Error("CAP05_S9_ACTION_FEEDBACK_EVIDENCE_INDEX_DIVERGENCE");
        }
      } else if (canonical.object_type === CAP05_FORECAST_RESIDUAL_OBJECT_TYPE_V1) {
        await this.assertProjectionIdentityV1({
          table: "twin_forecast_residual_projection_v1",
          id_column: "residual_object_id",
          object_id: canonical.object_id,
          determinism_hash: canonical.determinism_hash,
          source_fact_id: fact.fact_id,
          error_code: "CAP05_S9_FORECAST_RESIDUAL_PROJECTION_DIVERGENCE",
        });
      } else {
        throw new Error("CAP05_S9_CANONICAL_OBJECT_TYPE_UNSUPPORTED");
      }
    }
  }

  async rebuildSupportStateFailClosed(): Promise<Cap05SupportRebuildResultV1> {
    const before = await this.loadCanonicalFactsV1();
    await this.assertNoCanonicalSupportDivergenceV1(before);
    const summary = await this.repository.rebuildAllSupportState();
    const after = await this.loadCanonicalFactsV1();
    if (after.length !== before.length) throw new Error("CAP05_S9_REBUILD_CANONICAL_FACT_DELTA");
    const beforeIdentity = before.map((row) => row.fact_id).sort();
    const afterIdentity = after.map((row) => row.fact_id).sort();
    if (JSON.stringify(beforeIdentity) !== JSON.stringify(afterIdentity)) {
      throw new Error("CAP05_S9_REBUILD_CANONICAL_FACT_IDENTITY_CHANGED");
    }
    return {
      service_id: CAP05_S9_RECOVERY_SERVICE_ID_V1,
      policy_id: CAP05_S9_REBUILD_POLICY_ID_V1,
      canonical_fact_count_before: before.length,
      canonical_fact_count_after: after.length,
      canonical_fact_delta: 0,
      summary,
    };
  }
}
