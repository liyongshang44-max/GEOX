import type { Pool } from "pg";

type TenantTriple = { tenant_id: string; project_id: string; group_id: string };
type FactRow = { fact_id: string; occurred_at: string; record_json: any };

export type ProgramCostV1 = {
  program_id: string;
  tenant_id: string;
  project_id: string;
  group_id: string;
  currency: string;
  total_cost: number;
  record_count: number;
  resource_record_count: number;
  resource_usage_totals: {
    fuel_l: number;
    electric_kwh: number;
    water_l: number;
    chemical_ml: number;
  };
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

function num(v: any): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function toMs(v: string | null | undefined): number {
  const ms = Date.parse(String(v ?? ""));
  return Number.isFinite(ms) ? ms : 0;
}

function defaultUsage() {
  return { fuel_l: 0, electric_kwh: 0, water_l: 0, chemical_ml: 0 };
}

export function projectProgramCostFromFacts(rows: FactRow[]): ProgramCostV1[] {
  const facts = rows.map((row) => ({ ...row, record_json: parseRecordJson(row.record_json) ?? row.record_json }));
  const programs = facts.filter((r) => r.record_json?.type === "field_program_v1");
  const costRecords = facts.filter((r) => r.record_json?.type === "cost_record_v1");
  const resourceRecords = facts.filter((r) => r.record_json?.type === "resource_usage_v1");

  const out = new Map<string, ProgramCostV1>();

  for (const row of programs) {
    const payload = row.record_json?.payload ?? {};
    const program_id = str(payload.program_id);
    if (!program_id) continue;
    const previous = out.get(program_id);
    const currency = str(payload?.budget?.currency || "USD") || "USD";
    const baseline: ProgramCostV1 = previous ?? {
      program_id,
      tenant_id: str(payload.tenant_id),
      project_id: str(payload.project_id),
      group_id: str(payload.group_id),
      currency,
      total_cost: 0,
      record_count: 0,
      resource_record_count: 0,
      resource_usage_totals: defaultUsage(),
      updated_at_ts: toMs(row.occurred_at)
    };
    baseline.currency = baseline.currency || currency;
    baseline.updated_at_ts = Math.max(baseline.updated_at_ts, toMs(row.occurred_at));
    out.set(program_id, baseline);
  }

  for (const row of costRecords) {
    const payload = row.record_json?.payload ?? {};
    const program_id = str(payload.program_id);
    if (!program_id || !out.has(program_id)) continue;
    const item = out.get(program_id)!;
    item.total_cost += num(payload.cost_amount ?? payload.amount ?? payload.total_cost ?? 0);
    const c = str(payload.currency);
    if (c) item.currency = c;
    item.record_count += 1;
    item.updated_at_ts = Math.max(item.updated_at_ts, toMs(row.occurred_at));
  }

  for (const row of resourceRecords) {
    const payload = row.record_json?.payload ?? {};
    const program_id = str(payload.program_id);
    if (!program_id || !out.has(program_id)) continue;
    const item = out.get(program_id)!;
    const usage = payload.resource_usage ?? payload.usage ?? {};
    item.resource_usage_totals.fuel_l += num(usage.fuel_l);
    item.resource_usage_totals.electric_kwh += num(usage.electric_kwh);
    item.resource_usage_totals.water_l += num(usage.water_l);
    item.resource_usage_totals.chemical_ml += num(usage.chemical_ml);
    item.resource_record_count += 1;
    item.updated_at_ts = Math.max(item.updated_at_ts, toMs(row.occurred_at));
  }

  return Array.from(out.values()).sort((a, b) => b.updated_at_ts - a.updated_at_ts);
}

async function loadFacts(pool: Pool, tenant: TenantTriple): Promise<FactRow[]> {
  const sql = `SELECT fact_id, occurred_at, (record_json::jsonb) AS record_json
    FROM facts
    WHERE (record_json::jsonb->>'type') IN ('field_program_v1', 'cost_record_v1', 'resource_usage_v1')
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

export async function projectProgramCostV1(pool: Pool, tenant: TenantTriple): Promise<ProgramCostV1[]> {
  const facts = await loadFacts(pool, tenant);
  return projectProgramCostFromFacts(facts);
}
