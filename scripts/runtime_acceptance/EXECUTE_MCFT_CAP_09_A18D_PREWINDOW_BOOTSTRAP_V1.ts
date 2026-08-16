import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { Pool, type PoolClient } from "pg";

import {
  MCFT_CAP09_EXTERNAL_FORMAL_CONFIGURATION_MATRIX_HASH_V1,
  MCFT_CAP09_EXTERNAL_FORMAL_CONFIGURATION_MATRIX_REF_V1,
  MCFT_CAP09_EXTERNAL_FORMAL_GEOMETRY_SEMANTIC_HASH_V1,
  MCFT_CAP09_EXTERNAL_FORMAL_MODEL_HYDRAULIC_PRIOR_V1,
  type ExternalFormalBootstrapAuthorityBundleV1,
} from "../../apps/server/src/domain/twin_runtime/external_formal_bootstrap_authority_bundle_v1.js";
import {
  buildExternalFormalPrewindowAuthorityBundleV2,
  deriveExternalFormalCropStageContextHashV2,
  MCFT_CAP09_A18_CONFIG_AUTHORITY_CREATED_AT_V2,
  MCFT_CAP09_A18_O00_LOGICAL_TIME_V2,
  MCFT_CAP09_A18_O23_LOGICAL_TIME_V2,
  MCFT_CAP09_A18_PREWINDOW_A0_LOGICAL_TIME_V2,
  MCFT_CAP09_A18_SELECTED_EPOCH_ID_V2,
} from "../../apps/server/src/domain/twin_runtime/external_formal_prewindow_authority_bundle_v2.js";
import { MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1 } from "../../apps/server/src/domain/twin_runtime/external_formal_runtime_config_v1.js";
import { PostgresNextTickRepositoryV1 } from "../../apps/server/src/persistence/twin_runtime/postgres_next_tick_repository_v1.js";
import { PostgresRuntimeRepositoryV1 } from "../../apps/server/src/persistence/twin_runtime/postgres_runtime_repository_v1.js";
import { ExternalFormalA0EvidenceWindowServiceV1 } from "../../apps/server/src/runtime/twin_runtime/external_formal_a0_evidence_window_service_v1.js";
import { ExternalFormalBootstrapPersistenceServiceV1 } from "../../apps/server/src/runtime/twin_runtime/external_formal_bootstrap_persistence_service_v1.js";
import type {
  CanonicalReplayEvidenceRecordV1,
  ReplayEvidenceSourcePortV1,
  TwinScopeKeyV1,
} from "../../apps/server/src/runtime/twin_runtime/ports.js";

const AUTHORITY_PATH = path.resolve("docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-A18D-PREWINDOW-BOOTSTRAP-EXECUTION-AUTHORITY-V1.json");
const A18B_PATH = path.resolve("docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-A18B-PREWINDOW-A0-AND-REPLACEMENT-RUNTIME-CONFIG-CHAIN-V1.json");
const OUTPUT_DIR = path.resolve("acceptance-output");
const OUTPUT_PATH = path.join(OUTPUT_DIR, "MCFT_CAP_09_A18D_PREWINDOW_BOOTSTRAP_RESULT.json");

const FORMAL_DATABASE = "geox_mcft_cap09_s6_formal_t3r1_24h_v2";
const HISTORICAL_DATABASE = "geox_mcft_cap09_s6_formal_t3r1_24h";
const A0 = "2026-08-17T19:00:00.000Z";
const O00 = "2026-08-17T20:00:00.000Z";
const O23 = "2026-08-18T19:00:00.000Z";
const A0_SOIL_DATASET = "mcft_cap09_formal_v2_prewindow_a0_soil_20260817t190000z";
const A0_SOIL_WINDOW_START = "2026-08-17T18:00:00.000Z";
const LEASE_OWNER = "mcft-cap09-a18d-prewindow-bootstrap-writer-v1";
const LEASE_DURATION_SECONDS = 600;

const EVIDENCE_TYPES = [
  "soil_moisture_observation_v1",
  "observed_rainfall_v1",
  "historical_et0_estimate_v1",
  "future_weather_assumption_v1",
  "future_et0_assumption_v1",
] as const;

const SCOPE_FIELDS = ["tenant_id", "project_id", "group_id", "field_id", "season_id", "zone_id"] as const;

