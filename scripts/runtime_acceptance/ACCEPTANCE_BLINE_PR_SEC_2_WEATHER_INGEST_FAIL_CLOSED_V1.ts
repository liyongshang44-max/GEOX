import assert from "node:assert/strict";
import Fastify from "fastify";

import { registerWeatherV1Routes } from "../../apps/server/src/routes/weather_v1.js";

const ROUTE = "/api/v1/weather/forecast/ingest";
const ERROR = "WEATHER_FORECAST_INGEST_COMMERCIAL_AUTHORITY_UNAVAILABLE";

type MutationCounters = {
  total_queries: number;
  facts_mutations: number;
  weather_index_mutations: number;
  schema_ensure_queries: number;
};

const counters: MutationCounters = {
  total_queries: 0,
  facts_mutations: 0,
  weather_index_mutations: 0,
  schema_ensure_queries: 0,
};

const trapPool = {
  async query(sqlLike: unknown): Promise<never> {
    counters.total_queries += 1;
    const sql = typeof sqlLike === "string"
      ? sqlLike
      : String((sqlLike as { text?: unknown } | null)?.text ?? sqlLike ?? "");
    if (/\b(?:insert\s+into|update|delete\s+from)\s+(?:public\.)?facts\b/i.test(sql)) {
      counters.facts_mutations += 1;
    }
    if (/\b(?:insert\s+into|update|delete\s+from)\s+(?:public\.)?weather_forecast_index_v1\b/i.test(sql)) {
      counters.weather_index_mutations += 1;
    }
    if (/\b(?:create|alter)\s+(?:table|index)\b[\s\S]*weather_forecast_index_v1/i.test(sql)) {
      counters.schema_ensure_queries += 1;
    }
    throw new Error(`PR_SEC_2_WEATHER_FAIL_CLOSED_DOWNSTREAM_QUERY_REACHED:${sql.slice(0, 180)}`);
  },
} as any;

const cases: Array<{
  name: string;
  headers?: Record<string, string>;
  payload: Record<string, unknown>;
}> = [
  {
    name: "missing_credential",
    payload: { field_id: "fieldA" },
  },
  {
    name: "arbitrary_bearer",
    headers: { authorization: "Bearer arbitrary-untrusted-token" },
    payload: { field_id: "fieldA" },
  },
  {
    name: "caller_controlled_tenant",
    payload: { tenant_id: "tenantEvil", field_id: "fieldA" },
  },
  {
    name: "caller_controlled_project",
    payload: { project_id: "projectEvil", field_id: "fieldA" },
  },
  {
    name: "caller_controlled_group",
    payload: { group_id: "groupEvil", field_id: "fieldA" },
  },
  {
    name: "caller_controlled_field",
    payload: { field_id: "fieldEvil" },
  },
  {
    name: "caller_controlled_provider_source",
    payload: {
      field_id: "fieldA",
      provider: "ATTACKER_PROVIDER",
      source_type: "WEATHER_PROVIDER_API",
      source_id: "attacker-source",
    },
  },
  {
    name: "caller_controlled_raw_hourly_payload",
    payload: {
      field_id: "fieldA",
      hourly: [{ ts: "2099-01-01T00:00:00.000Z", rainfall_mm: 999999 }],
      raw_payload: { attacker: true, tenant_id: "tenantEvil" },
    },
  },
];

async function main(): Promise<void> {
  const app = Fastify({ logger: false });
  registerWeatherV1Routes(app, trapPool);
  await app.ready();

  const before = { ...counters };
  const matrix: Array<Record<string, unknown>> = [];

  try {
    for (const testCase of cases) {
      const response = await app.inject({
        method: "POST",
        url: ROUTE,
        headers: testCase.headers,
        payload: testCase.payload,
      });
      assert.equal(response.statusCode, 403, `${testCase.name}: status`);
      const body = response.json() as { ok?: unknown; error?: unknown };
      assert.equal(body.ok, false, `${testCase.name}: ok`);
      assert.equal(body.error, ERROR, `${testCase.name}: error`);

      // Flush immediate promise continuations; a rejected request must not schedule a
      // downstream DB write after its response has been produced.
      await new Promise<void>((resolve) => setImmediate(resolve));
      assert.deepEqual(counters, before, `${testCase.name}: persistence must remain untouched`);

      matrix.push({
        case: testCase.name,
        status: response.statusCode,
        error: body.error,
        db_query_count: counters.total_queries,
        facts_delta: counters.facts_mutations - before.facts_mutations,
        weather_forecast_index_v1_delta: counters.weather_index_mutations - before.weather_index_mutations,
        schema_ensure_delta: counters.schema_ensure_queries - before.schema_ensure_queries,
      });
    }
  } finally {
    await app.close();
  }

  assert.equal(counters.total_queries, 0, "focused weather-route rejection must issue zero DB queries");
  assert.equal(counters.facts_mutations, 0, "facts delta must remain zero");
  assert.equal(counters.weather_index_mutations, 0, "weather_forecast_index_v1 delta must remain zero");
  assert.equal(counters.schema_ensure_queries, 0, "weather index ensure path must remain unreachable");

  console.log(JSON.stringify({
    result: "PASS",
    registration_under_test: "registerWeatherV1Routes",
    production_registration_proven_separately: "registerSensingModule -> registerWeatherV1Routes + Commercial Compose runtime HTTP proof",
    route: ROUTE,
    containment: "COMMERCIAL_FAIL_CLOSE",
    rejection_cases: matrix.length,
    matrix,
    writer_unreachable: {
      total_db_query_count: counters.total_queries,
      facts_delta: counters.facts_mutations,
      weather_forecast_index_v1_delta: counters.weather_index_mutations,
      ensure_weather_forecast_index_v1_delta: counters.schema_ensure_queries,
    },
    new_principal_created: false,
    new_capability_created: false,
    mcft_modified: false,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
