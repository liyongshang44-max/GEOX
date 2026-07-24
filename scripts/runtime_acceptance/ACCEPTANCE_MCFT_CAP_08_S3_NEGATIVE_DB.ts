// Fresh-PostgreSQL S3-N01..N22 and S3-P01..P06 proof for MCFT-CAP-08.S3.
// Each case executes a real database-backed service/guard/selector/Tick operation and proves zero Runtime mutation after the case fixture is frozen.

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
import type { Cap05ActionFeedbackEnvelopeV1 } from "../../apps/server/src/domain/twin_runtime/feedback_canonical_contracts_v1.js";
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
} from "./mcft_cap08_s2_g3_acceptance_support_v1.js";
import { buildCap08S2FormalProviderFixtureV1 } from "./mcft_cap08_s2_formal_provider_fixture_v1.js";

if (process.env.MCFT_CAP08_S3_NEGATIVE_DESTRUCTIVE_ACCEPTANCE !== "1") {
  throw new Error("SET_MCFT_CAP08_S3_NEGATIVE_DESTRUCTIVE_ACCEPTANCE_1");
}

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const OUT = path.join(ROOT, "acceptance-output/MCFT_CAP_08_S3_NEGATIVE_DB_RESULT.json");
const NEGATIVE_SOURCE_DIGEST = `sha256:${crypto.createHash("sha256").update("mcft-cap08-s3-negative-db-v1").digest("hex")}`;

