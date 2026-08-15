import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { Pool } from "pg";

import {
  MCFT_CAP09_EXTERNAL_FORMAL_AUTHORITY_BLOBS_V1,
  buildExternalFormalBootstrapAuthorityBundleV1,
} from "../../apps/server/src/domain/twin_runtime/external_formal_bootstrap_authority_bundle_v1.js";
import {
  MCFT_CAP09_EXTERNAL_FORMAL_SOIL_BINDING_ID_V1,
} from "../../apps/server/src/domain/twin_runtime/external_formal_evidence_binding_profile_v1.js";
import {
  MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1,
} from "../../apps/server/src/domain/twin_runtime/external_formal_runtime_config_v1.js";
import {
  createFormalDurableRawEvidenceRetentionAdapterV1,
} from "../../apps/server/src/external_evidence/formal_durable_raw_store_binding_v1.js";
import {
  executeFormalLiveKbsSoilIngressV1,
} from "../../apps/server/src/external_evidence/formal_live_kbs_soil_ingress_executor_v1.js";
import { PostgresNextTickRepositoryV1 } from "../../apps/server/src/persistence/twin_runtime/postgres_next_tick_repository_v1.js";
import { PostgresRuntimeRepositoryV1 } from "../../apps/server/src/persistence/twin_runtime/postgres_runtime_repository_v1.js";
import {
  ExternalFormalBootstrapPersistenceServiceV1,
} from "../../apps/server/src/runtime/twin_runtime/external_formal_bootstrap_persistence_service_v1.js";
import type {
  CanonicalReplayEvidenceRecordV1,
  ReplayEvidenceSourcePortV1,
  TwinScopeKeyV1,
} from "../../apps/server/src/runtime/twin_runtime/ports.js";

const OUT = path.resolve("acceptance-output/MCFT_CAP_09_T3R1_FRESH_BOOTSTRAP_RESULT.json");
const AUTH_PATH = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-T3R1-FRESH-BOOTSTRAP-EXECUTION-AUTHORITY-V1.json";
const AUTH_BLOB = "d97129915ae5f7720b3a3d8e5561a2842213da65";
const CROP_PATH = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S6-FORMAL-CROP-CONTEXT-AUTHORITY-V2.json";
const CROP_BLOB = "757e4b9f4fdcd631eea97fca85614a1b61ef0c4a";
const EXPECTED_PROJECT = "delicate-glade-62464340";
const EXPECTED_BRANCH = "br-cold-dust-a6j6aymz";
const FORBIDDEN_SIMULATION_BRANCH = "br-falling-cake-a6lfsdak";
const EXPECTED_DATABASE = "geox_mcft_cap09_s6_formal_t3r1_24h";
const FORBIDDEN_T1_DATABASE = "geox_mcft_cap09_s6_formal_24h";
const EXECUTION_TOKEN = "EXECUTE_T3R1_FRESH_BOOTSTRAP";
const MINIMUM_BOOTSTRAP_LEAD_MINUTES = 25;
const SOIL_COLLECTION_OFFSET_MINUTES = -8;
const HOUR_MS = 3_600_000;
const MINUTE_MS = 60_000;
const LEASE_OWNER = "mcft-cap09-t3r1-fresh-bootstrap-writer";

const T1R1_SCOPE = Object.freeze({
  tenant_id: "tenant_mcft_external",
  project_id: "project_mcft_cap09",
  group_id: "group_public_research",
  field_id: "field_kbs_mcse_t1r1",
  season_id: "season_2026_corn",
  zone_id: "zone_kbs_mcse_t1r1_formal_v1",
});

const SCOPE_FIELDS = ["tenant_id", "project_id", "group_id", "field_id", "season_id", "zone_id"] as const;

type CropAuthorityV2 = {
  planting_authority: {
    possible_event_window_utc: { start_inclusive: string; end_exclusive: string };
  };
  model_stage_prior: {
    variant_stage_lengths_days: readonly (readonly number[])[];
  };
  as_of_derivation_policy: {
    backward_stability_hours: number;
    forward_transition_guard_hours: number;
    planting_time_uncertainty_must_be_carried: boolean;
    future_observations_authorized: boolean;
    allowed_stage_codes: readonly string[];
  };
};

type CountSnapshot = {
  totalFacts: number;
  scopeFacts: number;
  twinFacts: number;
  runtimeConfigs: number;
  nonTwinFacts: number;
  schedulerSlots: number;
  schedulerCursors: number;
  t1r1ScopeRows: number;
};

type PersistedConfigPins = {
  bootstrapLogicalTime: string;
  o00LogicalTime: string;
  a0ConfigRef: string;
  a0ConfigHash: string;
  o00ConfigRef: string;
  o00ConfigHash: string;
};

function write(value: unknown): void {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, `${JSON.stringify(value, null, 2)}\n`);
  console.log(JSON.stringify(value, null, 2));
}

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`T3R1_FRESH_BOOTSTRAP_ENV_REQUIRED:${name}`);
  return value;
}

