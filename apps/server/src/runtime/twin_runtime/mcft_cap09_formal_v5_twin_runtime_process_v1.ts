// MCFT-CAP-09 G11 productionization-only Formal-v5 Twin process.
//
// Preserves the V2/preformal process. This dedicated ACTIVE process requires an
// A0-derived activation authority and wires only the already-qualified V5 runner.

import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";

import productionAcquisitionHorizonAuthorityJson from "../../../../../docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-PRODUCTION-EVIDENCE-ACQUISITION-HORIZON-AUTHORITY-V1.json" with { type: "json" };

import { createDatabasePool } from "../../infra/database.js";
import {
  assertMcftCap09ServicePrincipalV1,
} from "../../infra/mcft_cap09_phase5_service_principal_v1.js";
import {
  readMcftCap09FormalV5ActiveActivationAuthorityV1,
} from "../mcft_cap09_formal_v5_active_activation_authority_v1.js";
import {
  createMcftCap09ProcessStopV1,
  installMcftCap09RuntimePoolIdleErrorGuardV1,
  McftCap09ConsoleTwinHealthV1,
  McftCap09ProductionTwinFailureClassifierV1,
  McftCap09ProductionTwinWaitV1,
} from "../mcft_cap09_production_process_lifecycle_v1.js";
import {
  loadMcftCap09ProductionRuntimeStartAuthorityV1,
} from "../mcft_cap09_production_runtime_start_authority_v1.js";
import {
  buildMcftCap09ProductionLeaseOwnerV1,
} from "../mcft_cap09_production_service_identity_v1.js";
import type {
  ExternalFormalV4Am19WindowManifestV2,
} from "./external_formal_v4_amendment19_runner_v2.js";
import {
  composeMcftCap09FormalV5TwinRuntimeV1,
} from "./mcft_cap09_formal_v5_twin_runtime_composition_v1.js";
import {
  readMcftCap09TwinRuntimeProcessConfigV1,
} from "./mcft_cap09_twin_runtime_process_v1.js";

export const MCFT_CAP09_FORMAL_V5_TWIN_RUNTIME_PROCESS_ID_V1 =
  "MCFT_CAP09_FORMAL_V5_TWIN_RUNTIME_PROCESS_V1" as const;

export const MCFT_CAP09_FORMAL_V5_TWIN_RUNTIME_PROCESS_CONTRACT_V1 = {
  process_id: MCFT_CAP09_FORMAL_V5_TWIN_RUNTIME_PROCESS_ID_V1,
  runtime_mode: "FORMAL_V5_ACTIVE",
  composition: "MCFT_CAP09_FORMAL_V5_TWIN_RUNTIME_COMPOSITION_V1",
  runner: "ExternalFormalV5Amendment19RunnerV2",
  preclaim_viability: "ExternalFormalV5ViabilityGatedSchedulerV1",
  a0_bootstrap_pass_required: true,
  activation_authority_required: true,
  fresh_a0_selected_current_crop_binding_required: true,
  historical_v2_process_rewritten: false,
  scheduler_semantics_rewritten: false,
  persistent_tick_semantics_rewritten: false,
  crop_stage_semantics_rewritten: false,
  provider_semantics_rewritten: false,
  revision_semantics_rewritten: false,
  database_schema_changed: false,
} as const;

type EnvironmentV1 = Readonly<Record<string, string | undefined>>;
type JsonRecordV1 = Record<string, unknown>;

function requiredEnv(env: EnvironmentV1, name: string, code: string): string {
  const value = String(env[name] ?? "").trim();
  if (!value) throw new Error(code);
  return value;
}

