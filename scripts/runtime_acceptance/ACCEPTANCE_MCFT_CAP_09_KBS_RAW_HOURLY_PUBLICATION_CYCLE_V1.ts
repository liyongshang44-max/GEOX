import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import {
  MCFT_CAP09_EVIDENCE_PRODUCER_LEASE_CONTRACT_ID_V1,
  type EvidenceProducerLeaseClaimV1,
  type EvidenceProducerLeasePortV1,
  type EvidenceRuntimeScopeV1,
} from "../../apps/server/src/external_evidence/mcft_cap09_evidence_runtime_persistence_v1.js";
import {
  MCFT_CAP09_EVIDENCE_POST_COMMIT_VISIBILITY_ID_V1,
  type CommittedExternalEvidenceIdentityV1,
  type ExternalEvidencePostCommitVisibilityPortV1,
} from "../../apps/server/src/external_evidence/mcft_cap09_evidence_visibility_supply_cursor_v1.js";
import {
  type ExternalFormalEvidenceIngressPortV1,
} from "../../apps/server/src/external_evidence/mcft_cap09_external_formal_collector_phase_orchestrator_v1.js";
import {
  normalizeKbsRawHourlyPublicationBaselineManifestV1,
  type KbsRawHourlyPublicationBaselineManifestV1,
  type KbsRawHourlyPublicationBaselineReadReceiptV1,
  type KbsRawHourlyPublicationBaselineWriteReceiptV1,
} from "../../apps/server/src/external_evidence/kbs_raw_hourly_publication_baseline_store_v1.js";
import {
  MCFT_CAP09_KBS_PUBLICATION_BASELINE_POINTER_CONTRACT_ID_V1,
  type KbsRawHourlyPublicationBaselinePointerPortV1,
  type KbsRawHourlyPublicationBaselinePointerSnapshotV1,
} from "../../apps/server/src/external_evidence/mcft_cap09_kbs_publication_baseline_pointer_v1.js";
import {
  KbsRawHourlyPublicationSnapshotInspectorV1,
} from "../../apps/server/src/external_evidence/provider/kbs_raw_hourly_publication_snapshot_v1.js";
import {
  KbsRawHourlyPublicationSnapshotComparisonV1,
} from "../../apps/server/src/external_evidence/provider/kbs_raw_hourly_publication_comparison_v1.js";
import {
  ProductionEvidenceWorkItemFactoryV1,
} from "../../apps/server/src/external_evidence/mcft_cap09_production_evidence_work_items_v1.js";
import {
  KbsRawHourlyPublicationCycleServiceV1,
  ProductionKbsRawHourlyForwardDecoderFactoryV1,
  type KbsRawHourlyPublicationBaselinePointerFactoryV1,
  type KbsRawHourlyPublicationBaselineStorePortV1,
  type KbsRawHourlyRetainedRawReaderPortV1,
} from "../../apps/server/src/external_evidence/mcft_cap09_kbs_raw_hourly_publication_cycle_service_v1.js";
import {
  MCFT_CAP09_PRIVATE_RETAINED_RAW_READER_ID_V1,
  type PrivateRetainedRawReadReceiptV1,
} from "../../apps/server/src/external_evidence/s3_compatible_private_retained_raw_reader_v1.js";
import {
  MCFT_CAP09_KBS_RAW_HOURLY_ENDPOINT_V1,
} from "../../apps/server/src/external_evidence/provider/kbs_raw_hourly_live_provider_v1.js";

const OUT = path.resolve(
  "acceptance-output/MCFT_CAP_09_KBS_RAW_HOURLY_PUBLICATION_CYCLE_V1_RESULT.json",
);
const SCOPE: EvidenceRuntimeScopeV1 = {
  tenant_id: "tenant_mcft_external",
  project_id: "project_mcft_cap09",
  group_id: "group_mcft_cap09",
  field_id: "field_mcft_external",
  season_id: "season_2026",
  zone_id: "zone_root",
};
const REQUESTED_AT = "2026-09-01T00:00:00.000Z";
const RETAINED_AT = "2026-09-01T00:00:01.000Z";
const INGESTED_AT = "2026-09-01T00:00:02.000Z";
const CANONICALIZED_AT = "2026-09-01T00:00:03.000Z";
const STORED_AT = "2026-09-01T00:00:04.000Z";
const ADVANCED_AT = "2026-09-01T00:00:05.000Z";
const ACTIVATION_FENCE = "2026-08-31T15:00:00.000Z";
const RUNTIME_START_AUTHORITY =
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-PRODUCTION-EVIDENCE-ACQUISITION-HORIZON-AUTHORITY-V1.json";
const HEADER = "datetime_utc,solrad_avg,wind_speed,ah,airtmp_107_avg,rain_mm\n";
const BASE_ROWS = [
  "2026-08-31 16:00:00,120.0,2.0,1.7,23.0,0.1",
  "2026-08-31 17:00:00,150.0,2.5,1.8,24.0,0.2",
  "2026-08-31 18:00:00,180.0,3.0,1.9,25.0,0.3",
];

