import test from "node:test";
import assert from "node:assert/strict";

import { createPrescriptionFromRecommendation } from "./prescription_contract_v1.js";

test("prescription contract v1: irrigation recommendation reuses contract fields and preserves skill_trace", async () => {
  const store = new Map<string, any>();
  const tenant = { tenant_id: "tenantA", project_id: "projectA", group_id: "groupA" };

  const pool = {
    async query(sql: string, params: any[]) {
      if (sql.includes("SELECT * FROM prescription_contract_v1 WHERE recommendation_id")) {
        const recommendationId = String(params[0]);
        const row = store.get(recommendationId);
        return { rows: row ? [row] : [] };
      }
      if (sql.includes("INSERT INTO prescription_contract_v1")) {
        const [
          prescription_id,
          recommendation_id,
          tenant_id,
          project_id,
          group_id,
          field_id,
          season_id,
          crop_id,
          zone_id,
          operation_type,
          spatial_scope,
          timing_window,
          operation_amount,
          device_requirements,
          risk,
          evidence_refs,
          approval_requirement,
          acceptance_conditions,
          status,
          created_by,
        ] = params;
        const now = new Date().toISOString();
        store.set(String(recommendation_id), {
          prescription_id,
          recommendation_id,
          tenant_id,
          project_id,
          group_id,
          field_id,
          season_id,
          crop_id,
          zone_id,
          operation_type,
          spatial_scope,
          timing_window,
          operation_amount,
          device_requirements,
          risk,
          evidence_refs,
          approval_requirement,
          acceptance_conditions,
          status,
          created_at: now,
          updated_at: now,
          created_by,
        });
        return { rowCount: 1, rows: [] };
      }
      throw new Error(`Unexpected SQL: ${sql.slice(0, 80)}`);
    },
  } as any;

  const recommendationPayload = {
    recommendation_id: "rec_irrigation_step6c",
    recommendation_type: "irrigation_recommendation_v1",
    action_type: "IRRIGATE",
    suggested_action: {
      action_type: "irrigation.start",
      parameters: {
        amount: 25,
        unit: "L",
      },
    },
    evidence_refs: ["obs:manual:1"],
    evidence_basis: {
      telemetry_refs: ["obs:soil_moisture:fieldA"],
      snapshot_id: "snap_1",
    },
    skill_trace: {
      skill_id: "irrigation_deficit_skill_v1",
      inputs: { soil_moisture: 0.18 },
      outputs: { recommended_amount: 25, unit: "L" },
      confidence: { level: "HIGH", basis: "measured" },
      evidence_refs: ["obs:soil_moisture:fieldA"],
    },
  };

  const { prescription } = await createPrescriptionFromRecommendation(
    pool,
    {
      recommendation_id: recommendationPayload.recommendation_id,
      field_id: "fieldA",
      season_id: "seasonA",
      ...tenant,
    },
    recommendationPayload,
  );

  assert.equal(prescription.operation_type, "IRRIGATION");
  assert.equal(prescription.operation_amount.amount, 25);
  assert.equal(prescription.operation_amount.unit, "L");
  assert.equal(prescription.approval_requirement.required, true);
  assert.ok(prescription.acceptance_conditions.evidence_required.includes("post_soil_moisture"));
  assert.ok(prescription.acceptance_conditions.evidence_required.includes("soil_moisture_delta"));
  assert.equal(prescription.acceptance_conditions.required_post_metric?.metric, "soil_moisture_delta");

  const params: any = prescription.operation_amount.parameters ?? {};
  assert.equal(params.metadata?.skill_trace?.skill_id, "irrigation_deficit_skill_v1");
  assert.equal(params.metadata?.skill_trace?.inputs?.soil_moisture, 0.18);
  assert.equal(params.preserved_payload?.skill_trace?.outputs?.recommended_amount, 25);
});
