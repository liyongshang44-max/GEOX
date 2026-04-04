import type { Pool } from "pg";
import type { AgronomyRuleSkill } from "./types";
import { ruleSkills } from "./index";
import { listFallbackSkillSwitches, type SkillSwitch } from "./runtime_config";

type ResolvedRuleSkill = AgronomyRuleSkill & { __priority: number };

export type SkillBindingRecord = {
  id: string;
  skill_id: string;
  version: string;
  tenant_id: string | null;
  crop_code: string | null;
  enabled: boolean;
  priority: number;
  updated_at: string;
};

export type SkillBindingSource = "tenant+crop" | "tenant+*" | "*+crop" | "global" | "fallback_config";

let bindingsPool: Pool | null = null;
let bindingsTableChecked = false;

function normalizeScopeValue(input?: string): string | null {
  const normalized = typeof input === "string" ? input.trim() : "";
  return normalized ? normalized : null;
}

function resolveSource(tenant_id: string, crop_code: string, row: Pick<SkillBindingRecord, "tenant_id" | "crop_code">): SkillBindingSource | null {
  if (row.tenant_id === tenant_id && row.crop_code === crop_code) return "tenant+crop";
  if (row.tenant_id === tenant_id && row.crop_code === null) return "tenant+*";
  if (row.tenant_id === null && row.crop_code === crop_code) return "*+crop";
  if (row.tenant_id === null && row.crop_code === null) return "global";
  return null;
}

const sourceOrder: SkillBindingSource[] = ["tenant+crop", "tenant+*", "*+crop", "global", "fallback_config"];

function pickBySkill(rows: Array<SkillBindingRecord & { source: SkillBindingSource }>): Array<SkillBindingRecord & { source: SkillBindingSource }> {
  const grouped = new Map<string, Array<SkillBindingRecord & { source: SkillBindingSource }>>();
  for (const row of rows) {
    const bucket = grouped.get(row.skill_id) ?? [];
    bucket.push(row);
    grouped.set(row.skill_id, bucket);
  }

  const picked: Array<SkillBindingRecord & { source: SkillBindingSource }> = [];
  for (const [, bucket] of grouped) {
    bucket.sort((a, b) => {
      if (b.priority !== a.priority) return b.priority - a.priority;
      if (b.updated_at !== a.updated_at) return b.updated_at.localeCompare(a.updated_at);
      return b.version.localeCompare(a.version);
    });
    picked.push(bucket[0]);
  }
  return picked;
}

async function assertBindingsTableReady(): Promise<void> {
  if (!bindingsPool || bindingsTableChecked) return;
  const checked = await bindingsPool.query<{ reg: string | null }>("SELECT to_regclass('public.skill_rule_bindings') AS reg");
  if (!checked.rows[0]?.reg) {
    throw new Error("SKILL_RULE_BINDINGS_TABLE_MISSING: apply DB migration first");
  }
  bindingsTableChecked = true;
}

export function configureSkillBindingsPool(pool: Pool): void {
  bindingsPool = pool;
}

export async function listSkillBindings(input?: {
  crop_code?: string;
  tenant_id?: string;
  enabled_only?: boolean;
}): Promise<SkillBindingRecord[]> {
  if (!bindingsPool) {
    return listFallbackSkillSwitches(input).map((item, index) => ({
      id: `fallback_${index}`,
      skill_id: item.skill_id,
      version: item.version,
      tenant_id: item.scope?.tenant_id ?? null,
      crop_code: item.scope?.crop_code ?? null,
      enabled: item.enabled,
      priority: item.priority,
      updated_at: new Date(0).toISOString(),
    }));
  }

  await assertBindingsTableReady();

  const params: unknown[] = [];
  const where: string[] = [];
  if (input?.enabled_only) {
    params.push(true);
    where.push(`enabled = $${params.length}`);
  }
  if (typeof input?.tenant_id === "string" && input.tenant_id.trim()) {
    params.push(input.tenant_id.trim());
    where.push(`(tenant_id = $${params.length} OR tenant_id IS NULL)`);
  }
  if (typeof input?.crop_code === "string" && input.crop_code.trim()) {
    params.push(input.crop_code.trim());
    where.push(`(crop_code = $${params.length} OR crop_code IS NULL)`);
  }

  const sql = `
    SELECT id, skill_id, version, tenant_id, crop_code, enabled, priority, updated_at
    FROM skill_rule_bindings
    ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
    ORDER BY updated_at DESC, skill_id ASC
  `;
  const rows = await bindingsPool.query<SkillBindingRecord>(sql, params);
  return rows.rows;
}

