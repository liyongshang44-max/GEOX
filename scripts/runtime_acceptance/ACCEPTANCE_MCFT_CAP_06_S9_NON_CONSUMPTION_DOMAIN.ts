// Purpose: prove S9 exact Candidate/Evaluation readback, exact governance-to-Runtime scope binding, base-parameter CAP-04 A1/B delegation, completed-tick idempotency, and fail-closed non-consumption guards.
// Boundary: in-memory domain acceptance only; no PostgreSQL, migration, route, scheduler, Model Activation or active-config write.

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Cap06GovernanceObjectV1 } from "../../apps/server/src/persistence/calibration/postgres_calibration_governance_repository_v1.js";
import {
  CAP06_S9_BASE_DRAINAGE_COEFFICIENT_V1,
  Cap06PostEvaluationNonConsumptionTickServiceV1,
  type Cap06S9ReadPortV1,
  type Cap06S9RuntimeAuthoritySnapshotV1,
} from "../../apps/server/src/runtime/calibration/post_evaluation_non_consumption_tick_service_v1.js";
import type { TwinScopeKeyV1 } from "../../apps/server/src/runtime/twin_runtime/ports.js";
import { buildCap04S6SingleTickFixtureV1 } from "./mcft_cap_04_single_tick_fixture_v1.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const CANDIDATE_REF = "twin_calibration_candidate_5649b9ab80b5545cf6007387";
const CANDIDATE_HASH = "sha256:a2018a61bf6699b3cc3b8992058eb2c37b4d38d7f70771f9186495144c229a65";
const EVALUATION_REF = "twin_shadow_evaluation_8cae1f6732420a4999deffc0";
const EVALUATION_HASH = "sha256:32c43020f45351994120515e5c633531bb594d85659456c65bd46305737d85e0";
let pass = 0;

function ok(label: string): void {
  pass += 1;
  console.log(`PASS ${label}`);
}

function governanceObjectsV1(scope: TwinScopeKeyV1): Map<string, Cap06GovernanceObjectV1> {
  const candidate = {
    object_id: CANDIDATE_REF,
    object_type: "twin_calibration_candidate_v1",
    determinism_hash: CANDIDATE_HASH,
    scope: structuredClone(scope),
    payload: {
      candidate_parameter_value: "0.034000",
      base_parameter_value: "0.030000",
      activation_status: "NOT_ACTIVE",
      eligible_for_runtime_config_use: false,
    },
  } as unknown as Cap06GovernanceObjectV1;
  const evaluation = {
    object_id: EVALUATION_REF,
    object_type: "twin_shadow_evaluation_v1",
    determinism_hash: EVALUATION_HASH,
    scope: structuredClone(scope),
    payload: {
      candidate_ref: CANDIDATE_REF,
      candidate_hash: CANDIDATE_HASH,
      activation_created: false,
    },
  } as unknown as Cap06GovernanceObjectV1;
  return new Map([[CANDIDATE_REF, candidate], [EVALUATION_REF, evaluation]]);
}

async function positivePortV1(fixture: ReturnType<typeof buildCap04S6SingleTickFixtureV1>): Promise<Cap06S9ReadPortV1> {
  const objects = governanceObjectsV1(fixture.input.scope);
  return {
    async readCanonicalObject(objectId) {
      return structuredClone(objects.get(objectId) ?? null);
    },
    async readRuntimeAuthoritySnapshot(input) {
      const config = await fixture.runtime.readRuntimeConfig(input.runtime_config_ref);
      assert.ok(config);
      assert.equal(config.determinism_hash, input.runtime_config_hash);
      const payload = config.payload as Record<string, any>;
      return {
        scope: structuredClone(input.scope),
        inspected_runtime_config_ref: config.object_id,
        inspected_runtime_config_hash: config.determinism_hash,
        effective_drainage_coefficient_per_hour: String(payload.dynamics_parameters.drainage_coefficient_per_hour),
        runtime_config_semantic_payload: structuredClone(payload),
        active_config_relation: null,
        active_config_snapshot_hash: null,
        model_activation_count: 0,
        candidate_fact_count: 1,
        evaluation_fact_count: 1,
      };
    },
  };
}