function exactIso(value: string, code: string): string {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== value) throw new Error(code);
  return value;
}

function stageAt(ageDays: number, lengths: readonly number[]): "INITIAL" | "DEVELOPMENT" | "MID" | "LATE" | null {
  assert.equal(lengths.length, 4, "T3R1_FRESH_BOOTSTRAP_EXACT_FOUR_STAGE_LENGTHS_REQUIRED");
  assert(lengths.every((value) => Number.isFinite(value)), "T3R1_FRESH_BOOTSTRAP_FINITE_STAGE_LENGTHS_REQUIRED");
  const b1 = lengths[0]!;
  const b2 = b1 + lengths[1]!;
  const b3 = b2 + lengths[2]!;
  const b4 = b3 + lengths[3]!;
  if (ageDays < 0 || ageDays >= b4) return null;
  if (ageDays < b1) return "INITIAL";
  if (ageDays < b2) return "DEVELOPMENT";
  if (ageDays < b3) return "MID";
  return "LATE";
}

function deriveCropStageAtBoundary(bootstrapLogicalTime: string): "INITIAL" | "DEVELOPMENT" | "MID" | "LATE" {
  assert.equal(execFileSync("git", ["rev-parse", `HEAD:${CROP_PATH}`], { encoding: "utf8" }).trim(), CROP_BLOB, "T3R1_FRESH_BOOTSTRAP_CROP_AUTHORITY_BLOB_DRIFT");
  const authority = JSON.parse(fs.readFileSync(CROP_PATH, "utf8")) as CropAuthorityV2;
  const plantingStart = Date.parse(authority.planting_authority.possible_event_window_utc.start_inclusive);
  const plantingEndExclusive = Date.parse(authority.planting_authority.possible_event_window_utc.end_exclusive);
  assert(Number.isFinite(plantingStart) && Number.isFinite(plantingEndExclusive), "T3R1_FRESH_BOOTSTRAP_PLANTING_WINDOW_INVALID");
  assert.equal(plantingEndExclusive - plantingStart, 24 * HOUR_MS, "T3R1_FRESH_BOOTSTRAP_PLANTING_DAY_UNCERTAINTY_REQUIRED");
  const variants = authority.model_stage_prior.variant_stage_lengths_days;
  assert.equal(variants.length, 6, "T3R1_FRESH_BOOTSTRAP_EXACT_SIX_FAO_VARIANTS_REQUIRED");
  const policy = authority.as_of_derivation_policy;
  assert.equal(policy.backward_stability_hours, 6, "T3R1_FRESH_BOOTSTRAP_BACKWARD_GUARD_DRIFT");
  assert.equal(policy.forward_transition_guard_hours, 30, "T3R1_FRESH_BOOTSTRAP_FORWARD_GUARD_DRIFT");
  assert.equal(policy.planting_time_uncertainty_must_be_carried, true, "T3R1_FRESH_BOOTSTRAP_PLANTING_UNCERTAINTY_REQUIRED");
  assert.equal(policy.future_observations_authorized, false, "T3R1_FRESH_BOOTSTRAP_FUTURE_OBSERVATION_FORBIDDEN");
  const boundary = Date.parse(bootstrapLogicalTime);
  const plantingTimes = [plantingStart, plantingEndExclusive - 1];
  const guardTimes = [boundary - 6 * HOUR_MS, boundary, boundary + 30 * HOUR_MS];
  const stages = new Set<string>();
  for (const variant of variants) {
    for (const plantingTime of plantingTimes) {
      for (const guardTime of guardTimes) {
        const stage = stageAt((guardTime - plantingTime) / (24 * HOUR_MS), variant);
        assert(stage, "T3R1_FRESH_BOOTSTRAP_STAGE_OUTSIDE_FROZEN_MODEL_WINDOW");
        stages.add(stage);
      }
    }
  }
  assert.equal(stages.size, 1, `T3R1_FRESH_BOOTSTRAP_STAGE_CONSERVATIVE_CONSENSUS_REQUIRED:${[...stages].sort().join(",")}`);
  const stage = [...stages][0] as "INITIAL" | "DEVELOPMENT" | "MID" | "LATE";
  assert(policy.allowed_stage_codes.includes(stage), `T3R1_FRESH_BOOTSTRAP_STAGE_NOT_ALLOWED:${stage}`);
  assert.equal(stage, "MID", `T3R1_FRESH_BOOTSTRAP_CURRENT_EXECUTION_WINDOW_EXPECTED_MID:${stage}`);
  return stage;
}

function chooseBootstrapBoundary(nowMs: number): string {
  const earliest = nowMs + MINIMUM_BOOTSTRAP_LEAD_MINUTES * MINUTE_MS;
  const boundary = Math.ceil(earliest / HOUR_MS) * HOUR_MS;
  assert(boundary - nowMs >= MINIMUM_BOOTSTRAP_LEAD_MINUTES * MINUTE_MS, "T3R1_FRESH_BOOTSTRAP_MINIMUM_LEAD_REQUIRED");
  return new Date(boundary).toISOString();
}

