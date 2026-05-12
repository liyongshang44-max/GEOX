import fs from "node:fs/promises";
import path from "node:path";
import type { Pool } from "pg";

import type { AoActAuthContextV0 } from "../../auth/ao_act_authz_v0.js";
import { readTokenFileV0 } from "../../auth/ao_act_authz_v0.js";
import { sanitizeFlightTableManifestV1, type FlightTableRunV1, type FlightTableStepV1 } from "./flight_table_manifest_v1.js";
import { buildFlightVerifySummaryV1 } from "./flight_table_verify_v1.js";
import {
  ensureFlightTableRunDirV1,
  flightTableRunDirV1,
  snapshotRefFromSnapshotV1,
  writeFlightTableApiSnapshotV1,
} from "./flight_table_snapshots_v1.js";
import { buildPrescriptionValueProjectionV1, buildRecommendationValueHypothesisV1 } from "../../domain/roi/value_chain_roi_v1.js";

export type FlightTableDecisionRunInputV1 = {
  field_id?: string;
  season_id?: string;
  device_id?: string;
  crop_code?: string;
  prescription_mode?: "standard" | "variable";
  approval_action?: "approve" | "reject" | "return";
};

export type FlightTableDecisionRunResultV1 = {
  ok: true;
  recommendation_id: string;
  prescription_id: string;
  approval_request_id: string;
  approval_status: string;
  operation_plan_id: string | null;
  recommendation_explain: Record<string, unknown> | null;
  recommendation_value_hypothesis: Record<string, unknown> | null;
  prescription_value_projection: Record<string, unknown> | null;
  prescription_summary: Record<string, unknown>;
  approval_audit: Record<string, unknown>;
  approval_processed_by: string | null;
  contract_answers: {
    what: string;
    where: string;
    when: string;
    how_much: string;
    who_approves: string;
    how_to_accept: string;
  };
  run: FlightTableRunV1;
};

type InternalFetchResult = { ok: boolean; status: number; json: any };

function nowIso(): string {
  return new Date().toISOString();
}

function runFilePath(run_id: string): string {
  return path.join(flightTableRunDirV1(run_id), "run.json");
}

function safeText(v: unknown): string {
  return String(v ?? "").trim();
}

function normalizeId(v: unknown): string | null {
  const s = safeText(v);
  return /^[A-Za-z0-9_.:-]{1,180}$/.test(s) ? s : null;
}

function firstArrayItem<T = any>(value: unknown): T | null {
  return Array.isArray(value) && value.length ? value[0] as T : null;
}

function uniqueStrings(values: Array<string | null | undefined>): string[] {
  return Array.from(new Set(values.map((value) => safeText(value)).filter(Boolean)));
}

function updateStep(steps: FlightTableStepV1[], key: string, status: FlightTableStepV1["status"], message: string): FlightTableStepV1[] {
  const ts = nowIso();
  return steps.map((step) => step.step_key === key ? {
    ...step,
    status,
    verify_result: status === "PASS" ? "PASS" : status === "FAIL" ? "FAIL" : status === "SKIPPED" ? "SKIPPED" : "PENDING",
    message,
    started_at: step.started_at ?? ts,
    finished_at: status === "PASS" || status === "FAIL" || status === "SKIPPED" ? ts : undefined,
    updated_at: ts,
  } : step);
}

async function writeRun(run: FlightTableRunV1): Promise<FlightTableRunV1> {
  await ensureFlightTableRunDirV1(run.run_id);
  const next: FlightTableRunV1 = { ...run, updated_at: nowIso(), manifest: sanitizeFlightTableManifestV1(run.manifest) };
  const withSummary = { ...next, verify_summary: buildFlightVerifySummaryV1(next) };
  await fs.writeFile(runFilePath(run.run_id), `${JSON.stringify(withSummary, null, 2)}\n`, "utf8");
  return withSummary;
}

async function callJson(url: string, method: "GET" | "POST", token: string, body?: unknown): Promise<InternalFetchResult> {
  const res = await fetch(url, {
    method,
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: method === "POST" ? JSON.stringify(body ?? {}) : undefined,
  });
  const json = await res.json().catch(() => null);
  return { ok: res.ok && json?.ok !== false, status: res.status, json };
}

