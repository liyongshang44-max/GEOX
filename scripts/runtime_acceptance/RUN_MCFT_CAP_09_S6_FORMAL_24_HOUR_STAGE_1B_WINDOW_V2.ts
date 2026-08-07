// Corrected MCFT-CAP-09.S6 formal runner entry.
// Resolves the exact hour-specific immutable Runtime Config from the formal authority
// chain, then delegates to the frozen Stage 1B runner. No clock acceleration or
// Evidence, action, route, scheduler-loop, or model-activation write is added.

import assert from "node:assert/strict";
import { Pool } from "pg";

import { validateCanonicalObjectV1, type CanonicalObjectEnvelopeV1 } from "../../apps/server/src/domain/twin_runtime/canonical_object_contracts_v1.js";
import { PostgresPersistentSequentialSchedulerAdapterV1 } from "../../apps/server/src/runtime/twin_runtime/postgres_persistent_sequential_scheduler_adapter_v1.js";
import type { ExecuteCap04SingleTickInputV1 } from "../../apps/server/src/runtime/twin_runtime/forecast_scenario_single_tick_service_v1.js";
import type { TwinScopeKeyV1 } from "../../apps/server/src/runtime/twin_runtime/ports.js";
import { buildFormalAuthorityBundleV1, sameScopeV1 } from "./mcft_cap09_s6_formal_authority_v1.js";

const HOUR_MS = 3_600_000;

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name}_REQUIRED`);
  return value;
}

function json<T>(name: string): T {
  try { return JSON.parse(required(name)) as T; } catch { throw new Error(`${name}_JSON_INVALID`); }
}

async function prepareExactConfigV1(): Promise<void> {
  const databaseUrl = required("DATABASE_URL");
  const start = required("MCFT_CAP09_S6_WINDOW_START_UTC");
  const scope = json<TwinScopeKeyV1>("MCFT_CAP09_S6_SCOPE_JSON");
  const template = json<ExecuteCap04SingleTickInputV1>("MCFT_CAP09_S6_CANONICAL_INPUT_JSON");
  const authority = buildFormalAuthorityBundleV1(start);
  assert(sameScopeV1(scope, authority.scope), "FORMAL_V2_AUTHORITY_SCOPE_MISMATCH");
  assert(sameScopeV1(scope, template.scope), "FORMAL_V2_TEMPLATE_SCOPE_MISMATCH");
  const nowMs = Date.now();
  const startMs = Date.parse(authority.window_start_utc);
  assert(nowMs >= startMs, "FORMAL_WINDOW_NOT_STARTED");
  const observedHourIndex = Math.floor((nowMs - startMs) / HOUR_MS);
  assert(observedHourIndex <= 24, "FORMAL_WINDOW_OBSERVATION_LATE");
  const throughIndex = Math.min(observedHourIndex, 23);
  const throughLogicalTime = new Date(startMs + throughIndex * HOUR_MS).toISOString();
  const pool = new Pool({ connectionString: databaseUrl, application_name: "mcft-cap09-s6-formal-config-resolver-v2" });
  try {
    const scheduler = new PostgresPersistentSequentialSchedulerAdapterV1(pool, {
      scope,
      schedule_start_logical_time: authority.window_start_utc,
    });
    const due = await scheduler.listMissedSlots({ scope, through_logical_time: throughLogicalTime });
    if (!due.length) return;
    const target = due[0];
    const targetIndex = Number(target.slot_id.slice(1));
    assert(Number.isInteger(targetIndex) && targetIndex >= 0 && targetIndex < 24,
      "FORMAL_V2_TARGET_SLOT_ID_INVALID");
    const expected = authority.runtime_configs[targetIndex];
    assert.equal(expected.logical_time, target.logical_time, "FORMAL_V2_TARGET_CONFIG_TIME_MISMATCH");
    const result = await pool.query(
      `SELECT record_json FROM facts
        WHERE record_json->>'type'='twin_runtime_config_v1'
          AND record_json->'payload'->>'object_id'=$1
        LIMIT 2`,
      [expected.object_id],
    );
    assert.equal(result.rows.length, 1, `FORMAL_V2_EXACT_RUNTIME_CONFIG_CARDINALITY:${target.logical_time}`);
    const persisted = (result.rows[0].record_json as { payload?: CanonicalObjectEnvelopeV1 }).payload;
    assert(persisted, "FORMAL_V2_EXACT_RUNTIME_CONFIG_PAYLOAD_REQUIRED");
    validateCanonicalObjectV1(persisted);
    assert.equal(persisted.determinism_hash, expected.determinism_hash,
      `FORMAL_V2_EXACT_RUNTIME_CONFIG_HASH_MISMATCH:${target.logical_time}`);
    process.env.MCFT_CAP09_S6_CANONICAL_INPUT_JSON = JSON.stringify({
      ...template,
      runtime_config_ref: persisted.object_id,
      runtime_config_hash: persisted.determinism_hash,
    });
  } finally {
    await pool.end();
  }
}

prepareExactConfigV1()
  .then(() => import("./RUN_MCFT_CAP_09_S6_FORMAL_24_HOUR_STAGE_1B_WINDOW.js"))
  .catch((error) => {
    console.error(String(error instanceof Error ? error.message : error));
    process.exitCode = 1;
  });