async function waitUntil(targetIso: string, phase: string): Promise<void> {
  const target = Date.parse(targetIso);
  const remaining = target - Date.now();
  if (remaining <= 0) return;
  assert(remaining <= 90 * MINUTE_MS, `T3R1_FRESH_BOOTSTRAP_WAIT_TOO_LONG:${phase}:${remaining}`);
  console.log(JSON.stringify({ phase, wait_until: targetIso, remaining_minutes: remaining / MINUTE_MS }));
  await new Promise<void>((resolve) => setTimeout(resolve, remaining));
}

class FreshFormalDatabaseEvidenceSourceV1 implements ReplayEvidenceSourcePortV1 {
  public constructor(private readonly pool: Pool) {}

  public async loadCandidateRecords(input: {
    scope: TwinScopeKeyV1;
    logical_time: string;
  }): Promise<readonly CanonicalReplayEvidenceRecordV1[]> {
    assert.deepEqual(input.scope, MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1, "T3R1_FRESH_BOOTSTRAP_EVIDENCE_SCOPE_MISMATCH");
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
        [
          "soil_moisture_observation_v1",
          "observed_rainfall_v1",
          "historical_et0_estimate_v1",
          "future_weather_assumption_v1",
          "future_et0_assumption_v1",
        ],
      ],
    );
    return result.rows.map((row) => row.payload as CanonicalReplayEvidenceRecordV1);
  }
}

async function scopeRowCount(pool: Pool, target: Record<string, string>): Promise<number> {
  const values = SCOPE_FIELDS.map((field) => target[field]);
  const row = (await pool.query<{ total: number }>(`
    SELECT (
      (SELECT count(*) FROM facts WHERE
        (record_json#>>'{payload,tenant_id}'=$1 OR record_json#>>'{payload,scope,tenant_id}'=$1) AND
        (record_json#>>'{payload,project_id}'=$2 OR record_json#>>'{payload,scope,project_id}'=$2) AND
        (record_json#>>'{payload,group_id}'=$3 OR record_json#>>'{payload,scope,group_id}'=$3) AND
        (record_json#>>'{payload,field_id}'=$4 OR record_json#>>'{payload,scope,field_id}'=$4) AND
        (record_json#>>'{payload,season_id}'=$5 OR record_json#>>'{payload,scope,season_id}'=$5) AND
        (record_json#>>'{payload,zone_id}'=$6 OR record_json#>>'{payload,scope,zone_id}'=$6)) +
      (SELECT count(*) FROM twin_active_lineage_index_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6) +
      (SELECT count(*) FROM twin_state_latest_index_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6) +
      (SELECT count(*) FROM twin_forecast_result_latest_index_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6) +
      (SELECT count(*) FROM twin_runtime_checkpoint_latest_index_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6) +
      (SELECT count(*) FROM twin_runtime_lease_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6) +
      (SELECT count(*) FROM twin_shadow_online_scheduler_cursor_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6) +
      (SELECT count(*) FROM twin_shadow_online_scheduler_slot_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6)
    )::int AS total`, values)).rows[0];
  return Number(row?.total ?? -1);
}

async function counts(pool: Pool): Promise<CountSnapshot> {
  const params = Object.values(MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1);
  const row = (await pool.query(`
    SELECT
      (SELECT count(*)::int FROM facts) AS total_facts,
      (SELECT count(*)::int FROM facts
        WHERE record_json->'payload'->>'tenant_id'=$1 AND record_json->'payload'->>'project_id'=$2
          AND record_json->'payload'->>'group_id'=$3 AND record_json->'payload'->>'field_id'=$4
          AND record_json->'payload'->>'season_id'=$5 AND record_json->'payload'->>'zone_id'=$6) AS scope_facts,
      (SELECT count(*)::int FROM facts WHERE record_json->>'type' LIKE 'twin_%') AS twin_facts,
      (SELECT count(*)::int FROM facts WHERE record_json->>'type'='twin_runtime_config_v1') AS runtime_configs,
      (SELECT count(*)::int FROM facts WHERE record_json->>'type' NOT LIKE 'twin_%') AS non_twin_facts,
      (SELECT count(*)::int FROM twin_shadow_online_scheduler_slot_v1) AS scheduler_slots,
      (SELECT count(*)::int FROM twin_shadow_online_scheduler_cursor_v1) AS scheduler_cursors
  `, params)).rows[0];
  return {
    totalFacts: Number(row.total_facts),
    scopeFacts: Number(row.scope_facts),
    twinFacts: Number(row.twin_facts),
    runtimeConfigs: Number(row.runtime_configs),
    nonTwinFacts: Number(row.non_twin_facts),
    schedulerSlots: Number(row.scheduler_slots),
    schedulerCursors: Number(row.scheduler_cursors),
    t1r1ScopeRows: await scopeRowCount(pool, T1R1_SCOPE),
  };
}

