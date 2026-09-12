// MCFT-CAP-09 Phase7 exact-base private candidate capture/promotion composition.
// Boundary: implements the autonomous forcing controller capture/promotion ports without owning
// cadence, scheduler, controller lease, producer claim, or production process activation.
// Capture may call the injected Evidence work-item factory and durable raw retention.
// Promotion MUST rehydrate only the content-addressed private candidate/raw objects; no provider refetch.

import crypto from "node:crypto";

import { MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1 } from "../domain/twin_runtime/external_formal_runtime_config_v1.js";
import {
  ExternalFormalExactBasePromotionFailureV1,
  type ExternalFormalExactBaseCapturePortV1,
  type ExternalFormalExactBaseCaptureReceiptV1,
  type ExternalFormalExactBasePromotionPortV1,
  type ExternalFormalExactBasePromotionReceiptV1,
} from "../runtime/twin_runtime/external_formal_forcing_autonomous_controller_service_v1.js";
import type {
  ExternalFormalForcingBaseClaimV1,
} from "../runtime/twin_runtime/postgres_external_formal_forcing_base_continuity_repository_v1.js";
import type {
  ExternalFormalForcingControllerLeaseV1,
} from "../runtime/twin_runtime/postgres_external_formal_forcing_controller_lifecycle_v1.js";
import {
  type PostgresExternalFormalFencedExactBaseFactPromotionV1,
  PostgresExternalFormalFencedPromotionFailureV1,
} from "../persistence/twin_runtime/postgres_external_formal_fenced_exact_base_fact_promotion_v1.js";
import {
  collectRetainDecodeCanonicalizeExternalEvidenceV1,
  collectRetainDecodeCanonicalizeExternalEvidenceWithCompletionClockV1,
  type CanonicalizedExternalEvidenceResultV1,
  type ExternalEvidenceDecoderPortV1,
  type RawEvidenceRetentionPortV1,
  type VerifiedRawEvidenceProvenanceV1,
} from "./mcft_cap09_external_collector_canonicalizer_v1.js";
import type {
  ProductionEvidenceWorkItemFactoryV1,
  ProductionEvidenceSourceFamilyV1,
} from "./mcft_cap09_production_evidence_work_items_v1.js";
import {
  KbsVariate25SoilEvidenceDecoderV1,
  MCFT_CAP09_KBS_SOIL_DATASET_ID_V1,
} from "./provider/kbs_variate25_soil_provider_v1.js";
import {
  GfsRawBundleEvidenceDecoderV1,
  type GfsRawBundleEvidenceDecoderConfigV1,
} from "./provider/gfs_raw_bundle_evidence_decoder_v1.js";
import {
  MCFT_CAP09_GFS_BUNDLE_PROVIDER_ID_V1,
  MCFT_CAP09_GFS_BUNDLE_SOURCE_FAMILY_V1,
} from "./provider/gfs_nomads_bundle_transport_v1.js";
import {
  MCFT_CAP09_PRIVATE_CANDIDATE_MANIFEST_SCHEMA_V1,
  type S3CompatiblePrivateCandidateManifestStoreV1,
  type ExternalFormalCandidateRawProvenanceV1,
  type ExternalFormalCandidateSemanticRecordV1,
  type ExternalFormalExactBaseCandidateManifestV1,
} from "./s3_compatible_private_candidate_manifest_store_v1.js";
import type {
  S3CompatiblePrivateRetainedRawReaderV1,
} from "./s3_compatible_private_retained_raw_reader_v1.js";
import {
  buildVerifiedRetainedRawReplayRequestV1,
  ExistingRetainedRawVerificationBarrierV1,
  VerifiedRetainedRawReadbackTransportV1,
} from "./verified_retained_raw_replay_v1.js";

export const MCFT_CAP09_PHASE7_PRIVATE_CANDIDATE_CAPTURE_PROMOTION_ID_V1 =
  "MCFT_CAP09_PHASE7_PRIVATE_CANDIDATE_CAPTURE_PROMOTION_V1" as const;

const CAPTURE_FAMILIES: readonly ProductionEvidenceSourceFamilyV1[] = ["KBS_SOIL", "GFS_BUNDLE"];
const EXPECTED_TYPES = [
  "future_et0_assumption_v1",
  "future_weather_assumption_v1",
  "soil_moisture_observation_v1",
] as const;
const GFS_DATASET_ID = "noaa_ncep_gfs_same_cycle_72h_bundle_v1";

