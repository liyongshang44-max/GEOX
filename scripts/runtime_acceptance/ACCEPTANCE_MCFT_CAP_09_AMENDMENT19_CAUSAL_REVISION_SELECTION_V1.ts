import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

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
  "acceptance-output/MCFT_CAP_09_AMENDMENT19_CAUSAL_REVISION_SELECTION_V1_RESULT.json",
);

const SCOPE = { ...MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1 };
const EVENT = "2026-09-23T04:00:00.000Z";
const BASE_AVAILABLE = "2026-09-23T04:15:00.000Z";
const REVISION_AVAILABLE = "2026-09-23T05:30:00.000Z";

function hash(char: string): string {
  return "sha256:" + char.repeat(64);
}

function record(input: {
  record_type:
    | "soil_moisture_observation_v1"
    | "future_weather_assumption_v1"
    | "future_et0_assumption_v1";
  binding_id: string;
  source_record_id: string;
  source_record_hash: string;
  available_at: string;
}): CanonicalReplayEvidenceRecordV1 {
  const roleTime = input.record_type === "soil_moisture_observation_v1"
    ? { observed_at: EVENT, ingested_at: input.available_at }
    : { issued_at: EVENT, ingested_at: input.available_at };
  return {
    ...SCOPE,
    dataset_id: "mcft_cap09_am19_causal_revision_acceptance_v1",
    source_record_id: input.source_record_id,
    source_record_hash: input.source_record_hash,
    record_type: input.record_type,
    binding_id: input.binding_id,
    origin_source_kind: "CONTROLLED_ENGINEERING_FIXTURE",
    origin_source_id: "AM19_CAUSAL_REVISION_ACCEPTANCE",
    epistemic_class: input.record_type === "soil_moisture_observation_v1"
      ? "OBSERVED"
      : "ASSUMED",
    available_to_runtime_at: input.available_at,
    role_time: roleTime,
    quality: { status: "PASS" },
    source_payload: { acceptance: true },
    canonical_payload: { acceptance: true },
    source_unit: "unitless",
    canonical_unit: "unitless",
    conversion_rule: { rule_id: "IDENTITY_ACCEPTANCE_V1" },
    limitations: ["QUALIFICATION_ONLY"],
  } as CanonicalReplayEvidenceRecordV1;
}

function row(factId: string, value: CanonicalReplayEvidenceRecordV1) {
  return {
    fact_id: factId,
    occurred_at: EVENT,
    record_json: { type: value.record_type, payload: value },
  };
}

function sourceFor(rows: ReturnType<typeof row>[]) {
  const client = {
    async query(sql: string) {
      if (sql.includes("FROM facts")) return { rows };
      return { rows: [] };
    },
    release() {},
  };
  const pool = {
    async connect() { return client; },
  };
  return new PostgresExternalFormalAmendment19EvidenceSourceV1(pool as never);
}

const soilBase = record({
  record_type: "soil_moisture_observation_v1",
  binding_id: MCFT_CAP09_EXTERNAL_FORMAL_SOIL_BINDING_ID_V1,
  source_record_id:
    "kbs_lter_variate25_vwc_100mm_v1:2026-09-23T04:00:00.000Z",
  source_record_hash: hash("a"),
  available_at: BASE_AVAILABLE,
});
const soilRevision = record({
  record_type: "soil_moisture_observation_v1",
  binding_id: MCFT_CAP09_EXTERNAL_FORMAL_SOIL_BINDING_ID_V1,
  source_record_id: soilBase.source_record_id,
  source_record_hash: hash("b"),
  available_at: REVISION_AVAILABLE,
});
const futureWeather = record({
  record_type: "future_weather_assumption_v1",
  binding_id: MCFT_CAP09_EXTERNAL_FORMAL_FUTURE_WEATHER_BINDING_ID_V1,
  source_record_id: "am19-causal-weather",
  source_record_hash: hash("c"),
  available_at: BASE_AVAILABLE,
});
const futureEt0 = record({
  record_type: "future_et0_assumption_v1",
  binding_id: MCFT_CAP09_EXTERNAL_FORMAL_FUTURE_ET0_BINDING_ID_V1,
  source_record_id: "am19-causal-et0",
  source_record_hash: hash("d"),
  available_at: BASE_AVAILABLE,
});

async function load(
  rows: ReturnType<typeof row>[],
  logicalTime: string,
) {
  return sourceFor(rows).loadCandidateRecords({
    scope: SCOPE,
    logical_time: logicalTime,
    evidence_snapshot_time: logicalTime,
  });
}

async function main(): Promise<void> {
  const allRows = [
    row("soil-base", soilBase),
    row("soil-revision", soilRevision),
    row("weather", futureWeather),
    row("et0", futureEt0),
  ];

  const beforeRevision = await load(allRows, "2026-09-23T05:00:00.000Z");
  const beforeSoil = beforeRevision.records.find(
    (item) => item.record_type === "soil_moisture_observation_v1",
  );
  assert.equal(beforeSoil?.source_record_hash, hash("a"));
  assert.equal(beforeRevision.excluded_after_causal_cutoff_count, 1);
  assert.equal(beforeRevision.selected_record_count, 3);

  const afterRevision = await load(allRows, "2026-09-23T06:00:00.000Z");
  const afterSoil = afterRevision.records.find(
    (item) => item.record_type === "soil_moisture_observation_v1",
  );
  assert.equal(afterSoil?.source_record_hash, hash("b"));
  assert.equal(afterRevision.selected_record_count, 3);
  assert.deepEqual(afterRevision.family_cardinality, {
    soil: 1,
    rainfall: 0,
    historical_et0: 0,
    future_weather: 1,
    future_et0: 1,
  });

  const simultaneousConflict = structuredClone(soilBase);
  simultaneousConflict.source_record_hash = hash("e");
  await assert.rejects(
    () => load([
      row("soil-base", soilBase),
      row("soil-conflict", simultaneousConflict),
      row("weather", futureWeather),
      row("et0", futureEt0),
    ], "2026-09-23T05:00:00.000Z"),
    /AM19_EXTERNAL_DB_SOURCE_IDENTITY_CONFLICT:/,
  );

  await assert.rejects(
    () => load([
      row("soil-base", soilBase),
      row("soil-duplicate", structuredClone(soilBase)),
      row("weather", futureWeather),
      row("et0", futureEt0),
    ], "2026-09-23T05:00:00.000Z"),
    /AM19_EXTERNAL_DB_DUPLICATE_SOURCE_RECORD_ID:/,
  );

  const proof = {
    schema_version:
      "geox_mcft_cap09_amendment19_causal_revision_selection_acceptance_v1",
    status: "PASS",
    earlier_boundary_uses_pre_revision_fact: true,
    later_boundary_uses_causal_latest_revision: true,
    future_revision_not_leaked_backward: true,
    simultaneous_divergent_identity_conflict_fail_closed: true,
    exact_duplicate_source_identity_fail_closed: true,
    database_write_count: 0,
    provider_request_count: 0,
  };
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(proof, null, 2) + "\n");
  process.stdout.write(JSON.stringify(proof) + "\n");
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
