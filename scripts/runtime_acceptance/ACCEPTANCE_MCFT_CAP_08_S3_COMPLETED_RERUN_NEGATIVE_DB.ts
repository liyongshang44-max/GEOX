// Fresh-PostgreSQL corruption proof for MCFT-CAP-08.S3 completed-rerun semantic readback.
// Requires the positive S3 formal run and its atomic generic/semantic authority pair in the target database.
// Each case uses administrator-owned fault setup, invokes only the bounded pair inspector, proves zero additional mutation, and restores the exact row.

import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { semanticHashV1 } from "../../apps/server/src/domain/twin_runtime/canonical_identity_v1.js";
import { computeCap04AMemberDeterminismHashV1 } from "../../apps/server/src/domain/twin_runtime/forecast_scenario_member_hash_v1.js";
import {
  CAP08_S1_PHASE_ENGINE_CONTRACT_DIGEST_V1,
  CAP08_S1_RUN_CONTRACT_ID_V1,
  CAP08_S1_RUNTIME_START_V1,
  CAP08_S1_TICK_COUNT_V1,
  cap08TickLogicalTimeV1,
} from "../../apps/server/src/domain/twin_runtime/cap08_phase_engine_contracts_v1.js";
import type { CanonicalObjectEnvelopeV1 } from "../../apps/server/src/domain/twin_runtime/canonical_object_contracts_v1.js";
import type { Cap08S3CompletionTupleV1 } from "../../apps/server/src/domain/twin_runtime/cap08_s3_completion_tuple_v1.js";
import { PostgresCap08S3CompletionAuthorityPairRepositoryV1 } from "../../apps/server/src/persistence/twin_runtime/postgres_cap08_s3_completion_authority_pair_repository_v1.js";
import { admin, runner } from "./mcft_cap08_s2_g3_acceptance_support_v1.js";
import { buildCap08S2FormalProviderFixtureV1 } from "./mcft_cap08_s2_formal_provider_fixture_v1.js";
import { computeCap08S3SourceManifestV1 } from "./mcft_cap08_s3_source_manifest_v1.js";

if (process.env.MCFT_CAP08_S3_COMPLETED_RERUN_NEGATIVE_DESTRUCTIVE_ACCEPTANCE !== "1") {
  throw new Error("SET_MCFT_CAP08_S3_COMPLETED_RERUN_NEGATIVE_DESTRUCTIVE_ACCEPTANCE_1");
}

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const OUT = path.join(ROOT, "acceptance-output/MCFT_CAP_08_S3_COMPLETED_RERUN_NEGATIVE_DB_RESULT.json");
const fixture = buildCap08S2FormalProviderFixtureV1();
const sourceManifest = computeCap08S3SourceManifestV1(ROOT);
const pairRepository = new PostgresCap08S3CompletionAuthorityPairRepositoryV1(runner);

type FactRowV1 = {
  fact_id: string;
  occurred_at: string;
  source: string;
  record_json: Record<string, unknown>;
};

type AuthorityRowV1 = {
  authority_kind: string;
  authority_ref: string;
  determinism_hash: string;
  semantic_payload: Record<string, unknown>;
  created_at: string;
};

type CaseResultV1 = {
  case_id: string;
  status: "PASS";
  observed_error: string;
  runtime_delta: 0;
};

const results: CaseResultV1[] = [];

function write(value: unknown): void {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, `${JSON.stringify(value, null, 2)}\n`);
}

function inspectionInputV1() {
  const terminal = cap08TickLogicalTimeV1(CAP08_S1_TICK_COUNT_V1 - 1);
  return {
    run_contract_id: CAP08_S1_RUN_CONTRACT_ID_V1,
    formal_run_id: fixture.formal_run_id,
    scope: fixture.scope,
    initial_logical_time: CAP08_S1_RUNTIME_START_V1,
    terminal_logical_time: terminal,
    expected_next_logical_time: new Date(Date.parse(terminal) + 3_600_000).toISOString(),
    phase_engine_contract_digest: CAP08_S1_PHASE_ENGINE_CONTRACT_DIGEST_V1,
    phase_engine_source_digest: sourceManifest.manifest_digest,
    expected_tick_count: 24,
    expected_state_count: 25,
    expected_forecast_count: 24,
    expected_scenario_set_count: 24,
  } as const;
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
  return `sha256:${crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex")}`;
}