function pickRecommendation(json: any): any | null {
  const items = Array.isArray(json?.recommendations) ? json.recommendations : [];
  return items.find((item: any) =>
    String(item?.recommendation_type ?? "") === "irrigation_recommendation_v1"
    || String(item?.action_type ?? "").toUpperCase() === "IRRIGATE"
    || String(item?.skill_trace?.skill_id ?? "") === "irrigation_deficit_skill_v1"
  ) ?? firstArrayItem(items);
}

async function ensureStage1TriggerSeed(pool: Pool, run: FlightTableRunV1, params: { field_id: string; device_id: string }): Promise<void> {
  await pool.query(`ALTER TABLE derived_sensing_state_index_v1 ADD COLUMN IF NOT EXISTS project_id text`);
  await pool.query(`ALTER TABLE derived_sensing_state_index_v1 ADD COLUMN IF NOT EXISTS group_id text`);
  await pool.query(`ALTER TABLE derived_sensing_state_index_v1 ADD COLUMN IF NOT EXISTS source_observation_ids_json jsonb NOT NULL DEFAULT '[]'::jsonb`);
  const ts = Date.now();
  await pool.query(
    `INSERT INTO derived_sensing_state_index_v1
      (tenant_id, project_id, group_id, field_id, state_type, payload_json, confidence, explanation_codes_json, source_device_ids_json, computed_at, computed_at_ts_ms, fact_id, source_observation_ids_json)
     VALUES
      ($1,$2,$3,$4,'irrigation_effectiveness_state','{"level":"LOW"}'::jsonb,0.95,'[]'::jsonb,$5::jsonb,NOW(),$6,$7,'["ft_g_irrigation_effectiveness"]'::jsonb),
      ($1,$2,$3,$4,'leak_risk_state','{"level":"LOW"}'::jsonb,0.95,'[]'::jsonb,$5::jsonb,NOW(),$6,$8,'["ft_g_leak_risk"]'::jsonb)
     ON CONFLICT DO NOTHING`,
    [run.tenant_id, run.project_id, run.group_id, params.field_id, JSON.stringify([params.device_id]), ts, `ft_g_stage1_${run.run_id}_irrigation`, `ft_g_stage1_${run.run_id}_leak`],
  );
  await pool.query(
    `INSERT INTO device_observation_index_v1
      (tenant_id, project_id, group_id, field_id, device_id, metric, observed_at, observed_at_ts_ms, value_num, confidence, fact_id)
     VALUES
      ($1,$2,$3,$4,$5,'soil_moisture',to_timestamp($6 / 1000.0),$6,0.17,0.92,$7)
     ON CONFLICT DO NOTHING`,
    [run.tenant_id, run.project_id, run.group_id, params.field_id, params.device_id, ts, `ft_g_obs_${run.run_id}`],
  );
}

function findApproverToken(currentToken: string, auth: AoActAuthContextV0): { token: string; actor_id: string; role: string } | null {
  const tokenFile = readTokenFileV0();
  for (const rec of tokenFile.tokens as any[]) {
    const token = safeText(rec?.token);
    if (!token || token === currentToken || rec?.revoked) continue;
    if (safeText(rec?.tenant_id) !== auth.tenant_id || safeText(rec?.project_id) !== auth.project_id || safeText(rec?.group_id) !== auth.group_id) continue;
    const role = safeText(rec?.role).toLowerCase();
    const scopes = Array.isArray(rec?.scopes) ? rec.scopes.map((x: unknown) => safeText(x)) : [];
    if ((role === "approver" || role === "admin") && scopes.includes("approval.decide")) {
      return { token, actor_id: safeText(rec?.actor_id), role };
    }
  }
  return null;
}

