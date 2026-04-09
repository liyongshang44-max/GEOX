import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { requireAoActScopeV0 } from "../auth/ao_act_authz_v0";
import { projectSkillRegistryReadV1 } from "../projections/skill_registry_read_v1";

type TenantTriple = { tenant_id: string; project_id: string; group_id: string };

type SkillRunReadRow = {
  fact_id: string;
  skill_id: string;
  category: string | null;
  status: string | null;
  result_status: string | null;
  field_id: string | null;
  device_id: string | null;
  input_digest: string | null;
  output_digest: string | null;
  payload_json: any;
  occurred_at: string;
  updated_at_ts_ms: number;
};

const CATEGORY_MAP: Record<string, "sensing" | "agronomy" | "device" | "acceptance"> = {
  SENSING: "sensing",
  OBSERVABILITY: "sensing",
  OPS: "sensing",
  CONTROL: "sensing",
  AGRONOMY: "agronomy",
  DEVICE: "device",
  ACCEPTANCE: "acceptance",
};

function normalizeCategory(value: unknown): "sensing" | "agronomy" | "device" | "acceptance" | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const normalized = CATEGORY_MAP[value.trim().toUpperCase()];
  return normalized ?? null;
}

function normalizeStatus(value: unknown): "success" | "failed" {
  return String(value ?? "").trim().toUpperCase() === "SUCCESS" ? "success" : "failed";
}

function parseEpochMs(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return Math.trunc(value);
  if (typeof value === "string" && value.trim()) {
    const asNumber = Number(value);
    if (Number.isFinite(asNumber)) return Math.trunc(asNumber);
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  if (value instanceof Date) {
    const ms = value.getTime();
    return Number.isFinite(ms) ? ms : null;
  }
  return null;
}

function toInt(value: unknown, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.trunc(n);
}

function toExplanationCodes(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((x) => String(x ?? "").trim())
    .filter((x) => Boolean(x));
}

function requireTenantMatchOr404(auth: TenantTriple, tenant: TenantTriple, reply: any): boolean {
  if (auth.tenant_id !== tenant.tenant_id || auth.project_id !== tenant.project_id || auth.group_id !== tenant.group_id) {
    reply.status(404).send({ ok: false, error: "NOT_FOUND" });
    return false;
  }
  return true;
}

export function registerSkillRunsV1Routes(app: FastifyInstance, pool: Pool): void {
  app.get("/api/v1/skill-runs", async (req, reply) => {
    const auth = requireAoActScopeV0(req, reply, "ao_act.index.read");
    if (!auth) return;

    const query = (req.query ?? {}) as {
      tenant_id?: string;
      field_id?: string;
      device_id?: string;
      category?: string;
      status?: string;
      limit?: string | number;
    };

    const tenant: TenantTriple = {
      tenant_id: String(query.tenant_id ?? auth.tenant_id).trim(),
      project_id: String(auth.project_id).trim(),
      group_id: String(auth.group_id).trim(),
    };
    if (!requireTenantMatchOr404(auth, tenant, reply)) return;

    await projectSkillRegistryReadV1(pool, tenant);

    const where = ["tenant_id = $1", "project_id = $2", "group_id = $3", "fact_type = 'skill_run_v1'"];
    const params: unknown[] = [tenant.tenant_id, tenant.project_id, tenant.group_id];

    const fieldId = typeof query.field_id === "string" ? query.field_id.trim() : "";
    if (fieldId) {
      params.push(fieldId);
      where.push(`field_id = $${params.length}`);
    }

    const deviceId = typeof query.device_id === "string" ? query.device_id.trim() : "";
    if (deviceId) {
      params.push(deviceId);
      where.push(`device_id = $${params.length}`);
    }

    const normalizedCategory = normalizeCategory(query.category);
    if (normalizedCategory) {
      params.push(query.category!.trim().toUpperCase());
      where.push(`category = $${params.length}`);
    }

    const normalizedStatus = typeof query.status === "string" ? query.status.trim().toLowerCase() : "";
    if (normalizedStatus === "success") {
      where.push("result_status = 'SUCCESS'");
    } else if (normalizedStatus === "failed") {
      where.push("result_status <> 'SUCCESS'");
    }

    const limit = Math.min(200, Math.max(1, toInt(query.limit, 50)));
    params.push(limit);

    const rowsQ = await pool.query<SkillRunReadRow>(
      `SELECT *
         FROM skill_registry_read_v1
        WHERE ${where.join(" AND ")}
        ORDER BY updated_at_ts_ms DESC
        LIMIT $${params.length}`,
      params,
    );

    const items = (rowsQ.rows ?? []).map((row) => {
      const payload = row.payload_json ?? {};
      const started_at_ts_ms =
        parseEpochMs(payload.started_at_ts_ms) ??
        parseEpochMs(payload.execution_started_at_ts_ms) ??
        parseEpochMs(payload.started_at) ??
        parseEpochMs(payload.execution_started_at) ??
        row.updated_at_ts_ms;
      const finished_at_ts_ms =
        parseEpochMs(payload.finished_at_ts_ms) ??
        parseEpochMs(payload.execution_finished_at_ts_ms) ??
        parseEpochMs(payload.finished_at) ??
        parseEpochMs(payload.execution_finished_at) ??
        parseEpochMs(row.occurred_at) ??
        row.updated_at_ts_ms;
      const mappedCategory = normalizeCategory(row.category) ?? normalizeCategory(payload.category) ?? "sensing";
      const mappedStatus = normalizeStatus(row.result_status ?? row.status ?? payload.result_status ?? payload.status);
      const target: { field_id?: string; device_id?: string } = {};
      if (row.field_id) target.field_id = row.field_id;
      if (row.device_id) target.device_id = row.device_id;

      return {
        skill_run_id: String(payload.run_id ?? row.fact_id),
        skill_id: String(row.skill_id),
        category: mappedCategory,
        status: mappedStatus,
        started_at_ts_ms,
        finished_at_ts_ms,
        target,
        input_digest: String(row.input_digest ?? payload.input_digest ?? ""),
        output_digest: String(row.output_digest ?? payload.output_digest ?? ""),
        explanation_codes: toExplanationCodes(payload.explanation_codes),
      };
    });

    return reply.send({ ok: true, items, limit });
  });
}