type A18BAuthority = {
  schema_version: string;
  selected_epoch_id: string;
  config_authority_created_at: string;
  prewindow_a0: {
    logical_time: string;
    crop_stage_code: "MID";
    crop_stage_context_hash: string;
    runtime_config_ref: string;
    runtime_config_hash: string;
    parent_runtime_config_ref: null;
    parent_runtime_config_hash: null;
  };
  hourly_runtime_config_pins: Array<[string, string, string, string]>;
};

type A18DAuthority = {
  schema_version: string;
  exact_predecessor_protected_main: string;
  selected_epoch: { epoch_id: string; prewindow_a0: string; o00: string; o23: string };
  formal_store: { database_name: string };
  execution_gate: {
    a18d_effective_if_present_on_protected_main: boolean;
    execution_not_before_actual_wall_clock: string;
    execution_must_complete_before: string;
  };
};

type RuntimeFootprint = {
  total_facts: number;
  evidence_facts: number;
  twin_facts: number;
  runtime_configs: number;
  active_lineage: number;
  state_latest: number;
  forecast_result_latest: number;
  forecast_success_latest: number;
  checkpoint_latest: number;
  scheduler_cursors: number;
  scheduler_slots: number;
  terminal_ticks: number;
  downstream_action_facts: number;
};

type ExpectedConfigPin = {
  slot_id: "A0" | string;
  logical_time: string;
  ref: string;
  hash: string;
};

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`A18D_ENV_REQUIRED:${name}`);
  return value;
}

function canonicalIso(value: string, code: string): string {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== value) throw new Error(code);
  return value;
}

function loadAuthority(): A18DAuthority {
  const authority = JSON.parse(fs.readFileSync(AUTHORITY_PATH, "utf8")) as A18DAuthority;
  if (authority.schema_version !== "geox_mcft_cap09_a18d_prewindow_bootstrap_execution_authority_v1") throw new Error("A18D_AUTHORITY_SCHEMA_REQUIRED");
  if (authority.selected_epoch?.epoch_id !== MCFT_CAP09_A18_SELECTED_EPOCH_ID_V2 || authority.selected_epoch?.prewindow_a0 !== A0 || authority.selected_epoch?.o00 !== O00 || authority.selected_epoch?.o23 !== O23) throw new Error("A18D_AUTHORITY_EPOCH_DRIFT");
  if (authority.formal_store?.database_name !== FORMAL_DATABASE) throw new Error("A18D_AUTHORITY_DATABASE_DRIFT");
  if (authority.execution_gate?.a18d_effective_if_present_on_protected_main !== true || authority.execution_gate?.execution_not_before_actual_wall_clock !== A0 || authority.execution_gate?.execution_must_complete_before !== O00) throw new Error("A18D_AUTHORITY_EXECUTION_GATE_DRIFT");
  return authority;
}

function loadA18B(): A18BAuthority {
  const authority = JSON.parse(fs.readFileSync(A18B_PATH, "utf8")) as A18BAuthority;
  if (authority.schema_version !== "geox_mcft_cap09_a18b_prewindow_config_chain_authority_v1") throw new Error("A18D_A18B_SCHEMA_REQUIRED");
  if (authority.selected_epoch_id !== MCFT_CAP09_A18_SELECTED_EPOCH_ID_V2 || authority.config_authority_created_at !== MCFT_CAP09_A18_CONFIG_AUTHORITY_CREATED_AT_V2) throw new Error("A18D_A18B_EPOCH_OR_CREATED_AT_DRIFT");
  if (authority.prewindow_a0.logical_time !== A0 || authority.prewindow_a0.crop_stage_code !== "MID" || authority.prewindow_a0.parent_runtime_config_ref !== null || authority.prewindow_a0.parent_runtime_config_hash !== null) throw new Error("A18D_A18B_A0_DRIFT");
  if (!Array.isArray(authority.hourly_runtime_config_pins) || authority.hourly_runtime_config_pins.length !== 24) throw new Error("A18D_A18B_EXACT_24_PINS_REQUIRED");
  return authority;
}

