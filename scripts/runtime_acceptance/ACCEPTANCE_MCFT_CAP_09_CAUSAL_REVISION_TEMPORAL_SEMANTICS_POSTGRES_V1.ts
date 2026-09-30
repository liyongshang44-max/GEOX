import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { Pool } from "pg";

import {
  MCFT_CAP09_EXTERNAL_FORMAL_FUTURE_ET0_BINDING_ID_V1,
  MCFT_CAP09_EXTERNAL_FORMAL_FUTURE_WEATHER_BINDING_ID_V1,
  MCFT_CAP09_EXTERNAL_FORMAL_SOIL_BINDING_ID_V1,
} from "../../apps/server/src/domain/twin_runtime/external_formal_evidence_binding_profile_v1.js";
import { MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1 } from "../../apps/server/src/domain/twin_runtime/external_formal_runtime_config_v1.js";
import {
  PostgresExternalFormalAmendment19EvidenceSourceV1,
} from "../../apps/server/src/runtime/twin_runtime/postgres_external_formal_amendment19_evidence_source_v1.js";
import type { CanonicalReplayEvidenceRecordV1 } from "../../apps/server/src/runtime/twin_runtime/ports.js";

const OUT = path.resolve(
  "acceptance-output/MCFT_CAP_09_CAUSAL_REVISION_TEMPORAL_SEMANTICS_POSTGRES_V1_RESULT.json",
);
const STATE = path.resolve(
  "acceptance-output/MCFT_CAP_09_CAUSAL_REVISION_TEMPORAL_SEMANTICS_POSTGRES_V1_STATE.json",
);

const FROZEN_RUNTIME_SUBJECT_SHA = "3d5fd13c8f5babd2edc5107206f43a5e5d12eb4a";
const SEMANTIC_REVISION_COMMIT_SHA = "9ffecd38d3093c4a3f566ee996e3ad00aaf6004a";
const RUNTIME_SOURCE_BLOB_SHA = "5e132eb1b307f908dea6118292fb8e0e9d53084c";
const OLD_FULL_24T_HEAD = "12473c491b354e49305f22bfa24c8701ce5e3ff9";
const FACT_PREFIX = "mcft_cap09_causal_revision_temporal_semantics_qv1:";
const SOURCE = "mcft_cap09_causal_revision_temporal_semantics_qv1";

const SCOPE = { ...MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1 };
const EVENT = "2026-09-23T04:00:00.000Z";
const BASE_AVAILABLE = "2026-09-23T04:15:00.000Z";
const REVISION_AVAILABLE = "2026-09-23T05:30:00.000Z";
const BEFORE_REVISION = "2026-09-23T05:00:00.000Z";
const AFTER_REVISION = "2026-09-23T06:00:00.000Z";

type QualificationStateV1 = {
  schema_version: "geox_mcft_cap09_causal_revision_temporal_semantics_postgres_state_v1";
  seeded_fact_count: number;
  before_signature: string;
  after_signature: string;
};

function requiredDatabaseUrlV1(): string {
  const value = String(process.env.DATABASE_URL ?? "").trim();
  assert(value, "CAUSAL_REVISION_POSTGRES_DATABASE_URL_REQUIRED");
  return value;
}

function hashV1(char: string): string {
  return "sha256:" + char.repeat(64);
}

function recordV1(input: {
  record_type:
    | "soil_moisture_observation_v1"
    | "future_weather_assumption_v1"
    | "future_et0_assumption_v1";
  binding_id: string;
  source_record_id: string;
  source_record_hash: string;
  event_time: string;
  available_at: string;
}): CanonicalReplayEvidenceRecordV1 {
  const roleTime = input.record_type === "soil_moisture_observation_v1"
    ? { observed_at: input.event_time, ingested_at: input.available_at }
    : { issued_at: input.event_time, ingested_at: input.available_at };
  return {
    ...SCOPE,
    dataset_id: "mcft_cap09_causal_revision_temporal_semantics_postgres_qv1",
    source_record_id: input.source_record_id,
    source_record_hash: input.source_record_hash,
    record_type: input.record_type,
    binding_id: input.binding_id,
    origin_source_kind: "CONTROLLED_ENGINEERING_FIXTURE",
    origin_source_id: "CAUSAL_REVISION_TEMPORAL_SEMANTICS_POSTGRES_QV1",
    epistemic_class: input.record_type === "soil_moisture_observation_v1" ? "OBSERVED" : "ASSUMED",
    available_to_runtime_at: input.available_at,
    role_time: roleTime,
    quality: { status: "PASS" },
    source_payload: { qualification_only: true },
    canonical_payload: { qualification_only: true },
    source_unit: "unitless",
    canonical_unit: "unitless",
    conversion_rule: { rule_id: "IDENTITY_QUALIFICATION_V1" },
    limitations: ["QUALIFICATION_ONLY"],
  } as CanonicalReplayEvidenceRecordV1;
}

