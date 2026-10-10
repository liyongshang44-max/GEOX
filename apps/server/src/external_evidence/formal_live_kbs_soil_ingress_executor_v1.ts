// MCFT-CAP-09 S6-EA5C2B1 live KBS soil Evidence ingress compatibility composition.
// Provider transport/decoder semantics live in production modules under external_evidence/provider.
// This entrypoint preserves historical qualification imports while composing retention + governed ingress.

import crypto from "node:crypto";
import type { Pool } from "pg";

import { MCFT_CAP09_EXTERNAL_FORMAL_SOIL_BINDING_ID_V1 } from "../domain/twin_runtime/external_formal_evidence_binding_profile_v1.js";
import { MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1 } from "../domain/twin_runtime/external_formal_runtime_config_v1.js";
import {
  collectRetainDecodeCanonicalizeExternalEvidenceV1,
  type ExternalEvidenceFetchRequestV1,
  type ExternalEvidenceFetchResponseV1,
  type ExternalEvidenceTransportPortV1,
  type RawEvidenceRetentionPortV1,
} from "./mcft_cap09_external_collector_canonicalizer_v1.js";
import type { RawEvidenceRetentionVerificationPortV1 } from "./s3_compatible_raw_evidence_retention_adapter_v1.js";
import { PostgresExternalFormalEvidenceIngressV1 } from "../persistence/twin_runtime/postgres_external_formal_evidence_ingress_v1.js";
import {
  KbsVariate25SoilEvidenceDecoderV1,
  MCFT_CAP09_KBS_SOIL_DATASET_ID_V1,
  fetchKbsVariate25SoilRawV1,
  type KbsVariate25SoilRawV1,
} from "./provider/kbs_variate25_soil_provider_v1.js";

export {
  KbsVariate25SoilEvidenceDecoderV1,
  MCFT_CAP09_KBS_SOIL_ENDPOINT_V1,
  MCFT_CAP09_KBS_SOIL_DATASET_ID_V1,
  MCFT_CAP09_KBS_SOIL_DECODER_ID_V1,
  MCFT_CAP09_KBS_SOIL_DECODER_VERSION_V1,
  MCFT_CAP09_KBS_SOIL_USE_POLICY_REF_V1,
} from "./provider/kbs_variate25_soil_provider_v1.js";

export const MCFT_CAP09_EA5C2B1_KBS_SOIL_EXECUTOR_ID_V1 =
  "MCFT_CAP09_EA5C2B1_LIVE_KBS_SOIL_INGRESS_EXECUTOR_V1" as const;

export type PrefetchedKbsSoilRawV1 = KbsVariate25SoilRawV1;

export type LiveKbsSoilIngressPublicProofV1 = {
  executor_id: typeof MCFT_CAP09_EA5C2B1_KBS_SOIL_EXECUTOR_ID_V1;
  status: "INSERTED" | "EXISTING_IDEMPOTENT_SUCCESS";
  fact_id: string;
  source_record_id: string;
  record_type: "soil_moisture_observation_v1";
  binding_id: typeof MCFT_CAP09_EXTERNAL_FORMAL_SOIL_BINDING_ID_V1;
  observed_at: string;
  retrieved_at: string;
  raw_sha256: string;
  raw_bytes: number;
  retention_ref: string;
  canonical_fact_write_count: 0 | 1;
  raw_value_emitted: false;
  runtime_public_provider_fetch_count: 0;
};

type NowV1 = () => Date;
type FetchImplV1 = typeof fetch;
type DurableRetentionV1 = RawEvidenceRetentionPortV1 & RawEvidenceRetentionVerificationPortV1;

function canonicalIsoV1(value: unknown, code: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(code);
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== value) throw new Error(code);
  return value;
}

function requireConditionV1(condition: unknown, code: string): asserts condition {
  if (!condition) throw new Error(code);
}

export async function prefetchLiveKbsVariate25RawV1(input: {
  fetch_impl?: FetchImplV1;
  now?: NowV1;
} = {}): Promise<PrefetchedKbsSoilRawV1> {
  const now = input.now ?? (() => new Date());
  const requestedAt = now().toISOString();
  return fetchKbsVariate25SoilRawV1({
    request_id: `ea5c2b1-kbs-soil-${crypto.randomUUID()}`,
    requested_at: requestedAt,
    fetch_impl: input.fetch_impl,
    clock: now,
  });
}

