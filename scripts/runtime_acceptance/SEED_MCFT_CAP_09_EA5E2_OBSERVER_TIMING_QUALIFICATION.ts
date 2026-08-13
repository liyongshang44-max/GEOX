// Purpose: seed exactly five deterministic qualification-only canonical records
// into the isolated EA5E2 readiness database for observer execution timing.
// Boundary: localhost database only; no provider, Formal, authority, or scheduler effect.

import fs from "node:fs";
import { Pool } from "pg";

import {
  EA5B5B_LOGICAL_TIME_V1,
  buildEa5b5bExternalFixtureV1,
} from "./mcft_cap09_ea5b5b_external_fixture_v1.js";

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name}_REQUIRED`);
  return value;
}

function assertExactMainDispatch(subject: string): void {
  if (!/^[0-9a-f]{40}$/.test(subject)
      || process.env.GITHUB_EVENT_NAME !== "workflow_dispatch"
      || process.env.GITHUB_REF !== "refs/heads/main"
      || process.env.GITHUB_SHA !== subject) {
    throw new Error("EA5E2_OBSERVER_TIMING_SEED_EXACT_MAIN_WORKFLOW_DISPATCH_REQUIRED");
  }
}

function assertIsolatedDatabase(urlText: string): void {
  const url = new URL(urlText);
  if (!['localhost', '127.0.0.1'].includes(url.hostname) || url.pathname.replace(/^\//, '') !== 'ea5e2_readiness') {
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

async function main(): Promise<void> {
  const subject = required("MCFT_EA5E2_SUBJECT_SHA");
  const databaseUrl = required("DATABASE_URL");
  assertExactMainDispatch(subject);
  assertIsolatedDatabase(databaseUrl);
  const fixture = await buildEa5b5bExternalFixtureV1();
  if (fixture.candidates.length !== 5) throw new Error("EA5E2_OBSERVER_TIMING_SEED_EXACT_FIVE_REQUIRED");
  const pool = new Pool({ connectionString: databaseUrl, application_name: "mcft-ea5e2-observer-timing-seed" });
  try {
    await pool.query("CREATE TABLE IF NOT EXISTS facts (fact_id text PRIMARY KEY, occurred_at timestamptz NOT NULL, source text NOT NULL, record_json jsonb NOT NULL, ingested_at timestamptz NOT NULL DEFAULT transaction_timestamp())");
    await pool.query("TRUNCATE TABLE facts");
    for (const candidate of fixture.candidates) {
      await pool.query(
        "INSERT INTO facts(fact_id,occurred_at,source,record_json) VALUES($1,$2,$3,$4::jsonb)",
        [`ea5e2-observer-timing-${candidate.source_record_id}`, occurredAt(candidate as unknown as Record<string, unknown>), "EA5E2_OBSERVER_TIMING_QUALIFICATION", JSON.stringify(candidate)],
      );
    }
    const count = Number((await pool.query("SELECT count(*)::int AS n FROM facts")).rows[0].n);
    if (count !== 5) throw new Error(`EA5E2_OBSERVER_TIMING_SEED_CARDINALITY:${count}`);
    const proof = {
      schema_version: "geox_mcft_cap09_ea5e2_observer_timing_seed_v1",
      status: "PASS",
      subject_sha: subject,
      target_t: EA5B5B_LOGICAL_TIME_V1,
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
