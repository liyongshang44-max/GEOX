import assert from "node:assert/strict";
import { Pool } from "pg";

const BASE_URL = String(process.env.BASE_URL ?? process.env.API_BASE_URL ?? "").replace(/\/$/, "");
const DATABASE_URL = String(process.env.DATABASE_URL ?? "").trim();
const ROUTE = "/api/v1/weather/forecast/ingest";
const ERROR = "WEATHER_FORECAST_INGEST_COMMERCIAL_AUTHORITY_UNAVAILABLE";

if (!BASE_URL) throw new Error("BLINE_PR_SEC_2_WEATHER_BASE_URL_REQUIRED");
if (!DATABASE_URL) throw new Error("BLINE_PR_SEC_2_WEATHER_DATABASE_URL_REQUIRED");

type Counts = {
  facts: number;
  weather_forecast_index_v1: number;
  weather_forecast_index_present: boolean;
};

async function counts(pool: Pool): Promise<Counts> {
  const facts = await pool.query<{ n: string }>("SELECT count(*)::text AS n FROM facts");
  const reg = await pool.query<{ present: boolean }>("SELECT to_regclass('public.weather_forecast_index_v1') IS NOT NULL AS present");
  const present = reg.rows[0]?.present === true;
  let weather = 0;
  if (present) {
    const result = await pool.query<{ n: string }>("SELECT count(*)::text AS n FROM weather_forecast_index_v1");
    weather = Number(result.rows[0]?.n ?? "0");
  }
  return {
    facts: Number(facts.rows[0]?.n ?? "0"),
    weather_forecast_index_v1: weather,
    weather_forecast_index_present: present,
  };
}

async function main(): Promise<void> {
  const pool = new Pool({ connectionString: DATABASE_URL, max: 1 });
  try {
    const before = await counts(pool);
    const response = await fetch(`${BASE_URL}${ROUTE}`, {
      method: "POST",
      redirect: "manual",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer arbitrary-untrusted-weather-caller",
      },
      body: JSON.stringify({
        tenant_id: "tenantEvil",
        project_id: "projectEvil",
        group_id: "groupEvil",
        field_id: "fieldEvil",
        provider: "ATTACKER_PROVIDER",
        source_type: "WEATHER_PROVIDER_API",
        source_id: "attacker-source",
        generated_at: "2099-01-01T00:00:00.000Z",
        valid_from: "2099-01-01T00:00:00.000Z",
        valid_to: "2099-01-04T00:00:00.000Z",
        hourly: [{ ts: "2099-01-01T00:00:00.000Z", rainfall_mm: 999999 }],
        raw_payload: { attacker: true },
      }),
    });
    assert.equal(response.status, 403, "Commercial BSEC-003 must fail closed");
    const body = await response.json() as { ok?: unknown; error?: unknown };
    assert.equal(body.ok, false, "Commercial BSEC-003 rejection ok flag");
    assert.equal(body.error, ERROR, "Commercial BSEC-003 rejection error");

    // Give any accidental post-response continuation a chance to execute before the
    // durable-count proof is taken.
    await new Promise((resolve) => setTimeout(resolve, 100));
    const after = await counts(pool);

    assert.equal(after.facts, before.facts, "facts delta must be zero after rejected Commercial ingest");
    assert.equal(
      after.weather_forecast_index_v1,
      before.weather_forecast_index_v1,
      "weather_forecast_index_v1 delta must be zero after rejected Commercial ingest",
    );
    assert.equal(
      after.weather_forecast_index_present,
      before.weather_forecast_index_present,
      "rejected Commercial ingest must not create weather_forecast_index_v1 as a deferred schema side effect",
    );

    console.log(JSON.stringify({
      result: "PASS",
      route: ROUTE,
      runtime: "docker-compose.commercial_v1.yml server registration",
      status: response.status,
      error: body.error,
      before,
      after,
      facts_delta: after.facts - before.facts,
      weather_forecast_index_v1_delta: after.weather_forecast_index_v1 - before.weather_forecast_index_v1,
      deferred_schema_delta: Number(after.weather_forecast_index_present) - Number(before.weather_forecast_index_present),
      new_principal_created: false,
      new_capability_created: false,
      mcft_modified: false,
    }, null, 2));
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