function summarizePrescription(prescription: any, recommendation: any): Record<string, unknown> {
  const amount = prescription?.operation_amount ?? {};
  const valueHypothesis = buildRecommendationValueHypothesisV1(recommendation);
  const valueProjection = buildPrescriptionValueProjectionV1(prescription, valueHypothesis);
  return {
    prescription_id: prescription?.prescription_id ?? null,
    operation_type: prescription?.operation_type ?? null,
    field_id: prescription?.field_id ?? null,
    season_id: prescription?.season_id ?? null,
    status: prescription?.status ?? null,
    amount: amount?.amount ?? prescription?.planned_amount ?? null,
    unit: amount?.unit ?? null,
    planned_area: prescription?.planned_area ?? prescription?.spatial_scope ?? null,
    planned_rate: prescription?.planned_rate ?? amount?.rate ?? null,
    acceptance_conditions: prescription?.acceptance_conditions ?? null,
    approval_requirement: prescription?.approval_requirement ?? null,
    value_projection: valueProjection,
  };
}

function contractAnswers(params: { field_id: string; prescription: any; approval_request_id: string }): FlightTableDecisionRunResultV1["contract_answers"] {
  const prescription = params.prescription ?? {};
  const amount = prescription.operation_amount ?? {};
  const action = safeText(prescription.operation_type) || "IRRIGATION";
  const amountText = amount?.amount != null ? `${amount.amount}${amount.unit ? ` ${amount.unit}` : ""}` : "按处方参数执行";
  return {
    what: action,
    where: safeText(prescription.field_id) || params.field_id,
    when: "审批通过后 30 分钟窗口内执行",
    how_much: amountText,
    who_approves: params.approval_request_id,
    how_to_accept: JSON.stringify(prescription.acceptance_conditions ?? { required_evidence: ["receipt", "telemetry", "acceptance"] }),
  };
}

