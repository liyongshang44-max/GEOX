// Fresh-PostgreSQL S3-N01..N22 and S3-P01..P06 proof for MCFT-CAP-08.S3.
// Each case executes a real database-backed service/guard/selector/Tick operation and proves zero Runtime mutation after the administrator-owned fault fixture is frozen.

import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  CAP08_S1_PHASE_ENGINE_CONTRACT_DIGEST_V1,
  CAP08_S1_RUN_CONTRACT_ID_V1,
  CAP08_S1_RUNTIME_START_V1,
  CAP08_S1_TICK_COUNT_V1,
  cap08TickLogicalTimeV1,
} from "../../apps/server/src/domain/twin_runtime/cap08_phase_engine_contracts_v1.js";
import {
  CAP08_S3_NEGATIVE_CASE_IDS_V1,
  CAP08_S3_POINTER_CASE_IDS_V1,
} from "../../apps/server/src/domain/twin_runtime/cap08_s3_formal_provider_contracts_v1.js";
import { semanticHashV1 } from "../../apps/server/src/domain/twin_runtime/canonical_identity_v1.js";
import {
  buildCap05ActionFeedbackV1,
  type Cap05ActionFeedbackEnvelopeV1,
} from "../../apps/server/src/domain/twin_runtime/feedback_canonical_contracts_v1.js";
import { DirectCap04ExecutionConfigResolverV1 } from "../../apps/server/src/domain/twin_runtime/runtime_config_execution_view_v1.js";
import {
  computeCap05ReplayEvidenceSourceRecordHashV1,
  type Cap05ApprovalAssertionEvidenceV1,
  type Cap05ApprovedPlanEvidenceV1,
} from "../../apps/server/src/evidence/twin_runtime/approval_plan_evidence_contracts_v1.js";
import type { Cap05ExecutionReceiptEvidenceV1 } from "../../apps/server/src/evidence/twin_runtime/execution_receipt_evidence_contract_v1.js";
import { PostgresActionFeedbackTickSourceV1 } from "../../apps/server/src/persistence/twin_runtime/postgres_action_feedback_tick_source_v1.js";
import { PostgresImmutableDecisionActionCommitRepositoryV1 } from "../../apps/server/src/persistence/twin_runtime/postgres_immutable_decision_action_commit_repository_v1.js";
import { Cap05ActionFeedbackNormalizationServiceV1 } from "../../apps/server/src/runtime/twin_runtime/action_feedback_normalization_service_v1.js";
import { selectCap05ActionFeedbackForTickV1 } from "../../apps/server/src/runtime/twin_runtime/action_feedback_tick_selector_v1.js";
import { Cap05ApprovalPlanBindingServiceV1 } from "../../apps/server/src/runtime/twin_runtime/approval_plan_binding_service_v1.js";
import { Cap08S2QualifiedEvidenceSourceV1 } from "../../apps/server/src/runtime/twin_runtime/cap08_s2_qualified_evidence_source_v1.js";
import { Cap08S3AuthorityGuardV1 } from "../../apps/server/src/runtime/twin_runtime/cap08_s3_authority_guard_v1.js";
import { Cap08S3DecisionActionProviderServiceV1 } from "../../apps/server/src/runtime/twin_runtime/cap08_s3_decision_action_provider_service_v1.js";
import { Cap08S3EpisodeInspectorV1 } from "../../apps/server/src/runtime/twin_runtime/cap08_s3_episode_inspector_v1.js";
import { Cap08S3FormalRangeServiceV1 } from "../../apps/server/src/runtime/twin_runtime/cap08_s3_formal_range_service_v1.js";
import { Cap08S3FormalRuntimeServiceV1 } from "../../apps/server/src/runtime/twin_runtime/cap08_s3_formal_runtime_service_v1.js";
import { Cap08S3FormalTickServiceV1 } from "../../apps/server/src/runtime/twin_runtime/cap08_s3_formal_tick_service_v1.js";
import { Cap08S3ReceiptEpisodeGuardV1 } from "../../apps/server/src/runtime/twin_runtime/cap08_s3_receipt_episode_guard_v1.js";
import { Cap05HumanDecisionServiceV1 } from "../../apps/server/src/runtime/twin_runtime/human_decision_service_v1.js";
import type {
  CanonicalReplayEvidenceRecordV1,
  ReplayEvidenceSourcePortV1,
  TwinScopeKeyV1,
} from "../../apps/server/src/runtime/twin_runtime/ports.js";
import { Cap05ReceiptConsumingForecastScenarioTickServiceV1 } from "../../apps/server/src/runtime/twin_runtime/receipt_consuming_forecast_scenario_tick_service_v1.js";
import {
  A0BootstrapRuntimeServiceV1,
  Cap04ForecastScenarioSingleTickServiceV1,
  Cap08CompletionAuthorityServiceV1,
  Cap08DeferredScenarioPersistenceV1,
  Cap08FrozenEvidenceSourceV1,
  PostgresCompletionAuthorityRepositoryV1,
  PostgresForecastScenarioRecoveryRepositoryV1,
  PostgresNextTickRepositoryV1,
  PostgresRuntimeRepositoryV1,
  PrepareNextTickInputServiceV1,
  CAP08_S1_CREATED_AT_V1 as CREATED_AT,
  admin,
  persistenceAdapterV1,
  runner,
} from "./mcft_cap08_s3_acceptance_support_v1.js";
import { buildCap08S2FormalProviderFixtureV1 } from "./mcft_cap08_s2_formal_provider_fixture_v1.js";

if (process.env.MCFT_CAP08_S3_NEGATIVE_DESTRUCTIVE_ACCEPTANCE !== "1") {
  throw new Error("SET_MCFT_CAP08_S3_NEGATIVE_DESTRUCTIVE_ACCEPTANCE_1");
}

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const OUT = path.join(ROOT, "acceptance-output/MCFT_CAP_08_S3_NEGATIVE_DB_RESULT.json");
const NEGATIVE_SOURCE_DIGEST = `sha256:${crypto.createHash("sha256").update("mcft-cap08-s3-negative-db-v2").digest("hex")}`;
const FAULT_SLOT_FACT_ID = "fact_mcft08_s3_negative_fault_slot_v1";
const FAULT_SLOT_SOURCE = "mcft_cap08_s3_negative_fault_slot_v1";
const FAULT_SLOT_TYPE = "mcft_cap08_s3_negative_fault_slot_v1";

const SCOPE_FIELDS = ["tenant_id", "project_id", "group_id", "field_id", "season_id", "zone_id"] as const;

type CaseResultV1 = {
  case_id: string;
  status: "PASS";
  observed_disposition: string;
  runtime_delta: 0;
};

