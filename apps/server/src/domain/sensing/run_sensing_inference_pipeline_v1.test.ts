import test from "node:test";
import assert from "node:assert/strict";

import { runSensingInferencePipelineV1 } from "./run_sensing_inference_pipeline_v1.js";

type QueryCall = { sql: string; params: unknown[] | undefined };

function createDbStub() {
  const calls: QueryCall[] = [];
  return {
    calls,
    db: {
      async query(sql: string, params?: unknown[]) {
        calls.push({ sql, params });
        return { rows: [], rowCount: 0 };
      },
    },
  };
}

function extractLatestStatePayload(calls: QueryCall[], stateType: string): Record<string, unknown> {
  const matched = calls.filter((call) =>
    call.sql.includes("INSERT INTO derived_sensing_state_index_v1")
    && Array.isArray(call.params)
    && call.params[4] === stateType
  );
  assert.ok(matched.length > 0, `expected derived state insert for ${stateType}`);
  const last = matched[matched.length - 1];
  const payloadRaw = String(last.params?.[5] ?? "{}");
  return JSON.parse(payloadRaw);
}

async function runPipeline(observations: Record<string, unknown>[]) {
  const { db, calls } = createDbStub();
  await runSensingInferencePipelineV1({
    db: db as any,
    tenant_id: "t1",
    project_id: "p1",
    group_id: "g1",
    field_id: "f1",
    source_device_ids: ["d1"],
    observations,
    now: 1_710_000_000_000,
  });

  return {
    irrigation: extractLatestStatePayload(calls, "irrigation_effectiveness_state"),
    leak: extractLatestStatePayload(calls, "leak_risk_state"),
  };
}

test("runSensingInferencePipelineV1 infers water-flow states from metric-value row observations", async () => {
  const result = await runPipeline([
    { device_id: "d1", metric: "inlet_flow_lpm", value_num: 36 },
    { device_id: "d1", metric: "outlet_flow_lpm", value_num: 20 },
    { device_id: "d1", metric: "pressure_drop_kpa", value_num: 38 },
  ]);

  assert.equal(result.irrigation.irrigation_effectiveness, "low");
  assert.equal(result.leak.leak_risk, "high");
});

test("runSensingInferencePipelineV1 keeps expanded water-flow observation compatibility", async () => {
  const result = await runPipeline([
    { device_id: "d1", inlet_flow_lpm: 36, outlet_flow_lpm: 20, pressure_drop_kpa: 38 },
  ]);

  assert.equal(result.irrigation.irrigation_effectiveness, "low");
  assert.equal(result.leak.leak_risk, "high");
});