const soilBase = recordV1({
  record_type: "soil_moisture_observation_v1",
  binding_id: MCFT_CAP09_EXTERNAL_FORMAL_SOIL_BINDING_ID_V1,
  source_record_id: "kbs_lter_variate25_vwc_100mm_v1:2026-09-23T04:00:00.000Z",
  source_record_hash: hashV1("a"),
  event_time: EVENT,
  available_at: BASE_AVAILABLE,
});

const soilRevision = recordV1({
  record_type: "soil_moisture_observation_v1",
  binding_id: MCFT_CAP09_EXTERNAL_FORMAL_SOIL_BINDING_ID_V1,
  source_record_id: soilBase.source_record_id,
  source_record_hash: hashV1("b"),
  event_time: EVENT,
  available_at: REVISION_AVAILABLE,
});

const futureWeather = recordV1({
  record_type: "future_weather_assumption_v1",
  binding_id: MCFT_CAP09_EXTERNAL_FORMAL_FUTURE_WEATHER_BINDING_ID_V1,
  source_record_id: "causal-revision-weather",
  source_record_hash: hashV1("c"),
  event_time: EVENT,
  available_at: BASE_AVAILABLE,
});

const futureEt0 = recordV1({
  record_type: "future_et0_assumption_v1",
  binding_id: MCFT_CAP09_EXTERNAL_FORMAL_FUTURE_ET0_BINDING_ID_V1,
  source_record_id: "causal-revision-et0",
  source_record_hash: hashV1("d"),
  event_time: EVENT,
  available_at: BASE_AVAILABLE,
});

async function clearQualificationFactsV1(pool: Pool): Promise<void> {
  await pool.query("DELETE FROM public.facts WHERE fact_id LIKE $1", [`${FACT_PREFIX}%`]);
}

async function insertFactV1(
  pool: Pool,
  suffix: string,
  value: CanonicalReplayEvidenceRecordV1,
  occurredAt = EVENT,
): Promise<void> {
  await pool.query(
    `INSERT INTO public.facts(fact_id,occurred_at,source,record_json)
     VALUES($1,$2::timestamptz,$3,$4::jsonb)`,
    [
      `${FACT_PREFIX}${suffix}`,
      occurredAt,
      SOURCE,
      JSON.stringify({ type: value.record_type, payload: value }),
    ],
  );
}

async function countQualificationFactsV1(pool: Pool): Promise<number> {
  const result = await pool.query<{ n: string }>(
    "SELECT count(*)::text AS n FROM public.facts WHERE fact_id LIKE $1",
    [`${FACT_PREFIX}%`],
  );
  return Number(result.rows[0]?.n ?? "0");
}

function evidenceSourceV1(pool: Pool): PostgresExternalFormalAmendment19EvidenceSourceV1 {
  return new PostgresExternalFormalAmendment19EvidenceSourceV1(pool);
}

async function loadV1(pool: Pool, logicalTime: string) {
  return evidenceSourceV1(pool).loadCandidateRecords({
    scope: { ...SCOPE },
    logical_time: logicalTime,
    evidence_snapshot_time: logicalTime,
  });
}

function signatureV1(result: Awaited<ReturnType<typeof loadV1>>): string {
  return JSON.stringify(
    result.records.map((item) => ({
      record_type: item.record_type,
      source_record_id: item.source_record_id,
      source_record_hash: item.source_record_hash,
      available_to_runtime_at: item.available_to_runtime_at,
    })),
  );
}

function selectedSoilHashV1(result: Awaited<ReturnType<typeof loadV1>>): string | undefined {
  return result.records.find((item) => item.record_type === "soil_moisture_observation_v1")
    ?.source_record_hash;
}

