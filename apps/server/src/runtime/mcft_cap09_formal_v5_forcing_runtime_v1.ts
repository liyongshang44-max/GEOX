// MCFT-CAP-09 H6B Formal-v5 forcing runtime hosted inside the Evidence plane.
//
// This is a lifecycle wrapper around the already-qualified V13 autonomous forcing
// production process. The wrapper does not select forcing targets from wall clock;
// every wake delegates to DB-backed controller/admission semantics.
//
// The process uses the existing Evidence runtime service principal against the Formal-v5
// database and the dedicated Formal raw bucket. It is subordinate to the Evidence plane
// and does not create a third production authority domain.

import os from "node:os";
import { setTimeout as sleep } from "node:timers/promises";

import formalForcingBudgetAuthorityJson from "../../../../docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-FORMAL-FORCING-ACQUISITION-BUDGET-AUTHORITY-V1.json" with { type: "json" };

import type {
  FormalForcingAcquisitionBudgetAdjudicationV1,
} from "../domain/twin_runtime/external_formal_forcing_acquisition_budget_v1.js";
import {
  createMcftCap09V13ForcingProductionProcessV1,
} from "../external_evidence/mcft_cap09_v13_forcing_production_process_v1.js";
import {
  createMcftCap09ProcessStopV1,
} from "./mcft_cap09_production_process_lifecycle_v1.js";
import {
  loadMcftCap09FormalV5ActivationAuthorityV1,
  MCFT_CAP09_FORMAL_V5_ACTIVE_MODE_V1,
  MCFT_CAP09_FORMAL_V5_DATABASE_NAME_V1,
} from "./twin_runtime/mcft_cap09_formal_v5_activation_authority_v1.js";

export const MCFT_CAP09_FORMAL_V5_FORCING_RUNTIME_ID_V1 =
  "MCFT_CAP09_FORMAL_V5_FORCING_RUNTIME_V1" as const;

export const MCFT_CAP09_FORMAL_V5_FORCING_RUNTIME_CONTRACT_V1 = {
  runtime_id: MCFT_CAP09_FORMAL_V5_FORCING_RUNTIME_ID_V1,
  runtime_role: "EVIDENCE_RUNTIME",
  mode: MCFT_CAP09_FORMAL_V5_ACTIVE_MODE_V1,
  database_name: MCFT_CAP09_FORMAL_V5_DATABASE_NAME_V1,
  database_principal: "geox_mcft_cap09_evidence_runtime_login_v1",
  formal_raw_bucket: "geox-mcft-cap09-formal-raw-v1",
  controller:
    "AUTONOMOUS_FORMAL_FORCING_CONTROLLER_SERVICE_V1",
  first_required_base: "O00",
  last_required_base: "O22",
  required_base_count: 23,
  a0_warm_start_supplies_o00: true,
  outer_wake_is_clock_authority: false,
  database_admission_is_authority: true,
  github_production_wake_allowed: false,
  third_production_authority_domain_created: false,
  operational_evidence_owner_rewritten: false,
} as const;

type EnvironmentV1 = Readonly<Record<string, string | undefined>>;

function requiredEnvV1(
  env: EnvironmentV1,
  name: string,
  code: string,
): string {
  const value = String(env[name] ?? "").trim();
  if (!value) throw new Error(code);
  return value;
}

function integerEnvV1(
  env: EnvironmentV1,
  name: string,
  fallback: number,
  minimum: number,
  maximum: number,
  code: string,
): number {
  const raw = String(env[name] ?? fallback).trim();
  if (!/^\d+$/.test(raw)) throw new Error(code);
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new Error(code);
  }
  return value;
}

function addHoursV1(value: string, hours: number): string {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== value) {
    throw new Error("FORMAL_V5_FORCING_BASE_TIME_INVALID");
  }
  return new Date(parsed + hours * 3_600_000).toISOString();
}

function frozenBudgetV1(): FormalForcingAcquisitionBudgetAdjudicationV1 {
  const document = formalForcingBudgetAuthorityJson as {
    status?: unknown;
    fixed_35_minute_lead_authorized_for_v5?: unknown;
    hardcoded_replacement_budget_minutes?: unknown;
    timing_budget_qualified?: unknown;
    timing_budget_frozen?: unknown;
    qualified_budget?: Partial<FormalForcingAcquisitionBudgetAdjudicationV1>;
  };
  const budget = document.qualified_budget;
  if (
    document.status
      !== "QUALIFIED_AND_FROZEN_FROM_EXACT_HEAD_REAL_TIMING_AND_CONTROLLED_DELAY"
    || document.fixed_35_minute_lead_authorized_for_v5 !== false
    || document.hardcoded_replacement_budget_minutes !== null
    || document.timing_budget_qualified !== true
    || document.timing_budget_frozen !== true
    || budget?.authority_id !== "FORMAL_FORCING_ACQUISITION_BUDGET_V1"
    || budget.status !== "PASS"
    || budget.real_sample_count !== 3
    || budget.controlled_delay_case_count !== 6
    || budget.maximum_real_end_to_end_ms !== 991554
    || budget.maximum_controlled_end_to_end_ms !== 1940630
    || budget.measured_envelope_ms !== 1940630
    || budget.selected_budget_ms !== 2081804
    || budget.safety_margin_ms !== 141174
    || budget.hardcoded_default_budget_minutes !== null
    || budget.selection_basis
      !== "MEASURED_ENVELOPE_PLUS_EXPLICIT_MARGIN"
  ) {
    throw new Error("FORMAL_V5_FORCING_FROZEN_TIMING_BUDGET_INVALID");
  }
  return budget as FormalForcingAcquisitionBudgetAdjudicationV1;
}

