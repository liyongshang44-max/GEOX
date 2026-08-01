#!/usr/bin/env -S pnpm exec tsx
import assert from "node:assert/strict";
import crypto from "node:crypto";
import cp from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { semanticHashV1 } from "../../apps/server/src/domain/twin_runtime/canonical_identity_v1.js";
import { CAP08_S1_RUNTIME_START_V1 } from "../../apps/server/src/domain/twin_runtime/cap08_phase_engine_contracts_v1.js";
import {
  CAP08_S4_T17_A2_SCOPE_STATUS_V1,
  CAP08_S4_T17_FORMAL_A1_PROOF_SCHEMA_VERSION_V1,
  CAP08_S4_T17_FORMAL_OUTCOME_V1,
  CAP08_S4_T17_SERIALIZATION_RETRY_POLICY_V1,
  CAP08_S4_T17_TRANSITION_KIND_V1,
  assertCap08S4T17FormalA1OutcomeV1,
  classifyCap08S4T17ExistingTransitionV1,
  validateCap08S4T17FormalA1ProofV1,
  type Cap08S4T17FormalA1ProofV1,
  type Cap08S4T17ObjectBindingV1,
  type Cap08S4T17TransitionWitnessInputV1,
} from "../../apps/server/src/domain/twin_runtime/cap08_t17_transition_contracts_v1.js";
import {
  cap08S4T17TransitionWitnessFactIdV1,
  deriveCap08S4T17TransitionWitnessV1,
} from "../../apps/server/src/domain/twin_runtime/cap08_t17_transition_witness_identity_v1.js";
import { buildAssimilatedContinuationEvidenceWindowV2 } from "../../apps/server/src/runtime/twin_runtime/assimilated_continuation_evidence_window_v2.js";
import { selectCap04FutureForcingOutcomeV1 } from "../../apps/server/src/runtime/twin_runtime/future_forcing_outcome_classifier_v1.js";
import { buildCap08S2FormalProviderFixtureV1 } from "../runtime_acceptance/mcft_cap08_s2_formal_provider_fixture_v1.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../..");
const D = "docs/digital_twin/mcft/cap_08";
const ADR = `${D}/GEOX-MCFT-CAP-08-S4-T17-PRODUCT-TIMELINE-ARCHITECTURE-ADJUDICATION-V1.md`;
const STATE = `${D}/GEOX-MCFT-CAP-08-S4-T17-TRANSITION-STATE-MACHINE-V1.json`;
const SQL = `${D}/GEOX-MCFT-CAP-08-S4-T17-SQL-TRANSACTION-SPECIFICATION-V1.json`;
const MATRIX = `${D}/GEOX-MCFT-CAP-08-S4-T17-ACCEPTANCE-MATRIX-V1.json`;
const BOUNDARY = `${D}/GEOX-MCFT-CAP-08-S4-T17-ADR-BOUNDARY-V1.json`;
const FREEZE = `${D}/GEOX-MCFT-CAP-08-S6-STAGE-1A-END-TO-END-CLOSURE-NOT-ESTABLISHED-V1.json`;
const FINAL_SOURCE = "scripts/runtime_acceptance/mcft_cap08_s6_single_run_ports/final_evidence_source_v1.cjs";
const PRODUCT_CHAIN = "scripts/runtime_acceptance/mcft_cap08_s6_single_run_ports/product_chain_v1.cjs";
const WORKFLOW = ".github/workflows/mcft-cap-08-s4-t17-product-timeline-adjudication.yml";
const OUTPUT = path.join(
  ROOT,
  "acceptance-output/MCFT_CAP_08_S4_T17_PRODUCT_TIMELINE_ADJUDICATION_RESULT.json",
);

const readJson = (relative: string): any =>
  JSON.parse(fs.readFileSync(path.join(ROOT, relative), "utf8"));
const text = (relative: string): string =>
  fs.readFileSync(path.join(ROOT, relative), "utf8");
