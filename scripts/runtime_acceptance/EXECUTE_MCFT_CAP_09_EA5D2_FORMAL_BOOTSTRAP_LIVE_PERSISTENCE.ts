import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";

import {
  MCFT_CAP09_EXTERNAL_FORMAL_SOIL_BINDING_ID_V1,
} from "../../apps/server/src/domain/twin_runtime/external_formal_evidence_binding_profile_v1.js";
import {
  MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1,
} from "../../apps/server/src/domain/twin_runtime/external_formal_runtime_config_v1.js";
import {
  buildExternalFormalBootstrapAuthorityBundleV1,
} from "../../apps/server/src/domain/twin_runtime/external_formal_bootstrap_authority_bundle_v1.js";
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

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const OUT = path.join(ROOT, "acceptance-output/MCFT_CAP_09_EA5D2_FORMAL_BOOTSTRAP_LIVE_PERSISTENCE_RESULT.json");
const EXPECTED_DATABASE = "geox_mcft_cap09_s6_formal_24h";
const BOOTSTRAP_LOGICAL_TIME = "2026-08-09T21:00:00.000Z";
const O00_LOGICAL_TIME = "2026-08-09T22:00:00.000Z";
const EVIDENCE_WINDOW_START = "2026-08-09T20:00:00.000Z";
const COLLECTOR_DEADLINE = "2026-08-09T20:55:00.000Z";
const LEASE_OWNER = "ea5d2-formal-bootstrap-writer";
const STAGE_AUTHORITY_PATH = path.join(
  ROOT,
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA1J-CROP-WATER-USE-STAGE-AUTHORITY-V1.json",
);

type StageAuthorityV1 = {
  planting_authority: { possible_event_window_utc: { start_inclusive: string; end_exclusive: string } };
  model_stage_prior: {
    variants: readonly {
      variant_id: string;
      initial_days: number;
      development_days: number;
      mid_days: number;
      late_days: number;
    }[];
  };
  derivation_policy: {
    backward_stability_hours: number;
    forward_transition_guard_hours: number;
    allowed_stage_codes: readonly string[];
  };
};

type FormalSoilEvidenceSummaryV1 = {
  fact_id: string;
  source_record_id: string;
  binding_id: string;
  observed_at: string;
  available_to_runtime_at: string;
  source: string;
  record_type: string;
};

function exactIso(value: string, code: string): string {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== value) throw new Error(code);
  return value;
}

function stageAtElapsedHours(
  elapsedHours: number,
  variant: StageAuthorityV1["model_stage_prior"]["variants"][number],
): "PRE_PLANTING" | "INITIAL" | "DEVELOPMENT" | "MID" | "LATE" | "POST_MODEL_SEASON" {
  const initialEnd = variant.initial_days * 24;
  const developmentEnd = initialEnd + variant.development_days * 24;
  const midEnd = developmentEnd + variant.mid_days * 24;
  const lateEnd = midEnd + variant.late_days * 24;
  if (elapsedHours < 0) return "PRE_PLANTING";
  if (elapsedHours < initialEnd) return "INITIAL";
  if (elapsedHours < developmentEnd) return "DEVELOPMENT";
  if (elapsedHours < midEnd) return "MID";
  if (elapsedHours < lateEnd) return "LATE";
  return "POST_MODEL_SEASON";
}