function json(pathValue: string, code: string): JsonRecordV1 {
  let parsed: unknown;
  try {
    parsed = JSON.parse(fs.readFileSync(pathValue, "utf8"));
  } catch (error) {
    throw new Error(code + ":" + (error instanceof Error ? error.message : String(error)));
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error(code);
  return parsed as JsonRecordV1;
}

function sha256File(pathValue: string): string {
  return "sha256:" + crypto.createHash("sha256").update(fs.readFileSync(pathValue)).digest("hex");
}

function sameScope(left: Record<string, unknown>, right: Record<string, unknown>): boolean {
  return ["tenant_id","project_id","group_id","field_id","season_id","zone_id"]
    .every((key) => String(left[key] ?? "") === String(right[key] ?? ""));
}

export async function runMcftCap09FormalV5TwinRuntimeProcessV1(input?: {
  env?: EnvironmentV1;
  runtime_start_authority?: unknown;
}): Promise<void> {
  const document = productionAcquisitionHorizonAuthorityJson as {
    runtime_start_binding?: unknown;
  };
  const env = input?.env ?? process.env;
  const subject = requiredEnv(
    env,
    "GEOX_DEPLOYMENT_SUBJECT_COMMIT",
    "FORMAL_V5_TWIN_DEPLOYMENT_SUBJECT_REQUIRED",
  );

  const activationPath = requiredEnv(
    env,
    "GEOX_MCFT_CAP09_FORMAL_V5_ACTIVE_ACTIVATION_AUTHORITY_PATH",
    "FORMAL_V5_TWIN_ACTIVATION_AUTHORITY_PATH_REQUIRED",
  );
  const bootstrapPath = requiredEnv(
    env,
    "GEOX_MCFT_CAP09_FORMAL_V5_A0_BOOTSTRAP_PROOF_PATH",
    "FORMAL_V5_TWIN_A0_BOOTSTRAP_PROOF_PATH_REQUIRED",
  );
  const currentCropPath = requiredEnv(
    env,
    "GEOX_MCFT_CAP09_FORMAL_V5_CURRENT_CROP_AUTHORITY_PATH",
    "FORMAL_V5_TWIN_CURRENT_CROP_AUTHORITY_PATH_REQUIRED",
  );

  const activation =
    readMcftCap09FormalV5ActiveActivationAuthorityV1(activationPath);
  if (activation.subject_sha !== subject) {
    throw new Error("FORMAL_V5_TWIN_ACTIVATION_SUBJECT_MISMATCH");
  }
  if (sha256File(bootstrapPath) !== activation.bootstrap_result_sha256) {
    throw new Error("FORMAL_V5_TWIN_BOOTSTRAP_DIGEST_MISMATCH");
  }
  if (sha256File(currentCropPath) !== activation.current_crop_authority_sha256) {
    throw new Error("FORMAL_V5_TWIN_CURRENT_CROP_DIGEST_MISMATCH");
  }

  const bootstrap = json(
    bootstrapPath,
    "FORMAL_V5_TWIN_A0_BOOTSTRAP_PROOF_INVALID",
  );
  if (
    bootstrap.schema_version !== "geox_mcft_cap09_formal_v5_a0_bootstrap_result_v1"
    || bootstrap.status !== "PASS"
    || bootstrap.formal_a0_bootstrapped !== true
    || bootstrap.formal_o00_started !== false
    || bootstrap.arm_runtime_semantic_subject_sha !== activation.subject_sha
    || bootstrap.authority_continuity_head_sha !== activation.authority_continuity_head_sha
    || bootstrap.epoch_id !== activation.epoch_id
    || bootstrap.manifest_hash !== activation.manifest_hash
    || bootstrap.current_crop_authority_ref !== activation.current_crop_authority_ref
    || bootstrap.current_crop_authority_sha256 !== activation.current_crop_authority_sha256
  ) {
    throw new Error("FORMAL_V5_TWIN_A0_BOOTSTRAP_BINDING_INVALID");
  }

  if (activation.current_crop_authority_ref !== String(bootstrap.current_crop_authority_ref ?? "")) {
    throw new Error("FORMAL_V5_TWIN_CURRENT_CROP_REF_MISMATCH");
  }
  const currentCrop = json(
    currentCropPath,
    "FORMAL_V5_TWIN_CURRENT_CROP_AUTHORITY_INVALID",
  );
  const biologicalStage = currentCrop.biological_stage as Record<string, unknown>;
  if (
    currentCrop.architecture_effective !== true
    || currentCrop.runtime_consumption_authorized !== true
    || Date.parse(String(biologicalStage?.authority_valid_until ?? "")) < Date.parse(activation.o23)
  ) {
    throw new Error("FORMAL_V5_TWIN_CURRENT_CROP_NOT_VALID_THROUGH_O23");
  }

  const runtimeEnv: EnvironmentV1 = {
    ...env,
    GEOX_MCFT_CAP09_TWIN_RUNTIME_LEASE_OWNER:
      buildMcftCap09ProductionLeaseOwnerV1({
        plane: "TWIN_RUNTIME",
        configured_service_id: requiredEnv(
          env,
          "GEOX_MCFT_CAP09_TWIN_RUNTIME_SERVICE_ID",
          "FORMAL_V5_TWIN_SERVICE_ID_REQUIRED",
        ),
        instance_id: String(env.HOSTNAME ?? os.hostname()).trim(),
      }),
  };
  const config = readMcftCap09TwinRuntimeProcessConfigV1(runtimeEnv);

  const manifest = json(
    config.manifest_path,
    "FORMAL_V5_TWIN_MANIFEST_INVALID",
  ) as unknown as ExternalFormalV4Am19WindowManifestV2;
  if (
    manifest.epoch_id !== activation.epoch_id
    || manifest.manifest_hash !== activation.manifest_hash
    || manifest.o00_logical_time !== activation.o00
    || manifest.o23_logical_time !== activation.o23
    || !sameScope(manifest.scope as unknown as Record<string, unknown>, activation.scope as unknown as Record<string, unknown>)
  ) {
    throw new Error("FORMAL_V5_TWIN_MANIFEST_ACTIVATION_MISMATCH");
  }

  const runtimeStartAuthority =
    loadMcftCap09ProductionRuntimeStartAuthorityV1({
      plane: "TWIN_RUNTIME",
      expected: {
        deployment_subject_sha: subject,
        scope: manifest.scope,
      },
      authority_path:
        env.GEOX_MCFT_CAP09_PRODUCTION_RUNTIME_START_AUTHORITY_PATH,
      explicit_authority: input?.runtime_start_authority,
      embedded_authority: document.runtime_start_binding,
    });
  if (!runtimeStartAuthority) {
    throw new Error("FORMAL_V5_TWIN_RUNTIME_START_AUTHORITY_REQUIRED");
  }

  const cropAuthority = json(
    config.crop_authority_path,
    "FORMAL_V5_TWIN_CROP_AUTHORITY_INVALID",
  );
  const configurationMatrix = json(
    config.configuration_matrix_path,
    "FORMAL_V5_TWIN_CONFIGURATION_MATRIX_INVALID",
  );
  const stageArchitecture = json(
    config.biological_stage_architecture_effectiveness_path,
    "FORMAL_V5_TWIN_STAGE_ARCHITECTURE_INVALID",
  );

  const pool = createDatabasePool(config.database_url);
  const failureClassifier = new McftCap09ProductionTwinFailureClassifierV1();
  const poolErrorGuard = installMcftCap09RuntimePoolIdleErrorGuardV1({
    pool,
    runtime_role: "TWIN_RUNTIME",
    failure_classifier: failureClassifier,
  });
  const stop = createMcftCap09ProcessStopV1();
  try {
    await assertMcftCap09ServicePrincipalV1(pool, "TWIN_RUNTIME");

    const previousFence = BigInt(activation.a0_bootstrap_twin_fencing_token);
    const liveBefore = await pool.query<{
      lease_owner: string;
      fencing_token: string | number | bigint;
      expires_at: string | Date;
    }>(
      `SELECT lease_owner,fencing_token,expires_at
         FROM twin_runtime_lease_v1
        WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3
          AND field_id=$4 AND season_id=$5 AND zone_id=$6
          AND expires_at>transaction_timestamp()`,
      [
        activation.scope.tenant_id,
        activation.scope.project_id,
        activation.scope.group_id,
        activation.scope.field_id,
        activation.scope.season_id,
        activation.scope.zone_id,
      ],
    );
    if (liveBefore.rows.length !== 0) {
      throw new Error("FORMAL_V5_TWIN_FORMAL_BOOTSTRAP_LEASE_NOT_EXPIRED");
    }

    const composition = composeMcftCap09FormalV5TwinRuntimeV1({
      pool,
      manifest,
      subject_sha: activation.subject_sha,
      epoch_id: activation.epoch_id,
      crop_authority: cropAuthority,
      configuration_matrix: configurationMatrix,
      current_crop_authority: currentCrop,
      biological_stage_architecture_effectiveness: stageArchitecture,
      wait: new McftCap09ProductionTwinWaitV1({
        idle_poll_ms: config.idle_poll_ms,
        not_ready_poll_ms: config.not_ready_poll_ms,
        terminal_poll_ms: config.terminal_poll_ms,
        retry_base_ms: config.retry_base_ms,
        retry_maximum_ms: config.retry_maximum_ms,
      }),
      health: new McftCap09ConsoleTwinHealthV1(),
      stop,
      failure_classifier: failureClassifier,
    });

    const firstClaim = await composition.scheduler.acquireOrRenewOwnershipLease({
      lease_owner: config.lease_owner,
      lease_duration_seconds: config.lease_duration_seconds,
    });
    if (!firstClaim) {
      throw new Error("FORMAL_V5_TWIN_FIRST_OWNER_CLAIM_REQUIRED");
    }
    if (BigInt(firstClaim.fencing_token) <= previousFence) {
      await composition.scheduler.releaseOwnershipLease({ claim: firstClaim });
      throw new Error("FORMAL_V5_TWIN_NEW_FENCING_TOKEN_REQUIRED");
    }
    await composition.scheduler.releaseOwnershipLease({ claim: firstClaim });

    await composition.host.run({
      lease_owner: config.lease_owner,
      lease_duration_seconds: config.lease_duration_seconds,
    });
  } finally {
    stop.dispose();
    try {
      await pool.end();
    } finally {
      poolErrorGuard.dispose();
    }
  }
}