const results: CaseResultV1[] = [];
const fixture = buildCap08S2FormalProviderFixtureV1();
const scope = fixture.scope;
const runtimeRepository = new PostgresRuntimeRepositoryV1(runner);
const nextTickRepository = new PostgresNextTickRepositoryV1(runner);
const forecastRepository = new PostgresForecastScenarioRecoveryRepositoryV1(runner);
const completionRepository = new PostgresCompletionAuthorityRepositoryV1(runner);
const persistenceOrder: string[] = [];
const persistence = persistenceAdapterV1(runtimeRepository, forecastRepository, persistenceOrder);
const deferred = new Cap08DeferredScenarioPersistenceV1(persistence);
const handoff = new PrepareNextTickInputServiceV1(nextTickRepository);
const actionFeedbackSource = new PostgresActionFeedbackTickSourceV1(runner);
const provider = new Cap08S3DecisionActionProviderServiceV1(runner);
const receiptGuard = new Cap08S3ReceiptEpisodeGuardV1(runner);
const authorityGuard = new Cap08S3AuthorityGuardV1(runner);
const inspector = new Cap08S3EpisodeInspectorV1(runner);

function write(value: unknown): void {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, `${JSON.stringify(value, null, 2)}\n`);
}

function cloneV1<T>(value: T): T {
  return structuredClone(value);
}

function scopeValuesV1(value: TwinScopeKeyV1 = scope): string[] {
  return SCOPE_FIELDS.map((field) => value[field]);
}

function factIdV1(prefix: string, identity: string): string {
  return `${prefix}_${crypto.createHash("sha256").update(identity).digest("hex").slice(0, 32)}`;
}

function faultSlotRecordV1(): Record<string, unknown> {
  return {
    type: FAULT_SLOT_TYPE,
    payload: {
      fixture_kind: "ADMIN_OWNED_REUSABLE_FAULT_SLOT",
      active: false,
    },
  };
}

async function ensureFaultSlotV1(): Promise<void> {
  const existing = await admin.query(
    "SELECT source,record_json FROM facts WHERE fact_id=$1",
    [FAULT_SLOT_FACT_ID],
  );
  if (existing.rows.length === 0) {
    await admin.query(
      `INSERT INTO facts (fact_id,occurred_at,source,record_json)
       VALUES ($1,$2::timestamptz,$3,$4::jsonb)`,
      [FAULT_SLOT_FACT_ID, CAP08_S1_RUNTIME_START_V1, FAULT_SLOT_SOURCE, JSON.stringify(faultSlotRecordV1())],
    );
    return;
  }
  if (existing.rows.length !== 1
    || existing.rows[0].source !== FAULT_SLOT_SOURCE
    || semanticHashV1(existing.rows[0].record_json) !== semanticHashV1(faultSlotRecordV1())) {
    throw new Error("S3_NEGATIVE_FAULT_SLOT_NOT_NEUTRAL");
  }
}

async function activateFaultSlotV1(input: {
  occurred_at: string;
  source: string;
  record_json: Record<string, unknown>;
}): Promise<string> {
  const result = await admin.query(
    `UPDATE facts
        SET occurred_at=$2::timestamptz,source=$3,record_json=$4::jsonb
      WHERE fact_id=$1
      RETURNING fact_id`,
    [FAULT_SLOT_FACT_ID, input.occurred_at, input.source, JSON.stringify(input.record_json)],
  );
  if (result.rows.length !== 1) throw new Error("S3_NEGATIVE_FAULT_SLOT_UPDATE_CARDINALITY");
  return FAULT_SLOT_FACT_ID;
}

async function restoreFaultSlotV1(factId: string): Promise<void> {
  if (factId !== FAULT_SLOT_FACT_ID) throw new Error("S3_NEGATIVE_FAULT_SLOT_ID_MISMATCH");
  const result = await admin.query(
    `UPDATE facts
        SET occurred_at=$2::timestamptz,source=$3,record_json=$4::jsonb
      WHERE fact_id=$1
      RETURNING fact_id`,
    [FAULT_SLOT_FACT_ID, CAP08_S1_RUNTIME_START_V1, FAULT_SLOT_SOURCE, JSON.stringify(faultSlotRecordV1())],
  );
  if (result.rows.length !== 1) throw new Error("S3_NEGATIVE_FAULT_SLOT_RESTORE_CARDINALITY");
}

async function assertFaultSlotNeutralV1(): Promise<void> {
  const result = await admin.query(
    `SELECT source,record_json,
            (SELECT count(*)::int FROM twin_fact_visibility_index_v1 WHERE fact_id=$1) AS visibility_count
       FROM facts WHERE fact_id=$1`,
    [FAULT_SLOT_FACT_ID],
  );
  if (result.rows.length !== 1
    || result.rows[0].source !== FAULT_SLOT_SOURCE
    || semanticHashV1(result.rows[0].record_json) !== semanticHashV1(faultSlotRecordV1())
    || Number(result.rows[0].visibility_count) !== 1) {
    throw new Error("S3_NEGATIVE_FAULT_SLOT_FINAL_STATE_INVALID");
  }
}

function rehashEvidenceV1<T extends Record<string, any>>(record: T, suffix: string): T {
  const value = cloneV1(record);
  value.source_record_id = `${record.source_record_id}_${suffix}`;
  value.evidence_identity_key = `${record.evidence_identity_key}_${suffix}`;
  value.idempotency_key = semanticHashV1(value.evidence_identity_key);
  value.source_payload = cloneV1(value.canonical_payload);
  delete value.source_record_hash;
  value.source_record_hash = computeCap05ReplayEvidenceSourceRecordHashV1(value);
  return value;
}

function rehashFvoV1(record: CanonicalReplayEvidenceRecordV1): CanonicalReplayEvidenceRecordV1 {
  const value = cloneV1(record);
  value.source_record_hash = semanticHashV1({
    dataset_id: value.dataset_id,
    source_record_id: value.source_record_id,
    binding_id: value.binding_id,
    scope: Object.fromEntries(SCOPE_FIELDS.map((field) => [field, value[field]])),
    role_time: value.role_time,
    canonical_payload: value.canonical_payload,
    quality_status: value.quality.status,
  });
  return value;
}

function buildFeedbackVariantV1(
  base: Cap05ActionFeedbackEnvelopeV1,
  overrides: Record<string, unknown>,
): Cap05ActionFeedbackEnvelopeV1 {
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
    event_id: base.payload.event_id,
    source_record_id: base.payload.source_record_id,
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
    ingested_at: base.payload.ingested_at,
    available_to_runtime_at: base.payload.available_to_runtime_at,
    runtime_config_ref: base.runtime_config_ref,
    runtime_config_hash: base.runtime_config_hash,
    context_lineage_ref: base.context_lineage_ref,
    context_revision_ref: base.context_revision_ref,
    created_at: base.created_at,
    ...overrides,
  } as any);
}

