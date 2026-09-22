// Canonical read-only Product API for the first Customer Product Projection slice.
// Boundary: authenticated client principal only; scope comes from server-side auth context.
// No query parameter may broaden tenant/project/group/field access. No writes are exposed here.

import { randomUUID } from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { Pool } from "pg";

import { enforceRouteRoleAuth } from "../auth/route_role_authz.js";
import { resolveCustomerScope } from "../services/customer/customer_scope_v1.js";
import { CustomerProductProjectionBuilderV1 } from "../product_projection/builders/customer_product_projection_builder_v1.js";
import {
  CUSTOMER_PRODUCT_PROJECTION_DERIVATION_VERSION_V1,
  type ProductApiErrorEnvelopeV1,
  type ProductApiSuccessEnvelopeV1,
} from "../product_projection/contracts/customer_product_projection_contracts_v1.js";
import {
  ProductProjectionReadErrorV1,
  type ProductCustomerReadScopeV1,
} from "../product_projection/readers/postgres_customer_product_projection_reader_v1.js";

const PRODUCT_API_SCHEMA_VERSION_V1 = "geox.product-api.v1" as const;

type ProductAuthContextV1 = {
  scope: ProductCustomerReadScopeV1;
};

function requestId(): string {
  return randomUUID();
}

function sendError(
  reply: FastifyReply,
  status: 400 | 403 | 404 | 503,
  id: string,
  code: string,
  message: string,
  retryable: boolean,
): FastifyReply {
  const body: ProductApiErrorEnvelopeV1 = {
    ok: false,
    request_id: id,
    error: { code, message, retryable },
  };
  return reply.status(status).send(body);
}

function queryObject(req: FastifyRequest): Record<string, unknown> {
  const query = (req as FastifyRequest & { query?: unknown }).query;
  return query && typeof query === "object" && !Array.isArray(query)
    ? query as Record<string, unknown>
    : {};
}

function hasForbiddenScopeQuery(req: FastifyRequest): boolean {
  const query = queryObject(req);
  return ["tenant_id", "tenantId", "project_id", "projectId", "group_id", "groupId", "field_id", "fieldId", "field_ids", "field_ids[]"]
    .some((key) => query[key] !== undefined);
}

function requireCustomerProductAuth(
  req: FastifyRequest,
  reply: FastifyReply,
  resource: "dashboard" | "fields",
  id: string,
  asNotFound = false,
): ProductAuthContextV1 | null {
  const auth = enforceRouteRoleAuth(req, reply, resource, { asNotFound });
  if (!auth) return null;

  // The first Product API slice is a Customer contract. Widening to Operator/Admin is a later
  // separately-governed scope decision, not an implicit privilege of an internal token.
  if (auth.role !== "client") {
    sendError(reply, 403, id, "PRODUCT_CUSTOMER_ROLE_REQUIRED", "Customer product access is not available for this principal.", false);
    return null;
  }

  if (hasForbiddenScopeQuery(req)) {
    sendError(reply, 400, id, "PRODUCT_SCOPE_QUERY_FORBIDDEN", "Scope is derived from the authenticated principal.", false);
    return null;
  }

  const customerScope = resolveCustomerScope(auth);
  if (customerScope.scope_mode !== "CLIENT_ALLOWLIST" || customerScope.allowed_field_ids.length === 0) {
    sendError(reply, 403, id, "PRODUCT_SCOPE_UNAVAILABLE", "No authorized fields are available for this principal.", false);
    return null;
  }

  return {
    scope: {
      tenant_id: String(auth.tenant_id),
      project_id: String(auth.project_id),
      group_id: String(auth.group_id),
      allowed_field_ids: [...customerScope.allowed_field_ids],
    },
  };
}

function success<T>(requestIdValue: string, generatedAt: string, data: T): ProductApiSuccessEnvelopeV1<T> {
  return {
    ok: true,
    request_id: requestIdValue,
    generated_at: generatedAt,
    schema_version: PRODUCT_API_SCHEMA_VERSION_V1,
    derivation_version: CUSTOMER_PRODUCT_PROJECTION_DERIVATION_VERSION_V1,
    data,
  };
}

function textQuery(req: FastifyRequest, key: string): string | null {
  const value = queryObject(req)[key];
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text || null;
}