function buildAndVerifyBundle(): {
  persistence_bundle: ExternalFormalBootstrapAuthorityBundleV1;
  expected_pins: ExpectedConfigPin[];
} {
  const frozen = loadA18B();
  const hourlyCropPins = frozen.hourly_runtime_config_pins.map(([slotId, logicalTime], index) => {
    const expectedSlot = `O${String(index).padStart(2, "0")}`;
    if (slotId !== expectedSlot) throw new Error(`A18D_A18B_SLOT_ID_DRIFT:${expectedSlot}`);
    const expectedTime = new Date(Date.parse(O00) + index * 3_600_000).toISOString();
    if (logicalTime !== expectedTime) throw new Error(`A18D_A18B_SLOT_TIME_DRIFT:${expectedSlot}`);
    return {
      slot_id: slotId,
      logical_time: logicalTime,
      crop_stage_code: "MID" as const,
      crop_stage_context_hash: deriveExternalFormalCropStageContextHashV2({
        crop_stage_code: "MID",
        derivation_authority_time: logicalTime,
      }),
    };
  });
  const bundle = buildExternalFormalPrewindowAuthorityBundleV2({
    bootstrap_logical_time: A0,
    created_at: frozen.config_authority_created_at,
    bootstrap_crop_stage_code: "MID",
    hourly_crop_pins: hourlyCropPins,
  });
  if (bundle.bootstrap_crop_stage_context_hash !== frozen.prewindow_a0.crop_stage_context_hash) throw new Error("A18D_A0_CROP_HASH_DRIFT");
  if (bundle.bootstrap_runtime_config.object_id !== frozen.prewindow_a0.runtime_config_ref || bundle.bootstrap_runtime_config.determinism_hash !== frozen.prewindow_a0.runtime_config_hash) throw new Error("A18D_A0_CONFIG_PIN_DRIFT");

  const expectedPins: ExpectedConfigPin[] = [{
    slot_id: "A0",
    logical_time: A0,
    ref: frozen.prewindow_a0.runtime_config_ref,
    hash: frozen.prewindow_a0.runtime_config_hash,
  }];
  for (let index = 0; index < 24; index += 1) {
    const [slotId, logicalTime, ref, hash] = frozen.hourly_runtime_config_pins[index]!;
    const generated = bundle.runtime_configs[index]!;
    if (generated.logical_time !== logicalTime || generated.object_id !== ref || generated.determinism_hash !== hash) throw new Error(`A18D_HOURLY_CONFIG_PIN_DRIFT:${slotId}`);
    expectedPins.push({ slot_id: slotId, logical_time: logicalTime, ref, hash });
  }
  if (expectedPins.at(-1)?.logical_time !== MCFT_CAP09_A18_O23_LOGICAL_TIME_V2 || MCFT_CAP09_A18_O00_LOGICAL_TIME_V2 !== O00 || MCFT_CAP09_A18_PREWINDOW_A0_LOGICAL_TIME_V2 !== A0) throw new Error("A18D_COMPILED_EPOCH_CONSTANT_DRIFT");

  const persistenceBundle: ExternalFormalBootstrapAuthorityBundleV1 = {
    scope: bundle.scope,
    bootstrap_logical_time: bundle.bootstrap_logical_time,
    window_start_utc: O00,
    crop_stage_code: "MID",
    crop_stage_context_hash: bundle.bootstrap_crop_stage_context_hash,
    geometry_semantic_hash: MCFT_CAP09_EXTERNAL_FORMAL_GEOMETRY_SEMANTIC_HASH_V1,
    reality_binding_snapshot: bundle.reality_binding_snapshot,
    bootstrap_runtime_config: bundle.bootstrap_runtime_config,
    runtime_configs: bundle.runtime_configs,
    hydraulic: MCFT_CAP09_EXTERNAL_FORMAL_MODEL_HYDRAULIC_PRIOR_V1,
    model_prior_ref: MCFT_CAP09_EXTERNAL_FORMAL_CONFIGURATION_MATRIX_REF_V1,
    model_prior_hash: MCFT_CAP09_EXTERNAL_FORMAL_CONFIGURATION_MATRIX_HASH_V1,
  };
  return { persistence_bundle: persistenceBundle, expected_pins: expectedPins };
}

function assertExactProtectedMain(subject: string, authority: A18DAuthority): void {
  if (!/^[0-9a-f]{40}$/.test(subject)) throw new Error("A18D_SUBJECT_SHA_INVALID");
  if (!["schedule", "workflow_dispatch"].includes(process.env.GITHUB_EVENT_NAME ?? "")) throw new Error("A18D_SCHEDULE_OR_MANUAL_EVENT_REQUIRED");
  if (process.env.GITHUB_REF !== "refs/heads/main" || process.env.GITHUB_SHA !== subject) throw new Error("A18D_EXACT_PROTECTED_MAIN_REQUIRED");
  if (!authority.exact_predecessor_protected_main || authority.exact_predecessor_protected_main.length !== 40) throw new Error("A18D_AUTHORITY_PREDECESSOR_INVALID");
}

