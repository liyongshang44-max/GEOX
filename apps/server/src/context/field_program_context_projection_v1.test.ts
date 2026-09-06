import assert from "node:assert/strict";
import test from "node:test";

import type { FieldProgramV1 } from "@geox/contracts";
import { projectFieldProgramDeclaredContextV1 } from "./field_program_context_projection_v1.js";

function fieldProgram(): FieldProgramV1 {
  return {
    type: "field_program_v1",
    payload: {
      tenant_id: "tenantA",
      project_id: "projectA",
      group_id: "groupA",
      program_id: "programA",
      field_id: "fieldA",
      season_id: "seasonA",
      crop_code: "corn",
      variety_code: "P1234",
      goal_profile: {
        yield_priority: "high",
        quality_priority: "medium",
        residue_priority: "low",
        water_saving_priority: "high",
        cost_priority: "medium",
      },
      constraints: {
        forbid_pesticide_classes: [],
        forbid_fertilizer_types: [],
        max_irrigation_mm_per_day: 20,
        manual_approval_required_for: ["irrigation"],
        allow_night_irrigation: false,
      },
      budget: {
        max_cost_total: 5000,
        currency: "USD",
      },
      execution_policy: {
        mode: "approval_required",
        auto_execute_allowed_task_types: [],
      },
      acceptance_policy_ref: "acceptance_policy:A",
      evidence_policy_ref: "evidence_policy:A",
      status: "ACTIVE",
      created_ts: Date.parse("2026-05-20T12:00:00Z"),
      updated_ts: Date.parse("2026-08-27T09:00:00Z"),
    },
  };
}

test("B-05b projects typed FieldProgram declarations into ContextAssertion/ContextSnapshot only", () => {
  const projected = projectFieldProgramDeclaredContextV1({
    field_program: fieldProgram(),
    decision_time: "2026-08-27T10:00:00.000Z",
  });

  assert.deepEqual(
    projected.assertions.map((x) => x.kind),
    ["CROP_IDENTITY", "CULTIVAR", "DECLARED_FIELD_PROGRAM", "CUSTOMER_GOAL"],
  );
  assert.equal(projected.snapshot.assertions.length, 4);
  assert.equal(projected.snapshot.scope.field_id, "fieldA");
  assert.equal(projected.snapshot.decision_time, "2026-08-27T10:00:00.000Z");
});

test("B-05b does not fabricate planting event or management history absent typed FieldProgram support", () => {
  const projected = projectFieldProgramDeclaredContextV1({ field_program: fieldProgram() });
  const kinds = new Set(projected.assertions.map((x) => x.kind));

  assert.equal(kinds.has("PLANTING_EVENT"), false);
  assert.equal(kinds.has("MANAGEMENT_HISTORY"), false);
});

test("B-05b historical crop_stage/DAP extras cannot become canonical context or stage authority", () => {
  const legacy = fieldProgram() as FieldProgramV1 & {
    payload: FieldProgramV1["payload"] & {
      crop_stage?: string;
      days_after_planting?: number;
    };
  };
  legacy.payload.crop_stage = "seedling";
  legacy.payload.days_after_planting = 99;

  const projected = projectFieldProgramDeclaredContextV1({ field_program: legacy });
  const serialized = JSON.stringify(projected);

  assert.equal(serialized.includes("crop_stage"), false);
  assert.equal(serialized.includes("days_after_planting"), false);
  assert.equal(serialized.includes("qualified_crop_stage_state_v1"), false);
});

test("B-05b omits cultivar assertion when typed variety_code is absent", () => {
  const program = fieldProgram();
  program.payload.variety_code = null;

  const projected = projectFieldProgramDeclaredContextV1({ field_program: program });
  assert.deepEqual(
    projected.assertions.map((x) => x.kind),
    ["CROP_IDENTITY", "DECLARED_FIELD_PROGRAM", "CUSTOMER_GOAL"],
  );
});

test("B-05b fails closed when both typed program timestamps are invalid", () => {
  const program = fieldProgram();
  program.payload.created_ts = Number.NaN;
  program.payload.updated_ts = Number.NaN;

  assert.throws(
    () => projectFieldProgramDeclaredContextV1({ field_program: program }),
    /B05B_FIELD_PROGRAM_TIMESTAMP_INVALID/,
  );
});