type WorkItemFactoryV1 = Pick<ProductionEvidenceWorkItemFactoryV1, "buildForTarget">;
type CandidateStoreV1 = Pick<
  S3CompatiblePrivateCandidateManifestStoreV1,
  "writeCandidateManifest" | "readCandidateManifest"
>;
type RawReaderV1 = Pick<S3CompatiblePrivateRetainedRawReaderV1, "readRetainedRawEvidence">;
type FencedPromotionV1 = Pick<PostgresExternalFormalFencedExactBaseFactPromotionV1, "promote">;

export interface ExternalFormalCandidateRehydrationDecoderFactoryV1 {
  createDecoder(input: {
    base_target_t: string;
    raw: ExternalFormalCandidateRawProvenanceV1;
  }): ExternalEvidenceDecoderPortV1;
}

export type ProductionExternalFormalCandidateDecoderFactoryConfigV1 = Pick<
  GfsRawBundleEvidenceDecoderConfigV1,
  "python_executable" | "product_decoder_path"
>;

export class ProductionExternalFormalCandidateRehydrationDecoderFactoryV1
  implements ExternalFormalCandidateRehydrationDecoderFactoryV1 {
  constructor(private readonly config: ProductionExternalFormalCandidateDecoderFactoryConfigV1 = {}) {}

  createDecoder(input: {
    base_target_t: string;
    raw: ExternalFormalCandidateRawProvenanceV1;
  }): ExternalEvidenceDecoderPortV1 {
    const raw = input.raw;
    if (
      raw.provider_id === "KBS_LTER"
      && raw.source_family === "CURRENT_WEATHER_VARIATE_JSON"
      && raw.dataset_id === MCFT_CAP09_KBS_SOIL_DATASET_ID_V1
    ) {
      return new KbsVariate25SoilEvidenceDecoderV1();
    }
    if (
      raw.provider_id === MCFT_CAP09_GFS_BUNDLE_PROVIDER_ID_V1
      && raw.source_family === MCFT_CAP09_GFS_BUNDLE_SOURCE_FAMILY_V1
      && raw.dataset_id === GFS_DATASET_ID
    ) {
      return new GfsRawBundleEvidenceDecoderV1(input.base_target_t, {
        ...this.config,
        normalize_et0: true,
        restored_ingested_at: requiredText(
          raw.canonical_record_ingested_at,
          "PHASE7_REHYDRATION_GFS_INGESTED_AT_REQUIRED",
        ),
      });
    }
    throw new Error(
      "PHASE7_CANDIDATE_REHYDRATION_DECODER_AUTHORITY_UNSUPPORTED:"
      + raw.provider_id + ":" + raw.source_family + ":" + raw.dataset_id,
    );
  }
}

export type ExternalFormalPrivateCandidateCapturePromotionConfigV1 = {
  subject_sha: string;
  work_item_factory: WorkItemFactoryV1;
  retention: RawEvidenceRetentionPortV1;
  candidate_store: CandidateStoreV1;
  raw_reader: RawReaderV1;
  fenced_promotion: FencedPromotionV1;
  rehydration_decoder_factory?: ExternalFormalCandidateRehydrationDecoderFactoryV1;
  clock?: () => Date;
};