async function assertExactFreshZeroState(pool: Pool): Promise<void> {
  const c = await counts(pool);
  assert.deepEqual(c, {
    totalFacts: 0,
    scopeFacts: 0,
    twinFacts: 0,
    runtimeConfigs: 0,
    nonTwinFacts: 0,
    schedulerSlots: 0,
    schedulerCursors: 0,
    t1r1ScopeRows: 0,
  }, `T3R1_FRESH_BOOTSTRAP_ZERO_STATE_REQUIRED:${JSON.stringify(c)}`);
  const projection = (await pool.query(`
    SELECT
      (SELECT count(*)::int FROM twin_active_lineage_index_v1) AS active_lineage,
      (SELECT count(*)::int FROM twin_state_latest_index_v1) AS state_latest,
      (SELECT count(*)::int FROM twin_forecast_result_latest_index_v1) AS forecast_latest,
      (SELECT count(*)::int FROM twin_runtime_checkpoint_latest_index_v1) AS checkpoint_latest,
      (SELECT count(*)::int FROM twin_runtime_lease_v1) AS runtime_lease
  `)).rows[0];
  for (const [key, value] of Object.entries(projection)) {
    assert.equal(Number(value), 0, `T3R1_FRESH_BOOTSTRAP_ZERO_PROJECTION_REQUIRED:${key}:${value}`);
  }
}

async function verifyPersistedBootstrap(pool: Pool): Promise<PersistedConfigPins> {
  const params = Object.values(MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1);
  const result = await pool.query(
    `SELECT record_json->'payload' AS object
       FROM public.facts
      WHERE record_json->>'type'='twin_runtime_config_v1'
        AND record_json->'payload'->>'tenant_id'=$1 AND record_json->'payload'->>'project_id'=$2
        AND record_json->'payload'->>'group_id'=$3 AND record_json->'payload'->>'field_id'=$4
        AND record_json->'payload'->>'season_id'=$5 AND record_json->'payload'->>'zone_id'=$6
      ORDER BY (record_json->'payload'->>'logical_time')::timestamptz ASC`, params);
  assert.equal(result.rows.length, 25, "T3R1_FRESH_BOOTSTRAP_EXACT_25_RUNTIME_CONFIGS_REQUIRED");
  let parent: Record<string, unknown> | null = null;
  let bootstrapLogicalTime = "";
  for (let index = 0; index < result.rows.length; index += 1) {
    const object = result.rows[index].object as Record<string, unknown>;
    const payload = object.payload as Record<string, any>;
    const logicalTime = exactIso(String(object.logical_time), `T3R1_FRESH_BOOTSTRAP_CONFIG_LOGICAL_TIME_INVALID:${index}`);
    if (index === 0) {
      bootstrapLogicalTime = logicalTime;
      assert.equal(payload.config_role, "A0_BOOTSTRAP", "T3R1_FRESH_BOOTSTRAP_A0_ROLE_REQUIRED");
      assert.equal(payload.parent_runtime_config_ref, null, "T3R1_FRESH_BOOTSTRAP_A0_PARENT_REF_MUST_BE_NULL");
      assert.equal(payload.parent_runtime_config_hash, null, "T3R1_FRESH_BOOTSTRAP_A0_PARENT_HASH_MUST_BE_NULL");
      assert.equal(payload.formal_authorities?.crop_context?.ref, MCFT_CAP09_EXTERNAL_FORMAL_AUTHORITY_BLOBS_V1.crop_context.ref, "T3R1_FRESH_BOOTSTRAP_A0_CROP_REF_DRIFT");
      assert.equal(payload.formal_authorities?.crop_context?.hash, MCFT_CAP09_EXTERNAL_FORMAL_AUTHORITY_BLOBS_V1.crop_context.hash, "T3R1_FRESH_BOOTSTRAP_A0_CROP_HASH_DRIFT");
      assert.equal(payload.formal_authorities?.fresh_database?.ref, MCFT_CAP09_EXTERNAL_FORMAL_AUTHORITY_BLOBS_V1.fresh_database.ref, "T3R1_FRESH_BOOTSTRAP_A0_FRESH_DB_REF_DRIFT");
      assert.equal(payload.formal_authorities?.fresh_database?.hash, MCFT_CAP09_EXTERNAL_FORMAL_AUTHORITY_BLOBS_V1.fresh_database.hash, "T3R1_FRESH_BOOTSTRAP_A0_FRESH_DB_HASH_DRIFT");
    } else {
      assert.equal(logicalTime, new Date(Date.parse(bootstrapLogicalTime) + index * HOUR_MS).toISOString(), `T3R1_FRESH_BOOTSTRAP_CONFIG_TIME_CHAIN:${index}`);
      assert.equal(payload.config_role, "HOURLY_CAP04", `T3R1_FRESH_BOOTSTRAP_HOURLY_ROLE:${index}`);
      assert.equal(payload.parent_runtime_config_ref, parent?.object_id, `T3R1_FRESH_BOOTSTRAP_PARENT_REF:${index}`);
      assert.equal(payload.parent_runtime_config_hash, parent?.determinism_hash, `T3R1_FRESH_BOOTSTRAP_PARENT_HASH:${index}`);
    }
    assert.equal(payload.config_selection_mode, "EXPLICIT_REF_HASH_PIN_ONLY", `T3R1_FRESH_BOOTSTRAP_EXPLICIT_PIN_REQUIRED:${index}`);
    assert.equal(payload.runtime_mode, "SHADOW_ONLINE_FORMAL_QUALIFICATION_ONLY", `T3R1_FRESH_BOOTSTRAP_RUNTIME_MODE_REQUIRED:${index}`);
    for (const [key, expected] of Object.entries(MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1)) {
      assert.equal(object[key], expected, `T3R1_FRESH_BOOTSTRAP_CONFIG_SCOPE_DRIFT:${index}:${key}`);
    }
    parent = object;
  }
  const a0 = result.rows[0].object as Record<string, unknown>;
  const o00 = result.rows[1].object as Record<string, unknown>;
  const snapshot = await new PostgresNextTickRepositoryV1(pool).readPersistedNextTickSnapshot({ ...MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1 });
  assert(snapshot, "T3R1_FRESH_BOOTSTRAP_NEXT_TICK_SNAPSHOT_REQUIRED");
  assert.equal(snapshot.runtime_config.object_id, a0.object_id, "T3R1_FRESH_BOOTSTRAP_ACTIVE_A0_REF_REQUIRED");
  assert.equal(snapshot.runtime_config.determinism_hash, a0.determinism_hash, "T3R1_FRESH_BOOTSTRAP_ACTIVE_A0_HASH_REQUIRED");
  assert.equal(snapshot.checkpoint.runtime_config_ref, a0.object_id, "T3R1_FRESH_BOOTSTRAP_CHECKPOINT_A0_REQUIRED");
  assert.equal(snapshot.checkpoint.payload.next_tick_logical_time, o00.logical_time, "T3R1_FRESH_BOOTSTRAP_NEXT_TICK_O00_REQUIRED");
  assert.equal(snapshot.previous_posterior.runtime_config_ref, a0.object_id, "T3R1_FRESH_BOOTSTRAP_POSTERIOR_A0_REQUIRED");
  assert.equal(snapshot.previous_forecast_result?.payload.status, "BLOCKED", "T3R1_FRESH_BOOTSTRAP_A0_FORECAST_BLOCKED_REQUIRED");
  return {
    bootstrapLogicalTime,
    o00LogicalTime: String(o00.logical_time),
    a0ConfigRef: String(a0.object_id),
    a0ConfigHash: String(a0.determinism_hash),
    o00ConfigRef: String(o00.object_id),
    o00ConfigHash: String(o00.determinism_hash),
  };
}

