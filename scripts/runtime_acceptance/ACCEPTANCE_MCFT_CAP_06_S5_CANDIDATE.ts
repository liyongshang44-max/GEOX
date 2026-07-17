// Purpose: prove the authorized S5 service composes exact graph resolution, fixed-point calibration, Candidate draft, D commit and canonical readback without Shadow or Runtime authority.
// Boundary: in-memory acceptance only; no PostgreSQL, production write, Evaluation, Model Activation, active-config switch, State/checkpoint mutation, route, Web or scheduler.

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { semanticHashV1 } from "../../apps/server/src/domain/twin_runtime/canonical_identity_v1.js";
import type {
  Cap06GovernanceObjectV1,
  Cap06GovernancePersistenceResultV1,
} from "../../apps/server/src/persistence/calibration/postgres_calibration_governance_repository_v1.js";
import {
  Cap06CalibrationCandidateServiceV1,
  type Cap06CandidatePersistencePortV1,
  type Cap06ExactResolvedCasePortV1,
} from "../../apps/server/src/runtime/calibration/calibration_candidate_service_v1.js";
import { buildCap06S5CandidateFixtureV1 } from "./mcft_cap_06_s5_candidate_fixture_v1.js";

class InMemoryCandidatePersistenceV1 implements Cap06CandidatePersistencePortV1 {
  readonly byObjectId = new Map<string, Cap06GovernanceObjectV1>();
  readonly byIdempotency = new Map<string, Cap06GovernanceObjectV1>();
  commit_calls = 0;

  async commitCanonicalObject(input: {
    object: Cap06GovernanceObjectV1;
    fault_injection?: (stage: string) => void;
  }): Promise<Cap06GovernancePersistenceResultV1> {
    this.commit_calls += 1;
    input.fault_injection?.("before_in_memory_commit");
    const existing = this.byIdempotency.get(input.object.idempotency_key);
    if (existing) {
      if (existing.determinism_hash !== input.object.determinism_hash) {
        throw new Error("CAP06_IN_MEMORY_IDEMPOTENCY_CONFLICT");
      }
      return {
        status: "EXISTING_IDEMPOTENT_SUCCESS",
        object: structuredClone(existing),
        fact_id: `fact_${existing.object_id}`,
      };
    }
    this.byObjectId.set(input.object.object_id, structuredClone(input.object));
    this.byIdempotency.set(input.object.idempotency_key, structuredClone(input.object));
    return {
      status: "INSERTED",
      object: structuredClone(input.object),
      fact_id: `fact_${input.object.object_id}`,
    };
  }

  async readCanonicalObject(objectId: string): Promise<Cap06GovernanceObjectV1 | null> {
    return structuredClone(this.byObjectId.get(objectId) ?? null);
  }
}

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