function filterFields(req: FastifyRequest, fields: Awaited<ReturnType<CustomerProductProjectionBuilderV1["buildFieldSummaries"]>>) {
  const search = textQuery(req, "search")?.toLowerCase() ?? null;
  const crop = textQuery(req, "crop")?.toLowerCase() ?? null;
  const season = textQuery(req, "season")?.toLowerCase() ?? null;
  const reporting = textQuery(req, "reporting_state")?.toUpperCase() ?? null;

  if (reporting && !["CURRENT", "LIMITED", "UNAVAILABLE"].includes(reporting)) {
    throw new Error("PRODUCT_REPORTING_FILTER_INVALID");
  }

  return fields
    .filter((field) => !search || (field.identity.display_name ?? "").toLowerCase().includes(search))
    .filter((field) => !crop || (field.identity.crop_display_name ?? "").toLowerCase() === crop)
    .filter((field) => !season || (
      (field.identity.season_display ?? "").toLowerCase() === season
      || (field.envelope.subject_scope.season_id ?? "").toLowerCase() === season
    ))
    .filter((field) => !reporting || field.reporting_state.state === reporting)
    .sort((a, b) => (a.identity.display_name ?? a.field_ref).localeCompare(b.identity.display_name ?? b.field_ref));
}

function normalizedFieldRef(value: unknown): string | null {
  const fieldRef = String(value ?? "").trim();
  if (!fieldRef || fieldRef.length > 128 || !/^[A-Za-z0-9_\-:.]+$/.test(fieldRef)) return null;
  return fieldRef;
}

export function registerProductCustomerV1Routes(app: FastifyInstance, pool: Pool): void {
  const builder = new CustomerProductProjectionBuilderV1(pool);

  app.get("/api/product/v1/overview", async (req, reply) => {
    const id = requestId();
    const auth = requireCustomerProductAuth(req, reply, "dashboard", id);
    if (!auth) return;

    const generatedAt = new Date().toISOString();
    try {
      const projection = await builder.buildCustomerOverview(auth.scope, generatedAt);
      reply.header("cache-control", "no-store");
      return reply.send(success(id, generatedAt, projection));
    } catch (error) {
      if (error instanceof ProductProjectionReadErrorV1) {
        return sendError(reply, 503, id, "PRODUCT_PROJECTION_SOURCE_UNAVAILABLE", "Product data is temporarily unavailable.", true);
      }
      req.log.error({ err: error, request_id: id }, "product overview projection failed");
      return sendError(reply, 503, id, "PRODUCT_PROJECTION_UNAVAILABLE", "Product data is temporarily unavailable.", true);
    }
  });

  app.get("/api/product/v1/fields", async (req, reply) => {
    const id = requestId();
    const auth = requireCustomerProductAuth(req, reply, "fields", id);
    if (!auth) return;

    const generatedAt = new Date().toISOString();
    try {
      const fields = await builder.buildFieldSummaries(auth.scope, generatedAt);
      const filtered = filterFields(req, fields);
      reply.header("cache-control", "no-store");
      return reply.send(success(id, generatedAt, { items: filtered }));
    } catch (error) {
      if (error instanceof Error && error.message === "PRODUCT_REPORTING_FILTER_INVALID") {
        return sendError(reply, 400, id, "PRODUCT_FILTER_INVALID", "The requested filter is invalid.", false);
      }
      if (error instanceof ProductProjectionReadErrorV1) {
        return sendError(reply, 503, id, "PRODUCT_PROJECTION_SOURCE_UNAVAILABLE", "Product data is temporarily unavailable.", true);
      }
      req.log.error({ err: error, request_id: id }, "product field list projection failed");
      return sendError(reply, 503, id, "PRODUCT_PROJECTION_UNAVAILABLE", "Product data is temporarily unavailable.", true);
    }
  });

  app.get("/api/product/v1/fields/:fieldRef", async (req, reply) => {
    const id = requestId();
    const fieldRef = normalizedFieldRef((req.params as { fieldRef?: unknown } | undefined)?.fieldRef);
    if (!fieldRef) return sendError(reply, 404, id, "NOT_FOUND", "The requested field was not found.", false);

    const auth = requireCustomerProductAuth(req, reply, "fields", id, true);
    if (!auth) return;
    if (!auth.scope.allowed_field_ids.includes(fieldRef)) {
      return sendError(reply, 404, id, "NOT_FOUND", "The requested field was not found.", false);
    }

    const generatedAt = new Date().toISOString();
    try {
      const projection = await builder.buildFieldWorkspace(auth.scope, fieldRef, generatedAt);
      if (!projection) return sendError(reply, 404, id, "NOT_FOUND", "The requested field was not found.", false);
      reply.header("cache-control", "no-store");
      return reply.send(success(id, generatedAt, projection));
    } catch (error) {
      if (error instanceof ProductProjectionReadErrorV1) {
        return sendError(reply, 503, id, "PRODUCT_PROJECTION_SOURCE_UNAVAILABLE", "Product data is temporarily unavailable.", true);
      }
      req.log.error({ err: error, request_id: id }, "product field workspace projection failed");
      return sendError(reply, 503, id, "PRODUCT_PROJECTION_UNAVAILABLE", "Product data is temporarily unavailable.", true);
    }
  });
}