function assertExecutionWallClock(now: string): void {
  const canonical = canonicalIso(now, "A18D_EXECUTION_TIME_INVALID");
  if (Date.parse(canonical) < Date.parse(A0)) throw new Error("A18D_EXECUTION_BEFORE_ACTUAL_19Z_FORBIDDEN");
  if (Date.parse(canonical) >= Date.parse(O00)) throw new Error("A18D_EXECUTION_AT_OR_AFTER_O00_FORBIDDEN");
}

async function assertFormalDatabase(pool: Pool, databaseUrl: string): Promise<void> {
  const parsed = new URL(databaseUrl);
  if (["localhost", "127.0.0.1", "::1"].includes(parsed.hostname)) throw new Error("A18D_REMOTE_FORMAL_DATABASE_REQUIRED");
  const name = parsed.pathname.replace(/^\//, "");
  if (name !== FORMAL_DATABASE || name === HISTORICAL_DATABASE) throw new Error("A18D_REPLACEMENT_DATABASE_REQUIRED");
  const result = await pool.query("SELECT current_database() AS database_name");
  if (String(result.rows[0]?.database_name ?? "") !== FORMAL_DATABASE) throw new Error("A18D_DATABASE_SESSION_IDENTITY_REQUIRED");
}

class FormalDatabaseEvidenceSourceV1 implements ReplayEvidenceSourcePortV1 {
  public constructor(private readonly pool: Pool) {}
  public async loadCandidateRecords(input: { scope: TwinScopeKeyV1; logical_time: string }): Promise<readonly CanonicalReplayEvidenceRecordV1[]> {
    assert.deepEqual(input.scope, MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1, "A18D_EVIDENCE_SCOPE_MISMATCH");
    const result = await this.pool.query(
      `SELECT record_json->'payload' AS payload
         FROM public.facts
        WHERE record_json->'payload'->>'tenant_id'=$1
          AND record_json->'payload'->>'project_id'=$2
          AND record_json->'payload'->>'group_id'=$3
          AND record_json->'payload'->>'field_id'=$4
          AND record_json->'payload'->>'season_id'=$5
          AND record_json->'payload'->>'zone_id'=$6
          AND record_json->>'type'=ANY($7::text[])
        ORDER BY occurred_at ASC, fact_id ASC`,
      [
        MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1.tenant_id,
        MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1.project_id,
        MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1.group_id,
        MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1.field_id,
        MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1.season_id,
        MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1.zone_id,
        [...EVIDENCE_TYPES],
      ],
    );
    return result.rows.map((row) => row.payload as CanonicalReplayEvidenceRecordV1);
  }
}

async function readFootprint(queryable: Pool | PoolClient): Promise<RuntimeFootprint> {
  const p = Object.values(MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1);
  const result = await queryable.query(`
    SELECT
      (SELECT count(*)::int FROM facts) AS total_facts,
      (SELECT count(*)::int FROM facts WHERE source='mcft_cap09_external_formal_evidence_v1') AS evidence_facts,
      (SELECT count(*)::int FROM facts WHERE record_json->>'type' LIKE 'twin_%') AS twin_facts,
      (SELECT count(*)::int FROM facts WHERE record_json->>'type'='twin_runtime_config_v1') AS runtime_configs,
      (SELECT count(*)::int FROM twin_active_lineage_index_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6) AS active_lineage,
      (SELECT count(*)::int FROM twin_state_latest_index_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6) AS state_latest,
      (SELECT count(*)::int FROM twin_forecast_result_latest_index_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6) AS forecast_result_latest,
      (SELECT count(*)::int FROM twin_forecast_success_latest_index_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6) AS forecast_success_latest,
      (SELECT count(*)::int FROM twin_runtime_checkpoint_latest_index_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6) AS checkpoint_latest,
      (SELECT count(*)::int FROM twin_shadow_online_scheduler_cursor_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6) AS scheduler_cursors,
      (SELECT count(*)::int FROM twin_shadow_online_scheduler_slot_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6) AS scheduler_slots,
      (SELECT count(*)::int FROM twin_terminal_tick_uniqueness_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6) AS terminal_ticks,
      (SELECT count(*)::int FROM facts WHERE record_json->>'type' SIMILAR TO '(decision|recommendation|approval|ao_act|operation)%') AS downstream_action_facts
  `, p);
  const row = result.rows[0] ?? {};
  return Object.fromEntries(Object.entries(row).map(([key, value]) => [key, Number(value)])) as RuntimeFootprint;
}

async function readPersistedConfigs(pool: Pool): Promise<Map<string, { hash: string; logical_time: string }>> {
  const p = Object.values(MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1);
  const result = await pool.query(
    `SELECT record_json->'payload' AS object
       FROM public.facts
      WHERE record_json->>'type'='twin_runtime_config_v1'
        AND record_json->'payload'->'scope'->>'tenant_id'=$1
        AND record_json->'payload'->'scope'->>'project_id'=$2
        AND record_json->'payload'->'scope'->>'group_id'=$3
        AND record_json->'payload'->'scope'->>'field_id'=$4
        AND record_json->'payload'->'scope'->>'season_id'=$5
        AND record_json->'payload'->'scope'->>'zone_id'=$6
      ORDER BY occurred_at ASC, fact_id ASC`, p);
  const out = new Map<string, { hash: string; logical_time: string }>();
  for (const row of result.rows) {
    const object = row.object as { object_id?: string; determinism_hash?: string; logical_time?: string };
    const ref = String(object.object_id ?? "");
    if (!ref || out.has(ref)) throw new Error(`A18D_RUNTIME_CONFIG_DUPLICATE_OR_INVALID:${ref}`);
    out.set(ref, { hash: String(object.determinism_hash ?? ""), logical_time: String(object.logical_time ?? "") });
  }
  return out;
}

async function assertExistingConfigSubsetExact(pool: Pool, expectedPins: ExpectedConfigPin[]): Promise<Map<string, { hash: string; logical_time: string }>> {
  const actual = await readPersistedConfigs(pool);
  const expected = new Map(expectedPins.map((pin) => [pin.ref, pin]));
  if (actual.size > expected.size) throw new Error(`A18D_RUNTIME_CONFIG_OVERFLOW:${actual.size}`);
  for (const [ref, value] of actual) {
    const pin = expected.get(ref);
    if (!pin || pin.hash !== value.hash || pin.logical_time !== value.logical_time) throw new Error(`A18D_RUNTIME_CONFIG_FOREIGN_OR_DRIFTED:${ref}`);
  }
  return actual;
}

async function assertUsableA0SoilFact(pool: Pool): Promise<void> {
  const result = await pool.query(
    `SELECT record_json->'payload' AS payload
       FROM public.facts
      WHERE source='mcft_cap09_external_formal_evidence_v1'
        AND record_json->'payload'->>'dataset_id'=$1
      ORDER BY occurred_at ASC, fact_id ASC`, [A0_SOIL_DATASET]);
  if (result.rowCount !== 1) throw new Error(`A18D_EXACT_ONE_A0_SOIL_DATASET_FACT_REQUIRED:${result.rowCount ?? -1}`);
  const p = result.rows[0].payload as Record<string, any>;
  if (p.record_type !== "soil_moisture_observation_v1") throw new Error("A18D_A0_SOIL_RECORD_TYPE_REQUIRED");
  const observed = canonicalIso(String(p.role_time?.observed_at ?? ""), "A18D_A0_SOIL_OBSERVED_AT_INVALID");
  const available = canonicalIso(String(p.available_to_runtime_at ?? ""), "A18D_A0_SOIL_AVAILABLE_AT_INVALID");
  const ingested = canonicalIso(String(p.role_time?.ingested_at ?? ""), "A18D_A0_SOIL_INGESTED_AT_INVALID");
  if (Date.parse(observed) <= Date.parse(A0_SOIL_WINDOW_START) || Date.parse(observed) > Date.parse(A0)) throw new Error("A18D_A0_SOIL_OBSERVED_OUTSIDE_EXACT_WINDOW");
  if (Date.parse(available) > Date.parse(A0) || Date.parse(ingested) > Date.parse(A0)) throw new Error("A18D_A0_SOIL_LATE_FOR_BOOTSTRAP_FORBIDDEN");
  if (String(p.quality?.status ?? "") === "FAIL") throw new Error("A18D_A0_SOIL_QUALITY_FAIL_FORBIDDEN");
}

function assertPreBootstrapFootprint(footprint: RuntimeFootprint, configCount: number): void {
  if (footprint.scheduler_cursors !== 0 || footprint.scheduler_slots !== 0 || footprint.terminal_ticks !== 0 || footprint.downstream_action_facts !== 0) throw new Error(`A18D_PREBOOTSTRAP_FORBIDDEN_RUNTIME_SIDE_EFFECT:${JSON.stringify(footprint)}`);
  if (footprint.runtime_configs !== configCount) throw new Error(`A18D_RUNTIME_CONFIG_COUNT_QUERY_MISMATCH:${footprint.runtime_configs}:${configCount}`);
  const projectionTuple = [footprint.active_lineage, footprint.state_latest, footprint.checkpoint_latest];
  const allZero = projectionTuple.every((v) => v === 0);
  const allOne = projectionTuple.every((v) => v === 1);
  if (!allZero && !allOne) throw new Error(`A18D_PARTIAL_BOOTSTRAP_PROJECTION_FORBIDDEN:${projectionTuple.join(",")}`);
  if (allZero && configCount > 1) throw new Error(`A18D_HOURLY_CONFIG_WITHOUT_BOOTSTRAP_STATE_FORBIDDEN:${configCount}`);
  if (allOne && configCount < 1) throw new Error("A18D_BOOTSTRAP_STATE_WITHOUT_A0_CONFIG_FORBIDDEN");
}

async function assertCompletedBootstrap(pool: Pool, expectedPins: ExpectedConfigPin[]): Promise<RuntimeFootprint> {
  const actualConfigs = await assertExistingConfigSubsetExact(pool, expectedPins);
  if (actualConfigs.size !== 25) throw new Error(`A18D_EXACT_25_CONFIGS_REQUIRED:${actualConfigs.size}`);
  const footprint = await readFootprint(pool);
  if (footprint.runtime_configs !== 25 || footprint.active_lineage !== 1 || footprint.state_latest !== 1 || footprint.checkpoint_latest !== 1) throw new Error(`A18D_POSTBOOTSTRAP_CORE_PROJECTION_REQUIRED:${JSON.stringify(footprint)}`);
  if (footprint.scheduler_cursors !== 0 || footprint.scheduler_slots !== 0 || footprint.terminal_ticks !== 0 || footprint.downstream_action_facts !== 0) throw new Error(`A18D_POSTBOOTSTRAP_NONSTART_REQUIRED:${JSON.stringify(footprint)}`);
  const snapshot = await new PostgresNextTickRepositoryV1(pool).readPersistedNextTickSnapshot({ ...MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1 });
  if (!snapshot) throw new Error("A18D_NEXT_TICK_SNAPSHOT_REQUIRED");
  const a0Pin = expectedPins[0]!;
  if (snapshot.runtime_config.object_id !== a0Pin.ref || snapshot.runtime_config.determinism_hash !== a0Pin.hash) throw new Error("A18D_ACTIVE_RUNTIME_CONFIG_MUST_BE_FRESH_A0");
  if (snapshot.checkpoint.runtime_config_ref !== a0Pin.ref || snapshot.checkpoint.payload.next_tick_logical_time !== O00) throw new Error("A18D_CHECKPOINT_NEXT_TICK_MUST_EQUAL_O00");
  if (snapshot.previous_posterior.runtime_config_ref !== a0Pin.ref) throw new Error("A18D_PREVIOUS_POSTERIOR_MUST_BIND_A0_CONFIG");
  if (snapshot.previous_forecast_result?.payload.status !== "BLOCKED") throw new Error("A18D_A0_FORECAST_MUST_BE_BLOCKED");
  if (Date.now() >= Date.parse(O00)) throw new Error("A18D_POSTBOOTSTRAP_PROOF_AFTER_O00_FORBIDDEN");
  return footprint;
}

async function readOnlyPreflight(pool: Pool, expectedPins: ExpectedConfigPin[]): Promise<{ footprint: RuntimeFootprint; existing_config_count: number; a0_soil_dataset_count: number }> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN READ ONLY");
    const footprint = await readFootprint(client);
    if (footprint.twin_facts !== 0 || footprint.runtime_configs !== 0 || footprint.active_lineage !== 0 || footprint.state_latest !== 0 || footprint.checkpoint_latest !== 0 || footprint.scheduler_cursors !== 0 || footprint.scheduler_slots !== 0 || footprint.terminal_ticks !== 0 || footprint.downstream_action_facts !== 0) throw new Error(`A18D_QUALIFICATION_RUNTIME_ZERO_STATE_REQUIRED:${JSON.stringify(footprint)}`);
    const soil = await client.query("SELECT count(*)::int AS n FROM facts WHERE source='mcft_cap09_external_formal_evidence_v1' AND record_json->'payload'->>'dataset_id'=$1", [A0_SOIL_DATASET]);
    const soilCount = Number(soil.rows[0]?.n ?? 0);
    if (![0, 1].includes(soilCount)) throw new Error(`A18D_QUALIFICATION_A0_SOIL_CARDINALITY_INVALID:${soilCount}`);
    await client.query("ROLLBACK");
    return { footprint, existing_config_count: 0, a0_soil_dataset_count: soilCount };
  } catch (error) {
    try { await client.query("ROLLBACK"); } catch {}
    throw error;
  } finally {
    client.release();
  }
}

