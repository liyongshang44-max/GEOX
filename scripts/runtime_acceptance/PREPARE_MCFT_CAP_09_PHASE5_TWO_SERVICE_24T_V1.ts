import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { Pool } from "pg";

import { semanticHashV1 } from "../../apps/server/src/domain/twin_runtime/canonical_identity_v1.js";
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
import type {
  ExternalFormalV3Am19WindowManifestV1,
} from "../../apps/server/src/runtime/twin_runtime/external_formal_v3_amendment19_runner_v1.js";
import type {
  CanonicalReplayEvidenceRecordV1,
  ReplayEvidenceSourcePortV1,
  TwinScopeKeyV1,
} from "../../apps/server/src/runtime/twin_runtime/ports.js";

const EVIDENCE_SOURCE = "mcft_cap09_external_formal_evidence_v1";
const REQUIRED_TYPES = [
  "soil_moisture_observation_v1",
  "future_weather_assumption_v1",
  "future_et0_assumption_v1",
] as const;
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

function addHours(value: string, hours: number): string {
  return new Date(Date.parse(value) + hours * 3_600_000).toISOString();
}

function loadJson(file: string): Record<string, unknown> {
  const value = JSON.parse(fs.readFileSync(file, "utf8")) as unknown;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("PHASE5_PREPARE_JSON_OBJECT_REQUIRED:" + file);
  }
  return value as Record<string, unknown>;
}

function payloadFromRow(row: { record_json: unknown }): CanonicalReplayEvidenceRecordV1 {
  const envelope = typeof row.record_json === "string"
    ? JSON.parse(row.record_json)
    : row.record_json;
  if (!envelope || typeof envelope !== "object" || Array.isArray(envelope)) {
    throw new Error("PHASE5_PREPARE_EVIDENCE_ENVELOPE_INVALID");
  }
  const payload = (envelope as { payload?: unknown }).payload;
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("PHASE5_PREPARE_EVIDENCE_PAYLOAD_INVALID");
  }
  return structuredClone(payload) as CanonicalReplayEvidenceRecordV1;
}

function exactScope(record: CanonicalReplayEvidenceRecordV1): void {
  for (const key of [
    "tenant_id",
    "project_id",
    "group_id",
    "field_id",
    "season_id",
    "zone_id",
  ] as const) {
    if (record[key] !== MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1[key]) {
      throw new Error("PHASE5_PREPARE_EVIDENCE_SCOPE_MISMATCH:" + key);
    }
  }
}

function eventTime(record: CanonicalReplayEvidenceRecordV1): string {
  if (record.record_type === "soil_moisture_observation_v1") {
    return canonicalIso(
      String(record.role_time?.observed_at ?? ""),
      "PHASE5_PREPARE_SOIL_OBSERVED_AT_INVALID",
    );
  }
  return canonicalIso(
    String(record.role_time?.issued_at ?? ""),
    "PHASE5_PREPARE_GFS_ISSUED_AT_INVALID",
  );
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

class FrozenPhase5A0EvidenceSourceV1 implements ReplayEvidenceSourcePortV1 {
  constructor(
    private readonly records: readonly CanonicalReplayEvidenceRecordV1[],
    private readonly a0: string,
  ) {}

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
    return this.records.map((record) => structuredClone(record));
  }
}