async function insertEvidenceSetupV1(record: Record<string, unknown>, source: string): Promise<string> {
  return activateFaultSlotV1({
    occurred_at: String(record.available_to_runtime_at),
    source,
    record_json: { type: record.record_type, payload: record },
  });
}

async function insertCanonicalSetupV1(object: Cap05ActionFeedbackEnvelopeV1): Promise<string> {
  return activateFaultSlotV1({
    occurred_at: object.logical_time,
    source: "system",
    record_json: { type: object.object_type, payload: object },
  });
}

async function deleteFactSetupV1(factId: string): Promise<void> {
  await restoreFaultSlotV1(factId);
}

async function singleRowJsonV1(table: string, whereSql: string, params: unknown[]): Promise<Record<string, unknown>> {
  const value = await admin.query(`SELECT to_jsonb(t) AS row FROM ${table} t WHERE ${whereSql}`, params);
  if (value.rows.length !== 1) throw new Error(`NEGATIVE_SETUP_ROW_CARDINALITY:${table}:${value.rows.length}`);
  return cloneV1(value.rows[0].row as Record<string, unknown>);
}

async function restoreRowV1(table: string, row: Record<string, unknown>): Promise<void> {
  await admin.query(
    `INSERT INTO ${table} SELECT * FROM jsonb_populate_record(NULL::${table}, $1::jsonb)`,
    [JSON.stringify(row)],
  );
}

async function tableRowsV1(table: string, orderBy: string): Promise<unknown[]> {
  const value = await admin.query(`SELECT to_jsonb(t) AS row FROM ${table} t ORDER BY ${orderBy}`);
  return value.rows.map((row) => row.row);
}

async function runtimeSnapshotV1(): Promise<string> {
  const value = {
    facts: await tableRowsV1("facts", "fact_id"),
    idempotency: await tableRowsV1("twin_object_idempotency_index_v1", "idempotency_key"),
    decisions: await tableRowsV1("twin_decision_record_projection_v1", "decision_object_id"),
    plans: await tableRowsV1("twin_approved_plan_binding_projection_v1", "approved_plan_evidence_ref"),
    feedback: await tableRowsV1("twin_action_feedback_projection_v1", "action_feedback_object_id"),
    feedback_evidence: await tableRowsV1("twin_action_feedback_evidence_index_v1", "action_feedback_object_id,evidence_kind,evidence_ref"),
    authority: await tableRowsV1("twin_runtime_authority_snapshot_v1", "authority_kind,authority_ref"),
    lineage: await tableRowsV1("twin_active_lineage_index_v1", "tenant_id,project_id,group_id,field_id,season_id,zone_id"),
    checkpoint: await tableRowsV1("twin_runtime_checkpoint_latest_index_v1", "tenant_id,project_id,group_id,field_id,season_id,zone_id"),
    state: await tableRowsV1("twin_state_latest_index_v1", "tenant_id,project_id,group_id,field_id,season_id,zone_id"),
    forecast: await tableRowsV1("twin_forecast_success_latest_index_v1", "tenant_id,project_id,group_id,field_id,season_id,zone_id"),
    scenario: await tableRowsV1("twin_scenario_latest_index_v1", "tenant_id,project_id,group_id,field_id,season_id,zone_id"),
    leases: await tableRowsV1("twin_runtime_lease_v1", "tenant_id,project_id,group_id,field_id,season_id,zone_id"),
  };
  return semanticHashV1(value);
}

async function expectRejectZeroDeltaV1(
  caseId: string,
  action: () => Promise<unknown>,
  expected: RegExp,
): Promise<void> {
  const before = await runtimeSnapshotV1();
  let observed = "";
  try {
    await action();
    throw new Error(`NEGATIVE_CASE_DID_NOT_REJECT:${caseId}`);
  } catch (error) {
    observed = error instanceof Error ? error.message : String(error);
    if (observed === `NEGATIVE_CASE_DID_NOT_REJECT:${caseId}`) throw error;
    if (!expected.test(observed)) throw new Error(`${caseId}_UNEXPECTED_ERROR:${observed}`);
  }
  const after = await runtimeSnapshotV1();
  assert.equal(after, before, `${caseId}_RUNTIME_DELTA_NONZERO`);
  results.push({ case_id: caseId, status: "PASS", observed_disposition: observed, runtime_delta: 0 });
  console.log(`PASS ${caseId} ${observed}`);
}

async function expectReadbackZeroDeltaV1(
  caseId: string,
  action: () => Promise<string>,
  expected: RegExp,
): Promise<void> {
  const before = await runtimeSnapshotV1();
  const observed = await action();
  if (!expected.test(observed)) throw new Error(`${caseId}_UNEXPECTED_DISPOSITION:${observed}`);
  const after = await runtimeSnapshotV1();
  assert.equal(after, before, `${caseId}_RUNTIME_DELTA_NONZERO`);
  results.push({ case_id: caseId, status: "PASS", observed_disposition: observed, runtime_delta: 0 });
  console.log(`PASS ${caseId} ${observed}`);
}

class MutatedEvidenceSourceV1 implements ReplayEvidenceSourcePortV1 {
  constructor(
    private readonly mutate: (
      records: CanonicalReplayEvidenceRecordV1[],
      logicalTime: string,
    ) => CanonicalReplayEvidenceRecordV1[],
  ) {}

  async loadCandidateRecords(input: {
    scope: TwinScopeKeyV1;
    logical_time: string;
  }): Promise<readonly CanonicalReplayEvidenceRecordV1[]> {
    const records = await fixture.formal_evidence_source.loadCandidateRecords(input);
    return this.mutate(cloneV1([...records]), input.logical_time);
  }
}

function tickServiceV1(rawSource: ReplayEvidenceSourcePortV1): Cap08S3FormalTickServiceV1 {
  const qualified = new Cap08S2QualifiedEvidenceSourceV1(rawSource);
  const frozen = new Cap08FrozenEvidenceSourceV1(qualified);
  const normal = new Cap04ForecastScenarioSingleTickServiceV1(
    handoff,
    frozen,
    runtimeRepository,
    deferred,
    new DirectCap04ExecutionConfigResolverV1(),
  );
  const receipt = new Cap05ReceiptConsumingForecastScenarioTickServiceV1(
    handoff,
    frozen,
    actionFeedbackSource,
    runtimeRepository,
    deferred,
    new DirectCap04ExecutionConfigResolverV1(),
  );
  return new Cap08S3FormalTickServiceV1(
    handoff,
    frozen,
    deferred,
    normal,
    receipt,
    provider,
    receiptGuard,
    authorityGuard,
  );
}

const validTickService = tickServiceV1(fixture.formal_evidence_source);

