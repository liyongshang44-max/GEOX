import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { Pool } from "pg";

import { MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1 } from "../../apps/server/src/domain/twin_runtime/external_formal_runtime_config_v1.js";
import type { CanonicalReplayEvidenceRecordV1 } from "../../apps/server/src/runtime/twin_runtime/ports.js";

const OUT = path.resolve(
  "acceptance-output/MCFT_CAP_09_PHASE5_RUNTIME_EVIDENCE_RESULT.json",
);
const EVIDENCE_SOURCE = "mcft_cap09_external_formal_evidence_v1";
const REQUIRED_TYPES = [
  "soil_moisture_observation_v1",
  "future_weather_assumption_v1",
  "future_et0_assumption_v1",
] as const;

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error("PHASE5_RUNTIME_EVIDENCE_ENV_REQUIRED:" + name);
  return value;
}

function canonicalIso(value: unknown, code: string): string {
  if (typeof value !== "string") throw new Error(code);
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== value) {
    throw new Error(code);
  }
  return value;
}

function addHours(value: string, hours: number): string {
  return new Date(Date.parse(value) + hours * 3_600_000).toISOString();
}

function payload(row: { record_json: unknown }): CanonicalReplayEvidenceRecordV1 {
  const envelope = typeof row.record_json === "string"
    ? JSON.parse(row.record_json)
    : row.record_json;
  assert(envelope && typeof envelope === "object" && !Array.isArray(envelope));
  const record = (envelope as { payload?: unknown }).payload;
  assert(record && typeof record === "object" && !Array.isArray(record));
  return structuredClone(record) as CanonicalReplayEvidenceRecordV1;
}

function exactScope(record: CanonicalReplayEvidenceRecordV1): void {
  for (const key of [
    "tenant_id",
    "project_id",
    "group_id",
    "field_id",
    "season_id",
    "zone_id",
  ] as const) {
    assert.equal(
      record[key],
      MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1[key],
      "PHASE5_RUNTIME_EVIDENCE_SCOPE_MISMATCH:" + key,
    );
  }
}

