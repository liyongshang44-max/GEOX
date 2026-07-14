// apps/server/src/persistence/twin_runtime/postgres_action_feedback_tick_source_v1.ts
// Purpose: read a bounded set of canonical H Action Feedback objects for one exact scope and hourly tick from rebuildable projection pointers plus canonical public.facts readback.
// Boundary: read-only PostgreSQL adapter; no fact append, projection mutation, State tick, Forecast, Scenario, route, scheduler, filesystem, environment or network authority beyond the supplied Pool.

import type { Pool } from "pg";
import {
  CAP05_ACTION_FEEDBACK_OBJECT_TYPE_V1,
  validateCap05ActionFeedbackV1,
  type Cap05ActionFeedbackEnvelopeV1,
} from "../../domain/twin_runtime/feedback_canonical_contracts_v1.js";
import type { TwinScopeKeyV1 } from "../../runtime/twin_runtime/ports.js";

function canonicalHourV1(value: unknown, code: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(code);
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== value || !value.endsWith(":00:00.000Z")) throw new Error(code);
  return value;
}

function parseFactV1(value: unknown): { type: string; payload: unknown } {
  const parsed = typeof value === "string" ? JSON.parse(value) : value;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("CAP05_ACTION_FEEDBACK_SOURCE_FACT_INVALID");
  const record = parsed as Record<string, unknown>;
  if (typeof record.type !== "string" || !record.type) throw new Error("CAP05_ACTION_FEEDBACK_SOURCE_FACT_TYPE_REQUIRED");
  return { type: record.type, payload: record.payload };
}

function exactProjectionMatchV1(row: Record<string, unknown>, feedback: Cap05ActionFeedbackEnvelopeV1): void {
  const fields: Array<[string, unknown, unknown]> = [
    ["object_id", row.action_feedback_object_id, feedback.object_id],
    ["determinism_hash", row.determinism_hash, feedback.determinism_hash],
    ["tenant_id", row.tenant_id, feedback.tenant_id],
    ["project_id", row.project_id, feedback.project_id],
    ["group_id", row.group_id, feedback.group_id],
    ["field_id", row.field_id, feedback.field_id],
    ["season_id", row.season_id, feedback.season_id],
    ["zone_id", row.zone_id, feedback.zone_id],
    ["event_id", row.event_id, feedback.payload.event_id],
    ["source_record_id", row.source_record_id, feedback.payload.source_record_id],
  ];
  for (const [field, actual, expected] of fields) {
    if (actual !== expected) throw new Error(`CAP05_ACTION_FEEDBACK_SOURCE_PROJECTION_MISMATCH:${field}`);
  }
  const logicalTime = row.logical_time instanceof Date ? row.logical_time.toISOString() : String(row.logical_time);
  const asOf = row.as_of instanceof Date ? row.as_of.toISOString() : String(row.as_of);
  if (logicalTime !== feedback.logical_time) throw new Error("CAP05_ACTION_FEEDBACK_SOURCE_PROJECTION_MISMATCH:logical_time");
  if (asOf !== feedback.as_of) throw new Error("CAP05_ACTION_FEEDBACK_SOURCE_PROJECTION_MISMATCH:as_of");
}

export class PostgresActionFeedbackTickSourceV1 {
  constructor(private readonly pool: Pool) {}

  async loadActionFeedbackCandidates(input: {
    scope: TwinScopeKeyV1;
    logical_time: string;
  }): Promise<readonly Cap05ActionFeedbackEnvelopeV1[]> {
    const logicalTime = canonicalHourV1(input.logical_time, "CAP05_ACTION_FEEDBACK_SOURCE_LOGICAL_TIME_INVALID");
    const result = await this.pool.query(
      `SELECT p.*, f.record_json
       FROM twin_action_feedback_projection_v1 p
       JOIN facts f ON f.fact_id = p.source_fact_id
       WHERE p.tenant_id=$1 AND p.project_id=$2 AND p.group_id=$3
         AND p.field_id=$4 AND p.season_id=$5 AND p.zone_id=$6
         AND p.logical_time > ($7::timestamptz - interval '2 hours')
         AND p.logical_time <= ($7::timestamptz + interval '1 hour')
       ORDER BY p.logical_time, p.as_of, p.action_feedback_object_id`,
      [
        input.scope.tenant_id,
        input.scope.project_id,
        input.scope.group_id,
        input.scope.field_id,
        input.scope.season_id,
        input.scope.zone_id,
        logicalTime,
      ],
    );
    return result.rows.map((row: Record<string, unknown>) => {
      const fact = parseFactV1(row.record_json);
      if (fact.type !== CAP05_ACTION_FEEDBACK_OBJECT_TYPE_V1) throw new Error("CAP05_ACTION_FEEDBACK_SOURCE_FACT_TYPE_MISMATCH");
      if (!fact.payload || typeof fact.payload !== "object" || Array.isArray(fact.payload)) {
        throw new Error("CAP05_ACTION_FEEDBACK_SOURCE_PAYLOAD_INVALID");
      }
      const feedback = fact.payload as Cap05ActionFeedbackEnvelopeV1;
      validateCap05ActionFeedbackV1(feedback);
      exactProjectionMatchV1(row, feedback);
      return structuredClone(feedback);
    });
  }
}