async function factByObjectRefV1(ref: string): Promise<FactRowV1> {
  const rows = await admin.query(
    `SELECT fact_id,occurred_at::text,source,record_json
       FROM facts WHERE record_json->'payload'->>'object_id'=$1`,
    [ref],
  );
  if (rows.rows.length !== 1) {
    throw new Error(`S3_COMPLETED_NEGATIVE_OBJECT_FACT_CARDINALITY:${ref}:${rows.rows.length}`);
  }
  return structuredClone(rows.rows[0] as FactRowV1);
}

async function factByTypeV1(source: string, type: string): Promise<FactRowV1> {
  const rows = await admin.query(
    `SELECT fact_id,occurred_at::text,source,record_json
       FROM facts WHERE source=$1 AND record_json->>'type'=$2`,
    [source, type],
  );
  if (rows.rows.length !== 1) {
    throw new Error(`S3_COMPLETED_NEGATIVE_TYPE_FACT_CARDINALITY:${type}:${rows.rows.length}`);
  }
  return structuredClone(rows.rows[0] as FactRowV1);
}

async function authorityByRefV1(ref: string): Promise<AuthorityRowV1> {
  const rows = await admin.query(
    `SELECT authority_kind,authority_ref,determinism_hash,semantic_payload,created_at::text
       FROM twin_runtime_authority_snapshot_v1
      WHERE authority_kind='REALITY_BINDING' AND authority_ref=$1`,
    [ref],
  );
  if (rows.rows.length !== 1) {
    throw new Error(`S3_COMPLETED_NEGATIVE_AUTHORITY_CARDINALITY:${ref}:${rows.rows.length}`);
  }
  return structuredClone(rows.rows[0] as AuthorityRowV1);
}

async function updateFactV1(row: FactRowV1): Promise<void> {
  await admin.query(
    "UPDATE facts SET occurred_at=$2::timestamptz,source=$3,record_json=$4::jsonb WHERE fact_id=$1",
    [row.fact_id, row.occurred_at, row.source, JSON.stringify(row.record_json)],
  );
}

async function restoreDeletedFactV1(row: FactRowV1): Promise<void> {
  await admin.query(
    "INSERT INTO facts (fact_id,occurred_at,source,record_json) VALUES ($1,$2::timestamptz,$3,$4::jsonb)",
    [row.fact_id, row.occurred_at, row.source, JSON.stringify(row.record_json)],
  );
}

async function updateAuthorityV1(row: AuthorityRowV1): Promise<void> {
  await admin.query(
    `UPDATE twin_runtime_authority_snapshot_v1
        SET determinism_hash=$3,semantic_payload=$4::jsonb,created_at=$5::timestamptz
      WHERE authority_kind=$1 AND authority_ref=$2`,
    [row.authority_kind, row.authority_ref, row.determinism_hash, JSON.stringify(row.semantic_payload), row.created_at],
  );
}

async function restoreDeletedAuthorityV1(row: AuthorityRowV1): Promise<void> {
  await admin.query(
    `INSERT INTO twin_runtime_authority_snapshot_v1
     (authority_kind,authority_ref,determinism_hash,semantic_payload,created_at)
     VALUES ($1,$2,$3,$4::jsonb,$5::timestamptz)`,
    [row.authority_kind, row.authority_ref, row.determinism_hash, JSON.stringify(row.semantic_payload), row.created_at],
  );
}