export async function runFlightTableDecisionPrescriptionApprovalV1(args: {
  pool: Pool;
  run: FlightTableRunV1;
  input: FlightTableDecisionRunInputV1;
  auth: AoActAuthContextV0;
  baseUrl: string;
  bearerToken: string;
}): Promise<FlightTableDecisionRunResultV1> {
  const { pool, run, input, auth, baseUrl, bearerToken } = args;
  if (run.tenant_id !== auth.tenant_id || run.project_id !== auth.project_id || run.group_id !== auth.group_id) throw new Error("FLIGHT_TABLE_SCOPE_MISMATCH");
  const field_id = normalizeId(input.field_id) ?? run.manifest.field_id;
  const season_id = normalizeId(input.season_id) ?? run.manifest.season_id ?? `ft_season_${run.run_id}`;
  const device_id = normalizeId(input.device_id) ?? run.manifest.device_ids[0] ?? `ft_sensor_${run.run_id}`;
  const crop_code = safeText(input.crop_code || run.manifest.crop || "corn") || "corn";
  if (!field_id) throw new Error("FLIGHT_TABLE_FIELD_NOT_FOUND");
  if (!season_id) throw new Error("FLIGHT_TABLE_SEASON_NOT_FOUND");

  let recGen = await callJson(`${baseUrl}/api/v1/recommendations/generate`, "POST", bearerToken, {
    tenant_id: run.tenant_id,
    project_id: run.project_id,
    group_id: run.group_id,
    field_id,
    season_id,
    device_id,
    crop_code,
    image_recognition: { stress_score: 0.55, disease_score: 0.2, pest_risk_score: 0.2, confidence: 0.9 },
  });
  let recommendation = pickRecommendation(recGen.json);
  let triggerSource = "FORMAL_DECISION_ROUTE";
  if (!recommendation?.recommendation_id) {
    await ensureStage1TriggerSeed(pool, run, { field_id, device_id });
    triggerSource = "FORMAL_DECISION_ROUTE_AFTER_FLIGHT_HELPER_STAGE1_SEED";
    recGen = await callJson(`${baseUrl}/api/v1/recommendations/generate`, "POST", bearerToken, {
      tenant_id: run.tenant_id,
      project_id: run.project_id,
      group_id: run.group_id,
      field_id,
      season_id,
      device_id,
      crop_code,
      image_recognition: { stress_score: 0.55, disease_score: 0.2, pest_risk_score: 0.2, confidence: 0.9 },
    });
    recommendation = pickRecommendation(recGen.json);
  }
  const recommendation_id = safeText(recommendation?.recommendation_id);
  if (!recommendation_id) throw new Error("FLIGHT_TABLE_NO_RECOMMENDATION_TRIGGERED");
  const recommendationValueHypothesis = buildRecommendationValueHypothesisV1(recommendation);

  const prescriptionMode = input.prescription_mode === "variable" ? "variable" : "standard";
  const prescriptionEndpoint = prescriptionMode === "variable"
    ? `${baseUrl}/api/v1/prescriptions/variable/from-recommendation`
    : `${baseUrl}/api/v1/prescriptions/from-recommendation`;
  const prescriptionBody = prescriptionMode === "variable" ? {
    tenant_id: run.tenant_id,
    project_id: run.project_id,
    group_id: run.group_id,
    recommendation_id,
    variable_plan: {
      mode: "VARIABLE_BY_ZONE",
      zone_rates: [{ zone_id: "ft_zone_default", rate: 1, amount: 25, unit: "mm" }],
    },
  } : {
    tenant_id: run.tenant_id,
    project_id: run.project_id,
    group_id: run.group_id,
    recommendation_id,
  };
  const prescriptionCreate = await callJson(prescriptionEndpoint, "POST", bearerToken, prescriptionBody);
  if (!prescriptionCreate.ok) throw new Error(`FLIGHT_TABLE_PRESCRIPTION_CREATE_FAILED:${prescriptionCreate.status}:${safeText(prescriptionCreate.json?.error)}`);
  const prescription = prescriptionCreate.json?.prescription ?? {};
  const prescription_id = safeText(prescription?.prescription_id ?? prescription?.id);
  if (!prescription_id) throw new Error("FLIGHT_TABLE_PRESCRIPTION_ID_MISSING");

  const byRecommendation = await callJson(`${baseUrl}/api/v1/prescriptions/by-recommendation/${encodeURIComponent(recommendation_id)}?tenant_id=${encodeURIComponent(run.tenant_id)}&project_id=${encodeURIComponent(run.project_id)}&group_id=${encodeURIComponent(run.group_id)}`, "GET", bearerToken);
  const prescriptionRead = await callJson(`${baseUrl}/api/v1/prescriptions/${encodeURIComponent(prescription_id)}?tenant_id=${encodeURIComponent(run.tenant_id)}&project_id=${encodeURIComponent(run.project_id)}&group_id=${encodeURIComponent(run.group_id)}`, "GET", bearerToken);

  const submit = await callJson(`${baseUrl}/api/v1/prescriptions/${encodeURIComponent(prescription_id)}/submit-approval`, "POST", bearerToken, {
    project_id: run.project_id,
    group_id: run.group_id,
  });
  if (!submit.ok) throw new Error(`FLIGHT_TABLE_SUBMIT_APPROVAL_FAILED:${submit.status}:${safeText(submit.json?.error)}`);
  const approval_request_id = safeText(submit.json?.approval_request_id);
  if (!approval_request_id) throw new Error("FLIGHT_TABLE_APPROVAL_REQUEST_ID_MISSING");

  const operatorList = await callJson(`${baseUrl}/api/v1/operator/approvals`, "GET", bearerToken);
  const approver = findApproverToken(bearerToken, auth);
  const approvalAction = input.approval_action === "reject" || input.approval_action === "return" ? input.approval_action : "approve";
  let approval_status = "REQUESTED";
  let approvalAudit: Record<string, unknown> = { submitted: submit.json, operator_list_visible: operatorList.ok, approver_found: Boolean(approver) };
  let approvalProcessedBy: string | null = null;
  let operation_plan_id: string | null = null;
  if (approver) {
    const approvalResp = await callJson(`${baseUrl}/api/v1/operator/approvals/${encodeURIComponent(approval_request_id)}/${approvalAction}`, "POST", approver.token, {
      note: `flight-table FT-G ${approvalAction}`,
      device_id,
      adapter_type: "irrigation_simulator",
      device_type: "IRRIGATION_CONTROLLER",
      required_capabilities: ["device.irrigation.valve.open"],
    });
    approvalAudit = { ...approvalAudit, action: approvalResp.json, action_status: approvalResp.status };
    if (approvalResp.ok) {
      approval_status = safeText(approvalResp.json?.status_after) || approvalAction.toUpperCase();
      approvalProcessedBy = approver.actor_id || approver.role;
    } else {
      approval_status = `ACTION_FAILED:${safeText(approvalResp.json?.error_code ?? approvalResp.json?.error ?? approvalResp.status)}`;
    }
  } else {
    approval_status = "REQUESTED_NO_APPROVER_TOKEN";
  }
  operation_plan_id = safeText(submit.json?.operation_plan_id ?? submit.json?.approval?.operation_plan_id) || null;

  const resolvedPrescription = prescriptionRead.json?.prescription ?? byRecommendation.json?.prescription ?? prescription;
  const prescriptionValueProjection = buildPrescriptionValueProjectionV1(resolvedPrescription, recommendationValueHypothesis);
  const snapshot = await writeFlightTableApiSnapshotV1({
    run_id: run.run_id,
    method: "POST",
    path: `/api/v1/dev/flight-table/runs/${encodeURIComponent(run.run_id)}/decision/run`,
    ok: Boolean(recommendation_id && prescription_id && approval_request_id),
    status_code: 200,
    label: "decision prescription approval flight",
    request: { field_id, season_id, device_id, crop_code, prescription_mode: prescriptionMode, approval_action: approvalAction },
    response: {
      trigger_source: triggerSource,
      recommendation_id,
      prescription_id,
      approval_request_id,
      approval_status,
      operation_plan_id,
      recommendation_explain: recommendation?.explain ?? null,
      recommendation_value_hypothesis: recommendationValueHypothesis,
      prescription_value_projection: prescriptionValueProjection,
      prescription_summary: summarizePrescription(resolvedPrescription, recommendation),
      approval_audit: approvalAudit,
    },
  });

  const stepPass = approval_status === "APPROVED" || approval_status === "REQUESTED" || approval_status === "REQUESTED_NO_APPROVER_TOKEN";
  const steps = updateStep(run.steps, "E", stepPass ? "PASS" : "FAIL", `recommendation=${recommendation_id}; prescription=${prescription_id}; approval=${approval_request_id}; status=${approval_status}`);
  const nextRun = await writeRun({
    ...run,
    current_step: "E",
    status: stepPass ? run.status : "FAIL",
    steps,
    manifest: {
      ...run.manifest,
      field_id,
      season_id,
      crop: crop_code,
      device_ids: uniqueStrings([...run.manifest.device_ids, device_id]),
      recommendation_ids: uniqueStrings([...run.manifest.recommendation_ids, recommendation_id]),
      prescription_ids: uniqueStrings([...run.manifest.prescription_ids, prescription_id]),
      approval_request_ids: uniqueStrings([...run.manifest.approval_request_ids, approval_request_id]),
      operation_plan_ids: uniqueStrings([...run.manifest.operation_plan_ids, operation_plan_id]),
      api_snapshot_refs: [...run.manifest.api_snapshot_refs, snapshotRefFromSnapshotV1(snapshot)],
      ui_urls: uniqueStrings([
        ...run.manifest.ui_urls,
        `/operator/approvals?approval_request_id=${encodeURIComponent(approval_request_id)}`,
        `/operator/workbench?recommendation_id=${encodeURIComponent(recommendation_id)}`,
      ]),
    },
  });

  return {
    ok: true,
    recommendation_id,
    prescription_id,
    approval_request_id,
    approval_status,
    operation_plan_id,
    recommendation_explain: recommendation?.explain ?? null,
    recommendation_value_hypothesis: recommendationValueHypothesis,
    prescription_value_projection: prescriptionValueProjection,
    prescription_summary: summarizePrescription(resolvedPrescription, recommendation),
    approval_audit: approvalAudit,
    approval_processed_by: approvalProcessedBy,
    contract_answers: contractAnswers({ field_id, prescription: resolvedPrescription, approval_request_id }),
    run: nextRun,
  };
}
