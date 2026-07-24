// Supplemental fresh-PostgreSQL proof for the two S3 edge semantics that require multi-cutoff observation or an exact repository error.
// Boundary: read-only Runtime operations with administrator-owned fault setup/restoration; no candidate declaration, production Runtime authority, or merge-effectiveness claim.

import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  buildCap05ActionFeedbackV1,
  type Cap05ActionFeedbackEnvelopeV1,
} from "../../apps/server/src/domain/twin_runtime/feedback_canonical_contracts_v1.js";
import { cap08TickLogicalTimeV1 } from "../../apps/server/src/domain/twin_runtime/cap08_phase_engine_contracts_v1.js";
import { PostgresActionFeedbackTickSourceV1 } from "../../apps/server/src/persistence/twin_runtime/postgres_action_feedback_tick_source_v1.js";
import { PostgresNextTickRepositoryV1 } from "../../apps/server/src/persistence/twin_runtime/postgres_next_tick_repository_v1.js";
import {
  CAP08_S3_ACTION_FEEDBACK_LATE_POLICY_ID_V1,
  selectCap05ActionFeedbackForTickV1,
} from "../../apps/server/src/runtime/twin_runtime/action_feedback_tick_selector_v1.js";
import { PrepareNextTickInputServiceV1 } from "../../apps/server/src/runtime/twin_runtime/next_tick_input_service_v1.js";
import {
  admin,
  runner,
} from "./mcft_cap08_s2_g3_acceptance_support_v1.js";
import { buildCap08S2FormalProviderFixtureV1 } from "./mcft_cap08_s2_formal_provider_fixture_v1.js";

if (process.env.MCFT_CAP08_S3_EDGE_DESTRUCTIVE_ACCEPTANCE !== "1") {
  throw new Error("SET_MCFT_CAP08_S3_EDGE_DESTRUCTIVE_ACCEPTANCE_1");
}

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const OUT = path.join(ROOT, "acceptance-output/MCFT_CAP_08_S3_EDGE_SEMANTICS_DB_RESULT.json");
const fixture = buildCap08S2FormalProviderFixtureV1();
const scope = fixture.scope;

function write(value: unknown): void {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, `${JSON.stringify(value, null, 2)}\n`);
}

function buildLateFeedbackV1(base: Cap05ActionFeedbackEnvelopeV1): Cap05ActionFeedbackEnvelopeV1 {
  const availableAt = cap08TickLogicalTimeV1(9);
  return buildCap05ActionFeedbackV1({
    scope: {
      tenant_id: base.tenant_id,
      project_id: base.project_id,
      group_id: base.group_id,
      field_id: base.field_id,
      season_id: base.season_id,
      zone_id: base.zone_id,
    },
    decision_ref: base.payload.decision_ref,
    decision_hash: base.payload.decision_hash,
    approved_plan_evidence_ref: base.payload.approved_plan_evidence_ref,
    approved_plan_evidence_hash: base.payload.approved_plan_evidence_hash,
    origin_kind: base.payload.origin_kind,
    task_ref: base.payload.task_ref,
    receipt_ref: base.payload.receipt_ref,
    as_executed_ref: base.payload.as_executed_ref,
    acceptance_ref: base.payload.acceptance_ref,
    dispatch_disposition: base.payload.dispatch_disposition,
    event_id: `${base.payload.event_id}:late-result`,
    source_record_id: `${base.payload.source_record_id}_late_result`,
    binding_id: base.payload.binding_id,
    origin_source_id: base.payload.origin_source_id,
    execution_status: base.payload.execution_status,
    validation_status: base.payload.validation_status,
    source_quality: base.payload.source_quality,
    eligible_for_state_input: base.payload.eligible_for_state_input,
    actual_amount_mm: base.payload.actual_amount_mm,
    spatial_coverage_fraction: base.payload.spatial_coverage_fraction,
    execution_start: base.payload.execution_start,
    execution_end: base.payload.execution_end,
    ingested_at: availableAt,
    available_to_runtime_at: availableAt,
    runtime_config_ref: base.runtime_config_ref,
    runtime_config_hash: base.runtime_config_hash,
    context_lineage_ref: base.context_lineage_ref,
    context_revision_ref: base.context_revision_ref,
    created_at: availableAt,
  });
}

