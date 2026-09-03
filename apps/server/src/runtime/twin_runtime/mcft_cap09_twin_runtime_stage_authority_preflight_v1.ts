// Purpose: fail-closed production preflight for the biological-stage-aware
// Amendment-19 V4 manifest before opening the Twin database or starting the host.
// Boundary: pure validation only; no filesystem, provider, database, scheduler,
// persistence, clock, Docker, or Formal side effect.

import {
  materializeExternalFormalA18CropContextV4,
} from "./external_formal_a18_crop_context_v4.js";
import type {
  ExternalFormalV4Am19WindowManifestV2,
} from "./external_formal_v4_amendment19_runner_v2.js";

type JsonRecordV1 = Record<string, unknown>;

export type McftCap09ProductionV4ManifestV1 =
  ExternalFormalV4Am19WindowManifestV2 & {
    schema_version?: unknown;
    subject_sha?: unknown;
  };

export type McftCap09TwinStageAuthorityPreflightResultV1 = {
  status: "PASS";
  subject_sha: string;
  manifest_ref: string;
  manifest_hash: string;
  exact_slot_count: 24;
  resolved_water_use_stage: "LATE";
  resolved_kc: 0.6;
  current_crop_authority_evidence_digest: string;
  production_effective: true;
};

function exactSubjectV1(value: unknown): string {
  const subject = String(value ?? "").trim();
  if (!/^[0-9a-f]{40}$/.test(subject)) {
    throw new Error("MCFT_CAP09_TWIN_V4_MANIFEST_EXACT_SUBJECT_SHA_REQUIRED");
  }
  return subject;
}

function requiredTextV1(value: unknown, code: string): string {
  const text = String(value ?? "").trim();
  if (!text) throw new Error(code);
  return text;
}

export function preflightMcftCap09TwinStageAuthorityManifestV1(input: {
  deployment_subject_sha: string;
  manifest: McftCap09ProductionV4ManifestV1;
  crop_authority: JsonRecordV1;
  configuration_matrix: JsonRecordV1;
  current_crop_authority: JsonRecordV1;
  biological_stage_architecture_effectiveness: JsonRecordV1;
}): McftCap09TwinStageAuthorityPreflightResultV1 {
  const deploymentSubject = exactSubjectV1(input.deployment_subject_sha);
  const manifestSubject = exactSubjectV1(input.manifest.subject_sha);
  if (manifestSubject !== deploymentSubject) {
    throw new Error("MCFT_CAP09_TWIN_V4_MANIFEST_DEPLOYMENT_SUBJECT_MISMATCH");
  }
  if (
    input.manifest.schema_version
      !== "geox_mcft_cap09_amendment19_window_manifest_v1"
  ) {
    throw new Error("MCFT_CAP09_TWIN_V4_MANIFEST_SCHEMA_REQUIRED");
  }
  if (!Array.isArray(input.manifest.slots) || input.manifest.slots.length !== 24) {
    throw new Error("MCFT_CAP09_TWIN_V4_MANIFEST_EXACT_24_SLOTS_REQUIRED");
  }

  let evidenceDigest: string | null = null;
  for (let index = 0; index < input.manifest.slots.length; index += 1) {
    const slot = input.manifest.slots[index]!;
    const expectedSlotId = `O${String(index).padStart(2, "0")}`;
    if (slot.slot_id !== expectedSlotId) {
      throw new Error(
        `MCFT_CAP09_TWIN_V4_MANIFEST_SLOT_SEQUENCE_DRIFT:${expectedSlotId}`,
      );
    }
    const materialized = materializeExternalFormalA18CropContextV4({
      logical_time: slot.logical_time,
      expected_identity_hash: slot.crop_stage_context_hash,
      crop_authority: input.crop_authority,
      configuration_matrix: input.configuration_matrix,
      current_crop_authority: input.current_crop_authority,
      biological_stage_architecture_effectiveness:
        input.biological_stage_architecture_effectiveness,
      activation_mode: "PRODUCTION_EFFECTIVE",
    });
    if (
      materialized.context_ref !== slot.crop_stage_context_ref
      || materialized.context_identity_hash !== slot.crop_stage_context_hash
    ) {
      throw new Error(
        `MCFT_CAP09_TWIN_V4_MANIFEST_CROP_CONTEXT_IDENTITY_MISMATCH:${slot.slot_id}`,
      );
    }
    if (
      materialized.context_materialization_hash
        !== slot.crop_stage_context_materialization_hash
    ) {
      throw new Error(
        `MCFT_CAP09_TWIN_V4_MANIFEST_CROP_CONTEXT_MATERIALIZATION_MISMATCH:${slot.slot_id}`,
      );
    }
    if (
      materialized.stage_code !== "LATE"
      || materialized.kc !== 0.6
      || materialized.production_effective !== true
    ) {
      throw new Error(
        `MCFT_CAP09_TWIN_V4_MANIFEST_STAGE_PARAMETER_MISMATCH:${slot.slot_id}`,
      );
    }
    if (evidenceDigest === null) {
      evidenceDigest = materialized.current_crop_authority_evidence_digest;
    } else if (
      evidenceDigest !== materialized.current_crop_authority_evidence_digest
    ) {
      throw new Error(
        "MCFT_CAP09_TWIN_V4_MANIFEST_CURRENT_CROP_EVIDENCE_DIGEST_DRIFT",
      );
    }
  }

  return {
    status: "PASS",
    subject_sha: deploymentSubject,
    manifest_ref: requiredTextV1(
      input.manifest.manifest_ref,
      "MCFT_CAP09_TWIN_V4_MANIFEST_REF_REQUIRED",
    ),
    manifest_hash: requiredTextV1(
      input.manifest.manifest_hash,
      "MCFT_CAP09_TWIN_V4_MANIFEST_HASH_REQUIRED",
    ),
    exact_slot_count: 24,
    resolved_water_use_stage: "LATE",
    resolved_kc: 0.6,
    current_crop_authority_evidence_digest: requiredTextV1(
      evidenceDigest,
      "MCFT_CAP09_TWIN_V4_MANIFEST_CURRENT_CROP_EVIDENCE_DIGEST_REQUIRED",
    ),
    production_effective: true,
  };
}
