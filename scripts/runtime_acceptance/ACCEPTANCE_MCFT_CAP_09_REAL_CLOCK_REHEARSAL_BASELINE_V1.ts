import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  MCFT_CAP09_REAL_CLOCK_REHEARSAL_BASELINE_ID_V1,
  seedMcftCap09RealClockRehearsalBaselineV1,
} from "../../apps/server/src/runtime/twin_runtime/qualification/mcft_cap09_real_clock_rehearsal_baseline_v1.js";

const OUT = path.resolve(
  "acceptance-output/MCFT_CAP_09_REAL_CLOCK_REHEARSAL_BASELINE_V1_RESULT.json",
);
const A0 = "2030-01-01T01:00:00.000Z";
const SEEDED = "2030-01-01T00:30:00.000Z";

type StoredV1 = {
  fact_id: string;
  occurred_at: string;
  source: string;
  record: Record<string, any>;
};

class FakePoolV1 {
  readonly facts = new Map<string, StoredV1>();

  async query(sql: string, params: readonly unknown[] = []): Promise<any> {
    if (/INSERT INTO facts/.test(sql)) {
      const factId = String(params[0] ?? "");
      if (this.facts.has(factId)) return { rowCount: 0, rows: [] };
      const record = JSON.parse(String(params[3] ?? "{}")) as Record<string, any>;
      this.facts.set(factId, {
        fact_id: factId,
        occurred_at: String(params[1] ?? ""),
        source: String(params[2] ?? ""),
        record,
      });
      return { rowCount: 1, rows: [] };
    }
    if (/count\(\*\)::int AS total/.test(sql)) {
      const source = String(params[0] ?? "");
      const dataset = String(params[1] ?? "");
      const rows = [...this.facts.values()].filter((row) =>
        row.source === source
        && row.record?.payload?.dataset_id === dataset
      );
      const countType = (type: string) =>
        rows.filter((row) => row.record?.type === type).length;
      const missingMarker = rows.filter((row) =>
        !Array.isArray(row.record?.payload?.limitations)
        || !row.record.payload.limitations.includes("QUALIFICATION_REHEARSAL_ONLY")
      ).length;
      return {
        rowCount: 1,
        rows: [{
          total: rows.length,
          soil: countType("soil_moisture_observation_v1"),
          weather: countType("future_weather_assumption_v1"),
          et0: countType("future_et0_assumption_v1"),
          missing_rehearsal_marker: missingMarker,
        }],
      };
    }
    throw new Error("REAL_CLOCK_REHEARSAL_BASELINE_FAKE_POOL_UNEXPECTED_QUERY");
  }
}

