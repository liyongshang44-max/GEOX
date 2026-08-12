import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";

import { PostgresPfe14Mcft09OperationalReadApiV1 } from "../../apps/server/src/services/pfe14_mcft09_operational_read_api_v1.js";
import type { CanonicalReplayEvidenceRecordV1, TwinScopeKeyV1 } from "../../apps/server/src/runtime/twin_runtime/ports.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const OUT = path.join(ROOT, "acceptance-output/PFE14_MCFT09_OPERATIONAL_READ_PROVIDER_DB_RESULT.json");
const SOURCE = "pfe14_mcft09_operational_read_provider_acceptance";
const scope: TwinScopeKeyV1 = { tenant_id: "tenantA", project_id: "projectA", group_id: "groupA", field_id: "fieldA", season_id: "seasonA", zone_id: "zoneA" };
type RT = "soil_moisture_observation_v1" | "observed_rainfall_v1" | "historical_et0_estimate_v1" | "future_weather_assumption_v1";

const sha = (value: unknown) => `sha256:${crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex")}`;
const eventField = (type: RT) => type === "soil_moisture_observation_v1" ? "observed_at" : type === "observed_rainfall_v1" || type === "historical_et0_estimate_v1" ? "interval_end" : "issued_at";
const epistemic = (type: RT) => type === "historical_et0_estimate_v1" ? "ESTIMATED" : type.startsWith("future_") ? "ASSUMED" : "OBSERVED";

function evidence(id: string, type: RT, event: string, options: { ingested?: string; available?: string; origin?: string; value?: number } = {}): CanonicalReplayEvidenceRecordV1 {
  const canonical_payload = { value: options.value ?? 1, record_type: type };
  const ingested = options.ingested ?? event;
  const available = options.available ?? ingested;
  return {
    ...scope,
    dataset_id: "pfe14_mcft09_operational_acceptance_v1",
    source_record_id: id,
    source_record_hash: sha({ id, canonical_payload }),
    record_type: type,
    binding_id: `binding:${type}`,
    origin_source_kind: "CONTROLLED_DATABASE_EVIDENCE",
    origin_source_id: options.origin ?? `source:${type}`,
    epistemic_class: epistemic(type),
    available_to_runtime_at: available,
    role_time: { [eventField(type)]: event, ingested_at: ingested },
    quality: { status: "PASS" },
    source_payload: { acceptance: true },
    canonical_payload,
    source_unit: "unitless",
    canonical_unit: "unitless",
    conversion_rule: { rule_id: "IDENTITY_V1" },
    limitations: [],
  } as CanonicalReplayEvidenceRecordV1;
}

async function insertEvidence(pool: Pool, factId: string, record: CanonicalReplayEvidenceRecordV1): Promise<void> {
  await pool.query(
    `INSERT INTO facts(fact_id,occurred_at,source,record_json) VALUES($1,$2::timestamptz,$3,$4::jsonb)`,
    [factId, record.available_to_runtime_at, SOURCE, JSON.stringify({ type: record.record_type, payload: record })],
  );
}

async function reset(pool: Pool): Promise<void> {
  await pool.query("DROP SCHEMA public CASCADE");
  await pool.query("CREATE SCHEMA public");
  await pool.query(fs.readFileSync(path.join(ROOT, "docker/postgres/init/001_schema.sql"), "utf8"));
  await pool.query(fs.readFileSync(path.join(ROOT, "apps/server/db/migrations/2026_08_06_mcft_cap_09_s3_persistent_sequential_scheduler.sql"), "utf8"));
}

async function seed(pool: Pool): Promise<void> {
  await pool.query(
    `INSERT INTO twin_shadow_online_scheduler_cursor_v1
     (tenant_id,project_id,group_id,field_id,season_id,zone_id,schedule_start_logical_time,next_slot_index,next_slot_id,next_logical_time,last_terminal_slot_id,last_terminal_logical_time,last_fencing_token)
     VALUES ($1,$2,$3,$4,$5,$6,'2026-08-05T00:00:00.000Z',11,'O11','2026-08-05T11:00:00.000Z','O10','2026-08-05T10:00:00.000Z',1)`,
    Object.values(scope),
  );
  await pool.query(
    `INSERT INTO twin_shadow_online_scheduler_slot_v1
     (tenant_id,project_id,group_id,field_id,season_id,zone_id,slot_id,logical_time,scheduler_wall_clock_observed_at,interval_seconds,state,lease_owner,fencing_token,idempotency_key,claimed_at,tick_ref,health_ref,terminal_at)
     VALUES ($1,$2,$3,$4,$5,$6,'O10','2026-08-05T10:00:00.000Z','2026-08-05T10:00:02.000Z',3600,'DEGRADED','writer-a',1,'idem-o10','2026-08-05T10:00:01.000Z','tick:o10','health:o10','2026-08-05T10:05:00.000Z')`,
    Object.values(scope),
  );

  const rows: Array<[string, CanonicalReplayEvidenceRecordV1]> = [
    ["f01", evidence("soil-0910", "soil_moisture_observation_v1", "2026-08-05T09:10:00.000Z", { ingested: "2026-08-05T09:11:00.000Z", origin: "soil-1", value: 18.2 })],
    ["f02", evidence("rain-0930", "observed_rainfall_v1", "2026-08-05T09:30:00.000Z", { ingested: "2026-08-05T09:31:00.000Z", origin: "rain-1" })],
    ["f03", evidence("et0-0945", "historical_et0_estimate_v1", "2026-08-05T09:45:00.000Z", { ingested: "2026-08-05T09:46:00.000Z", origin: "et0-1" })],
    ["f04", evidence("soil-out-of-order-0920", "soil_moisture_observation_v1", "2026-08-05T09:20:00.000Z", { ingested: "2026-08-05T09:55:00.000Z", available: "2026-08-05T09:56:00.000Z", origin: "soil-2" })],
    ["f05", evidence("future-event", "soil_moisture_observation_v1", "2026-08-05T10:05:00.000Z", { ingested: "2026-08-05T09:58:00.000Z", available: "2026-08-05T10:06:00.000Z", origin: "soil-future" })],
    ["f06", evidence("late-ingested", "observed_rainfall_v1", "2026-08-05T09:35:00.000Z", { ingested: "2026-08-05T10:02:00.000Z", available: "2026-08-05T09:59:00.000Z", origin: "rain-late" })],
    ["f07", evidence("late-available", "soil_moisture_observation_v1", "2026-08-05T09:36:00.000Z", { ingested: "2026-08-05T09:37:00.000Z", available: "2026-08-05T10:03:00.000Z", origin: "soil-late" })],
  ];
  for (const [factId, record] of rows) await insertEvidence(pool, factId, record);
}