function deriveCropStageAtBootstrapV1(): "INITIAL" | "DEVELOPMENT" | "MID" | "LATE" {
  const authority = JSON.parse(fs.readFileSync(STAGE_AUTHORITY_PATH, "utf8")) as StageAuthorityV1;
  const authorityMs = Date.parse(BOOTSTRAP_LOGICAL_TIME);
  const plantingStart = Date.parse(authority.planting_authority.possible_event_window_utc.start_inclusive);
  const plantingEnd = Date.parse(authority.planting_authority.possible_event_window_utc.end_exclusive);
  const backward = authority.derivation_policy.backward_stability_hours;
  const forward = authority.derivation_policy.forward_transition_guard_hours;
  assert.equal(plantingEnd - plantingStart, 24 * 3_600_000, "EA5D2_PLANTING_DAY_UNCERTAINTY_REQUIRED");
  const currentMin = (authorityMs - plantingEnd) / 3_600_000;
  const currentMax = (authorityMs - plantingStart) / 3_600_000;
  const guardMin = (authorityMs - backward * 3_600_000 - plantingEnd) / 3_600_000;
  const guardMax = (authorityMs + forward * 3_600_000 - plantingStart) / 3_600_000;
  const stages = authority.model_stage_prior.variants.map((variant) => {
    const currentMinStage = stageAtElapsedHours(currentMin, variant);
    const currentMaxStage = stageAtElapsedHours(currentMax, variant);
    const guardMinStage = stageAtElapsedHours(guardMin, variant);
    const guardMaxStage = stageAtElapsedHours(guardMax, variant);
    assert.equal(currentMinStage, currentMaxStage, `EA5D2_STAGE_PLANTING_UNCERTAINTY:${variant.variant_id}`);
    assert.equal(guardMinStage, currentMinStage, `EA5D2_STAGE_BACKWARD_GUARD:${variant.variant_id}`);
    assert.equal(guardMaxStage, currentMinStage, `EA5D2_STAGE_FORWARD_GUARD:${variant.variant_id}`);
    return currentMinStage;
  });
  assert.equal(new Set(stages).size, 1, "EA5D2_STAGE_CONSERVATIVE_CONSENSUS_REQUIRED");
  const stage = stages[0];
  assert.ok(authority.derivation_policy.allowed_stage_codes.includes(stage), `EA5D2_STAGE_NOT_ALLOWED:${stage}`);
  assert.equal(stage, "MID", "EA5D2_FROZEN_BOOTSTRAP_STAGE_EXPECTED_MID");
  return stage;
}