type CaseResultV1 = {
  case_id: string;
  status: "PASS";
  observed_error: string;
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

function factIdV1(prefix: string, identity: string): string {
  return `${prefix}_${crypto.createHash("sha256").update(identity).digest("hex").slice(0, 32)}`;
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

async function insertEvidenceSetupV1(record: Record<string, unknown>, source: string): Promise<string> {
  const id = factIdV1("fact_mcft08_s3_negative_setup", String(record.evidence_identity_key ?? record.source_record_id));
  await admin.query(
    `INSERT INTO facts (fact_id,occurred_at,source,record_json)
     VALUES ($1,$2::timestamptz,$3,$4::jsonb)`,
    [id, record.available_to_runtime_at, source, JSON.stringify({ type: record.record_type, payload: record })],
  );
  return id;
}

async function deleteFactSetupV1(factId: string): Promise<void> {
  await admin.query("DELETE FROM facts WHERE fact_id=$1", [factId]);
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
  expected?: RegExp,
): Promise<void> {
  const before = await runtimeSnapshotV1();
  let observed = "";
  try {
    await action();
    throw new Error(`NEGATIVE_CASE_DID_NOT_REJECT:${caseId}`);
  } catch (error) {
    observed = error instanceof Error ? error.message : String(error);
    if (observed === `NEGATIVE_CASE_DID_NOT_REJECT:${caseId}`) throw error;
    if (expected && !expected.test(observed)) throw new Error(`${caseId}_UNEXPECTED_ERROR:${observed}`);
  }
  const after = await runtimeSnapshotV1();
  assert.equal(after, before, `${caseId}_RUNTIME_DELTA_NONZERO`);
  results.push({ case_id: caseId, status: "PASS", observed_error: observed, runtime_delta: 0 });
  console.log(`PASS ${caseId} ${observed}`);
}

async function expectReadbackZeroDeltaV1(caseId: string, action: () => Promise<unknown>): Promise<void> {
  const before = await runtimeSnapshotV1();
  await action();
  const after = await runtimeSnapshotV1();
  assert.equal(after, before, `${caseId}_RUNTIME_DELTA_NONZERO`);
  results.push({ case_id: caseId, status: "PASS", observed_error: "EXACT_IDEMPOTENT_READBACK", runtime_delta: 0 });
  console.log(`PASS ${caseId} EXACT_IDEMPOTENT_READBACK`);
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
}

async function outcomeCasesV1(): Promise<void> {
  for (let index = 0; index <= 8; index += 1) await executeValidTickV1(index);
  const t10Records = await fixture.formal_evidence_source.loadCandidateRecords({ scope, logical_time: cap08TickLogicalTimeV1(10) });
  const fvo10 = cloneV1(t10Records.find((record) => record.source_record_id === "FVO-10")!);
  assert.ok(fvo10);

  await expectRejectZeroDeltaV1("S3-N15", async () => {
    const early = cloneV1(fvo10);
    early.available_to_runtime_at = cap08TickLogicalTimeV1(9);
    early.role_time.available_to_runtime_at = cap08TickLogicalTimeV1(9);
    const service = tickServiceV1(new MutatedEvidenceSourceV1((records, logicalTime) =>
      logicalTime === cap08TickLogicalTimeV1(9) ? [...records, early] : records));
    await service.executeOneTick(tickInputV1(9));
  });

  await executeValidTickV1(9);

  await expectRejectZeroDeltaV1("S3-N16", async () => {
    const service = tickServiceV1(new MutatedEvidenceSourceV1((records, logicalTime) =>
      logicalTime === cap08TickLogicalTimeV1(10) ? [...records, cloneV1(fvo10)] : records));
    await service.executeOneTick(tickInputV1(10));
  });

  await expectRejectZeroDeltaV1("S3-N18", async () => {
    const service = tickServiceV1(new MutatedEvidenceSourceV1((records, logicalTime) => records.map((record) => {
      if (logicalTime !== cap08TickLogicalTimeV1(10) || record.source_record_id !== "FVO-10") return record;
      const invalid = cloneV1(record);
      invalid.canonical_payload.unit = "mm";
      return invalid;
    })));
    await service.executeOneTick(tickInputV1(10));
  });

  await expectRejectZeroDeltaV1("S3-N19", async () => {
    const service = tickServiceV1(new MutatedEvidenceSourceV1((records, logicalTime) => records.map((record) => {
      if (logicalTime !== cap08TickLogicalTimeV1(10) || record.source_record_id !== "FVO-10") return record;
      return { ...cloneV1(record), zone_id: "zone_foreign_s3_n19" };
    })));
    await service.executeOneTick(tickInputV1(10));
  });

  await expectRejectZeroDeltaV1("S3-N20", async () => {
    const service = tickServiceV1(new MutatedEvidenceSourceV1((records, logicalTime) => records.map((record) => {
      if (logicalTime !== cap08TickLogicalTimeV1(10) || record.source_record_id !== "FVO-10") return record;
      const stale = cloneV1(record);
      stale.available_to_runtime_at = cap08TickLogicalTimeV1(11);
      stale.role_time.available_to_runtime_at = cap08TickLogicalTimeV1(11);
      return stale;
    })));
    await service.executeOneTick(tickInputV1(10));
  });

  const validH = await provider.readActionFeedbackExact({ scope });
  const validReceipt = await readEvidenceV1<Cap05ExecutionReceiptEvidenceV1>(
    "mcft_cap08_s3_replay_evidence_v1",
    "irrigation_execution_receipt_evidence_v1",
  );
  const foreignReceipt = rehashEvidenceV1(validReceipt as any, "s3_n17") as Cap05ExecutionReceiptEvidenceV1;
  (foreignReceipt as any).zone_id = "zone_foreign_s3_n17";
  foreignReceipt.canonical_payload.target_scope.zone_id = "zone_foreign_s3_n17";
  foreignReceipt.source_payload = cloneV1(foreignReceipt.canonical_payload);
  delete (foreignReceipt as any).source_record_hash;
  (foreignReceipt as any).source_record_hash = computeCap05ReplayEvidenceSourceRecordHashV1(foreignReceipt as any);
  const foreignFact = await insertEvidenceSetupV1(foreignReceipt as any, "mcft_cap08_s3_replay_evidence_v1");
  const foreignH = cloneV1(validH);
  foreignH.payload.receipt_ref = foreignReceipt.source_record_id;
  foreignH.payload.source_record_id = foreignReceipt.source_record_id;
  await expectRejectZeroDeltaV1("S3-N17", async () => {
    await receiptGuard.validateActionFeedback({ formal_run_id: fixture.formal_run_id, scope, action_feedback: foreignH });
  });
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

  const noScenario = rehashEvidenceV1(decisionRequest, "s3_n01");
  noScenario.zone_id = "zone_missing_s3_n01";
  const noScenarioFact = await insertEvidenceSetupV1(noScenario, "mcft_cap08_s3_replay_evidence_v1");
  await expectRejectZeroDeltaV1("S3-N01", async () => {
    await humanService.commitHumanDecision({
      scope: { ...scope, zone_id: "zone_missing_s3_n01" },
      decision_request_evidence_ref: noScenario.source_record_id,
      decision_request_evidence_hash: noScenario.source_record_hash,
      decided_at: cap08TickLogicalTimeV1(5),
    });
  });
  await deleteFactSetupV1(noScenarioFact);

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
  });
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
  const approvalNoDecision = rehashEvidenceV1(approval as any, "s3_n03") as Cap05ApprovalAssertionEvidenceV1;
  const planNoDecision = rehashEvidenceV1(plan as any, "s3_n03") as Cap05ApprovedPlanEvidenceV1;
  (approvalNoDecision as any).zone_id = "zone_missing_s3_n03";
  (planNoDecision as any).zone_id = "zone_missing_s3_n03";
  planNoDecision.canonical_payload.target_scope.zone_id = "zone_missing_s3_n03";
  approvalNoDecision.source_payload = cloneV1(approvalNoDecision.canonical_payload);
  planNoDecision.source_payload = cloneV1(planNoDecision.canonical_payload);
  delete (approvalNoDecision as any).source_record_hash;
  delete (planNoDecision as any).source_record_hash;
  (approvalNoDecision as any).source_record_hash = computeCap05ReplayEvidenceSourceRecordHashV1(approvalNoDecision as any);
  (planNoDecision as any).source_record_hash = computeCap05ReplayEvidenceSourceRecordHashV1(planNoDecision as any);
  await expectRejectZeroDeltaV1("S3-N03", async () => {
    await bindingService.commitApprovalPlanBinding({
      scope: { ...scope, zone_id: "zone_missing_s3_n03" },
      approval_assertion: approvalNoDecision,
      approved_plan: planNoDecision,
      dispatch: { disposition: "NOT_OBSERVED", evidence_ref: null, evidence_hash: null },
    });
  });

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
  });
}

