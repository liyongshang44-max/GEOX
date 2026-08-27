import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { Pool } from "pg";

import { ASSIMILATED_CONTINUATION_OBSERVATION_QUANTITY_KIND_V1 } from "../../apps/server/src/domain/twin_runtime/assimilated_continuation_runtime_config_v1.js";
import { semanticHashV1 } from "../../apps/server/src/domain/twin_runtime/canonical_identity_v1.js";
import { MCFT_CAP09_EXTERNAL_FORMAL_SOIL_BINDING_ID_V1 } from "../../apps/server/src/domain/twin_runtime/external_formal_evidence_binding_profile_v1.js";
import { MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1 } from "../../apps/server/src/domain/twin_runtime/external_formal_runtime_config_v1.js";
import {
  buildExternalFormalAmendment19WindowManifestV1,
  validateExternalFormalAmendment19WindowManifestV1,
} from "../../apps/server/src/domain/twin_runtime/external_formal_amendment19_window_manifest_v1.js";
import {
  buildExternalFormalPrewindowAuthorityBundleV3,
  MCFT_CAP09_AM19_FRESH_STORE_AUTHORITY_BLOB_V3,
  MCFT_CAP09_AM19_FRESH_STORE_AUTHORITY_REF_V3,
} from "../../apps/server/src/domain/twin_runtime/external_formal_prewindow_authority_bundle_v3.js";
import { PostgresNextTickRepositoryV1 } from "../../apps/server/src/persistence/twin_runtime/postgres_next_tick_repository_v1.js";
import { PostgresRuntimeRepositoryV1 } from "../../apps/server/src/persistence/twin_runtime/postgres_runtime_repository_v1.js";
import {
  MCFT_CAP09_A18_CROP_CONTEXT_MATERIALIZATION_PROFILE_V3,
  materializeExternalFormalA18CropContextV3,
} from "../../apps/server/src/runtime/twin_runtime/external_formal_a18_crop_context_v3.js";
import { ExternalFormalBootstrapPersistenceServiceV1 } from "../../apps/server/src/runtime/twin_runtime/external_formal_bootstrap_persistence_service_v1.js";
import type { ExternalFormalV3Am19WindowManifestV1 } from "../../apps/server/src/runtime/twin_runtime/external_formal_v3_amendment19_runner_v1.js";
import type {
  CanonicalReplayEvidenceRecordV1,
  ReplayEvidenceSourcePortV1,
  TwinScopeKeyV1,
} from "../../apps/server/src/runtime/twin_runtime/ports.js";

const CROP_AUTHORITY_PATH = path.resolve(
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S6-FORMAL-CROP-CONTEXT-AUTHORITY-V3.json",
);
const MATRIX_PATH = path.resolve(
  "docs/digital_twin/mcft/GEOX-MCFT-00-CONFIGURATION-BINDING-MATRIX.json",
);

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error("PHASE5_PREPARE_ENV_REQUIRED:" + name);
  return value;
}

function canonicalIso(value: string, code: string): string {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== value) {
    throw new Error(code);
  }
  return value;
}

function canonicalHour(value: string, code: string): string {
  const out = canonicalIso(value, code);
  if (!out.endsWith(":00:00.000Z")) throw new Error(code);
  return out;
}

function addMinutes(value: string, minutes: number): string {
  return new Date(Date.parse(value) + minutes * 60_000).toISOString();
}

function loadJson(file: string): Record<string, unknown> {
  const value = JSON.parse(fs.readFileSync(file, "utf8")) as unknown;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("PHASE5_PREPARE_JSON_OBJECT_REQUIRED:" + file);
  }
  return value as Record<string, unknown>;
}

