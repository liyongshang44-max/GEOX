// Purpose: install exact OpenAPI path and schema contracts for the MCFT-CAP-07 S4 canonical GET-only Runtime namespace.
// Boundary: documentation metadata only; no route registration, database access, or write authority.

import { SALES_CRITICAL_OPENAPI_PATHS_V1, SALES_CRITICAL_OPENAPI_SCHEMAS_V1 } from "./openapi_sales_critical_overlay_v1.js";

const scopeParameters = [
  { name: "field_id", in: "path", required: true, schema: { type: "string", minLength: 1 } },
  ...["tenant_id", "project_id", "group_id", "season_id", "zone_id"].map((name) => ({ name, in: "query", required: true, schema: { type: "string", minLength: 1 } })),
] as const;
const cursorParameters = [
  { name: "cursor", in: "query", required: false, schema: { type: "string", minLength: 1, pattern: "^[A-Za-z0-9_-]+$" } },
  { name: "limit", in: "query", required: false, schema: { type: "integer", minimum: 1, maximum: 200, default: 50 } },
] as const;
const errorRef = { content: { "application/json": { schema: { $ref: "#/components/schemas/McftFieldTwinApiErrorV1" } } } } as const;
const errorResponses = {
  "400": { description: "Invalid parameter, filter, cursor, collection kind, or unsupported time travel", ...errorRef },
  "403": { description: "Exact tenant/project/group/field scope is not authorized", ...errorRef },
  "404": { description: "Exact requested Runtime root or historical root is not established", ...errorRef },
  "409": { description: "Established authority, pointer, canonical fact, record set, or graph is inconsistent", ...errorRef },
  "503": { description: "Required PostgreSQL, schema, visibility metadata, snapshot, or cursor signing service is unavailable", ...errorRef },
} as const;

function operation(operationId: string, summary: string, responseSchema: string, extraParameters: readonly Record<string, unknown>[] = []): Record<string, unknown> {
  return {
    tags: ["Operator Twin Runtime"], summary, operationId, parameters: [...scopeParameters, ...extraParameters],
    responses: {
      "200": {
        description: "Exact read-only MCFT response",
        headers: {
          "x-geox-mcft-read-model-version": { schema: { type: "string" } },
          "x-geox-mcft-response-instance-hash": { schema: { type: "string", pattern: "^sha256:" } },
          "x-geox-mcft-content-hash": { schema: { type: "string", pattern: "^sha256:" } },
        },
        content: { "application/json": { schema: { $ref: `#/components/schemas/${responseSchema}` } } },
      },
      ...errorResponses,
    },
  };
}

const hashSchema = { type: "string", pattern: "^sha256:" } as const;
const instantSchema = { type: "string", format: "date-time" } as const;
const scopeSchema = {
  type: "object", additionalProperties: false,
  required: ["tenant_id", "project_id", "group_id", "field_id", "season_id", "zone_id"],
  properties: Object.fromEntries(["tenant_id", "project_id", "group_id", "field_id", "season_id", "zone_id"].map((name) => [name, { type: "string", minLength: 1 }])),
} as const;
const visibilitySchema = {
  type: "object", additionalProperties: false,
  required: ["snapshot_schema_version", "database_visibility_epoch_id", "pg_snapshot_token", "snapshot_xmin", "snapshot_xmax", "snapshot_xip_hash", "visibility_snapshot_hash"],
  properties: {
    snapshot_schema_version: { const: "field_twin_canonical_visibility_snapshot_v1" }, database_visibility_epoch_id: { type: "string", minLength: 1 }, pg_snapshot_token: { type: "string", minLength: 1 }, snapshot_xmin: { type: "string", pattern: "^(0|[1-9][0-9]*)$" }, snapshot_xmax: { type: "string", pattern: "^(0|[1-9][0-9]*)$" }, snapshot_xip_hash: hashSchema, visibility_snapshot_hash: hashSchema,
  },
} as const;
const canonicalRefSchema = {
  type: "object", additionalProperties: false,
  required: ["object_ref", "object_type", "object_hash", "source_fact_ref"],
  properties: { object_ref: { type: "string", minLength: 1 }, object_type: { type: "string", minLength: 1 }, object_hash: hashSchema, source_fact_ref: { type: ["string", "null"] } },
} as const;
const collectionItemSchema = {
  type: "object", additionalProperties: false,
  required: ["object_ref", "object_type", "object_hash", "logical_time", "attachment_status"],
  properties: { object_ref: { type: "string", minLength: 1 }, object_type: { type: "string", minLength: 1 }, object_hash: hashSchema, logical_time: instantSchema, attachment_status: { const: "ATTACHED_EXACT" } },
} as const;
const collectionPageSchema = {
  type: "object", additionalProperties: false,
  required: ["schema_version", "collection_kind", "canonical_visibility_snapshot", "fixed_root_ref", "fixed_root_graph_content_hash", "items", "page_limit", "has_more", "next_cursor", "collection_items_content_hash", "collection_page_content_hash", "response_started_at", "response_instance_hash"],
  properties: {
    schema_version: { const: "field_twin_collection_page_v1" },
    collection_kind: { enum: ["STATE", "FORECAST", "SCENARIO", "ACTION_FEEDBACK", "FORECAST_RESIDUAL", "CALIBRATION_CANDIDATE", "SHADOW_EVALUATION", "MODEL_ACTIVATION"] },
    canonical_visibility_snapshot: visibilitySchema, fixed_root_ref: { type: "string", minLength: 1 }, fixed_root_graph_content_hash: hashSchema,
    items: { type: "array", maxItems: 200, items: collectionItemSchema }, page_limit: { type: "integer", minimum: 1, maximum: 200 }, has_more: { type: "boolean" }, next_cursor: { type: ["string", "null"], pattern: "^[A-Za-z0-9_-]+$" }, collection_items_content_hash: hashSchema, collection_page_content_hash: hashSchema, response_started_at: instantSchema, response_instance_hash: hashSchema,
  },
} as const;