async function executeBootstrap(pool: Pool, expectedPins: ExpectedConfigPin[], persistenceBundle: ExternalFormalBootstrapAuthorityBundleV1): Promise<{ execution_mode: string; runtime_config_write_count: number; a0_member_write_count: number }> {
  await assertUsableA0SoilFact(pool);
  const evidenceSource = new FormalDatabaseEvidenceSourceV1(pool);
  await new ExternalFormalA0EvidenceWindowServiceV1(evidenceSource).prepare({
    scope: MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1,
    logical_time: A0,
  });

  const existingConfigs = await assertExistingConfigSubsetExact(pool, expectedPins);
  const before = await readFootprint(pool);
  assertPreBootstrapFootprint(before, existingConfigs.size);

  if (before.active_lineage === 1) {
    const snapshot = await new PostgresNextTickRepositoryV1(pool).readPersistedNextTickSnapshot({ ...MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1 });
    if (!snapshot || snapshot.runtime_config.object_id !== expectedPins[0]!.ref || snapshot.runtime_config.determinism_hash !== expectedPins[0]!.hash || snapshot.checkpoint.payload.next_tick_logical_time !== O00) throw new Error("A18D_RETRY_EXISTING_BOOTSTRAP_STATE_DRIFT");
    const runtimeRepository = new PostgresRuntimeRepositoryV1(pool);
    let writes = 0;
    for (const config of persistenceBundle.runtime_configs) {
      const committed = await runtimeRepository.commitRuntimeConfig(config);
      if (committed.status === "INSERTED") writes += 1;
    }
    return { execution_mode: "RETRY_EXISTING_A0_STATE_COMPLETE_CONFIG_CHAIN", runtime_config_write_count: writes, a0_member_write_count: 0 };
  }

  const runtimeRepository = new PostgresRuntimeRepositoryV1(pool);
  const service = new ExternalFormalBootstrapPersistenceServiceV1({
    runtime_config_repository: runtimeRepository,
    bootstrap_persistence: runtimeRepository,
    authority_snapshot_repository: new PostgresNextTickRepositoryV1(pool),
    evidence_source: evidenceSource,
  });
  const persisted = await service.execute({
    bundle: persistenceBundle,
    created_at: new Date().toISOString(),
    lease_owner: LEASE_OWNER,
    lease_duration_seconds: LEASE_DURATION_SECONDS,
  });
  if (persisted.provider_request_count !== 0 || persisted.scheduler_slot_write_count !== 0 || persisted.formal_window_started !== false || persisted.hourly_runtime_config_count !== 24) throw new Error("A18D_PERSISTENCE_SERVICE_SIDE_EFFECT_BOUNDARY_DRIFT");
  return {
    execution_mode: persisted.status === "INSERTED" ? "FRESH_A0_BOOTSTRAP_INSERTED" : "IDEMPOTENT_BOOTSTRAP_REVERIFIED",
    runtime_config_write_count: persisted.runtime_config_write_count,
    a0_member_write_count: persisted.a0_member_write_count,
  };
}

