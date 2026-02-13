// GEOX/apps/server/src/routes/control_approval_request_v1.ts

import type { FastifyInstance } from "fastify"; // Fastify instance typing.
import type { Pool } from "pg"; // Postgres pool typing.
import { randomUUID } from "node:crypto"; // Generate UUIDs for request/decision ids.

import { requireAoActScopeV0 } from "../auth/ao_act_authz_v0"; // Reuse AO-ACT token/scope auth for Sprint 25 approval runtime.

type TenantTriple = {
  tenant_id: string; // Tenant isolation SSOT field.
  project_id: string; // Project isolation SSOT field.
  group_id: string; // Group isolation SSOT field.
};

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0; // Non-empty string guard.
}

function badRequest(reply: any, error: string) {
  return reply.status(400).send({ ok: false, error }); // Deterministic 400 shape.
}

function parseLimit(v: any, def: number, max: number): number {
  const n = Number(v);
  if (!Number.isFinite(n) || Math.floor(n) !== n) return def;
  if (n <= 0) return def;
  return Math.min(n, max);
}

function assertTenantTriple(body: any): TenantTriple {
  const t = String(body?.tenant_id ?? "");
  const p = String(body?.project_id ?? "");
  const g = String(body?.group_id ?? "");
  if (!t.trim()) throw new Error("MISSING_OR_INVALID:tenant_id");
  if (!p.trim()) throw new Error("MISSING_OR_INVALID:project_id");
  if (!g.trim()) throw new Error("MISSING_OR_INVALID:group_id");
  return { tenant_id: t.trim(), project_id: p.trim(), group_id: g.trim() };
}

function requireTenantMatchOr404(auth: TenantTriple, target: TenantTriple, reply: any): boolean {
  if (auth.tenant_id !== target.tenant_id || auth.project_id !== target.project_id || auth.group_id !== target.group_id) {
    reply.status(404).send({ ok: false, error: "NOT_FOUND" });
    return false;
  }
  return true;
}

function normalizeAoActIssuer(auth: any, proposalIssuer: any): any {
  // AO-ACT contract requires issuer as an object {kind:'human', id, namespace}.
  // We bind issuer.id to the authenticated actor_id for auditability; proposalIssuer is kept only as proposal text.
  const id = String(auth?.actor_id ?? auth?.token_id ?? "unknown").trim() || "unknown";
  return { kind: "human", id, namespace: "approval_request_v1" };
}

function normalizeAoActTarget(proposalTarget: any): any {
  // Accept "field:XYZ" / "area:XYZ" / "path:XYZ" strings; fallback to kind='field'.
  const s = String(proposalTarget ?? "").trim();
  const m = /^([a-zA-Z]+)\:(.+)$/.exec(s);
  if (m) {
    const k = m[1].toLowerCase();
    const ref = String(m[2]).trim();
    const kind = (k === "field" || k === "area" || k === "path") ? k : "field";
    return { kind, ref: ref || s };
  }
  // If already object-like, try to preserve.
  if (proposalTarget && typeof proposalTarget === "object") {
    const kind = String((proposalTarget as any).kind ?? "field");
    const ref = String((proposalTarget as any).ref ?? "");
    if (ref.trim()) return { kind, ref: ref.trim() };
  }
  return { kind: "field", ref: s || "unknown" };
}

function normalizeAoActParameterSchema(parameters: any, proposalSchema: any): any {
  // AO-ACT contract requires parameter_schema.keys as array of {name,type,...}.
  // We derive from parameters when possible; if proposalSchema already matches, pass through.
  const keysFromProposal = proposalSchema?.keys;
  if (Array.isArray(keysFromProposal) && keysFromProposal.length > 0 && typeof keysFromProposal[0] === "object") {
    return { keys: keysFromProposal };
  }
  const paramsObj = (parameters && typeof parameters === "object") ? parameters : {};
  const keys: any[] = [];
  for (const [name, v] of Object.entries(paramsObj)) {
    if (!String(name).trim()) continue;
    const t = typeof v;
    if (t === "number") keys.push({ name, type: "number" });
    else if (t === "boolean") keys.push({ name, type: "boolean" });
    else keys.push({ name, type: "enum", enum: [String(v)] });
  }
  if (keys.length < 1) {
    // Minimal fallback to satisfy schema; parameters should have been non-empty upstream.
    keys.push({ name: "dry_run", type: "boolean" });
  }
  return { keys };
}

function normalizeAoActConstraints(c: any): any {
  // AO-ACT contract expects constraints as object map; approval_request may store array.
  if (c && typeof c === "object" && !Array.isArray(c)) return c;
  return {};
}