async function expectPairRejectV1(
  caseId: string,
  expected: RegExp,
  restore: () => Promise<void>,
): Promise<void> {
  const before = await runtimeSnapshotV1();
  let observed = "";
  try {
    await pairRepository.inspect(inspectionInputV1());
    throw new Error(`S3_COMPLETED_NEGATIVE_DID_NOT_REJECT:${caseId}`);
  } catch (error) {
    observed = error instanceof Error ? error.message : String(error);
    if (observed === `S3_COMPLETED_NEGATIVE_DID_NOT_REJECT:${caseId}`) throw error;
    if (!expected.test(observed)) throw new Error(`${caseId}_UNEXPECTED_ERROR:${observed}`);
  }
  const after = await runtimeSnapshotV1();
  assert.equal(after, before, `${caseId}_RUNTIME_DELTA_NONZERO`);
  await restore();
  results.push({ case_id: caseId, status: "PASS", observed_error: observed, runtime_delta: 0 });
  console.log(`PASS ${caseId} ${observed}`);
}

function mutateCanonicalV1(
  row: FactRowV1,
  mutate: (payload: Record<string, unknown>) => void,
): FactRowV1 {
  const copy = structuredClone(row);
  const envelope = copy.record_json.payload as CanonicalObjectEnvelopeV1;
  mutate(envelope.payload);
  envelope.determinism_hash = computeCap04AMemberDeterminismHashV1(envelope);
  return copy;
}

