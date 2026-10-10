// MCFT CAP-09 isolated-qualification-only composition seam.
// Reuses the frozen production primitives with a distinct run-scoped bucket.
// DOES NOT call the frozen production wrapper composer or claim exact wrapper equivalence.
// No Provider, database or object-storage operations during construction.
import assert from "node:assert/strict";
import type { Pool } from "pg";
import { MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1 } from "../../apps/server/src/domain/twin_runtime/external_formal_runtime_config_v1.js";
import { MCFT_CAP09_V13_FORCING_PRODUCER_CORE_ID_V1 } from "../../apps/server/src/external_evidence/mcft_cap09_v13_forcing_production_composition_v1.js";
import { S3CompatiblePrivateRawEvidenceRetentionAdapterV1,
  type S3CompatiblePrivateRawRetentionConfigV1 } from "../../apps/server/src/external_evidence/s3_compatible_raw_evidence_retention_adapter_v1.js";
import { S3CompatiblePrivateCandidateManifestStoreV1 } from "../../apps/server/src/external_evidence/s3_compatible_private_candidate_manifest_store_v1.js";
import { S3CompatiblePrivateRetainedRawReaderV1 } from "../../apps/server/src/external_evidence/s3_compatible_private_retained_raw_reader_v1.js";
import { ProductionEvidenceWorkItemFactoryV1 } from "../../apps/server/src/external_evidence/mcft_cap09_production_evidence_work_items_v1.js";
import { PostgresEvidenceRuntimeFencedExactBaseFactPromotionV1 } from "../../apps/server/src/persistence/external_evidence/postgres_evidence_runtime_fenced_exact_base_fact_promotion_v1.js";
import { ExternalFormalPrivateCandidateCapturePromotionV1,
  ProductionExternalFormalCandidateRehydrationDecoderFactoryV1 } from "../../apps/server/src/external_evidence/mcft_cap09_phase7_private_candidate_capture_promotion_v1.js";

export const ISOLATED_V13_COMPOSITION_ID_V1 = "MCFT_CAP09_V13_ISOLATED_QUALIFICATION_COMPOSITION_V1" as const;

export function composeIsolatedMcftCap09V13ProducerCoreV1(input: {
  pool: Pool;
  epoch_id: string;
  subject_sha: string;
  isolated_run_id: string;
  private_store: S3CompatiblePrivateRawRetentionConfigV1;
  clock?: () => Date;
}) {
  assert.match(input.isolated_run_id, /^[a-f0-9]{12}$/, "ISOLATED_RUN_ID_INVALID");
  assert.match(input.subject_sha, /^[a-f0-9]{40}$/, "ISOLATED_SUBJECT_INVALID");
  assert(input.epoch_id.trim().length > 0, "ISOLATED_EPOCH_REQUIRED");
  const bucket = "mcft-cap09-requal-" + input.isolated_run_id;
  assert.equal(input.private_store.bucket, bucket, "ISOLATED_PRODUCER_RUN_SCOPED_BUCKET_REQUIRED");
  const endpoint = new URL(input.private_store.endpoint);
  assert(["127.0.0.1","localhost","[::1]"].includes(endpoint.hostname),
    "ISOLATED_PRODUCER_LOOPBACK_STORAGE_REQUIRED");
  assert(["http:","https:"].includes(endpoint.protocol) && !endpoint.username &&
    !endpoint.password && !endpoint.search && !endpoint.hash,
    "ISOLATED_PRODUCER_STORAGE_ENDPOINT_FORBIDDEN");
  const clock = input.clock ?? (() => new Date());
  const retention = new S3CompatiblePrivateRawEvidenceRetentionAdapterV1({...input.private_store,clock});
  const candidateStore = new S3CompatiblePrivateCandidateManifestStoreV1({...input.private_store,clock});
  const rawReader = new S3CompatiblePrivateRetainedRawReaderV1({...input.private_store,clock});
  const workItemFactory = new ProductionEvidenceWorkItemFactoryV1({retention,clock});
  const fencedPromotion = new PostgresEvidenceRuntimeFencedExactBaseFactPromotionV1(
    input.pool,retention,{
      scope:MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1,
      epoch_id:input.epoch_id,
      subject_sha:input.subject_sha,
    });
  const capturePromotion = new ExternalFormalPrivateCandidateCapturePromotionV1({
    subject_sha:input.subject_sha,
    work_item_factory:workItemFactory,
    retention,
    candidate_store:candidateStore,
    raw_reader:rawReader,
    fenced_promotion:fencedPromotion,
    rehydration_decoder_factory:new ProductionExternalFormalCandidateRehydrationDecoderFactoryV1(),
    clock,
  });
  return {
    producer_core_id:MCFT_CAP09_V13_FORCING_PRODUCER_CORE_ID_V1,
    isolated_composition_id:ISOLATED_V13_COMPOSITION_ID_V1,
    production_wrapper_composer_reused:false,
    production_canonical_primitive_implementations_reused:true,
    capture_promotion:capturePromotion,
    fenced_promotion:fencedPromotion,
    retention,
    candidate_store:candidateStore,
    raw_reader:rawReader,
    work_item_factory:workItemFactory,
  };
}
