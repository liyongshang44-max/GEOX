// PFE-14 S4 dependency-provider HTTP candidate.
// Boundary: one exact-scope GET under the existing canonical Runtime namespace.
// No SQL, write route, Runtime mutation, or frontend authority lives here.

import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { Pool } from "pg";

import { authorizeMcftFieldTwinReadV1 } from "../../auth/mcft_field_twin_read_authz_v1.js";
import type { FieldTwinScopeV1 } from "../../domain/field_twin_read_model/index.js";
import {
  McftFieldTwinReadApiErrorV1,
} from "../../services/mcft_field_twin_read_api_v1.js";
import {
  PostgresPfe14Mcft09OperationalReadApiV1,
  type Pfe14Mcft09OperationalReadApiV1,
} from "../../services/pfe14_mcft09_operational_read_api_v1.js";
import {
  MCFT_FIELD_TWIN_CANONICAL_BASE_V1,
  mapMcftFieldTwinReadErrorV1,
} from "./mcft_field_twin_read_v1.js";

const SCOPE_QUERY_KEYS_V1 = ["tenant_id", "project_id", "group_id", "season_id", "zone_id"] as const;
type QueryV1 = Record<string, unknown>;
type ParamsV1 = { field_id?: unknown };

export const PFE14_MCFT09_OPERATIONAL_SUMMARY_ROUTE_V1 = `${MCFT_FIELD_TWIN_CANONICAL_BASE_V1}/operational-summary` as const;

export type RegisterPfe14Mcft09OperationalReadRoutesOptionsV1 = {
  readApi?: Pfe14Mcft09OperationalReadApiV1;
};

function strictSingleTextV1(value: unknown, field: string): string {
  if (Array.isArray(value)) {
    if (value.length !== 1 || typeof value[0] !== "string") throw new McftFieldTwinReadApiErrorV1("MCFT_QUERY_INVALID", 400, field);
    value = value[0];
  }
  if (typeof value !== "string" || !value.trim()) throw new McftFieldTwinReadApiErrorV1("MCFT_SCOPE_INVALID", 400, field);
  return value.trim();
}

function parseScopeV1(request: FastifyRequest): FieldTwinScopeV1 {
  const query = (request.query && typeof request.query === "object" ? request.query : {}) as QueryV1;
  for (const key of Object.keys(query)) {
    if (!(SCOPE_QUERY_KEYS_V1 as readonly string[]).includes(key)) throw new McftFieldTwinReadApiErrorV1("MCFT_QUERY_INVALID", 400, key);
  }
  const params = (request.params && typeof request.params === "object" ? request.params : {}) as ParamsV1;
  const values = Object.fromEntries(SCOPE_QUERY_KEYS_V1.map((key) => [key, strictSingleTextV1(query[key], key)])) as Record<(typeof SCOPE_QUERY_KEYS_V1)[number], string>;
  return {
    tenant_id: values.tenant_id,
    project_id: values.project_id,
    group_id: values.group_id,
    field_id: strictSingleTextV1(params.field_id, "field_id"),
    season_id: values.season_id,
    zone_id: values.zone_id,
  };
}

function authorizeExactScopeV1(request: FastifyRequest, scope: FieldTwinScopeV1): boolean {
  const auth = authorizeMcftFieldTwinReadV1(request);
  if (!auth) return false;
  if (auth.tenant_id !== scope.tenant_id || auth.project_id !== scope.project_id || auth.group_id !== scope.group_id) return false;
  if (auth.allowed_field_ids.length > 0 && !auth.allowed_field_ids.includes(scope.field_id)) return false;
  return true;
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

export function registerPfe14Mcft09OperationalReadRoutesV1(
  app: FastifyInstance,
  pool: Pool,
  options: RegisterPfe14Mcft09OperationalReadRoutesOptionsV1 = {},
): void {
  const readApi = options.readApi ?? new PostgresPfe14Mcft09OperationalReadApiV1(pool);
  app.get(PFE14_MCFT09_OPERATIONAL_SUMMARY_ROUTE_V1, async (request, reply) => {
    try {
      const scope = parseScopeV1(request);
      if (!authorizeExactScopeV1(request, scope)) throw new McftFieldTwinReadApiErrorV1("MCFT_SCOPE_FORBIDDEN", 403);
      const body = await readApi.readOperationalSummary({ scope });
      reply.header("cache-control", "no-store");
      reply.header("x-geox-mcft-read-model-version", body.schema_version);
      reply.header("x-geox-mcft-response-instance-hash", body.response_instance_hash);
      reply.header("x-geox-mcft-content-hash", body.operational_content_hash);
      reply.code(200).send(body);
    } catch (error) {
      sendErrorV1(request, reply, error);
    }
  });
}