async function expectPreTickFailureV1(input: {
  mutate: (snapshot: Cap06S9RuntimeAuthoritySnapshotV1) => void;
  expected: RegExp;
}): Promise<void> {
  const fixture = buildCap04S6SingleTickFixtureV1();
  const base = await positivePortV1(fixture);
  let tickCalls = 0;
  const port: Cap06S9ReadPortV1 = {
    readCanonicalObject: base.readCanonicalObject.bind(base),
    async readRuntimeAuthoritySnapshot(request) {
      const snapshot = await base.readRuntimeAuthoritySnapshot(request);
      input.mutate(snapshot);
      return snapshot;
    },
  };
  const service = new Cap06PostEvaluationNonConsumptionTickServiceV1(port, {
    async executeOneTick(request) {
      tickCalls += 1;
      return fixture.service.executeOneTick(request);
    },
  });
  await assert.rejects(service.execute({
    candidate_ref: CANDIDATE_REF,
    candidate_hash: CANDIDATE_HASH,
    evaluation_ref: EVALUATION_REF,
    evaluation_hash: EVALUATION_HASH,
    expected_candidate_parameter_value: "0.034000",
    tick_input: fixture.input,
  }), input.expected);
  assert.equal(tickCalls, 0);
}

async function expectGovernanceScopeFailureV1(input: {
  objectRef: typeof CANDIDATE_REF | typeof EVALUATION_REF;
  expected: RegExp;
}): Promise<void> {
  const fixture = buildCap04S6SingleTickFixtureV1();
  const objects = governanceObjectsV1(fixture.input.scope);
  const target = objects.get(input.objectRef);
  assert.ok(target);
  target.scope = { ...target.scope, field_id: "field_scope_mismatch" };
  let tickCalls = 0;
  const port: Cap06S9ReadPortV1 = {
    async readCanonicalObject(objectId) {
      return structuredClone(objects.get(objectId) ?? null);
    },
    async readRuntimeAuthoritySnapshot() {
      throw new Error("RUNTIME_AUTHORITY_MUST_NOT_BE_READ_AFTER_GOVERNANCE_SCOPE_FAILURE");
    },
  };
  const service = new Cap06PostEvaluationNonConsumptionTickServiceV1(port, {
    async executeOneTick(request) {
      tickCalls += 1;
      return fixture.service.executeOneTick(request);
    },
  });
  await assert.rejects(service.execute({
    candidate_ref: CANDIDATE_REF,
    candidate_hash: CANDIDATE_HASH,
    evaluation_ref: EVALUATION_REF,
    evaluation_hash: EVALUATION_HASH,
    expected_candidate_parameter_value: "0.034000",
    tick_input: fixture.input,
  }), input.expected);
  assert.equal(tickCalls, 0);
}