class OneShotPrefetchedTransportV1 implements ExternalEvidenceTransportPortV1 {
  private used = false;
  constructor(private readonly prefetched: PrefetchedKbsSoilRawV1) {}
  async fetchRawEvidence(request: ExternalEvidenceFetchRequestV1): Promise<ExternalEvidenceFetchResponseV1> {
    if (this.used) throw new Error("EA5C2B1_PREFETCHED_TRANSPORT_REUSE_FORBIDDEN");
    this.used = true;
    if (request.request_id !== this.prefetched.request.request_id || request.locator !== this.prefetched.request.locator) {
      throw new Error("EA5C2B1_PREFETCHED_REQUEST_IDENTITY_MISMATCH");
    }
    return this.prefetched.response;
  }
}

export async function executePrefetchedKbsSoilFormalIngressV1(input: {
  pool: Pool;
  retention: DurableRetentionV1;
  prefetched: PrefetchedKbsSoilRawV1;
  canonicalized_at: string;
}): Promise<LiveKbsSoilIngressPublicProofV1> {
  const canonicalizedAt = canonicalIsoV1(input.canonicalized_at, "EA5C2B1_CANONICALIZED_AT_INVALID");
  requireConditionV1(
    Date.parse(canonicalizedAt) >= Date.parse(input.prefetched.response.retrieved_at),
    "EA5C2B1_CANONICALIZED_BEFORE_RETRIEVAL",
  );
  const results = await collectRetainDecodeCanonicalizeExternalEvidenceV1(
    {
      dataset_id: MCFT_CAP09_KBS_SOIL_DATASET_ID_V1,
      scope: { ...MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1 },
      request: input.prefetched.request,
      canonicalized_at: canonicalizedAt,
    },
    {
      transport: new OneShotPrefetchedTransportV1(input.prefetched),
      retention: input.retention,
      decoder: new KbsVariate25SoilEvidenceDecoderV1(),
    },
  );
  requireConditionV1(results.length === 1, `EA5C2B1_EXACT_ONE_SOIL_RECORD_REQUIRED:${results.length}`);
  const canonical = results[0];
  requireConditionV1(canonical.record.record_type === "soil_moisture_observation_v1", "EA5C2B1_SOIL_RECORD_TYPE_REQUIRED");
  requireConditionV1(canonical.record.binding_id === MCFT_CAP09_EXTERNAL_FORMAL_SOIL_BINDING_ID_V1, "EA5C2B1_SOIL_BINDING_REQUIRED");
  const ingress = new PostgresExternalFormalEvidenceIngressV1(input.pool, input.retention);
  const persisted = await ingress.appendCanonicalizedExternalEvidence(canonical);
  const observedAt = canonicalIsoV1(canonical.record.role_time.observed_at, "EA5C2B1_OBSERVED_AT_INVALID");

  return {
    executor_id: MCFT_CAP09_EA5C2B1_KBS_SOIL_EXECUTOR_ID_V1,
    status: persisted.status,
    fact_id: persisted.fact_id,
    source_record_id: persisted.source_record_id,
    record_type: "soil_moisture_observation_v1",
    binding_id: MCFT_CAP09_EXTERNAL_FORMAL_SOIL_BINDING_ID_V1,
    observed_at: observedAt,
    retrieved_at: input.prefetched.response.retrieved_at,
    raw_sha256: persisted.raw_sha256,
    raw_bytes: persisted.raw_bytes,
    retention_ref: persisted.retention_ref,
    canonical_fact_write_count: persisted.canonical_fact_write_count,
    raw_value_emitted: false,
    runtime_public_provider_fetch_count: 0,
  };
}

export async function executeFormalLiveKbsSoilIngressV1(input: {
  pool: Pool;
  retention: DurableRetentionV1;
  fetch_impl?: FetchImplV1;
  now?: NowV1;
}): Promise<LiveKbsSoilIngressPublicProofV1> {
  const now = input.now ?? (() => new Date());
  const prefetched = await prefetchLiveKbsVariate25RawV1({ fetch_impl: input.fetch_impl, now });
  const canonicalizedAt = now().toISOString();
  return executePrefetchedKbsSoilFormalIngressV1({
    pool: input.pool,
    retention: input.retention,
    prefetched,
    canonicalized_at: canonicalizedAt,
  });
}