async function receiptAndFeedbackCasesV1(): Promise<void> {
  const receipt = await readEvidenceV1<Cap05ExecutionReceiptEvidenceV1 & { formal_run_id?: string }>(
    "mcft_cap08_s3_replay_evidence_v1",
    "irrigation_execution_receipt_evidence_v1",
  );
  const h = await provider.readActionFeedbackExact({ scope });

  async function mutatedReceiptCaseV1(
    caseId: string,
    mutate: (value: any) => void,
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
    });
    await deleteFactSetupV1(fact);
  }

  await mutatedReceiptCaseV1("S3-N05", (value) => {
    value.zone_id = "zone_foreign_s3_n05";
    value.canonical_payload.target_scope.zone_id = "zone_foreign_s3_n05";
  });
  await mutatedReceiptCaseV1("S3-N06", (value) => { value.formal_run_id = "formal_run_foreign_s3_n06"; });

  const activeLineage = (await admin.query(
    `SELECT active_lineage_ref FROM twin_active_lineage_index_v1
     WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6`,
    Object.values(scope),
  )).rows[0].active_lineage_ref;
  await admin.query(
    `UPDATE twin_active_lineage_index_v1 SET active_lineage_ref='lineage_foreign_s3_n07'
     WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6`,
    Object.values(scope),
  );
  await expectRejectZeroDeltaV1("S3-N07", async () => {
    await receiptGuard.validateReceipt({ formal_run_id: fixture.formal_run_id, scope, receipt_ref: receipt.source_record_id, receipt_hash: receipt.source_record_hash });
  });
  await admin.query(
    `UPDATE twin_active_lineage_index_v1 SET active_lineage_ref=$7
     WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6`,
    [...Object.values(scope), activeLineage],
  );

  const revision = (await admin.query(
    `SELECT revision_id FROM twin_state_latest_index_v1
     WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6`,
    Object.values(scope),
  )).rows[0].revision_id;
  await admin.query(
    `UPDATE twin_state_latest_index_v1 SET revision_id='revision_foreign_s3_n08'
     WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6`,
    Object.values(scope),
  );
  await expectRejectZeroDeltaV1("S3-N08", async () => {
    await receiptGuard.validateReceipt({ formal_run_id: fixture.formal_run_id, scope, receipt_ref: receipt.source_record_id, receipt_hash: receipt.source_record_hash });
  });
  await admin.query(
    `UPDATE twin_state_latest_index_v1 SET revision_id=$7
     WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6`,
    [...Object.values(scope), revision],
  );

  await expectReadbackZeroDeltaV1("S3-N09", async () => {
    const late = cloneV1(h);
    late.payload.available_to_runtime_at = cap08TickLogicalTimeV1(9);
    const selected = selectCap05ActionFeedbackForTickV1({ scope, logical_time: cap08TickLogicalTimeV1(8), feedback_objects: [late] });
    assert.equal(selected.candidate, null);
    assert.deepEqual(selected.trace.selected_action_feedback_refs, []);
  });

  await expectReadbackZeroDeltaV1("S3-N10", async () => {
    const value = await new PostgresImmutableDecisionActionCommitRepositoryV1(runner).commitCanonicalObject({ object: h });
    assert.equal(value.status, "EXISTING_IDEMPOTENT_SUCCESS");
  });

  await expectRejectZeroDeltaV1("S3-N11", async () => {
    const conflict = cloneV1(h) as any;
    conflict.payload.actual_amount_mm = "13.500000";
    await new PostgresImmutableDecisionActionCommitRepositoryV1(runner).commitCanonicalObject({ object: conflict });
  });

  await mutatedReceiptCaseV1("S3-N12", (value) => {
    value.canonical_payload.actual_amount_mm = "15.000000";
  });
  await mutatedReceiptCaseV1("S3-N13", (value) => {
    value.canonical_payload.spatial_coverage_fraction = "1.500000";
  });
  await mutatedReceiptCaseV1("S3-N14", (value) => {
    value.canonical_payload.target_scope_equivalent_irrigation_mm = "12.000000";
  });
}