async function main(): Promise<void> {
  const fixture = buildCap04S6SingleTickFixtureV1();
  const readPort = await positivePortV1(fixture);
  const service = new Cap06PostEvaluationNonConsumptionTickServiceV1(readPort, fixture.service);
  const request = {
    candidate_ref: CANDIDATE_REF,
    candidate_hash: CANDIDATE_HASH,
    evaluation_ref: EVALUATION_REF,
    evaluation_hash: EVALUATION_HASH,
    expected_candidate_parameter_value: "0.034000",
    tick_input: fixture.input,
  };

  const first = await service.execute(request);
  assert.equal(first.status, "INSERTED");
  assert.equal(first.effective_tick_parameter_value, CAP06_S9_BASE_DRAINAGE_COEFFICIENT_V1);
  assert.equal(first.candidate_parameter_value, "0.034000");
  assert.equal(first.forecast_point_count, 72);
  assert.equal(first.scenario_option_count, 3);
  assert.equal(first.scenario_points_per_option, 72);
  assert.equal(first.candidate_consumed, false);
  assert.equal(first.evaluation_consumed, false);
  ok("normal CAP-04 A1/B tick remains pinned to base-equivalent Config after exact same-scope Candidate/Evaluation readback");

  const counters = {
    evidence: fixture.runtime.evidenceLoadCount,
    config: fixture.runtime.configReadCount,
    lease: fixture.runtime.leaseAcquireCount,
    a: fixture.runtime.aCommitCount,
    b: fixture.runtime.bCommitCount,
  };
  const replay = await service.execute(request);
  assert.equal(replay.status, "EXISTING_IDEMPOTENT_SUCCESS");
  assert.equal(replay.forecast_hash, first.forecast_hash);
  assert.equal(replay.scenario_set_hash, first.scenario_set_hash);
  assert.equal(fixture.runtime.evidenceLoadCount, counters.evidence);
  assert.equal(fixture.runtime.leaseAcquireCount, counters.lease);
  assert.equal(fixture.runtime.aCommitCount, counters.a);
  assert.equal(fixture.runtime.bCommitCount, counters.b);
  assert.ok(fixture.runtime.configReadCount >= counters.config);
  ok("completed S9 rerun returns the same A1/B authority without Evidence, lease or canonical recompute");

  await expectGovernanceScopeFailureV1({
    objectRef: CANDIDATE_REF,
    expected: /CAP06_S9_CANDIDATE_SCOPE_MISMATCH:field_id/,
  });
  ok("Candidate scope mismatch fails before Runtime authority read or tick execution");

  await expectGovernanceScopeFailureV1({
    objectRef: EVALUATION_REF,
    expected: /CAP06_S9_EVALUATION_SCOPE_MISMATCH:field_id/,
  });
  ok("Evaluation scope mismatch fails before Runtime authority read or tick execution");

  await expectPreTickFailureV1({
    mutate(snapshot) {
      snapshot.effective_drainage_coefficient_per_hour = "0.034000";
    },
    expected: /CAP06_S9_BASE_EQUIVALENT_CONFIG_REQUIRED/,
  });
  ok("candidate-parameter Runtime Config fails before tick execution");

  await expectPreTickFailureV1({
    mutate(snapshot) {
      snapshot.runtime_config_semantic_payload = { candidate_ref: CANDIDATE_REF };
    },
    expected: /CAP06_S9_CANDIDATE_REF_IN_RUNTIME_CONFIG_AUTHORITY/,
  });
  ok("Candidate ref leakage into Runtime Config authority fails before tick execution");

  await expectPreTickFailureV1({
    mutate(snapshot) {
      snapshot.runtime_config_semantic_payload = { evaluation_ref: EVALUATION_REF };
    },
    expected: /CAP06_S9_EVALUATION_REF_IN_RUNTIME_CONFIG_AUTHORITY/,
  });
  ok("Evaluation ref leakage into Runtime Config authority fails before tick execution");

  await expectPreTickFailureV1({
    mutate(snapshot) {
      snapshot.model_activation_count = 1;
    },
    expected: /CAP06_S9_PREEXISTING_MODEL_ACTIVATION_FORBIDDEN/,
  });
  ok("preexisting Model Activation fails before tick execution");

  const changedRelationFixture = buildCap04S6SingleTickFixtureV1();
  const basePort = await positivePortV1(changedRelationFixture);
  let snapshotCalls = 0;
  const changedRelationPort: Cap06S9ReadPortV1 = {
    readCanonicalObject: basePort.readCanonicalObject.bind(basePort),
    async readRuntimeAuthoritySnapshot(request) {
      snapshotCalls += 1;
      const snapshot = await basePort.readRuntimeAuthoritySnapshot(request);
      if (snapshotCalls > 1) {
        snapshot.active_config_relation = "public.twin_active_config_index_v1";
        snapshot.active_config_snapshot_hash = "sha256:forbidden-switch";
      }
      return snapshot;
    },
  };
  await assert.rejects(
    new Cap06PostEvaluationNonConsumptionTickServiceV1(changedRelationPort, changedRelationFixture.service).execute({
      ...request,
      tick_input: changedRelationFixture.input,
    }),
    /CAP06_S9_ACTIVE_CONFIG_SNAPSHOT_CHANGED/,
  );
  ok("active-config relation or content change after an otherwise normal tick fails closed");

  const output = {
    schema_version: "geox_mcft_cap_06_s9_non_consumption_domain_result_v1",
    status: "PASS",
    candidate_ref: CANDIDATE_REF,
    candidate_hash: CANDIDATE_HASH,
    evaluation_ref: EVALUATION_REF,
    evaluation_hash: EVALUATION_HASH,
    candidate_parameter_value: "0.034000",
    effective_tick_parameter_value: "0.030000",
    governance_runtime_scope_match: true,
    forecast_point_count: 72,
    scenario_option_count: 3,
    scenario_points_per_option: 72,
    candidate_consumed: false,
    evaluation_consumed: false,
    model_activation_count: 0,
    active_config_changed: false,
    completed_rerun_verified: true,
    pass_count: pass,
  };
  fs.mkdirSync(path.join(ROOT, "acceptance-output"), { recursive: true });
  fs.writeFileSync(
    path.join(ROOT, "acceptance-output/MCFT_CAP_06_S9_NON_CONSUMPTION_DOMAIN_RESULT.json"),
    `${JSON.stringify(output, null, 2)}\n`,
    "utf8",
  );
  console.log(JSON.stringify(output));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : String(error));
  process.exitCode = 1;
});
