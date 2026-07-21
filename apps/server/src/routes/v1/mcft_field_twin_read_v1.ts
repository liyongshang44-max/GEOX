// Purpose: expose the canonical MCFT-CAP-07 S4 GET-only `/runtime` namespace.
// Boundary: HTTP transport, read-scope authorization, parameter validation, response headers, and exact error mapping only; no SQL or write-capable dependency.

import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { Pool } from "pg";
import { authorizeMcftFieldTwinReadV1, type McftFieldTwinReadAuthContextV1 } from "../../auth/mcft_field_twin_read_authz_v1.js";
import { canonicalUtcInstantV1, type FieldTwinCollectionKindV1, type FieldTwinScopeV1 } from "../../domain/field_twin_read_model/index.js";
import {
  McftFieldTwinReadApiErrorV1,
  PostgresMcftFieldTwinReadApiV1,
  type McftFieldTwinReadApiV1,
  type McftFieldTwinReadRequestV1,
} from "../../services/mcft_field_twin_read_api_v1.js";

export const MCFT_FIELD_TWIN_CANONICAL_BASE_V1 = "/api/v1/operator/twin/fields/:field_id/runtime" as const;
const SCOPE_QUERY_KEYS_V1 = ["tenant_id", "project_id", "group_id", "season_id", "zone_id"] as const;
const MODEL_GOVERNANCE_KINDS_V1 = ["CALIBRATION_CANDIDATE", "SHADOW_EVALUATION", "MODEL_ACTIVATION"] as const;

type QueryV1 = Record<string, unknown>;
type ParamsV1 = { field_id?: unknown };
type EndpointV1 =
  | "runtime"
  | "timeline"
  | "trace"
  | "states"
  | "forecasts"
  | "scenarios"
  | "residuals"
  | "action-lifecycle"
  | "model-governance"
  | "health";

export type RegisterMcftFieldTwinReadRoutesOptionsV1 = {
  readApi?: McftFieldTwinReadApiV1;
  authorizeScope?: (request: FastifyRequest, scope: FieldTwinScopeV1) => McftFieldTwinReadAuthContextV1 | null;
};

function strictSingleTextV1(value: unknown, field: string, required = false): string | null {
  if (value === undefined || value === null || value === "") {
    if (required) throw new McftFieldTwinReadApiErrorV1("MCFT_SCOPE_INVALID", 400, field);
    return null;
  }
  if (Array.isArray(value)) {
    if (value.length !== 1 || typeof value[0] !== "string") throw new McftFieldTwinReadApiErrorV1("MCFT_QUERY_INVALID", 400, field);
    value = value[0];
  }
  if (typeof value !== "string") throw new McftFieldTwinReadApiErrorV1(field === "cursor" ? "MCFT_CURSOR_WIRE_INVALID" : "MCFT_QUERY_INVALID", 400, field);
  const normalized = value.trim();
  if (!normalized) throw new McftFieldTwinReadApiErrorV1(required ? "MCFT_SCOPE_INVALID" : "MCFT_QUERY_INVALID", 400, field);
  return normalized;
}

function parseLimitV1(value: unknown): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const text = strictSingleTextV1(value, "limit");
  if (!text || !/^[1-9][0-9]*$/.test(text)) throw new McftFieldTwinReadApiErrorV1("MCFT_COLLECTION_LIMIT_INVALID", 400);
  const parsed = Number(text);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > 200) throw new McftFieldTwinReadApiErrorV1("MCFT_COLLECTION_LIMIT_INVALID", 400);
  return parsed;
}

function parseInstantV1(value: unknown, field: "from" | "until"): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const text = strictSingleTextV1(value, field);
  try {
    return canonicalUtcInstantV1(text!);
  } catch {
    throw new McftFieldTwinReadApiErrorV1("MCFT_TIMELINE_FILTER_INVALID", 400, field);
  }
}

function parseScopeV1(request: FastifyRequest): FieldTwinScopeV1 {
  const query = (request.query && typeof request.query === "object" ? request.query : {}) as QueryV1;
  const params = (request.params && typeof request.params === "object" ? request.params : {}) as ParamsV1;
  const fieldId = strictSingleTextV1(params.field_id, "field_id", true)!;
  const values = Object.fromEntries(
    SCOPE_QUERY_KEYS_V1.map((key) => [key, strictSingleTextV1(query[key], key, true)]),
  ) as Record<(typeof SCOPE_QUERY_KEYS_V1)[number], string>;
  return {
    tenant_id: values.tenant_id,
    project_id: values.project_id,
    group_id: values.group_id,
    field_id: fieldId,
    season_id: values.season_id,
    zone_id: values.zone_id,
  };
}

function allowedQueryKeysV1(endpoint: EndpointV1): ReadonlySet<string> {
  const keys = new Set<string>(SCOPE_QUERY_KEYS_V1);
  if (["timeline", "states", "forecasts", "scenarios", "residuals", "action-lifecycle", "model-governance"].includes(endpoint)) {
    keys.add("cursor");
    keys.add("limit");
  }
  if (endpoint === "timeline") {
    keys.add("from");
    keys.add("until");
  }
  if (endpoint === "trace") keys.add("root_object_ref");
  if (endpoint === "model-governance") keys.add("collection_kind");
  return keys;
}