async function main(): Promise<void> {
  const fixture = await buildCap06S5CandidateFixtureV1();
  const calibrationSet = new Set(fixture.dataset.calibration_window_refs);
  const resolvedByRef = new Map(fixture.resolved.map((item) => [item.residual.object_id, item]));
  const calls: string[][] = [];
  const exactPort: Cap06ExactResolvedCasePortV1 = {
    async resolveExactResidualRefs(refs) {
      calls.push([...refs]);
      return refs.map((ref) => {
        if (!calibrationSet.has(ref)) throw new Error(`CAP06_DOMAIN_HOLDOUT_OR_UNKNOWN_REF_FORBIDDEN:${ref}`);
        const item = resolvedByRef.get(ref);
        if (!item) throw new Error(`CAP06_DOMAIN_RESOLVED_CASE_MISSING:${ref}`);
        return structuredClone(item);
      });
    },
  };
  const persistence = new InMemoryCandidatePersistenceV1();
  const service = new Cap06CalibrationCandidateServiceV1(exactPort, persistence);

  const first = await service.computeAndCommit({
    orderedResidualRefs: fixture.dataset.calibration_window_refs,
    sourceDatasetIdentity: fixture.source_dataset_identity,
  });
  assert.equal(first.status, "BOUNDED_PARAMETER_DELTA_CANDIDATE");
  assert.equal(first.attempt.selected_parameter_value, "0.034000");
  assert.equal(first.attempt.objective_surface.length, 21);
  assert.equal(first.calibration_window.cases.length, 16);
  assert.equal(first.resolved_case_count, 16);
  assert.equal(first.persistence_status, "INSERTED");
  assert.equal(first.candidate_append_count, 1);
  assert.equal(first.canonical_readback_verified, true);
  assert.ok(first.candidate);
  assert.equal(first.candidate?.object_type, "twin_calibration_candidate_v1");
  assert.equal(first.candidate?.payload.candidate_parameter_value, "0.034000");
  assert.equal(first.candidate?.payload.activation_status, "NOT_ACTIVE");
  assert.equal(first.candidate?.payload.eligible_for_runtime_config_use, false);
  assert.deepEqual(first.candidate?.source_refs.slice(0, 16), fixture.dataset.calibration_window_refs);
  assert.equal(first.candidate?.evidence_refs.length, 16);
  assert.equal(first.evaluation_append_count, 0);
  assert.equal(first.model_activation_count, 0);
  assert.equal(first.active_config_switch_count, 0);
  assert.equal(first.state_mutation_count, 0);
  assert.equal(first.checkpoint_mutation_count, 0);

  const second = await service.computeAndCommit({
    orderedResidualRefs: fixture.dataset.calibration_window_refs,
    sourceDatasetIdentity: fixture.source_dataset_identity,
  });
  assert.equal(second.persistence_status, "EXISTING_IDEMPOTENT_SUCCESS");
  assert.equal(second.candidate_append_count, 0);
  assert.equal(second.candidate?.object_id, first.candidate?.object_id);
  assert.equal(second.candidate?.determinism_hash, first.candidate?.determinism_hash);
  assert.equal(persistence.byObjectId.size, 1);
  assert.equal(calls.length, 2);
  assert.deepEqual(calls[0], fixture.dataset.calibration_window_refs);
  assert.equal(calls.flat().some((ref) => fixture.dataset.holdout_window_refs.includes(ref)), false);

  await assert.rejects(
    service.computeAndCommit({
      orderedResidualRefs: fixture.dataset.calibration_window_refs.slice(0, 15),
      sourceDatasetIdentity: fixture.source_dataset_identity,
    }),
    /CAP06_S5_EXACT_CALIBRATION_REF_COUNT_REQUIRED/,
  );
  await assert.rejects(
    service.computeAndCommit({
      orderedResidualRefs: [
        ...fixture.dataset.calibration_window_refs.slice(0, 15),
        fixture.dataset.holdout_window_refs[0],
      ],
      sourceDatasetIdentity: fixture.source_dataset_identity,
    }),
    /CAP06_DOMAIN_HOLDOUT_OR_UNKNOWN_REF_FORBIDDEN/,
  );
  assert.equal(persistence.byObjectId.size, 1);

  const baseMismatchResolved = fixture.resolved.slice(0, 16).map((item, index) => {
    const clone = structuredClone(item);
    if (index === 0) clone.source_forecast_point.storage_mean_mm = "99.999999";
    return clone;
  });
  const baseMismatchPort: Cap06ExactResolvedCasePortV1 = {
    async resolveExactResidualRefs(refs) {
      return refs.map((ref) => {
        const item = baseMismatchResolved.find((candidate) => candidate.residual.object_id === ref);
        if (!item) throw new Error("CAP06_DOMAIN_BASE_MISMATCH_CASE_MISSING");
        return structuredClone(item);
      });
    },
  };
  const baseMismatchPersistence = new InMemoryCandidatePersistenceV1();
  const baseMismatch = await new Cap06CalibrationCandidateServiceV1(
    baseMismatchPort,
    baseMismatchPersistence,
  ).computeAndCommit({
    orderedResidualRefs: fixture.dataset.calibration_window_refs,
    sourceDatasetIdentity: fixture.source_dataset_identity,
  });
  assert.equal(baseMismatch.status, "BASE_REPLAY_MISMATCH");
  assert.equal(baseMismatch.candidate, null);
  assert.equal(baseMismatch.persistence_status, "NOT_APPENDED");
  assert.equal(baseMismatch.candidate_append_count, 0);
  assert.equal(baseMismatchPersistence.commit_calls, 0);

  const result = {
    schema_version: "geox_mcft_cap_06_s5_candidate_domain_result_v1",
    status: "PASS",
    service_result_hash: semanticHashV1({
      candidate_ref: first.candidate?.object_id,
      candidate_hash: first.candidate?.determinism_hash,
      selected_parameter_value: first.attempt.selected_parameter_value,
      calibration_window_hash: first.calibration_window.window_ref_membership_hash,
    }),
    exact_ref_call_count: calls.length,
    calibration_case_count: first.calibration_window.cases.length,
    grid_point_count: first.attempt.objective_surface.length,
    selected_parameter_value: first.attempt.selected_parameter_value,
    first_candidate_append_count: first.candidate_append_count,
    completed_chain_rerun_candidate_append_count: second.candidate_append_count,
    base_replay_mismatch_candidate_append_count: baseMismatch.candidate_append_count,
    evaluation_append_count: 0,
    model_activation_count: 0,
    active_config_switch_count: 0,
    runtime_parameter_change_count: 0,
    state_mutation_count: 0,
    checkpoint_mutation_count: 0,
  };
  fs.mkdirSync(path.join(ROOT, "acceptance-output"), { recursive: true });
  fs.writeFileSync(
    path.join(ROOT, "acceptance-output/MCFT_CAP_06_S5_CANDIDATE_DOMAIN_RESULT.json"),
    `${JSON.stringify(result, null, 2)}\n`,
    "utf8",
  );
  console.log(`S5_CANDIDATE_DOMAIN_RESULT_JSON:${JSON.stringify(result)}`);
  console.log("MCFT_CAP_06_S5_CANDIDATE_DOMAIN:PASS");
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : String(error));
  process.exitCode = 1;
});