const git = (...args: string[]): string =>
  cp.execFileSync("git", args, { cwd: ROOT, encoding: "utf8" }).trim();

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort()
      .map((key) => `${JSON.stringify(key)}:${canonical(record[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function semanticDigest(value: Record<string, unknown>): string {
  const copy = structuredClone(value);
  delete copy.semantic_digest;
  return `sha256:${crypto.createHash("sha256").update(canonical(copy)).digest("hex")}`;
}

function write(value: unknown): void {
  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, `${JSON.stringify(value, null, 2)}\n`);
}

function addHours(value: string, hours: number): string {
  return new Date(Date.parse(value) + hours * 3_600_000).toISOString();
}

function rewriteFrozenFinalForcing(
  records: any[],
  logicalTime: string,
): any[] {
  const index = (Date.parse(logicalTime) - Date.parse(CAP08_S1_RUNTIME_START_V1)) / 3_600_000;
  assert.equal(Number.isInteger(index) && index >= 0 && index <= 23, true);
  return records
    .filter((record) => record.record_type !== "soil_moisture_observation_v1")
    .map((source) => {
      const record = structuredClone(source);
      if (record.record_type !== "observed_rainfall_v1") return record;
      const value = index >= 8
        ? Number((5.2 + (index % 4) * 0.2).toFixed(6))
        : Number((0.2 + (index % 4) * 0.1).toFixed(6));
      record.canonical_payload = { ...record.canonical_payload, value };
      record.source_payload = { ...record.source_payload, value };
      record.source_record_hash = semanticHashV1({
        record_type: record.record_type,
        source_record_id: record.source_record_id,
        binding_id: record.binding_id,
        origin_source_id: record.origin_source_id,
        role_time: record.role_time,
        canonical_payload: record.canonical_payload,
      });
      record.dataset_id = "mcft_cap08_stage1a_replay_v2";
      record.limitations = [
        "CONTROLLED_SYNTHETIC",
        "FINAL_FORMAL_CLOSURE_INPUT",
        "MULTI_REGIME_RAINFALL_PROFILE",
        "NOT_FIELD_CALIBRATED",
      ];
      return record;
    });
}

function binding(name: string): Cap08S4T17ObjectBindingV1 {
  return { ref: `object_${name}`, hash: semanticHashV1({ name }) };
}

async function main(): Promise<void> {
  const state = readJson(STATE);
  const sql = readJson(SQL);
  const matrix = readJson(MATRIX);
  const boundary = readJson(BOUNDARY);
  const freeze = readJson(FREEZE);
  for (const value of [state, sql, matrix, boundary]) {
    assert.equal(value.semantic_digest, semanticDigest(value));
  }

  const base = String(process.env.MCFT_BASE_SHA || boundary.base_main_sha).trim();
  assert.equal(base, boundary.base_main_sha);
  assert.equal(git("merge-base", base, "HEAD"), base);
  assert.equal(git("diff", "--check", `${base}...HEAD`), "");
  const changed = git("diff", "--name-only", `${base}...HEAD`)
    .split(/\r?\n/).filter(Boolean).sort();
  assert.deepEqual(changed, [...boundary.changed_files].sort());
  assert.equal(changed.length, boundary.changed_file_count);
  assert.equal(changed.some((value) => value.includes("/migrations/")), false);
  assert.equal(changed.some((value) => value.includes("qualification_ports")), false);
  assert.equal(changed.some((value) => /EXECUTION-AUTHORITY-V\d+\.json$/.test(value)), false);
  assert.equal(changed.some((value) => value.startsWith("apps/server/src/persistence/")), false);
  assert.deepEqual(
    changed.filter((value) => value.startsWith("apps/server/")).sort(),
    [
      "apps/server/src/domain/twin_runtime/cap08_t17_transition_contracts_v1.ts",
      "apps/server/src/domain/twin_runtime/cap08_t17_transition_witness_identity_v1.ts",
      "apps/server/src/runtime/twin_runtime/cap08_t17_transition_persistence_port_v1.ts",
    ],
  );

  assert.equal(freeze.record_status, "STAGE_1A_END_TO_END_CLOSURE_NOT_ESTABLISHED");
  assert.equal(freeze.formal_authority_chain_status, "PAUSED");
  assert.equal(state.formal_authority_chain_status, "PAUSED");
  assert.equal(boundary.formal_authority_chain_status, "PAUSED");
  assert.equal(boundary.product_runtime_implementation_delta, 0);
  assert.equal(boundary.generic_cap04_modification_delta, 0);
  assert.equal(boundary.persistence_implementation_delta, 0);
  assert.equal(boundary.migration_delta, 0);
  assert.equal(boundary.qualification_delta, 0);
  assert.equal(boundary.execution_authority_delta, 0);
  assert.equal(boundary.database_execution_performed, false);

  const fixture = buildCap08S2FormalProviderFixtureV1();
  const t17 = addHours(CAP08_S1_RUNTIME_START_V1, 17);
  const runtimeConfig = fixture.runtime_configs.find((value) => value.logical_time === t17);
  assert.ok(runtimeConfig, "T17_RUNTIME_CONFIG_REQUIRED");
  const configPayload = runtimeConfig.payload as any;
  const raw = await fixture.bootstrap_evidence_source.loadCandidateRecords({
    scope: fixture.scope,
    logical_time: t17,
  });
  const candidates = rewriteFrozenFinalForcing(raw as any[], t17);
  const preliminary = buildAssimilatedContinuationEvidenceWindowV2({
    scope: fixture.scope,
    logical_time: t17,
    candidate_records: candidates,
    saturation_fraction: configPayload.soil_hydraulic_snapshot.saturation_fraction,
    crop_stage_context_ref: configPayload.crop_stage_context.context_ref,
    crop_stage_context_hash: configPayload.crop_stage_context.context_hash,
    crop_stage_context: fixture.crop_stage_context,
  });
  const baseWindow = preliminary.base_continuation_window;
  const selector = selectCap04FutureForcingOutcomeV1({
    scope: fixture.scope,
    logical_time: t17,
    candidate_records: candidates,
    authorized_binding_ids: ["binding_weather", "binding_et0"],
    crop_stage_context: {
      ref: configPayload.crop_stage_context.context_ref,
      hash: configPayload.crop_stage_context.context_hash,
      crop_stage_code: baseWindow.crop_stage_context.stage_code,
      kc: baseWindow.crop_stage_context.kc,
    },
    runtime_config: {
      ref: runtimeConfig.object_id,
      hash: runtimeConfig.determinism_hash,
    },
  });
  assertCap08S4T17FormalA1OutcomeV1(selector.status);
  assert.equal(selector.status, "SELECTED");

  const forcingHashes = candidates
    .filter((record) => ["binding_weather", "binding_et0"].includes(record.binding_id))
    .map((record) => record.source_record_hash)
    .sort();
  const proofBasis = {
    schema_version: CAP08_S4_T17_FORMAL_A1_PROOF_SCHEMA_VERSION_V1,
    dataset_id: "mcft_cap08_stage1a_replay_v2" as const,
    profile_id: "MULTI_REGIME_RAINFALL_PLUS_FORECAST_DERIVED_HIDDEN_0034_FVO_V1" as const,
    outcome_profile_id: "FVO10_FROZEN_BUSINESS_OUTCOME_ANCHOR_V1" as const,
    t17_logical_time: t17,
    authorized_binding_ids: ["binding_et0", "binding_weather"] as const,
    forcing_relevant_record_hashes: forcingHashes,
    runtime_config: { ref: runtimeConfig.object_id, hash: runtimeConfig.determinism_hash },
    crop_stage_context: {
      ref: configPayload.crop_stage_context.context_ref,
      hash: configPayload.crop_stage_context.context_hash,
      crop_stage_code: baseWindow.crop_stage_context.stage_code,
      kc: baseWindow.crop_stage_context.kc,
    },
    selector_status: "SELECTED" as const,
    selected_window_hash: semanticHashV1(selector.window),
    selection_trace_hash: semanticHashV1(selector.trace),
    formal_outcome: CAP08_S4_T17_FORMAL_OUTCOME_V1,
    a2_scope_status: CAP08_S4_T17_A2_SCOPE_STATUS_V1,
  };
  const proof: Cap08S4T17FormalA1ProofV1 = {
    ...proofBasis,
    determinism_hash: semanticHashV1(proofBasis),
  };
  validateCap08S4T17FormalA1ProofV1(proof);

  const blocked = selectCap04FutureForcingOutcomeV1({
    scope: fixture.scope,
    logical_time: t17,
    candidate_records: candidates.filter((record) => record.binding_id !== "binding_weather"),
    authorized_binding_ids: ["binding_weather", "binding_et0"],
    crop_stage_context: {
      ref: configPayload.crop_stage_context.context_ref,
      hash: configPayload.crop_stage_context.context_hash,
      crop_stage_code: baseWindow.crop_stage_context.stage_code,
      kc: baseWindow.crop_stage_context.kc,
    },
    runtime_config: {
      ref: runtimeConfig.object_id,
      hash: runtimeConfig.determinism_hash,
    },
  });
  assert.notEqual(blocked.status, "SELECTED");
  assert.throws(
    () => assertCap08S4T17FormalA1OutcomeV1(blocked.status),
    /FORMAL_DATASET_INVARIANT_VIOLATION/,
  );

  const witnessInput: Cap08S4T17TransitionWitnessInputV1 = {
    uniqueness_key: {
      transition_kind: CAP08_S4_T17_TRANSITION_KIND_V1,
      formal_run_id: "formal_run_a",
      scope: fixture.scope,
      lineage_id: "lineage_example",
      revision_id: "revision_example",
      t17_logical_time: t17,
    },
    correction_authority: {
      authority_ref: "authority_s4_t16",
      authority_hash: semanticHashV1({ authority: "s4_t16" }),
    },
    expected_latest_base: {
      state: binding("base_state"),
      checkpoint: binding("base_checkpoint"),
      forecast_result: binding("base_forecast"),
      successful_forecast: binding("base_success"),
    },
    corrected_computation_predecessor: {
      state: binding("corrected_state"),
      checkpoint: binding("corrected_checkpoint"),
      forecast_result: binding("corrected_forecast"),
      successful_forecast: binding("corrected_forecast"),
      scenario_set: binding("corrected_scenario"),
      previous_tick_sequence: 17,
    },
    committed_t17: {
      record_set_id: "record_set_t17",
      aggregate_determinism_hash: semanticHashV1({ record_set: "t17" }),
      state: binding("t17_state"),
      checkpoint: binding("t17_checkpoint"),
      forecast_result: binding("t17_forecast"),
      successful_forecast: binding("t17_forecast"),
    },
  };
  const witnessA = deriveCap08S4T17TransitionWitnessV1(witnessInput);
  const witnessB = deriveCap08S4T17TransitionWitnessV1(structuredClone(witnessInput));
  assert.deepEqual(witnessA, witnessB);
  assert.equal(cap08S4T17TransitionWitnessFactIdV1(witnessA), `fact_${witnessA.transition_id}`);

  const conflictInput = structuredClone(witnessInput);
  conflictInput.committed_t17.aggregate_determinism_hash = semanticHashV1({ record_set: "different" });
  const witnessConflict = deriveCap08S4T17TransitionWitnessV1(conflictInput);
  assert.equal(witnessConflict.transition_id, witnessA.transition_id);
  assert.equal(witnessConflict.idempotency_key, witnessA.idempotency_key);
  assert.notEqual(witnessConflict.determinism_hash, witnessA.determinism_hash);

  assert.equal(classifyCap08S4T17ExistingTransitionV1({
    record_set_presence: "EXACT",
    witness_presence: "EXACT",
    transition_guard_presence: "EXACT",
    latest_projection_state: "EXACT_T17",
  }), "EXISTING_IDEMPOTENT_SUCCESS");
  assert.equal(classifyCap08S4T17ExistingTransitionV1({
    record_set_presence: "EXACT",
    witness_presence: "EXACT",
    transition_guard_presence: "EXACT",
    latest_projection_state: "BASE_T16",
  }), "POST_TRANSITION_PROJECTION_DIVERGENCE");
  assert.equal(classifyCap08S4T17ExistingTransitionV1({
    record_set_presence: "EXACT",
    witness_presence: "ABSENT",
    transition_guard_presence: "EXACT",
    latest_projection_state: "BASE_T16",
  }), "PARTIAL_TRANSITION_CORRUPTION");

  assert.deepEqual(CAP08_S4_T17_SERIALIZATION_RETRY_POLICY_V1, {
    retryable_sqlstate: "40001",
    max_attempts: 3,
    retry_delays_ms: [25, 100],
    retry_scope: "FULL_TRANSACTION_FROM_BEGIN",
    reacquire_connection_each_attempt: true,
    reacquire_advisory_lock_each_attempt: true,
    replay_classification_each_attempt: true,
    reuse_transaction_state: false,
    jitter_allowed: false,
    exhaustion_error: "SERIALIZABLE_RETRY_EXHAUSTED",
  });
  assert.deepEqual(sql.retry_policy, {
    retryable_sqlstate: "40001",
    max_attempts: 3,
    retry_delays_ms: [25, 100],
    full_transaction_restart: true,
    connection_reacquired: true,
    advisory_lock_reacquired: true,
    replay_classification_repeated: true,
    transaction_state_reuse: false,
    jitter_allowed: false,
    exhaustion_error: "SERIALIZABLE_RETRY_EXHAUSTED",
  });
  assert.equal(
    state.exact_transition_projection_rule.latest_not_exact_t17,
    "POST_TRANSITION_PROJECTION_DIVERGENCE",
  );
  assert.equal(state.exact_transition_projection_rule.automatic_repair_authorized, false);
  assert.ok(matrix.cases.some((value: any) =>
    value.expected === "POST_TRANSITION_PROJECTION_DIVERGENCE"));
  assert.ok(matrix.cases.some((value: any) =>
    value.expected === "SERIALIZABLE_RETRY_EXHAUSTED"));

  const finalSource = text(FINAL_SOURCE);
  assert.match(finalSource, /DATASET_ID='mcft_cap08_stage1a_replay_v2'/);
  assert.match(finalSource, /index>=8\?Number\(\(5\.2\+\(index%4\)\*0\.2\)\.toFixed\(6\)\)/);
  const productChain = text(PRODUCT_CHAIN);
  assert.match(productChain, /authorized_future_forcing_binding_ids:\['binding_weather','binding_et0'\]/);
  const adr = text(ADR);
  assert.match(adr, /authority-bound/);
  assert.match(adr, /dual-predecessor/);
  assert.match(adr, /A1-only/);
  assert.match(adr, /POST_TRANSITION_PROJECTION_DIVERGENCE/);
  assert.match(adr, /SERIALIZABLE_RETRY_EXHAUSTED/);

  const workflow = text(WORKFLOW);
  assert.match(workflow, /pull_request:/);
  assert.doesNotMatch(workflow, /workflow_dispatch:/);
  assert.doesNotMatch(workflow, /services:\s*\n\s*postgres:/);
  assert.doesNotMatch(workflow, /DATABASE_URL/);
  assert.match(workflow, /pnpm exec tsx/);

  const protectedFiles = [
    "apps/server/src/runtime/twin_runtime/forecast_scenario_single_tick_service_v1.ts",
    "apps/server/src/runtime/twin_runtime/forecast_scenario_persistence_ports_v1.ts",
    "apps/server/src/persistence/twin_runtime/postgres_forecast_scenario_repository_v1.ts",
    "apps/server/src/persistence/twin_runtime/postgres_cap08_s4_append_forward_repository_v1.ts",
    "apps/server/src/runtime/twin_runtime/cap08_s4_t17_corrected_predecessor_resolver_v1.ts",
    FREEZE,
  ];
  for (const protectedFile of protectedFiles) {
    assert.equal(git("rev-parse", `${base}:${protectedFile}`), git("rev-parse", `HEAD:${protectedFile}`));
  }

  const result = {
    schema_version: "geox_mcft_cap08_s4_t17_product_timeline_adjudication_result_v1",
    status: "PASS",
    subject_sha: git("rev-parse", "HEAD"),
    base_sha: base,
    changed_file_count: changed.length,
    t17_a1_invariant_status: "PASS",
    t17_a1_proof_digest: proof.determinism_hash,
    negative_a2_fail_closed_status: "PASS",
    transition_identity_status: "PASS",
    post_transition_projection_divergence_status: "PASS",
    serialization_retry_policy_status: "PASS",
    product_runtime_implementation_delta: 0,
    migration_delta: 0,
    database_execution_performed: false,
    formal_authority_chain_status: "PAUSED",
  };
  write(result);
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  const value = error instanceof Error ? error.stack || error.message : String(error);
  write({
    schema_version: "geox_mcft_cap08_s4_t17_product_timeline_adjudication_result_v1",
    status: "FAIL",
    error: value,
  });
  console.error(error);
  process.exitCode = 1;
});