export const MCFT_FIELD_TWIN_OPENAPI_SCHEMAS_V1 = {
  McftFieldTwinScopeV1: scopeSchema,
  McftFieldTwinCanonicalVisibilitySnapshotV1: visibilitySchema,
  McftFieldTwinCanonicalRefV1: canonicalRefSchema,
  McftFieldTwinApiErrorV1: {
    type: "object", additionalProperties: false,
    required: ["schema_version", "error_code", "failed_profiles", "diagnostics", "request_id"],
    properties: { schema_version: { const: "mcft_field_twin_api_error_v1" }, error_code: { type: "string", minLength: 1 }, failed_profiles: { type: "array", items: { type: "string" } }, diagnostics: { type: "array", items: { type: "string" } }, request_id: { type: "string", minLength: 1 } },
  },
  McftFieldTwinRuntimeResponseV1: {
    type: "object", additionalProperties: true,
    required: ["schema_version", "request_scope", "response_started_at", "root_graph_status", "active_lineage", "checkpoint", "terminal_record_set_health", "current_tick_forecast_result", "root_graph_content_hash", "attachment_content_hash", "response_instance_hash"],
    properties: { schema_version: { const: "minimal_field_twin_runtime_read_model_v1" }, request_scope: scopeSchema, response_started_at: instantSchema, root_graph_status: { const: "COMPLETE_EXACT_GRAPH" }, active_lineage: canonicalRefSchema, checkpoint: canonicalRefSchema, terminal_record_set_health: canonicalRefSchema, current_tick_forecast_result: canonicalRefSchema, root_graph_content_hash: hashSchema, attachment_content_hash: hashSchema, response_instance_hash: hashSchema },
  },
  McftFieldTwinTimelineResponseV1: {
    type: "object", additionalProperties: false,
    required: ["schema_version", "canonical_visibility_snapshot", "fixed_root_ref", "fixed_root_graph_content_hash", "items", "page_limit", "has_more", "next_cursor", "timeline_items_content_hash", "timeline_page_content_hash", "response_started_at", "response_instance_hash"],
    properties: { schema_version: { const: "field_twin_timeline_page_v1" }, canonical_visibility_snapshot: visibilitySchema, fixed_root_ref: { type: "string", minLength: 1 }, fixed_root_graph_content_hash: hashSchema, items: { type: "array", maxItems: 200, items: { type: "object", additionalProperties: true } }, page_limit: { type: "integer", minimum: 1, maximum: 200 }, has_more: { type: "boolean" }, next_cursor: { type: ["string", "null"], pattern: "^[A-Za-z0-9_-]+$" }, timeline_items_content_hash: hashSchema, timeline_page_content_hash: hashSchema, response_started_at: instantSchema, response_instance_hash: hashSchema },
  },
  McftFieldTwinTraceResponseV1: {
    type: "object", additionalProperties: true,
    required: ["schema_version", "request_scope", "response_started_at", "nodes", "edges", "trace_graph_content_hash", "response_instance_hash"],
    properties: { schema_version: { const: "field_twin_trace_graph_v1" }, request_scope: scopeSchema, response_started_at: instantSchema, nodes: { type: "array", items: { type: "object" } }, edges: { type: "array", items: { type: "object" } }, trace_graph_content_hash: hashSchema, response_instance_hash: hashSchema },
  },
  McftFieldTwinCollectionPageV1: collectionPageSchema,
  McftFieldTwinHealthResponseV1: {
    type: "object", additionalProperties: true,
    required: ["schema_version", "request_scope", "response_started_at", "terminal_record_set_health", "latest_operational_runtime_health", "health_relationship", "health_content_hash", "response_instance_hash"],
    properties: { schema_version: { const: "field_twin_runtime_health_read_model_v1" }, request_scope: scopeSchema, response_started_at: instantSchema, terminal_record_set_health: canonicalRefSchema, latest_operational_runtime_health: { anyOf: [canonicalRefSchema, { type: "null" }] }, health_relationship: { enum: ["SAME_OBJECT", "DISTINCT_OBJECTS", "ONE_OR_BOTH_ABSENT"] }, health_content_hash: hashSchema, response_instance_hash: hashSchema },
  },
} as const;

