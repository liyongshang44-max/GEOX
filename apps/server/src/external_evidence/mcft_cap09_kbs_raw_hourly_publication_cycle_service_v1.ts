// MCFT-CAP-09 KBS Raw Hourly complete-table publication cycle service.
// Source-specific Evidence-plane orchestration only. It reuses the canonical collector,
// governed ingress, post-COMMIT visibility, EvidenceSupplyCursor, and Evidence producer lease.
// It owns no cadence, scheduler, process lifecycle, Twin state, or production activation.
//
// Critical order: pointer advance is LAST, after every forward rainfall/ET0 record is
// committed, visible, and durably reflected in EvidenceSupplyCursor.

import type {
  ExternalEvidenceDecoderPortV1,
  ExternalEvidenceFetchRequestV1,
  ExternalEvidenceTransportPortV1,
  RawEvidenceRetentionPortV1,
  VerifiedRawEvidenceProvenanceV1,
} from "./mcft_cap09_external_collector_canonicalizer_v1.js";
import {
  collectAndRetainRawEvidenceV1,
  collectRetainDecodeCanonicalizeExternalEvidenceWithCompletionClockV1,
} from "./mcft_cap09_external_collector_canonicalizer_v1.js";
import type {
  ExternalFormalEvidenceIngressPortV1,
} from "./mcft_cap09_external_formal_collector_phase_orchestrator_v1.js";
import {
  PostCommitVisibleExternalFormalEvidenceIngressV1,
  type EvidenceSupplyCursorPortV1,
  type ExternalEvidencePostCommitVisibilityPortV1,
} from "./mcft_cap09_evidence_visibility_supply_cursor_v1.js";
import type {
  EvidenceProducerLeaseClaimV1,
  EvidenceProducerLeasePortV1,
  EvidenceRuntimeScopeV1,
} from "./mcft_cap09_evidence_runtime_persistence_v1.js";
import {
  MCFT_CAP09_KBS_PUBLICATION_BASELINE_SCHEMA_V1,
  type KbsRawHourlyPublicationBaselineManifestV1,
  type KbsRawHourlyPublicationBaselineReadReceiptV1,
  type KbsRawHourlyPublicationBaselineWriteReceiptV1,
} from "./kbs_raw_hourly_publication_baseline_store_v1.js";
import type {
  KbsRawHourlyPublicationBaselinePointerPortV1,
  KbsRawHourlyPublicationBaselinePointerSnapshotV1,
} from "./mcft_cap09_kbs_publication_baseline_pointer_v1.js";
import type {
  PrivateRetainedRawReadReceiptV1,
} from "./s3_compatible_private_retained_raw_reader_v1.js";
import {
  buildVerifiedRetainedRawReplayRequestV1,
  ExistingRetainedRawVerificationBarrierV1,
  VerifiedRetainedRawReadbackTransportV1,
} from "./verified_retained_raw_replay_v1.js";
import {
  KbsRawHourlyExactIntervalDecoderV1,
  KbsRawHourlyMultiIntervalDecoderV1,
  type KbsRawHourlyDecoderConfigV1,
} from "./provider/kbs_raw_hourly_live_provider_v1.js";
import type {
  KbsRawHourlyPublicationSnapshotInventoryV1,
} from "./provider/kbs_raw_hourly_publication_snapshot_v1.js";
import type {
  KbsRawHourlyPublicationSnapshotComparisonResultV1,
} from "./provider/kbs_raw_hourly_publication_comparison_v1.js";

export const MCFT_CAP09_KBS_RAW_HOURLY_PUBLICATION_CYCLE_SERVICE_ID_V1 =
  "MCFT_CAP09_KBS_RAW_HOURLY_PUBLICATION_CYCLE_SERVICE_V1" as const;

export type KbsRawHourlyPublicationCycleStatusV1 =
  | "LEASE_HELD_BY_OTHER_OWNER"
  | "BASELINE_INITIALIZED"
  | "NO_CHANGE"
  | "BLOCKED_HISTORICAL_DRIFT"
  | "BLOCKED_AMBIGUOUS_FORWARD"
  | "BLOCKED_FORWARD_GAP"
  | "COMPLETED_FORWARD_DELTA";