function requiredText(value: unknown, code: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(code);
  return value.trim();
}
function canonicalIso(value: unknown, code: string): string {
  const text = requiredText(value, code);
  const parsed = Date.parse(text);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== text) throw new Error(code);
  return text;
}
function canonicalHour(value: unknown, code: string): string {
  const text = canonicalIso(value, code);
  if (!text.endsWith(":00:00.000Z")) throw new Error(code);
  return text;
}
function sha256Hex(value: string): string {
  return crypto.createHash("sha256").update(value, "utf8").digest("hex");
}
function producerRunId(idempotencyKey: string): string {
  return "phase7-capture:" + sha256Hex(requiredText(idempotencyKey, "PHASE7_CAPTURE_IDEMPOTENCY_REQUIRED"));
}
function promotionRunId(candidateDigest: string): string {
  const match = /^sha256:([0-9a-f]{64})$/.exec(requiredText(candidateDigest, "PHASE7_PROMOTION_CANDIDATE_DIGEST_REQUIRED"));
  if (!match) throw new Error("PHASE7_PROMOTION_CANDIDATE_DIGEST_INVALID");
  return "phase7-promotion:" + match[1];
}
function exactSubject(value: string, expected: string, code: string): void {
  if (!/^[0-9a-f]{40}$/.test(value) || value !== expected) throw new Error(code);
}
function semanticManifest(results: readonly CanonicalizedExternalEvidenceResultV1[]): ExternalFormalCandidateSemanticRecordV1[] {
  return results.map((result) => ({
    record_type: result.record.record_type,
    source_record_id: result.record.source_record_id,
    record_semantic_sha256: result.record_semantic_sha256,
  })).sort((a,b) => a.record_type.localeCompare(b.record_type) || a.source_record_id.localeCompare(b.source_record_id));
}
function sameManifest(
  left: readonly ExternalFormalCandidateSemanticRecordV1[],
  right: readonly ExternalFormalCandidateSemanticRecordV1[],
): boolean {
  const normalize = (rows: readonly ExternalFormalCandidateSemanticRecordV1[]) =>
    [...rows].map((row) => ({...row})).sort((a,b) =>
      a.record_type.localeCompare(b.record_type) || a.source_record_id.localeCompare(b.source_record_id)
    );
  return JSON.stringify(normalize(left)) === JSON.stringify(normalize(right));
}
function ingestedAtForResults(results: readonly CanonicalizedExternalEvidenceResultV1[]): string {
  const values = [...new Set(results.map((result) =>
    canonicalIso(result.record.role_time?.ingested_at, "PHASE7_CAPTURE_RECORD_INGESTED_AT_INVALID")
  ))];
  if (values.length !== 1) throw new Error("PHASE7_CAPTURE_RAW_GROUP_INGESTED_AT_NOT_UNIQUE");
  return values[0]!;
}
function rawCandidate(
  item: { dataset_id: string },
  results: readonly CanonicalizedExternalEvidenceResultV1[],
): ExternalFormalCandidateRawProvenanceV1 {
  if (results.length === 0) throw new Error("PHASE7_CAPTURE_RAW_GROUP_RESULT_REQUIRED");
  const first = results[0]!;
  for (const result of results) {
    if (
      result.raw_provenance.raw_sha256 !== first.raw_provenance.raw_sha256
      || result.raw_provenance.retention_ref !== first.raw_provenance.retention_ref
      || result.decoder.decoder_id !== first.decoder.decoder_id
      || result.decoder.decoder_version !== first.decoder.decoder_version
    ) {
      throw new Error("PHASE7_CAPTURE_RAW_GROUP_PROVENANCE_DRIFT");
    }
  }
  const raw = first.raw_provenance;
  return {
    retention_ref: raw.retention_ref,
    retained_sha256: raw.raw_sha256,
    retained_bytes: raw.raw_bytes,
    retained_at: raw.retained_at,
    request_id: raw.request_id,
    provider_id: raw.provider_id,
    source_family: raw.source_family,
    source_locator: raw.source_locator,
    final_locator: raw.final_locator,
    content_type: raw.content_type,
    retrieved_at: raw.retrieved_at,
    available_at: raw.available_at,
    use_policy_ref: raw.use_policy_ref,
    dataset_id: item.dataset_id,
    decoder_id: first.decoder.decoder_id,
    decoder_version: first.decoder.decoder_version,
    canonical_record_ingested_at: ingestedAtForResults(results),
    ...(raw.source_issue_time ? {source_issue_time:raw.source_issue_time} : {}),
    ...(raw.source_event_time ? {source_event_time:raw.source_event_time} : {}),
  };
}
function candidateReplayProvenanceV1(
  raw: ExternalFormalCandidateRawProvenanceV1,
): VerifiedRawEvidenceProvenanceV1 {
  return {
    request_id: raw.request_id,
    provider_id: raw.provider_id,
    source_family: raw.source_family,
    source_locator: raw.source_locator,
    final_locator: raw.final_locator,
    content_type: raw.content_type,
    retrieved_at: raw.retrieved_at,
    available_at: raw.available_at,
    raw_sha256: raw.retained_sha256,
    raw_bytes: raw.retained_bytes,
    retention_ref: raw.retention_ref,
    retained_at: raw.retained_at,
    use_policy_ref: raw.use_policy_ref,
    ...(raw.source_issue_time ? { source_issue_time: raw.source_issue_time } : {}),
    ...(raw.source_event_time ? { source_event_time: raw.source_event_time } : {}),
  };
}