function tickInputV1(index: number) {
  const logicalTime = cap08TickLogicalTimeV1(index);
  return {
    formal_run_id: fixture.formal_run_id,
    scope,
    logical_time: logicalTime,
    created_at: CREATED_AT,
    runtime_config_ref: fixture.runtime_config_refs_by_logical_time[logicalTime],
    runtime_config_hash: fixture.runtime_config_hashes_by_logical_time[logicalTime],
    authorized_future_forcing_binding_ids: ["binding_weather", "binding_et0"],
    crop_stage_context: fixture.crop_stage_context,
    lease_owner: "mcft-cap08-s3-negative",
    lease_duration_seconds: 300,
  };
}

async function executeValidTickV1(index: number): Promise<void> {
  const value = await validTickService.executeOneTick(tickInputV1(index));
  assert.equal(value.phase_plan.tick_id, `T${String(index).padStart(2, "0")}`);
}

async function readEvidenceV1<T>(source: string, type: string): Promise<T> {
  const value = await admin.query(
    `SELECT record_json->'payload' AS payload FROM facts
     WHERE source=$1 AND record_json->>'type'=$2 ORDER BY fact_id`,
    [source, type],
  );
  if (value.rows.length !== 1) throw new Error(`NEGATIVE_BASELINE_EVIDENCE_CARDINALITY:${type}:${value.rows.length}`);
  return cloneV1(value.rows[0].payload as T);
}

async function setupBaseV1(): Promise<void> {
  assert.equal((await nextTickRepository.commitRealityBindingSnapshot(fixture.reality_binding_snapshot)).status, "INSERTED");
  for (const config of fixture.runtime_configs) assert.equal((await runtimeRepository.commitRuntimeConfig(config)).status, "INSERTED");
  const bootstrap = await new A0BootstrapRuntimeServiceV1(
    runtimeRepository,
    runtimeRepository,
    fixture.bootstrap_evidence_source,
  ).execute({
    scope,
    logical_time: new Date(Date.parse(CAP08_S1_RUNTIME_START_V1) - 3_600_000).toISOString(),
    created_at: CREATED_AT,
    runtime_config: fixture.bootstrap_runtime_config,
    hydraulic: fixture.hydraulic,
    soil_hydraulic_config_ref: "soil_hydraulic_config_c8_v1",
    lease_owner: "mcft-cap08-s3-negative-bootstrap",
    lease_duration_seconds: 300,
  });
  assert.equal(bootstrap.next_tick_logical_time, CAP08_S1_RUNTIME_START_V1);
  await ensureFaultSlotV1();
}

async function outcomeCasesV1(): Promise<void> {
  for (let index = 0; index <= 8; index += 1) await executeValidTickV1(index);
  const t10Records = await fixture.formal_evidence_source.loadCandidateRecords({ scope, logical_time: cap08TickLogicalTimeV1(10) });
  const fvo10 = cloneV1(t10Records.find((record) => record.source_record_id === "FVO-10")!);
  assert.ok(fvo10);

  await expectRejectZeroDeltaV1("S3-N15", async () => {
    const early = cloneV1(fvo10);
    early.available_to_runtime_at = cap08TickLogicalTimeV1(9);
    early.role_time.ingested_at = cap08TickLogicalTimeV1(9);
    const validEarly = rehashFvoV1(early);
    const service = tickServiceV1(new MutatedEvidenceSourceV1((records, logicalTime) =>
      logicalTime === cap08TickLogicalTimeV1(9) ? [...records, validEarly] : records));
    await service.executeOneTick(tickInputV1(9));
  }, /^CAP08_S2_EVIDENCE_DUE_FVO_SET_MISMATCH$/);

  await executeValidTickV1(9);

  await expectRejectZeroDeltaV1("S3-N16", async () => {
    const service = tickServiceV1(new MutatedEvidenceSourceV1((records, logicalTime) =>
      logicalTime === cap08TickLogicalTimeV1(10) ? [...records, cloneV1(fvo10)] : records));
    await service.executeOneTick(tickInputV1(10));
  }, /^CAP08_S2_EVIDENCE_DUPLICATE_RECORD_ID$/);

  await expectRejectZeroDeltaV1("S3-N18", async () => {
    const service = tickServiceV1(new MutatedEvidenceSourceV1((records, logicalTime) => records.map((record) => {
      if (logicalTime !== cap08TickLogicalTimeV1(10) || record.source_record_id !== "FVO-10") return record;
      const invalid = cloneV1(record);
      invalid.canonical_payload.unit = "mm";
      invalid.source_payload = { ...invalid.source_payload, unit: "mm" };
      return rehashFvoV1(invalid);
    })));
    await service.executeOneTick(tickInputV1(10));
  }, /^CAP08_S3_OUTCOME_FVO10_IDENTITY_MISMATCH$/);

  await expectRejectZeroDeltaV1("S3-N19", async () => {
    const service = tickServiceV1(new MutatedEvidenceSourceV1((records, logicalTime) => records.map((record) => {
      if (logicalTime !== cap08TickLogicalTimeV1(10) || record.source_record_id !== "FVO-10") return record;
      return rehashFvoV1({ ...cloneV1(record), zone_id: "zone_foreign_s3_n19" });
    })));
    await service.executeOneTick(tickInputV1(10));
  }, /^CAP08_S2_EVIDENCE_SCOPE_MISMATCH:FVO-10$/);

  await expectRejectZeroDeltaV1("S3-N20", async () => {
    const service = tickServiceV1(new MutatedEvidenceSourceV1((records, logicalTime) => records.map((record) => {
      if (logicalTime !== cap08TickLogicalTimeV1(10) || record.source_record_id !== "FVO-10") return record;
      const stale = cloneV1(record);
      stale.available_to_runtime_at = cap08TickLogicalTimeV1(11);
      stale.role_time.ingested_at = cap08TickLogicalTimeV1(11);
      return rehashFvoV1(stale);
    })));
    await service.executeOneTick(tickInputV1(10));
  }, /^CAP08_S2_EVIDENCE_FUTURE_LEAKAGE:FVO-10$/);

  const validH = await provider.readActionFeedbackExact({ scope });
  const validReceipt = await readEvidenceV1<Cap05ExecutionReceiptEvidenceV1 & { formal_run_id?: string }>(
    "mcft_cap08_s3_replay_evidence_v1",
    "irrigation_execution_receipt_evidence_v1",
  );
  const foreignReceipt = rehashEvidenceV1(validReceipt as any, "s3_n17") as Cap05ExecutionReceiptEvidenceV1 & { formal_run_id?: string };
  foreignReceipt.formal_run_id = "formal_run_foreign_s3_n17";
  foreignReceipt.source_payload = cloneV1(foreignReceipt.canonical_payload);
  delete (foreignReceipt as any).source_record_hash;
  (foreignReceipt as any).source_record_hash = computeCap05ReplayEvidenceSourceRecordHashV1(foreignReceipt as any);
  const foreignFact = await insertEvidenceSetupV1(foreignReceipt as any, "mcft_cap08_s3_replay_evidence_v1");
  const foreignH = buildFeedbackVariantV1(validH, {
    receipt_ref: foreignReceipt.source_record_id,
    source_record_id: foreignReceipt.source_record_id,
  });
  await expectRejectZeroDeltaV1("S3-N17", async () => {
    await receiptGuard.validateActionFeedback({ formal_run_id: fixture.formal_run_id, scope, action_feedback: foreignH });
  }, /^CAP08_S3_RECEIPT_GUARD_FORMAL_RUN_MISMATCH$/);
  await deleteFactSetupV1(foreignFact);

  await executeValidTickV1(10);
  for (let index = 11; index < CAP08_S1_TICK_COUNT_V1; index += 1) await executeValidTickV1(index);
}

