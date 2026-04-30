import { randomUUID } from "node:crypto";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { Pool } from "pg";

export type SecurityAuditResultV1 = "ALLOW" | "DENY" | "ERROR";
export type SecurityAuditEventInputV1 = { tenant_id: string; project_id: string; group_id: string; actor_id?: string | null; token_id?: string | null; role?: string | null; action: string; target_type: string; target_id?: string | null; field_id?: string | null; request_id?: string | null; route?: string | null; method?: string | null; result: SecurityAuditResultV1; reason?: string | null; error_code?: string | null; source: string; metadata?: Record<string, unknown>; occurred_at?: number; };

export async function recordSecurityAuditEventV1(pool: Pool, input: SecurityAuditEventInputV1): Promise<{ audit_event_id: string }> {
  if (!input.tenant_id || !input.project_id || !input.group_id || !input.action || !input.target_type) throw new Error("SECURITY_AUDIT_INVALID_INPUT");
  if (!["ALLOW", "DENY", "ERROR"].includes(input.result)) throw new Error("SECURITY_AUDIT_INVALID_RESULT");
  const metadata = input.metadata && typeof input.metadata === "object" && !Array.isArray(input.metadata) ? input.metadata : {};
  const audit_event_id = `aud_${randomUUID().replace(/-/g, "")}`;
  await pool.query(`INSERT INTO security_audit_event_v1 (audit_event_id,tenant_id,project_id,group_id,actor_id,token_id,role,action,target_type,target_id,field_id,request_id,route,method,result,reason,error_code,source,metadata,occurred_at)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19::jsonb,$20)`,
    [audit_event_id, input.tenant_id, input.project_id, input.group_id, input.actor_id ?? null, input.token_id ?? null, input.role ?? null, input.action, input.target_type, input.target_id ?? null, input.field_id ?? null, input.request_id ?? null, input.route ?? null, input.method ?? null, input.result, input.reason ?? null, input.error_code ?? null, input.source, JSON.stringify(metadata), input.occurred_at ?? Date.now()]);
  return { audit_event_id };
}

export function auditContextFromRequestV1(req: FastifyRequest, auth?: any) {
  return { actor_id: String(auth?.actor_id ?? "").trim() || null, token_id: String(auth?.token_id ?? "").trim() || null, role: String(auth?.role ?? "").trim() || null, request_id: String((req as any).id ?? "").trim() || null, route: String((req as any).routerPath ?? req.url ?? "").trim() || null, method: String(req.method ?? "").trim() || null };
}

export async function denyWithAuditV1(reply: FastifyReply, pool: Pool, input: Omit<SecurityAuditEventInputV1, "result" | "error_code">, httpStatus: number, errorCode: string) {
  await recordSecurityAuditEventV1(pool, { ...input, result: "DENY", error_code: errorCode });
  return reply.status(httpStatus).send({ ok: false, error: errorCode });
}
