import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import type {
  RawEvidenceRetentionInputV1,
  VerifiedRawEvidenceProvenanceV1,
} from "../../apps/server/src/external_evidence/mcft_cap09_external_collector_canonicalizer_v1.js";
import {
  buildVerifiedRetainedRawReplayRequestV1,
  ExistingRetainedRawVerificationBarrierV1,
  VerifiedRetainedRawReadbackTransportV1,
} from "../../apps/server/src/external_evidence/verified_retained_raw_replay_v1.js";
import {
  MCFT_CAP09_PRIVATE_RETAINED_RAW_READER_ID_V1,
  type PrivateRetainedRawReadReceiptV1,
} from "../../apps/server/src/external_evidence/s3_compatible_private_retained_raw_reader_v1.js";

const OUT = path.resolve(
  "acceptance-output/MCFT_CAP_09_VERIFIED_RETAINED_RAW_REPLAY_V1_RESULT.json",
);
const BYTES = Buffer.from("retained-raw-replay-fixture\n", "utf8");
const DIGEST = "sha256:" + crypto.createHash("sha256").update(BYTES).digest("hex");

const RAW: VerifiedRawEvidenceProvenanceV1 = {
  request_id: "retained-replay-fixture",
  provider_id: "KBS_LTER",
  source_family: "RAW_HOURLY_WEATHER",
  source_locator: "https://lter.kbs.msu.edu/datatables/13.csv",
  final_locator: "https://lter.kbs.msu.edu/datatables/13.csv",
  content_type: "text/csv",
  retrieved_at: "2026-08-31T20:05:00.000Z",
  available_at: "2026-08-31T20:05:00.000Z",
  raw_sha256: DIGEST,
  raw_bytes: BYTES.byteLength,
  retention_ref: "s3-private://qualification/mcft-cap09-formal-raw-v1/sha256/" + DIGEST.slice(7),
  retained_at: "2026-08-31T20:05:01.000Z",
  use_policy_ref: "https://example.invalid/policy/kbs-retained-replay",
  source_event_time: "2026-08-31T20:00:00.000Z",
};

const READ: PrivateRetainedRawReadReceiptV1 = {
  reader_id: MCFT_CAP09_PRIVATE_RETAINED_RAW_READER_ID_V1,
  retention_ref: RAW.retention_ref,
  retained_sha256: RAW.raw_sha256,
  retained_bytes: RAW.raw_bytes,
  retained_at: RAW.retained_at,
  bytes: new Uint8Array(BYTES),
  provider_refetch_count: 0,
  raw_store_write_count: 0,
  formal_database_write_count: 0,
};

function retentionInput(): RawEvidenceRetentionInputV1 {
  return {
    retention_class: "PRIVATE_RESTRICTED_RAW_EVIDENCE",
    request_id: RAW.request_id,
    provider_id: RAW.provider_id,
    source_family: RAW.source_family,
    source_locator: RAW.source_locator,
    final_locator: RAW.final_locator,
    content_type: RAW.content_type,
    retrieved_at: RAW.retrieved_at,
    available_at: RAW.available_at,
    source_event_time: RAW.source_event_time,
    use_policy_ref: RAW.use_policy_ref,
    raw_sha256: RAW.raw_sha256,
    raw_bytes: RAW.raw_bytes,
    bytes: new Uint8Array(BYTES),
  };
}

async function main(): Promise<void> {
  const request = buildVerifiedRetainedRawReplayRequestV1(RAW, {
    purpose_limitations: ["KBS_PUBLICATION_FORWARD_BATCH_REPLAY"],
  });
  assert.deepEqual(request.allowed_final_hosts, ["lter.kbs.msu.edu"]);
  assert.equal(request.requested_at, RAW.retrieved_at);
  assert(request.limitations.includes("NO_PROVIDER_REFETCH"));
  assert(request.limitations.includes("NO_RAW_STORE_WRITE"));

  const transport = new VerifiedRetainedRawReadbackTransportV1(RAW, READ);
  const response = await transport.fetchRawEvidence(request);
  assert.equal(response.status, 200);
  assert.equal(Buffer.from(response.bytes).equals(BYTES), true);
  assert.equal(transport.provider_refetch_count, 0);

  const barrier = new ExistingRetainedRawVerificationBarrierV1(RAW, READ);
  const receipt = await barrier.retainRawEvidence(retentionInput());
  assert.equal(receipt.retention_ref, RAW.retention_ref);
  assert.equal(receipt.retained_sha256, RAW.raw_sha256);
  assert.equal(receipt.retained_at, RAW.retained_at);
  assert.equal(barrier.raw_store_write_count, 0);

  await assert.rejects(
    () => transport.fetchRawEvidence({ ...request, provider_id: "WRONG" }),
    /RETAINED_REPLAY_REQUEST_IDENTITY_MISMATCH/,
  );
  await assert.rejects(
    () => barrier.retainRawEvidence({ ...retentionInput(), available_at: "2026-08-31T20:06:00.000Z" }),
    /RETAINED_REPLAY_EXISTING_RETENTION_BARRIER_MISMATCH/,
  );
  assert.throws(
    () => new VerifiedRetainedRawReadbackTransportV1(RAW, {
      ...READ,
      retained_sha256: "sha256:" + "0".repeat(64),
    }),
    /RETAINED_REPLAY_VERIFIED_READ_RECEIPT_MISMATCH/,
  );
  assert.throws(
    () => new ExistingRetainedRawVerificationBarrierV1(RAW, {
      ...READ,
      retained_at: "2026-08-31T20:05:02.000Z",
    }),
    /RETAINED_REPLAY_VERIFIED_READ_RECEIPT_MISMATCH/,
  );

  const proof = {
    schema_version: "geox_mcft_cap09_verified_retained_raw_replay_acceptance_v1",
    status: "PASS",
    exact_request_identity_required: true,
    exact_verified_read_receipt_required: true,
    exact_retention_provenance_required: true,
    retained_at_identity_required: true,
    provider_refetch_count: 0,
    raw_store_write_count: 0,
    database_connection_attempted: false,
    canonical_evidence_write_count: 0,
    runtime_tick_cursor_access_count: 0,
    twin_state_mutation: false,
    production_process_binding: false,
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
    schema_version: "geox_mcft_cap09_verified_retained_raw_replay_acceptance_v1",
    status: "FAIL",
    error: error instanceof Error ? error.message : String(error),
    provider_refetch_count: 0,
    raw_store_write_count: 0,
  }, null, 2) + "\n");
  console.error(error);
  process.exitCode = 1;
});