async function decisionAndPlanCasesV1(): Promise<void> {
  const decisionRequest = await readEvidenceV1<any>(
    "mcft_cap08_s3_replay_evidence_v1",
    "controlled_human_decision_request_v1",
  );
  const humanService = new Cap05HumanDecisionServiceV1(runner);

  const scenarioLatest = await singleRowJsonV1(
    "twin_scenario_latest_index_v1",
    "tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6",
    scopeValuesV1(),
  );
  await admin.query(
    `DELETE FROM twin_scenario_latest_index_v1
     WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6`,
    scopeValuesV1(),
  );
  await expectRejectZeroDeltaV1("S3-N01", async () => {
    await humanService.commitHumanDecision({
      scope,
      decision_request_evidence_ref: decisionRequest.source_record_id,
      decision_request_evidence_hash: decisionRequest.source_record_hash,
      decided_at: cap08TickLogicalTimeV1(23),
    });
  }, /^CAP05_DECISION_CURRENT_SCENARIO_CARDINALITY$/);
  await restoreRowV1("twin_scenario_latest_index_v1", scenarioLatest);

  const foreignScenario = rehashEvidenceV1(decisionRequest, "s3_n02");
  foreignScenario.canonical_payload.scenario_set_ref = "scenario_foreign_s3_n02";
  foreignScenario.canonical_payload.scenario_set_hash = `sha256:${"2".repeat(64)}`;
  foreignScenario.source_payload = cloneV1(foreignScenario.canonical_payload);
  delete foreignScenario.source_record_hash;
  foreignScenario.source_record_hash = computeCap05ReplayEvidenceSourceRecordHashV1(foreignScenario);
  const foreignScenarioFact = await insertEvidenceSetupV1(foreignScenario, "mcft_cap08_s3_replay_evidence_v1");
  await expectRejectZeroDeltaV1("S3-N02", async () => {
    await humanService.commitHumanDecision({
      scope,
      decision_request_evidence_ref: foreignScenario.source_record_id,
      decision_request_evidence_hash: foreignScenario.source_record_hash,
      decided_at: cap08TickLogicalTimeV1(23),
    });
  }, /^CAP05_DECISION_REQUEST_NON_CURRENT_SCENARIO$/);
  await deleteFactSetupV1(foreignScenarioFact);

  const approval = await readEvidenceV1<Cap05ApprovalAssertionEvidenceV1>(
    "mcft_cap05_replay_evidence_v1",
    "approval_assertion_evidence_v1",
  );
  const plan = await readEvidenceV1<Cap05ApprovedPlanEvidenceV1>(
    "mcft_cap05_replay_evidence_v1",
    "approved_irrigation_plan_snapshot_v1",
  );
  const bindingService = new Cap05ApprovalPlanBindingServiceV1(runner);
  const decisionProjection = await singleRowJsonV1(
    "twin_decision_record_projection_v1",
    "tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6",
    scopeValuesV1(),
  );
  await admin.query(
    `DELETE FROM twin_decision_record_projection_v1
     WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6`,
    scopeValuesV1(),
  );
  await expectRejectZeroDeltaV1("S3-N03", async () => {
    await bindingService.commitApprovalPlanBinding({
      scope,
      approval_assertion: approval,
      approved_plan: plan,
      dispatch: { disposition: "NOT_OBSERVED", evidence_ref: null, evidence_hash: null },
    });
  }, /^CAP05_APPROVAL_DECISION_BINDING_CARDINALITY$/);
  await restoreRowV1("twin_decision_record_projection_v1", decisionProjection);

  const planWithoutApproval = rehashEvidenceV1(plan as any, "s3_n04") as Cap05ApprovedPlanEvidenceV1;
  planWithoutApproval.canonical_payload.approval_assertion_ref = "approval_missing_s3_n04";
  planWithoutApproval.canonical_payload.approval_assertion_hash = `sha256:${"4".repeat(64)}`;
  planWithoutApproval.source_payload = cloneV1(planWithoutApproval.canonical_payload);
  delete (planWithoutApproval as any).source_record_hash;
  (planWithoutApproval as any).source_record_hash = computeCap05ReplayEvidenceSourceRecordHashV1(planWithoutApproval as any);
  await expectRejectZeroDeltaV1("S3-N04", async () => {
    await bindingService.commitApprovalPlanBinding({
      scope,
      approval_assertion: approval,
      approved_plan: planWithoutApproval,
      dispatch: { disposition: "NOT_OBSERVED", evidence_ref: null, evidence_hash: null },
    });
  }, /^CAP05_PLAN_ASSERTION_BINDING_MISMATCH$/);
}