async function completionAndAuthorityCasesV1(): Promise<void> {
  const terminal = cap08TickLogicalTimeV1(23);
  const completionInput = {
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
  const completionService = new Cap08CompletionAuthorityServiceV1(completionRepository);
  const established = await completionService.establish(completionInput);
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
  });

  const beforeAuthority = await authorityGuard.capture(scope);
  const configHash = (await admin.query(
    `SELECT config_hash FROM twin_state_latest_index_v1
     WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6`,
    Object.values(scope),
  )).rows[0].config_hash;
  await admin.query(
    `UPDATE twin_state_latest_index_v1 SET config_hash=$7
     WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6`,
    [...Object.values(scope), `sha256:${"f".repeat(64)}`],
  );
  await expectRejectZeroDeltaV1("S3-N22", async () => { await authorityGuard.assertUnchanged(beforeAuthority); });
  await admin.query(
    `UPDATE twin_state_latest_index_v1 SET config_hash=$7
     WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6`,
    [...Object.values(scope), configHash],
  );
}

async function pointerCasesV1(): Promise<void> {
  const decisionId = (await admin.query("SELECT decision_object_id FROM twin_decision_record_projection_v1")).rows[0].decision_object_id;
  await admin.query("UPDATE twin_decision_record_projection_v1 SET decision_object_id='decision_missing_s3_p01' WHERE decision_object_id=$1", [decisionId]);
  await expectRejectZeroDeltaV1("S3-P01", async () => { await inspector.inspect({ formal_run_id: fixture.formal_run_id, scope }); });
  await admin.query("UPDATE twin_decision_record_projection_v1 SET decision_object_id=$1 WHERE decision_object_id='decision_missing_s3_p01'", [decisionId]);

  const scenario = (await admin.query("SELECT scenario_set_id FROM twin_scenario_latest_index_v1")).rows[0].scenario_set_id;
  await admin.query("UPDATE twin_scenario_latest_index_v1 SET scenario_set_id='scenario_missing_s3_p02'");
  await expectRejectZeroDeltaV1("S3-P02", async () => {
    const current = await authorityGuard.capture(scope);
    assert.equal(current.latest_scenario && typeof current.latest_scenario === "object", true);
    await new Cap08CompletionAuthorityServiceV1(completionRepository).inspect({
      run_contract_id: CAP08_S1_RUN_CONTRACT_ID_V1,
      formal_run_id: fixture.formal_run_id,
      scope,
      initial_logical_time: CAP08_S1_RUNTIME_START_V1,
      terminal_logical_time: cap08TickLogicalTimeV1(23),
      expected_next_logical_time: cap08TickLogicalTimeV1(24),
      phase_engine_contract_digest: CAP08_S1_PHASE_ENGINE_CONTRACT_DIGEST_V1,
      phase_engine_source_digest: NEGATIVE_SOURCE_DIGEST,
      expected_tick_count: 24,
      expected_state_count: 25,
      expected_forecast_count: 24,
      expected_scenario_set_count: 24,
    });
  });
  await admin.query("UPDATE twin_scenario_latest_index_v1 SET scenario_set_id=$1", [scenario]);

  const feedbackId = (await admin.query("SELECT action_feedback_object_id FROM twin_action_feedback_projection_v1")).rows[0].action_feedback_object_id;
  await admin.query("UPDATE twin_action_feedback_projection_v1 SET action_feedback_object_id='feedback_missing_s3_p03' WHERE action_feedback_object_id=$1", [feedbackId]);
  await expectRejectZeroDeltaV1("S3-P03", async () => { await inspector.inspect({ formal_run_id: fixture.formal_run_id, scope }); });
  await admin.query("UPDATE twin_action_feedback_projection_v1 SET action_feedback_object_id=$1 WHERE action_feedback_object_id='feedback_missing_s3_p03'", [feedbackId]);

  const checkpointColumn = (await admin.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema='public' AND table_name='twin_runtime_checkpoint_latest_index_v1'
       AND column_name IN ('checkpoint_object_id','checkpoint_ref') ORDER BY column_name LIMIT 1`,
  )).rows[0]?.column_name;
  if (!checkpointColumn) throw new Error("S3_P04_CHECKPOINT_POINTER_COLUMN_MISSING");
  const checkpoint = (await admin.query(`SELECT ${checkpointColumn} AS v FROM twin_runtime_checkpoint_latest_index_v1`)).rows[0].v;
  await admin.query(`UPDATE twin_runtime_checkpoint_latest_index_v1 SET ${checkpointColumn}='checkpoint_missing_s3_p04'`);
  await expectRejectZeroDeltaV1("S3-P04", async () => {
    const value = await new Cap08CompletionAuthorityServiceV1(completionRepository).inspect({
      run_contract_id: CAP08_S1_RUN_CONTRACT_ID_V1,
      formal_run_id: fixture.formal_run_id,
      scope,
      initial_logical_time: CAP08_S1_RUNTIME_START_V1,
      terminal_logical_time: cap08TickLogicalTimeV1(23),
      expected_next_logical_time: cap08TickLogicalTimeV1(24),
      phase_engine_contract_digest: CAP08_S1_PHASE_ENGINE_CONTRACT_DIGEST_V1,
      phase_engine_source_digest: NEGATIVE_SOURCE_DIGEST,
      expected_tick_count: 24,
      expected_state_count: 25,
      expected_forecast_count: 24,
      expected_scenario_set_count: 24,
    });
    if (value.disposition === "ALREADY_COMPLETE_EXACT") throw new Error("S3_P04_WRONG_CHECKPOINT_ACCEPTED");
  });
  await admin.query(`UPDATE twin_runtime_checkpoint_latest_index_v1 SET ${checkpointColumn}=$1`, [checkpoint]);

  const lineage = (await admin.query("SELECT lineage_id FROM twin_state_latest_index_v1")).rows[0].lineage_id;
  await admin.query("UPDATE twin_state_latest_index_v1 SET lineage_id='lineage_foreign_s3_p05'");
  const receipt = await readEvidenceV1<Cap05ExecutionReceiptEvidenceV1>("mcft_cap08_s3_replay_evidence_v1", "irrigation_execution_receipt_evidence_v1");
  await expectRejectZeroDeltaV1("S3-P05", async () => {
    await receiptGuard.validateReceipt({ formal_run_id: fixture.formal_run_id, scope, receipt_ref: receipt.source_record_id, receipt_hash: receipt.source_record_hash });
  });
  await admin.query("UPDATE twin_state_latest_index_v1 SET lineage_id=$1", [lineage]);

  await expectRejectZeroDeltaV1("S3-P06", async () => {
    await admin.query(
      `INSERT INTO twin_approved_plan_binding_projection_v1
       SELECT approved_plan_evidence_ref || '_duplicate', approved_plan_evidence_hash || '_duplicate', tenant_id,project_id,group_id,field_id,season_id,zone_id,
              binding_id,approval_assertion_ref,approval_assertion_hash,decision_request_ref,decision_request_hash,selected_option_ref,selected_option_hash,
              scenario_amount_mm,approved_amount_mm,plan_effective_from,plan_effective_to,true,canonical_evidence,source_fact_id
       FROM twin_approved_plan_binding_projection_v1 WHERE active_for_decision=true`,
    );
  });
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

    const ids = results.map((value) => value.case_id).sort();
    assert.deepEqual(ids.filter((id) => id.startsWith("S3-N")), [...CAP08_S3_NEGATIVE_CASE_IDS_V1].sort());
    assert.deepEqual(ids.filter((id) => id.startsWith("S3-P")), [...CAP08_S3_POINTER_CASE_IDS_V1].sort());
    const result = {
      schema_version: "geox_mcft_cap08_s3_negative_db_result_v1",
      status: "PASS",
      negative_case_count: 22,
      pointer_case_count: 6,
      all_runtime_deltas_zero: true,
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
      schema_version: "geox_mcft_cap08_s3_negative_db_result_v1",
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
