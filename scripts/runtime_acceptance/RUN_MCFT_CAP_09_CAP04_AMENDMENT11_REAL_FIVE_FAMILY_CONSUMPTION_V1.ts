import fs from "node:fs";
import path from "node:path";
import { Pool } from "pg";

import type { CanonicalObjectEnvelopeV1 } from "../../apps/server/src/domain/twin_runtime/canonical_object_contracts_v1.js";
import {
  MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1,
  compileExternalFormalRuntimeConfigV1,
  type CompileExternalFormalRuntimeConfigInputV1,
} from "../../apps/server/src/domain/twin_runtime/external_formal_runtime_config_v1.js";
import { executeExternalFormalCap04Amendment11CandidateV1 } from "../../apps/server/src/runtime/twin_runtime/external_formal_cap04_amendment11_candidate_execution_service_v1.js";
import { PostgresExternalFormalEvidenceSourceV1 } from "../../apps/server/src/runtime/twin_runtime/postgres_external_formal_evidence_source_v1.js";
import type { PreparedNextTickInputV1 } from "../../apps/server/src/runtime/twin_runtime/ports.js";
import {
  EA5B5B_CONFIG_MATRIX_HASH_V1,
  EA5B5B_CONFIG_MATRIX_REF_V1,
  EA5B5B_CROP_CONTEXT_HASH_V1,
  EA5B5B_CROP_CONTEXT_REF_V1,
  EA5B5B_REALITY_HASH_V1,
  EA5B5B_REALITY_REF_V1,
  buildEa5b5bExternalFixtureV1,
} from "./mcft_cap09_ea5b5b_external_fixture_v1.js";

const OUTPUT_DIR = path.resolve("acceptance-output");
const OUTPUT = path.join(OUTPUT_DIR, "MCFT_CAP_09_CAP04_AMENDMENT11_REAL_FIVE_FAMILY_CONSUMPTION.json");
const EXPECTED_TYPES = [
  "future_et0_assumption_v1",
  "future_weather_assumption_v1",
  "historical_et0_estimate_v1",
  "observed_rainfall_v1",
  "soil_moisture_observation_v1",
] as const;

