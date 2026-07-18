// Purpose: prove pure S8 exact readback plus two deterministic facts-based rebuilds over a port that exposes no canonical commit method.
// Boundary: in-memory acceptance only; no PostgreSQL, canonical write, shadow recompute, activation, active Config, State/checkpoint, route, Web, scheduler or CAP-07 authority.

import assert from "node:assert/strict";
import { semanticHashV1 } from "../../apps/server/src/domain/twin_runtime/canonical_identity_v1.js";
import type {
  Cap06GovernanceObjectV1,
  Cap06GovernanceRecoverySummaryV1,
} from "../../apps/server/src/persistence/calibration/postgres_calibration_governance_repository_v1.js";
import {
  Cap06RestartReadbackRebuildServiceV1,
} from "../../apps/server/src/runtime/calibration/restart_readback_rebuild_service_v1.js";
import { buildCap06ControlledComputeFixtureV1 } from "./mcft_cap_06_controlled_compute_fixture_v1.js";

const SUMMARY: Cap06GovernanceRecoverySummaryV1 = {
  canonical_objects_scanned: 2,
  idempotency_guards_rebuilt: 2,
  candidate_projections_rebuilt: 1,
  evaluation_projections_rebuilt: 1,
  candidate_evaluation_rows_rebuilt: 1,
  evaluation_case_rows_rebuilt: 8,
};

function rehashV1<T extends Cap06GovernanceObjectV1>(object: T): T {
  const result = structuredClone(object);
  result.determinism_hash = "";
  result.determinism_hash = semanticHashV1(result);
  return result;
}