async function seedAndCaptureV1(): Promise<void> {
  const pool = new Pool({ connectionString: requiredDatabaseUrlV1(), max: 4 });
  try {
    await clearQualificationFactsV1(pool);
    await insertFactV1(pool, "10-soil-base", soilBase);
    await insertFactV1(pool, "20-soil-revision", soilRevision);
    await insertFactV1(pool, "30-weather", futureWeather);
    await insertFactV1(pool, "40-et0", futureEt0);

    const persisted = await countQualificationFactsV1(pool);
    assert.equal(persisted, 4, "CAUSAL_REVISION_POSTGRES_SEED_PERSISTENCE_REQUIRED");

    const before = await loadV1(pool, BEFORE_REVISION);
    assert.equal(
      selectedSoilHashV1(before),
      hashV1("a"),
      "CAUSAL_REVISION_LOGICAL_TIME_CUTOFF_MUST_SELECT_PRE_REVISION_FACT",
    );
    assert.equal(
      before.excluded_after_causal_cutoff_count,
      1,
      "CAUSAL_REVISION_FUTURE_REVISION_MUST_BE_EXCLUDED_AT_EARLIER_BOUNDARY",
    );
    assert.equal(before.selected_record_count, 3);
    assert.equal(before.database_read_transaction_count, 1);
    assert.equal(before.database_write_count, 0);
    assert.equal(before.provider_request_count, 0);

    const after = await loadV1(pool, AFTER_REVISION);
    assert.equal(
      selectedSoilHashV1(after),
      hashV1("b"),
      "CAUSAL_REVISION_CAUSAL_LATEST_SELECTION_REQUIRED",
    );
    assert.equal(after.selected_record_count, 3);
    assert.equal(after.family_cardinality.soil, 1);

    const state: QualificationStateV1 = {
      schema_version: "geox_mcft_cap09_causal_revision_temporal_semantics_postgres_state_v1",
      seeded_fact_count: persisted,
      before_signature: signatureV1(before),
      after_signature: signatureV1(after),
    };
    fs.mkdirSync(path.dirname(STATE), { recursive: true });
    fs.writeFileSync(STATE, JSON.stringify(state, null, 2) + "\n");
    process.stdout.write(JSON.stringify({ status: "PASS", mode: "seed-and-capture", ...state }) + "\n");
  } finally {
    await pool.end();
  }
}

async function proveAmbiguousRevisionFailClosedV1(pool: Pool): Promise<void> {
  await clearQualificationFactsV1(pool);
  const conflict = structuredClone(soilBase);
  conflict.source_record_hash = hashV1("e");
  await insertFactV1(pool, "10-soil-base", soilBase);
  await insertFactV1(pool, "20-soil-conflict", conflict);
  await insertFactV1(pool, "30-weather", futureWeather);
  await insertFactV1(pool, "40-et0", futureEt0);
  await assert.rejects(
    () => loadV1(pool, BEFORE_REVISION),
    /AM19_EXTERNAL_DB_SOURCE_IDENTITY_CONFLICT:/,
    "CAUSAL_REVISION_AMBIGUOUS_REVISION_MUST_FAIL_CLOSED",
  );
}

async function proveFutureEventLeakageRejectedV1(pool: Pool): Promise<void> {
  await clearQualificationFactsV1(pool);
  const futureEvent = recordV1({
    record_type: "soil_moisture_observation_v1",
    binding_id: MCFT_CAP09_EXTERNAL_FORMAL_SOIL_BINDING_ID_V1,
    source_record_id: "future-event-probe",
    source_record_hash: hashV1("f"),
    event_time: "2026-09-23T06:30:00.000Z",
    available_at: BASE_AVAILABLE,
  });
  await insertFactV1(pool, "00-future-event", futureEvent, EVENT);
  await insertFactV1(pool, "30-weather", futureWeather);
  await insertFactV1(pool, "40-et0", futureEt0);
  await assert.rejects(
    () => loadV1(pool, BEFORE_REVISION),
    /AM19_EXTERNAL_DB_FUTURE_EVENT_FORBIDDEN:/,
    "CAUSAL_REVISION_FUTURE_EVENT_LEAKAGE_MUST_FAIL_CLOSED",
  );
}

