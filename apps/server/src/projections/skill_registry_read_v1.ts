import type { Pool } from "pg";

type TenantTriple = { tenant_id: string; project_id: string; group_id: string };

type SkillRegistryFactType = "skill_definition_v1" | "skill_binding_v1" | "skill_run_v1";

type SkillRegistryReadRow = {
  tenant_id: string;
  project_id: string;
  group_id: string;
  fact_type: SkillRegistryFactType;
  fact_id: string;
  skill_id: string;
  version: string;
  category: string | null;
  legacy_category: string | null;
  status: string | null;
  scope_type: string | null;
  rollout_mode: string | null;
  result_status: string | null;
  crop_code: string | null;
  device_type: string | null;
  trigger_stage: string | null;
  bind_target: string | null;
  operation_id: string | null;
  operation_plan_id: string | null;
  field_id: string | null;
  device_id: string | null;
  input_digest: string | null;
  output_digest: string | null;
  lifecycle_version: number | null;
  payload_json: any;
  occurred_at: string;
  updated_at_ts_ms: number;
};

type SkillBindingProjectionInput = TenantTriple & {
  category?: string;
  status?: string;
  crop_code?: string;
  device_type?: string;
  trigger_stage?: string;
  bind_target?: string;
};

type SkillBindingProjectionItem = {
  fact_id: string;
  occurred_at: string;
  binding_id: string;
  skill_id: string;
  version: string;
  category: string | null;
  legacy_category: string | null;
  scope_type: string | null;
  trigger_stage: string | null;
  bind_target: string | null;
  rollout_mode: string | null;
  crop_code: string | null;
  device_type: string | null;
  priority: number;
  enabled: boolean;
  config_patch: Record<string, unknown>;
  effective: boolean;
  overridden_by: string | null;
};

function parseRecordJson(v: any): any {
  if (v && typeof v === "object") return v;
  if (typeof v === "string") {
    try { return JSON.parse(v); } catch { return null; }
  }
  return null;
}

function str(v: unknown): string {
  return String(v ?? "").trim();
}

function upper(v: unknown): string {
  return str(v).toUpperCase();
}

function lower(v: unknown): string {
  return str(v).toLowerCase();
}

function toIsoTimestamp(value: unknown): string {
  if (value instanceof Date) {
    const ms = value.getTime();
    if (Number.isFinite(ms)) return value.toISOString();
  }
  const text = str(value);
  if (!text) return new Date(0).toISOString();
  const ms = Date.parse(text);
  if (Number.isFinite(ms)) return new Date(ms).toISOString();
  return new Date(0).toISOString();
}

function toEpochMs(value: unknown, fallbackIso?: string): number {
  if (value instanceof Date) {
    const ms = value.getTime();
    if (Number.isFinite(ms)) return ms;
  }
  const text = str(value);
  const directMs = Date.parse(text);
  if (Number.isFinite(directMs)) return directMs;
  if (fallbackIso) {
    const fallbackMs = Date.parse(fallbackIso);
    if (Number.isFinite(fallbackMs)) return fallbackMs;
  }
  return 0;
}


const PUBLIC_MAP: Record<string, "sensing" | "agronomy" | "device" | "acceptance"> = {
  crop_skill: "agronomy",
  agronomy_skill: "agronomy",
  device_skill: "device",
  acceptance_skill: "acceptance",
  sensing_skill: "sensing",
};

function toPublicCategory(value: unknown): "sensing" | "agronomy" | "device" | "acceptance" | "unknown" {
  const normalized = str(value).toLowerCase();
  return PUBLIC_MAP[normalized] ?? "unknown";
}

function normalizeRunTriggerStage(factType: SkillRegistryFactType, stage: unknown): string | null {
  const normalized = str(stage).toLowerCase();
  if (!normalized) return null;
  if (factType !== "skill_run_v1") return normalized;
  return normalized === "before_approval" ? "after_recommendation" : normalized;
}

function selectLatest(rows: SkillRegistryReadRow[]): SkillRegistryReadRow[] {
  const latest = new Map<string, SkillRegistryReadRow>();
  for (const row of rows) {
    const key = [
      row.tenant_id,
      row.project_id,
      row.group_id,
      row.fact_type,
      row.skill_id,
      row.version,
      row.scope_type ?? "",
      row.bind_target ?? "",
      row.crop_code ?? "",
      row.device_type ?? "",
      row.trigger_stage ?? "",
      row.operation_plan_id ?? "",
      row.operation_id ?? "",
      row.device_id ?? "",
    ].join("|");
    const prev = latest.get(key);
    if (!prev || row.updated_at_ts_ms >= prev.updated_at_ts_ms) latest.set(key, row);
  }
  return [...latest.values()].sort((a, b) => b.updated_at_ts_ms - a.updated_at_ts_ms);
}