export type KbsRawHourlyPublicationCycleResultV1 = {
  service_id: typeof MCFT_CAP09_KBS_RAW_HOURLY_PUBLICATION_CYCLE_SERVICE_ID_V1;
  status: KbsRawHourlyPublicationCycleStatusV1;
  lease_claim: EvidenceProducerLeaseClaimV1 | null;
  provider_request_count: 0 | 1;
  raw_retention_attempt_count: 0 | 1;
  retained_raw_read_count: number;
  forward_event_times: readonly string[];
  canonical_record_count: number;
  visible_ingress_count: number;
  evidence_supply_cursor_advance_count: number;
  baseline_manifest_write_count: 0 | 1;
  baseline_pointer_advance_count: 0 | 1;
  baseline_pointer_latest_before: string | null;
  baseline_pointer_latest_after: string | null;
  blocked_reason: string | null;
  twin_state_mutation: false;
  runtime_process_start: false;
  production_target_planner_bound: false;
};

export interface KbsRawHourlyPublicationFetchFactoryV1 {
  buildKbsRawHourlyPublicationFetch(input: {
    requested_at: string;
    request_id_prefix: string;
  }): {
    request: ExternalEvidenceFetchRequestV1;
    transport: ExternalEvidenceTransportPortV1;
  };
}

export interface KbsRawHourlyPublicationBaselineStorePortV1 {
  writeBaselineManifest(
    manifest: KbsRawHourlyPublicationBaselineManifestV1,
  ): Promise<KbsRawHourlyPublicationBaselineWriteReceiptV1>;
  readBaselineManifest(input: {
    baseline_ref: string;
    baseline_digest: string;
    manifest_bytes: number;
  }): Promise<KbsRawHourlyPublicationBaselineReadReceiptV1>;
}

export interface KbsRawHourlyPublicationBaselinePointerFactoryV1 {
  createForProducerClaim(
    claim: EvidenceProducerLeaseClaimV1,
  ): KbsRawHourlyPublicationBaselinePointerPortV1;
}

export interface KbsRawHourlyRetainedRawReaderPortV1 {
  readRetainedRawEvidence(input: {
    retention_ref: string;
    retained_sha256: string;
    retained_bytes: number;
  }): Promise<PrivateRetainedRawReadReceiptV1>;
}

export interface KbsRawHourlyPublicationSnapshotInspectorPortV1 {
  inspectSnapshot(input: {
    raw_bytes: Uint8Array;
    available_at: string;
  }): Promise<KbsRawHourlyPublicationSnapshotInventoryV1>;
}

export interface KbsRawHourlyPublicationSnapshotComparisonPortV1 {
  compare(input: {
    previous_raw_bytes: Uint8Array;
    previous_available_at: string;
    current_raw_bytes: Uint8Array;
    current_available_at: string;
    baseline_latest_event_time: string;
  }): Promise<KbsRawHourlyPublicationSnapshotComparisonResultV1>;
}

export interface KbsRawHourlyForwardDecoderFactoryV1 {
  createDecoder(
    target_interval_ends: readonly string[],
  ): ExternalEvidenceDecoderPortV1;
}

export class ProductionKbsRawHourlyForwardDecoderFactoryV1
  implements KbsRawHourlyForwardDecoderFactoryV1 {
  constructor(private readonly config: KbsRawHourlyDecoderConfigV1 = {}) {}

  createDecoder(targets: readonly string[]): ExternalEvidenceDecoderPortV1 {
    const normalized = targets.map((target) =>
      canonicalHourV1(target, "KBS_PUBLICATION_CYCLE_DECODER_TARGET_INVALID")
    );
    if (normalized.length === 0) {
      throw new Error("KBS_PUBLICATION_CYCLE_DECODER_TARGET_REQUIRED");
    }
    if (new Set(normalized).size !== normalized.length) {
      throw new Error("KBS_PUBLICATION_CYCLE_DECODER_TARGET_DUPLICATE");
    }
    return normalized.length === 1
      ? new KbsRawHourlyExactIntervalDecoderV1(normalized[0]!, this.config)
      : new KbsRawHourlyMultiIntervalDecoderV1(normalized, this.config);
  }
}

export interface KbsRawHourlyCommittedIngressFactoryV1 {
  createForProducerClaim(
    claim: EvidenceProducerLeaseClaimV1,
  ): ExternalFormalEvidenceIngressPortV1;
}