async function receiptAndFeedbackCasesV1(): Promise<void> {
  const receipt = await readEvidenceV1<Cap05ExecutionReceiptEvidenceV1 & { formal_run_id?: string }>(
    "mcft_cap08_s3_replay_evidence_v1",
    "irrigation_execution_receipt_evidence_v1",
  );
  const h = await provider.readActionFeedbackExact({ scope });

  async function guardReceiptCaseV1(
    caseId: string,
    mutate: (value: any) => void,
    expected: RegExp,
  ): Promise<void> {
    const candidate = rehashEvidenceV1(receipt as any, caseId.toLowerCase().replace("-", "_"));
    mutate(candidate);
    candidate.source_payload = cloneV1(candidate.canonical_payload);
    delete candidate.source_record_hash;
    candidate.source_record_hash = computeCap05ReplayEvidenceSourceRecordHashV1(candidate);
    const fact = await insertEvidenceSetupV1(candidate, "mcft_cap08_s3_replay_evidence_v1");
    await expectRejectZeroDeltaV1(caseId, async () => {
      await receiptGuard.validateReceipt({
        formal_run_id: fixture.formal_run_id,
        scope,
        receipt_ref: candidate.source_record_id,
        receipt_hash: candidate.source_record_hash,
      });
    }, expected);
    await deleteFactSetupV1(fact);
  }

  async function normalizeReceiptCaseV1(
    caseId: string,
    mutate: (value: any) => void,
    expected: RegExp,
  ): Promise<void> {
    const candidate = rehashEvidenceV1(receipt as any, caseId.toLowerCase().replace("-", "_"));
    mutate(candidate);
    candidate.source_payload = cloneV1(candidate.canonical_payload);
    delete candidate.source_record_hash;
    candidate.source_record_hash = computeCap05ReplayEvidenceSourceRecordHashV1(candidate);
    const fact = await insertEvidenceSetupV1(candidate, "mcft_cap08_s3_replay_evidence_v1");
    await expectRejectZeroDeltaV1(caseId, async () => {
      await new Cap05ActionFeedbackNormalizationServiceV1(runner).commitActionFeedback({
        scope,
        receipt_evidence_ref: candidate.source_record_id,
        receipt_evidence_hash: candidate.source_record_hash,
      });
    }, expected);
    await deleteFactSetupV1(fact);
  }

  await guardReceiptCaseV1("S3-N05", (value) => {
    value.zone_id = "zone_foreign_s3_n05";
    value.canonical_payload.target_scope.zone_id = "zone_foreign_s3_n05";
  }, /^CAP08_S3_RECEIPT_GUARD_SCOPE_MISMATCH:zone_id$/);
  await guardReceiptCaseV1("S3-N06", (value) => {
    value.formal_run_id = "formal_run_foreign_s3_n06";
  }, /^CAP08_S3_RECEIPT_GUARD_FORMAL_RUN_MISMATCH$/);

  const activeLineage = (await admin.query(
    `SELECT active_lineage_ref FROM twin_active_lineage_index_v1
     WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6`,
    scopeValuesV1(),
  )).rows[0].active_lineage_ref;
  const stateLineage = (await admin.query(
    `SELECT lineage_id FROM twin_state_latest_index_v1
     WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6`,
    scopeValuesV1(),
  )).rows[0].lineage_id;
  await admin.query(
    `UPDATE twin_active_lineage_index_v1 SET active_lineage_ref='lineage_foreign_s3_n07'
     WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6`,
    scopeValuesV1(),
  );
  await admin.query(
    `UPDATE twin_state_latest_index_v1 SET lineage_id='lineage_foreign_s3_n07'
     WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6`,
    scopeValuesV1(),
  );
  await expectRejectZeroDeltaV1("S3-N07", async () => {
    await receiptGuard.validateReceipt({ formal_run_id: fixture.formal_run_id, scope, receipt_ref: receipt.source_record_id, receipt_hash: receipt.source_record_hash });
  }, /^CAP08_S3_RECEIPT_GUARD_LINEAGE_MISMATCH$/);
  await admin.query(
    `UPDATE twin_active_lineage_index_v1 SET active_lineage_ref=$7
     WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6`,
    [...scopeValuesV1(), activeLineage],
  );
  await admin.query(
    `UPDATE twin_state_latest_index_v1 SET lineage_id=$7
     WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6`,
    [...scopeValuesV1(), stateLineage],
  );

  const revision = (await admin.query(
    `SELECT revision_id FROM twin_state_latest_index_v1
     WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6`,
    scopeValuesV1(),
  )).rows[0].revision_id;
  await admin.query(
    `UPDATE twin_state_latest_index_v1 SET revision_id='revision_foreign_s3_n08'
     WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6`,
    scopeValuesV1(),
  );
  await expectRejectZeroDeltaV1("S3-N08", async () => {
    await receiptGuard.validateReceipt({ formal_run_id: fixture.formal_run_id, scope, receipt_ref: receipt.source_record_id, receipt_hash: receipt.source_record_hash });
  }, /^CAP08_S3_RECEIPT_GUARD_REVISION_MISMATCH$/);
  await admin.query(
    `UPDATE twin_state_latest_index_v1 SET revision_id=$7
     WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6`,
    [...scopeValuesV1(), revision],
  );

  await expectReadbackZeroDeltaV1("S3-N09", async () => {
    const late = buildFeedbackVariantV1(h, {
      ingested_at: cap08TickLogicalTimeV1(9),
      available_to_runtime_at: cap08TickLogicalTimeV1(9),
      created_at: cap08TickLogicalTimeV1(9),
    });
    const selected = selectCap05ActionFeedbackForTickV1({ scope, logical_time: cap08TickLogicalTimeV1(8), feedback_objects: [late] });
    assert.equal(selected.candidate, null);
    assert.deepEqual(selected.trace.selected_action_feedback_refs, []);
    assert.equal(selected.trace.entries.length, 1);
    return `${selected.trace.entries[0].disposition}:${selected.trace.entries[0].reason_code}`;
  }, /^EXCLUDED_LATE:ACTION_FEEDBACK_NOT_AVAILABLE_AT_TICK_CUTOFF$/);

  await expectReadbackZeroDeltaV1("S3-N10", async () => {
    const value = await new PostgresImmutableDecisionActionCommitRepositoryV1(runner).commitCanonicalObject({ object: h });
    return value.status;
  }, /^EXISTING_IDEMPOTENT_SUCCESS$/);

  await expectRejectZeroDeltaV1("S3-N11", async () => {
    const conflict = buildFeedbackVariantV1(h, { actual_amount_mm: "13.500000" });
    await new PostgresImmutableDecisionActionCommitRepositoryV1(runner).commitCanonicalObject({ object: conflict });
  }, /^CAP05_IMMUTABLE_IDEMPOTENCY_CONFLICT$/);

  await guardReceiptCaseV1("S3-N12", (value) => {
    value.canonical_payload.actual_amount_mm = "15.000000";
  }, /^CAP08_S3_RECEIPT_GUARD_EXECUTED_AMOUNT_MISMATCH$/);
  await normalizeReceiptCaseV1("S3-N13", (value) => {
    value.canonical_payload.spatial_coverage_fraction = "1.500000";
  }, /^CAP05_RECEIPT_COVERAGE_OUT_OF_RANGE$/);
  await normalizeReceiptCaseV1("S3-N14", (value) => {
    value.canonical_payload.target_scope_equivalent_irrigation_mm = "12.000000";
  }, /^CAP05_RECEIPT_TARGET_EQUIVALENT_MISMATCH$/);
}

function completionInputV1() {
  const terminal = cap08TickLogicalTimeV1(23);
  return {
    run_contract_id: CAP08_S1_RUN_CONTRACT_ID_V1,
    formal_run_id: fixture.formal_run_id,
    scope,
    initial_logical_time: CAP08_S1_RUNTIME_START_V1,
    terminal_logical_time: terminal,
    expected_next_logical_time: new Date(Date.parse(terminal) + 3_600_000).toISOString(),
    phase_engine_contract_digest: CAP08_S1_PHASE_ENGINE_CONTRACT_DIGEST_V1,
    phase_engine_source_digest: NEGATIVE_SOURCE_DIGEST,
    expected_tick_count: 24,
    expected_state_count: 25,
    expected_forecast_count: 24,
    expected_scenario_set_count: 24,
  } as const;
}

