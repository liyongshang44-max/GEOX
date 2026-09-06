import assert from "node:assert/strict";
import { compileProgramActionsV1, PlannerPredecessorAmbiguityError } from "../../apps/server/src/domain/planner/compiler_v1.js";
import { resolveCropContextV1 } from "../../apps/server/src/domain/crop/crop_context_v1.js";

type Fact = {
  fact_id: string;
  occurred_at: string;
  record_json: { type: string; payload: Record<string, any> };
};

const tenant = { tenant_id: "tenantA", project_id: "projectA", group_id: "groupA" };

function fact(id: string, type: string, payload: Record<string, any>, occurred_at: string): Fact {
  return { fact_id: id, occurred_at, record_json: { type, payload: { ...tenant, ...payload } } };
}

function programPayload(overrides: Record<string, any> = {}): Record<string, any> {
  return {
    program_id: "program_w6a",
    field_id: "field_w6a",
    season_id: "season_1",
    crop_code: "corn",
    variety_code: "v1",
    goal_profile: {
      yield_priority: "medium",
      quality_priority: "medium",
      residue_priority: "medium",
      water_saving_priority: "medium",
      cost_priority: "medium",
    },
    constraints: {
      forbid_pesticide_classes: [],
      forbid_fertilizer_types: [],
      max_irrigation_mm_per_day: 1,
      manual_approval_required_for: [],
      allow_night_irrigation: false,
    },
    execution_policy: { mode: "approval_required", auto_execute_allowed_task_types: [] },
    acceptance_policy_ref: "acceptance_default",
    evidence_policy_ref: null,
    status: "ACTIVE",
    created_ts: 1000,
    updated_ts: 1000,
    ...overrides,
  };
}

class FakePool {
  constructor(readonly facts: Fact[]) {}

  async query(sql: string, params: any[] = []): Promise<{ rows: any[] }> {
    if (params.length === 5 && sql.includes("(record_json::jsonb ->> 'type') = $1")) {
      const [type, tenant_id, project_id, group_id, program_id] = params;
      return {
        rows: this.facts
          .filter((row) => row.record_json.type === type)
          .filter((row) => row.record_json.payload.tenant_id === tenant_id)
          .filter((row) => row.record_json.payload.project_id === project_id)
          .filter((row) => row.record_json.payload.group_id === group_id)
          .filter((row) => row.record_json.payload.program_id === program_id)
          .map((row) => ({ fact_id: row.fact_id, occurred_at: row.occurred_at, payload: row.record_json.payload })),
      };
    }

    if (params.length === 5 && sql.includes("'crop_context_v1'")) {
      const [tenant_id, project_id, group_id, field_id, season_id] = params;
      return {
        rows: this.facts
          .filter((row) => row.record_json.type === "crop_context_v1")
          .filter((row) => row.record_json.payload.tenant_id === tenant_id)
          .filter((row) => row.record_json.payload.project_id === project_id)
          .filter((row) => row.record_json.payload.group_id === group_id)
          .filter((row) => row.record_json.payload.field_id === field_id)
          .filter((row) => season_id == null || row.record_json.payload.season_id === season_id)
          .map((row) => ({ fact_id: row.fact_id, occurred_at: row.occurred_at, payload: row.record_json.payload })),
      };
    }

    if (params.length === 3 && sql.includes("FROM facts") && sql.includes("IN (")) {
      const [tenant_id, project_id, group_id] = params;
      return {
        rows: this.facts
          .filter((row) => row.record_json.type === "field_program_v1" || row.record_json.type === "field_program_transition_v1")
          .filter((row) => row.record_json.payload.tenant_id === tenant_id)
          .filter((row) => row.record_json.payload.project_id === project_id)
          .filter((row) => row.record_json.payload.group_id === group_id)
          .map((row) => ({ fact_id: row.fact_id, occurred_at: row.occurred_at, record_json: row.record_json })),
      };
    }

    return { rows: [] };
  }
}