function body(rows: readonly string[]): Buffer {
  return Buffer.from(HEADER + rows.join("\n") + "\n", "utf8");
}
function digest(bytes: Uint8Array): string {
  return "sha256:" + crypto.createHash("sha256").update(bytes).digest("hex");
}
function manifestDigest(manifest: KbsRawHourlyPublicationBaselineManifestV1): string {
  return digest(Buffer.from(JSON.stringify(manifest) + "\n", "utf8"));
}
function response(bytes: Uint8Array): Response {
  const copied = Uint8Array.from(bytes);
  return {
    status: 200,
    url: MCFT_CAP09_KBS_RAW_HOURLY_ENDPOINT_V1,
    headers: new Headers({ "content-type": "text/csv; charset=utf-8" }),
    arrayBuffer: async () => copied.buffer as ArrayBuffer,
  } as unknown as Response;
}

async function main(): Promise<void> {
  let currentBody = body(BASE_ROWS);
  let providerFetchCount = 0;
  let retentionAttemptCount = 0;
  let rawReadCount = 0;
  let pointerAdvanceCount = 0;
  let manifestWriteCount = 0;
  let failIngressOnAttempt: number | null = null;
  let ingressAttemptCount = 0;
  const order: string[] = [];
  const rawObjects = new Map<string, { bytes: Uint8Array; retained_at: string }>();
  const manifests = new Map<string, {
    receipt: KbsRawHourlyPublicationBaselineReadReceiptV1;
  }>();
  const committed = new Map<string, {
    fact_id: string;
    source_record_hash: string;
    retention_ref: string;
    raw_sha256: string;
    raw_bytes: number;
    record_type: string;
  }>();
  const cursorSeen = new Map<string, string>();

  const fetchImpl = (async (input: unknown): Promise<Response> => {
    providerFetchCount += 1;
    order.push("provider_fetch");
    assert.equal(String(input), MCFT_CAP09_KBS_RAW_HOURLY_ENDPOINT_V1);
    return response(currentBody);
  }) as typeof fetch;

  const retention = {
    async retainRawEvidence(input: {
      raw_sha256: string;
      raw_bytes: number;
      bytes: Uint8Array;
    }) {
      retentionAttemptCount += 1;
      order.push("raw_retention");
      assert.equal(input.raw_sha256, digest(input.bytes));
      assert.equal(input.raw_bytes, input.bytes.byteLength);
      const ref =
        "s3-private://qualification/mcft-cap09-formal-raw-v1/sha256/" +
        input.raw_sha256.slice("sha256:".length);
      const existing = rawObjects.get(ref);
      if (existing) {
        assert.equal(digest(existing.bytes), input.raw_sha256);
      } else {
        rawObjects.set(ref, {
          bytes: new Uint8Array(input.bytes),
          retained_at: RETAINED_AT,
        });
      }
      return {
        retention_class: "PRIVATE_RESTRICTED_RAW_EVIDENCE" as const,
        retention_ref: ref,
        retained_sha256: input.raw_sha256,
        retained_bytes: input.raw_bytes,
        retained_at: RETAINED_AT,
        externally_publishable: false as const,
      };
    },
  };

  const rawReader: KbsRawHourlyRetainedRawReaderPortV1 = {
    async readRetainedRawEvidence(input): Promise<PrivateRetainedRawReadReceiptV1> {
      rawReadCount += 1;
      order.push("raw_read");
      const stored = rawObjects.get(input.retention_ref);
      assert(stored, "RAW_OBJECT_REQUIRED");
      assert.equal(digest(stored.bytes), input.retained_sha256);
      assert.equal(stored.bytes.byteLength, input.retained_bytes);
      return {
        reader_id: MCFT_CAP09_PRIVATE_RETAINED_RAW_READER_ID_V1,
        retention_ref: input.retention_ref,
        retained_sha256: input.retained_sha256,
        retained_bytes: input.retained_bytes,
        retained_at: stored.retained_at,
        bytes: new Uint8Array(stored.bytes),
        provider_refetch_count: 0,
        raw_store_write_count: 0,
        formal_database_write_count: 0,
      };
    },
  };

  const baselineStore: KbsRawHourlyPublicationBaselineStorePortV1 = {
    async writeBaselineManifest(
      input: KbsRawHourlyPublicationBaselineManifestV1,
    ): Promise<KbsRawHourlyPublicationBaselineWriteReceiptV1> {
      manifestWriteCount += 1;
      const manifest = normalizeKbsRawHourlyPublicationBaselineManifestV1(input);
      const d = manifestDigest(manifest);
      const ref =
        "s3-private://qualification/mcft-cap09-kbs-raw-hourly-publication-baseline-v1/sha256/" +
        d.slice("sha256:".length);
      const bytes = Buffer.byteLength(JSON.stringify(manifest) + "\n");
      order.push("manifest_write:" + manifest.snapshot.latest_event_time);
      if (!manifests.has(d)) {
        manifests.set(d, {
          receipt: {
            store_id: "MCFT_CAP09_KBS_RAW_HOURLY_PUBLICATION_BASELINE_STORE_V1",
            baseline_ref: ref,
            baseline_digest: d,
            manifest_bytes: bytes,
            stored_at: STORED_AT,
            manifest,
            externally_publishable: false,
            current_pointer_bound: false,
          },
        });
      }
      return {
        store_id: "MCFT_CAP09_KBS_RAW_HOURLY_PUBLICATION_BASELINE_STORE_V1",
        baseline_ref: ref,
        baseline_digest: d,
        manifest_bytes: bytes,
        stored_at: STORED_AT,
        idempotent_existing_object: manifests.has(d),
        externally_publishable: false,
        current_pointer_bound: false,
      };
    },
    async readBaselineManifest(input) {
      const row = manifests.get(input.baseline_digest);
      assert(row, "BASELINE_MANIFEST_REQUIRED");
      assert.equal(row.receipt.baseline_ref, input.baseline_ref);
      assert.equal(row.receipt.manifest_bytes, input.manifest_bytes);
      order.push("manifest_read:" + row.receipt.manifest.snapshot.latest_event_time);
      return structuredClone(row.receipt);
    },
  };

  let pointer: KbsRawHourlyPublicationBaselinePointerSnapshotV1 | null = null;
  const pointerFactory: KbsRawHourlyPublicationBaselinePointerFactoryV1 = {
    createForProducerClaim(claim): KbsRawHourlyPublicationBaselinePointerPortV1 {
      return {
        async readCurrentBaselinePointer({ scope }) {
          assert.deepEqual(scope, SCOPE);
          return pointer ? { ...pointer, scope: { ...pointer.scope } } : null;
        },
        async advanceCurrentBaselinePointer(input) {
          assert.equal(input.claim.lease_owner, claim.lease_owner);
          assert.equal(input.claim.fencing_token, claim.fencing_token);
          if (pointer === null) {
            assert.equal(input.expected_previous_digest, null);
          } else {
            assert.equal(input.expected_previous_digest, pointer.baseline_digest);
            assert(Date.parse(input.next.latest_event_time) > Date.parse(pointer.latest_event_time));
          }
          pointerAdvanceCount += 1;
          order.push("pointer_advance:" + input.next.latest_event_time);
          pointer = {
            pointer_contract_id: MCFT_CAP09_KBS_PUBLICATION_BASELINE_POINTER_CONTRACT_ID_V1,
            scope: { ...SCOPE },
            baseline_ref: input.next.baseline_ref,
            baseline_digest: input.next.baseline_digest,
            manifest_bytes: input.next.manifest_bytes,
            latest_event_time: input.next.latest_event_time,
            stored_at: input.next.stored_at,
            writer_lease_owner: claim.lease_owner,
            writer_fencing_token: claim.fencing_token,
            advanced_at: ADVANCED_AT,
          };
          return { status: "ADVANCED" as const, pointer: { ...pointer, scope: { ...SCOPE } } };
        },
      };
    },
  };

  let renewCount = 0;
  const lease: EvidenceProducerLeasePortV1 = {
    async acquireLease(): Promise<EvidenceProducerLeaseClaimV1> {
      order.push("lease_acquire");
      return {
        lease_contract_id: MCFT_CAP09_EVIDENCE_PRODUCER_LEASE_CONTRACT_ID_V1,
        scope: { ...SCOPE },
        lease_owner: "evidence-local-owner",
        fencing_token: 1n,
        acquired_at: REQUESTED_AT,
        expires_at: "2026-09-01T00:10:00.000Z",
        heartbeat_at: REQUESTED_AT,
        database_now: REQUESTED_AT,
      };
    },
    async renewLease({ claim }): Promise<EvidenceProducerLeaseClaimV1> {
      renewCount += 1;
      order.push("lease_renew");
      return {
        ...claim,
        heartbeat_at: "2026-09-01T00:00:30.000Z",
        expires_at: "2026-09-01T00:10:30.000Z",
        database_now: "2026-09-01T00:00:30.000Z",
      };
    },
    async releaseLease() {},
  };

  const ingress: ExternalFormalEvidenceIngressPortV1 = {
    async appendCanonicalizedExternalEvidence(result) {
      ingressAttemptCount += 1;
      order.push("ingress:" + result.record.source_record_id);
      if (failIngressOnAttempt === ingressAttemptCount) {
        failIngressOnAttempt = null;
        throw new Error("FOCUSED_SIMULATED_INGRESS_FAILURE");
      }
      const existing = committed.get(result.record.source_record_id);
      if (existing) {
        assert.equal(existing.source_record_hash, result.record.source_record_hash);
        assert.equal(existing.retention_ref, result.raw_provenance.retention_ref);
        return {
          record_type: existing.record_type,
          source_record_id: result.record.source_record_id,
          canonical_fact_write_count: 0 as const,
          fact_id: existing.fact_id,
          source_record_hash: existing.source_record_hash,
          retention_ref: existing.retention_ref,
          raw_sha256: existing.raw_sha256,
          raw_bytes: existing.raw_bytes,
        };
      }
      const row = {
        fact_id: "fact:" + result.record.source_record_id,
        source_record_hash: result.record.source_record_hash,
        retention_ref: result.raw_provenance.retention_ref,
        raw_sha256: result.raw_provenance.raw_sha256,
        raw_bytes: result.raw_provenance.raw_bytes,
        record_type: result.record.record_type,
      };
      committed.set(result.record.source_record_id, row);
      return {
        record_type: row.record_type,
        source_record_id: result.record.source_record_id,
        canonical_fact_write_count: 1 as const,
        fact_id: row.fact_id,
        source_record_hash: row.source_record_hash,
        retention_ref: row.retention_ref,
        raw_sha256: row.raw_sha256,
        raw_bytes: row.raw_bytes,
      };
    },
  };

  const visibility: ExternalEvidencePostCommitVisibilityPortV1 = {
    async verifyCommittedEvidenceVisible(
      expected: CommittedExternalEvidenceIdentityV1,
    ) {
      order.push("visibility:" + expected.source_record_id);
      return {
        ...expected,
        visibility_id: MCFT_CAP09_EVIDENCE_POST_COMMIT_VISIBILITY_ID_V1,
        post_commit_db_readback_at: CANONICALIZED_AT,
      };
    },
  };

  const cursorFactory = {
    createForProducerClaim(claim: EvidenceProducerLeaseClaimV1) {
      return {
        async advanceAfterVisibleEvidence(input: {
          visible_evidence: CommittedExternalEvidenceIdentityV1;
        }) {
          assert.equal(claim.fencing_token, 1n);
          const key = input.visible_evidence.fact_id;
          order.push("cursor:" + input.visible_evidence.source_record_id);
          const prior = cursorSeen.get(key);
          if (prior) assert.equal(prior, input.visible_evidence.record_semantic_sha256);
          else cursorSeen.set(key, input.visible_evidence.record_semantic_sha256);
          return {
            status: prior ? "EXISTING_IDEMPOTENT_SUCCESS" as const : "ADVANCED" as const,
            fact_id: input.visible_evidence.fact_id,
            record_semantic_sha256: input.visible_evidence.record_semantic_sha256,
          };
        },
      };
    },
  };

  const factory = new ProductionEvidenceWorkItemFactoryV1({
    retention,
    fetch_impl: fetchImpl,
    clock: () => new Date(REQUESTED_AT),
  });
  const service = new KbsRawHourlyPublicationCycleServiceV1({
    lease,
    retention,
    publication_fetch_factory: factory,
    baseline_store: baselineStore,
    baseline_pointer_factory: pointerFactory,
    raw_reader: rawReader,
    snapshot_inspector: new KbsRawHourlyPublicationSnapshotInspectorV1(),
    snapshot_comparison: new KbsRawHourlyPublicationSnapshotComparisonV1(),
    decoder_factory: new ProductionKbsRawHourlyForwardDecoderFactoryV1({
      clock: () => new Date(INGESTED_AT),
    }),
    committed_ingress_factory: {
      createForProducerClaim() { return ingress; },
    },
    visibility,
    cursor_factory: cursorFactory,
    completion_clock: () => CANONICALIZED_AT,
  });
  const cycleInput = (prefix: string) => ({
    scope: { ...SCOPE },
    lease_owner: "evidence-local-owner",
    lease_duration_seconds: 300,
    requested_at: REQUESTED_AT,
    request_id_prefix: prefix,
    runtime_start_authority_ref: RUNTIME_START_AUTHORITY,
    activation_fence_time: ACTIVATION_FENCE,
  });

  const baseline = await service.executeCycle(cycleInput("bootstrap"));
  assert.equal(baseline.status, "BASELINE_INITIALIZED");
  assert.equal(baseline.canonical_record_count, 0);
  assert.equal(baseline.baseline_pointer_advance_count, 1);
  assert.equal(pointer?.latest_event_time, "2026-08-31T18:00:00.000Z");
  const baselineDigest = pointer!.baseline_digest;

  const noChange = await service.executeCycle(cycleInput("no-change"));
  assert.equal(noChange.status, "NO_CHANGE");
  assert.equal(noChange.canonical_record_count, 0);
  assert.equal(noChange.baseline_pointer_advance_count, 0);
  assert.equal(pointer!.baseline_digest, baselineDigest);

  currentBody = body([
    BASE_ROWS[0]!,
    "2026-08-31 17:00:00,151.0,2.5,1.8,24.0,0.2",
    BASE_ROWS[2]!,
    "2026-08-31 19:00:00,190.0,3.1,2.0,25.5,0.4",
  ]);
  const drift = await service.executeCycle(cycleInput("historical-drift"));
  assert.equal(drift.status, "BLOCKED_HISTORICAL_DRIFT");
  assert.equal(drift.baseline_pointer_advance_count, 0);
  assert.equal(pointer!.baseline_digest, baselineDigest);

  currentBody = body(BASE_ROWS.concat([
    "2026-08-31 19:00:00,190.0,3.1,2.0,25.5,0.4",
    "2026-08-31 19:00:00,191.0,3.1,2.0,25.5,0.4",
  ]));
  const ambiguous = await service.executeCycle(cycleInput("ambiguous"));
  assert.equal(ambiguous.status, "BLOCKED_AMBIGUOUS_FORWARD");
  assert.equal(ambiguous.baseline_pointer_advance_count, 0);
  assert.equal(pointer!.baseline_digest, baselineDigest);

  currentBody = body(BASE_ROWS.concat([
    "2026-08-31 19:00:00,190.0,3.1,2.0,25.5,0.4",
    "2026-08-31 21:00:00,210.0,3.3,2.2,26.5,0.6",
  ]));
  const gap = await service.executeCycle(cycleInput("gap"));
  assert.equal(gap.status, "BLOCKED_FORWARD_GAP");
  assert.match(String(gap.blocked_reason), /20:00:00\.000Z/);
  assert.equal(gap.baseline_pointer_advance_count, 0);
  assert.equal(pointer!.baseline_digest, baselineDigest);

  currentBody = body(BASE_ROWS.concat([
    "2026-08-31 19:00:00,190.0,3.1,2.0,25.5,0.4",
    "2026-08-31 20:00:00,200.0,3.2,2.1,26.0,0.5",
  ]));
  const pointerAdvancesBeforeFailure = pointerAdvanceCount;
  failIngressOnAttempt = ingressAttemptCount + 2;
  await assert.rejects(
    () => service.executeCycle(cycleInput("partial-forward")),
    /FOCUSED_SIMULATED_INGRESS_FAILURE/,
  );
  assert.equal(pointerAdvanceCount, pointerAdvancesBeforeFailure);
  assert.equal(pointer!.baseline_digest, baselineDigest);
  assert.equal(committed.size, 1);
  assert.equal(cursorSeen.size, 1);

  const orderBeforeRetry = order.length;
  const repaired = await service.executeCycle(cycleInput("partial-forward-retry"));
  assert.equal(repaired.status, "COMPLETED_FORWARD_DELTA");
  assert.deepEqual(repaired.forward_event_times, [
    "2026-08-31T19:00:00.000Z",
    "2026-08-31T20:00:00.000Z",
  ]);
  assert.equal(repaired.canonical_record_count, 4);
  assert.equal(repaired.visible_ingress_count, 4);
  assert.equal(repaired.evidence_supply_cursor_advance_count, 4);
  assert.equal(pointer!.latest_event_time, "2026-08-31T20:00:00.000Z");
  assert.equal(committed.size, 4);
  assert.equal(cursorSeen.size, 4);
  const retryOrder = order.slice(orderBeforeRetry);
  const lastCursor = Math.max(...retryOrder.map((value, index) =>
    value.startsWith("cursor:") ? index : -1
  ));
  const manifestIndex = retryOrder.findIndex((value) =>
    value === "manifest_write:2026-08-31T20:00:00.000Z"
  );
  const pointerIndex = retryOrder.findIndex((value) =>
    value === "pointer_advance:2026-08-31T20:00:00.000Z"
  );
  assert(lastCursor >= 0);
  assert(manifestIndex > lastCursor, "BASELINE_MANIFEST_MUST_FOLLOW_ALL_VISIBLE_CURSOR_ADVANCES");
  assert(pointerIndex > manifestIndex, "BASELINE_POINTER_MUST_ADVANCE_LAST");

  currentBody = body(BASE_ROWS.concat([
    "2026-08-31 19:00:00,190.0,3.1,2.0,25.5,0.4",
    "2026-08-31 20:00:00,200.0,3.2,2.1,26.0,0.5",
    "2026-08-31 21:00:00,210.0,3.3,2.2,26.5,0.6",
  ]));
  const single = await service.executeCycle(cycleInput("single-forward"));
  assert.equal(single.status, "COMPLETED_FORWARD_DELTA");
  assert.deepEqual(single.forward_event_times, ["2026-08-31T21:00:00.000Z"]);
  assert.equal(single.canonical_record_count, 2);
  assert.equal(pointer!.latest_event_time, "2026-08-31T21:00:00.000Z");

  const finalNoChange = await service.executeCycle(cycleInput("final-no-change"));
  assert.equal(finalNoChange.status, "NO_CHANGE");
  assert.equal(finalNoChange.baseline_pointer_advance_count, 0);

  const proof = {
    schema_version: "geox_mcft_cap09_kbs_raw_hourly_publication_cycle_acceptance_v1",
    status: "PASS",
    baseline_first_snapshot_zero_canonical_emission: true,
    no_change_zero_canonical_zero_pointer_advance: true,
    historical_drift_fail_closed_pointer_unchanged: true,
    ambiguous_forward_fail_closed_pointer_unchanged: true,
    forward_gap_fail_closed_pointer_unchanged: true,
    partial_pair_failure_keeps_old_pointer: true,
    retry_repairs_partial_pair_idempotently: true,
    exact_rain_et0_pair_per_forward_hour: true,
    single_forward_hour_supported: true,
    baseline_manifest_after_all_visible_cursor_advances: true,
    baseline_pointer_compare_and_set_is_last: true,
    provider_request_count: providerFetchCount,
    raw_retention_attempt_count: retentionAttemptCount,
    retained_raw_read_count: rawReadCount,
    baseline_manifest_write_count: manifestWriteCount,
    baseline_pointer_advance_count: pointerAdvanceCount,
    lease_renew_count: renewCount,
    final_pointer_latest_event_time: pointer!.latest_event_time,
    final_committed_record_count: committed.size,
    final_cursor_identity_count: cursorSeen.size,
    runtime_process_start: false,
    production_target_planner_bound: false,
    production_owner_activation: false,
    formal_v5_arm: false,
    a0_bootstrap: false,
    o00_started: false,
  };
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(proof, null, 2) + "\n");
  console.log(JSON.stringify(proof, null, 2));
}

main().catch((error) => {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify({
    schema_version: "geox_mcft_cap09_kbs_raw_hourly_publication_cycle_acceptance_v1",
    status: "FAIL",
    error: error instanceof Error ? error.message : String(error),
    runtime_process_start: false,
    production_target_planner_bound: false,
  }, null, 2) + "\n");
  console.error(error);
  process.exitCode = 1;
});
