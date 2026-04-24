import { randomUUID } from "node:crypto";
import type { Pool } from "pg";
import type { AoActAuthContextV0 } from "../../auth/ao_act_authz_v0.js";

export type TenantTriple = {
  tenant_id: string;
  project_id: string;
  group_id: string;
};

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

function hasMeaningfulIssuer(v: unknown): boolean {
  if (isNonEmptyString(v)) return true;
  if (v && typeof v === "object") {
    const id = String((v as any).id ?? "").trim();
    return id.length > 0;
  }
  return false;
}

function hasMeaningfulTarget(v: unknown): boolean {
  if (isNonEmptyString(v)) return true;
  if (v && typeof v === "object") {
    const ref = String((v as any).ref ?? "").trim();
    return ref.length > 0;
  }
  return false;
}

export function assertTenantTriple(body: any): TenantTriple {
  const t = String(body?.tenant_id ?? "");
  const p = String(body?.project_id ?? "");
  const g = String(body?.group_id ?? "");
  if (!t.trim()) throw new Error("MISSING_OR_INVALID:tenant_id");
  if (!p.trim()) throw new Error("MISSING_OR_INVALID:project_id");
  if (!g.trim()) throw new Error("MISSING_OR_INVALID:group_id");
  return { tenant_id: t.trim(), project_id: p.trim(), group_id: g.trim() };
}

export function requireTenantMatchOr404(auth: TenantTriple, target: TenantTriple, reply: any): boolean {
  if (auth.tenant_id !== target.tenant_id || auth.project_id !== target.project_id || auth.group_id !== target.group_id) {
    reply.status(404).send({ ok: false, error: "NOT_FOUND" });
    return false;
  }
  return true;
}

export function validateApprovalRequestBody(body: any): void {
  const required = ["issuer", "action_type", "target", "time_window", "parameter_schema", "parameters", "constraints"];
  for (const k of required) {
    if (body[k] === undefined) throw new Error(`MISSING_FIELD:${k}`);
  }

  if (!hasMeaningfulIssuer(body.issuer)) throw new Error("MISSING_OR_INVALID:issuer");
  if (!isNonEmptyString(body.action_type)) throw new Error("MISSING_OR_INVALID:action_type");
  if (!hasMeaningfulTarget(body.target)) throw new Error("MISSING_OR_INVALID:target");

  const win = body.time_window;
  if (win === null || typeof win !== "object") throw new Error("MISSING_OR_INVALID:time_window");
  const start_ts = Number(win.start_ts);
  const end_ts = Number(win.end_ts);
  if (!Number.isFinite(start_ts) || !Number.isFinite(end_ts)) throw new Error("MISSING_OR_INVALID:time_window");
  if (start_ts > end_ts) throw new Error("TIME_WINDOW_INVALID");
}

export async function createApprovalRequestV1(pool: Pool, auth: AoActAuthContextV0, body: any): Promise<{ ok: true; fact_id: string; request_id: string }> {
  validateApprovalRequestBody(body);
  const tenant = assertTenantTriple(body);

  const request_id = `apr_${randomUUID().replace(/-/g, "")}`;
  const created_at_ts = Date.now();
  const start_ts = Number(body.time_window.start_ts);
  const end_ts = Number(body.time_window.end_ts);

  const record_json = {
    type: "approval_request_v1",
    payload: {
      tenant_id: tenant.tenant_id,
      project_id: tenant.project_id,
      group_id: tenant.group_id,
      program_id: body.program_id ?? body.meta?.program_id ?? null,
      field_id: body.field_id ?? body.meta?.field_id ?? body.target?.ref ?? null,
      season_id: body.season_id ?? body.meta?.season_id ?? null,
      request_id,
      status: "PENDING",
      actor_id: auth.actor_id,
      token_id: auth.token_id,
      created_at_ts,
      proposal: {
        issuer: body.issuer,
        action_type: body.action_type,
        target: body.target,
        time_window: { start_ts, end_ts },
        parameter_schema: body.parameter_schema,
        parameters: body.parameters,
        constraints: body.constraints,
        meta: body.meta ?? null,
      },
    },
  };

  const fact_id = randomUUID();
  await pool.query(
    "INSERT INTO facts (fact_id, occurred_at, source, record_json) VALUES ($1, NOW(), $2, $3::jsonb)",
    [fact_id, "api/v1/approvals/request", record_json],
  );

  return { ok: true, fact_id, request_id };
}