function normalizeAoActMeta(m: any): any {
  // AO-ACT contract expects meta as object when provided.
  if (m && typeof m === "object" && !Array.isArray(m)) return m;
  return {};
}

function parseRecordJsonMaybe(v: any): any {
  // pg may return jsonb as string depending on type parser configuration; accept both.
  if (v && typeof v === "object") return v;
  if (typeof v === "string") {
    try { return JSON.parse(v); } catch { return null; }
  }
  return null;
}


export function registerControlApprovalRequestV1Routes(app: FastifyInstance, pool: Pool) {
  // POST /api/control/approval_request/v1/request
  // Creates approval_request_v1 fact (append-only). This is Sprint 25's "human-in-the-loop" runtime.
  app.post("/api/control/approval_request/v1/request", async (req, reply) => {
    try {
      const auth = requireAoActScopeV0(req, reply, "ao_act.task.write"); // Approval write requires the ability to write tasks.
      if (!auth) return;

      const body: any = req.body ?? {};
      const tenant = assertTenantTriple(body);
      if (!requireTenantMatchOr404(auth, tenant, reply)) return;

      // Minimal required proposal fields mirror AO-ACT task input.
      const required = ["issuer", "action_type", "target", "time_window", "parameter_schema", "parameters", "constraints"];
      for (const k of required) {
        if (body[k] === undefined) return badRequest(reply, `MISSING_FIELD:${k}`);
      }

      if (!isNonEmptyString(body.issuer)) return badRequest(reply, "MISSING_OR_INVALID:issuer");
      if (!isNonEmptyString(body.action_type)) return badRequest(reply, "MISSING_OR_INVALID:action_type");
      if (!isNonEmptyString(body.target)) return badRequest(reply, "MISSING_OR_INVALID:target");

      const win = body.time_window;
      if (win === null || typeof win !== "object") return badRequest(reply, "MISSING_OR_INVALID:time_window");
      const start_ts = Number(win.start_ts);
      const end_ts = Number(win.end_ts);
      if (!Number.isFinite(start_ts) || !Number.isFinite(end_ts)) return badRequest(reply, "MISSING_OR_INVALID:time_window");
      if (start_ts > end_ts) return badRequest(reply, "TIME_WINDOW_INVALID");

      const request_id = `apr_${randomUUID().replace(/-/g, "")}`;
      const created_at_ts = Date.now();

      const record_json = {
        type: "approval_request_v1",
        payload: {
          tenant_id: tenant.tenant_id,
          project_id: tenant.project_id,
          group_id: tenant.group_id,
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
            meta: body.meta ?? null
          }
        }
      };

      const fact_id = randomUUID();
      await pool.query(
        "INSERT INTO facts (fact_id, occurred_at, source, record_json) VALUES ($1, NOW(), $2, $3::jsonb)",
        [fact_id, "api/control/approval_request/v1", record_json]
      );

      return reply.send({ ok: true, fact_id, request_id });
    } catch (e: any) {
      return reply.status(400).send({ ok: false, error: e?.message ?? "BAD_REQUEST" });
    }
  });

  // GET /api/control/approval_request/v1/requests
  // Lists approval_request_v1 facts for a tenant triple.
  app.get("/api/control/approval_request/v1/requests", async (req, reply) => {
    const auth = requireAoActScopeV0(req, reply, "ao_act.index.read");
    if (!auth) return;

    const q: any = (req as any).query ?? {};
    const tenant: TenantTriple = {
      tenant_id: isNonEmptyString(q.tenant_id) ? q.tenant_id : "",
      project_id: isNonEmptyString(q.project_id) ? q.project_id : "",
      group_id: isNonEmptyString(q.group_id) ? q.group_id : ""
    };
    if (!tenant.tenant_id || !tenant.project_id || !tenant.group_id) return badRequest(reply, "MISSING_TENANT_TRIPLE");
    if (!requireTenantMatchOr404(auth, tenant, reply)) return;

    const limit = parseLimit(q.limit, 20, 200);

    const sql = `
      SELECT fact_id, occurred_at, source, record_json
      FROM facts
      WHERE (record_json::jsonb->>'type') = 'approval_request_v1'
        AND (record_json::jsonb->'payload'->>'tenant_id') = $1
        AND (record_json::jsonb->'payload'->>'project_id') = $2
        AND (record_json::jsonb->'payload'->>'group_id') = $3
      ORDER BY occurred_at DESC
      LIMIT $4
    `;

    const res = await pool.query(sql, [tenant.tenant_id, tenant.project_id, tenant.group_id, limit]);
    const items = (res.rows ?? []).map((r: any) => ({
      fact_id: r.fact_id,
      occurred_at: r.occurred_at,
      source: r.source,
      record_json: parseRecordJsonMaybe(r.record_json) ?? r.record_json
    }));

    return reply.send({ ok: true, items });
  });

  // POST /api/control/approval_request/v1/approve
  // Approves an existing request and issues an AO-ACT task via the existing AO-ACT endpoint (preserves AO-ACT audit behavior).
  app.post("/api/control/approval_request/v1/approve", async (req, reply) => {
    try {
      const auth = requireAoActScopeV0(req, reply, "ao_act.task.write");
      if (!auth) return;

      const body: any = req.body ?? {};
      if (!isNonEmptyString(body.request_id)) return badRequest(reply, "MISSING_OR_INVALID:request_id");
      const request_id = body.request_id;

      // Load request fact.
      const res = await pool.query(
        `
        SELECT fact_id, record_json
        FROM facts
        WHERE (record_json::jsonb->>'type') = 'approval_request_v1'
          AND (record_json::jsonb->'payload'->>'request_id') = $1
        ORDER BY occurred_at DESC
        LIMIT 1
        `,
        [request_id]
      );
      if (!res.rows || res.rows.length < 1) return reply.status(404).send({ ok: false, error: "NOT_FOUND" });

      const recRaw = res.rows[0].record_json;
      const rec = parseRecordJsonMaybe(recRaw);
      const payload = rec?.payload ?? null;
      if (!payload) return reply.status(500).send({ ok: false, error: "REQUEST_RECORD_INVALID" });

      const tenant: TenantTriple = {
        tenant_id: String(payload.tenant_id ?? ""),
        project_id: String(payload.project_id ?? ""),
        group_id: String(payload.group_id ?? "")
      };
      if (!requireTenantMatchOr404(auth, tenant, reply)) return;

      if (String(payload.status ?? "") !== "PENDING") {
        return badRequest(reply, "REQUEST_NOT_PENDING");
      }

      const proposal = payload.proposal ?? null;
      if (!proposal) return reply.status(500).send({ ok: false, error: "REQUEST_RECORD_INVALID" });

      // Issue AO-ACT task by calling the existing endpoint with the same Authorization header.
      const host = String((req.headers as any).host ?? "127.0.0.1:3000");
      const url = `http://${host}/api/control/ao_act/task`;
      const authz = String((req.headers as any)["authorization"] ?? "");

      const aoActBody = {
        tenant_id: tenant.tenant_id,
        project_id: tenant.project_id,
        group_id: tenant.group_id,
        issuer: normalizeAoActIssuer(auth, proposal.issuer),
        action_type: proposal.action_type,
        target: normalizeAoActTarget(proposal.target),
        time_window: proposal.time_window,
        parameter_schema: normalizeAoActParameterSchema(proposal.parameters, proposal.parameter_schema),
        parameters: (proposal.parameters && typeof proposal.parameters === "object") ? proposal.parameters : {},
        constraints: normalizeAoActConstraints(proposal.constraints),
        meta: normalizeAoActMeta(proposal.meta)
      };

      const aoResp = await fetch(url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "authorization": authz
        },
        body: JSON.stringify(aoActBody)
      });
      const aoJson: any = await aoResp.json().catch(() => null);
      if (!aoResp.ok || !aoJson?.ok) {
        return reply.status(400).send({ ok: false, error: "AO_ACT_TASK_ISSUE_FAILED", detail: aoJson ?? null });
      }

      const act_task_id = String(aoJson.act_task_id ?? "");
      const ao_fact_id = String(aoJson.fact_id ?? "");

      // Write approval decision fact (append-only).
      const decision_id = `apd_${randomUUID().replace(/-/g, "")}`;
      const created_at_ts = Date.now();
      const decision_record = {
        type: "approval_decision_v1",
        payload: {
          tenant_id: tenant.tenant_id,
          project_id: tenant.project_id,
          group_id: tenant.group_id,
          decision_id,
          request_id,
          decision: "APPROVED",
          act_task_id,
          ao_act_fact_id: ao_fact_id,
          actor_id: auth.actor_id,
          token_id: auth.token_id,
          created_at_ts
        }
      };

      const decision_fact_id = randomUUID();
      await pool.query(
        "INSERT INTO facts (fact_id, occurred_at, source, record_json) VALUES ($1, NOW(), $2, $3::jsonb)",
        [decision_fact_id, "api/control/approval_request/v1", decision_record]
      );

      // NOTE: We intentionally do NOT mutate the original request record; state is represented by separate facts.
      return reply.send({ ok: true, request_id, decision_id, act_task_id, ao_act_fact_id: ao_fact_id, decision_fact_id });
    } catch (e: any) {
      return reply.status(400).send({ ok: false, error: e?.message ?? "BAD_REQUEST" });
    }
  });
}