function selftest(): void {
  loadAuthority();
  const { persistence_bundle, expected_pins } = buildAndVerifyBundle();
  if (expected_pins.length !== 25 || expected_pins[0]?.slot_id !== "A0" || expected_pins[1]?.slot_id !== "O00" || expected_pins[24]?.slot_id !== "O23") throw new Error("A18D_SELFTEST_EXACT_25_PIN_ORDER_REQUIRED");
  if (persistence_bundle.bootstrap_logical_time !== A0 || persistence_bundle.window_start_utc !== O00 || persistence_bundle.runtime_configs.length !== 24) throw new Error("A18D_SELFTEST_BUNDLE_RANGE_REQUIRED");
  console.log(JSON.stringify({
    status: "PASS",
    epoch_id: MCFT_CAP09_A18_SELECTED_EPOCH_ID_V2,
    prewindow_a0: A0,
    o00: O00,
    o23: O23,
    exact_config_pin_count: expected_pins.length,
    a0_config_ref: expected_pins[0].ref,
    a0_config_hash: expected_pins[0].hash,
    o00_config_ref: expected_pins[1].ref,
    o00_config_hash: expected_pins[1].hash,
    execution_not_before: A0,
    execution_must_complete_before: O00,
    provider_request_count: 0,
    database_write_count: 0,
    scheduler_write_count: 0,
    formal_o00_started: false,
  }));
}

