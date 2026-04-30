import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { requireAoActAnyScopeV0 } from "../auth/ao_act_authz_v0.js";
import { requireTenantMatchOr404V1, tenantFromQueryOrAuthV1 } from "../auth/tenant_scope_v1.js";

export function registerSecurityAuditV1Routes(app: FastifyInstance, pool: Pool): void {
  app.get('/api/v1/security/audit-events', async (req, reply) => {
    const auth = requireAoActAnyScopeV0(req, reply, ['security.audit.read']);
    if (!auth) return;
    const q: any = req.query ?? {};
    const tenant = tenantFromQueryOrAuthV1(q, auth);
    if (!requireTenantMatchOr404V1(reply, auth, tenant)) return;
    const limit = Math.min(500, Math.max(1, Number(q.limit ?? 50) || 50));
    const rows = await pool.query(`SELECT * FROM security_audit_event_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3
      AND ($4::text IS NULL OR actor_id=$4) AND ($5::text IS NULL OR token_id=$5) AND ($6::text IS NULL OR action=$6)
      AND ($7::text IS NULL OR target_type=$7) AND ($8::text IS NULL OR target_id=$8) AND ($9::text IS NULL OR field_id=$9)
      AND ($10::text IS NULL OR result=$10) ORDER BY occurred_at DESC LIMIT $11`,
      [tenant.tenant_id, tenant.project_id, tenant.group_id, q.actor_id ?? null, q.token_id ?? null, q.action ?? null, q.target_type ?? null, q.target_id ?? null, q.field_id ?? null, q.result ?? null, limit]);
    return reply.send({ ok: true, items: rows.rows ?? [] });
  });

  app.get('/api/v1/security/audit-events/:audit_event_id', async (req, reply) => {
    const auth = requireAoActAnyScopeV0(req, reply, ['security.audit.read']);
    if (!auth) return;
    const p: any = req.params ?? {};
    const q: any = req.query ?? {};
    const tenant = tenantFromQueryOrAuthV1(q, auth);
    if (!requireTenantMatchOr404V1(reply, auth, tenant)) return;
    const r = await pool.query(`SELECT * FROM security_audit_event_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND audit_event_id=$4 LIMIT 1`,
      [tenant.tenant_id, tenant.project_id, tenant.group_id, String(p.audit_event_id ?? '')]);
    if (!r.rows?.length) return reply.status(404).send({ ok: false, error: 'NOT_FOUND' });
    return reply.send({ ok: true, item: r.rows[0] });
  });
}
