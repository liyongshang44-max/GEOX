import assert from "node:assert/strict";
import test from "node:test";
import type { PoolClient } from "pg";

import { loadRecentFieldObservationsForPipelineV1 } from "./device_observation_service_v1.js";

function snapshot(measurement_health: string, physical_validity: string) {
  return {
    schema_version: "ingress_physical_qc_snapshot_v1",
    physical_qc: {
      measurement_health,
      physical_validity,
    },
  };
}

function fakeDb(rows: any[]): PoolClient {
  return {
    query: async () => ({ rows, rowCount: rows.length }),
  } as unknown as PoolClient;
}

test("Stage-1 loader consumes formal PASS evidence and rejects INVALID/UNKNOWN/missing-QC formal rows", async () => {
  const db = fakeDb([
    {
      device_id: "dev_pass",
      metric: "soil_moisture",
      value_num: 0.22,
      fact_id: "obs_pass",
      record_json: {
        payload: {
          formal_eligible: true,
          source_lane: "FORMAL_OPERATION",
          ingress_physical_qc: snapshot("VALID", "PASS"),
        },
      },
    },
    {
      device_id: "dev_invalid",
      metric: "air_humidity",
      value_num: 102.7,
      fact_id: "obs_invalid",
      record_json: {
        payload: {
          formal_eligible: true,
          source_lane: "FORMAL_OPERATION",
          ingress_physical_qc: snapshot("INVALID", "FAIL"),
        },
      },
    },
    {
      device_id: "dev_unknown",
      metric: "air_temperature",
      value_num: 72,
      fact_id: "obs_unknown",
      record_json: {
        payload: {
          formal_eligible: true,
          source_lane: "FORMAL_OPERATION",
          ingress_physical_qc: snapshot("UNKNOWN", "UNKNOWN"),
        },
      },
    },
    {
      device_id: "dev_missing_qc",
      metric: "soil_moisture",
      value_num: 0.31,
      fact_id: "obs_missing_qc",
      record_json: {
        payload: {
          formal_eligible: true,
          source_lane: "FORMAL_OPERATION",
        },
      },
    },
  ]);

  const observations = await loadRecentFieldObservationsForPipelineV1(db, {
    tenant_id: "tenantA",
    project_id: "projectA",
    group_id: "groupA",
    field_id: "fieldA",
  });

  assert.deepEqual(observations.map((row) => row.fact_id), ["obs_pass"]);
});

test("legacy unclassified observation stays visible only through the explicit compatibility seam", async () => {
  const db = fakeDb([
    {
      device_id: "dev_legacy",
      metric: "soil_moisture",
      value_num: 0.24,
      fact_id: "obs_legacy",
      record_json: {
        payload: {},
      },
    },
  ]);

  const observations = await loadRecentFieldObservationsForPipelineV1(db, {
    tenant_id: "tenantA",
    project_id: "projectA",
    group_id: "groupA",
    field_id: "fieldA",
  });

  assert.deepEqual(observations.map((row) => row.fact_id), ["obs_legacy"]);
});