function mappedFormalRuntimeEnvV1(
  env: EnvironmentV1,
  subject: string,
): EnvironmentV1 {
  const serviceId = requiredEnvV1(
    env,
    "GEOX_MCFT_CAP09_EVIDENCE_RUNTIME_SERVICE_ID",
    "FORMAL_V5_FORCING_EVIDENCE_SERVICE_ID_REQUIRED",
  );
  const instance = String(env.HOSTNAME ?? os.hostname()).trim();
  if (!instance) {
    throw new Error("FORMAL_V5_FORCING_INSTANCE_ID_REQUIRED");
  }
  return {
    ...env,
    GEOX_MCFT_CAP09_EVIDENCE_RUNTIME_DATABASE_URL:
      requiredEnvV1(
        env,
        "GEOX_MCFT_CAP09_FORMAL_V5_EVIDENCE_RUNTIME_DATABASE_URL",
        "FORMAL_V5_FORCING_DATABASE_URL_REQUIRED",
      ),
    GEOX_MCFT_CAP09_EVIDENCE_S3_ENDPOINT:
      requiredEnvV1(
        env,
        "GEOX_MCFT_CAP09_FORMAL_RAW_S3_ENDPOINT",
        "FORMAL_V5_FORCING_RAW_ENDPOINT_REQUIRED",
      ),
    GEOX_MCFT_CAP09_EVIDENCE_S3_BUCKET:
      requiredEnvV1(
        env,
        "GEOX_MCFT_CAP09_FORMAL_RAW_S3_BUCKET",
        "FORMAL_V5_FORCING_RAW_BUCKET_REQUIRED",
      ),
    GEOX_MCFT_CAP09_EVIDENCE_S3_REGION:
      requiredEnvV1(
        env,
        "GEOX_MCFT_CAP09_FORMAL_RAW_S3_REGION",
        "FORMAL_V5_FORCING_RAW_REGION_REQUIRED",
      ),
    GEOX_MCFT_CAP09_EVIDENCE_S3_ACCESS_KEY_ID:
      requiredEnvV1(
        env,
        "GEOX_MCFT_CAP09_FORMAL_RAW_S3_ACCESS_KEY_ID",
        "FORMAL_V5_FORCING_RAW_ACCESS_KEY_REQUIRED",
      ),
    GEOX_MCFT_CAP09_EVIDENCE_S3_SECRET_ACCESS_KEY:
      requiredEnvV1(
        env,
        "GEOX_MCFT_CAP09_FORMAL_RAW_S3_SECRET_ACCESS_KEY",
        "FORMAL_V5_FORCING_RAW_SECRET_KEY_REQUIRED",
      ),
    GEOX_MCFT_CAP09_V13_CONTROLLER_OWNER:
      `${serviceId}#instance:${instance}#formal-v5-controller:${subject}`,
    GEOX_MCFT_CAP09_V13_PRODUCER_OWNER:
      `${serviceId}#instance:${instance}#formal-v5-producer:${subject}`,
  };
}

function terminalStatusV1(status: string): boolean {
  return [
    "CONTROLLER_TERMINAL",
    "TERMINAL_LATE_WAKE",
    "TERMINAL_PROMOTION_MUTATION_UNSAFE",
  ].includes(status);
}