function controlledBootstrapSoilV1(a0: string): CanonicalReplayEvidenceRecordV1 {
  const observedAt = addMinutes(a0, -5);
  const availableAt = addMinutes(a0, -4);
  const canonicalPayload = {
    quantity_kind: ASSIMILATED_CONTINUATION_OBSERVATION_QUANTITY_KIND_V1,
    unit: "fraction",
    value: 0.30,
  };
  const sourceId = "phase5_controlled_bootstrap_soil_" + a0;
  return {
    dataset_id: "mcft_cap09_phase5_bootstrap_engineering_fixture_v1",
    source_record_id: sourceId,
    source_record_hash: semanticHashV1({
      sourceId,
      observedAt,
      availableAt,
      canonicalPayload,
    }),
    record_type: "soil_moisture_observation_v1",
    binding_id: MCFT_CAP09_EXTERNAL_FORMAL_SOIL_BINDING_ID_V1,
    origin_source_kind: "CONTROLLED_PHASE5_BOOTSTRAP_FIXTURE",
    origin_source_id: "PHASE5_BOOTSTRAP_SOIL_FIXTURE",
    epistemic_class: "OBSERVED",
    ...MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1,
    available_to_runtime_at: availableAt,
    role_time: { observed_at: observedAt, ingested_at: availableAt },
    quality: { status: "PASS" },
    source_payload: {
      source_version: "phase5-bootstrap-v1",
      unit: "fraction",
      value: 0.30,
    },
    canonical_payload: canonicalPayload,
    source_unit: "fraction",
    canonical_unit: "fraction",
    conversion_rule: { id: "VWC_FRACTION_IDENTITY_V1", version: "1" },
    limitations: [
      "ENGINEERING_BOOTSTRAP_FIXTURE_ONLY",
      "NOT_RUNTIME_EXTERNAL_EVIDENCE_AUTHORITY",
    ],
  };
}

function materializationHash(
  materialized: ReturnType<typeof materializeExternalFormalA18CropContextV3>,
): string {
  return semanticHashV1({
    materialization_profile: MCFT_CAP09_A18_CROP_CONTEXT_MATERIALIZATION_PROFILE_V3,
    context_ref: materialized.context_ref,
    context_identity_hash: materialized.context_identity_hash,
    materialized_context: materialized.context,
  });
}

class ControlledA0SourceV1 implements ReplayEvidenceSourcePortV1 {
  private readonly record: CanonicalReplayEvidenceRecordV1;

  constructor(private readonly a0: string) {
    this.record = controlledBootstrapSoilV1(a0);
  }

  async loadCandidateRecords(input: {
    scope: TwinScopeKeyV1;
    logical_time: string;
  }): Promise<readonly CanonicalReplayEvidenceRecordV1[]> {
    if (input.logical_time !== this.a0) {
      throw new Error("PHASE5_PREPARE_A0_SOURCE_EXACT_TIME_REQUIRED");
    }
    for (const key of [
      "tenant_id",
      "project_id",
      "group_id",
      "field_id",
      "season_id",
      "zone_id",
    ] as const) {
      if (input.scope[key] !== MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1[key]) {
        throw new Error("PHASE5_PREPARE_A0_SOURCE_SCOPE_MISMATCH:" + key);
      }
    }
    return [structuredClone(this.record)];
  }
}