async function verifyOneFreshSoilFact(pool: Pool, bootstrapLogicalTime: string): Promise<{ observedAt: string; availableAt: string }> {
  const params = Object.values(MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1);
  const rows = (await pool.query(
    `SELECT source, record_json->>'type' AS record_type,
            record_json->'payload'->>'binding_id' AS binding_id,
            record_json->'payload'->'role_time'->>'observed_at' AS observed_at,
            record_json->'payload'->>'available_to_runtime_at' AS available_at
       FROM public.facts
      WHERE record_json->>'type' NOT LIKE 'twin_%'
        AND record_json->'payload'->>'tenant_id'=$1 AND record_json->'payload'->>'project_id'=$2
        AND record_json->'payload'->>'group_id'=$3 AND record_json->'payload'->>'field_id'=$4
        AND record_json->'payload'->>'season_id'=$5 AND record_json->'payload'->>'zone_id'=$6`, params)).rows;
  assert.equal(rows.length, 1, `T3R1_FRESH_BOOTSTRAP_EXACT_ONE_EVIDENCE_FACT_REQUIRED:${rows.length}`);
  const row = rows[0];
  assert.equal(row.source, "mcft_cap09_external_formal_evidence_v1", "T3R1_FRESH_BOOTSTRAP_EVIDENCE_SOURCE_REQUIRED");
  assert.equal(row.record_type, "soil_moisture_observation_v1", "T3R1_FRESH_BOOTSTRAP_SOIL_EVIDENCE_REQUIRED");
  assert.equal(row.binding_id, MCFT_CAP09_EXTERNAL_FORMAL_SOIL_BINDING_ID_V1, "T3R1_FRESH_BOOTSTRAP_SOIL_BINDING_REQUIRED");
  const observedAt = exactIso(String(row.observed_at), "T3R1_FRESH_BOOTSTRAP_SOIL_OBSERVED_AT_INVALID");
  const availableAt = exactIso(String(row.available_at), "T3R1_FRESH_BOOTSTRAP_SOIL_AVAILABLE_AT_INVALID");
  const boundary = Date.parse(bootstrapLogicalTime);
  assert(Date.parse(observedAt) > boundary - HOUR_MS && Date.parse(observedAt) <= boundary, "T3R1_FRESH_BOOTSTRAP_SOIL_OUTSIDE_A0_WINDOW");
  assert(Date.parse(availableAt) <= boundary, "T3R1_FRESH_BOOTSTRAP_SOIL_AVAILABLE_AFTER_BOUNDARY");
  return { observedAt, availableAt };
}

