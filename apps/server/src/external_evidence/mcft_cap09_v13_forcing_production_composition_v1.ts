// MCFT-CAP-09 post-merge v13 production forcing composition.
// Side-effect-free construction only: wires provider acquisition, private candidate retention,
// exact-base fenced fact promotion, controller lifecycle, admission, and continuity into the
// autonomous forcing service. It does not initialize an epoch, acquire a lease, call providers,
// activate a production owner, provision a remote store, arm Formal-v5, or start O00.

import type { Pool } from "pg";

import type { TwinScopeKeyV1 } from "../runtime/twin_runtime/ports.js";
import type { FormalForcingAcquisitionBudgetAdjudicationV1 } from "../domain/twin_runtime/external_formal_forcing_acquisition_budget_v1.js";
import {
  ExternalFormalForcingAutonomousControllerServiceV1,
} from "../runtime/twin_runtime/external_formal_forcing_autonomous_controller_service_v1.js";
import {
  PostgresExternalFormalForcingBaseContinuityRepositoryV1,
} from "../runtime/twin_runtime/postgres_external_formal_forcing_base_continuity_repository_v1.js";
import {
  PostgresExternalFormalForcingControllerLifecycleV1,
} from "../runtime/twin_runtime/postgres_external_formal_forcing_controller_lifecycle_v1.js";
import {
  PostgresExternalFormalForcingSupplyAdmissionV1,
} from "../runtime/twin_runtime/postgres_external_formal_forcing_supply_admission_v1.js";
import {
  PostgresEvidenceRuntimeFencedExactBaseFactPromotionV1,
} from "../persistence/external_evidence/postgres_evidence_runtime_fenced_exact_base_fact_promotion_v1.js";
import {
  ExternalFormalPrivateCandidateCapturePromotionV1,
  ProductionExternalFormalCandidateRehydrationDecoderFactoryV1,
} from "./mcft_cap09_phase7_private_candidate_capture_promotion_v1.js";
import {
  ProductionEvidenceWorkItemFactoryV1,
  type ProductionEvidenceWorkItemFactoryConfigV1,
} from "./mcft_cap09_production_evidence_work_items_v1.js";
import {
  S3CompatiblePrivateRawEvidenceRetentionAdapterV1,
  type S3CompatiblePrivateRawRetentionConfigV1,
} from "./s3_compatible_raw_evidence_retention_adapter_v1.js";
import {
  S3CompatiblePrivateCandidateManifestStoreV1,
} from "./s3_compatible_private_candidate_manifest_store_v1.js";
import {
  S3CompatiblePrivateRetainedRawReaderV1,
} from "./s3_compatible_private_retained_raw_reader_v1.js";

export const MCFT_CAP09_V13_FORCING_PRODUCTION_COMPOSITION_ID_V1 =
  "MCFT_CAP09_V13_FORCING_PRODUCTION_COMPOSITION_V1" as const;

export const MCFT_CAP09_V13_FORCING_PRODUCTION_COMPOSITION_CONTRACT_V1 = {
  composition_id: MCFT_CAP09_V13_FORCING_PRODUCTION_COMPOSITION_ID_V1,
  runtime_role: "EVIDENCE_RUNTIME",
  database_principal: "geox_mcft_cap09_evidence_runtime_login_v1",
  provider_acquisition_owner: "AUTONOMOUS_FORCING_CONTROLLER_SERVICE_V1",
  candidate_store_class: "PRIVATE_RESTRICTED_CONTENT_ADDRESSED",
  exact_base_fact_writer: "EVIDENCE_RUNTIME_FENCED_EXACT_BASE_FACT_PROMOTION_V1",
  direct_facts_insert_required: false,
  twin_runtime_authority: false,
  runtime_tick_cursor_authority: false,
  production_owner_activation_performed: false,
  epoch_initialization_performed: false,
  remote_store_provisioning_performed: false,
  formal_v5_arm_performed: false,
  o00_started: false,
} as const;

export type McftCap09V13ForcingPrivateStoreConfigV1 =
  S3CompatiblePrivateRawRetentionConfigV1;

export type McftCap09V13ForcingProductionCompositionConfigV1 = {
  pool: Pool;
  scope: TwinScopeKeyV1;
  epoch_id: string;
  subject_sha: string;
  first_required_base: string;
  last_required_base: string;
  qualified_budget: FormalForcingAcquisitionBudgetAdjudicationV1;
  private_store: McftCap09V13ForcingPrivateStoreConfigV1;
  controller_owner: string;
  producer_owner: string;
  controller_lease_duration_seconds: number;
  producer_lease_duration_seconds: number;
  heartbeat_interval_ms: number;
  clock?: () => Date;
  work_item_config?: Omit<ProductionEvidenceWorkItemFactoryConfigV1, "retention" | "clock">;
};

function required(value: unknown, code: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(code);
  return value.trim();
}
function canonicalHour(value: unknown, code: string): string {
  const text = required(value, code);
  const parsed = Date.parse(text);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== text || !text.endsWith(":00:00.000Z")) {
    throw new Error(code);
  }
  return text;
}
function positiveInteger(value: unknown, code: string, maximum: number): number {
  if (!Number.isInteger(value) || Number(value) <= 0 || Number(value) > maximum) throw new Error(code);
  return Number(value);
}