export async function runMcftCap09FormalV5ForcingRuntimeV1(input?: {
  env?: EnvironmentV1;
}): Promise<void> {
  const env = input?.env ?? process.env;
  const subject = requiredEnvV1(
    env,
    "GEOX_DEPLOYMENT_SUBJECT_COMMIT",
    "FORMAL_V5_FORCING_SUBJECT_REQUIRED",
  );
  if (!/^[0-9a-f]{40}$/.test(subject)) {
    throw new Error("FORMAL_V5_FORCING_SUBJECT_INVALID");
  }

  const activation = loadMcftCap09FormalV5ActivationAuthorityV1({
    expected_subject_sha: subject,
    arm_path: requiredEnvV1(
      env,
      "GEOX_MCFT_CAP09_FORMAL_V5_ARM_PATH",
      "FORMAL_V5_FORCING_ARM_PATH_REQUIRED",
    ),
    a0_bootstrap_path: requiredEnvV1(
      env,
      "GEOX_MCFT_CAP09_FORMAL_V5_A0_BOOTSTRAP_PATH",
      "FORMAL_V5_FORCING_A0_BOOTSTRAP_PATH_REQUIRED",
    ),
    manifest_path: requiredEnvV1(
      env,
      "GEOX_MCFT_CAP09_FORMAL_V5_MANIFEST_PATH",
      "FORMAL_V5_FORCING_MANIFEST_PATH_REQUIRED",
    ),
    current_crop_authority_path: requiredEnvV1(
      env,
      "GEOX_MCFT_CAP09_FORMAL_V5_CURRENT_CROP_AUTHORITY_PATH",
      "FORMAL_V5_FORCING_CURRENT_CROP_PATH_REQUIRED",
    ),
  });

  const formalRawBucket = requiredEnvV1(
    env,
    "GEOX_MCFT_CAP09_FORMAL_RAW_S3_BUCKET",
    "FORMAL_V5_FORCING_RAW_BUCKET_REQUIRED",
  );
  if (formalRawBucket !== "geox-mcft-cap09-formal-raw-v1") {
    throw new Error("FORMAL_V5_FORCING_EXACT_FORMAL_RAW_BUCKET_REQUIRED");
  }

  const formalDatabaseUrl = requiredEnvV1(
    env,
    "GEOX_MCFT_CAP09_FORMAL_V5_EVIDENCE_RUNTIME_DATABASE_URL",
    "FORMAL_V5_FORCING_DATABASE_URL_REQUIRED",
  );
  const databaseUrl = new URL(formalDatabaseUrl);
  if (
    !["postgres:", "postgresql:"].includes(databaseUrl.protocol)
    || decodeURIComponent(databaseUrl.pathname.replace(/^\//, ""))
      !== MCFT_CAP09_FORMAL_V5_DATABASE_NAME_V1
  ) {
    throw new Error("FORMAL_V5_FORCING_EXACT_V5_DATABASE_REQUIRED");
  }

  const firstRequiredBase = activation.arm.o00;
  const lastRequiredBase = addHoursV1(firstRequiredBase, 22);
  if (
    lastRequiredBase
      !== addHoursV1(activation.arm.o23, -1)
  ) {
    throw new Error("FORMAL_V5_FORCING_O00_O22_RANGE_DRIFT");
  }

  const processEnv = mappedFormalRuntimeEnvV1(env, subject);
  const forcing = await createMcftCap09V13ForcingProductionProcessV1({
    authority: {
      scope: activation.manifest.scope,
      subject_sha: subject,
      epoch_id: activation.arm.epoch_id,
      first_required_base: firstRequiredBase,
      last_required_base: lastRequiredBase,
      qualified_budget: frozenBudgetV1(),
    },
    env: processEnv,
  });

  const stop = createMcftCap09ProcessStopV1();
  const wakeMs = integerEnvV1(
    env,
    "GEOX_MCFT_CAP09_FORMAL_V5_FORCING_WAKE_MS",
    30_000,
    1_000,
    300_000,
    "FORMAL_V5_FORCING_WAKE_MS_INVALID",
  );

  let cycleAttempt = 0;
  try {
    process.stdout.write(`${JSON.stringify({
      runtime_role: "EVIDENCE_RUNTIME",
      subordinate_runtime:
        MCFT_CAP09_FORMAL_V5_FORCING_RUNTIME_ID_V1,
      mode: MCFT_CAP09_FORMAL_V5_ACTIVE_MODE_V1,
      status: "STARTING",
      deployment_subject_sha: subject,
      epoch_id: activation.arm.epoch_id,
      first_required_base: firstRequiredBase,
      last_required_base: lastRequiredBase,
      required_base_count: 23,
      outer_wake_is_clock_authority: false,
      provider_request_count: 0,
    })}\n`);

    while (!stop.stopRequested()) {
      cycleAttempt += 1;
      const result = await forcing.runOnce();
      const status = String(result.status);
      process.stdout.write(`${JSON.stringify({
        runtime_role: "EVIDENCE_RUNTIME",
        subordinate_runtime:
          MCFT_CAP09_FORMAL_V5_FORCING_RUNTIME_ID_V1,
        mode: MCFT_CAP09_FORMAL_V5_ACTIVE_MODE_V1,
        status:
          status === "COMPLETED_BASE" || status === "NO_WORK"
            ? "HEALTHY"
            : terminalStatusV1(status)
              ? "DEGRADED"
              : "BACKPRESSURE",
        cycle_attempt: cycleAttempt,
        deployment_subject_sha: subject,
        epoch_id: activation.arm.epoch_id,
        controller_result: result,
        outer_wake_is_clock_authority: false,
      })}\n`);

      if (terminalStatusV1(status)) {
        throw new Error(
          `FORMAL_V5_FORCING_TERMINAL:${status}`,
        );
      }

      if (!stop.stopRequested()) {
        await sleep(wakeMs);
      }
    }
  } finally {
    stop.dispose();
    await forcing.close();
  }
}