function assertQuerySurfaceV1(query: QueryV1, endpoint: EndpointV1): void {
  const allowed = allowedQueryKeysV1(endpoint);
  for (const key of Object.keys(query)) {
    if (!allowed.has(key)) {
      if (key === "as_of") throw new McftFieldTwinReadApiErrorV1("MCFT_HISTORICAL_RUNTIME_NOT_SUPPORTED", 400);
      throw new McftFieldTwinReadApiErrorV1("MCFT_QUERY_INVALID", 400, key);
    }
  }
}

function parseModelGovernanceKindV1(query: QueryV1): FieldTwinCollectionKindV1 {
  const value = strictSingleTextV1(query.collection_kind, "collection_kind");
  if (!value || !MODEL_GOVERNANCE_KINDS_V1.includes(value as (typeof MODEL_GOVERNANCE_KINDS_V1)[number])) {
    throw new McftFieldTwinReadApiErrorV1("MCFT_CURSOR_COLLECTION_KIND_MISMATCH", 400, "MODEL_GOVERNANCE_KIND_REQUIRED");
  }
  return value as FieldTwinCollectionKindV1;
}

function buildReadRequestV1(request: FastifyRequest, endpoint: EndpointV1): McftFieldTwinReadRequestV1 {
  const query = (request.query && typeof request.query === "object" ? request.query : {}) as QueryV1;
  assertQuerySurfaceV1(query, endpoint);
  const from = endpoint === "timeline" ? parseInstantV1(query.from, "from") : undefined;
  const until = endpoint === "timeline" ? parseInstantV1(query.until, "until") : undefined;
  if (from && until && from >= until) throw new McftFieldTwinReadApiErrorV1("MCFT_TIMELINE_FILTER_INVALID", 400, "RANGE");
  return {
    scope: parseScopeV1(request),
    cursor: query.cursor === undefined ? undefined : strictSingleTextV1(query.cursor, "cursor"),
    limit: parseLimitV1(query.limit),
    ...(endpoint === "timeline" ? { from_logical_time: from, until_logical_time: until } : {}),
    ...(endpoint === "model-governance" ? { collection_kind: parseModelGovernanceKindV1(query) } : {}),
    ...(endpoint === "trace" ? { root_object_ref: query.root_object_ref === undefined ? null : strictSingleTextV1(query.root_object_ref, "root_object_ref") } : {}),
  };
}

function authorizeExactScopeV1(request: FastifyRequest, scope: FieldTwinScopeV1): McftFieldTwinReadAuthContextV1 | null {
  const auth = authorizeMcftFieldTwinReadV1(request);
  if (!auth) return null;
  if (auth.tenant_id !== scope.tenant_id || auth.project_id !== scope.project_id || auth.group_id !== scope.group_id) return null;
  if (auth.allowed_field_ids.length > 0 && !auth.allowed_field_ids.includes(scope.field_id)) return null;
  return auth;
}

function responseHashV1(body: Record<string, unknown>): string | null {
  return typeof body.response_instance_hash === "string" && body.response_instance_hash.startsWith("sha256:")
    ? body.response_instance_hash
    : null;
}

function contentHashV1(body: Record<string, unknown>): string | null {
  for (const key of ["root_graph_content_hash", "timeline_page_content_hash", "trace_graph_content_hash", "collection_page_content_hash", "health_content_hash"]) {
    const value = body[key];
    if (typeof value === "string" && value.startsWith("sha256:")) return value;
  }
  return null;
}

function sendSuccessV1(reply: FastifyReply, body: Record<string, unknown>): void {
  reply.header("cache-control", "no-store");
  reply.header("x-geox-mcft-read-model-version", String(body.schema_version ?? "unknown"));
  const responseHash = responseHashV1(body);
  const contentHash = contentHashV1(body);
  if (responseHash) reply.header("x-geox-mcft-response-instance-hash", responseHash);
  if (contentHash) reply.header("x-geox-mcft-content-hash", contentHash);
  reply.code(200).send(body);
}

function errorCodeV1(error: unknown): string {
  const candidate = error as { code?: unknown; message?: unknown };
  if (typeof candidate?.code === "string" && candidate.code) return candidate.code;
  const message = String(candidate?.message ?? "");
  return message.split(":", 1)[0] || "MCFT_READ_SURFACE_UNAVAILABLE";
}