export async function switchSkillBinding(input: {
  skill_id: string;
  version: string;
  enabled: boolean;
  priority?: number;
  scope?: { tenant_id?: string; crop_code?: string };
}): Promise<SkillBindingRecord> {
  if (!bindingsPool) {
    throw new Error("SKILL_BINDINGS_DB_UNAVAILABLE");
  }

  await assertBindingsTableReady();

  const tenant_id = normalizeScopeValue(input.scope?.tenant_id);
  const crop_code = normalizeScopeValue(input.scope?.crop_code);
  const priority = Number.isFinite(Number(input.priority)) ? Number(input.priority) : 0;

  const client = await bindingsPool.connect();
  try {
    await client.query("BEGIN");

    if (input.enabled) {
      await client.query(
        `UPDATE skill_rule_bindings
         SET enabled = false, updated_at = now()
         WHERE skill_id = $1
           AND COALESCE(tenant_id, '') = COALESCE($2, '')
           AND COALESCE(crop_code, '') = COALESCE($3, '')
           AND enabled = true`,
        [input.skill_id, tenant_id, crop_code]
      );
    }

    await client.query(
      `INSERT INTO skill_rule_bindings (id, skill_id, version, crop_code, tenant_id, enabled, priority, updated_at)
       VALUES (md5(random()::text || clock_timestamp()::text), $1, $2, $3, $4, $5, $6, now())
       ON CONFLICT (skill_id, version, tenant_scope, crop_scope)
       DO UPDATE SET enabled = EXCLUDED.enabled,
                     priority = EXCLUDED.priority,
                     updated_at = now()`,
      [input.skill_id, input.version, crop_code, tenant_id, input.enabled, priority]
    );

    const selected = await client.query<SkillBindingRecord>(
      `SELECT id, skill_id, version, tenant_id, crop_code, enabled, priority, updated_at
       FROM skill_rule_bindings
       WHERE skill_id = $1 AND version = $2
         AND COALESCE(tenant_id, '') = COALESCE($3, '')
         AND COALESCE(crop_code, '') = COALESCE($4, '')`,
      [input.skill_id, input.version, tenant_id, crop_code]
    );

    await client.query("COMMIT");
    return selected.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

function resolveFromFallback(input: { crop_code: string; tenant_id: string }): Array<SkillSwitch & { source: SkillBindingSource }> {
  const enabled = listFallbackSkillSwitches({
    crop_code: input.crop_code,
    tenant_id: input.tenant_id,
    enabled_only: true,
  });

  const mapped = enabled
    .map((row) => {
      const source = resolveSource(input.tenant_id, input.crop_code, {
        tenant_id: row.scope?.tenant_id ?? null,
        crop_code: row.scope?.crop_code ?? null,
      });
      return source ? { ...row, source } : null;
    })
    .filter((row): row is SkillSwitch & { source: SkillBindingSource } => Boolean(row));

  for (const source of sourceOrder) {
    const matched = mapped.filter((item) => item.source === source);
    const picked = pickBySkill(matched.map((item) => ({
      id: `fallback_${item.skill_id}_${item.version}_${source}`,
      skill_id: item.skill_id,
      version: item.version,
      tenant_id: item.scope?.tenant_id ?? null,
      crop_code: item.scope?.crop_code ?? null,
      enabled: item.enabled,
      priority: item.priority,
      updated_at: new Date(0).toISOString(),
      source,
    })));
    if (picked.length > 0) {
      return picked.map((item) => ({
        skill_id: item.skill_id,
        version: item.version,
        enabled: item.enabled,
        priority: item.priority,
        scope: { tenant_id: item.tenant_id ?? undefined, crop_code: item.crop_code ?? undefined },
        source,
      }));
    }
  }

  return [];
}

export async function resolveRuleSkillBindings(input: {
  crop_code: string;
  tenant_id: string;
}): Promise<Array<SkillBindingRecord & { source: SkillBindingSource }>> {
  if (!bindingsPool) {
    return resolveFromFallback(input).map((item) => ({
      id: `fallback_${item.skill_id}_${item.version}`,
      skill_id: item.skill_id,
      version: item.version,
      tenant_id: item.scope?.tenant_id ?? null,
      crop_code: item.scope?.crop_code ?? null,
      enabled: item.enabled,
      priority: item.priority,
      updated_at: new Date(0).toISOString(),
      source: item.source,
    }));
  }

  try {
    await assertBindingsTableReady();
    const rows = await bindingsPool.query<SkillBindingRecord>(
      `SELECT id, skill_id, version, tenant_id, crop_code, enabled, priority, updated_at
       FROM skill_rule_bindings
       WHERE enabled = true
         AND (tenant_id = $1 OR tenant_id IS NULL)
         AND (crop_code = $2 OR crop_code IS NULL)`,
      [input.tenant_id, input.crop_code]
    );

    const withSource = rows.rows
      .map((row) => {
        const source = resolveSource(input.tenant_id, input.crop_code, row);
        return source ? { ...row, source } : null;
      })
      .filter((row): row is SkillBindingRecord & { source: SkillBindingSource } => Boolean(row));

    for (const source of sourceOrder) {
      const bucket = withSource.filter((row) => row.source === source);
      const picked = pickBySkill(bucket);
      if (picked.length > 0) return picked;
    }
  } catch (error) {
    const fallback = resolveFromFallback(input);
    if (fallback.length > 0) {
      return fallback.map((item) => ({
        id: `fallback_${item.skill_id}_${item.version}`,
        skill_id: item.skill_id,
        version: item.version,
        tenant_id: item.scope?.tenant_id ?? null,
        crop_code: item.scope?.crop_code ?? null,
        enabled: item.enabled,
        priority: item.priority,
        updated_at: new Date(0).toISOString(),
        source: item.source,
      }));
    }
    throw error;
  }

  throw new Error("NO_SKILL_BINDING_FOUND");
}

export async function getRuleSkills(input: {
  crop_code: string;
  tenant_id: string;
}): Promise<ResolvedRuleSkill[]> {
  const resolvedBindings = await resolveRuleSkillBindings(input);
  const resolved = resolvedBindings
    .map((s) => {
      const impl = ruleSkills.find((r) => r.id === s.skill_id && r.version === s.version);
      return impl ? { ...impl, __priority: s.priority } : null;
    })
    .filter((x): x is ResolvedRuleSkill => x !== null);

  resolved.sort((a, b) => b.__priority - a.__priority);
  return resolved;
}
