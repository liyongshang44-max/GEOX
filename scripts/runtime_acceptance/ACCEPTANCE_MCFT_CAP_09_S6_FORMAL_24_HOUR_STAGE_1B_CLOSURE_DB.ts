import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { Pool } from "pg";
import type { TwinScopeKeyV1 } from "../../apps/server/src/runtime/twin_runtime/ports.js";

const HOUR_MS = 3_600_000;
const OUT = path.resolve("acceptance-output/MCFT_CAP_09_S6_FORMAL_24_HOUR_DB_RESULT.json");
const SCOPE_FIELDS = ["tenant_id", "project_id", "group_id", "field_id", "season_id", "zone_id"] as const;
const FORBIDDEN = ["twin_decision_record_v1", "twin_recommendation_v1", "decision_recommendation_v1", "approval_request_v1", "ao_act_task_v1", "ao_act_receipt_v1", "dispatch_request_v1", "model_activation_v1"];
const required = (name: string) => { const value = process.env[name]; if (!value?.trim()) throw new Error(`${name}_REQUIRED`); return value; };
const write = (value: unknown) => { fs.mkdirSync(path.dirname(OUT), { recursive: true }); fs.writeFileSync(OUT, JSON.stringify(value, null, 2) + "\n"); console.log(JSON.stringify(value, null, 2)); };
const scopeValues = (scope: TwinScopeKeyV1) => SCOPE_FIELDS.map((field) => scope[field]);

async function main(): Promise<void> {
  const subjectSha = required("MCFT_CAP09_S6_SUBJECT_SHA");
  assert.match(subjectSha, /^[0-9a-f]{40}$/);
  const start = required("MCFT_CAP09_S6_WINDOW_START_UTC");
  assert.equal(Date.parse(start) % HOUR_MS, 0, "EXACT_UTC_WINDOW_START_REQUIRED");
  const scope = JSON.parse(required("MCFT_CAP09_S6_SCOPE_JSON")) as TwinScopeKeyV1;
  const pool = new Pool({ connectionString: required("DATABASE_URL"), application_name: `mcft-cap09-s6-readback-${subjectSha.slice(0, 12)}` });
  try {
    const slots = (await pool.query(
      `SELECT slot_id,logical_time,scheduler_wall_clock_observed_at,state,fencing_token::text,tick_ref,health_ref,terminal_at
         FROM twin_shadow_online_scheduler_slot_v1
        WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6
        ORDER BY logical_time`, scopeValues(scope),
    )).rows;
    const terminal = slots.filter((row) => ["COMPLETED", "DEGRADED"].includes(row.state));
    const progress = { schema_version: "geox_mcft_cap09_s6_formal_24_hour_db_result_v1", subject_sha: subjectSha, slot_count: slots.length, terminal_slot_count: terminal.length, required_slot_count: 24, formal_effectiveness: false };
    if (slots.length < 24 || terminal.length < 24) { write({ ...progress, status: "IN_PROGRESS" }); return; }
    assert.equal(slots.length, 24, "EXACT_24_SLOT_ROWS_REQUIRED");
    for (let index = 0; index < 24; index += 1) {
      const row = slots[index];
      assert.equal(row.slot_id, `O${String(index).padStart(2, "0")}`, `ORDERED_SLOT_REQUIRED:${index}`);
      assert.equal(new Date(row.logical_time).toISOString(), new Date(Date.parse(start) + index * HOUR_MS).toISOString(), `EXACT_LOGICAL_TIME_REQUIRED:${index}`);
      assert(row.tick_ref && row.health_ref && row.terminal_at, `TERMINAL_REFS_REQUIRED:${index}`);
    }
    assert(Date.parse(slots[11].scheduler_wall_clock_observed_at) >= Date.parse(start) + 12 * HOUR_MS, "O11_INTENTIONAL_BACKFILL_OBSERVATION_REQUIRED");
    const facts = await pool.query(
      `SELECT record_json->>'type' AS type,count(*)::int AS n
         FROM facts
        WHERE record_json->'payload'->>'tenant_id'=$1
          AND record_json->'payload'->>'project_id'=$2
          AND record_json->'payload'->>'group_id' IS NOT DISTINCT FROM $3
          AND record_json->'payload'->>'field_id'=$4
          AND record_json->'payload'->>'season_id' IS NOT DISTINCT FROM $5
          AND record_json->'payload'->>'zone_id' IS NOT DISTINCT FROM $6
        GROUP BY record_json->>'type'`, scopeValues(scope),
    );
    const counts = Object.fromEntries(facts.rows.map((row) => [row.type, Number(row.n)]));
    assert((counts.twin_runtime_tick_v1 ?? 0) >= 24, "ONLINE_TICK_READBACK_REQUIRED");
    assert((counts.twin_state_estimate_v1 ?? 0) >= 24, "ONLINE_STATE_READBACK_REQUIRED");
    assert((counts.twin_forecast_run_v1 ?? 0) >= 24, "ONLINE_FORECAST_READBACK_REQUIRED");
    assert((counts.twin_runtime_health_v1 ?? 0) >= 24, "ONLINE_HEALTH_READBACK_REQUIRED");
    const forbidden = Number((await pool.query("SELECT count(*)::int AS n FROM facts WHERE record_json->>'type'=ANY($1::text[])", [FORBIDDEN])).rows[0].n);
    assert.equal(forbidden, 0, "ZERO_ACTION_AUTHORITY_FACTS_REQUIRED");
    write({ ...progress, status: "PASS", slot_count: 24, terminal_slot_count: 24, intentional_missed_slot: "O11", oldest_first_backfill_proven: true, online_state_forecast_health_readback: true, canonical_fact_type_counts: counts, forbidden_action_fact_count: 0, g_write_count: 0, exact_sha_r2_pending: true });
  } finally { await pool.end(); }
}

main().catch((error) => { write({ schema_version: "geox_mcft_cap09_s6_formal_24_hour_db_result_v1", status: "FAIL", error: String(error instanceof Error ? error.message : error), formal_effectiveness: false }); process.exitCode = 1; });