async function main(): Promise<void> {
  const a0 = canonicalIso(
    requiredEnv("GEOX_MCFT_CAP09_PHASE5_A0"),
    "PHASE5_RUNTIME_EVIDENCE_A0_INVALID",
  );
  const o00 = addHours(a0, 1);
  const pool = new Pool({
    connectionString: requiredEnv("DATABASE_URL"),
    max: 2,
  });
  try {
    const rows = (
      await pool.query<{ fact_id: string; record_json: unknown }>(
        `SELECT fact_id,record_json
           FROM public.facts
          WHERE source=$1
            AND record_json#>>'{payload,tenant_id}'=$2
            AND record_json#>>'{payload,project_id}'=$3
            AND record_json#>>'{payload,group_id}'=$4
            AND record_json#>>'{payload,field_id}'=$5
            AND record_json#>>'{payload,season_id}'=$6
            AND record_json#>>'{payload,zone_id}'=$7
            AND record_json->>'type'=ANY($8::text[])
          ORDER BY ingested_at DESC,fact_id ASC`,
        [
          EVIDENCE_SOURCE,
          MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1.tenant_id,
          MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1.project_id,
          MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1.group_id,
          MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1.field_id,
          MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1.season_id,
          MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1.zone_id,
          [...REQUIRED_TYPES],
        ],
      )
    ).rows;

    const selected = new Map<string, CanonicalReplayEvidenceRecordV1>();
    for (const row of rows) {
      const record = payload(row);
      if (!selected.has(record.record_type)) selected.set(record.record_type, record);
    }
    for (const type of REQUIRED_TYPES) {
      assert(selected.has(type), "PHASE5_RUNTIME_EVIDENCE_REQUIRED_TYPE_MISSING:" + type);
    }

    const soil = selected.get("soil_moisture_observation_v1")!;
    exactScope(soil);
    assert.equal(soil.origin_source_kind, "EXTERNAL_PUBLIC_RESEARCH_DATASET");
    assert.equal(soil.origin_source_id, "KBS_LTER_CURRENT_WEATHER_VARIATE_25");
    const observedAt = canonicalIso(
      soil.role_time?.observed_at,
      "PHASE5_RUNTIME_EVIDENCE_SOIL_OBSERVED_INVALID",
    );
    const soilAvailable = canonicalIso(
      soil.available_to_runtime_at,
      "PHASE5_RUNTIME_EVIDENCE_SOIL_AVAILABLE_INVALID",
    );
    const soilIngested = canonicalIso(
      soil.role_time?.ingested_at,
      "PHASE5_RUNTIME_EVIDENCE_SOIL_INGESTED_INVALID",
    );
    assert(Date.parse(observedAt) <= Date.parse(o00));
    assert(Date.parse(soilAvailable) <= Date.parse(o00));
    assert(Date.parse(soilIngested) <= Date.parse(o00));
    assert(!soil.limitations.includes("ENGINEERING_BOOTSTRAP_FIXTURE_ONLY"));

    for (const type of [
      "future_weather_assumption_v1",
      "future_et0_assumption_v1",
    ] as const) {
      const record = selected.get(type)!;
      exactScope(record);
      assert.equal(record.epistemic_class, "ASSUMED");
      assert.equal(record.role_time?.valid_from, a0);
      assert.equal(record.role_time?.valid_to, addHours(a0, 72));
      for (const value of [
        record.role_time?.issued_at,
        record.available_to_runtime_at,
        record.role_time?.ingested_at,
      ]) {
        assert(
          Date.parse(canonicalIso(
            value,
            "PHASE5_RUNTIME_EVIDENCE_GFS_CAUSAL_TIME_INVALID:" + type,
          )) <= Date.parse(o00),
        );
      }
      const points = (record.canonical_payload as { points?: unknown })?.points;
      assert(Array.isArray(points) && points.length === 72);
      assert(!record.limitations.includes("ENGINEERING_FIXTURE_ONLY"));
    }

    const eventRows = await pool.query<{ count: string }>(
      `SELECT count(*)::text AS count
         FROM public.external_evidence_supply_event_v1
        WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3
          AND field_id=$4 AND season_id=$5 AND zone_id=$6`,
      [
        MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1.tenant_id,
        MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1.project_id,
        MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1.group_id,
        MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1.field_id,
        MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1.season_id,
        MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1.zone_id,
      ],
    );
    const cursorRows = await pool.query<{ count: string }>(
      `SELECT count(*)::text AS count
         FROM public.external_evidence_supply_cursor_v1
        WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3
          AND field_id=$4 AND season_id=$5 AND zone_id=$6`,
      [
        MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1.tenant_id,
        MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1.project_id,
        MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1.group_id,
        MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1.field_id,
        MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1.season_id,
        MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1.zone_id,
      ],
    );

    const proof = {
      schema_version: "geox_mcft_cap09_phase5_runtime_evidence_qualification_v1",
      status: "PASS",
      evidence_source: EVIDENCE_SOURCE,
      required_types: [...REQUIRED_TYPES],
      selected_type_count: selected.size,
      real_kbs_soil: true,
      real_product_gfs_pair: true,
      gfs_valid_from: a0,
      gfs_valid_to: addHours(a0, 72),
      causal_by_o00: true,
      engineering_runtime_evidence_fixture_count: 0,
      evidence_event_row_count: Number(eventRows.rows[0]?.count ?? "-1"),
      evidence_cursor_row_count: Number(cursorRows.rows[0]?.count ?? "-1"),
      twin_state_mutation_by_verifier: false,
    };
    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    fs.writeFileSync(OUT, JSON.stringify(proof, null, 2) + "\n");
    process.stdout.write(JSON.stringify(proof) + "\n");
  } finally {
    await pool.end();
  }
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
  console.error(error);
  process.exitCode = 1;
});