async function main(): Promise<void> {
  const subject = requiredEnv("GEOX_DEPLOYMENT_SUBJECT_COMMIT");
  assert.match(subject, /^[0-9a-f]{40}$/);
  const a0 = canonicalHour(
    requiredEnv("GEOX_MCFT_CAP09_PHASE5_A0"),
    "PHASE5_PREPARE_A0_HOUR_REQUIRED",
  );
  const createdAt = canonicalIso(
    requiredEnv("GEOX_MCFT_CAP09_PHASE5_CREATED_AT"),
    "PHASE5_PREPARE_CREATED_AT_INVALID",
  );
  if (Date.parse(createdAt) > Date.parse(a0)) {
    throw new Error("PHASE5_PREPARE_CREATED_AFTER_A0_FORBIDDEN");
  }
  const outputPath = path.resolve(
    requiredEnv("GEOX_MCFT_CAP09_PHASE5_MANIFEST_OUTPUT"),
  );
  const proofPath = path.resolve(
    process.env.GEOX_MCFT_CAP09_PHASE5_PREPARE_PROOF_OUTPUT?.trim()
      || "acceptance-output/MCFT_CAP_09_PHASE5_PREPARE_24T_RESULT.json",
  );

  const pool = new Pool({
    connectionString: requiredEnv("DATABASE_URL"),
    max: 4,
  });
  try {
    const epoch =
      "mcft_cap09_phase5_two_service_"
      + a0.replace(/[^0-9]/g, "")
      + "_"
      + subject.slice(0, 12);
    const bundle = buildExternalFormalPrewindowAuthorityBundleV3({
      epoch_id: epoch,
      bootstrap_logical_time: a0,
      created_at: createdAt,
      bootstrap_crop_stage_code: "MID",
      hourly_crop_stage_codes: Array.from({ length: 24 }, () => "MID" as const),
      fresh_database_authority_ref: MCFT_CAP09_AM19_FRESH_STORE_AUTHORITY_REF_V3,
      fresh_database_authority_blob_sha: MCFT_CAP09_AM19_FRESH_STORE_AUTHORITY_BLOB_V3,
    });
    const cropAuthority = loadJson(CROP_AUTHORITY_PATH);
    const matrix = loadJson(MATRIX_PATH);
    const materializationPins = bundle.hourly_crop_pins.map((pin) => {
      const materialized = materializeExternalFormalA18CropContextV3({
        logical_time: pin.logical_time,
        expected_identity_hash: pin.crop_stage_context_hash,
        crop_authority: cropAuthority,
        configuration_matrix: matrix,
      });
      return {
        slot_id: pin.slot_id,
        logical_time: pin.logical_time,
        crop_stage_context_materialization_hash:
          materializationHash(materialized),
      };
    });

    const databaseName = String(
      (await pool.query("SELECT current_database() AS n")).rows[0]?.n ?? "",
    );
    const manifest = buildExternalFormalAmendment19WindowManifestV1({
      subject_sha: subject,
      database_name: databaseName,
      manifest_ref:
        "qualification://mcft-cap09/phase5/two-service/" + epoch,
      bundle,
      crop_context_materialization_pins: materializationPins,
    });
    validateExternalFormalAmendment19WindowManifestV1(manifest, subject);

    const runtimeRepository = new PostgresRuntimeRepositoryV1(pool);
    const bootstrap = new ExternalFormalBootstrapPersistenceServiceV1({
      runtime_config_repository: runtimeRepository,
      bootstrap_persistence: runtimeRepository,
      authority_snapshot_repository: new PostgresNextTickRepositoryV1(pool),
      evidence_source: new ControlledA0SourceV1(a0),
    });
    const result = await bootstrap.execute({
      bundle: bundle.persistence_bundle,
      created_at: a0,
      lease_owner: "phase5-two-service-bootstrap",
      lease_duration_seconds: 300,
    });
    if (
      result.hourly_runtime_config_count !== 24
      || result.provider_request_count !== 0
      || result.scheduler_slot_write_count !== 0
      || result.formal_window_started !== false
    ) {
      throw new Error("PHASE5_PREPARE_BOOTSTRAP_SIDE_EFFECT_BOUNDARY_DRIFT");
    }

    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(
      outputPath,
      JSON.stringify(
        manifest as unknown as ExternalFormalV3Am19WindowManifestV1,
        null,
        2,
      ) + "\n",
    );

    const proof = {
      schema_version: "geox_mcft_cap09_phase5_two_service_prepare_24t_v2",
      status: "PASS",
      subject_sha: subject,
      a0,
      o00: bundle.o00_logical_time,
      o23: bundle.o23_logical_time,
      bootstrap_evidence_kind: "CONTROLLED_A0_ONLY",
      engineering_bootstrap_fixture_count: 1,
      runtime_external_evidence_fixture_count: 0,
      hourly_runtime_config_count: result.hourly_runtime_config_count,
      scheduler_slot_write_count: result.scheduler_slot_write_count,
      formal_window_started: result.formal_window_started,
      manifest_output: outputPath,
      provider_request_count: 0,
      production_activation: false,
    };
    fs.mkdirSync(path.dirname(proofPath), { recursive: true });
    fs.writeFileSync(proofPath, JSON.stringify(proof, null, 2) + "\n");
    process.stdout.write(JSON.stringify(proof) + "\n");
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