async function main(): Promise<void> {
  if (process.env.PFE14_MCFT09_OPERATIONAL_READ_DESTRUCTIVE_ACCEPTANCE !== "1") throw new Error("SET_PFE14_MCFT09_OPERATIONAL_READ_DESTRUCTIVE_ACCEPTANCE_1");
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL_REQUIRED");
  const databaseName = decodeURIComponent(new URL(url).pathname.slice(1));
  if (!/(pfe14|mcft|operational|acceptance|test)/i.test(databaseName)) throw new Error(`ISOLATED_ACCEPTANCE_DATABASE_REQUIRED:${databaseName}`);
  const pool = new Pool({ connectionString: url });
  try {
    await reset(pool);
    await seed(pool);
    const factsBefore = Number((await pool.query("SELECT count(*)::int n FROM facts")).rows[0].n);
    const slotsBefore = Number((await pool.query("SELECT count(*)::int n FROM twin_shadow_online_scheduler_slot_v1")).rows[0].n);
    const api = new PostgresPfe14Mcft09OperationalReadApiV1(pool);
    const result = await api.readOperationalSummary({ scope });

    assert.equal(result.schema_version, "pfe14_mcft09_operational_summary_v1");
    assert.deepEqual(result.request_scope, scope);
    assert.equal(result.scheduler_summary.scheduler_status, "WAITING");
    assert.equal(result.scheduler_summary.latest_completed_slot, "2026-08-05T10:00:00.000Z");
    assert.equal(result.scheduler_summary.latest_tick_ref, "tick:o10");
    assert.equal(result.scheduler_summary.latest_tick_status, "DEGRADED");
    assert.equal(result.scheduler_summary.latest_tick_started_at, null);
    assert.equal(result.scheduler_summary.latest_tick_completed_at, "2026-08-05T10:05:00.000Z");
    assert.equal(result.scheduler_summary.next_target_slot, "2026-08-05T11:00:00.000Z");
    assert((result.scheduler_summary.scheduler_lag_ms ?? 0) > 0);

    assert.deepEqual(result.evidence_availability.eligibility_boundary, { slot_id: "O10", logical_time: "2026-08-05T10:00:00.000Z" });
    assert.equal(result.evidence_availability.latest_evidence_observed_at, "2026-08-05T09:45:00.000Z");
    assert.equal(result.evidence_availability.latest_evidence_ingested_at, "2026-08-05T09:55:00.000Z");
    assert.equal(result.evidence_availability.evidence_age_ms, 900000);
    assert.equal(result.evidence_availability.freshness_status, "FRESH");
    assert.equal(result.evidence_availability.freshness_threshold_ms, 3600000);
    assert.equal(result.evidence_availability.coverage_ratio, 1);
    assert.equal(result.evidence_availability.maximum_gap_ms, 900000);
    assert.equal(result.evidence_availability.future_excluded_count, 1);
    assert.equal(result.evidence_availability.late_evidence_count, 2);
    assert.equal(result.evidence_availability.out_of_order_count, 1);
    assert.match(result.operational_content_hash, /^sha256:/);
    assert.match(result.response_instance_hash, /^sha256:/);
    assert(result.limitations.includes("NO_DYNAMIC_SHADOW_ONLINE_RUNTIME_MODE_CLAIM"));

    assert.equal(Number((await pool.query("SELECT count(*)::int n FROM facts")).rows[0].n), factsBefore, "PROVIDER_MUST_NOT_WRITE_FACTS");
    assert.equal(Number((await pool.query("SELECT count(*)::int n FROM twin_shadow_online_scheduler_slot_v1")).rows[0].n), slotsBefore, "PROVIDER_MUST_NOT_MUTATE_SCHEDULER_SLOTS");

    const output = {
      status: "PASS",
      acceptance_mode: "REAL_POSTGRESQL_PFE14_MCFT09_GET_ONLY_OPERATIONAL_READ_PROVIDER",
      exact_six_key_scope_verified: true,
      scheduler_summary_verified: true,
      evidence_availability_verified: true,
      evidence_boundary: result.evidence_availability.eligibility_boundary,
      s2_freshness_semantics_reused: true,
      future_excluded_count: result.evidence_availability.future_excluded_count,
      late_evidence_count: result.evidence_availability.late_evidence_count,
      out_of_order_count: result.evidence_availability.out_of_order_count,
      dynamic_shadow_online_claimed: false,
      canonical_write_performed: false,
      scheduler_mutation_performed: false,
    };
    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    fs.writeFileSync(OUT, JSON.stringify(output, null, 2) + "\n");
    console.log(JSON.stringify(output, null, 2));
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify({ status: "FAIL", error: String((error as Error)?.message ?? error) }, null, 2) + "\n");
  console.error(error);
  process.exitCode = 1;
});