export function mapMcftFieldTwinReadErrorV1(error: unknown): McftFieldTwinReadApiErrorV1 {
  if (error instanceof McftFieldTwinReadApiErrorV1) return error;
  const code = errorCodeV1(error);
  if (code === "MCFT_CURSOR_SIGNING_KEY_UNAVAILABLE" || /UNAVAILABLE|PREPROVISION|REQUIRED_READ_SCHEMA|VISIBILITY_METADATA_NOT_ESTABLISHED/.test(code) || /^[0-9A-Z]{5}$/.test(code)) {
    return new McftFieldTwinReadApiErrorV1(code, 503);
  }
  if (code === "MCFT_RUNTIME_NOT_ESTABLISHED" || code === "MCFT_EXACT_RESOURCE_NOT_FOUND") {
    return new McftFieldTwinReadApiErrorV1(code, 404);
  }
  if (code === "MCFT_CURSOR_VISIBILITY_EPOCH_MISMATCH" || /DIVERGENCE|MISMATCH|CARDINALITY|INCOMPLETE|POINTER|RECORD_SET|AUTHORITY|CANONICAL|ROLE_UNRESOLVED|SOURCE_.*INVALID/.test(code)) {
    return new McftFieldTwinReadApiErrorV1(code, 409);
  }
  if (/CURSOR|FILTER|LIMIT|QUERY|SCOPE_INVALID|HISTORICAL_RUNTIME|COLLECTION_KIND|TIMELINE/.test(code)) {
    return new McftFieldTwinReadApiErrorV1(code, 400);
  }
  return new McftFieldTwinReadApiErrorV1("MCFT_READ_SURFACE_UNAVAILABLE", 503, code);
}

function sendErrorV1(request: FastifyRequest, reply: FastifyReply, error: unknown): void {
  const mapped = mapMcftFieldTwinReadErrorV1(error);
  reply.header("cache-control", "no-store");
  reply.code(mapped.statusCode).send({
    schema_version: "mcft_field_twin_api_error_v1",
    error_code: mapped.code,
    failed_profiles: [],
    diagnostics: mapped.message === mapped.code ? [] : [mapped.message],
    request_id: String(request.id ?? "unknown"),
  });
}

function invokeReadV1(endpoint: EndpointV1, api: McftFieldTwinReadApiV1, request: McftFieldTwinReadRequestV1): Promise<Record<string, unknown>> {
  if (endpoint === "runtime") return api.readRuntime(request);
  if (endpoint === "timeline") return api.readTimeline(request);
  if (endpoint === "trace") return api.readTrace(request);
  if (endpoint === "states") return api.readStates(request);
  if (endpoint === "forecasts") return api.readForecasts(request);
  if (endpoint === "scenarios") return api.readScenarios(request);
  if (endpoint === "residuals") return api.readResiduals(request);
  if (endpoint === "action-lifecycle") return api.readActionLifecycle(request);
  if (endpoint === "model-governance") return api.readModelGovernance(request);
  return api.readHealth(request);
}

function handlerV1(
  endpoint: EndpointV1,
  readApi: McftFieldTwinReadApiV1,
  authorizeScope: NonNullable<RegisterMcftFieldTwinReadRoutesOptionsV1["authorizeScope"]>,
): (request: FastifyRequest, reply: FastifyReply) => Promise<void> {
  return async (request, reply) => {
    try {
      const readRequest = buildReadRequestV1(request, endpoint);
      const auth = authorizeScope(request, readRequest.scope);
      if (!auth) throw new McftFieldTwinReadApiErrorV1("MCFT_SCOPE_FORBIDDEN", 403);
      sendSuccessV1(reply, await invokeReadV1(endpoint, readApi, readRequest));
    } catch (error) {
      sendErrorV1(request, reply, error);
    }
  };
}

export function registerMcftFieldTwinReadRoutesV1(
  app: FastifyInstance,
  pool: Pool,
  options: RegisterMcftFieldTwinReadRoutesOptionsV1 = {},
): void {
  const readApi = options.readApi ?? new PostgresMcftFieldTwinReadApiV1(pool);
  const authorizeScope = options.authorizeScope ?? authorizeExactScopeV1;
  app.get(MCFT_FIELD_TWIN_CANONICAL_BASE_V1, handlerV1("runtime", readApi, authorizeScope));
  app.get(`${MCFT_FIELD_TWIN_CANONICAL_BASE_V1}/timeline`, handlerV1("timeline", readApi, authorizeScope));
  app.get(`${MCFT_FIELD_TWIN_CANONICAL_BASE_V1}/trace`, handlerV1("trace", readApi, authorizeScope));
  app.get(`${MCFT_FIELD_TWIN_CANONICAL_BASE_V1}/states`, handlerV1("states", readApi, authorizeScope));
  app.get(`${MCFT_FIELD_TWIN_CANONICAL_BASE_V1}/forecasts`, handlerV1("forecasts", readApi, authorizeScope));
  app.get(`${MCFT_FIELD_TWIN_CANONICAL_BASE_V1}/scenarios`, handlerV1("scenarios", readApi, authorizeScope));
  app.get(`${MCFT_FIELD_TWIN_CANONICAL_BASE_V1}/residuals`, handlerV1("residuals", readApi, authorizeScope));
  app.get(`${MCFT_FIELD_TWIN_CANONICAL_BASE_V1}/action-lifecycle`, handlerV1("action-lifecycle", readApi, authorizeScope));
  app.get(`${MCFT_FIELD_TWIN_CANONICAL_BASE_V1}/model-governance`, handlerV1("model-governance", readApi, authorizeScope));
  app.get(`${MCFT_FIELD_TWIN_CANONICAL_BASE_V1}/health`, handlerV1("health", readApi, authorizeScope));
}