export interface KbsRawHourlySupplyCursorFactoryV1 {
  createForProducerClaim(
    claim: EvidenceProducerLeaseClaimV1,
  ): EvidenceSupplyCursorPortV1;
}

const SCOPE_KEYS = [
  "tenant_id", "project_id", "group_id", "field_id", "season_id", "zone_id",
] as const;
const DATASET_ID = "kbs_lter_raw_hourly_publication_forward_batch_v1";

function requiredTextV1(value: unknown, code: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(code);
  return value.trim();
}

function canonicalIsoV1(value: unknown, code: string): string {
  const text = requiredTextV1(value, code);
  const parsed = Date.parse(text);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== text) {
    throw new Error(code);
  }
  return text;
}

function canonicalHourV1(value: unknown, code: string): string {
  const text = canonicalIsoV1(value, code);
  if (!text.endsWith(":00:00.000Z")) throw new Error(code);
  return text;
}

function exactScopeV1(
  actual: EvidenceRuntimeScopeV1,
  expected: EvidenceRuntimeScopeV1,
  code: string,
): void {
  for (const key of SCOPE_KEYS) {
    if (actual[key] !== expected[key]) throw new Error(code + ":" + key);
  }
}

function bytesEqualV1(left: Uint8Array, right: Uint8Array): boolean {
  if (left.byteLength !== right.byteLength) return false;
  for (let i = 0; i < left.byteLength; i += 1) {
    if (left[i] !== right[i]) return false;
  }
  return true;
}

function addHoursV1(value: string, hours: number): string {
  return new Date(Date.parse(value) + hours * 3_600_000).toISOString();
}

function rawForBaselineV1(
  raw: VerifiedRawEvidenceProvenanceV1,
): KbsRawHourlyPublicationBaselineManifestV1["raw_provenance"] {
  return {
    request_id: raw.request_id,
    provider_id: raw.provider_id,
    source_family: raw.source_family,
    source_locator: raw.source_locator,
    final_locator: raw.final_locator,
    content_type: raw.content_type,
    retrieved_at: raw.retrieved_at,
    available_at: raw.available_at,
    raw_sha256: raw.raw_sha256,
    raw_bytes: raw.raw_bytes,
    retention_ref: raw.retention_ref,
    retained_at: raw.retained_at,
    use_policy_ref: raw.use_policy_ref,
  };
}

function baselineManifestV1(input: {
  scope: EvidenceRuntimeScopeV1;
  runtime_start_authority_ref: string;
  activation_fence_time: string;
  raw: VerifiedRawEvidenceProvenanceV1;
  snapshot: KbsRawHourlyPublicationSnapshotInventoryV1;
}): KbsRawHourlyPublicationBaselineManifestV1 {
  return {
    schema_version: MCFT_CAP09_KBS_PUBLICATION_BASELINE_SCHEMA_V1,
    scope: { ...input.scope },
    runtime_start_authority_ref: requiredTextV1(
      input.runtime_start_authority_ref,
      "KBS_PUBLICATION_CYCLE_RUNTIME_START_AUTHORITY_REQUIRED",
    ),
    activation_fence_time: canonicalIsoV1(
      input.activation_fence_time,
      "KBS_PUBLICATION_CYCLE_ACTIVATION_FENCE_INVALID",
    ),
    baseline_observed_at: canonicalIsoV1(
      input.raw.retained_at,
      "KBS_PUBLICATION_CYCLE_BASELINE_OBSERVED_AT_INVALID",
    ),
    raw_provenance: rawForBaselineV1(input.raw),
    snapshot: input.snapshot,
    canonical_emission_count: 0,
    externally_publishable: false,
  };
}

function assertPointerManifestV1(
  pointer: KbsRawHourlyPublicationBaselinePointerSnapshotV1,
  read: KbsRawHourlyPublicationBaselineReadReceiptV1,
  scope: EvidenceRuntimeScopeV1,
): void {
  if (
    read.baseline_ref !== pointer.baseline_ref
    || read.baseline_digest !== pointer.baseline_digest
    || read.manifest_bytes !== pointer.manifest_bytes
  ) {
    throw new Error("KBS_PUBLICATION_CYCLE_POINTER_MANIFEST_IDENTITY_MISMATCH");
  }
  exactScopeV1(read.manifest.scope, scope, "KBS_PUBLICATION_CYCLE_BASELINE_SCOPE_MISMATCH");
  if (
    canonicalHourV1(
      read.manifest.snapshot.latest_event_time,
      "KBS_PUBLICATION_CYCLE_BASELINE_MANIFEST_LATEST_INVALID",
    ) !== pointer.latest_event_time
  ) {
    throw new Error("KBS_PUBLICATION_CYCLE_POINTER_MANIFEST_LATEST_MISMATCH");
  }
}

