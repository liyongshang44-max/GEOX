import pg from "pg";
const { Pool } = pg;

const base = String(process.env.BASE_URL ?? "http://127.0.0.1:3001").replace(/\/$/, "");
const dbUrl = String(process.env.DATABASE_URL ?? "").trim();
const token = String(process.env.ADMIN_TOKEN ?? "tenant_a_admin_token").trim();
if (!dbUrl) throw new Error("W6-A DATABASE_URL missing");
const pool = new Pool({ connectionString: dbUrl });
const run = Date.now().toString(36);
const scope = { tenant_id: "tenantA", project_id: "projectA", group_id: "groupA" };

function expect(condition: any, message: string, details?: any): asserts condition {
  if (!condition) throw new Error(message + (details === undefined ? "" : `: ${JSON.stringify(details)}`));
}

async function api(method: string, path: string, body?: any) {
  const response = await fetch(base + path, {
    method,
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: body == null ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let json: any = null;
  try { json = text ? JSON.parse(text) : null; } catch {}
  if (response.status >= 500) throw new Error(`W6-A 5xx ${method} ${path}: ${response.status} ${text.slice(0, 500)}`);
  return { status: response.status, json, text };
}

async function insertFact(id: string, type: string, payload: Record<string, any>, occurredAt: string) {
  await pool.query(
    `INSERT INTO facts(fact_id, occurred_at, source, record_json)
     VALUES($1, $2::timestamptz, 'w6a_commercial_qualification', $3::jsonb)`,
    [id, occurredAt, JSON.stringify({ type, payload: { ...scope, ...payload } })],
  );
}

function programPayload(program_id: string, field_id: string, season_id: string, overrides: Record<string, any> = {}) {
  return {
    program_id,
    field_id,
    season_id,
    crop_code: "corn",
    variety_code: "v1",
    goal_profile: {
      yield_priority: "medium", quality_priority: "medium", residue_priority: "medium",
      water_saving_priority: "medium", cost_priority: "medium",
    },
    constraints: {
      forbid_pesticide_classes: [], forbid_fertilizer_types: [], max_irrigation_mm_per_day: 1,
      manual_approval_required_for: [], allow_night_irrigation: false,
    },
    execution_policy: { mode: "approval_required", auto_execute_allowed_task_types: [] },
    acceptance_policy_ref: "w6a_acceptance",
    evidence_policy_ref: null,
    status: "ACTIVE",
    created_ts: 1000,
    updated_ts: 1000,
    ...overrides,
  };
}

function acceptancePayload(program_id: string, field_id: string, acceptance_id: string, task_id: string, verdict: "PASS" | "FAIL") {
  return {
    acceptance_id,
    act_task_id: task_id,
    field_id,
    program_id,
    operation_plan_id: `plan_${acceptance_id}`,
    verdict,
    metrics: { coverage_ratio: 1, in_field_ratio: 1, telemetry_delta: 0 },
    evidence_refs: [`fact_${acceptance_id}`],
    evaluated_at: "2026-09-04T00:00:00.000Z",
  };
}

async function seedField(field_id: string) {
  const ts = Date.now();
  await pool.query(
    `INSERT INTO field_index_v1(tenant_id,field_id,name,area_ha,status,project_id,group_id,created_ts_ms,updated_ts_ms)
     VALUES($1,$2,$3,1,'ACTIVE',$4,$5,$6,$6)
     ON CONFLICT(tenant_id,field_id) DO UPDATE SET project_id=EXCLUDED.project_id,group_id=EXCLUDED.group_id,status='ACTIVE',updated_ts_ms=EXCLUDED.updated_ts_ms`,
    [scope.tenant_id, field_id, `W6-A ${field_id}`, scope.project_id, scope.group_id, ts],
  );
}

async function seedFormalStage1IrrigationLow(field_id: string) {
  const nowMs = Date.now();
  await pool.query(
    `DELETE FROM derived_sensing_state_index_v1
      WHERE tenant_id = $1
        AND project_id = $2
        AND group_id = $3
        AND field_id = $4
        AND state_type = 'irrigation_effectiveness_state'`,
    [scope.tenant_id, scope.project_id, scope.group_id, field_id],
  );
  await pool.query(
    `INSERT INTO derived_sensing_state_index_v1
      (tenant_id, project_id, group_id, field_id, state_type, payload_json, confidence,
       explanation_codes_json, source_device_ids_json, computed_at, computed_at_ts_ms,
       fact_id, source_observation_ids_json)
     VALUES($1,$2,$3,$4,'irrigation_effectiveness_state','{"level":"LOW"}'::jsonb,0.9,
       '[]'::jsonb,'[]'::jsonb,now(),$5,$6,'["obs_w6a_stage1"]'::jsonb)`,
    [scope.tenant_id, scope.project_id, scope.group_id, field_id, nowMs, `w6a_stage1_${run}`],
  );
}

async function plannerCommercialProof() {
  const field = `field_w6a_planner_${run}`;
  const program = `program_w6a_planner_${run}`;
  await seedField(field);
  await insertFact(`w6a_program_v1_${run}`, "field_program_v1", programPayload(program, field, "season_1", { status: "DRAFT", updated_ts: 1000 }), "2026-09-01T00:00:00Z");
  await insertFact(`w6a_program_v2_${run}`, "field_program_v1", programPayload(program, field, "season_1", { status: "ACTIVE", updated_ts: 2000 }), "2026-09-01T00:10:00Z");
  await insertFact(`w6a_acceptance_exact_${run}`, "acceptance_result_v1", acceptancePayload(program, field, `acc_exact_${run}`, `task_exact_${run}`, "PASS"), "2026-09-01T01:00:00Z");
  await insertFact(`w6a_resource_exact_${run}`, "resource_usage_v1", { program_id: program, act_task_id: `task_exact_${run}`, resource_usage: { water_l: 500 }, recorded_ts: 1100 }, "2026-09-01T01:10:00Z");
  await insertFact(`w6a_resource_wrong_latest_${run}`, "resource_usage_v1", { program_id: program, act_task_id: `task_wrong_${run}`, resource_usage: { water_l: 999999 }, recorded_ts: 9999 }, "2026-09-03T01:10:00Z");
  const good = await api("GET", `/api/v1/programs/${encodeURIComponent(program)}/actions`);
  expect(good.status === 200, "legitimate version history / exact task-linked resource was not accepted", good);
  const irrigation = (good.json?.candidate_actions ?? []).find((item: any) => item.action_type === "IRRIGATE");
  expect(irrigation && !String(irrigation.reason ?? "").includes("exceeds policy cap"), "wrong latest resource history contaminated planner chain", good.json);

  const ambiguousProgram = `program_w6a_ambiguous_${run}`;
  await insertFact(`w6a_program_amb_${run}`, "field_program_v1", programPayload(ambiguousProgram, field, "season_1"), "2026-09-01T00:00:00Z");
  await insertFact(`w6a_acceptance_old_${run}`, "acceptance_result_v1", acceptancePayload(ambiguousProgram, field, `acc_old_${run}`, `task_old_${run}`, "PASS"), "2026-09-01T01:00:00Z");
  await insertFact(`w6a_acceptance_new_${run}`, "acceptance_result_v1", acceptancePayload(ambiguousProgram, field, `acc_new_${run}`, `task_new_${run}`, "FAIL"), "2026-09-03T01:00:00Z");
  const denied = await api("GET", `/api/v1/programs/${encodeURIComponent(ambiguousProgram)}/actions`);
  expect(denied.status === 409, "duplicate planner history did not fail closed", denied);
  expect(denied.json?.error === "PLANNER_PREDECESSOR_AMBIGUOUS" && denied.json?.predecessor_type === "acceptance_result_v1", "planner ambiguity response identity drift", denied.json);
  return { good_status: good.status, ambiguity_status: denied.status, ambiguity_error: denied.json?.error };
}

async function cropCommercialProof() {
  const field = `field_w6a_crop_${run}`;
  await seedField(field);
  await insertFact(`w6a_crop_s1_${run}`, "crop_context_v1", { field_id: field, season_id: "season_1", crop_code: "corn", crop_stage: "V6", status: "PLANTED_CONFIRMED", confidence: 0.9, source: "USER_DECLARED" }, "2026-09-01T00:00:00Z");
  await insertFact(`w6a_crop_s2_${run}`, "crop_context_v1", { field_id: field, season_id: "season_2", crop_code: "soy", crop_stage: "R1", status: "PLANTED_CONFIRMED", confidence: 0.9, source: "USER_DECLARED" }, "2026-09-03T00:00:00Z");

  const explicit = await api("GET", `/api/v1/reports/field/${encodeURIComponent(field)}?season_id=season_1`);
  expect(explicit.status === 200, "Commercial field report explicit-season flow failed", explicit);
  const explicitCrop = explicit.json?.field_report_v1?.crop_context;
  expect(explicitCrop?.resolution?.status === "EXACT" && explicitCrop?.season_id === "season_1" && explicitCrop?.crop_code === "corn", "explicit season was not bound exactly in Commercial field report", explicitCrop);

  const ambiguous = await api("GET", `/api/v1/reports/field/${encodeURIComponent(field)}`);
  expect(ambiguous.status === 200, "Commercial field report ambiguity flow failed", ambiguous);
  const ambiguousCrop = ambiguous.json?.field_report_v1?.crop_context;
  expect(ambiguousCrop?.resolution?.status === "AMBIGUOUS" && ambiguousCrop?.status === "UNKNOWN", "cross-season field report silently selected a crop context", ambiguousCrop);
  expect(ambiguousCrop?.allowed_actions?.allow_crop_specific_diagnosis === false && ambiguousCrop?.allowed_actions?.allow_crop_specific_prescription === false, "ambiguous crop context did not fail closed crop-specific capabilities", ambiguousCrop);

  const parentProgram = `program_w6a_crop_parent_${run}`;
  await insertFact(`w6a_crop_parent_program_${run}`, "field_program_v1", programPayload(parentProgram, field, "season_1"), "2026-09-01T00:30:00Z");
  await seedFormalStage1IrrigationLow(field);
  const rec = await api("POST", "/api/v1/recommendations/generate", {
    ...scope,
    program_id: parentProgram,
    field_id: field,
    device_id: `dev_w6a_${run}`,
    crop_code: "corn",
    image_recognition: { stress_score: 0.55, disease_score: 0.2, pest_risk_score: 0.2, confidence: 0.9 },
  });
  expect(rec.status === 200, "Commercial recommendation parent-program season resolution flow failed", rec);
  expect(
    rec.json?.crop_context?.resolution?.status === "EXACT"
      && rec.json?.crop_context?.resolution?.basis === "PARENT_PROGRAM"
      && rec.json?.crop_context?.season_id === "season_1",
    "recommendation crop hook did not resolve the already-recorded parent program season exactly",
    rec.json?.crop_context,
  );
  return {
    explicit_report_status: explicit.status,
    ambiguous_report_status: ambiguous.status,
    recommendation_status: rec.status,
    recommendation_resolution_basis: rec.json?.crop_context?.resolution?.basis,
  };
}

async function main() {
  const planner = await plannerCommercialProof();
  const crop = await cropCommercialProof();
  console.log(JSON.stringify({ result: "PASS", workstream: "W6A_EXACT_PLANNER_CROP_PREDECESSOR_SELECTION", planner, crop, mcft_delta: 0 }, null, 2));
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => pool.end());