async function main(): Promise<void> {
  const fixture = await buildCap06ControlledComputeFixtureV1();
  const candidate = structuredClone(fixture.candidate);
  const evaluation = structuredClone(fixture.evaluation);
  const calls: string[] = [];
  const objects = new Map<string, Cap06GovernanceObjectV1>([
    [candidate.object_id, candidate],
    [evaluation.object_id, evaluation],
  ]);
  const port = {
    async readCanonicalObject(objectId: string): Promise<Cap06GovernanceObjectV1 | null> {
      calls.push(`read:${objectId}`);
      return objects.has(objectId) ? structuredClone(objects.get(objectId)!) : null;
    },
    async rebuildFromFacts(): Promise<Cap06GovernanceRecoverySummaryV1> {
      calls.push("rebuild");
      return structuredClone(SUMMARY);
    },
  };
  assert.deepEqual(Object.keys(port).sort(), ["readCanonicalObject", "rebuildFromFacts"]);
  const service = new Cap06RestartReadbackRebuildServiceV1(port);
  const result = await service.recover({
    evaluationRef: evaluation.object_id,
    evaluationHash: evaluation.determinism_hash,
    candidateRef: candidate.object_id,
    candidateHash: candidate.determinism_hash,
  });
  assert.equal(result.exact_readback_verified, true);
  assert.equal(result.deterministic_second_rebuild_verified, true);
  assert.equal(result.evaluation_case_count, 8);
  assert.deepEqual(result.first_rebuild_summary, SUMMARY);
  assert.deepEqual(result.second_rebuild_summary, SUMMARY);
  assert.equal(result.first_rebuild_summary_hash, result.second_rebuild_summary_hash);
  assert.equal(result.pre_rebuild_readback_hash, result.post_first_rebuild_readback_hash);
  assert.equal(result.post_first_rebuild_readback_hash, result.post_second_rebuild_readback_hash);
  assert.deepEqual(calls, [
    `read:${evaluation.object_id}`,
    `read:${candidate.object_id}`,
    "rebuild",
    `read:${evaluation.object_id}`,
    `read:${candidate.object_id}`,
    "rebuild",
    `read:${evaluation.object_id}`,
    `read:${candidate.object_id}`,
  ]);
  assert.equal(result.canonical_fact_append_count, 0);
  assert.equal(result.canonical_fact_update_count, 0);
  assert.equal(result.canonical_fact_delete_count, 0);
  assert.equal(result.candidate_append_count, 0);
  assert.equal(result.evaluation_append_count, 0);
  assert.equal(result.model_activation_count, 0);
  console.log("PASS exact Evaluation/Candidate readback brackets two deterministic facts-based rebuilds with no commit surface");

  let rebuildCalls = 0;
  const wrongHashPort = {
    ...port,
    async rebuildFromFacts(): Promise<Cap06GovernanceRecoverySummaryV1> {
      rebuildCalls += 1;
      return structuredClone(SUMMARY);
    },
  };
  await assert.rejects(
    new Cap06RestartReadbackRebuildServiceV1(wrongHashPort).recover({
      evaluationRef: evaluation.object_id,
      evaluationHash: "sha256:wrong",
      candidateRef: candidate.object_id,
      candidateHash: candidate.determinism_hash,
    }),
    /CAP06_S8_EVALUATION_HASH_MISMATCH/,
  );
  assert.equal(rebuildCalls, 0);
  console.log("PASS wrong exact Evaluation hash fails before projection rebuild");

  const wrongSummaryPort = {
    async readCanonicalObject(objectId: string): Promise<Cap06GovernanceObjectV1 | null> {
      return objects.has(objectId) ? structuredClone(objects.get(objectId)!) : null;
    },
    async rebuildFromFacts(): Promise<Cap06GovernanceRecoverySummaryV1> {
      return { ...SUMMARY, evaluation_case_rows_rebuilt: 7 };
    },
  };
  await assert.rejects(
    new Cap06RestartReadbackRebuildServiceV1(wrongSummaryPort).recover({
      evaluationRef: evaluation.object_id,
      evaluationHash: evaluation.determinism_hash,
      candidateRef: candidate.object_id,
      candidateHash: candidate.determinism_hash,
    }),
    /CAP06_S8_FIRST_REBUILD_SUMMARY_MISMATCH/,
  );
  console.log("PASS incomplete projection rebuild summary fails closed");

  let readCount = 0;
  const divergentPort = {
    async readCanonicalObject(objectId: string): Promise<Cap06GovernanceObjectV1 | null> {
      readCount += 1;
      const source = objects.get(objectId);
      if (!source) return null;
      if (readCount > 2 && objectId === evaluation.object_id) {
        const changed = structuredClone(evaluation);
        changed.payload.reason_codes = ["BIAS_REGRESSION"];
        return rehashV1(changed);
      }
      return structuredClone(source);
    },
    async rebuildFromFacts(): Promise<Cap06GovernanceRecoverySummaryV1> {
      return structuredClone(SUMMARY);
    },
  };
  await assert.rejects(
    new Cap06RestartReadbackRebuildServiceV1(divergentPort).recover({
      evaluationRef: evaluation.object_id,
      evaluationHash: evaluation.determinism_hash,
      candidateRef: candidate.object_id,
      candidateHash: candidate.determinism_hash,
    }),
    /CAP06_S8_EVALUATION_HASH_MISMATCH/,
  );
  console.log("PASS canonical readback drift after rebuild fails closed");

  const output = {
    schema_version: "geox_mcft_cap_06_s8_restart_readback_rebuild_domain_result_v1",
    status: "PASS",
    candidate_ref: candidate.object_id,
    candidate_hash: candidate.determinism_hash,
    evaluation_ref: evaluation.object_id,
    evaluation_hash: evaluation.determinism_hash,
    evaluation_case_count: 8,
    first_rebuild_summary: SUMMARY,
    second_rebuild_summary: SUMMARY,
    deterministic_second_rebuild_verified: true,
    exact_readback_verified: true,
    canonical_fact_append_count: 0,
    canonical_fact_update_count: 0,
    canonical_fact_delete_count: 0,
    candidate_append_count: 0,
    evaluation_append_count: 0,
    model_activation_count: 0,
    active_config_switch_count: 0,
    runtime_parameter_change_count: 0,
    state_mutation_count: 0,
    checkpoint_mutation_count: 0,
    migration_count: 0,
  };
  console.log(JSON.stringify(output));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : String(error));
  process.exitCode = 1;
});