function assertReadbackV1(
  raw: VerifiedRawEvidenceProvenanceV1,
  expectedBytes: Uint8Array,
  read: PrivateRetainedRawReadReceiptV1,
  code: string,
): void {
  if (
    read.retention_ref !== raw.retention_ref
    || read.retained_sha256 !== raw.raw_sha256
    || read.retained_bytes !== raw.raw_bytes
    || read.retained_at !== raw.retained_at
    || read.provider_refetch_count !== 0
    || read.raw_store_write_count !== 0
    || read.formal_database_write_count !== 0
    || !bytesEqualV1(read.bytes, expectedBytes)
  ) {
    throw new Error(code);
  }
}

function forwardGapV1(
  baseline: string,
  events: readonly string[],
  currentLatest: string,
): string | null {
  let expected = addHoursV1(baseline, 1);
  for (const event of events) {
    const actual = canonicalHourV1(event, "KBS_PUBLICATION_CYCLE_FORWARD_EVENT_INVALID");
    if (actual !== expected) return "EXPECTED_" + expected + "_GOT_" + actual;
    expected = addHoursV1(expected, 1);
  }
  if (events.length > 0 && events[events.length - 1] !== currentLatest) {
    return "FORWARD_LAST_EVENT_MUST_EQUAL_CURRENT_LATEST";
  }
  return null;
}

function assertExactPairsV1(
  targets: readonly string[],
  results: readonly {
    record: { record_type: string; role_time: Record<string, unknown> };
  }[],
): void {
  if (results.length !== targets.length * 2) {
    throw new Error("KBS_PUBLICATION_CYCLE_EXACT_TWO_RECORDS_PER_TARGET_REQUIRED");
  }
  for (const target of targets) {
    const atTarget = results.filter((result) =>
      result.record.role_time.interval_end === target
    );
    const types = atTarget.map((result) => result.record.record_type).sort();
    if (
      atTarget.length !== 2
      || JSON.stringify(types) !== JSON.stringify([
        "historical_et0_estimate_v1",
        "observed_rainfall_v1",
      ])
    ) {
      throw new Error("KBS_PUBLICATION_CYCLE_RAIN_ET0_PAIR_REQUIRED:" + target);
    }
  }
}

export class KbsRawHourlyPublicationCycleServiceV1 {
  readonly service_id = MCFT_CAP09_KBS_RAW_HOURLY_PUBLICATION_CYCLE_SERVICE_ID_V1;

  constructor(private readonly deps: {
    lease: EvidenceProducerLeasePortV1;
    retention: RawEvidenceRetentionPortV1;
    publication_fetch_factory: KbsRawHourlyPublicationFetchFactoryV1;
    baseline_store: KbsRawHourlyPublicationBaselineStorePortV1;
    baseline_pointer_factory: KbsRawHourlyPublicationBaselinePointerFactoryV1;
    raw_reader: KbsRawHourlyRetainedRawReaderPortV1;
    snapshot_inspector: KbsRawHourlyPublicationSnapshotInspectorPortV1;
    snapshot_comparison: KbsRawHourlyPublicationSnapshotComparisonPortV1;
    decoder_factory: KbsRawHourlyForwardDecoderFactoryV1;
    committed_ingress_factory: KbsRawHourlyCommittedIngressFactoryV1;
    visibility: ExternalEvidencePostCommitVisibilityPortV1;
    cursor_factory: KbsRawHourlySupplyCursorFactoryV1;
    completion_clock: () => string;
  }) {}

