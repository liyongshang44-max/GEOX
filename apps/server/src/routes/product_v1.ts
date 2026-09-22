// GEOX FOUI Product API Wave-02 — canonical Customer Product Projection HTTP surface.
//
// Purpose: expose the first read-only /api/product/v1/* routes.
// Boundary: HTTP/auth/transport only. No SQL, no legacy Customer API dependency, no command methods.

import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { Pool } from "pg";
import { semanticHashV1 } from "../domain/twin_runtime/canonical_json_v1.js";
import {
  enforceFieldScopeOrDeny,
  enforceRouteRoleAuth,
} from "../auth/route_role_authz.js";
import { resolveCustomerScope } from "../services/customer/customer_scope_v1.js";
import {
  CUSTOMER_PRODUCT_PROJECTION_DERIVATION_VERSION_V1,
  PRODUCT_API_RESPONSE_SCHEMA_V1,
  type CustomerOverviewProjectionV1,
  type FieldSummaryProjectionV1,
  type FieldWorkspaceProjectionV1,
  type ProductApiCollectionResponseV1,
  type ProductApiSingleResponseV1,
} from "../product_projection/customer/customer_product_projection_contracts_v1.js";
import {
  CustomerProductProjectionReadErrorV1,
  PostgresCustomerProductProjectionBuilderV1,
  type CustomerProductReadScopeV1,
} from "../product_projection/customer/customer_product_projection_builder_v1.js";

export const PRODUCT_API_V1_BASE = "/api/product/v1" as const;

export interface CustomerProductProjectionReadBuilderV1 {
  buildCustomerOverviewV1(scope: CustomerProductReadScopeV1): Promise<CustomerOverviewProjectionV1>;
  buildFieldSummariesV1(scope: CustomerProductReadScopeV1): Promise<FieldSummaryProjectionV1[]>;
  buildFieldWorkspaceV1(scope: CustomerProductReadScopeV1, fieldRef: string): Promise<FieldWorkspaceProjectionV1>;
}

export type RegisterProductV1RoutesOptions = {
  builder?: CustomerProductProjectionReadBuilderV1;
};

function readScopeV1(
  request: FastifyRequest,
  reply: FastifyReply,
  resource: "dashboard" | "fields",
): CustomerProductReadScopeV1 | null {
  const auth = enforceRouteRoleAuth(request, reply, resource);
  if (!auth) return null;
  const customerScope = resolveCustomerScope(auth);
  if (customerScope.scope_mode === "DENIED") {
    reply.status(403).send({
      schema_version: "geox.product-api.error.v1",
      error: "PRODUCT_SCOPE_DENIED",
      request_id: String(request.id ?? "unknown"),
    });
    return null;
  }
  return {
    tenant_id: String(auth.tenant_id),
    project_id: String(auth.project_id),
    group_id: String(auth.group_id),
    allowed_field_ids: customerScope.allowed_field_ids,
    can_preview_all_fields: customerScope.can_preview_all_fields,
  };
}

function etagV1(value: unknown): string {
  return `"${semanticHashV1(value)}"`;
}

function sendWithEtagV1(
  request: FastifyRequest,
  reply: FastifyReply,
  body: unknown,
  etagBasis: unknown,
): void {
  const etag = etagV1(etagBasis);
  reply.header("cache-control", "private, no-cache, must-revalidate");
  reply.header("etag", etag);
  reply.header("x-geox-product-contract", "FOUI_PRODUCT_PROJECTION");
  reply.header("x-geox-product-authority-ceiling", "NON_AUTHORITATIVE_PRODUCT_PROJECTION_ONLY");
  reply.header("x-geox-product-derivation-version", CUSTOMER_PRODUCT_PROJECTION_DERIVATION_VERSION_V1);
  if (String(request.headers["if-none-match"] ?? "") === etag) {
    reply.code(304).send();
    return;
  }
  reply.code(200).send(body);
}

function singleResponseV1<T extends { envelope: { generated_at: string } }>(
  request: FastifyRequest,
  projection: T,
): ProductApiSingleResponseV1<T> {
  return {
    schema_version: PRODUCT_API_RESPONSE_SCHEMA_V1,
    request_id: String(request.id ?? "unknown"),
    generated_at: projection.envelope.generated_at,
    derivation_version: CUSTOMER_PRODUCT_PROJECTION_DERIVATION_VERSION_V1,
    projection,
  };
}

