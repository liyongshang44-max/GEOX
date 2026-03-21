import type { Pool } from "pg";

type TenantTriple = { tenant_id: string; project_id: string; group_id: string };
type FactRow = { fact_id: string; occurred_at: string; record_json: any };

export type ProgramSlaV1 = {
  program_id: string;
  tenant_id: string;
  project_id: string;
  group_id: string;
  total_checks: number;
  met_checks: number;
  breach_checks: number;
  compliance_rate: number;
  latest_status: "MET" | "BREACH" | "UNKNOWN";
  latest_sla_name?: string;
  updated_at_ts: number;
};

function parseRecordJson(v: any): any {
  if (v && typeof v === "object") return v;
  if (typeof v === "string") {
    try { return JSON.parse(v); } catch { return null; }
  }
  return null;
}

function str(v: any): string {
  return String(v ?? "").trim();
}

function toMs(v: string | null | undefined): number {
  const ms = Date.parse(String(v ?? ""));
  return Number.isFinite(ms) ? ms : 0;
}

function statusOf(payload: any): "MET" | "BREACH" | "UNKNOWN" {
  const raw = str(payload.status ?? payload.result ?? payload.verdict).toUpperCase();
  if (raw === "MET" || raw === "PASS" || raw === "PASSED") return "MET";
  if (raw === "BREACH" || raw === "FAIL" || raw === "FAILED") return "BREACH";
  if (payload.met === true) return "MET";
  if (payload.met === false) return "BREACH";
  return "UNKNOWN";
}

export function projectProgramSlaFromFacts(rows: FactRow[]): ProgramSlaV1[] {
  const facts = rows.map((row) => ({ ...row, record_json: parseRecordJson(row.record_json) ?? row.record_json }));
  const programs = facts.filter((r) => r.record_json?.type === "field_program_v1");
  const evaluations = facts.filter((r) => r.record_json?.type === "sla_evaluation_v1");

  const out = new Map<string, ProgramSlaV1>();
  for (const row of programs) {
    const payload = row.record_json?.payload ?? {};
    const program_id = str(payload.program_id);
    if (!program_id) continue;
    out.set(program_id, {
      program_id,
      tenant_id: str(payload.tenant_id),
      project_id: str(payload.project_id),
      group_id: str(payload.group_id),
      total_checks: 0,
      met_checks: 0,
      breach_checks: 0,
      compliance_rate: 0,
      latest_status: "UNKNOWN",
      updated_at_ts: toMs(row.occurred_at)
    });
  }

  const latestTsByProgram = new Map<string, number>();
  for (const row of evaluations) {
    const payload = row.record_json?.payload ?? {};
    const program_id = str(payload.program_id);
    if (!program_id || !out.has(program_id)) continue;
    const item = out.get(program_id)!;
    item.total_checks += 1;
    const status = statusOf(payload);
    if (status === "MET") item.met_checks += 1;
    if (status === "BREACH") item.breach_checks += 1;

    const ts = toMs(row.occurred_at);
    if (ts >= (latestTsByProgram.get(program_id) ?? 0)) {
      latestTsByProgram.set(program_id, ts);
      item.latest_status = status;
      const name = str(payload.sla_name ?? payload.metric_name ?? payload.sla_key);
      if (name) item.latest_sla_name = name;
    }
    item.updated_at_ts = Math.max(item.updated_at_ts, ts);
  }

  for (const item of out.values()) {
    item.compliance_rate = item.total_checks > 0 ? item.met_checks / item.total_checks : 0;
  }

  return Array.from(out.values()).sort((a, b) => b.updated_at_ts - a.updated_at_ts);
}

async function loadFacts(pool: Pool, tenant: TenantTriple): Promise<FactRow[]> {
  const sql = `SELECT fact_id, occurred_at, (record_json::jsonb) AS record_json
    FROM facts
    WHERE (record_json::jsonb->>'type') IN ('field_program_v1', 'sla_evaluation_v1')
      AND (record_json::jsonb#>>'{payload,tenant_id}') = $1
      AND (record_json::jsonb#>>'{payload,project_id}') = $2
      AND (record_json::jsonb#>>'{payload,group_id}') = $3
    ORDER BY occurred_at ASC, fact_id ASC`;
  const res = await pool.query(sql, [tenant.tenant_id, tenant.project_id, tenant.group_id]);
  return (res.rows ?? []).map((row: any) => ({
    fact_id: str(row.fact_id),
    occurred_at: String(row.occurred_at),
    record_json: parseRecordJson(row.record_json) ?? row.record_json
  }));
}

export async function projectProgramSlaV1(pool: Pool, tenant: TenantTriple): Promise<ProgramSlaV1[]> {
  const facts = await loadFacts(pool, tenant);
  return projectProgramSlaFromFacts(facts);
}