class FormalDatabaseEvidenceSourceV1 implements ReplayEvidenceSourcePortV1 {
  public constructor(private readonly pool: Pool) {}
  public async loadCandidateRecords(input: {
    scope: TwinScopeKeyV1;
    logical_time: string;
  }): Promise<readonly CanonicalReplayEvidenceRecordV1[]> {
    assert.equal(input.logical_time, BOOTSTRAP_LOGICAL_TIME, "EA5D2_A0_EVIDENCE_LOGICAL_TIME_MISMATCH");
    assert.deepEqual(input.scope, MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1, "EA5D2_A0_EVIDENCE_SCOPE_MISMATCH");
    const result = await this.pool.query(
      `SELECT record_json->'payload' AS payload FROM public.facts
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
        ["soil_moisture_observation_v1", "observed_rainfall_v1", "historical_et0_estimate_v1", "future_weather_assumption_v1", "future_et0_assumption_v1"],
      ],
    );
    return result.rows.map((row) => row.payload as CanonicalReplayEvidenceRecordV1);
  }
}

async function waitForBootstrapBoundaryV1(): Promise<void> {
  const target = Date.parse(BOOTSTRAP_LOGICAL_TIME);
  const now = Date.now();
  if (now >= target) return;
  const delay = target - now + 1_500;
  console.log(JSON.stringify({ phase: "WAIT_FOR_BOOTSTRAP_BOUNDARY", wait_ms: delay }));
  await new Promise<void>((resolve) => setTimeout(resolve, delay));
}

async function countsV1(pool: Pool): Promise<{ totalFacts: number; scopeFacts: number; canonicalTwinFacts: number; runtimeConfigs: number }> {
  const params = [
    MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1.tenant_id,
    MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1.project_id,
    MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1.group_id,
    MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1.field_id,
    MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1.season_id,
    MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1.zone_id,
  ];
  const result = await pool.query(
    `SELECT (SELECT count(*)::int FROM public.facts) AS total_facts,
       count(*)::int AS scope_facts,
       count(*) FILTER (WHERE record_json->>'type' LIKE 'twin_%')::int AS canonical_twin_facts,
       count(*) FILTER (WHERE record_json->>'type'='twin_runtime_config_v1')::int AS runtime_configs
     FROM public.facts
     WHERE record_json->'payload'->>'tenant_id'=$1 AND record_json->'payload'->>'project_id'=$2
       AND record_json->'payload'->>'group_id'=$3 AND record_json->'payload'->>'field_id'=$4
       AND record_json->'payload'->>'season_id'=$5 AND record_json->'payload'->>'zone_id'=$6`, params);
  return {
    totalFacts: Number(result.rows[0].total_facts),
    scopeFacts: Number(result.rows[0].scope_facts),
    canonicalTwinFacts: Number(result.rows[0].canonical_twin_facts),
    runtimeConfigs: Number(result.rows[0].runtime_configs),
  };
}

async function loadFormalSoilEvidenceV1(pool: Pool): Promise<readonly FormalSoilEvidenceSummaryV1[]> {
  const result = await pool.query(
    `SELECT fact_id, source, record_json->>'type' AS record_type,
            record_json->'payload'->>'source_record_id' AS source_record_id,
            record_json->'payload'->>'binding_id' AS binding_id,
            record_json->'payload'->'role_time'->>'observed_at' AS observed_at,
            record_json->'payload'->>'available_to_runtime_at' AS available_to_runtime_at
       FROM public.facts
      WHERE record_json->'payload'->>'tenant_id'=$1 AND record_json->'payload'->>'project_id'=$2
        AND record_json->'payload'->>'group_id'=$3 AND record_json->'payload'->>'field_id'=$4
        AND record_json->'payload'->>'season_id'=$5 AND record_json->'payload'->>'zone_id'=$6
        AND record_json->>'type' NOT LIKE 'twin_%'
      ORDER BY occurred_at ASC, fact_id ASC`,
    [
      MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1.tenant_id,
      MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1.project_id,
      MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1.group_id,
      MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1.field_id,
      MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1.season_id,
      MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1.zone_id,
    ],
  );
  return result.rows.map((row) => ({
    fact_id: String(row.fact_id), source: String(row.source), record_type: String(row.record_type),
    source_record_id: String(row.source_record_id), binding_id: String(row.binding_id),
    observed_at: exactIso(String(row.observed_at), "EA5D2_EXISTING_SOIL_OBSERVED_AT_INVALID"),
    available_to_runtime_at: exactIso(String(row.available_to_runtime_at), "EA5D2_EXISTING_SOIL_AVAILABLE_AT_INVALID"),
  }));
}

function validateAuthorizedSoilEvidenceSetV1(records: readonly FormalSoilEvidenceSummaryV1[]): void {
  assert.ok(records.length >= 1 && records.length <= 2, `EA5D2_FORMAL_SOIL_EVIDENCE_PRESTATE_COUNT:${records.length}`);
  for (const record of records) {
    assert.equal(record.source, "mcft_cap09_external_formal_evidence_v1", `EA5D2_FOREIGN_EVIDENCE_SOURCE:${record.fact_id}`);
    assert.equal(record.record_type, "soil_moisture_observation_v1", `EA5D2_FOREIGN_EVIDENCE_TYPE:${record.fact_id}`);
    assert.equal(record.binding_id, MCFT_CAP09_EXTERNAL_FORMAL_SOIL_BINDING_ID_V1, `EA5D2_FOREIGN_EVIDENCE_BINDING:${record.fact_id}`);
  }
}

function qualifyingFreshSoilV1(records: readonly FormalSoilEvidenceSummaryV1[]): FormalSoilEvidenceSummaryV1 | null {
  const candidates = records.filter((record) => Date.parse(record.observed_at) > Date.parse(EVIDENCE_WINDOW_START)
    && Date.parse(record.observed_at) <= Date.parse(BOOTSTRAP_LOGICAL_TIME)
    && Date.parse(record.available_to_runtime_at) <= Date.parse(BOOTSTRAP_LOGICAL_TIME));
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => b.observed_at.localeCompare(a.observed_at)
    || b.available_to_runtime_at.localeCompare(a.available_to_runtime_at)
    || a.source_record_id.localeCompare(b.source_record_id));
  return candidates[0];
}

async function verifyPersistedBootstrapV1(pool: Pool): Promise<{ a0ConfigRef: string; a0ConfigHash: string; o00ConfigRef: string; o00ConfigHash: string }> {
  const params = [
    MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1.tenant_id,
    MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1.project_id,
    MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1.group_id,
    MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1.field_id,
    MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1.season_id,
    MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1.zone_id,
  ];
  const configResult = await pool.query(
    `SELECT record_json->'payload' AS object FROM public.facts
      WHERE record_json->>'type'='twin_runtime_config_v1'
        AND record_json->'payload'->>'tenant_id'=$1 AND record_json->'payload'->>'project_id'=$2
        AND record_json->'payload'->>'group_id'=$3 AND record_json->'payload'->>'field_id'=$4
        AND record_json->'payload'->>'season_id'=$5 AND record_json->'payload'->>'zone_id'=$6
      ORDER BY (record_json->'payload'->>'logical_time')::timestamptz ASC`, params);
  assert.equal(configResult.rows.length, 25, "EA5D2_EXACT_25_RUNTIME_CONFIGS_REQUIRED");
  let parent: Record<string, unknown> | null = null;
  for (let index = 0; index < configResult.rows.length; index += 1) {
    const object = configResult.rows[index].object as Record<string, unknown>;
    const payload = object.payload as Record<string, unknown>;
    assert.equal(payload.runtime_mode, "SHADOW_ONLINE_FORMAL_QUALIFICATION_ONLY");
    assert.equal(payload.config_selection_mode, "EXPLICIT_REF_HASH_PIN_ONLY");
    assert.equal(object.logical_time, new Date(Date.parse(BOOTSTRAP_LOGICAL_TIME) + index * 3_600_000).toISOString(), `EA5D2_CONFIG_LOGICAL_TIME:${index}`);
    if (index === 0) {
      assert.equal(payload.config_role, "A0_BOOTSTRAP");
      assert.equal(payload.parent_runtime_config_ref, null);
      assert.equal(payload.parent_runtime_config_hash, null);
    } else {
      assert.equal(payload.config_role, "HOURLY_CAP04");
      assert.equal(payload.parent_runtime_config_ref, parent?.object_id, `EA5D2_PARENT_REF:${index}`);
      assert.equal(payload.parent_runtime_config_hash, parent?.determinism_hash, `EA5D2_PARENT_HASH:${index}`);
    }
    parent = object;
  }
  const a0 = configResult.rows[0].object as Record<string, unknown>;
  const o00 = configResult.rows[1].object as Record<string, unknown>;
  assert.equal(o00.logical_time, O00_LOGICAL_TIME);
  const types = await pool.query(
    `SELECT count(*)::int AS n FROM public.facts
      WHERE record_json->'payload'->>'tenant_id'=$1 AND record_json->'payload'->>'project_id'=$2
        AND record_json->'payload'->>'group_id'=$3 AND record_json->'payload'->>'field_id'=$4
        AND record_json->'payload'->>'season_id'=$5 AND record_json->'payload'->>'zone_id'=$6
        AND record_json->>'type' LIKE 'twin_%'`, params);
  assert.equal(Number(types.rows[0].n), 34, "EA5D2_EXACT_34_CANONICAL_FACTS_REQUIRED");
  const latest = await new PostgresNextTickRepositoryV1(pool).readPersistedNextTickSnapshot({ ...MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1 });
  assert.ok(latest, "EA5D2_NEXT_TICK_SNAPSHOT_REQUIRED");
  assert.equal(latest.runtime_config.object_id, a0.object_id);
  assert.equal(latest.checkpoint.payload.next_tick_logical_time, O00_LOGICAL_TIME);
  assert.equal(latest.previous_posterior.runtime_config_ref, a0.object_id);
  assert.equal(latest.previous_forecast_result?.payload.status, "BLOCKED");
  return {
    a0ConfigRef: String(a0.object_id), a0ConfigHash: String(a0.determinism_hash),
    o00ConfigRef: String(o00.object_id), o00ConfigHash: String(o00.determinism_hash),
  };
}

async function main(): Promise<void> {
  const databaseUrl = process.env.GEOX_MCFT_CAP09_S6_DATABASE_URL;
  if (!databaseUrl?.trim()) throw new Error("EA5D2_FORMAL_DATABASE_URL_REQUIRED");
  const githubSha = process.env.GITHUB_SHA?.trim() || "UNKNOWN";
  const pool = new Pool({ connectionString: databaseUrl, max: 4 });
  const binding = createFormalDurableRawEvidenceRetentionAdapterV1(process.env);
  try {
    const identity = await pool.query("SELECT current_database() AS database_name, current_setting('server_version_num')::int AS server_version_num");
    assert.equal(identity.rows[0]?.database_name, EXPECTED_DATABASE, "EA5D2_FORMAL_DATABASE_IDENTITY_MISMATCH");
    assert.ok(Number(identity.rows[0]?.server_version_num) >= 180000, "EA5D2_POSTGRES_18_REQUIRED");
    const before = await countsV1(pool);
    if (before.canonicalTwinFacts !== 0 && before.canonicalTwinFacts !== 34) throw new Error(`EA5D2_FORMAL_CANONICAL_PRESTATE_INVALID:${before.canonicalTwinFacts}`);

    let executionMode: "FIRST_FORMAL_BOOTSTRAP_AFTER_FRESH_COLLECTION" | "RECOVER_FORMAL_BOOTSTRAP_FROM_EXISTING_FRESH_EVIDENCE" | "EXISTING_FORMAL_BOOTSTRAP_REVERIFIED";
    let freshEvidenceWriteCount = 0;
    let canonicalBootstrapWriteCount = 0;
    let soilObservedAt: string | null = null;
    let soilAvailableAt: string | null = null;

    if (before.canonicalTwinFacts === 0) {
      assert.equal(before.totalFacts, before.scopeFacts, "EA5D2_FOREIGN_SCOPE_FACTS_FORBIDDEN");
      const existingEvidence = await loadFormalSoilEvidenceV1(pool);
      validateAuthorizedSoilEvidenceSetV1(existingEvidence);
      assert.equal(before.scopeFacts, existingEvidence.length, "EA5D2_NON_EVIDENCE_PRESTATE_FORBIDDEN");
      let fresh = qualifyingFreshSoilV1(existingEvidence);
      if (!fresh) {
        if (Date.now() >= Date.parse(COLLECTOR_DEADLINE)) throw new Error("EA5D2_COLLECTOR_DEADLINE_MISSED_WITHOUT_FRESH_EVIDENCE");
        assert.equal(existingEvidence.length, 1, "EA5D2_ONLY_ONE_OLD_B2_EVIDENCE_ALLOWED_BEFORE_COLLECTION");
        const soil = await executeFormalLiveKbsSoilIngressV1({ pool, retention: binding.adapter });
        soilObservedAt = exactIso(soil.observed_at, "EA5D2_FRESH_SOIL_OBSERVED_AT_INVALID");
        soilAvailableAt = exactIso(soil.retrieved_at, "EA5D2_FRESH_SOIL_AVAILABLE_AT_INVALID");
        assert.ok(Date.parse(soilObservedAt) > Date.parse(EVIDENCE_WINDOW_START), "EA5D2_FRESH_SOIL_BEFORE_A0_WINDOW");
        assert.ok(Date.parse(soilObservedAt) <= Date.parse(BOOTSTRAP_LOGICAL_TIME), "EA5D2_FRESH_SOIL_AFTER_A0_BOUNDARY");
        assert.ok(Date.parse(soilAvailableAt) <= Date.parse(BOOTSTRAP_LOGICAL_TIME), "EA5D2_FRESH_SOIL_AVAILABLE_AFTER_A0_BOUNDARY");
        freshEvidenceWriteCount = soil.canonical_fact_write_count;
        assert.equal(freshEvidenceWriteCount, 1, "EA5D2_FRESH_SOIL_MUST_APPEND_ONE_NEW_FACT");
        const afterCollection = await loadFormalSoilEvidenceV1(pool);
        validateAuthorizedSoilEvidenceSetV1(afterCollection);
        assert.equal(afterCollection.length, 2, "EA5D2_EXACT_TWO_SOIL_EVIDENCE_FACTS_AFTER_COLLECTION");
        fresh = qualifyingFreshSoilV1(afterCollection);
        assert.ok(fresh, "EA5D2_FRESH_SOIL_NOT_PERSISTED");
        executionMode = "FIRST_FORMAL_BOOTSTRAP_AFTER_FRESH_COLLECTION";
      } else {
        soilObservedAt = fresh.observed_at;
        soilAvailableAt = fresh.available_to_runtime_at;
        executionMode = "RECOVER_FORMAL_BOOTSTRAP_FROM_EXISTING_FRESH_EVIDENCE";
      }
      soilObservedAt ??= fresh.observed_at;
      soilAvailableAt ??= fresh.available_to_runtime_at;
      await waitForBootstrapBoundaryV1();
      assert.ok(Date.now() >= Date.parse(BOOTSTRAP_LOGICAL_TIME), "EA5D2_BOOTSTRAP_WALL_CLOCK_BOUNDARY_REQUIRED");
      const cropStage = deriveCropStageAtBootstrapV1();
      const createdAt = new Date().toISOString();
      const bundle = buildExternalFormalBootstrapAuthorityBundleV1({
        bootstrap_logical_time: BOOTSTRAP_LOGICAL_TIME,
        created_at: createdAt,
        crop_stage_code: cropStage,
        crop_stage_derivation_authority_time: BOOTSTRAP_LOGICAL_TIME,
      });
      const runtimeRepository = new PostgresRuntimeRepositoryV1(pool);
      const service = new ExternalFormalBootstrapPersistenceServiceV1({
        runtime_config_repository: runtimeRepository,
        bootstrap_persistence: runtimeRepository,
        authority_snapshot_repository: new PostgresNextTickRepositoryV1(pool),
        evidence_source: new FormalDatabaseEvidenceSourceV1(pool),
      });
      const persisted = await service.execute({ bundle, created_at: createdAt, lease_owner: LEASE_OWNER, lease_duration_seconds: 600 });
      assert.equal(persisted.status, "INSERTED", "EA5D2_FIRST_FORMAL_BOOTSTRAP_MUST_INSERT");
      assert.equal(persisted.runtime_config_write_count, 25);
      assert.equal(persisted.a0_member_write_count, 9);
      assert.equal(persisted.hourly_runtime_config_count, 24);
      assert.equal(persisted.formal_window_started, false);
      canonicalBootstrapWriteCount = 34;
    } else {
      executionMode = "EXISTING_FORMAL_BOOTSTRAP_REVERIFIED";
      const evidence = await loadFormalSoilEvidenceV1(pool);
      validateAuthorizedSoilEvidenceSetV1(evidence);
      const fresh = qualifyingFreshSoilV1(evidence);
      assert.ok(fresh, "EA5D2_EXISTING_BOOTSTRAP_FRESH_SOIL_REQUIRED");
      soilObservedAt = fresh.observed_at;
      soilAvailableAt = fresh.available_to_runtime_at;
    }

    const after = await countsV1(pool);
    assert.equal(after.totalFacts, after.scopeFacts, "EA5D2_FINAL_FOREIGN_SCOPE_FACTS_FORBIDDEN");
    assert.ok(after.scopeFacts === 35 || after.scopeFacts === 36, `EA5D2_FINAL_SCOPE_FACT_COUNT:${after.scopeFacts}`);
    assert.equal(after.canonicalTwinFacts, 34, "EA5D2_EXACT_34_FORMAL_CANONICAL_FACTS_REQUIRED");
    assert.equal(after.runtimeConfigs, 25, "EA5D2_EXACT_25_FORMAL_RUNTIME_CONFIGS_REQUIRED");
    const pins = await verifyPersistedBootstrapV1(pool);
    const result = {
      schema_version: "geox_mcft_cap09_ea5d2_formal_bootstrap_live_persistence_result_v1",
      status: "PASS",
      subject_head_sha: githubSha,
      execution_mode: executionMode,
      formal_database_identity: EXPECTED_DATABASE,
      formal_postgres_18_or_newer: true,
      bootstrap_logical_time: BOOTSTRAP_LOGICAL_TIME,
      o00_logical_time: O00_LOGICAL_TIME,
      crop_stage_code: "MID",
      crop_stage_rederived_at_bootstrap_boundary: true,
      fresh_soil_observed_at: soilObservedAt,
      fresh_soil_available_at: soilAvailableAt,
      fresh_external_evidence_write_count: freshEvidenceWriteCount,
      canonical_bootstrap_write_count: canonicalBootstrapWriteCount,
      final_scope_fact_count: after.scopeFacts,
      final_canonical_fact_count: after.canonicalTwinFacts,
      exact_runtime_config_count: 25,
      exact_hourly_runtime_config_count: 24,
      external_a0_member_count: 9,
      a0_runtime_config_ref: pins.a0ConfigRef,
      a0_runtime_config_hash: pins.a0ConfigHash,
      o00_runtime_config_ref: pins.o00ConfigRef,
      o00_runtime_config_hash: pins.o00ConfigHash,
      config_parent_chain_verified: true,
      explicit_ref_hash_pin_only: true,
      persistent_formal_raw_store_bound: true,
      formal_neon_bootstrap_persisted: true,
      formal_24_config_chain_persisted: true,
      scheduler_slot_write_count: 0,
      formal_window_started: false,
      ea5d_complete: false,
      ea5e_authorized: false,
      formal_o00_start_authorized: false,
      mcft_cap09_completed: false,
    };
    const publicText = JSON.stringify(result);
    assert.equal(publicText.includes('"value"'), false, "EA5D2_PUBLIC_RESULT_VALUE_LEAK");
    assert.equal(publicText.includes("GEOX_MCFT_CAP09_S6_DATABASE_URL"), false);
    assert.equal(publicText.includes("GEOX_MCFT_CAP09_FORMAL_RAW_S3_SECRET_ACCESS_KEY"), false);
    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    fs.writeFileSync(OUT, JSON.stringify(result, null, 2) + "\n");
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
});
