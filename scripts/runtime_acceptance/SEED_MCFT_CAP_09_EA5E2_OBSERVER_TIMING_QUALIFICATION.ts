// Purpose: seed exactly five deterministic qualification-only canonical records
// into the isolated EA5E2 readiness database for observer execution timing.
// Boundary: localhost database only; no provider, Formal, authority, or scheduler effect.

import fs from "node:fs";
import { Pool } from "pg";

import { semanticHashV1 } from "../../apps/server/src/domain/twin_runtime/canonical_identity_v1.js";

import {
  EA5B5B_LOGICAL_TIME_V1,
  buildEa5b5bExternalFixtureV1,
} from "./mcft_cap09_ea5b5b_external_fixture_v1.js";

// Exact qualification target is the persisted fresh-T3R1 O00 candidate produced by the successful bootstrap.
// Source: GEOX-MCFT-CAP-09-EA5E2-T3R1-FRESH-BOOTSTRAP-EFFECTIVENESS-V1.json.
export const EA5E2_OBSERVER_TIMING_TARGET_V1 = "2026-08-15T11:00:00.000Z";
const QUALIFICATION_SHIFT_MS = Date.parse(EA5E2_OBSERVER_TIMING_TARGET_V1) - Date.parse(EA5B5B_LOGICAL_TIME_V1);

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name}_REQUIRED`);
  return value;
}

function assertExactMainDispatch(subject: string): void {
  if (!/^[0-9a-f]{40}$/.test(subject)
      || !["workflow_dispatch", "push"].includes(process.env.GITHUB_EVENT_NAME ?? "")
      || process.env.GITHUB_REF !== "refs/heads/main"
      || process.env.GITHUB_SHA !== subject) {
    throw new Error("EA5E2_OBSERVER_TIMING_SEED_EXACT_MAIN_ACTION_RUN_REQUIRED");
  }
}

function assertIsolatedDatabase(urlText: string): void {
  const url = new URL(urlText);
  if (!["localhost", "127.0.0.1"].includes(url.hostname) || url.pathname.replace(/^\//, "") !== "ea5e2_readiness") {
    throw new Error("EA5E2_OBSERVER_TIMING_SEED_ISOLATED_DATABASE_REQUIRED");
  }
}

function occurredAt(record: Record<string, unknown>): string {
  const role = record.role_time as Record<string, unknown>;
  const value = role.observed_at ?? role.interval_end ?? role.issued_at;
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) {
    throw new Error("EA5E2_OBSERVER_TIMING_SEED_EVENT_TIME_REQUIRED");
  }
  return value;
}

function shiftQualificationTimestamp(value: unknown): unknown {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) {
    return new Date(Date.parse(value) + QUALIFICATION_SHIFT_MS).toISOString();
  }
  if (Array.isArray(value)) return value.map(shiftQualificationTimestamp);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, nested]) => [key, shiftQualificationTimestamp(nested)]),
    );
  }
  return value;
}

function rehashQualificationRecord<T extends {
  tenant_id: string;
  project_id: string;
  group_id: string;
  field_id: string;
  season_id: string;
  zone_id: string;
  record_type: string;
  source_record_id: string;
  binding_id: string;
  origin_source_id: string;
  role_time: unknown;
  canonical_payload: unknown;
  source_record_hash: string;
}>(record: T): T {
  record.source_record_hash = semanticHashV1({
    scope: {
      tenant_id: record.tenant_id,
      project_id: record.project_id,
      group_id: record.group_id,
      field_id: record.field_id,
      season_id: record.season_id,
      zone_id: record.zone_id,
    },
    record_type: record.record_type,
    source_record_id: record.source_record_id,
    binding_id: record.binding_id,
    origin_source_id: record.origin_source_id,
    role_time: record.role_time,
    canonical_payload: record.canonical_payload,
  });
  return record;
}

function bindLateExactIntervalAvailability<T extends {
  record_type: string;
  available_to_runtime_at: string;
  role_time: Record<string, unknown>;
}>(record: T): T {
  if (record.record_type === "observed_rainfall_v1" || record.record_type === "historical_et0_estimate_v1") {
    record.available_to_runtime_at = new Date(Date.parse(EA5E2_OBSERVER_TIMING_TARGET_V1) + 390 * 60_000).toISOString();
    record.role_time.ingested_at = new Date(Date.parse(EA5E2_OBSERVER_TIMING_TARGET_V1) + 391 * 60_000).toISOString();
  }
  return record;
}

function assertQualificationCandidateTiming(record: {
  record_type: string;
  available_to_runtime_at: string;
  role_time: Record<string, unknown>;
}): void {
  const event = Date.parse(occurredAt(record as unknown as Record<string, unknown>));
  const available = Date.parse(record.available_to_runtime_at);
  const ingested = Date.parse(String(record.role_time.ingested_at));
  if (![event, available, ingested].every(Number.isFinite) || event > available || available > ingested) {
    throw new Error(`EA5E2_OBSERVER_TIMING_SEED_CAUSAL_ORDER_INVALID:${record.record_type}`);
  }
  if (record.record_type === "observed_rainfall_v1" || record.record_type === "historical_et0_estimate_v1") {
    const expectedStart = new Date(Date.parse(EA5E2_OBSERVER_TIMING_TARGET_V1) - 60 * 60_000).toISOString();
    if (record.role_time.interval_start !== expectedStart
        || record.role_time.interval_end !== EA5E2_OBSERVER_TIMING_TARGET_V1
        || available > Date.parse(EA5E2_OBSERVER_TIMING_TARGET_V1) + 432 * 60_000) {
      throw new Error(`EA5E2_OBSERVER_TIMING_SEED_EXACT_INTERVAL_INVALID:${record.record_type}`);
    }
  } else if (available > Date.parse(EA5E2_OBSERVER_TIMING_TARGET_V1)) {
    throw new Error(`EA5E2_OBSERVER_TIMING_SEED_PRE_BOUNDARY_AVAILABILITY_INVALID:${record.record_type}`);
  }
}

async function main(): Promise<void> {
  const subject = required("MCFT_EA5E2_SUBJECT_SHA");
  const databaseUrl = required("DATABASE_URL");
  assertExactMainDispatch(subject);
  assertIsolatedDatabase(databaseUrl);
  const fixture = await buildEa5b5bExternalFixtureV1();
  if (fixture.candidates.length !== 5) throw new Error("EA5E2_OBSERVER_TIMING_SEED_EXACT_FIVE_REQUIRED");
  const candidates = fixture.candidates.map((candidate) => rehashQualificationRecord(
    bindLateExactIntervalAvailability(shiftQualificationTimestamp(candidate) as typeof candidate),
  ));
  for (const candidate of candidates) assertQualificationCandidateTiming(candidate);
  const pool = new Pool({ connectionString: databaseUrl, application_name: "mcft-ea5e2-observer-timing-seed" });
  try {
    await pool.query("CREATE TABLE IF NOT EXISTS facts (fact_id text PRIMARY KEY, occurred_at timestamptz NOT NULL, source text NOT NULL, record_json jsonb NOT NULL, ingested_at timestamptz NOT NULL DEFAULT transaction_timestamp())");
    await pool.query("TRUNCATE TABLE facts");
    for (const candidate of candidates) {
      await pool.query(
        "INSERT INTO facts(fact_id,occurred_at,source,record_json) VALUES($1,$2,$3,$4::jsonb)",
        [
          `ea5e2-observer-timing-${candidate.source_record_id}`,
          occurredAt(candidate as unknown as Record<string, unknown>),
          "EA5E2_OBSERVER_TIMING_QUALIFICATION",
          JSON.stringify({ type: candidate.record_type, payload: candidate }),
        ],
      );
    }
    const count = Number((await pool.query("SELECT count(*)::int AS n FROM facts")).rows[0].n);
    if (count !== 5) throw new Error(`EA5E2_OBSERVER_TIMING_SEED_CARDINALITY:${count}`);
    const proof = {
      schema_version: "geox_mcft_cap09_ea5e2_observer_timing_seed_v1",
      status: "PASS",
      subject_sha: subject,
      target_t: EA5E2_OBSERVER_TIMING_TARGET_V1,
      source_fixture_target_t: EA5B5B_LOGICAL_TIME_V1,
      qualification_timestamp_shift_hours: QUALIFICATION_SHIFT_MS / 3_600_000,
      exact_interval_available_offset_minutes: 390,
      exact_interval_ingested_offset_minutes: 391,
      target_selected_from_current_crop_authority_consensus_window: true,
      target_bound_to_fresh_t3r1_o00_candidate: true,
      canonical_fact_count: count,
      fixture_class: "DETERMINISTIC_QUALIFICATION_ONLY",
      provider_request_count: 0,
      formal_database_write_count: 0,
      scheduler_write_count: 0,
      authority_effect: false,
      live_dispatch_authorized: false,
      raw_values_emitted: false,
    };
    fs.mkdirSync("acceptance-output", { recursive: true });
    fs.writeFileSync("acceptance-output/MCFT_CAP_09_EA5E2_OBSERVER_TIMING_SEED.json", JSON.stringify(proof, null, 2) + "\n");
    console.log(JSON.stringify(proof));
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? `${error.name}:${error.message}` : String(error));
  process.exitCode = 1;
});