export function composeMcftCap09V13ForcingProductionV1(
  input: McftCap09V13ForcingProductionCompositionConfigV1,
) {
  const epoch = required(input.epoch_id, "POSTMERGE_V13_COMPOSITION_EPOCH_REQUIRED");
  const subject = required(input.subject_sha, "POSTMERGE_V13_COMPOSITION_SUBJECT_REQUIRED");
  if (!/^[0-9a-f]{40}$/.test(subject)) throw new Error("POSTMERGE_V13_COMPOSITION_SUBJECT_INVALID");
  const first = canonicalHour(input.first_required_base, "POSTMERGE_V13_COMPOSITION_FIRST_BASE_INVALID");
  const last = canonicalHour(input.last_required_base, "POSTMERGE_V13_COMPOSITION_LAST_BASE_INVALID");
  if (Date.parse(first) > Date.parse(last)) throw new Error("POSTMERGE_V13_COMPOSITION_BASE_WINDOW_INVALID");

  const controllerLeaseSeconds = positiveInteger(
    input.controller_lease_duration_seconds,
    "POSTMERGE_V13_COMPOSITION_CONTROLLER_LEASE_INVALID",
    1800,
  );
  const producerLeaseSeconds = positiveInteger(
    input.producer_lease_duration_seconds,
    "POSTMERGE_V13_COMPOSITION_PRODUCER_LEASE_INVALID",
    1800,
  );
  const heartbeatMs = positiveInteger(
    input.heartbeat_interval_ms,
    "POSTMERGE_V13_COMPOSITION_HEARTBEAT_INVALID",
    1_800_000,
  );
  if (heartbeatMs >= Math.min(controllerLeaseSeconds, producerLeaseSeconds) * 1000) {
    throw new Error("POSTMERGE_V13_COMPOSITION_HEARTBEAT_OUTSIDE_LEASE");
  }

  const controllerOwner = required(input.controller_owner, "POSTMERGE_V13_COMPOSITION_CONTROLLER_OWNER_REQUIRED");
  const producerOwner = required(input.producer_owner, "POSTMERGE_V13_COMPOSITION_PRODUCER_OWNER_REQUIRED");
  const clock = input.clock ?? (() => new Date());

  const retention = new S3CompatiblePrivateRawEvidenceRetentionAdapterV1({
    ...input.private_store,
    clock,
  });
  const candidateStore = new S3CompatiblePrivateCandidateManifestStoreV1({
    ...input.private_store,
    clock,
  });
  const rawReader = new S3CompatiblePrivateRetainedRawReaderV1({
    ...input.private_store,
    clock,
  });
  const workItemFactory = new ProductionEvidenceWorkItemFactoryV1({
    ...(input.work_item_config ?? {}),
    retention,
    clock,
  });
  const fencedPromotion = new PostgresEvidenceRuntimeFencedExactBaseFactPromotionV1(
    input.pool,
    retention,
    { scope: input.scope, epoch_id: epoch, subject_sha: subject },
  );
  const capturePromotion = new ExternalFormalPrivateCandidateCapturePromotionV1({
    subject_sha: subject,
    work_item_factory: workItemFactory,
    retention,
    candidate_store: candidateStore,
    raw_reader: rawReader,
    fenced_promotion: fencedPromotion,
    rehydration_decoder_factory: new ProductionExternalFormalCandidateRehydrationDecoderFactoryV1({
      python_executable: input.work_item_config?.python_executable,
      product_decoder_path: input.work_item_config?.gfs_product_decoder_path,
    }),
    clock,
  });

  const continuity = new PostgresExternalFormalForcingBaseContinuityRepositoryV1(input.pool, {
    scope: input.scope,
    epoch_id: epoch,
    subject_sha: subject,
    first_required_base: first,
    last_required_base: last,
  });
  const lifecycle = new PostgresExternalFormalForcingControllerLifecycleV1(input.pool, {
    scope: input.scope,
    epoch_id: epoch,
    subject_sha: subject,
  });
  const admission = new PostgresExternalFormalForcingSupplyAdmissionV1(input.pool, {
    scope: input.scope,
    epoch_id: epoch,
    subject_sha: subject,
    first_required_base: first,
    last_required_base: last,
    qualified_budget: input.qualified_budget,
  });
  const controllerService = new ExternalFormalForcingAutonomousControllerServiceV1(
    lifecycle,
    admission,
    continuity,
    capturePromotion,
    capturePromotion,
    {
      subject_sha: subject,
      controller_owner: controllerOwner,
      producer_owner: producerOwner,
      controller_lease_duration_seconds: controllerLeaseSeconds,
      producer_lease_duration_seconds: producerLeaseSeconds,
      heartbeat_interval_ms: heartbeatMs,
    },
  );

  return {
    composition_id: MCFT_CAP09_V13_FORCING_PRODUCTION_COMPOSITION_ID_V1,
    contract: MCFT_CAP09_V13_FORCING_PRODUCTION_COMPOSITION_CONTRACT_V1,
    controller_service: controllerService,
    controller_lifecycle: lifecycle,
    forcing_continuity: continuity,
    forcing_admission: admission,
    capture_promotion: capturePromotion,
    fenced_promotion: fencedPromotion,
    retention,
    candidate_store: candidateStore,
    raw_reader: rawReader,
    work_item_factory: workItemFactory,
  };
}
