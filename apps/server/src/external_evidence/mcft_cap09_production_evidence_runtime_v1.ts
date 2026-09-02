// MCFT-CAP-09 production Evidence compiled entrypoint binding.
// The entrypoint is wired to the qualified source-specific planner object graph, but
// remains fail-closed until the separate repository authority establishes one exact
// runtime-start instance. Deployment environment values may supply credentials and
// scope only; they may not invent activation-fence or Formal-A0 authority.

import runtimeStartAuthorityJson from "../../../../docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-PRODUCTION-RUNTIME-START-AUTHORITY-V1.json" with { type: "json" };

import {
  readMcftCap09EvidenceRuntimeProcessConfigV1,
  runMcftCap09EvidenceRuntimeProcessV1,
} from "./mcft_cap09_evidence_runtime_process_v1.js";
import {
  createProductionEvidenceHostPlannerFactoryV1,
} from "./mcft_cap09_production_evidence_planner_assembly_v1.js";
import {
  MCFT_CAP09_SEPARATE_PRODUCTION_RUNTIME_START_AUTHORITY_CLASS_V1,
} from "./mcft_cap09_production_evidence_acquisition_horizon_v1.js";
import type {
  ProductionEvidenceRuntimeStartAuthorityInstanceV1,
  ProductionEvidencePlanningClockV1,
} from "./mcft_cap09_production_evidence_host_planner_v1.js";
import type {
  ProductionEvidenceWorkItemFactoryConfigV1,
} from "./mcft_cap09_production_evidence_work_items_v1.js";

export const MCFT_CAP09_PRODUCTION_EVIDENCE_RUNTIME_ENTRYPOINT_ID_V1 =
  "MCFT_CAP09_PRODUCTION_EVIDENCE_RUNTIME_ENTRYPOINT_V1" as const;

type EnvironmentV1 = Readonly<Record<string, string | undefined>>;

function recordV1(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("MCFT_CAP09_PRODUCTION_RUNTIME_START_AUTHORITY_INVALID");
  }
  return value as Record<string, unknown>;
}

function textV1(value: unknown, code: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(code);
  return value.trim();
}

function isoV1(value: unknown, code: string): string {
  const text = textV1(value, code);
  const parsed = Date.parse(text);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== text) throw new Error(code);
  return text;
}

function hourV1(value: unknown, code: string): string {
  const text = isoV1(value, code);
  if (!text.endsWith(":00:00.000Z")) throw new Error(code);
  return text;
}

export function parseMcftCap09ProductionRuntimeStartAuthorityV1(
  value: unknown,
): ProductionEvidenceRuntimeStartAuthorityInstanceV1 {
  const authority = recordV1(value);
  if (
    authority.schema_version !== "geox_mcft_cap09_production_runtime_start_authority_v1"
    || authority.authority_id !== "GEOX-MCFT-CAP-09-PRODUCTION-RUNTIME-START-AUTHORITY-V1"
  ) {
    throw new Error("MCFT_CAP09_PRODUCTION_RUNTIME_START_AUTHORITY_IDENTITY_INVALID");
  }
  if (
    authority.armed !== true
    || authority.status !== "AUTHORIZED"
    || authority.runtime_process_start_authorized !== true
    || authority.evidence_runtime_start_authorized !== true
  ) {
    throw new Error("MCFT_CAP09_PRODUCTION_RUNTIME_START_AUTHORITY_NOT_ARMED");
  }
  if (
    authority.production_owner_activation_authorized !== false
    || authority.formal_v5_arm_authorized !== false
    || authority.a0_authorized !== false
    || authority.o00_authorized !== false
  ) {
    throw new Error("MCFT_CAP09_PRODUCTION_RUNTIME_START_AUTHORITY_SCOPE_INVALID");
  }
  if (authority.authority_class !== MCFT_CAP09_SEPARATE_PRODUCTION_RUNTIME_START_AUTHORITY_CLASS_V1) {
    throw new Error("MCFT_CAP09_PRODUCTION_RUNTIME_START_AUTHORITY_CLASS_INVALID");
  }
  const activationFence = isoV1(
    authority.activation_fence_time,
    "MCFT_CAP09_PRODUCTION_RUNTIME_START_ACTIVATION_FENCE_INVALID",
  );
  const formalA0 = hourV1(
    authority.formal_a0_logical_time,
    "MCFT_CAP09_PRODUCTION_RUNTIME_START_FORMAL_A0_INVALID",
  );
  if (Date.parse(activationFence) >= Date.parse(formalA0)) {
    throw new Error("MCFT_CAP09_PRODUCTION_RUNTIME_START_FENCE_MUST_PRECEDE_A0");
  }
  return {
    authority_class: MCFT_CAP09_SEPARATE_PRODUCTION_RUNTIME_START_AUTHORITY_CLASS_V1,
    authority_ref: textV1(
      authority.authority_ref,
      "MCFT_CAP09_PRODUCTION_RUNTIME_START_AUTHORITY_REF_REQUIRED",
    ),
    activation_fence_time: activationFence,
    formal_a0_authority_ref: textV1(
      authority.formal_a0_authority_ref,
      "MCFT_CAP09_PRODUCTION_RUNTIME_START_FORMAL_A0_AUTHORITY_REF_REQUIRED",
    ),
    formal_a0_logical_time: formalA0,
  };
}

export async function runMcftCap09ProductionEvidenceRuntimeV1(input: {
  env?: EnvironmentV1;
  planning_clock?: ProductionEvidencePlanningClockV1;
  work_item_config?: Omit<ProductionEvidenceWorkItemFactoryConfigV1, "retention">;
  runtime_start_authority?: unknown;
} = {}): Promise<void> {
  const authority = parseMcftCap09ProductionRuntimeStartAuthorityV1(
    input.runtime_start_authority ?? runtimeStartAuthorityJson,
  );
  const env = input.env ?? process.env;
  const config = readMcftCap09EvidenceRuntimeProcessConfigV1(env);
  const planningClock = input.planning_clock ?? { now: () => new Date().toISOString() };
  const hostPlannerFactory = createProductionEvidenceHostPlannerFactoryV1({
    runtime_start_authority: authority,
    planning_clock: planningClock,
    private_store: {
      endpoint: config.s3_endpoint,
      bucket: config.s3_bucket,
      region: config.s3_region,
      access_key_id: config.s3_access_key_id,
      secret_access_key: config.s3_secret_access_key,
      allow_insecure_http_for_test: config.s3_allow_insecure_http_for_test,
    },
    work_item_config: input.work_item_config,
  });
  await runMcftCap09EvidenceRuntimeProcessV1({
    env,
    host_planner_factory: hostPlannerFactory,
    work_item_config: input.work_item_config,
  });
}