async function completionAndAuthorityCasesV1(): Promise<void> {
  const completionService = new Cap08CompletionAuthorityServiceV1(completionRepository);
  const established = await completionService.establish(completionInputV1());
  assert.equal(established.disposition, "ALREADY_COMPLETE_EXACT");

  const frozen = new Cap08FrozenEvidenceSourceV1(new Cap08S2QualifiedEvidenceSourceV1(fixture.formal_evidence_source));
  const normal = new Cap04ForecastScenarioSingleTickServiceV1(handoff, frozen, runtimeRepository, deferred, new DirectCap04ExecutionConfigResolverV1());
  const receiptTick = new Cap05ReceiptConsumingForecastScenarioTickServiceV1(handoff, frozen, actionFeedbackSource, runtimeRepository, deferred, new DirectCap04ExecutionConfigResolverV1());
  const tick = new Cap08S3FormalTickServiceV1(handoff, frozen, deferred, normal, receiptTick, provider, receiptGuard, authorityGuard);
  const range = new Cap08S3FormalRangeServiceV1(handoff, tick, inspector, NEGATIVE_SOURCE_DIGEST, completionService);
  const runtime = new Cap08S3FormalRuntimeServiceV1(
    new A0BootstrapRuntimeServiceV1(runtimeRepository, runtimeRepository, fixture.bootstrap_evidence_source),
    range,
  );
  const runtimeInput = {
    formal_run_id: fixture.formal_run_id,
    scope,
    created_at: CREATED_AT,
    bootstrap_runtime_config: fixture.bootstrap_runtime_config,
    bootstrap_hydraulic: fixture.hydraulic,
    soil_hydraulic_config_ref: "soil_hydraulic_config_c8_v1",
    runtime_config_refs_by_logical_time: fixture.runtime_config_refs_by_logical_time,
    runtime_config_hashes_by_logical_time: fixture.runtime_config_hashes_by_logical_time,
    authorized_future_forcing_binding_ids: ["binding_weather", "binding_et0"],
    crop_stage_context: fixture.crop_stage_context,
    lease_owner: "mcft-cap08-s3-negative-rerun",
    lease_duration_seconds: 300,
  };
  await expectReadbackZeroDeltaV1("S3-N21", async () => {
    const value = await runtime.execute(runtimeInput);
    assert.equal(value.status, "ALREADY_COMPLETE");
    assert.equal(value.range.executed_tick_count, 0);
    return `${value.status}:${value.range.episode_inspection.disposition}`;
  }, /^ALREADY_COMPLETE:EXACT_COMPLETE$/);

  const beforeAuthority = await authorityGuard.capture(scope);
  const activationFactId = await activateFaultSlotV1({
    occurred_at: cap08TickLogicalTimeV1(23),
    source: "system",
    record_json: {
      type: "twin_model_activation_v1",
      payload: {
        ...scope,
        object_id: "model_activation_foreign_s3_n22",
        determinism_hash: `sha256:${"f".repeat(64)}`,
        logical_time: cap08TickLogicalTimeV1(23),
      },
    },
  });
  await expectRejectZeroDeltaV1("S3-N22", async () => {
    await authorityGuard.assertUnchanged(beforeAuthority);
  }, /^CAP08_S3_ACTIVE_CONFIG_OR_MODEL_CHANGED_DURING_PROVIDER_PHASE$/);
  await deleteFactSetupV1(activationFactId);
}

