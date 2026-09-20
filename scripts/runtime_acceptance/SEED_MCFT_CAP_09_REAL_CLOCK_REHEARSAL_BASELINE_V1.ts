import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { Pool } from "pg";

import { semanticHashV1 } from "../../apps/server/src/domain/twin_runtime/canonical_identity_v1.js";
import { MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1 } from "../../apps/server/src/domain/twin_runtime/external_formal_runtime_config_v1.js";
import {
  MCFT_CAP09_EXTERNAL_FORMAL_FUTURE_ET0_BINDING_ID_V1,
  MCFT_CAP09_EXTERNAL_FORMAL_FUTURE_WEATHER_BINDING_ID_V1,
  MCFT_CAP09_EXTERNAL_FORMAL_SOIL_BINDING_ID_V1,
} from "../../apps/server/src/domain/twin_runtime/external_formal_evidence_binding_profile_v1.js";
import type { CanonicalReplayEvidenceRecordV1 } from "../../apps/server/src/runtime/twin_runtime/ports.js";

const SOURCE = "mcft_cap09_external_formal_evidence_v1";
const DATASET = "mcft_cap09_real_clock_rehearsal_baseline_v1";
const LIMITATIONS = [
  "QUALIFICATION_REHEARSAL_ONLY",
  "CONTROLLED_ENGINEERING_BASELINE",
  "NOT_FORMAL_EXTERNAL_EVIDENCE",
  "NOT_STAGE_1B_CLOSURE_EVIDENCE",
];
const HOUR = 3_600_000;

