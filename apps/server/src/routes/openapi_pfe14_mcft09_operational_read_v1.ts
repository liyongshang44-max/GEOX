// OpenAPI overlay for the PFE-14 / MCFT-9 GET-only operational-summary projection.
// Documentation metadata only; no route or Runtime authority.

import { SALES_CRITICAL_OPENAPI_PATHS_V1, SALES_CRITICAL_OPENAPI_SCHEMAS_V1 } from "./openapi_sales_critical_overlay_v1.js";

const instant = { type: "string", format: "date-time" } as const;
const nullableInstant = { type: ["string", "null"], format: "date-time" } as const;
const hash = { type: "string", pattern: "^sha256:" } as const;
const scope = {
  type: "object", additionalProperties: false,
  required: ["tenant_id", "project_id", "group_id", "field_id", "season_id", "zone_id"],
  properties: Object.fromEntries(["tenant_id", "project_id", "group_id", "field_id", "season_id", "zone_id"].map((name) => [name, { type: "string", minLength: 1 }])),
} as const;
const scopeParameters = [
  { name: "field_id", in: "path", required: true, schema: { type: "string", minLength: 1 } },
  ...["tenant_id", "project_id", "group_id", "season_id", "zone_id"].map((name) => ({ name, in: "query", required: true, schema: { type: "string", minLength: 1 } })),
] as const;
const slotState = { enum: ["CLAIMED", "RUNNING", "COMPLETED", "DEGRADED", "FAILED", "NOT_MATERIALIZED"] } as const;

export const PFE14_MCFT09_OPERATIONAL_OPENAPI_SCHEMAS_V1 = {
  Pfe14Mcft09OperationalSummaryV1: {
    type: "object", additionalProperties: false,
    required: ["schema_version", "request_scope", "response_started_at", "scheduler_summary", "evidence_availability", "operational_status", "slot_window", "limitations", "validation_summary", "operational_content_hash", "response_instance_hash"],
    properties: {
      schema_version: { const: "pfe14_mcft09_operational_summary_v1" },
      request_scope: scope,
      response_started_at: instant,
      scheduler_summary: {
        type: "object", additionalProperties: false,
        required: ["scheduler_status", "latest_completed_slot", "latest_tick_ref", "latest_tick_status", "latest_tick_started_at", "latest_tick_completed_at", "next_target_slot", "next_target_at", "scheduler_lag_ms"],
        properties: {
          scheduler_status: { enum: ["WAITING", "RUNNING", "COMPLETED", "NOT_ESTABLISHED"] }, latest_completed_slot: nullableInstant,
          latest_tick_ref: { type: ["string", "null"] }, latest_tick_status: { enum: ["COMPLETED", "DEGRADED", "FAILED", null] }, latest_tick_started_at: { type: "null" }, latest_tick_completed_at: nullableInstant,
          next_target_slot: nullableInstant, next_target_at: nullableInstant, scheduler_lag_ms: { type: ["integer", "null"], minimum: 0 },
        },
      },
      evidence_availability: {
        type: "object", additionalProperties: false,
        required: ["eligibility_boundary", "latest_evidence_observed_at", "latest_evidence_ingested_at", "evidence_age_ms", "freshness_status", "freshness_threshold_ms", "coverage_ratio", "maximum_gap_ms", "future_excluded_count", "late_evidence_count", "out_of_order_count"],
        properties: {
          eligibility_boundary: { anyOf: [{ type: "object", additionalProperties: false, required: ["slot_id", "logical_time"], properties: { slot_id: { pattern: "^O(0[0-9]|1[0-9]|2[0-3])$" }, logical_time: instant } }, { type: "null" }] },
          latest_evidence_observed_at: nullableInstant, latest_evidence_ingested_at: nullableInstant, evidence_age_ms: { type: ["integer", "null"], minimum: 0 }, freshness_status: { enum: ["FRESH", "STALE", "MISSING", "UNKNOWN"] }, freshness_threshold_ms: { type: "integer", minimum: 1 }, coverage_ratio: { type: ["number", "null"], minimum: 0, maximum: 1 }, maximum_gap_ms: { type: ["integer", "null"], minimum: 0 }, future_excluded_count: { type: ["integer", "null"], minimum: 0 }, late_evidence_count: { type: ["integer", "null"], minimum: 0 }, out_of_order_count: { type: ["integer", "null"], minimum: 0 },
        },
      },
      operational_status: {
        type: "object", additionalProperties: false,
        required: ["runtime_degradation_status", "degradation_reason_codes", "forecast_status", "scenario_source_eligible"],
        properties: {
          runtime_degradation_status: { enum: ["HEALTHY", "DEGRADED", "UNAVAILABLE"] },
          degradation_reason_codes: { type: "array", items: { enum: ["CHECKPOINT_NOT_ESTABLISHED", "EVIDENCE_BOUNDARY_NOT_ESTABLISHED", "EVIDENCE_STALE", "EVIDENCE_MISSING", "SCHEDULER_LAG"] } },
          forecast_status: { enum: ["COMPLETED", "BLOCKED", null] },
          scenario_source_eligible: { type: ["boolean", "null"] },
        },
      },
      slot_window: {
        anyOf: [
          { type: "null" },
          { type: "object", additionalProperties: false, required: ["schedule_start_logical_time", "interval_seconds", "entries"], properties: {
            schedule_start_logical_time: instant,
            interval_seconds: { const: 3600 },
            entries: { type: "array", minItems: 24, maxItems: 24, items: { type: "object", additionalProperties: false, required: ["slot_id", "logical_time", "state", "tick_ref", "health_ref", "terminal_at"], properties: {
              slot_id: { pattern: "^O(0[0-9]|1[0-9]|2[0-3])$" }, logical_time: instant, state: slotState, tick_ref: { type: ["string", "null"] }, health_ref: { type: ["string", "null"] }, terminal_at: nullableInstant,
            } } },
          },
        ],
      },
      limitations: { type: "array", items: { type: "string" } }, validation_summary: { type: "array", items: { type: "string" } }, operational_content_hash: hash, response_instance_hash: hash,
    },
  },
} as const;

export const PFE14_MCFT09_OPERATIONAL_OPENAPI_PATHS_V1 = {
  "/api/v1/operator/twin/fields/{field_id}/runtime/operational-summary": {
    get: {
      tags: ["Operator Twin Runtime"],
      summary: "Read exact-scope MCFT-9 operational product projection",
      operationId: "getPfe14Mcft09OperationalSummaryV1",
      parameters: scopeParameters,
      responses: {
        "200": { description: "GET-only operational projection; not canonical Twin truth", content: { "application/json": { schema: { $ref: "#/components/schemas/Pfe14Mcft09OperationalSummaryV1" } } } },
        "400": { description: "Invalid exact-scope request" }, "403": { description: "Exact scope forbidden" }, "409": { description: "Operational or canonical read state inconsistent" }, "503": { description: "Required read source unavailable" },
      },
    },
  },
} as const;

let installed = false;
export function installPfe14Mcft09OperationalReadOpenApiV1(): void {
  if (installed) return;
  Object.assign(SALES_CRITICAL_OPENAPI_SCHEMAS_V1, PFE14_MCFT09_OPERATIONAL_OPENAPI_SCHEMAS_V1);
  Object.assign(SALES_CRITICAL_OPENAPI_PATHS_V1, PFE14_MCFT09_OPERATIONAL_OPENAPI_PATHS_V1);
  installed = true;
}