async function plannerSingleHistoryPositive(): Promise<void> {
  const pool = new FakePool([
    fact("program_1", "field_program_v1", programPayload(), "2026-09-01T00:00:00Z"),
    fact("acceptance_1", "acceptance_result_v1", {
      program_id: "program_w6a", field_id: "field_w6a", acceptance_id: "acc_1", act_task_id: "task_1", operation_plan_id: "plan_1", verdict: "PASS",
    }, "2026-09-01T01:00:00Z"),
    fact("resource_1", "resource_usage_v1", {
      program_id: "program_w6a", act_task_id: "task_1", resource_usage: { water_l: 500 }, recorded_ts: 1100,
    }, "2026-09-01T01:10:00Z"),
    fact("sla_1", "sla_evaluation_v1", {
      program_id: "program_w6a", sla_name: "execution_latency", status: "MET", recorded_ts: 1200,
    }, "2026-09-01T01:20:00Z"),
  ]);
  const compiled = await compileProgramActionsV1(pool as any, tenant, "program_w6a");
  assert.ok(compiled);
  assert.equal(compiled.candidate_actions.length, 3);
  assert.equal(compiled.candidate_actions.find((item) => item.action_type === "IRRIGATE")?.mode, "APPROVAL_REQUIRED");
}

async function plannerLegitimateProgramVersionHistoryPositive(): Promise<void> {
  const root = programPayload({ status: "DRAFT", updated_ts: 1000 });
  const pool = new FakePool([
    fact("program_v1", "field_program_v1", root, "2026-09-01T00:00:00Z"),
    fact("program_v2", "field_program_v1", { ...root, status: "ACTIVE", updated_ts: 2000 }, "2026-09-01T00:10:00Z"),
  ]);
  const compiled = await compileProgramActionsV1(pool as any, tenant, "program_w6a");
  assert.ok(compiled);
  assert.equal(compiled.candidate_actions.every((item) => item.mode === "APPROVAL_REQUIRED"), true);
}

async function plannerDuplicateHistoryAmbiguityNegative(): Promise<void> {
  const pool = new FakePool([
    fact("program_1", "field_program_v1", programPayload(), "2026-09-01T00:00:00Z"),
    fact("acceptance_old", "acceptance_result_v1", {
      program_id: "program_w6a", field_id: "field_w6a", acceptance_id: "acc_old", act_task_id: "task_old", operation_plan_id: "plan_old", verdict: "PASS",
    }, "2026-09-01T01:00:00Z"),
    fact("acceptance_new", "acceptance_result_v1", {
      program_id: "program_w6a", field_id: "field_w6a", acceptance_id: "acc_new", act_task_id: "task_new", operation_plan_id: "plan_new", verdict: "FAIL",
    }, "2026-09-02T01:00:00Z"),
  ]);
  await assert.rejects(
    () => compileProgramActionsV1(pool as any, tenant, "program_w6a"),
    (error: any) => error instanceof PlannerPredecessorAmbiguityError
      && error.predecessor_type === "acceptance_result_v1"
      && error.candidate_fact_ids.length === 2,
  );
}

async function plannerWrongHistoryPrevention(): Promise<void> {
  const pool = new FakePool([
    fact("program_1", "field_program_v1", programPayload(), "2026-09-01T00:00:00Z"),
    fact("acceptance_exact", "acceptance_result_v1", {
      program_id: "program_w6a", field_id: "field_w6a", acceptance_id: "acc_exact", act_task_id: "task_exact", operation_plan_id: "plan_exact", verdict: "PASS",
    }, "2026-09-01T01:00:00Z"),
    fact("resource_exact", "resource_usage_v1", {
      program_id: "program_w6a", act_task_id: "task_exact", resource_usage: { water_l: 500 }, recorded_ts: 1100,
    }, "2026-09-01T01:10:00Z"),
    fact("resource_wrong_latest", "resource_usage_v1", {
      program_id: "program_w6a", act_task_id: "task_other", resource_usage: { water_l: 999999 }, recorded_ts: 9999,
    }, "2026-09-03T01:10:00Z"),
  ]);
  const compiled = await compileProgramActionsV1(pool as any, tenant, "program_w6a");
  assert.ok(compiled);
  const irrigation = compiled.candidate_actions.find((item) => item.action_type === "IRRIGATE");
  assert.equal(irrigation?.mode, "APPROVAL_REQUIRED");
  assert.equal(String(irrigation?.reason).includes("exceeds policy cap"), false);
}

