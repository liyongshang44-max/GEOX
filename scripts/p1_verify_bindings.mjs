#!/usr/bin/env node
import pg from "pg";

const { Pool } = pg;

const tenantId = process.env.TENANT_ID ?? "tenantA";
const projectId = process.env.PROJECT_ID ?? "projectA";
const groupId = process.env.GROUP_ID ?? "groupA";

const expectedSkillIds = [
  "soil_moisture_inference_v1",
  "irrigation_advice_v1",
  "pump_safety_guard_v1",
  "operation_acceptance_gate_v1",
];

function norm(value) {
  return typeof value === "string" ? value.trim() : "";
}

function toIso(value) {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? new Date(0).toISOString() : d.toISOString();
}

function makeKey(item) {
  return [
    norm(item.tenant_id),
    norm(item.project_id),
    norm(item.group_id),
    norm(item.scope_type).toUpperCase(),
    norm(item.bind_target),
    norm(item.skill_id),
  ].join("|");
}

function hasRequiredBindingFields(item) {
  return Boolean(
    norm(item.bind_target) &&
      Object.prototype.hasOwnProperty.call(item, "priority") &&
      norm(item.status) &&
      item.config_patch &&
      typeof item.config_patch === "object" &&
      !Array.isArray(item.config_patch)
  );
}

async function main() {
  const pool = new Pool({
    host: process.env.PGHOST ?? "127.0.0.1",
    port: Number(process.env.PGPORT ?? "5432"),
    database: process.env.PGDATABASE ?? "geox",
    user: process.env.PGUSER ?? "geox",
    password: process.env.PGPASSWORD ?? "geox",
  });

  try {
    const { rows } = await pool.query(
      `SELECT fact_id, occurred_at, record_json::jsonb AS record_json
         FROM facts
        WHERE (record_json::jsonb->>'type') = 'skill_binding_v1'
          AND (record_json::jsonb#>>'{payload,tenant_id}') = $1
          AND (record_json::jsonb#>>'{payload,project_id}') = $2
          AND (record_json::jsonb#>>'{payload,group_id}') = $3
        ORDER BY occurred_at DESC, fact_id DESC`,
      [tenantId, projectId, groupId]
    );

    const items = rows
      .map((row) => {
        const payload = row.record_json?.payload ?? {};
        return {
          fact_id: norm(row.fact_id),
          occurred_at: toIso(row.occurred_at),
          tenant_id: norm(payload.tenant_id),
          project_id: norm(payload.project_id),
          group_id: norm(payload.group_id),
          skill_id: norm(payload.skill_id),
          scope_type: norm(payload.scope_type).toUpperCase(),
          bind_target: norm(payload.bind_target),
          status: norm(payload.status).toUpperCase(),
          priority: Number.isFinite(Number(payload.priority)) ? Number(payload.priority) : 0,
          config_patch: payload.config_patch && typeof payload.config_patch === "object" && !Array.isArray(payload.config_patch) ? payload.config_patch : {},
        };
      })
      .filter((item) => item.skill_id);

    const grouped = new Map();
    for (const item of items) {
      const key = makeKey(item);
      const list = grouped.get(key) ?? [];
      list.push(item);
      grouped.set(key, list);
    }

    const itemsEffective = [];
    for (const group of grouped.values()) {
      const timeline = [...group].sort((a, b) => {
        const t = Date.parse(a.occurred_at) - Date.parse(b.occurred_at);
        if (t !== 0) return t;
        return a.fact_id.localeCompare(b.fact_id);
      });
      const winner = timeline[timeline.length - 1];
      if (winner) itemsEffective.push(winner);
    }

    const effectiveSkillIds = [...new Set(itemsEffective.map((it) => it.skill_id))].sort();
    const missingSkillIds = expectedSkillIds.filter((id) => !effectiveSkillIds.includes(id));
    const invalidRequiredFields = itemsEffective.filter((it) => !hasRequiredBindingFields(it));

    console.log(`[p1_verify_bindings] effective_count=${itemsEffective.length}`);
    console.log(`[p1_verify_bindings] effective_skill_ids=${effectiveSkillIds.join(",")}`);

    if (missingSkillIds.length > 0) {
      console.error(`[p1_verify_bindings] missing_expected_skill_ids=${missingSkillIds.join(",")}`);
      process.exitCode = 1;
      return;
    }

    if (invalidRequiredFields.length > 0) {
      console.error(`[p1_verify_bindings] invalid_required_fields_count=${invalidRequiredFields.length}`);
      process.exitCode = 1;
      return;
    }

    console.log("[p1_verify_bindings] verification_passed=true");
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(`[p1_verify_bindings] error=${err?.message ?? err}`);
  process.exit(1);
});
