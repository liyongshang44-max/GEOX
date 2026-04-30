import type { FastifyInstance, FastifyReply } from "fastify";
import type { Pool } from "pg";

import { requireAoActAnyScopeV0 } from "../auth/ao_act_authz_v0.js";
import {
  getManagementZoneByIdV1,
  listManagementZonesByFieldV1,
  upsertManagementZoneV1,
} from "../domain/field/management_zone_v1.js";

type TenantTriple = {
  tenant_id: string;
  project_id: string;
  group_id: string;
};

function tenantFromBody(body: any): TenantTriple {
  return {
    tenant_id: String(body?.tenant_id ?? "").trim(),
    project_id: String(body?.project_id ?? "").trim(),
    group_id: String(body?.group_id ?? "").trim(),
  };
}

function tenantFromQuery(query: any): TenantTriple {
  return {
    tenant_id: String(query?.tenant_id ?? "").trim(),
    project_id: String(query?.project_id ?? "").trim(),
    group_id: String(query?.group_id ?? "").trim(),
  };
}

function requireTenantScope(reply: FastifyReply, tenant: TenantTriple): boolean {
  if (!tenant.tenant_id || !tenant.project_id || !tenant.group_id) {
    reply.status(400).send({ ok: false, error: "MISSING_TENANT_SCOPE" });
    return false;
  }
  return true;
}

function requireTenantMatchOr404(reply: FastifyReply, auth: TenantTriple, tenant: TenantTriple): boolean {
  if (auth.tenant_id !== tenant.tenant_id || auth.project_id !== tenant.project_id || auth.group_id !== tenant.group_id) {
    reply.status(404).send({ ok: false, error: "NOT_FOUND" });
    return false;
  }
  return true;
}

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

      const tenant = tenantFromBody(body);
      if (!requireTenantScope(reply, tenant)) return;
      if (!requireTenantMatchOr404(reply, auth, tenant)) return;

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

      const tenant = tenantFromQuery(query);
      if (!requireTenantScope(reply, tenant)) return;
      if (!requireTenantMatchOr404(reply, auth, tenant)) return;

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

      const tenant = tenantFromQuery(query);
      if (!requireTenantScope(reply, tenant)) return;
      if (!requireTenantMatchOr404(reply, auth, tenant)) return;

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