function collectionResponseV1(
  request: FastifyRequest,
  items: readonly FieldSummaryProjectionV1[],
): ProductApiCollectionResponseV1<FieldSummaryProjectionV1> {
  const generatedAt = items[0]?.envelope.generated_at ?? new Date().toISOString();
  return {
    schema_version: PRODUCT_API_RESPONSE_SCHEMA_V1,
    request_id: String(request.id ?? "unknown"),
    generated_at: generatedAt,
    derivation_version: CUSTOMER_PRODUCT_PROJECTION_DERIVATION_VERSION_V1,
    items,
    count: items.length,
    limitation_reason_codes: Array.from(new Set(items.flatMap((item) => item.limitation_reason_codes))).sort(),
  };
}

function mapProductReadErrorV1(error: unknown): CustomerProductProjectionReadErrorV1 {
  if (error instanceof CustomerProductProjectionReadErrorV1) return error;
  const code = String((error as { code?: unknown })?.code ?? "");
  if (code === "42501" || code === "28P01") {
    return new CustomerProductProjectionReadErrorV1("PRODUCT_DATABASE_READ_AUTHORITY_UNAVAILABLE", 503);
  }
  if (code) return new CustomerProductProjectionReadErrorV1("PRODUCT_READ_UNAVAILABLE", 503, code);
  return new CustomerProductProjectionReadErrorV1("PRODUCT_READ_UNAVAILABLE", 503);
}

function sendProductErrorV1(
  request: FastifyRequest,
  reply: FastifyReply,
  error: unknown,
): void {
  const mapped = mapProductReadErrorV1(error);
  if (mapped.statusCode >= 500) {
    request.log.error({ err: error, request_id: request.id }, "Product API read failed");
  }
  reply.header("cache-control", "no-store");
  reply.code(mapped.statusCode).send({
    schema_version: "geox.product-api.error.v1",
    error: mapped.code,
    request_id: String(request.id ?? "unknown"),
  });
}

export function registerProductV1Routes(
  app: FastifyInstance,
  pool: Pool,
  options: RegisterProductV1RoutesOptions = {},
): void {
  const builder = options.builder ?? new PostgresCustomerProductProjectionBuilderV1(pool);

  app.get(`${PRODUCT_API_V1_BASE}/overview`, async (request, reply) => {
    try {
      const scope = readScopeV1(request, reply, "dashboard");
      if (!scope) return;
      const projection = await builder.buildCustomerOverviewV1(scope);
      const body = singleResponseV1(request, projection);
      sendWithEtagV1(request, reply, body, projection.envelope.projection_id);
    } catch (error) {
      sendProductErrorV1(request, reply, error);
    }
  });

  app.get(`${PRODUCT_API_V1_BASE}/fields`, async (request, reply) => {
    try {
      const scope = readScopeV1(request, reply, "fields");
      if (!scope) return;
      const items = await builder.buildFieldSummariesV1(scope);
      const body = collectionResponseV1(request, items);
      sendWithEtagV1(
        request,
        reply,
        body,
        items.map((item) => item.envelope.projection_id),
      );
    } catch (error) {
      sendProductErrorV1(request, reply, error);
    }
  });

  app.get(`${PRODUCT_API_V1_BASE}/fields/:fieldRef`, async (request, reply) => {
    try {
      const auth = enforceRouteRoleAuth(request, reply, "fields");
      if (!auth) return;
      const customerScope = resolveCustomerScope(auth);
      if (customerScope.scope_mode === "DENIED") {
        reply.status(404).send({
          schema_version: "geox.product-api.error.v1",
          error: "NOT_FOUND",
          request_id: String(request.id ?? "unknown"),
        });
        return;
      }
      const fieldRef = String((request.params as { fieldRef?: unknown })?.fieldRef ?? "").trim();
      if (!fieldRef || !enforceFieldScopeOrDeny(auth, fieldRef, reply, { asNotFound: true })) return;
      const scope: CustomerProductReadScopeV1 = {
        tenant_id: String(auth.tenant_id),
        project_id: String(auth.project_id),
        group_id: String(auth.group_id),
        allowed_field_ids: customerScope.allowed_field_ids,
        can_preview_all_fields: customerScope.can_preview_all_fields,
      };
      const projection = await builder.buildFieldWorkspaceV1(scope, fieldRef);
      const body = singleResponseV1(request, projection);
      sendWithEtagV1(request, reply, body, projection.envelope.projection_id);
    } catch (error) {
      sendProductErrorV1(request, reply, error);
    }
  });
}