async function main(): Promise<void> {
  try {
    assert.equal((await runner.query("SELECT current_user AS u")).rows[0].u, "geox_mcft_cap08_runner_v1");
    const baseline = await pairRepository.inspect(inspectionInputV1());
    assert.equal(baseline.disposition, "ALREADY_COMPLETE_EXACT");
    assert.ok(baseline.generic_authority);
    assert.ok(baseline.semantic_authority);
    assert.ok(baseline.rebuilt_semantic_authority);
    const tuple = baseline.semantic_authority;

    {
      const original = await factByObjectRefV1(tuple.t08.evidence_window_ref);
      const mutated = mutateCanonicalV1(original, (payload) => {
        payload.dynamics_consumed_evidence_refs = (payload.dynamics_consumed_evidence_refs as string[])
          .filter((ref) => ref !== tuple.action_feedback.ref);
      });
      await updateFactV1(mutated);
      await expectPairRejectV1("S3-CR01", /CAP08_S3_COMPLETION_T08_H_NOT_CONSUMED/, () => updateFactV1(original));
    }

    {
      const original = await factByObjectRefV1(tuple.t09.evidence_window_ref);
      const mutated = mutateCanonicalV1(original, (payload) => {
        const selection = structuredClone(payload.observation_selection as Record<string, unknown>);
        selection.selected_observation_ref = "FVO-10";
        payload.observation_selection = selection;
        payload.assimilation_applied_evidence_refs = ["FVO-10"];
      });
      await updateFactV1(mutated);
      await expectPairRejectV1("S3-CR02", /CAP08_S3_COMPLETION_T09_ABSENCE_NOT_REBUILT/, () => updateFactV1(original));
    }

    {
      const original = await factByTypeV1(
        "mcft_cap08_s3_completion_evidence_v1",
        "mcft_cap08_s3_outcome_absence_witness_v1",
      );
      await admin.query("DELETE FROM facts WHERE fact_id=$1", [original.fact_id]);
      await expectPairRejectV1("S3-CR03", /CAP08_S3_COMPLETION_ABSENCE_WITNESS_REQUIRED/, () => restoreDeletedFactV1(original));
    }

    {
      const original = await factByTypeV1(
        "mcft_cap08_s3_completion_evidence_v1",
        "soil_moisture_observation_v1",
      );
      const mutated = structuredClone(original);
      const payload = mutated.record_json.payload as Record<string, unknown>;
      payload.source_record_hash = `sha256:${"0".repeat(64)}`;
      await updateFactV1(mutated);
      await expectPairRejectV1("S3-CR04", /CAP08_S3_OUTCOME_COMPLETION_EVIDENCE_HASH_MISMATCH/, () => updateFactV1(original));
    }

    {
      const original = await factByObjectRefV1(tuple.t10.assimilation_update_ref);
      const mutated = mutateCanonicalV1(original, (payload) => {
        payload.selected_observation_ref = null;
        payload.applied_observation_refs = [];
        payload.consumed_observation_refs = [];
      });
      await updateFactV1(mutated);
      await expectPairRejectV1("S3-CR05", /CAP08_S3_COMPLETION_T10_ASSIMILATION_NOT_REBUILT/, () => updateFactV1(original));
    }

    {
      const original = await authorityByRefV1(tuple.tuple_ref);
      const mutated = structuredClone(original);
      const payload = mutated.semantic_payload as unknown as Cap08S3CompletionTupleV1;
      payload.tick_trace_digests[0] = `sha256:${"1".repeat(64)}`;
      const semantic = structuredClone(payload) as unknown as Record<string, unknown>;
      delete semantic.determinism_hash;
      payload.determinism_hash = semanticHashV1(semantic);
      mutated.determinism_hash = payload.determinism_hash;
      await updateAuthorityV1(mutated);
      await expectPairRejectV1(
        "S3-CR06",
        /(CAP08_S3_COMPLETION_TRACE_BINDING_MISMATCH:T00|CAP08_S3_SEMANTIC_COMPLETION_AUTHORITY_REBUILD_MISMATCH)/,
        () => updateAuthorityV1(original),
      );
    }

    {
      const semantic = await authorityByRefV1(tuple.tuple_ref);
      await admin.query(
        "DELETE FROM twin_runtime_authority_snapshot_v1 WHERE authority_kind=$1 AND authority_ref=$2",
        [semantic.authority_kind, semantic.authority_ref],
      );
      await expectPairRejectV1("S3-CR07", /CAP08_S3_COMPLETION_AUTHORITY_PARTIAL_PAIR/, () => restoreDeletedAuthorityV1(semantic));
    }

    {
      const generic = await authorityByRefV1(baseline.generic_authority.authority_ref);
      await admin.query(
        "DELETE FROM twin_runtime_authority_snapshot_v1 WHERE authority_kind=$1 AND authority_ref=$2",
        [generic.authority_kind, generic.authority_ref],
      );
      await expectPairRejectV1("S3-CR08", /CAP08_S3_COMPLETION_AUTHORITY_PARTIAL_PAIR/, () => restoreDeletedAuthorityV1(generic));
    }

    const finalReadback = await pairRepository.inspect(inspectionInputV1());
    assert.equal(finalReadback.disposition, "ALREADY_COMPLETE_EXACT");
    assert.equal(finalReadback.semantic_authority?.determinism_hash, tuple.determinism_hash);
    assert.deepEqual(results.map((item) => item.case_id), [
      "S3-CR01",
      "S3-CR02",
      "S3-CR03",
      "S3-CR04",
      "S3-CR05",
      "S3-CR06",
      "S3-CR07",
      "S3-CR08",
    ]);
    const result = {
      schema_version: "geox_mcft_cap08_s3_completed_rerun_negative_db_result_v2",
      status: "PASS",
      completed_rerun_corruption_case_count: results.length,
      all_runtime_deltas_zero: results.every((item) => item.runtime_delta === 0),
      normal_runner_repair_authorized: false,
      canonical_completion_tuple_fact_authorized: false,
      cases: results,
      production_runtime_source_authorized: false,
      s3_effective: false,
      s4_authorized: false,
    };
    write(result);
    console.log(JSON.stringify(result));
  } catch (error) {
    write({
      schema_version: "geox_mcft_cap08_s3_completed_rerun_negative_db_result_v2",
      status: "FAIL",
      error: error instanceof Error ? error.message : String(error),
      completed_cases: results,
    });
    throw error;
  } finally {
    await Promise.all([runner.end(), admin.end()]);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
