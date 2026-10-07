// MCFT-CAP-09 G11 governed Formal-v5 forcing production entrypoint.
//
// No forcing semantics are reimplemented here. This process supplies the already-frozen
// Formal-v5 authority, timing budget and Formal raw-store binding to the existing V13
// production-process factory, then owns only long-running process lifecycle.

import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import { setTimeout as sleep } from "node:timers/promises";

import budgetAuthorityJson from "../../../../docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-FORMAL-FORCING-ACQUISITION-BUDGET-AUTHORITY-V1.json" with { type: "json" };

import {
  createMcftCap09V13ForcingProductionProcessV1,
} from "./mcft_cap09_v13_forcing_production_process_v1.js";
import type {
  FormalForcingAcquisitionBudgetAdjudicationV1,
} from "../domain/twin_runtime/external_formal_forcing_acquisition_budget_v1.js";
import {
  readMcftCap09FormalV5ActiveActivationAuthorityV1,
} from "../runtime/mcft_cap09_formal_v5_active_activation_authority_v1.js";
import {
  createMcftCap09ProcessStopV1,
} from "../runtime/mcft_cap09_production_process_lifecycle_v1.js";

export const MCFT_CAP09_FORMAL_V5_FORCING_RUNTIME_PROCESS_ID_V1 =
  "MCFT_CAP09_FORMAL_V5_FORCING_RUNTIME_PROCESS_V1" as const;

export const MCFT_CAP09_FORMAL_V5_FORCING_RUNTIME_PROCESS_CONTRACT_V1 = {
  process_id: MCFT_CAP09_FORMAL_V5_FORCING_RUNTIME_PROCESS_ID_V1,
  runtime_mode: "FORMAL_V5_ACTIVE",
  factory: "createMcftCap09V13ForcingProductionProcessV1",
  controller: "ExternalFormalForcingAutonomousControllerServiceV1",
  timing_budget: "FROZEN_FORMAL_FORCING_ACQUISITION_BUDGET_AUTHORITY_V1",
  activation_authority_required: true,
  auto_start_without_activation_authority: false,
  provider_semantics_rewritten: false,
  admission_semantics_rewritten: false,
  fencing_semantics_rewritten: false,
  database_schema_changed: false,
} as const;

type EnvironmentV1 = Readonly<Record<string, string | undefined>>;

function req(env: EnvironmentV1, name: string, code: string): string {
  const value = String(env[name] ?? "").trim();
  if (!value) throw new Error(code);
  return value;
}

function sha256File(pathValue: string): string {
  return "sha256:" + crypto.createHash("sha256").update(fs.readFileSync(pathValue)).digest("hex");
}

function addHours(value: string, hours: number): string {
  return new Date(Date.parse(value) + hours * 3_600_000).toISOString();
}

export async function runMcftCap09FormalV5ForcingRuntimeProcessV1(
  env: EnvironmentV1 = process.env,
): Promise<void> {
  const subject = req(
    env,
    "GEOX_DEPLOYMENT_SUBJECT_COMMIT",
    "FORMAL_V5_FORCING_DEPLOYMENT_SUBJECT_REQUIRED",
  );
  const activationPath = req(
    env,
    "GEOX_MCFT_CAP09_FORMAL_V5_ACTIVE_ACTIVATION_AUTHORITY_PATH",
    "FORMAL_V5_FORCING_ACTIVATION_AUTHORITY_PATH_REQUIRED",
  );
  const bootstrapPath = req(
    env,
    "GEOX_MCFT_CAP09_FORMAL_V5_A0_BOOTSTRAP_PROOF_PATH",
    "FORMAL_V5_FORCING_BOOTSTRAP_PROOF_PATH_REQUIRED",
  );

  const activation =
    readMcftCap09FormalV5ActiveActivationAuthorityV1(activationPath);
  if (activation.subject_sha !== subject) {
    throw new Error("FORMAL_V5_FORCING_ACTIVATION_SUBJECT_MISMATCH");
  }
  if (sha256File(bootstrapPath) !== activation.bootstrap_result_sha256) {
    throw new Error("FORMAL_V5_FORCING_BOOTSTRAP_DIGEST_MISMATCH");
  }

  const budgetDocument = budgetAuthorityJson as {
    timing_budget_qualified?: boolean;
    timing_budget_frozen?: boolean;
    qualified_budget?: FormalForcingAcquisitionBudgetAdjudicationV1;
  };
  if (
    budgetDocument.timing_budget_qualified !== true
    || budgetDocument.timing_budget_frozen !== true
    || !budgetDocument.qualified_budget
  ) {
    throw new Error("FORMAL_V5_FORCING_FROZEN_BUDGET_REQUIRED");
  }

  const databaseUrl = req(
    env,
    "GEOX_MCFT_CAP09_EVIDENCE_RUNTIME_DATABASE_URL",
    "FORMAL_V5_FORCING_DATABASE_URL_REQUIRED",
  );
  const databaseName = new URL(databaseUrl).pathname.replace(/^\//, "");
  if (databaseName !== "geox_mcft_cap09_s6_formal_t4r1_24h_v5") {
    throw new Error("FORMAL_V5_FORCING_FORMAL_DATABASE_REQUIRED:" + databaseName);
  }
  if (req(env,"GEOX_MCFT_CAP09_EVIDENCE_S3_BUCKET","FORMAL_V5_FORCING_RAW_BUCKET_REQUIRED") !== "geox-mcft-cap09-formal-raw-v1") {
    throw new Error("FORMAL_V5_FORCING_FORMAL_RAW_BUCKET_REQUIRED");
  }
  const hostname = String(env.HOSTNAME ?? os.hostname()).trim();
  if (!hostname) throw new Error("FORMAL_V5_FORCING_HOSTNAME_REQUIRED");

  const process = await createMcftCap09V13ForcingProductionProcessV1({
    authority: {
      scope: activation.scope,
      subject_sha: activation.subject_sha,
      epoch_id: activation.epoch_id,
      first_required_base: activation.o00,
      last_required_base: addHours(activation.o23, -1),
      qualified_budget: budgetDocument.qualified_budget,
    },
    env,
  });

  const stop = createMcftCap09ProcessStopV1();
  try {
    while (!stop.stopRequested()) {
      const result = await process.runOnce();
      process.stdout.write(JSON.stringify({
        runtime_role: "EVIDENCE_RUNTIME",
        process_id: MCFT_CAP09_FORMAL_V5_FORCING_RUNTIME_PROCESS_ID_V1,
        mode: "FORMAL_V5_ACTIVE",
        status: result.status,
        epoch_id: activation.epoch_id,
        subject_sha: activation.subject_sha,
      }) + "\n");

      if (
        result.status === "CONTROLLER_TERMINAL"
        || result.status === "TERMINAL_LATE_WAKE"
        || result.status === "TERMINAL_PROMOTION_MUTATION_UNSAFE"
      ) {
        throw new Error("FORMAL_V5_FORCING_TERMINAL:" + result.status);
      }

      const delayMs = result.status === "COMPLETED_BASE" ? 1_000 : 15_000;
      if (!stop.stopRequested()) await sleep(delayMs);
    }
  } finally {
    stop.dispose();
    await process.close();
  }
}