async function pointerCasesV1(): Promise<void> {
  const decisionRequest = await readEvidenceV1<any>(
    "mcft_cap08_s3_replay_evidence_v1",
    "controlled_human_decision_request_v1",
  );
  const humanService = new Cap05HumanDecisionServiceV1(runner);

  const decisionId = (await admin.query(
    `SELECT decision_object_id FROM twin_decision_record_projection_v1
     WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6`,
    scopeValuesV1(),
  )).rows[0].decision_object_id;
  await admin.query(
    `UPDATE twin_decision_record_projection_v1 SET decision_object_id='decision_missing_s3_p01'
     WHERE decision_object_id=$1`,
    [decisionId],
  );
  await expectRejectZeroDeltaV1("S3-P01", async () => {
    await inspector.inspect({ formal_run_id: fixture.formal_run_id, scope });
  }, /^CAP08_S3_EPISODE_DECISION_CANONICAL_MISSING$/);
  await admin.query(
    `UPDATE twin_decision_record_projection_v1 SET decision_object_id=$1
     WHERE decision_object_id='decision_missing_s3_p01'`,
    [decisionId],
  );

  const scenario = (await admin.query(
    `SELECT scenario_set_id FROM twin_scenario_latest_index_v1
     WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6`,
    scopeValuesV1(),
  )).rows[0].scenario_set_id;
  await admin.query(
    `UPDATE twin_scenario_latest_index_v1 SET scenario_set_id='scenario_missing_s3_p02'
     WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6`,
    scopeValuesV1(),
  );
  await expectRejectZeroDeltaV1("S3-P02", async () => {
    await humanService.commitHumanDecision({
      scope,
      decision_request_evidence_ref: decisionRequest.source_record_id,
      decision_request_evidence_hash: decisionRequest.source_record_hash,
      decided_at: cap08TickLogicalTimeV1(23),
    });
  }, /^CAP05_DECISION_REQUEST_NON_CURRENT_SCENARIO$/);
  await admin.query(
    `UPDATE twin_scenario_latest_index_v1 SET scenario_set_id=$7
     WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6`,
    [...scopeValuesV1(), scenario],
  );

  const feedbackId = (await admin.query(
    `SELECT action_feedback_object_id FROM twin_action_feedback_projection_v1
     WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6`,
    scopeValuesV1(),
  )).rows[0].action_feedback_object_id;
  const h = await provider.readActionFeedbackExact({ scope });
  const foreignH = buildCap05ActionFeedbackV1({
    scope: { ...scope, zone_id: "zone_foreign_s3_p03" },
    decision_ref: h.payload.decision_ref,
    decision_hash: h.payload.decision_hash,
    approved_plan_evidence_ref: h.payload.approved_plan_evidence_ref,
    approved_plan_evidence_hash: h.payload.approved_plan_evidence_hash,
    origin_kind: h.payload.origin_kind,
    task_ref: h.payload.task_ref,
    receipt_ref: h.payload.receipt_ref,
    as_executed_ref: h.payload.as_executed_ref,
    acceptance_ref: h.payload.acceptance_ref,
    dispatch_disposition: h.payload.dispatch_disposition,
    event_id: `${h.payload.event_id}:foreign-p03`,
    source_record_id: `${h.payload.source_record_id}_foreign_p03`,
    binding_id: h.payload.binding_id,
    origin_source_id: h.payload.origin_source_id,
    execution_status: h.payload.execution_status,
    validation_status: h.payload.validation_status,
    source_quality: h.payload.source_quality,
    eligible_for_state_input: h.payload.eligible_for_state_input,
    actual_amount_mm: h.payload.actual_amount_mm,
    spatial_coverage_fraction: h.payload.spatial_coverage_fraction,
    execution_start: h.payload.execution_start,
    execution_end: h.payload.execution_end,
    ingested_at: h.payload.ingested_at,
    available_to_runtime_at: h.payload.available_to_runtime_at,
    runtime_config_ref: h.runtime_config_ref,
    runtime_config_hash: h.runtime_config_hash,
    context_lineage_ref: h.context_lineage_ref,
    context_revision_ref: h.context_revision_ref,
    created_at: h.created_at,
  });
  const foreignHFact = await insertCanonicalSetupV1(foreignH);
  await admin.query(
    `UPDATE twin_action_feedback_projection_v1 SET action_feedback_object_id=$1
     WHERE action_feedback_object_id=$2`,
    [foreignH.object_id, feedbackId],
  );
  await expectRejectZeroDeltaV1("S3-P03", async () => {
    await inspector.inspect({ formal_run_id: fixture.formal_run_id, scope });
  }, /^CAP08_S3_EPISODE_SCOPE_MISMATCH:zone_id$/);
  await admin.query(
    `UPDATE twin_action_feedback_projection_v1 SET action_feedback_object_id=$1
     WHERE action_feedback_object_id=$2`,
    [feedbackId, foreignH.object_id],
  );
  await deleteFactSetupV1(foreignHFact);

  const checkpoint = (await admin.query(
    `SELECT checkpoint_object_id FROM twin_runtime_checkpoint_latest_index_v1
     WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6`,
    scopeValuesV1(),
  )).rows[0].checkpoint_object_id;
  await admin.query(
    `UPDATE twin_runtime_checkpoint_latest_index_v1 SET checkpoint_object_id='checkpoint_missing_s3_p04'
     WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6`,
    scopeValuesV1(),
  );
  await expectRejectZeroDeltaV1("S3-P04", async () => {
    await handoff.prepareNextTickInput(scope);
  }, /^(PERSISTED_NEXT_TICK_STATE_NOT_FOUND|CHECKPOINT_[A-Z0-9_]+|CANONICAL_[A-Z0-9_]+)$/);
  await admin.query(
    `UPDATE twin_runtime_checkpoint_latest_index_v1 SET checkpoint_object_id=$7
     WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6`,
    [...scopeValuesV1(), checkpoint],
  );

  const lineage = (await admin.query(
    `SELECT lineage_id FROM twin_state_latest_index_v1
     WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6`,
    scopeValuesV1(),
  )).rows[0].lineage_id;
  await admin.query(
    `UPDATE twin_state_latest_index_v1 SET lineage_id='lineage_foreign_s3_p05'
     WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6`,
    scopeValuesV1(),
  );
  const receipt = await readEvidenceV1<Cap05ExecutionReceiptEvidenceV1>(
    "mcft_cap08_s3_replay_evidence_v1",
    "irrigation_execution_receipt_evidence_v1",
  );
  await expectRejectZeroDeltaV1("S3-P05", async () => {
    await receiptGuard.validateReceipt({ formal_run_id: fixture.formal_run_id, scope, receipt_ref: receipt.source_record_id, receipt_hash: receipt.source_record_hash });
  }, /^CAP08_S3_RECEIPT_GUARD_CURRENT_POINTER_CROSS_LINEAGE$/);
  await admin.query(
    `UPDATE twin_state_latest_index_v1 SET lineage_id=$7
     WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6`,
    [...scopeValuesV1(), lineage],
  );

  const duplicatePlanRef = `${(await admin.query("SELECT approved_plan_evidence_ref FROM twin_approved_plan_binding_projection_v1 WHERE active_for_decision=true")).rows[0].approved_plan_evidence_ref}_duplicate_p06`;
  await admin.query(
    `INSERT INTO twin_approved_plan_binding_projection_v1
     SELECT $1, approved_plan_evidence_hash || '_duplicate', tenant_id,project_id,group_id,field_id,season_id,zone_id,
            binding_id,approval_assertion_ref,approval_assertion_hash,decision_request_ref,decision_request_hash,selected_option_ref,selected_option_hash,
            scenario_amount_mm,approved_amount_mm,plan_effective_from,plan_effective_to,true,canonical_evidence,source_fact_id
     FROM twin_approved_plan_binding_projection_v1 WHERE active_for_decision=true`,
    [duplicatePlanRef],
  );
  await expectRejectZeroDeltaV1("S3-P06", async () => {
    await inspector.inspect({ formal_run_id: fixture.formal_run_id, scope });
  }, /^CAP08_S3_EPISODE_CARDINALITY:approved_plan_count:2$/);
  await admin.query("DELETE FROM twin_approved_plan_binding_projection_v1 WHERE approved_plan_evidence_ref=$1", [duplicatePlanRef]);
}

async function main(): Promise<void> {
  try {
    assert.equal((await runner.query("SELECT current_user AS u")).rows[0].u, "geox_mcft_cap08_runner_v1");
    await setupBaseV1();
    await outcomeCasesV1();
    await decisionAndPlanCasesV1();
    await receiptAndFeedbackCasesV1();
    await completionAndAuthorityCasesV1();
    await pointerCasesV1();
    await assertFaultSlotNeutralV1();

    const ids = results.map((value) => value.case_id).sort();
    assert.deepEqual(ids.filter((id) => id.startsWith("S3-N")), [...CAP08_S3_NEGATIVE_CASE_IDS_V1].sort());
    assert.deepEqual(ids.filter((id) => id.startsWith("S3-P")), [...CAP08_S3_POINTER_CASE_IDS_V1].sort());
    const result = {
      schema_version: "geox_mcft_cap08_s3_negative_db_result_v2",
      status: "PASS",
      negative_case_count: 22,
      pointer_case_count: 6,
      all_runtime_deltas_zero: true,
      reusable_fault_slot_restored: true,
      visibility_metadata_mutation_count: 0,
      candidate_implementation_proof: true,
      s3_candidate_implemented: false,
      independent_review_satisfied: false,
      s3_effectiveness_established: false,
      production_runtime_source_authorized: false,
      s4_authorized: false,
      mcft_cap_09_authorized: false,
      cases: results,
    };
    write(result);
    console.log(JSON.stringify(result));
  } catch (error) {
    write({
      schema_version: "geox_mcft_cap08_s3_negative_db_result_v2",
      status: "FAIL",
      error: error instanceof Error ? error.message : String(error),
      completed_cases: results,
    });
    throw error;
  } finally {
    await Promise.all([runner.end(), admin.end()]);
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