async function main(): Promise<void> {
  const mode = process.argv[2];
  if (mode === "selftest") return selftest();
  if (!["preflight", "execute"].includes(mode ?? "")) throw new Error("A18D_MODE_REQUIRED");

  const authority = loadAuthority();
  const { persistence_bundle, expected_pins } = buildAndVerifyBundle();
  const databaseUrl = requiredEnv("DATABASE_URL");
  const pool = new Pool({ connectionString: databaseUrl, application_name: `mcft-cap09-a18d-${mode}` });
  try {
    await assertFormalDatabase(pool, databaseUrl);
    if (mode === "preflight") {
      const proof = await readOnlyPreflight(pool, expected_pins);
      const result = {
        schema_version: "geox_mcft_cap09_a18d_prewindow_bootstrap_preflight_v1",
        status: "PASS",
        transaction_mode: "READ_ONLY",
        formal_database_name: FORMAL_DATABASE,
        epoch_id: MCFT_CAP09_A18_SELECTED_EPOCH_ID_V2,
        prewindow_a0: A0,
        o00: O00,
        exact_config_pin_count: expected_pins.length,
        ...proof,
        provider_request_count: 0,
        database_write_count: 0,
        scheduler_write_count: 0,
        canonical_runtime_tick_write_count: 0,
        formal_o00_started: false,
      };
      fs.mkdirSync(OUTPUT_DIR, { recursive: true });
      fs.writeFileSync(OUTPUT_PATH, JSON.stringify(result, null, 2) + "\n");
      console.log(JSON.stringify(result));
      return;
    }

    const subject = requiredEnv("MCFT_CAP09_SUBJECT_SHA");
    assertExactProtectedMain(subject, authority);
    const executionStartedAt = new Date().toISOString();
    assertExecutionWallClock(executionStartedAt);
    const execution = await executeBootstrap(pool, expected_pins, persistence_bundle);
    const footprint = await assertCompletedBootstrap(pool, expected_pins);
    const executionCompletedAt = new Date().toISOString();
    assertExecutionWallClock(executionCompletedAt);
    const result = {
      schema_version: "geox_mcft_cap09_a18d_prewindow_bootstrap_execution_result_v1",
      status: "PASS",
      subject_sha: subject,
      epoch_id: MCFT_CAP09_A18_SELECTED_EPOCH_ID_V2,
      formal_database_name: FORMAL_DATABASE,
      execution_started_at: executionStartedAt,
      execution_completed_at: executionCompletedAt,
      execution_not_before: A0,
      execution_must_complete_before: O00,
      execution_mode: execution.execution_mode,
      exact_config_pin_count: 25,
      runtime_config_write_count_this_execution: execution.runtime_config_write_count,
      a0_member_write_count_this_execution: execution.a0_member_write_count,
      active_runtime_config_ref: expected_pins[0].ref,
      active_runtime_config_hash: expected_pins[0].hash,
      checkpoint_next_tick_logical_time: O00,
      observed_runtime_config_count: footprint.runtime_configs,
      observed_active_lineage_count: footprint.active_lineage,
      observed_state_latest_count: footprint.state_latest,
      observed_checkpoint_count: footprint.checkpoint_latest,
      observed_scheduler_cursor_count: footprint.scheduler_cursors,
      observed_scheduler_slot_count: footprint.scheduler_slots,
      observed_terminal_tick_count: footprint.terminal_ticks,
      observed_downstream_action_fact_count: footprint.downstream_action_facts,
      provider_request_count: 0,
      scheduler_write_count: 0,
      canonical_runtime_tick_write_count: 0,
      formal_o00_started: false,
      formal_execution_count: "0/24",
    };
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(result, null, 2) + "\n");
    console.log(JSON.stringify(result));
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
});