async function ensureSkillRegistryReadTable(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS skill_registry_read_v1 (
      tenant_id text NOT NULL,
      project_id text NOT NULL,
      group_id text NOT NULL,
      fact_type text NOT NULL,
      fact_id text NOT NULL,
      skill_id text NOT NULL,
      version text NOT NULL,
      category text NULL,
      legacy_category text NULL,
      status text NULL,
      scope_type text NULL,
      rollout_mode text NULL,
      result_status text NULL,
      crop_code text NULL,
      device_type text NULL,
      trigger_stage text NULL,
      bind_target text NULL,
      operation_id text NULL,
      operation_plan_id text NULL,
      field_id text NULL,
      device_id text NULL,
      input_digest text NULL,
      output_digest text NULL,
      lifecycle_version integer NULL,
      payload_json jsonb NOT NULL,
      occurred_at timestamptz NOT NULL,
      updated_at_ts_ms bigint NOT NULL,
      PRIMARY KEY (fact_id)
    )
  `);

  await pool.query(`CREATE INDEX IF NOT EXISTS idx_skill_registry_read_v1_lookup ON skill_registry_read_v1 (tenant_id, project_id, group_id, category, status, crop_code, device_type, trigger_stage, bind_target, updated_at_ts_ms DESC)`);
  await pool.query(`ALTER TABLE skill_registry_read_v1 ADD COLUMN IF NOT EXISTS lifecycle_version integer NULL`);
  await pool.query(`ALTER TABLE skill_registry_read_v1 ADD COLUMN IF NOT EXISTS legacy_category text NULL`);
}

export async function projectSkillRegistryReadV1(pool: Pool, tenant: TenantTriple): Promise<SkillRegistryReadRow[]> {
  await ensureSkillRegistryReadTable(pool);

  const factsQ = await pool.query(
    `SELECT fact_id, occurred_at, (record_json::jsonb) AS record_json
     FROM facts
     WHERE (record_json::jsonb->>'type') IN ('skill_definition_v1','skill_binding_v1','skill_run_v1')
       AND (record_json::jsonb#>>'{payload,tenant_id}') = $1
       AND (record_json::jsonb#>>'{payload,project_id}') = $2
       AND (record_json::jsonb#>>'{payload,group_id}') = $3
     ORDER BY occurred_at ASC, fact_id ASC`,
    [tenant.tenant_id, tenant.project_id, tenant.group_id]
  );

  const staged: SkillRegistryReadRow[] = (factsQ.rows ?? []).map((row: any) => {
    const record = parseRecordJson(row.record_json) ?? row.record_json;
    const payload = record?.payload ?? {};
    const factType = String(record?.type ?? "") as SkillRegistryFactType;
    const occurredAt = toIsoTimestamp(row.occurred_at);
    const ts = toEpochMs(row.occurred_at, occurredAt);
    const legacyCategory = str(payload.category).toLowerCase() || null;
    const publicCategory = toPublicCategory(payload.category);

    return {
      tenant_id: str(payload.tenant_id),
      project_id: str(payload.project_id),
      group_id: str(payload.group_id),
      fact_type: factType,
      fact_id: str(row.fact_id),
      skill_id: str(payload.skill_id),
      version: str(payload.version),
      category: publicCategory,
      legacy_category: legacyCategory,
      status: str(payload.status) || null,
      scope_type: str(payload.scope_type) || null,
      rollout_mode: str(payload.rollout_mode) || null,
      result_status: str(payload.result_status) || null,
      crop_code: str(payload.crop_code).toLowerCase() || null,
      device_type: str(payload.device_type) || null,
      trigger_stage: normalizeRunTriggerStage(factType, payload.trigger_stage),
      bind_target: str(payload.bind_target) || null,
      operation_id: str(payload.operation_id) || null,
      operation_plan_id: str(payload.operation_plan_id) || null,
      field_id: str(payload.field_id) || null,
      device_id: str(payload.device_id) || null,
      input_digest: str(payload.input_digest) || null,
      output_digest: str(payload.output_digest) || null,
      lifecycle_version: Number.isFinite(Number(payload.lifecycle_version)) ? Number(payload.lifecycle_version) : null,
      payload_json: payload,
      occurred_at: occurredAt,
      updated_at_ts_ms: Number.isFinite(ts) ? ts : 0,
    };
  }).filter((x) => x.fact_type && x.skill_id && x.version);

  const latest = selectLatest(staged);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM skill_registry_read_v1 WHERE tenant_id = $1 AND project_id = $2 AND group_id = $3", [tenant.tenant_id, tenant.project_id, tenant.group_id]);
    for (const row of latest) {
      await client.query(
        `INSERT INTO skill_registry_read_v1 (
          tenant_id, project_id, group_id, fact_type, fact_id, skill_id, version, category, legacy_category, status, scope_type, rollout_mode, result_status,
          crop_code, device_type, trigger_stage, bind_target, operation_id, operation_plan_id, field_id, device_id,
          input_digest, output_digest, lifecycle_version, payload_json, occurred_at, updated_at_ts_ms
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,
          $14,$15,$16,$17,$18,$19,$20,$21,
          $22,$23,$24,$25::jsonb,$26::timestamptz,$27
        )
        ON CONFLICT (fact_id) DO UPDATE SET
          category = EXCLUDED.category,
          legacy_category = EXCLUDED.legacy_category,
          status = EXCLUDED.status,
          scope_type = EXCLUDED.scope_type,
          rollout_mode = EXCLUDED.rollout_mode,
          result_status = EXCLUDED.result_status,
          crop_code = EXCLUDED.crop_code,
          device_type = EXCLUDED.device_type,
          trigger_stage = EXCLUDED.trigger_stage,
          bind_target = EXCLUDED.bind_target,
          operation_id = EXCLUDED.operation_id,
          operation_plan_id = EXCLUDED.operation_plan_id,
          field_id = EXCLUDED.field_id,
          device_id = EXCLUDED.device_id,
          input_digest = EXCLUDED.input_digest,
          output_digest = EXCLUDED.output_digest,
          lifecycle_version = EXCLUDED.lifecycle_version,
          payload_json = EXCLUDED.payload_json,
          occurred_at = EXCLUDED.occurred_at,
          updated_at_ts_ms = EXCLUDED.updated_at_ts_ms`,
        [
          row.tenant_id, row.project_id, row.group_id, row.fact_type, row.fact_id, row.skill_id, row.version, row.category, row.legacy_category, row.status, row.scope_type, row.rollout_mode, row.result_status,
          row.crop_code, row.device_type, row.trigger_stage, row.bind_target, row.operation_id, row.operation_plan_id, row.field_id, row.device_id,
          row.input_digest, row.output_digest, row.lifecycle_version, JSON.stringify(row.payload_json ?? {}), row.occurred_at, row.updated_at_ts_ms,
        ]
      );
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  return latest;
}

export async function querySkillRegistryReadV1(
  pool: Pool,
  input: TenantTriple & {
    category?: string;
    status?: string;
    crop_code?: string;
    device_type?: string;
    trigger_stage?: string;
    bind_target?: string;
    fact_type?: SkillRegistryFactType;
  }
): Promise<SkillRegistryReadRow[]> {
  const where = ["tenant_id = $1", "project_id = $2", "group_id = $3"];
  const params: unknown[] = [input.tenant_id, input.project_id, input.group_id];

  const append = (sql: string, value?: string) => {
    if (!value) return;
    params.push(value);
    where.push(`${sql} = $${params.length}`);
  };

  append("category", input.category?.trim().toLowerCase());
  append("status", input.status?.trim().toUpperCase());
  append("crop_code", input.crop_code?.trim().toLowerCase());
  append("device_type", input.device_type?.trim().toUpperCase());
  append("trigger_stage", input.trigger_stage?.trim());
  append("bind_target", input.bind_target?.trim());
  append("fact_type", input.fact_type?.trim());

  const rows = await pool.query<SkillRegistryReadRow>(
    `SELECT * FROM skill_registry_read_v1 WHERE ${where.join(" AND ")} ORDER BY updated_at_ts_ms DESC LIMIT 500`,
    params
  );
  return rows.rows ?? [];
}

function makeBindingOverrideKey(
  scope: TenantTriple,
  item: Pick<SkillBindingProjectionItem, "scope_type" | "bind_target" | "skill_id">
): string {
  return [
    scope.tenant_id,
    scope.project_id,
    scope.group_id,
    item.scope_type ?? "",
    item.bind_target ?? "",
    item.skill_id,
  ].join("|");
}

export async function querySkillBindingProjectionV1(
  pool: Pool,
  input: SkillBindingProjectionInput
): Promise<{
  items_effective: SkillBindingProjectionItem[];
  items_history: SkillBindingProjectionItem[];
  overrides: Array<{ fact_id: string; overridden_by: string; key: string }>;
}> {
  const rows = await pool.query(
    `SELECT fact_id, occurred_at, (record_json::jsonb) AS record_json
       FROM facts
      WHERE (record_json::jsonb->>'type') = 'skill_binding_v1'
        AND (record_json::jsonb#>>'{payload,tenant_id}') = $1
        AND (record_json::jsonb#>>'{payload,project_id}') = $2
        AND (record_json::jsonb#>>'{payload,group_id}') = $3
      ORDER BY occurred_at DESC, fact_id DESC`,
    [input.tenant_id, input.project_id, input.group_id]
  );

  const mapped: SkillBindingProjectionItem[] = (rows.rows ?? []).map((row: any) => {
    const record = parseRecordJson(row.record_json) ?? row.record_json ?? {};
    const payload = record?.payload ?? {};
    const legacyCategory = str(payload.category).toLowerCase() || null;
    const publicCategory = toPublicCategory(payload.category);
    return {
      fact_id: str(row.fact_id),
      occurred_at: toIsoTimestamp(row.occurred_at),
      binding_id: str(payload.binding_id) || str(row.fact_id),
      skill_id: str(payload.skill_id),
      version: str(payload.version),
      category: publicCategory,
      legacy_category: legacyCategory,
      scope_type: upper(payload.scope_type) || null,
      trigger_stage: str(payload.trigger_stage) || null,
      bind_target: str(payload.bind_target) || null,
      rollout_mode: upper(payload.rollout_mode) || null,
      crop_code: lower(payload.crop_code) || null,
      device_type: upper(payload.device_type) || null,
      priority: Number.isFinite(Number(payload.priority)) ? Number(payload.priority) : 0,
      enabled: ["ACTIVE", "ENABLED"].includes(upper(payload.status)),
      config_patch: (payload.config_patch && typeof payload.config_patch === "object" && !Array.isArray(payload.config_patch)) ? payload.config_patch : {},
      effective: false,
      overridden_by: null,
    };
  }).filter((item) => item.skill_id && item.version);

  const filtered = mapped.filter((item) => {
    if (input.category && str(item.category).toLowerCase() !== str(input.category).toLowerCase()) return false;
    if (input.status) {
      const expected = upper(input.status);
      const actual = item.enabled ? "ACTIVE" : "DISABLED";
      if (actual !== expected) return false;
    }
    if (input.crop_code && lower(item.crop_code) !== lower(input.crop_code)) return false;
    if (input.device_type && upper(item.device_type) !== upper(input.device_type)) return false;
    if (input.trigger_stage && str(item.trigger_stage) !== str(input.trigger_stage)) return false;
    if (input.bind_target && str(item.bind_target) !== str(input.bind_target)) return false;
    return true;
  });

  const groups = new Map<string, SkillBindingProjectionItem[]>();
  for (const item of filtered) {
    const key = makeBindingOverrideKey(input, item);
    const list = groups.get(key) ?? [];
    list.push(item);
    groups.set(key, list);
  }

  const items_effective: SkillBindingProjectionItem[] = [];
  const items_history: SkillBindingProjectionItem[] = [];
  const overrides: Array<{ fact_id: string; overridden_by: string; key: string }> = [];

  for (const [key, group] of groups.entries()) {
    const timeline = [...group].sort((a, b) => {
      const t = Date.parse(a.occurred_at) - Date.parse(b.occurred_at);
      if (t !== 0) return t;
      return a.fact_id.localeCompare(b.fact_id);
    });
    // P1 规则：
    // 1) effective 仅在同一 skill_id 的时间线（tenant/project/group + scope_type + bind_target + skill_id）内计算；
    // 2) 不同 skill_id 的记录可同时 effective；
    // 3) 不做同类互斥，也不使用 category/publicCategory/legacy_category 推断覆盖关系。
    const winner = timeline[timeline.length - 1] ?? null;
    if (winner) items_effective.push({ ...winner, effective: true, overridden_by: null });

    for (const item of timeline) {
      const isEffective = !!winner && winner.fact_id === item.fact_id;
      const overriddenBy = isEffective ? null : winner?.fact_id ?? null;
      items_history.push({ ...item, effective: isEffective, overridden_by: overriddenBy });
      if (overriddenBy) overrides.push({ fact_id: item.fact_id, overridden_by: overriddenBy, key });
    }
  }

  items_effective.sort((a, b) => Date.parse(b.occurred_at) - Date.parse(a.occurred_at));
  items_history.sort((a, b) => Date.parse(b.occurred_at) - Date.parse(a.occurred_at));

  return { items_effective, items_history, overrides };
}