function env(name: string): string {
  const value = String(process.env[name] ?? "").trim();
  if (!value) throw new Error("REAL_CLOCK_REHEARSAL_SEED_ENV_REQUIRED:" + name);
  return value;
}
function canonicalHour(value: string): string {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new Error("REAL_CLOCK_REHEARSAL_SEED_A0_INVALID");
  const canonical = new Date(parsed).toISOString();
  if (canonical !== value || !canonical.endsWith(":00:00.000Z")) {
    throw new Error("REAL_CLOCK_REHEARSAL_SEED_A0_EXACT_HOUR_REQUIRED");
  }
  return canonical;
}
function addHours(value: string, hours: number): string {
  return new Date(Date.parse(value) + hours * HOUR).toISOString();
}
function weatherPoints(base: string, seed: number): Array<Record<string, unknown>> {
  return Array.from({ length: 72 }, (_, index) => ({
    horizon: index + 1,
    valid_from: addHours(base, index),
    valid_to: addHours(base, index + 1),
    precipitation_mm: Number((0.03 + ((index + seed) % 5) * 0.004).toFixed(6)),
  }));
}
function et0Points(base: string, seed: number): Array<Record<string, unknown>> {
  return Array.from({ length: 72 }, (_, index) => ({
    horizon: index + 1,
    valid_from: addHours(base, index),
    valid_to: addHours(base, index + 1),
    et0_mm_per_hour: Number((0.11 + ((index + seed) % 4) * 0.003).toFixed(6)),
  }));
}
function assumption(
  kind: "weather" | "et0",
  base: string,
  seed: number,
  chronology: string,
): CanonicalReplayEvidenceRecordV1 {
  const bindingId = kind === "weather"
    ? MCFT_CAP09_EXTERNAL_FORMAL_FUTURE_WEATHER_BINDING_ID_V1
    : MCFT_CAP09_EXTERNAL_FORMAL_FUTURE_ET0_BINDING_ID_V1;
  const recordType = kind === "weather"
    ? "future_weather_assumption_v1"
    : "future_et0_assumption_v1";
  const sourceId = `real_clock_rehearsal_${kind}_${base}_${seed}`;
  const payload = {
    snapshot_kind: kind === "weather"
      ? "FUTURE_WEATHER_ASSUMPTION"
      : "FUTURE_ET0_ASSUMPTION",
    points: kind === "weather"
      ? weatherPoints(base, seed)
      : et0Points(base, seed),
  };
  return {
    dataset_id: DATASET,
    source_record_id: sourceId,
    source_record_hash: semanticHashV1({
      sourceId, bindingId, chronology, base, payload,
    }),
    record_type: recordType,
    binding_id: bindingId,
    origin_source_kind: "CONTROLLED_ENGINEERING_FIXTURE",
    origin_source_id: kind === "weather"
      ? "GFS_QUALIFICATION_REHEARSAL_BASELINE"
      : "ET0_QUALIFICATION_REHEARSAL_BASELINE",
    epistemic_class: "ASSUMED",
    ...MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1,
    available_to_runtime_at: chronology,
    role_time: {
      issued_at: chronology,
      available_to_runtime_at: chronology,
      retrieved_at: chronology,
      ingested_at: chronology,
      valid_from: base,
      valid_to: addHours(base, 72),
    },
    quality: { status: "PASS" },
    source_payload: structuredClone(payload),
    canonical_payload: payload,
    source_unit: "mm",
    canonical_unit: "mm",
    conversion_rule: {
      rule_id: kind === "weather"
        ? "PRECIPITATION_MM_IDENTITY_V1"
        : "ET0_MM_PER_HOUR_IDENTITY_V1",
      version: "1",
    },
    limitations: [...LIMITATIONS],
  } as CanonicalReplayEvidenceRecordV1;
}
function soil(a0: string, chronology: string): CanonicalReplayEvidenceRecordV1 {
  if (!(Date.parse(chronology) > Date.parse(a0) - HOUR && Date.parse(chronology) < Date.parse(a0))) {
    throw new Error("REAL_CLOCK_REHEARSAL_SEED_CHRONOLOGY_MUST_BE_INSIDE_A0_WINDOW");
  }
  const value = 0.31;
  const sourceId = `real_clock_rehearsal_soil_${a0}`;
  const canonicalPayload = {
    quantity_kind: "VOLUMETRIC_WATER_CONTENT",
    unit: "fraction",
    value,
  };
  return {
    dataset_id: DATASET,
    source_record_id: sourceId,
    source_record_hash: semanticHashV1({
      sourceId, chronology, canonicalPayload,
    }),
    record_type: "soil_moisture_observation_v1",
    binding_id: MCFT_CAP09_EXTERNAL_FORMAL_SOIL_BINDING_ID_V1,
    origin_source_kind: "CONTROLLED_ENGINEERING_FIXTURE",
    origin_source_id: "SOIL_QUALIFICATION_REHEARSAL_BOOTSTRAP",
    epistemic_class: "OBSERVED",
    ...MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1,
    available_to_runtime_at: chronology,
    role_time: {
      observed_at: chronology,
      available_to_runtime_at: chronology,
      retrieved_at: chronology,
      ingested_at: chronology,
    },
    quality: { status: "PASS" },
    source_payload: {
      source_version: "qualification-rehearsal-v1",
      unit: "fraction",
      value,
    },
    canonical_payload: canonicalPayload,
    source_unit: "fraction",
    canonical_unit: "fraction",
    conversion_rule: {
      id: "VWC_FRACTION_IDENTITY_V1",
      version: "1",
    },
    limitations: [...LIMITATIONS],
  } as CanonicalReplayEvidenceRecordV1;
}
function eventTime(record: CanonicalReplayEvidenceRecordV1): string {
  return record.record_type === "soil_moisture_observation_v1"
    ? String(record.role_time?.observed_at)
    : String(record.role_time?.issued_at);
}
async function insert(pool: Pool, record: CanonicalReplayEvidenceRecordV1): Promise<void> {
  const factId = "real_clock_rehearsal_" + createHash("sha256")
    .update(`${record.source_record_id}|${record.source_record_hash}`)
    .digest("hex");
  const result = await pool.query(
    `INSERT INTO facts (fact_id,occurred_at,source,record_json)
     VALUES ($1,$2::timestamptz,$3,$4::jsonb)
     ON CONFLICT (fact_id) DO NOTHING`,
    [factId, eventTime(record), SOURCE, JSON.stringify({ type: record.record_type, payload: record })],
  );
  if (result.rowCount !== 1) throw new Error("REAL_CLOCK_REHEARSAL_SEED_FACT_CONFLICT:" + factId);
}
async function main(): Promise<void> {
  const a0 = canonicalHour(env("GEOX_MCFT_CAP09_REHEARSAL_A0"));
  const output = path.resolve(env("GEOX_MCFT_CAP09_REHEARSAL_SEED_PROOF_OUTPUT"));
  const chronology = new Date().toISOString();
  if (Date.parse(chronology) >= Date.parse(a0)) {
    throw new Error("REAL_CLOCK_REHEARSAL_SEED_MUST_RUN_BEFORE_A0");
  }
  if (Date.parse(a0) - Date.parse(chronology) > HOUR) {
    throw new Error("REAL_CLOCK_REHEARSAL_A0_MUST_BE_NEXT_UTC_HOUR");
  }

  const pool = new Pool({ connectionString: env("DATABASE_URL"), max: 2 });
  try {
    const records: CanonicalReplayEvidenceRecordV1[] = [soil(a0, chronology)];
    for (let index = 0; index < 24; index += 1) {
      const base = addHours(a0, index);
      records.push(
        assumption("weather", base, index + 1, chronology),
        assumption("et0", base, index + 1, chronology),
      );
    }
    for (const record of records) await insert(pool, record);

    const count = Number((await pool.query(
      `SELECT count(*)::int AS n
         FROM facts
        WHERE source=$1
          AND record_json#>>'{payload,dataset_id}'=$2`,
      [SOURCE, DATASET],
    )).rows[0]?.n ?? -1);
    if (count !== 49) throw new Error("REAL_CLOCK_REHEARSAL_EXACT_49_BASELINE_FACTS_REQUIRED:" + count);

    const proof = {
      schema_version: "geox_mcft_cap09_real_clock_rehearsal_baseline_seed_v1",
      status: "PASS",
      run_class: "QUALIFICATION_REHEARSAL",
      a0,
      r00: addHours(a0, 1),
      r23: addHours(a0, 24),
      seeded_at: chronology,
      isolated_baseline_fact_count: count,
      soil_seed_count: 1,
      future_weather_baseline_count: 24,
      future_et0_baseline_count: 24,
      baseline_role: "KEEP_RUNTIME_OBSERVABLE_WHILE_PROVIDER_PLANE_IS_TESTED_INDEPENDENTLY",
      physical_seed_chronology_precedes_a0: true,
      live_provider_claim: false,
      formal_evidence_claim: false,
      formal_v5_arm: false,
      a0_authorized: false,
      o00_authorized: false,
      stage_1b_closure_claim: false,
    };
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, JSON.stringify(proof, null, 2) + "\n");
    console.log(JSON.stringify(proof, null, 2));
  } finally {
    await pool.end();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
