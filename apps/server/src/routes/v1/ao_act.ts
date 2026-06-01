import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";

import { registerAoActV1Routes } from "../control_ao_act.js";

const FORMAL_OPERATION_FIELD_BINDING_ERROR_V1 = "NEEDS_FIELD_BINDING";
const FORMAL_OPERATION_FIELD_BINDING_MESSAGE_V1 = "正式农业作业必须绑定地块或明确空间范围";
const FORMAL_AGRICULTURAL_ACTION_TYPES_V1 = new Set(["PLOW", "HARROW", "SEED", "SPRAY", "IRRIGATE", "FERTILIZE", "HARVEST", "INSPECT", "SAMPLE", "CHECK_FIELD_STATUS", "PEST_CONTROL"]);

function normalizeId(value: unknown): string {
  const raw = String(value ?? "").trim();
  if (!raw || raw === "..." || raw === "undefined" || raw === "null") return "";
  if (raw.length > 128) return "";
  return /^[A-Za-z0-9_\-:.]+$/.test(raw) ? raw : "";
}

function validFieldId(value: unknown): boolean {
  return Boolean(normalizeId(value));
}

function spatialScopeOf(body: any): any {
  return body?.spatial_scope ?? body?.meta?.spatial_scope ?? body?.meta?.variable_plan?.spatial_scope ?? null;
}

function fieldIdFromSpatialScope(scope: any): string {
  if (!scope || typeof scope !== "object") return "";
  const kind = String(scope.kind ?? "").trim().toLowerCase();
  if (!kind || kind === "aggregate_only") return "";
  if (!["field", "management_zone", "prescription_zone", "device_affected_fields"].includes(kind)) return "";
  const direct = normalizeId(scope.field_id);
  if (direct) return direct;
  if (Array.isArray(scope.field_ids)) {
    for (const fieldId of scope.field_ids) {
      const next = normalizeId(fieldId);
      if (next) return next;
    }
  }
  return "";
}

function spatialScopeHasExplicitFieldBinding(scope: any): boolean {
  return Boolean(fieldIdFromSpatialScope(scope));
}

function normalizeExplicitFieldBinding(body: any): void {
  if (!body || typeof body !== "object") return;
  const scope = spatialScopeOf(body);
  const scopeFieldId = fieldIdFromSpatialScope(scope);
  if (scope && typeof scope === "object") {
    body.meta = body.meta && typeof body.meta === "object" ? body.meta : {};
    body.meta.spatial_scope = scope;
  }
  if (!validFieldId(body.field_id) && !validFieldId(body?.meta?.field_id) && scopeFieldId) {
    body.field_id = scopeFieldId;
  }
}

function hasExplicitFieldBinding(body: any): boolean {
  const scope = spatialScopeOf(body);
  return Boolean(validFieldId(body?.field_id) || validFieldId(body?.meta?.field_id) || spatialScopeHasExplicitFieldBinding(scope));
}

function isFormalAgriculturalTask(body: any): boolean {
  const actionType = String(body?.action_type ?? body?.meta?.action_type ?? body?.meta?.operation_type ?? "").trim().toUpperCase();
  if (FORMAL_AGRICULTURAL_ACTION_TYPES_V1.has(actionType)) return true;
  const operationType = String(body?.operation_type ?? body?.meta?.operation_type ?? body?.meta?.task_type ?? "").trim().toUpperCase();
  return FORMAL_AGRICULTURAL_ACTION_TYPES_V1.has(operationType);
}

// AO-ACT v1 primary routes.
// New business endpoints must be registered here, not under legacy prefixes.
export function registerAoActV1PrimaryRoutes(app: FastifyInstance, pool: Pool): void {
  app.addHook("preValidation", async (req, reply) => {
    const path = String((req as any).url ?? "").split("?")[0] ?? "";
    if (String((req as any).method ?? "").toUpperCase() !== "POST") return;
    if (path !== "/api/v1/actions/task" && path !== "/api/v1/actions/task/from-variable-prescription") return;
    const body = ((req as any).body ?? {}) as any;
    if (!isFormalAgriculturalTask(body)) return;
    normalizeExplicitFieldBinding(body);
    if (hasExplicitFieldBinding(body)) return;
    reply.status(422).send({ ok: false, error: FORMAL_OPERATION_FIELD_BINDING_ERROR_V1, message: FORMAL_OPERATION_FIELD_BINDING_MESSAGE_V1 });
  });
  registerAoActV1Routes(app, pool);
}