  private resultV1(input: {
    status: KbsRawHourlyPublicationCycleStatusV1;
    claim: EvidenceProducerLeaseClaimV1 | null;
    reads: number;
    forward?: readonly string[];
    canonical?: number;
    visible?: number;
    cursor?: number;
    manifestWrites?: 0 | 1;
    pointerAdvances?: 0 | 1;
    before?: string | null;
    after?: string | null;
    blocked?: string | null;
  }): KbsRawHourlyPublicationCycleResultV1 {
    return {
      service_id: this.service_id,
      status: input.status,
      lease_claim: input.claim,
      provider_request_count: input.claim ? 1 : 0,
      raw_retention_attempt_count: input.claim ? 1 : 0,
      retained_raw_read_count: input.reads,
      forward_event_times: [...(input.forward ?? [])],
      canonical_record_count: input.canonical ?? 0,
      visible_ingress_count: input.visible ?? 0,
      evidence_supply_cursor_advance_count: input.cursor ?? 0,
      baseline_manifest_write_count: input.manifestWrites ?? 0,
      baseline_pointer_advance_count: input.pointerAdvances ?? 0,
      baseline_pointer_latest_before: input.before ?? null,
      baseline_pointer_latest_after: input.after ?? null,
      blocked_reason: input.blocked ?? null,
      twin_state_mutation: false,
      runtime_process_start: false,
      production_target_planner_bound: false,
    };
  }