async function replayAndVerifyV1(): Promise<void> {
  assert(fs.existsSync(STATE), "CAUSAL_REVISION_POSTGRES_STATE_REQUIRED_FOR_REPLAY");
  const state = JSON.parse(fs.readFileSync(STATE, "utf8")) as QualificationStateV1;
  assert.equal(
    state.schema_version,
    "geox_mcft_cap09_causal_revision_temporal_semantics_postgres_state_v1",
  );

  const pool = new Pool({ connectionString: requiredDatabaseUrlV1(), max: 4 });
  try {
    const persistedAfterProcessRestart = await countQualificationFactsV1(pool);
    assert.equal(
      persistedAfterProcessRestart,
      state.seeded_fact_count,
      "CAUSAL_REVISION_POSTGRES_FACTS_MUST_SURVIVE_QUALIFICATION_PROCESS_RESTART",
    );
    assert.equal(persistedAfterProcessRestart, 4);

    const replayBefore = await loadV1(pool, BEFORE_REVISION);
    const replayAfter = await loadV1(pool, AFTER_REVISION);
    assert.equal(
      signatureV1(replayBefore),
      state.before_signature,
      "CAUSAL_REVISION_RESTART_REPLAY_BEFORE_CUTOFF_MUST_BE_DETERMINISTIC",
    );
    assert.equal(
      signatureV1(replayAfter),
      state.after_signature,
      "CAUSAL_REVISION_RESTART_REPLAY_AFTER_CUTOFF_MUST_BE_DETERMINISTIC",
    );

    const replayAgainBefore = await loadV1(pool, BEFORE_REVISION);
    const replayAgainAfter = await loadV1(pool, AFTER_REVISION);
    assert.equal(signatureV1(replayAgainBefore), state.before_signature);
    assert.equal(signatureV1(replayAgainAfter), state.after_signature);

    await proveAmbiguousRevisionFailClosedV1(pool);
    await proveFutureEventLeakageRejectedV1(pool);

    const proof = {
      schema_version: "geox_mcft_cap09_causal_revision_temporal_semantics_postgres_qualification_v1",
      status: "PASS",
      qualified_runtime: {
        frozen_runtime_subject_sha: FROZEN_RUNTIME_SUBJECT_SHA,
        semantic_revision_commit_sha: SEMANTIC_REVISION_COMMIT_SHA,
        postgres_evidence_source_blob_sha: RUNTIME_SOURCE_BLOB_SHA,
        frozen_runtime_modified_by_this_qualification: false,
      },
      proof_surface: {
        real_postgresql_persistence: true,
        logical_time_cutoff: true,
        causal_latest_selection: true,
        future_revision_backward_leakage_rejected: true,
        future_event_leakage_fail_closed: true,
        ambiguous_revision_fail_closed: true,
        restart_replay_determinism: true,
        persisted_fact_count_survived_process_restart: persistedAfterProcessRestart,
        runtime_database_write_count: 0,
        runtime_provider_request_count: 0,
      },
      temporal_semantics: {
        earlier_boundary: BEFORE_REVISION,
        later_boundary: AFTER_REVISION,
        earlier_boundary_selected_hash: hashV1("a"),
        later_boundary_selected_hash: hashV1("b"),
        same_source_record_id_revision_selection_by_causal_availability: true,
      },
      qualification_supersession: {
        supersession_scope: "CAUSAL_REVISION_TEMPORAL_SEMANTICS_ONLY",
        old_full_24t_head_sha: OLD_FULL_24T_HEAD,
        superseded_claim: "PROTECTED_TEMPORAL_SEMANTIC_CORE_UNCHANGED",
        replacement_claim: "FROZEN_RUNTIME_CAUSAL_REVISION_TEMPORAL_SEMANTICS_QUALIFIED_BY_REAL_POSTGRES_V1",
        old_24t_proof_reinterpreted_as_covering_new_semantics: false,
        old_24t_proof_causal_revision_semantics_coverage: false,
        old_24t_historical_result_deleted_or_weakened: false,
      },
    };

    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    fs.writeFileSync(OUT, JSON.stringify(proof, null, 2) + "\n");
    process.stdout.write(JSON.stringify(proof) + "\n");
  } finally {
    try { await clearQualificationFactsV1(pool); } finally { await pool.end(); }
  }
}

async function main(): Promise<void> {
  const mode = String(process.argv[2] ?? "").trim();
  if (mode === "seed-and-capture") {
    await seedAndCaptureV1();
    return;
  }
  if (mode === "replay-and-verify") {
    await replayAndVerifyV1();
    return;
  }
  throw new Error("CAUSAL_REVISION_POSTGRES_MODE_REQUIRED:seed-and-capture|replay-and-verify");
}

main().catch((error) => {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(
    OUT,
    JSON.stringify({
      status: "FAIL",
      error: error instanceof Error ? error.message : String(error),
    }, null, 2) + "\n",
  );
  throw error;
});