async function main(): Promise<void> {
  const databaseUrl = requiredEnv("DATABASE_URL");
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

  const pool = new Pool({ connectionString: databaseUrl, max: 4 });
  try {
    const scope = { ...MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1 };
    const rows = (
      await pool.query<{ record_json: unknown }>(
        `SELECT record_json
           FROM public.facts
          WHERE source=$1
            AND record_json#>>'{payload,tenant_id}'=$2
            AND record_json#>>'{payload,project_id}'=$3
            AND record_json#>>'{payload,group_id}'=$4
            AND record_json#>>'{payload,field_id}'=$5
            AND record_json#>>'{payload,season_id}'=$6
            AND record_json#>>'{payload,zone_id}'=$7
            AND record_json->>'type'=ANY($8::text[])
          ORDER BY occurred_at ASC,fact_id ASC`,
        [
          EVIDENCE_SOURCE,
          scope.tenant_id,
          scope.project_id,
          scope.group_id,
          scope.field_id,
          scope.season_id,
          scope.zone_id,
          [...REQUIRED_TYPES],
        ],
      )
    ).rows;
    const records = rows.map(payloadFromRow);
    const byType = new Map(records.map((record) => [record.record_type, record]));
    for (const type of REQUIRED_TYPES) {
      if (!byType.has(type)) {
        throw new Error("PHASE5_PREPARE_REQUIRED_EVIDENCE_MISSING:" + type);
      }
    }

    const soil = byType.get("soil_moisture_observation_v1")!;
    exactScope(soil);
    const soilObserved = eventTime(soil);
    const soilAvailable = canonicalIso(
      soil.available_to_runtime_at,
      "PHASE5_PREPARE_SOIL_AVAILABLE_AT_INVALID",
    );
    const soilIngested = canonicalIso(
      String(soil.role_time?.ingested_at ?? ""),
      "PHASE5_PREPARE_SOIL_INGESTED_AT_INVALID",
    );
    if (
      Date.parse(soilObserved) <= Date.parse(addHours(a0, -1))
      || Date.parse(soilObserved) > Date.parse(a0)
      || Date.parse(soilAvailable) > Date.parse(a0)
      || Date.parse(soilIngested) > Date.parse(a0)
    ) {
      throw new Error("PHASE5_PREPARE_SOIL_NOT_CAUSAL_A0_WINDOW");
    }

    for (const type of [
      "future_weather_assumption_v1",
      "future_et0_assumption_v1",
    ] as const) {
      const record = byType.get(type)!;
      exactScope(record);
      if (
        record.epistemic_class !== "ASSUMED"
        || record.role_time?.valid_from !== a0
        || record.role_time?.valid_to !== addHours(a0, 72)
      ) {
        throw new Error("PHASE5_PREPARE_GFS_WINDOW_MISMATCH:" + type);
      }
      for (const value of [
        record.role_time?.issued_at,
        record.available_to_runtime_at,
        record.role_time?.ingested_at,
      ]) {
        const causal = canonicalIso(
          String(value ?? ""),
          "PHASE5_PREPARE_GFS_CAUSAL_TIME_INVALID:" + type,
        );
        if (Date.parse(causal) > Date.parse(a0)) {
          throw new Error("PHASE5_PREPARE_GFS_NOT_CAUSAL_A0:" + type);
        }
      }
      const points = (record.canonical_payload as { points?: unknown })?.points;
      if (!Array.isArray(points) || points.length !== 72) {
        throw new Error("PHASE5_PREPARE_GFS_72_POINTS_REQUIRED:" + type);
      }
    }

    const epoch = `mcft_cap09_phase5_two_service_${a0.replace(/[^0-9]/g, "")}_${subject.slice(0, 12)}`;
    const bundle = buildExternalFormalPrewindowAuthorityBundleV3({
      epoch_id: epoch,
      bootstrap_logical_time: a0,
      created_at: createdAt,
      bootstrap_crop_stage_code: "MID",
      hourly_crop_stage_codes: Array.from(
        { length: 24 },
        () => "MID" as const,
      ),
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

    const manifest = buildExternalFormalAmendment19WindowManifestV1({
      subject_sha: subject,
      database_name: String(
        (await pool.query("SELECT current_database() AS n")).rows[0]?.n ?? "",
      ),
      manifest_ref: `qualification://mcft-cap09/phase5/two-service/${epoch}`,
      bundle,
      crop_context_materialization_pins: materializationPins,
    });
    validateExternalFormalAmendment19WindowManifestV1(manifest, subject);

    const runtimeRepository = new PostgresRuntimeRepositoryV1(pool);
    const bootstrap = new ExternalFormalBootstrapPersistenceServiceV1({
      runtime_config_repository: runtimeRepository,
      bootstrap_persistence: runtimeRepository,
      authority_snapshot_repository: new PostgresNextTickRepositoryV1(pool),
      evidence_source: new FrozenPhase5A0EvidenceSourceV1(records, a0),
    });
    const bootstrapResult = await bootstrap.execute({
      bundle: bundle.persistence_bundle,
      created_at: a0,
      lease_owner: "phase5-two-service-bootstrap",
      lease_duration_seconds: 300,
    });
    if (
      bootstrapResult.hourly_runtime_config_count !== 24
      || bootstrapResult.provider_request_count !== 0
      || bootstrapResult.scheduler_slot_write_count !== 0
      || bootstrapResult.formal_window_started !== false
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
      schema_version: "geox_mcft_cap09_phase5_two_service_prepare_24t_v1",
      status: "PASS",
      subject_sha: subject,
      a0,
      o00: bundle.o00_logical_time,
      o23: bundle.o23_logical_time,
      evidence_source: EVIDENCE_SOURCE,
      selected_evidence_record_count: records.length,
      required_evidence_types: [...REQUIRED_TYPES],
      real_governed_evidence_only: true,
      engineering_evidence_fixture_count: 0,
      hourly_runtime_config_count: bootstrapResult.hourly_runtime_config_count,
      scheduler_slot_write_count: bootstrapResult.scheduler_slot_write_count,
      formal_window_started: bootstrapResult.formal_window_started,
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