async function rowsV1(table: string, orderBy: string): Promise<unknown[]> {
  const result = await admin.query(`SELECT to_jsonb(t) AS row FROM ${table} t ORDER BY ${orderBy}`);
  return result.rows.map((row) => row.row);
}

async function runtimeSnapshotDigestV1(): Promise<string> {
  const value = {
    facts: await rowsV1("facts", "fact_id"),
    idempotency: await rowsV1("twin_object_idempotency_index_v1", "idempotency_key"),
    decisions: await rowsV1("twin_decision_record_projection_v1", "decision_object_id"),
    plans: await rowsV1("twin_approved_plan_binding_projection_v1", "approved_plan_evidence_ref"),
    feedback: await rowsV1("twin_action_feedback_projection_v1", "action_feedback_object_id"),
    authority: await rowsV1("twin_runtime_authority_snapshot_v1", "authority_kind,authority_ref"),
    lineage: await rowsV1("twin_active_lineage_index_v1", "tenant_id,project_id,group_id,field_id,season_id,zone_id"),
    checkpoint: await rowsV1("twin_runtime_checkpoint_latest_index_v1", "tenant_id,project_id,group_id,field_id,season_id,zone_id"),
    state: await rowsV1("twin_state_latest_index_v1", "tenant_id,project_id,group_id,field_id,season_id,zone_id"),
    forecast: await rowsV1("twin_forecast_success_latest_index_v1", "tenant_id,project_id,group_id,field_id,season_id,zone_id"),
    scenario: await rowsV1("twin_scenario_latest_index_v1", "tenant_id,project_id,group_id,field_id,season_id,zone_id"),
    leases: await rowsV1("twin_runtime_lease_v1", "tenant_id,project_id,group_id,field_id,season_id,zone_id"),
  };
  return `sha256:${crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex")}`;
}

async function proveDeferredReceiptV1(): Promise<Record<string, unknown>> {
  const source = new PostgresActionFeedbackTickSourceV1(runner);
  const candidates = await source.loadActionFeedbackCandidates({ scope, logical_time: cap08TickLogicalTimeV1(8) });
  assert.equal(candidates.length, 1);
  const late = buildLateFeedbackV1(candidates[0]);
  const before = await runtimeSnapshotDigestV1();
  const t08 = selectCap05ActionFeedbackForTickV1({
    scope,
    logical_time: cap08TickLogicalTimeV1(8),
    feedback_objects: [late],
    late_policy_id: CAP08_S3_ACTION_FEEDBACK_LATE_POLICY_ID_V1,
  });
  assert.equal(t08.candidate, null);
  assert.deepEqual(t08.trace.selected_action_feedback_refs, []);
  assert.equal(t08.trace.entries[0].disposition, "EXCLUDED_LATE");
  assert.equal(t08.trace.entries[0].reason_code, "ACTION_FEEDBACK_NOT_AVAILABLE_AT_TICK_CUTOFF");

  const t09 = selectCap05ActionFeedbackForTickV1({
    scope,
    logical_time: cap08TickLogicalTimeV1(9),
    feedback_objects: [late],
    late_policy_id: CAP08_S3_ACTION_FEEDBACK_LATE_POLICY_ID_V1,
  });
  assert.ok(t09.candidate);
  assert.equal(t09.selected_feedback?.object_id, late.object_id);
  assert.deepEqual(t09.trace.selected_action_feedback_refs, [late.object_id]);
  assert.equal(t09.trace.entries[0].disposition, "SELECTED");
  assert.equal(t09.trace.entries[0].reason_code, "DEFERRED_TO_FIRST_LEGAL_TICK_AFTER_AVAILABILITY");

  const t10 = selectCap05ActionFeedbackForTickV1({
    scope,
    logical_time: cap08TickLogicalTimeV1(10),
    feedback_objects: [late],
    late_policy_id: CAP08_S3_ACTION_FEEDBACK_LATE_POLICY_ID_V1,
  });
  assert.equal(t10.candidate, null);
  assert.equal(t10.trace.entries[0].disposition, "EXCLUDED_OUTSIDE_WINDOW");
  const after = await runtimeSnapshotDigestV1();
  assert.equal(after, before);
  return {
    case_id: "S3-N09",
    status: "PASS",
    t08_disposition: "EXCLUDED_LATE",
    t09_disposition: "SELECTED",
    t09_reason_code: "DEFERRED_TO_FIRST_LEGAL_TICK_AFTER_AVAILABILITY",
    t10_disposition: "EXCLUDED_OUTSIDE_WINDOW",
    selected_exactly_once: true,
    runtime_delta: 0,
  };
}