async function main(): Promise<void> {
  const pool = new FakePoolV1();
  const first = await seedMcftCap09RealClockRehearsalBaselineV1({
    pool: pool as any,
    a0: A0,
    seeded_at: SEEDED,
  });

  assert.equal(first.baseline_id, MCFT_CAP09_REAL_CLOCK_REHEARSAL_BASELINE_ID_V1);
  assert.equal(first.fact_count, 49);
  assert.equal(first.inserted_count, 49);
  assert.equal(first.soil_count, 1);
  assert.equal(first.future_weather_count, 24);
  assert.equal(first.future_et0_count, 24);
  assert.equal(first.a0, A0);
  assert.equal(first.r00, "2030-01-01T02:00:00.000Z");
  assert.equal(first.r23, "2030-01-02T01:00:00.000Z");

  const second = await seedMcftCap09RealClockRehearsalBaselineV1({
    pool: pool as any,
    a0: A0,
    seeded_at: SEEDED,
  });
  assert.equal(second.fact_count, 49);
  assert.equal(second.inserted_count, 0, "REHEARSAL_BASELINE_RERUN_MUST_BE_IDEMPOTENT");
  assert.equal(pool.facts.size, 49);

  const payloads = [...pool.facts.values()].map((row) => row.record.payload);
  assert.equal(
    payloads.filter((row) => row.record_type === "soil_moisture_observation_v1").length,
    1,
  );
  assert.equal(
    payloads.filter((row) => row.record_type === "future_weather_assumption_v1").length,
    24,
  );
  assert.equal(
    payloads.filter((row) => row.record_type === "future_et0_assumption_v1").length,
    24,
  );

  for (const row of payloads) {
    assert.equal(row.dataset_id, first.dataset_id);
    assert.equal(row.available_to_runtime_at, SEEDED);
    assert.ok(row.limitations.includes("QUALIFICATION_REHEARSAL_ONLY"));
    assert.ok(row.limitations.includes("CONTROLLED_ENGINEERING_BASELINE"));
    assert.ok(row.limitations.includes("NOT_FORMAL_EXTERNAL_EVIDENCE"));
    assert.ok(row.limitations.includes("NOT_STAGE_1B_CLOSURE_EVIDENCE"));
  }

  const weather = payloads
    .filter((row) => row.record_type === "future_weather_assumption_v1")
    .sort((a, b) => Date.parse(a.role_time.valid_from) - Date.parse(b.role_time.valid_from));
  const et0 = payloads
    .filter((row) => row.record_type === "future_et0_assumption_v1")
    .sort((a, b) => Date.parse(a.role_time.valid_from) - Date.parse(b.role_time.valid_from));
  for (let index = 0; index < 24; index += 1) {
    const base = new Date(Date.parse(A0) + index * 3_600_000).toISOString();
    assert.equal(weather[index]!.role_time.valid_from, base);
    assert.equal(et0[index]!.role_time.valid_from, base);
    assert.equal(weather[index]!.canonical_payload.points.length, 72);
    assert.equal(et0[index]!.canonical_payload.points.length, 72);
  }

  await assert.rejects(
    () => seedMcftCap09RealClockRehearsalBaselineV1({
      pool: new FakePoolV1() as any,
      a0: A0,
      seeded_at: "2030-01-01T00:00:00.000Z",
    }),
    /SEEDED_AT_MUST_BE_INSIDE_A0_WINDOW/,
  );
  await assert.rejects(
    () => seedMcftCap09RealClockRehearsalBaselineV1({
      pool: new FakePoolV1() as any,
      a0: A0,
      seeded_at: A0,
    }),
    /SEEDED_AT_MUST_BE_INSIDE_A0_WINDOW/,
  );

  const source = fs.readFileSync(
    path.resolve(
      "apps/server/src/runtime/twin_runtime/qualification/mcft_cap09_real_clock_rehearsal_baseline_v1.ts",
    ),
    "utf8",
  );
  for (const required of [
    "QUALIFICATION_REHEARSAL_ONLY",
    "CONTROLLED_ENGINEERING_BASELINE",
    "NOT_FORMAL_EXTERNAL_EVIDENCE",
    "NOT_STAGE_1B_CLOSURE_EVIDENCE",
    "ON CONFLICT (fact_id) DO NOTHING",
  ]) {
    assert.equal(source.includes(required), true, "REHEARSAL_BASELINE_MARKER_REQUIRED:" + required);
  }
  for (const forbidden of [
    "fetch(",
    "GEOX_MCFT_CAP09_FORMAL_V5_DATABASE_URL",
    "FORMAL_CLOSURE_COMPLETE",
    "MCFT_CAP09_COMPLETE",
    "recommendation",
    "approval_request",
    "dispatch_request",
    "model_activation",
  ]) {
    assert.equal(source.includes(forbidden), false, "REHEARSAL_BASELINE_FORBIDDEN_MARKER:" + forbidden);
  }

  const proof = {
    schema_version: "geox_mcft_cap09_real_clock_rehearsal_baseline_acceptance_v1",
    status: "PASS",
    run_class: "QUALIFICATION_REHEARSAL",
    baseline_fact_count: first.fact_count,
    idempotent_second_seed_insert_count: second.inserted_count,
    exact_hourly_assumption_pair_count: 24,
    a0_soil_count: 1,
    baseline_available_before_a0: true,
    isolated_qualification_only_markers_required: true,
    network_request_count: 0,
    production_database_access: false,
    formal_v5_arm: false,
    formal_evidence_claim: false,
    stage_1b_closure_claim: false,
    mcft_cap09_completion_claim: false,
  };
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(proof, null, 2) + "\n");
  console.log(JSON.stringify(proof, null, 2));
}

main().catch((error) => {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(
    OUT,
    JSON.stringify({
      schema_version: "geox_mcft_cap09_real_clock_rehearsal_baseline_acceptance_v1",
      status: "FAIL",
      error: error instanceof Error ? error.message : String(error),
    }, null, 2) + "\n",
  );
  console.error(error);
  process.exitCode = 1;
});