async function cropExplicitSeasonPositive(): Promise<void> {
  const pool = new FakePool([
    fact("crop_s1", "crop_context_v1", { field_id: "field_w6a", season_id: "season_1", crop_code: "corn", crop_stage: "V6", status: "PLANTED_CONFIRMED" }, "2026-09-01T00:00:00Z"),
    fact("crop_s2_newer", "crop_context_v1", { field_id: "field_w6a", season_id: "season_2", crop_code: "soy", crop_stage: "R1", status: "PLANTED_CONFIRMED" }, "2026-09-03T00:00:00Z"),
  ]);
  const context = await resolveCropContextV1(pool as any, tenant, "field_w6a", "season_1");
  assert.equal(context.resolution.status, "EXACT");
  assert.equal(context.resolution.basis, "EXPLICIT_SEASON");
  assert.equal(context.season_id, "season_1");
  assert.equal(context.crop_code, "corn");
}

async function cropCrossSeasonAmbiguityNegative(): Promise<void> {
  const pool = new FakePool([
    fact("crop_s1", "crop_context_v1", { field_id: "field_w6a", season_id: "season_1", crop_code: "corn", crop_stage: "V6", status: "PLANTED_CONFIRMED" }, "2026-09-01T00:00:00Z"),
    fact("crop_s2", "crop_context_v1", { field_id: "field_w6a", season_id: "season_2", crop_code: "soy", crop_stage: "R1", status: "PLANTED_CONFIRMED" }, "2026-09-03T00:00:00Z"),
  ]);
  const context = await resolveCropContextV1(pool as any, tenant, "field_w6a", null);
  assert.equal(context.resolution.status, "AMBIGUOUS");
  assert.equal(context.status, "UNKNOWN");
  assert.equal(context.season_id, null);
  assert.equal(context.allowed_actions.allow_crop_specific_diagnosis, false);
  assert.equal(context.allowed_actions.allow_crop_specific_prescription, false);
}

async function cropParentProgramResolutionPositive(): Promise<void> {
  const pool = new FakePool([
    fact("program_s1", "field_program_v1", programPayload({ program_id: "program_s1", season_id: "season_1", crop_code: "corn" }), "2026-09-01T00:00:00Z"),
    fact("program_s2", "field_program_v1", programPayload({ program_id: "program_s2", season_id: "season_2", crop_code: "soy", created_ts: 2000, updated_ts: 2000 }), "2026-09-03T00:00:00Z"),
    fact("crop_s1", "crop_context_v1", { field_id: "field_w6a", season_id: "season_1", crop_code: "corn", crop_stage: "V6", status: "PLANTED_CONFIRMED" }, "2026-09-01T00:30:00Z"),
    fact("crop_s2", "crop_context_v1", { field_id: "field_w6a", season_id: "season_2", crop_code: "soy", crop_stage: "R1", status: "PLANTED_CONFIRMED" }, "2026-09-03T00:30:00Z"),
  ]);
  const context = await resolveCropContextV1(pool as any, tenant, "field_w6a", null, { program_id: "program_s1" });
  assert.equal(context.resolution.status, "EXACT");
  assert.equal(context.resolution.basis, "PARENT_PROGRAM");
  assert.equal(context.season_id, "season_1");
  assert.equal(context.crop_code, "corn");
}

async function main(): Promise<void> {
  await plannerSingleHistoryPositive();
  await plannerLegitimateProgramVersionHistoryPositive();
  await plannerDuplicateHistoryAmbiguityNegative();
  await plannerWrongHistoryPrevention();
  await cropExplicitSeasonPositive();
  await cropCrossSeasonAmbiguityNegative();
  await cropParentProgramResolutionPositive();
  console.log(JSON.stringify({
    ok: true,
    workstream: "W6-A",
    blocker_ids: ["PLANNER-LATEST-01", "CROP-LATEST-01"],
    proofs: {
      single_history_positive: true,
      legitimate_program_version_history_positive: true,
      duplicate_history_ambiguity_negative: true,
      planner_wrong_history_prevention: true,
      explicit_season_crop_positive: true,
      cross_season_ambiguity_negative: true,
      parent_program_season_resolution_positive: true,
    },
  }));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
