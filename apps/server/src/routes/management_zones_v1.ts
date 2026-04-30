import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";

import { requireAoActAnyScopeV0 } from "../auth/ao_act_authz_v0.js";
import {
  requireFieldAllowedOr404V1,
  requireTenantMatchOr404V1,
  requireTenantScopeV1,
  tenantFromBodyOrAuthV1,
  tenantFromQueryOrAuthV1,
} from "../auth/tenant_scope_v1.js";
import {
  getManagementZoneByIdV1,
  listManagementZonesByFieldV1,
  upsertManagementZoneV1,
} from "../domain/field/management_zone_v1.js";

export function registerManagementZonesV1Routes(app: FastifyInstance, pool: Pool): void {
  app.post("/api/v1/fields/:field_id/zones", async (req, reply) => {
    // Temporary authorization compatibility: reuse AO-ACT write scope; Step10 can split field.zone.write.
    const auth = requireAoActAnyScopeV0(req, reply, ["field.zone.write", "ao_act.task.write"]);
    if (!auth) return;

    try {
      const params: any = req.params ?? {};
      const body: any = req.body ?? {};
      const field_id = String(params?.field_id ?? "").trim();
      if (!field_id) return reply.status(400).send({ ok: false, error: "MISSING_FIELD_ID" });

      const tenant = tenantFromBodyOrAuthV1(body, auth);
      if (!requireTenantScopeV1(reply, tenant)) return;
      if (!requireTenantMatchOr404V1(reply, auth, tenant)) return;
      if (!requireFieldAllowedOr404V1(reply, auth, field_id)) return;

      const zone = await upsertManagementZoneV1(pool, {
        zone_id: body?.zone_id,
        tenant_id: tenant.tenant_id,
        project_id: tenant.project_id,
        group_id: tenant.group_id,
        field_id,
        zone_name: body?.zone_name,
        zone_type: body?.zone_type,
        geometry: body?.geometry,
        area_ha: body?.area_ha,
        risk_tags: body?.risk_tags,
        agronomy_tags: body?.agronomy_tags,
        source_refs: body?.source_refs,
      });

      return reply.send({
        ok: true,
        zone: {
          zone_id: zone.zone_id,
          tenant_id: zone.tenant_id,
          project_id: zone.project_id,
          group_id: zone.group_id,
          field_id: zone.field_id,
          zone_type: zone.zone_type,
        },
      });
    } catch (error: any) {
      return reply.status(400).send({ ok: false, error: String(error?.message ?? error ?? "INVALID_REQUEST") });
    }
  });

  app.get("/api/v1/fields/:field_id/zones", async (req, reply) => {
    // Temporary authorization compatibility: reuse AO-ACT read scope; Step10 can split field.zone.read.
    const auth = requireAoActAnyScopeV0(req, reply, ["field.zone.read", "ao_act.index.read"]);
    if (!auth) return;

    try {
      const params: any = req.params ?? {};
      const query: any = req.query ?? {};
      const field_id = String(params?.field_id ?? "").trim();
      if (!field_id) return reply.status(400).send({ ok: false, error: "MISSING_FIELD_ID" });

      const tenant = tenantFromQueryOrAuthV1(query, auth);
      if (!requireTenantScopeV1(reply, tenant)) return;
      if (!requireTenantMatchOr404V1(reply, auth, tenant)) return;
      if (!requireFieldAllowedOr404V1(reply, auth, field_id)) return;

      const items = await listManagementZonesByFieldV1(pool, {
        ...tenant,
        field_id,
      });

      return reply.send({ ok: true, field_id, items });
    } catch (error: any) {
      return reply.status(400).send({ ok: false, error: String(error?.message ?? error ?? "INVALID_REQUEST") });
    }
  });

  app.get("/api/v1/fields/:field_id/zones/:zone_id", async (req, reply) => {
    // Temporary authorization compatibility: reuse AO-ACT read scope; Step10 can split field.zone.read.
    const auth = requireAoActAnyScopeV0(req, reply, ["field.zone.read", "ao_act.index.read"]);
    if (!auth) return;

    try {
      const params: any = req.params ?? {};
      const query: any = req.query ?? {};
      const field_id = String(params?.field_id ?? "").trim();
      const zone_id = String(params?.zone_id ?? "").trim();
      if (!field_id) return reply.status(400).send({ ok: false, error: "MISSING_FIELD_ID" });
      if (!zone_id) return reply.status(400).send({ ok: false, error: "MISSING_ZONE_ID" });

      const tenant = tenantFromQueryOrAuthV1(query, auth);
      if (!requireTenantScopeV1(reply, tenant)) return;
      if (!requireTenantMatchOr404V1(reply, auth, tenant)) return;
      if (!requireFieldAllowedOr404V1(reply, auth, field_id)) return;

      const zone = await getManagementZoneByIdV1(pool, {
        ...tenant,
        field_id,
        zone_id,
      });
      if (!zone) return reply.status(404).send({ ok: false, error: "NOT_FOUND" });
      return reply.send({ ok: true, zone });
    } catch (error: any) {
      return reply.status(400).send({ ok: false, error: String(error?.message ?? error ?? "INVALID_REQUEST") });
    }
  });
}