async function proveCheckpointPointerFailureV1(): Promise<Record<string, unknown>> {
  const pointer = await admin.query(
    `SELECT checkpoint_object_id FROM twin_runtime_checkpoint_latest_index_v1
     WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6`,
    [scope.tenant_id, scope.project_id, scope.group_id, scope.field_id, scope.season_id, scope.zone_id],
  );
  assert.equal(pointer.rows.length, 1);
  const originalRef = String(pointer.rows[0].checkpoint_object_id);
  const invalidRef = "checkpoint_missing_s3_p04_edge";
  await admin.query(
    `UPDATE twin_runtime_checkpoint_latest_index_v1 SET checkpoint_object_id=$7
     WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6`,
    [scope.tenant_id, scope.project_id, scope.group_id, scope.field_id, scope.season_id, scope.zone_id, invalidRef],
  );
  try {
    const before = await runtimeSnapshotDigestV1();
    let observed = "";
    try {
      await new PrepareNextTickInputServiceV1(new PostgresNextTickRepositoryV1(runner)).prepareNextTickInput(scope);
      throw new Error("S3_P04_DID_NOT_REJECT");
    } catch (error) {
      observed = error instanceof Error ? error.message : String(error);
      assert.equal(observed, `PERSISTED_OBJECT_CARDINALITY:twin_runtime_checkpoint_v1:${invalidRef}`);
    }
    const after = await runtimeSnapshotDigestV1();
    assert.equal(after, before);
    return {
      case_id: "S3-P04",
      status: "PASS",
      observed_error: observed,
      silent_pointer_repair: false,
      runtime_delta: 0,
    };
  } finally {
    await admin.query(
      `UPDATE twin_runtime_checkpoint_latest_index_v1 SET checkpoint_object_id=$7
       WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6`,
      [scope.tenant_id, scope.project_id, scope.group_id, scope.field_id, scope.season_id, scope.zone_id, originalRef],
    );
  }
}

async function main(): Promise<void> {
  try {
    assert.equal((await runner.query("SELECT current_user AS u")).rows[0].u, "geox_mcft_cap08_runner_v1");
    const deferred = await proveDeferredReceiptV1();
    const pointer = await proveCheckpointPointerFailureV1();
    const result = {
      schema_version: "geox_mcft_cap08_s3_edge_semantics_db_result_v1",
      status: "PASS",
      candidate_implementation_proof: true,
      s3_candidate_implemented: false,
      independent_review_satisfied: false,
      s3_effectiveness_established: false,
      production_runtime_source_authorized: false,
      cases: [deferred, pointer],
    };
    write(result);
    console.log(JSON.stringify(result));
  } catch (error) {
    write({
      schema_version: "geox_mcft_cap08_s3_edge_semantics_db_result_v1",
      status: "FAIL",
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  } finally {
    await Promise.all([runner.end(), admin.end()]);
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