  async executeCycle(input: {
    scope: EvidenceRuntimeScopeV1;
    lease_owner: string;
    lease_duration_seconds: number;
    requested_at: string;
    request_id_prefix: string;
    runtime_start_authority_ref: string;
    activation_fence_time: string;
  }): Promise<KbsRawHourlyPublicationCycleResultV1> {
    const owner = requiredTextV1(input.lease_owner, "KBS_PUBLICATION_CYCLE_LEASE_OWNER_REQUIRED");
    if (!Number.isSafeInteger(input.lease_duration_seconds) || input.lease_duration_seconds <= 0) {
      throw new Error("KBS_PUBLICATION_CYCLE_LEASE_DURATION_INVALID");
    }
    const requestedAt = canonicalIsoV1(
      input.requested_at,
      "KBS_PUBLICATION_CYCLE_REQUESTED_AT_INVALID",
    );
    requiredTextV1(input.request_id_prefix, "KBS_PUBLICATION_CYCLE_REQUEST_PREFIX_REQUIRED");
    requiredTextV1(
      input.runtime_start_authority_ref,
      "KBS_PUBLICATION_CYCLE_RUNTIME_START_AUTHORITY_REQUIRED",
    );
    canonicalIsoV1(
      input.activation_fence_time,
      "KBS_PUBLICATION_CYCLE_ACTIVATION_FENCE_INVALID",
    );

    let claim = await this.deps.lease.acquireLease({
      scope: input.scope,
      lease_owner: owner,
      lease_duration_seconds: input.lease_duration_seconds,
    });
    if (!claim) {
      return this.resultV1({
        status: "LEASE_HELD_BY_OTHER_OWNER",
        claim: null,
        reads: 0,
      });
    }
    exactScopeV1(claim.scope, input.scope, "KBS_PUBLICATION_CYCLE_LEASE_SCOPE_MISMATCH");

    const publication = this.deps.publication_fetch_factory.buildKbsRawHourlyPublicationFetch({
      requested_at: requestedAt,
      request_id_prefix: input.request_id_prefix,
    });
    const current = await collectAndRetainRawEvidenceV1(
      {
        dataset_id: "kbs_lter_raw_hourly_complete_publication_v1",
        scope: input.scope,
        request: publication.request,
      },
      {
        transport: publication.transport,
        retention: this.deps.retention,
      },
    );

    const currentRead = await this.deps.raw_reader.readRetainedRawEvidence({
      retention_ref: current.provenance.retention_ref,
      retained_sha256: current.provenance.raw_sha256,
      retained_bytes: current.provenance.raw_bytes,
    });
    assertReadbackV1(
      current.provenance,
      current.raw_bytes,
      currentRead,
      "KBS_PUBLICATION_CYCLE_CURRENT_RAW_READBACK_MISMATCH",
    );

    const snapshot = await this.deps.snapshot_inspector.inspectSnapshot({
      raw_bytes: currentRead.bytes,
      available_at: current.provenance.available_at,
    });

    claim = await this.deps.lease.renewLease({
      claim,
      lease_duration_seconds: input.lease_duration_seconds,
    });
    let pointerPort = this.deps.baseline_pointer_factory.createForProducerClaim(claim);
    const pointer = await pointerPort.readCurrentBaselinePointer({ scope: input.scope });

    if (!pointer) {
      const stored = await this.deps.baseline_store.writeBaselineManifest(
        baselineManifestV1({
          scope: input.scope,
          runtime_start_authority_ref: input.runtime_start_authority_ref,
          activation_fence_time: input.activation_fence_time,
          raw: current.provenance,
          snapshot,
        }),
      );
      claim = await this.deps.lease.renewLease({
        claim,
        lease_duration_seconds: input.lease_duration_seconds,
      });
      pointerPort = this.deps.baseline_pointer_factory.createForProducerClaim(claim);
      const advanced = await pointerPort.advanceCurrentBaselinePointer({
        claim,
        expected_previous_digest: null,
        next: {
          baseline_ref: stored.baseline_ref,
          baseline_digest: stored.baseline_digest,
          manifest_bytes: stored.manifest_bytes,
          latest_event_time: snapshot.latest_event_time,
          stored_at: stored.stored_at,
        },
      });
      if (advanced.pointer.latest_event_time !== snapshot.latest_event_time) {
        throw new Error("KBS_PUBLICATION_CYCLE_BOOTSTRAP_POINTER_LATEST_MISMATCH");
      }
      return this.resultV1({
        status: "BASELINE_INITIALIZED",
        claim,
        reads: 1,
        manifestWrites: 1,
        pointerAdvances: 1,
        after: snapshot.latest_event_time,
      });
    }

    const previousBaseline = await this.deps.baseline_store.readBaselineManifest({
      baseline_ref: pointer.baseline_ref,
      baseline_digest: pointer.baseline_digest,
      manifest_bytes: pointer.manifest_bytes,
    });
    assertPointerManifestV1(pointer, previousBaseline, input.scope);
    const previousRaw = previousBaseline.manifest.raw_provenance;
    const previousRead = await this.deps.raw_reader.readRetainedRawEvidence({
      retention_ref: previousRaw.retention_ref,
      retained_sha256: previousRaw.raw_sha256,
      retained_bytes: previousRaw.raw_bytes,
    });
    if (
      previousRead.retention_ref !== previousRaw.retention_ref
      || previousRead.retained_sha256 !== previousRaw.raw_sha256
      || previousRead.retained_bytes !== previousRaw.raw_bytes
      || previousRead.retained_at !== previousRaw.retained_at
      || previousRead.provider_refetch_count !== 0
      || previousRead.raw_store_write_count !== 0
      || previousRead.formal_database_write_count !== 0
    ) {
      throw new Error("KBS_PUBLICATION_CYCLE_PREVIOUS_RAW_READBACK_MISMATCH");
    }

    claim = await this.deps.lease.renewLease({
      claim,
      lease_duration_seconds: input.lease_duration_seconds,
    });
    const comparison = await this.deps.snapshot_comparison.compare({
      previous_raw_bytes: previousRead.bytes,
      previous_available_at: previousRaw.available_at,
      current_raw_bytes: currentRead.bytes,
      current_available_at: current.provenance.available_at,
      baseline_latest_event_time: pointer.latest_event_time,
    });
    if (comparison.current_latest_event_time !== snapshot.latest_event_time) {
      throw new Error("KBS_PUBLICATION_CYCLE_COMPARISON_SNAPSHOT_LATEST_MISMATCH");
    }

    if (comparison.status === "HISTORICAL_DRIFT") {
      return this.resultV1({
        status: "BLOCKED_HISTORICAL_DRIFT",
        claim,
        reads: 2,
        forward: comparison.forward_event_times,
        before: pointer.latest_event_time,
        after: pointer.latest_event_time,
        blocked: "HISTORICAL_DRIFT",
      });
    }
    if (comparison.status === "AMBIGUOUS_FORWARD") {
      return this.resultV1({
        status: "BLOCKED_AMBIGUOUS_FORWARD",
        claim,
        reads: 2,
        forward: comparison.forward_event_times,
        before: pointer.latest_event_time,
        after: pointer.latest_event_time,
        blocked: "AMBIGUOUS_FORWARD",
      });
    }
    if (comparison.status === "NO_CHANGE") {
      return this.resultV1({
        status: "NO_CHANGE",
        claim,
        reads: 2,
        before: pointer.latest_event_time,
        after: pointer.latest_event_time,
      });
    }

    const gap = forwardGapV1(
      pointer.latest_event_time,
      comparison.forward_event_times,
      comparison.current_latest_event_time,
    );
    if (gap) {
      return this.resultV1({
        status: "BLOCKED_FORWARD_GAP",
        claim,
        reads: 2,
        forward: comparison.forward_event_times,
        before: pointer.latest_event_time,
        after: pointer.latest_event_time,
        blocked: gap,
      });
    }

    claim = await this.deps.lease.renewLease({
      claim,
      lease_duration_seconds: input.lease_duration_seconds,
    });
    const decoder = this.deps.decoder_factory.createDecoder(comparison.forward_event_times);
    const replayRequest = buildVerifiedRetainedRawReplayRequestV1(
      current.provenance,
      { purpose_limitations: ["KBS_PUBLICATION_FORWARD_BATCH_REPLAY"] },
    );
    const canonical = await collectRetainDecodeCanonicalizeExternalEvidenceWithCompletionClockV1(
      {
        dataset_id: DATASET_ID,
        scope: input.scope,
        request: replayRequest,
      },
      {
        transport: new VerifiedRetainedRawReadbackTransportV1(
          current.provenance,
          currentRead,
        ),
        retention: new ExistingRetainedRawVerificationBarrierV1(
          current.provenance,
          currentRead,
        ),
        decoder,
      },
      this.deps.completion_clock,
    );
    assertExactPairsV1(comparison.forward_event_times, canonical);

    const ordered = [...canonical].sort((left, right) => {
      const leftTime = String(left.record.role_time.interval_end ?? "");
      const rightTime = String(right.record.role_time.interval_end ?? "");
      return leftTime.localeCompare(rightTime)
        || left.record.record_type.localeCompare(right.record.record_type)
        || left.record.source_record_id.localeCompare(right.record.source_record_id);
    });

    let visibleCount = 0;
    for (const result of ordered) {
      claim = await this.deps.lease.renewLease({
        claim,
        lease_duration_seconds: input.lease_duration_seconds,
      });
      const visibleIngress = new PostCommitVisibleExternalFormalEvidenceIngressV1(
        this.deps.committed_ingress_factory.createForProducerClaim(claim),
        this.deps.visibility,
        this.deps.cursor_factory.createForProducerClaim(claim),
      );
      const receipt = await visibleIngress.appendCanonicalizedExternalEvidence(result);
      if (
        receipt.post_commit_visibility_verified !== true
        || receipt.evidence_supply_cursor_advanced !== true
      ) {
        throw new Error("KBS_PUBLICATION_CYCLE_VISIBLE_CURSOR_RECEIPT_REQUIRED");
      }
      visibleCount += 1;
    }

    const stored = await this.deps.baseline_store.writeBaselineManifest(
      baselineManifestV1({
        scope: input.scope,
        runtime_start_authority_ref: input.runtime_start_authority_ref,
        activation_fence_time: input.activation_fence_time,
        raw: current.provenance,
        snapshot,
      }),
    );
    claim = await this.deps.lease.renewLease({
      claim,
      lease_duration_seconds: input.lease_duration_seconds,
    });
    pointerPort = this.deps.baseline_pointer_factory.createForProducerClaim(claim);
    const advanced = await pointerPort.advanceCurrentBaselinePointer({
      claim,
      expected_previous_digest: pointer.baseline_digest,
      next: {
        baseline_ref: stored.baseline_ref,
        baseline_digest: stored.baseline_digest,
        manifest_bytes: stored.manifest_bytes,
        latest_event_time: snapshot.latest_event_time,
        stored_at: stored.stored_at,
      },
    });
    if (advanced.pointer.latest_event_time !== snapshot.latest_event_time) {
      throw new Error("KBS_PUBLICATION_CYCLE_FORWARD_POINTER_LATEST_MISMATCH");
    }

    return this.resultV1({
      status: "COMPLETED_FORWARD_DELTA",
      claim,
      reads: 2,
      forward: comparison.forward_event_times,
      canonical: ordered.length,
      visible: visibleCount,
      cursor: visibleCount,
      manifestWrites: 1,
      pointerAdvances: 1,
      before: pointer.latest_event_time,
      after: snapshot.latest_event_time,
    });
  }
}