export const MCFT_FIELD_TWIN_OPENAPI_PATHS_V1 = {
  "/api/v1/operator/twin/fields/{field_id}/runtime": { get: operation("getMcftFieldTwinRuntimeV1", "Read current exact Field Twin Runtime root", "McftFieldTwinRuntimeResponseV1") },
  "/api/v1/operator/twin/fields/{field_id}/runtime/timeline": { get: operation("getMcftFieldTwinTimelineV1", "Read bounded canonical-visibility Field Twin timeline", "McftFieldTwinTimelineResponseV1", [...cursorParameters, { name: "from", in: "query", required: false, schema: instantSchema }, { name: "until", in: "query", required: false, schema: instantSchema }]) },
  "/api/v1/operator/twin/fields/{field_id}/runtime/trace": { get: operation("getMcftFieldTwinTraceV1", "Read current or explicit historical-root exact Field Twin trace", "McftFieldTwinTraceResponseV1", [{ name: "root_object_ref", in: "query", required: false, schema: { type: "string", minLength: 1 } }]) },
  "/api/v1/operator/twin/fields/{field_id}/runtime/states": { get: operation("getMcftFieldTwinStatesV1", "Read bounded validated Field Twin state collection", "McftFieldTwinCollectionPageV1", cursorParameters) },
  "/api/v1/operator/twin/fields/{field_id}/runtime/forecasts": { get: operation("getMcftFieldTwinForecastsV1", "Read bounded validated Field Twin forecast collection", "McftFieldTwinCollectionPageV1", cursorParameters) },
  "/api/v1/operator/twin/fields/{field_id}/runtime/scenarios": { get: operation("getMcftFieldTwinScenariosV1", "Read bounded validated Field Twin scenario collection", "McftFieldTwinCollectionPageV1", cursorParameters) },
  "/api/v1/operator/twin/fields/{field_id}/runtime/residuals": { get: operation("getMcftFieldTwinResidualsV1", "Read bounded validated Field Twin residual collection", "McftFieldTwinCollectionPageV1", cursorParameters) },
  "/api/v1/operator/twin/fields/{field_id}/runtime/action-lifecycle": { get: operation("getMcftFieldTwinActionLifecycleV1", "Read bounded validated Field Twin action-feedback collection", "McftFieldTwinCollectionPageV1", cursorParameters) },
  "/api/v1/operator/twin/fields/{field_id}/runtime/model-governance": { get: operation("getMcftFieldTwinModelGovernanceV1", "Read one bounded validated model-governance collection", "McftFieldTwinCollectionPageV1", [...cursorParameters, { name: "collection_kind", in: "query", required: true, schema: { enum: ["CALIBRATION_CANDIDATE", "SHADOW_EVALUATION", "MODEL_ACTIVATION"] } }]) },
  "/api/v1/operator/twin/fields/{field_id}/runtime/health": { get: operation("getMcftFieldTwinHealthV1", "Read terminal record-set and latest operational Runtime Health", "McftFieldTwinHealthResponseV1") },
} as const;

let installed = false;
export function installMcftFieldTwinReadOpenApiV1(): void {
  if (installed) return;
  Object.assign(SALES_CRITICAL_OPENAPI_SCHEMAS_V1, MCFT_FIELD_TWIN_OPENAPI_SCHEMAS_V1);
  Object.assign(SALES_CRITICAL_OPENAPI_PATHS_V1, MCFT_FIELD_TWIN_OPENAPI_PATHS_V1);
  installed = true;
}