export class ExternalFormalPrivateCandidateCapturePromotionV1
  implements ExternalFormalExactBaseCapturePortV1, ExternalFormalExactBasePromotionPortV1 {
  readonly composition_id = MCFT_CAP09_PHASE7_PRIVATE_CANDIDATE_CAPTURE_PROMOTION_ID_V1;
  private readonly subject: string;
  private readonly clock: () => Date;
  private readonly decoderFactory: ExternalFormalCandidateRehydrationDecoderFactoryV1;

  constructor(private readonly config: ExternalFormalPrivateCandidateCapturePromotionConfigV1) {
    this.subject = requiredText(config.subject_sha, "PHASE7_CAPTURE_PROMOTION_SUBJECT_REQUIRED");
    if (!/^[0-9a-f]{40}$/.test(this.subject)) throw new Error("PHASE7_CAPTURE_PROMOTION_SUBJECT_INVALID");
    this.clock = config.clock ?? (() => new Date());
    this.decoderFactory = config.rehydration_decoder_factory
      ?? new ProductionExternalFormalCandidateRehydrationDecoderFactoryV1();
  }

  async captureExactBase(input: {
    base_target_t: string;
    subject_sha: string;
    idempotency_key: string;
  }): Promise<ExternalFormalExactBaseCaptureReceiptV1> {
    const base = canonicalHour(input.base_target_t, "PHASE7_CAPTURE_BASE_INVALID");
    exactSubject(input.subject_sha, this.subject, "PHASE7_CAPTURE_SUBJECT_MISMATCH");
    const idempotency = requiredText(input.idempotency_key, "PHASE7_CAPTURE_IDEMPOTENCY_REQUIRED");
    const requestedAt = canonicalIso(this.clock().toISOString(), "PHASE7_CAPTURE_REQUESTED_AT_INVALID");
    if (Date.parse(requestedAt) >= Date.parse(base)) throw new Error("PHASE7_CAPTURE_STARTED_AT_OR_AFTER_BASE");
    const prefix = "phase7:" + sha256Hex(idempotency).slice(0,24);
    const items = this.config.work_item_factory.buildForTarget({
      target_logical_time: base,
      requested_at: requestedAt,
      request_id_prefix: prefix,
      source_families: CAPTURE_FAMILIES,
    });
    if (items.length !== 2) throw new Error("PHASE7_CAPTURE_EXACT_TWO_WORK_ITEMS_REQUIRED");

    const all: CanonicalizedExternalEvidenceResultV1[] = [];
    const raws: ExternalFormalCandidateRawProvenanceV1[] = [];
    for (const item of items) {
      const results = await collectRetainDecodeCanonicalizeExternalEvidenceWithCompletionClockV1(
        {
          dataset_id: item.dataset_id,
          scope: { ...MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1 },
          request: item.request,
        },
        {
          transport: item.transport,
          retention: this.config.retention,
          decoder: item.decoder,
        },
        () => canonicalIso(this.clock().toISOString(), "PHASE7_CAPTURE_CANONICALIZED_AT_INVALID"),
      );
      all.push(...results);
      raws.push(rawCandidate(item, results));
    }

    const actualTypes = [...all.map((result) => result.record.record_type)].sort();
    if (all.length !== 3 || JSON.stringify(actualTypes) !== JSON.stringify(EXPECTED_TYPES)) {
      throw new Error("PHASE7_CAPTURE_EXACT_THREE_RECORD_TYPES_REQUIRED");
    }
    if (new Set(raws.map((raw) => raw.retained_sha256)).size !== 2) {
      throw new Error("PHASE7_CAPTURE_EXACT_TWO_RAW_OBJECTS_REQUIRED");
    }

    const capturedAt = canonicalIso(this.clock().toISOString(), "PHASE7_CAPTURE_CAPTURED_AT_INVALID");
    if (Date.parse(capturedAt) >= Date.parse(base)) throw new Error("PHASE7_CAPTURE_COMPLETED_AT_OR_AFTER_BASE");
    for (const raw of raws) {
      const ingestedAt = requiredText(
        raw.canonical_record_ingested_at,
        "PHASE7_CAPTURE_CANONICAL_RECORD_INGESTED_AT_REQUIRED",
      );
      if (Date.parse(ingestedAt) > Date.parse(capturedAt)) {
        throw new Error("PHASE7_CAPTURE_MANIFEST_BEFORE_CANONICAL_RECORD");
      }
    }
    const runId = producerRunId(idempotency);
    const manifest: ExternalFormalExactBaseCandidateManifestV1 = {
      schema_version: MCFT_CAP09_PRIVATE_CANDIDATE_MANIFEST_SCHEMA_V1,
      base_target_t: base,
      subject_sha: this.subject,
      producer_run_id: runId,
      captured_at: capturedAt,
      candidate_expires_at: base,
      expected_records: semanticManifest(all),
      raw_objects: raws,
      raw_values_emitted: false,
      side_effects: {
        formal_database_write_count: 0,
        runtime_write_count: 0,
        scheduler_write_count: 0,
        twin_state_mutation: false,
        provider_refetch_during_rehydration_authorized: false,
      },
    };
    const stored = await this.config.candidate_store.writeCandidateManifest(manifest);
    if (stored.formal_database_write_count !== 0 || stored.externally_publishable !== false) {
      throw new Error("PHASE7_CAPTURE_STORE_BOUNDARY_VIOLATION");
    }
    return {
      base_target_t: base,
      producer_run_id: runId,
      candidate_artifact_digest: stored.candidate_artifact_digest,
      capture_ref: stored.capture_ref,
      raw_values_emitted: false,
      formal_database_write_count: 0,
    };
  }

  private async rehydrateCandidate(input: {
    base_target_t: string;
    capture: ExternalFormalExactBaseCaptureReceiptV1;
    idempotency_key: string;
  }): Promise<{
    manifest: ExternalFormalExactBaseCandidateManifestV1;
    results: CanonicalizedExternalEvidenceResultV1[];
  }> {
    const read = await this.config.candidate_store.readCandidateManifest({
      capture_ref: input.capture.capture_ref,
      candidate_artifact_digest: input.capture.candidate_artifact_digest,
    });
    const manifest = read.manifest;
    if (
      manifest.base_target_t !== input.base_target_t
      || manifest.subject_sha !== this.subject
      || manifest.producer_run_id !== producerRunId(input.idempotency_key)
      || input.capture.producer_run_id !== manifest.producer_run_id
      || manifest.raw_values_emitted !== false
      || manifest.side_effects.provider_refetch_during_rehydration_authorized !== false
    ) throw new Error("PHASE7_PROMOTION_CANDIDATE_IDENTITY_OR_BOUNDARY_MISMATCH");
    const now = canonicalIso(this.clock().toISOString(), "PHASE7_PROMOTION_REHYDRATION_CLOCK_INVALID");
    if (Date.parse(now) >= Date.parse(manifest.candidate_expires_at)) {
      throw new Error("PHASE7_PROMOTION_CANDIDATE_EXPIRED");
    }
    if (manifest.raw_objects.length !== 2) throw new Error("PHASE7_PROMOTION_EXACT_TWO_RAW_OBJECTS_REQUIRED");

    const results: CanonicalizedExternalEvidenceResultV1[] = [];
    for (const raw of manifest.raw_objects) {
      const rawRead = await this.config.raw_reader.readRetainedRawEvidence({
        retention_ref: raw.retention_ref,
        retained_sha256: raw.retained_sha256,
        retained_bytes: raw.retained_bytes,
      });
      if (rawRead.provider_refetch_count !== 0 || rawRead.raw_store_write_count !== 0 || rawRead.formal_database_write_count !== 0) {
        throw new Error("PHASE7_PROMOTION_RAW_READER_SIDE_EFFECT");
      }
      const datasetId = requiredText(raw.dataset_id, "PHASE7_PROMOTION_DATASET_ID_REQUIRED");
      const decoderId = requiredText(raw.decoder_id, "PHASE7_PROMOTION_DECODER_ID_REQUIRED");
      const decoderVersion = requiredText(raw.decoder_version, "PHASE7_PROMOTION_DECODER_VERSION_REQUIRED");
      requiredText(raw.canonical_record_ingested_at, "PHASE7_PROMOTION_CANONICAL_RECORD_INGESTED_AT_REQUIRED");
      const decoder = this.decoderFactory.createDecoder({ base_target_t: input.base_target_t, raw });
      if (decoder.decoder_id !== decoderId || decoder.decoder_version !== decoderVersion) {
        throw new Error("PHASE7_PROMOTION_DECODER_IDENTITY_MISMATCH");
      }
      const canonical = await collectRetainDecodeCanonicalizeExternalEvidenceV1(
        {
          dataset_id: datasetId,
          scope: { ...MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1 },
          request: buildVerifiedRetainedRawReplayRequestV1(
            candidateReplayProvenanceV1(raw),
            { purpose_limitations: ["PRIVATE_CANDIDATE_REHYDRATION"] },
          ),
          canonicalized_at: now,
        },
        {
          transport: new VerifiedRetainedRawReadbackTransportV1(
            candidateReplayProvenanceV1(raw),
            rawRead,
          ),
          retention: new ExistingRetainedRawVerificationBarrierV1(
            candidateReplayProvenanceV1(raw),
            rawRead,
          ),
          decoder,
        },
      );
      results.push(...canonical);
    }
    if (results.length !== 3 || !sameManifest(semanticManifest(results), manifest.expected_records)) {
      throw new Error("PHASE7_PROMOTION_REHYDRATED_SEMANTIC_MANIFEST_MISMATCH");
    }
    return { manifest, results };
  }

  async promoteExactBase(input: {
    base_target_t: string;
    subject_sha: string;
    idempotency_key: string;
    capture: ExternalFormalExactBaseCaptureReceiptV1;
    controller_lease: ExternalFormalForcingControllerLeaseV1;
    producer_claim: ExternalFormalForcingBaseClaimV1;
  }): Promise<ExternalFormalExactBasePromotionReceiptV1> {
    const base = canonicalHour(input.base_target_t, "PHASE7_PROMOTION_BASE_INVALID");
    exactSubject(input.subject_sha, this.subject, "PHASE7_PROMOTION_SUBJECT_MISMATCH");
    const idempotency = requiredText(input.idempotency_key, "PHASE7_PROMOTION_IDEMPOTENCY_REQUIRED");
    if (
      input.capture.base_target_t !== base
      || input.capture.raw_values_emitted !== false
      || input.capture.formal_database_write_count !== 0
      || input.producer_claim.idempotency_key !== idempotency
    ) {
      throw new ExternalFormalExactBasePromotionFailureV1({
        failure_class: "PHASE7_PROMOTION_CAPTURE_OR_CLAIM_IDENTITY_MISMATCH",
        mutation_state: "NO_FORMAL_MUTATION",
        formal_database_write_count: 0,
      });
    }

    let rehydrated: {
      manifest: ExternalFormalExactBaseCandidateManifestV1;
      results: CanonicalizedExternalEvidenceResultV1[];
    };
    try {
      rehydrated = await this.rehydrateCandidate({
        base_target_t: base,
        capture: input.capture,
        idempotency_key: idempotency,
      });
    } catch (error) {
      throw new ExternalFormalExactBasePromotionFailureV1({
        failure_class: "PHASE7_PROMOTION_REHYDRATION_FAILED:" + (error instanceof Error ? error.message : String(error)),
        mutation_state: "NO_FORMAL_MUTATION",
        formal_database_write_count: 0,
        cause: error,
      });
    }

    try {
      const promoted = await this.config.fenced_promotion.promote({
        base_target_t: base,
        controller_lease: input.controller_lease,
        producer_claim: input.producer_claim,
        results: rehydrated.results,
        expected_semantic_manifest: rehydrated.manifest.expected_records,
      });
      return {
        base_target_t: base,
        promotion_run_id: promotionRunId(input.capture.candidate_artifact_digest),
        facts: promoted.facts,
        formal_fact_present_count: promoted.formal_fact_present_count,
        formal_database_write_count: promoted.formal_database_write_count,
        idempotent_existing_fact_count: promoted.idempotent_existing_fact_count,
        database_fence_commit_succeeded: true,
      };
    } catch (error) {
      if (error instanceof PostgresExternalFormalFencedPromotionFailureV1) {
        throw new ExternalFormalExactBasePromotionFailureV1({
          failure_class: error.failure_class,
          mutation_state: error.mutation_state === "NO_FORMAL_MUTATION" ? "NO_FORMAL_MUTATION" : "UNKNOWN_FORMAL_MUTATION",
          formal_database_write_count: error.mutation_state === "NO_FORMAL_MUTATION" ? 0 : null,
          cause: error,
        });
      }
      if (error instanceof ExternalFormalExactBasePromotionFailureV1) throw error;
      throw new ExternalFormalExactBasePromotionFailureV1({
        failure_class: "PHASE7_PROMOTION_FENCED_PORT_OUTCOME_UNKNOWN:" + (error instanceof Error ? error.message : String(error)),
        mutation_state: "UNKNOWN_FORMAL_MUTATION",
        formal_database_write_count: null,
        cause: error,
      });
    }
  }
}