async function main(): Promise<void> {
  const subjectSha = requiredEnv("GITHUB_SHA");
  assert.match(subjectSha, /^[0-9a-f]{40}$/, "T3R1_FRESH_BOOTSTRAP_EXACT_SHA_REQUIRED");
  assert.equal(process.env.GITHUB_REF, "refs/heads/main", "T3R1_FRESH_BOOTSTRAP_PROTECTED_MAIN_ONLY");
  assert.equal(requiredEnv("MCFT_CAP09_T3R1_BOOTSTRAP_EXECUTION_TOKEN"), EXECUTION_TOKEN, "T3R1_FRESH_BOOTSTRAP_EXECUTION_TOKEN_MISMATCH");
  assert.equal(execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(), subjectSha, "T3R1_FRESH_BOOTSTRAP_HEAD_SHA_MISMATCH");
  assert.equal(execFileSync("git", ["rev-parse", "origin/main"], { encoding: "utf8" }).trim(), subjectSha, "T3R1_FRESH_BOOTSTRAP_PROTECTED_MAIN_DRIFT");
  assert.equal(execFileSync("git", ["rev-parse", `HEAD:${AUTH_PATH}`], { encoding: "utf8" }).trim(), AUTH_BLOB, "T3R1_FRESH_BOOTSTRAP_EXECUTION_AUTHORITY_BLOB_DRIFT");

  const authority = JSON.parse(fs.readFileSync(AUTH_PATH, "utf8")) as Record<string, any>;
  assert.equal(authority.authorized_effect?.fresh_t3r1_bootstrap_authorized, true, "T3R1_FRESH_BOOTSTRAP_AUTHORIZATION_REQUIRED");
  assert.equal(authority.authorized_effect?.ea5e2_operational_activation_authorized, false, "T3R1_FRESH_BOOTSTRAP_EA5E2_MUST_REMAIN_FALSE");
  assert.equal(authority.authorized_effect?.formal_o00_start_authorized, false, "T3R1_FRESH_BOOTSTRAP_O00_MUST_REMAIN_FALSE");
  assert.deepEqual(authority.scope, MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1, "T3R1_FRESH_BOOTSTRAP_AUTHORITY_SCOPE_DRIFT");

  const databaseUrl = requiredEnv("GEOX_MCFT_CAP09_T3R1_S6_DATABASE_URL");
  const pool = new Pool({
    connectionString: databaseUrl,
    application_name: `mcft-cap09-t3r1-fresh-bootstrap-${subjectSha.slice(0, 12)}`,
    max: 4,
  });
  const retention = createFormalDurableRawEvidenceRetentionAdapterV1(process.env);
  let result: Record<string, unknown> = {
    schema_version: "geox_mcft_cap09_t3r1_fresh_bootstrap_result_v1",
    status: "FAIL",
    subject_sha: subjectSha,
    database_write_count: 0,
    provider_request_count: 0,
    scheduler_slot_write_count: 0,
    scheduler_cursor_write_count: 0,
    formal_window_started: false,
    ea5e2_operational_activation_authorized: false,
    formal_o00_start_authorized: false,
    mcft_cap09_completed: false,
  };

  try {
    const identity = (await pool.query(`
      SELECT current_database() AS database_name,
             current_setting('neon.project_id', true) AS neon_project_id,
             current_setting('neon.branch_id', true) AS neon_branch_id,
             current_setting('server_version_num')::int AS server_version_num
    `)).rows[0];
    assert.equal(identity.database_name, EXPECTED_DATABASE, "T3R1_FRESH_BOOTSTRAP_DATABASE_IDENTITY_MISMATCH");
    assert.notEqual(identity.database_name, FORBIDDEN_T1_DATABASE, "T3R1_FRESH_BOOTSTRAP_T1_DATABASE_FORBIDDEN");
    assert.equal(identity.neon_project_id, EXPECTED_PROJECT, "T3R1_FRESH_BOOTSTRAP_NEON_PROJECT_DRIFT");
    assert.equal(identity.neon_branch_id, EXPECTED_BRANCH, "T3R1_FRESH_BOOTSTRAP_NEON_BRANCH_DRIFT");
    assert.notEqual(identity.neon_branch_id, FORBIDDEN_SIMULATION_BRANCH, "T3R1_FRESH_BOOTSTRAP_SIMULATION_BRANCH_FORBIDDEN");
    assert(Number(identity.server_version_num) >= 180000, "T3R1_FRESH_BOOTSTRAP_POSTGRES18_REQUIRED");

    const before = await counts(pool);
    let executionMode: "FIRST_FRESH_BOOTSTRAP" | "EXISTING_FRESH_BOOTSTRAP_REVERIFIED";
    let providerRequestCount = 0;
    let freshEvidenceWriteCount = 0;
    let canonicalBootstrapWriteCount = 0;
    let pins: PersistedConfigPins;

    if (before.twinFacts === 0) {
      await assertExactFreshZeroState(pool);
      executionMode = "FIRST_FRESH_BOOTSTRAP";
      const bootstrapLogicalTime = chooseBootstrapBoundary(Date.now());
      const soilCollectionTime = new Date(Date.parse(bootstrapLogicalTime) + SOIL_COLLECTION_OFFSET_MINUTES * MINUTE_MS).toISOString();
      await waitUntil(soilCollectionTime, "WAIT_FOR_AUTHORIZED_SOIL_COLLECTION_POINT");
      const soil = await executeFormalLiveKbsSoilIngressV1({ pool, retention: retention.adapter });
      providerRequestCount = 1;
      freshEvidenceWriteCount = soil.canonical_fact_write_count;
      assert.equal(soil.binding_id, MCFT_CAP09_EXTERNAL_FORMAL_SOIL_BINDING_ID_V1, "T3R1_FRESH_BOOTSTRAP_LIVE_SOIL_BINDING_DRIFT");
      assert.equal(freshEvidenceWriteCount, 1, "T3R1_FRESH_BOOTSTRAP_EXACT_ONE_FRESH_EVIDENCE_WRITE_REQUIRED");
      assert.equal(soil.raw_value_emitted, false, "T3R1_FRESH_BOOTSTRAP_RAW_VALUE_PUBLICATION_FORBIDDEN");
      assert.equal(soil.runtime_public_provider_fetch_count, 0, "T3R1_FRESH_BOOTSTRAP_RUNTIME_PROVIDER_FETCH_FORBIDDEN");
      const soilObservedAt = exactIso(soil.observed_at, "T3R1_FRESH_BOOTSTRAP_LIVE_SOIL_OBSERVED_AT_INVALID");
      const soilAvailableAt = exactIso(soil.retrieved_at, "T3R1_FRESH_BOOTSTRAP_LIVE_SOIL_AVAILABLE_AT_INVALID");
      assert(Date.parse(soilObservedAt) > Date.parse(bootstrapLogicalTime) - HOUR_MS, "T3R1_FRESH_BOOTSTRAP_LIVE_SOIL_TOO_OLD");
      assert(Date.parse(soilObservedAt) <= Date.parse(bootstrapLogicalTime), "T3R1_FRESH_BOOTSTRAP_LIVE_SOIL_AFTER_BOUNDARY");
      assert(Date.parse(soilAvailableAt) <= Date.parse(bootstrapLogicalTime), "T3R1_FRESH_BOOTSTRAP_LIVE_SOIL_AVAILABLE_AFTER_BOUNDARY");

      await waitUntil(new Date(Date.parse(bootstrapLogicalTime) + 1_500).toISOString(), "WAIT_FOR_REAL_BOOTSTRAP_BOUNDARY");
      assert(Date.now() >= Date.parse(bootstrapLogicalTime), "T3R1_FRESH_BOOTSTRAP_WALL_CLOCK_BOUNDARY_REQUIRED");
      const cropStage = deriveCropStageAtBoundary(bootstrapLogicalTime);
      const createdAt = new Date().toISOString();
      const bundle = buildExternalFormalBootstrapAuthorityBundleV1({
        bootstrap_logical_time: bootstrapLogicalTime,
        created_at: createdAt,
        crop_stage_code: cropStage,
        crop_stage_derivation_authority_time: bootstrapLogicalTime,
      });
      const runtimeRepository = new PostgresRuntimeRepositoryV1(pool);
      const service = new ExternalFormalBootstrapPersistenceServiceV1({
        runtime_config_repository: runtimeRepository,
        bootstrap_persistence: runtimeRepository,
        authority_snapshot_repository: new PostgresNextTickRepositoryV1(pool),
        evidence_source: new FreshFormalDatabaseEvidenceSourceV1(pool),
      });
      const persisted = await service.execute({
        bundle,
        created_at: createdAt,
        lease_owner: LEASE_OWNER,
        lease_duration_seconds: 600,
      });
      assert.equal(persisted.status, "INSERTED", "T3R1_FRESH_BOOTSTRAP_INSERT_REQUIRED");
      assert.equal(persisted.runtime_config_write_count, 25, "T3R1_FRESH_BOOTSTRAP_RUNTIME_CONFIG_WRITE_COUNT");
      assert.equal(persisted.a0_member_write_count, 9, "T3R1_FRESH_BOOTSTRAP_A0_MEMBER_WRITE_COUNT");
      assert.equal(persisted.hourly_runtime_config_count, 24, "T3R1_FRESH_BOOTSTRAP_HOURLY_CONFIG_COUNT");
      assert.equal(persisted.formal_window_started, false, "T3R1_FRESH_BOOTSTRAP_FORMAL_WINDOW_START_FORBIDDEN");
      canonicalBootstrapWriteCount = 34;
      pins = await verifyPersistedBootstrap(pool);
      assert.equal(pins.bootstrapLogicalTime, bootstrapLogicalTime, "T3R1_FRESH_BOOTSTRAP_PERSISTED_BOUNDARY_DRIFT");
      await verifyOneFreshSoilFact(pool, bootstrapLogicalTime);
    } else {
      executionMode = "EXISTING_FRESH_BOOTSTRAP_REVERIFIED";
      assert.deepEqual(before, {
        totalFacts: 35,
        scopeFacts: 35,
        twinFacts: 34,
        runtimeConfigs: 25,
        nonTwinFacts: 1,
        schedulerSlots: 0,
        schedulerCursors: 0,
        t1r1ScopeRows: 0,
      }, `T3R1_FRESH_BOOTSTRAP_EXISTING_STATE_INVALID:${JSON.stringify(before)}`);
      pins = await verifyPersistedBootstrap(pool);
      await verifyOneFreshSoilFact(pool, pins.bootstrapLogicalTime);
    }

    const after = await counts(pool);
    assert.deepEqual(after, {
      totalFacts: 35,
      scopeFacts: 35,
      twinFacts: 34,
      runtimeConfigs: 25,
      nonTwinFacts: 1,
      schedulerSlots: 0,
      schedulerCursors: 0,
      t1r1ScopeRows: 0,
    }, `T3R1_FRESH_BOOTSTRAP_FINAL_STATE_INVALID:${JSON.stringify(after)}`);
    const soil = await verifyOneFreshSoilFact(pool, pins.bootstrapLogicalTime);
    result = {
      ...result,
      status: "PASS",
      execution_mode: executionMode,
      database_identity: {
        database_name: identity.database_name,
        neon_project_id: identity.neon_project_id,
        neon_branch_id: identity.neon_branch_id,
        t1r1_database_reused: false,
        simulation_branch_reused: false,
      },
      formal_scope: MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1,
      bootstrap_logical_time: pins.bootstrapLogicalTime,
      o00_candidate_logical_time: pins.o00LogicalTime,
      crop_stage_code: deriveCropStageAtBoundary(pins.bootstrapLogicalTime),
      crop_stage_authority_blob_sha: CROP_BLOB,
      fresh_soil_observed_at: soil.observedAt,
      fresh_soil_available_to_runtime_at: soil.availableAt,
      provider_request_count: providerRequestCount,
      fresh_external_evidence_write_count: freshEvidenceWriteCount,
      canonical_bootstrap_write_count: canonicalBootstrapWriteCount,
      total_fact_write_count_this_execution: freshEvidenceWriteCount + canonicalBootstrapWriteCount,
      final_fact_count: after.totalFacts,
      final_canonical_twin_fact_count: after.twinFacts,
      exact_runtime_config_count: after.runtimeConfigs,
      exact_hourly_runtime_config_count: 24,
      external_a0_member_count: after.twinFacts - after.runtimeConfigs,
      a0_runtime_config_ref: pins.a0ConfigRef,
      a0_runtime_config_hash: pins.a0ConfigHash,
      o00_candidate_runtime_config_ref: pins.o00ConfigRef,
      o00_candidate_runtime_config_hash: pins.o00ConfigHash,
      a0_binding_mode: "DYNAMIC_FRESH_T3R1_PERSISTED_A0_SEMANTIC_BINDING",
      config_parent_chain_verified: true,
      explicit_ref_hash_pin_only: true,
      t1r1_scope_row_count: after.t1r1ScopeRows,
      scheduler_slot_write_count: 0,
      scheduler_cursor_write_count: 0,
      formal_window_started: false,
      fresh_t3r1_bootstrap_complete: true,
      ea5e2_operational_activation_authorized: false,
      formal_o00_start_authorized: false,
      mcft_cap09_completed: false,
      raw_values_emitted: false,
    };
    const publicText = JSON.stringify(result);
    assert.equal(publicText.includes('"value"'), false, "T3R1_FRESH_BOOTSTRAP_PUBLIC_VALUE_LEAK");
    assert.equal(publicText.includes("GEOX_MCFT_CAP09_T3R1_S6_DATABASE_URL"), false, "T3R1_FRESH_BOOTSTRAP_SECRET_NAME_LEAK");
  } catch (error) {
    result = {
      ...result,
      error_code: error instanceof Error ? error.message.slice(0, 300) : String(error).slice(0, 300),
    };
    throw error;
  } finally {
    await pool.end();
    write(result);
  }
}

main().catch(() => {
  process.exitCode = 1;
});
