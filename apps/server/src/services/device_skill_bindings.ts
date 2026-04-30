import type { Pool } from "pg";

export type DeviceSkillBindingTrigger =
  | "DEVICE_CREATED"
  | "DEVICE_TEMPLATE_SWITCHED"
  | "EXPLICIT_RECONCILE"
  | "DEV_LAB_CREATE_DEMO_FIELD";

export type BindingHealth = "HEALTHY" | "MISSING";

export type EnsureDeviceSkillBindingsInput = {
  pool: Pool;
  tenant_id: string;
  project_id: string;
  group_id: string;
  device_id: string;
  trigger: DeviceSkillBindingTrigger;
  allow_write?: boolean;
};

export type EnsureDeviceSkillBindingsResult = {
  binding_health: BindingHealth;
  missing_count: number;
  repaired_count: number;
  repair: {
    method: "POST";
    href: string;
  } | null;
};

let ensureDeviceSkillBindingsRuntimePromise: Promise<void> | null = null;

async function ensureDeviceSkillBindingsRuntime(pool: Pool): Promise<void> {
  if (!ensureDeviceSkillBindingsRuntimePromise) {
    ensureDeviceSkillBindingsRuntimePromise = (async () => {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS device_skill_binding_index_v1 (
          tenant_id TEXT NOT NULL,
          project_id TEXT NOT NULL,
          group_id TEXT NOT NULL,
          device_id TEXT NOT NULL,
          skill_id TEXT NOT NULL,
          version TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'ACTIVE',
          source_trigger TEXT NOT NULL,
          updated_ts_ms BIGINT NOT NULL,
          PRIMARY KEY (tenant_id, project_id, group_id, device_id, skill_id, version)
        )
      `);
      await pool.query(`
        CREATE INDEX IF NOT EXISTS device_skill_binding_index_v1_lookup
        ON device_skill_binding_index_v1 (tenant_id, project_id, group_id, device_id, updated_ts_ms DESC)
      `);
    })().catch((err) => {
      ensureDeviceSkillBindingsRuntimePromise = null;
      throw err;
    });
  }
  await ensureDeviceSkillBindingsRuntimePromise;
}


async function hasBindingIndexTable(pool: Pool): Promise<boolean> {
  const q = await pool.query(
    `SELECT to_regclass('public.device_skill_binding_index_v1')::text AS tbl`
  );
  return Boolean((q.rows?.[0] as any)?.tbl);
}

function buildMissingResponse(input: EnsureDeviceSkillBindingsInput, missingCount: number): EnsureDeviceSkillBindingsResult {
  return {
    binding_health: "MISSING",
    missing_count: missingCount,
    repaired_count: 0,
    repair: {
      method: "POST",
      href: `/api/v1/devices/${encodeURIComponent(input.device_id)}/skill-bindings/reconcile`,
    },
  };
}

export async function ensureDeviceSkillBindings(input: EnsureDeviceSkillBindingsInput): Promise<EnsureDeviceSkillBindingsResult> {
  const allowWrite = input.allow_write !== false;
  if (allowWrite) await ensureDeviceSkillBindingsRuntime(input.pool);

  const requiredQ = await input.pool.query(
    `SELECT skill_id, version
       FROM skill_registry_read_v1
      WHERE tenant_id = $1
        AND project_id = $2
        AND group_id = $3
        AND fact_type = 'skill_binding_v1'
        AND UPPER(COALESCE(category, '')) = 'DEVICE'
        AND UPPER(COALESCE(scope_type, '')) IN ('DEVICE','TENANT')
        AND UPPER(COALESCE(status, '')) = 'ACTIVE'
      ORDER BY updated_at_ts_ms DESC
      LIMIT 500`,
    [input.tenant_id, input.project_id, input.group_id],
  );

  const requiredPairs = new Set<string>();
  for (const row of requiredQ.rows ?? []) {
    const key = `${String((row as any).skill_id ?? "")}::${String((row as any).version ?? "")}`;
    if (!key.startsWith("::")) requiredPairs.add(key);
  }

  if (requiredPairs.size < 1) {
    return { binding_health: "HEALTHY", missing_count: 0, repaired_count: 0, repair: null };
  }

  const bindingTableReady = await hasBindingIndexTable(input.pool);
  if (!bindingTableReady && !allowWrite) return buildMissingResponse(input, requiredPairs.size);
  if (!bindingTableReady && allowWrite) await ensureDeviceSkillBindingsRuntime(input.pool);

  const existingQ = await input.pool.query(
    `SELECT skill_id, version
       FROM device_skill_binding_index_v1
      WHERE tenant_id = $1
        AND project_id = $2
        AND group_id = $3
        AND device_id = $4
        AND UPPER(COALESCE(status, '')) = 'ACTIVE'`,
    [input.tenant_id, input.project_id, input.group_id, input.device_id],
  );

  const existingPairs = new Set<string>((existingQ.rows ?? []).map((r: any) => `${String(r.skill_id ?? "")}::${String(r.version ?? "")}`));
  const missing: Array<{ skill_id: string; version: string }> = [];
  for (const pair of requiredPairs) {
    if (existingPairs.has(pair)) continue;
    const [skill_id, version] = pair.split("::");
    if (!skill_id || !version) continue;
    missing.push({ skill_id, version });
  }

  if (missing.length < 1) {
    return { binding_health: "HEALTHY", missing_count: 0, repaired_count: 0, repair: null };
  }

  if (!allowWrite) return buildMissingResponse(input, missing.length);

  const now = Date.now();
  for (const row of missing) {
    await input.pool.query(
      `INSERT INTO device_skill_binding_index_v1
        (tenant_id, project_id, group_id, device_id, skill_id, version, status, source_trigger, updated_ts_ms)
       VALUES ($1, $2, $3, $4, $5, $6, 'ACTIVE', $7, $8)
       ON CONFLICT (tenant_id, project_id, group_id, device_id, skill_id, version)
       DO UPDATE SET status = 'ACTIVE', source_trigger = EXCLUDED.source_trigger, updated_ts_ms = EXCLUDED.updated_ts_ms`,
      [input.tenant_id, input.project_id, input.group_id, input.device_id, row.skill_id, row.version, input.trigger, now],
    );
  }

  return {
    binding_health: "HEALTHY",
    missing_count: missing.length,
    repaired_count: missing.length,
    repair: null,
  };
}