type FiveFamilyProofV1 = {
  schema_version: string;
  status: string;
  subject_sha: string;
  target_t: string;
  temporal_authority: string;
  kbs_external_five_family_data_path_qualified: boolean;
  isolated_database_fact_count: number;
  record_types: string[];
  kbs_raw_retained_before_decode: boolean;
  kbs_provider_request_count: number;
  kbs_provider_retry_count: number;
  kbs_source_substitution_allowed: boolean;
  private_transient_cleanup_confirmed: boolean;
  cap04_runtime_successor_qualified: boolean;
  crop_authority_effect: string;
  formal_effect: boolean;
};

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name}_REQUIRED`);
  return value;
}

function canonicalIso(value: string, code: string): string {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== value) throw new Error(code);
  return value;
}

function exactHour(value: string, code: string): string {
  canonicalIso(value, code);
  if (!value.endsWith(":00:00.000Z")) throw new Error(code);
  return value;
}

function addHours(value: string, hours: number): string {
  return new Date(Date.parse(value) + hours * 3_600_000).toISOString();
}

function assertExactMain(subject: string): void {
  if (!["push", "workflow_dispatch"].includes(process.env.GITHUB_EVENT_NAME ?? "") || process.env.GITHUB_REF !== "refs/heads/main" || process.env.GITHUB_SHA !== subject) {
    throw new Error("MCFT_CAP09_CAP04_A11_REAL_FIVE_FAMILY_EXACT_MAIN_REQUIRED");
  }
}

function assertIsolatedDb(urlText: string): void {
  if (process.env.MCFT_CAP09_CAP04_A11_REAL_FIVE_FAMILY_ISOLATED_DB_ACK !== "true") throw new Error("MCFT_CAP09_CAP04_A11_REAL_FIVE_FAMILY_ISOLATED_DB_ACK_REQUIRED");
  const url = new URL(urlText);
  if (!["127.0.0.1", "localhost"].includes(url.hostname) || url.pathname.replace(/^\//, "") !== "ea5e2_readiness") {
    throw new Error("MCFT_CAP09_CAP04_A11_REAL_FIVE_FAMILY_LOCAL_DB_REQUIRED");
  }
}

const formalAuthorities: CompileExternalFormalRuntimeConfigInputV1["formal_authorities"] = {
  site: {
    ref: "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S6-FORMAL-SITE-AUTHORITY-V1.json",
    hash: "ea5b5b-qualification-site-authority",
  },
  reality: {
    ref: "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S6-FORMAL-REALITY-BINDING-V1.json",
    hash: "ea5b5b-qualification-reality-authority",
  },
  source_binding_matrix: {
    ref: "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S6-FORMAL-SOURCE-BINDING-MATRIX-V1.json",
    hash: "ea5b5b-qualification-source-authority",
  },
  crop_context: {
    ref: "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S6-FORMAL-CROP-CONTEXT-AUTHORITY-V1.json",
    hash: "ea5b5b-qualification-crop-authority",
  },
  recovery: {
    ref: "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA4-RECOVERY-AUTHORITY-V1.json",
    hash: "ea5b5b-qualification-recovery-authority",
  },
  fresh_database: {
    ref: "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA5A-FRESH-FORMAL-DATABASE-PREFLIGHT-V1.json",
    hash: "ea5b5b-qualification-fresh-db-authority",
  },
};

function runtimeInput(role: "A0_BOOTSTRAP" | "HOURLY_CAP04", target: string, createdAt: string): CompileExternalFormalRuntimeConfigInputV1 {
  return {
    scope: { ...MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1 },
    config_role: role,
    effective_logical_time: role === "A0_BOOTSTRAP" ? addHours(target, -1) : target,
    created_at: createdAt,
    parent_runtime_config_ref: null,
    parent_runtime_config_hash: null,
    reality_binding_ref: EA5B5B_REALITY_REF_V1,
    reality_binding_hash: EA5B5B_REALITY_HASH_V1,
    source_matrix_ref: "GEOX-MCFT-CAP-09-S6-FORMAL-SOURCE-BINDING-MATRIX-V1",
    source_matrix_hash: "sha256:ea5b5b-qualification-source-matrix",
    configuration_matrix_ref: EA5B5B_CONFIG_MATRIX_REF_V1,
    configuration_matrix_hash: EA5B5B_CONFIG_MATRIX_HASH_V1,
    geometry_semantic_hash: "sha256:ea5b5b-qualification-explicit-geometry-input",
    formal_authorities: structuredClone(formalAuthorities),
    crop_stage_context_authority: {
      context_ref: EA5B5B_CROP_CONTEXT_REF_V1,
      context_hash: EA5B5B_CROP_CONTEXT_HASH_V1,
      configuration_matrix_ref: EA5B5B_CONFIG_MATRIX_REF_V1,
      configuration_matrix_hash: EA5B5B_CONFIG_MATRIX_HASH_V1,
    },
    model_prior: {
      source_ref: EA5B5B_CONFIG_MATRIX_REF_V1,
      source_hash: EA5B5B_CONFIG_MATRIX_HASH_V1,
    },
  };
}

function buildRuntimePair(target: string, createdAt: string) {
  const a0 = compileExternalFormalRuntimeConfigV1(runtimeInput("A0_BOOTSTRAP", target, createdAt));
  const hourlyInput = runtimeInput("HOURLY_CAP04", target, createdAt);
  hourlyInput.parent_runtime_config_ref = a0.object_id;
  hourlyInput.parent_runtime_config_hash = a0.determinism_hash;
  const hourly = compileExternalFormalRuntimeConfigV1(hourlyInput);
  return { a0, hourly };
}

function handoff(target: string, parent: CanonicalObjectEnvelopeV1, current: CanonicalObjectEnvelopeV1): PreparedNextTickInputV1 {
  return {
    ...MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1,
    active_lineage_ref: "qualification://cap04-a11-real-five-family/lineage",
    previous_posterior_ref: "qualification://cap04-a11-real-five-family/previous-state",
    previous_posterior_hash: "sha256:cap04-a11-real-five-family-previous-state",
    previous_checkpoint_ref: "qualification://cap04-a11-real-five-family/previous-checkpoint",
    previous_checkpoint_hash: "sha256:cap04-a11-real-five-family-previous-checkpoint",
    previous_forecast_result_ref: "qualification://cap04-a11-real-five-family/previous-forecast",
    previous_forecast_result_hash: "sha256:cap04-a11-real-five-family-previous-forecast",
    latest_successful_forecast_ref: "qualification://cap04-a11-real-five-family/previous-successful-forecast",
    lineage_id: "qualification_cap04_a11_real_five_family_lineage",
    revision_id: "qualification_cap04_a11_real_five_family_revision",
    prior_mean: 0.3,
    prior_variance: 0.001,
    previous_storage_mm_decimal: "90.000000",
    previous_variance_basis: {
      basis_origin: "CARRIED_FROM_PREVIOUS_CONTINUATION_STATE",
      previous_state_ref: "qualification://cap04-a11-real-five-family/previous-state",
      previous_storage_variance_mm2_decimal: "4.000000000000",
    },
    previous_tick_sequence: 48,
    next_logical_tick_time: target,
    previous_state_runtime_config_ref: parent.object_id,
    previous_state_runtime_config_hash: parent.determinism_hash,
    reality_binding_ref: String(current.payload.reality_binding_ref),
    reality_binding_hash: String(current.payload.reality_binding_hash),
  };
}

function readFiveFamilyProof(file: string, subject: string, target: string): FiveFamilyProofV1 {
  const proof = JSON.parse(fs.readFileSync(file, "utf8")) as FiveFamilyProofV1;
  if (proof.schema_version !== "geox_mcft_cap09_kbs_external_five_family_data_path_v1" || proof.status !== "PASS" || proof.subject_sha !== subject || proof.target_t !== target || proof.temporal_authority !== "PROVIDER_AVAILABILITY_WATERMARK_V1") {
    throw new Error("MCFT_CAP09_CAP04_A11_REAL_FIVE_FAMILY_UPSTREAM_PROOF_IDENTITY_INVALID");
  }
  if (proof.kbs_external_five_family_data_path_qualified !== true || proof.isolated_database_fact_count !== 5 || JSON.stringify([...proof.record_types].sort()) !== JSON.stringify([...EXPECTED_TYPES].sort())) {
    throw new Error("MCFT_CAP09_CAP04_A11_REAL_FIVE_FAMILY_UPSTREAM_PACKAGE_INVALID");
  }
  if (proof.kbs_raw_retained_before_decode !== true || proof.kbs_provider_request_count !== 1 || proof.kbs_provider_retry_count !== 0 || proof.kbs_source_substitution_allowed !== false || proof.private_transient_cleanup_confirmed !== true) {
    throw new Error("MCFT_CAP09_CAP04_A11_REAL_FIVE_FAMILY_UPSTREAM_KBS_BOUNDARY_INVALID");
  }
  if (proof.cap04_runtime_successor_qualified !== false || proof.crop_authority_effect !== "NONE" || proof.formal_effect !== false) {
    throw new Error("MCFT_CAP09_CAP04_A11_REAL_FIVE_FAMILY_UPSTREAM_NONCLAIMS_INVALID");
  }
  return proof;
}

function selftest(): void {
  exactHour("2026-08-13T15:00:00.000Z", "MCFT_CAP09_CAP04_A11_REAL_FIVE_FAMILY_SELFTEST_TARGET");
  canonicalIso("2026-08-14T05:00:00.000Z", "MCFT_CAP09_CAP04_A11_REAL_FIVE_FAMILY_SELFTEST_SNAPSHOT");
  if (EXPECTED_TYPES.length !== 5 || addHours("2026-08-13T15:00:00.000Z", -1) !== "2026-08-13T14:00:00.000Z") throw new Error("MCFT_CAP09_CAP04_A11_REAL_FIVE_FAMILY_SELFTEST_DRIFT");
  console.log(JSON.stringify({
    status: "PASS",
    temporal_authority: "PROVIDER_AVAILABILITY_WATERMARK_V1",
    exact_five_family_required: true,
    caller_supplied_evidence_snapshot_required: true,
    provider_fetch_inside_cap04: false,
    database_write_inside_cap04: false,
    qualification_crop_context_only: true,
    crop_authority_effect: "NONE",
    operational_activation_effect: false,
  }));
}

async function main(): Promise<void> {
  if (process.argv[2] === "selftest") return selftest();
  if (process.argv[2] !== "run") throw new Error("MCFT_CAP09_CAP04_A11_REAL_FIVE_FAMILY_MODE_REQUIRED");

  const subject = required("MCFT_CAP09_SUBJECT_SHA");
  if (!/^[0-9a-f]{40}$/.test(subject)) throw new Error("MCFT_CAP09_CAP04_A11_REAL_FIVE_FAMILY_SUBJECT_SHA_INVALID");
  assertExactMain(subject);
  const target = exactHour(required("MCFT_CAP09_CAP04_A11_TARGET_T"), "MCFT_CAP09_CAP04_A11_REAL_FIVE_FAMILY_TARGET_INVALID");
  readFiveFamilyProof(required("MCFT_CAP09_FIVE_FAMILY_PROOF_PATH"), subject, target);

  const databaseUrl = required("DATABASE_URL");
  assertIsolatedDb(databaseUrl);
  const pool = new Pool({ connectionString: databaseUrl, application_name: "mcft-cap09-cap04-a11-real-five-family" });
  try {
    const evidenceSnapshot = new Date().toISOString();
    const loaded = await new PostgresExternalFormalEvidenceSourceV1(pool).loadCandidateRecords({
      scope: { ...MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1 },
      logical_time: target,
      evidence_snapshot_time: evidenceSnapshot,
    });
    if (loaded.selected_record_count !== 5 || loaded.database_write_count !== 0 || loaded.provider_request_count !== 0) throw new Error("MCFT_CAP09_CAP04_A11_REAL_FIVE_FAMILY_DB_SOURCE_INVALID");
    if (JSON.stringify(loaded.family_cardinality) !== JSON.stringify({ soil: 1, rainfall: 1, historical_et0: 1, future_weather: 1, future_et0: 1 })) throw new Error("MCFT_CAP09_CAP04_A11_REAL_FIVE_FAMILY_CARDINALITY_INVALID");
    const loadedTypes = loaded.records.map((record) => record.record_type).sort();
    if (JSON.stringify(loadedTypes) !== JSON.stringify([...EXPECTED_TYPES])) throw new Error("MCFT_CAP09_CAP04_A11_REAL_FIVE_FAMILY_RECORD_SET_INVALID");

    const fixture = await buildEa5b5bExternalFixtureV1();
    if (fixture.crop.determinism_hash !== EA5B5B_CROP_CONTEXT_HASH_V1) throw new Error("MCFT_CAP09_CAP04_A11_REAL_FIVE_FAMILY_QUALIFICATION_CROP_DRIFT");
    const { a0, hourly } = buildRuntimePair(target, evidenceSnapshot);
    const candidate = executeExternalFormalCap04Amendment11CandidateV1({
      scope: { ...MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1 },
      logical_time: target,
      created_at: evidenceSnapshot,
      evidence_snapshot_time: evidenceSnapshot,
      handoff: handoff(target, a0, hourly),
      runtime_config: hourly,
      candidate_records: loaded.records,
      crop_stage_context: fixture.crop,
    });

    if (candidate.service_id !== "MCFT_CAP09_EXTERNAL_FORMAL_CAP04_AMENDMENT11_CANDIDATE_EXECUTION_SERVICE_V1" || candidate.evidence_snapshot_time !== evidenceSnapshot || candidate.evidence_snapshot_source !== "CALLER_SUPPLIED") throw new Error("MCFT_CAP09_CAP04_A11_REAL_FIVE_FAMILY_SUCCESSOR_IDENTITY_INVALID");
    if (candidate.operation_variant !== "A1" || candidate.forcing_outcome.status !== "SELECTED" || candidate.forecast_authority.forecast_candidate.status !== "COMPLETED" || candidate.forecast_authority.forecast_candidate.points.length !== 72) throw new Error("MCFT_CAP09_CAP04_A11_REAL_FIVE_FAMILY_FORECAST_INVALID");
    if (candidate.canonical_persistence_authorized !== false || candidate.provider_request_count !== 0 || candidate.database_write_count !== 0 || candidate.scenario_write_count !== 0 || candidate.recommendation_write_count !== 0 || candidate.action_write_count !== 0) throw new Error("MCFT_CAP09_CAP04_A11_REAL_FIVE_FAMILY_SIDE_EFFECT_INVALID");

    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    const proof = {
      schema_version: "geox_mcft_cap09_cap04_amendment11_real_five_family_consumption_v1",
      status: "PASS",
      subject_sha: subject,
      temporal_authority: "PROVIDER_AVAILABILITY_WATERMARK_V1",
      target_t: target,
      evidence_snapshot_time: evidenceSnapshot,
      evidence_snapshot_source: "CALLER_SUPPLIED",
      upstream_kbs_external_five_family_data_path_qualified: true,
      isolated_database_selected_record_count: loaded.selected_record_count,
      isolated_database_family_cardinality: loaded.family_cardinality,
      isolated_database_record_types: loadedTypes,
      external_cap04_service_id: candidate.service_id,
      external_cap04_operation_variant: candidate.operation_variant,
      external_cap04_forcing_status: candidate.forcing_outcome.status,
      external_cap04_forecast_status: candidate.forecast_authority.forecast_candidate.status,
      external_cap04_forecast_point_count: candidate.forecast_authority.forecast_candidate.points.length,
      caller_supplied_evidence_snapshot_honored: true,
      fixed_432_fallback_exposed_at_public_seam: false,
      provider_request_count_inside_cap04: candidate.provider_request_count,
      database_write_count_inside_cap04: loaded.database_write_count + candidate.database_write_count,
      canonical_persistence_authorized: candidate.canonical_persistence_authorized,
      qualification_crop_context_only: true,
      crop_authority_effect: "NONE",
      cap04_runtime_successor_qualified: true,
      cap04_runtime_successor_qualification_scope: "REAL_EXTERNAL_FIVE_FAMILY_CONSUMPTION_IN_ISOLATED_DB_WITH_QUALIFICATION_ONLY_CROP_CONTEXT",
      formal_database_write_count: 0,
      formal_r2_prefix_write_count: 0,
      scheduler_write_count: 0,
      runtime_write_count: 0,
      formal_effect: false,
      ea5e2_operational_activation_qualified: false,
      full_operational_go: false,
      raw_values_emitted: false,
    };
    fs.writeFileSync(OUTPUT, JSON.stringify(proof, null, 2) + "\n");
    console.log(JSON.stringify(proof));
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
});
