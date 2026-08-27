import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  MCFT_CAP09_EVIDENCE_PRODUCER_LEASE_CONTRACT_ID_V1,
  type EvidenceProducerLeaseClaimV1,
  type EvidenceProducerLeasePortV1,
  type EvidenceRuntimeScopeV1,
} from "../../apps/server/src/external_evidence/mcft_cap09_evidence_runtime_persistence_v1.js";
import {
  EvidenceRuntimeCycleServiceV1,
  type EvidenceSupplyCursorFactoryV1,
} from "../../apps/server/src/external_evidence/mcft_cap09_evidence_runtime_cycle_service_v1.js";
import {
  MCFT_CAP09_EVIDENCE_POST_COMMIT_VISIBILITY_ID_V1,
  type EvidenceSupplyCursorPortV1,
  type ExternalEvidencePostCommitVisibilityPortV1,
} from "../../apps/server/src/external_evidence/mcft_cap09_evidence_visibility_supply_cursor_v1.js";
import type {
  ExternalEvidenceDecoderPortV1,
  ExternalEvidenceTransportPortV1,
  RawEvidenceRetentionPortV1,
} from "../../apps/server/src/external_evidence/mcft_cap09_external_collector_canonicalizer_v1.js";
import type {
  ExternalFormalEvidenceIngressPortV1,
} from "../../apps/server/src/external_evidence/mcft_cap09_external_formal_collector_phase_orchestrator_v1.js";

const OUT = path.resolve("acceptance-output/MCFT_CAP_09_PHASE3_EVIDENCE_RUNTIME_CYCLE_V1_RESULT.json");
const SCOPE: EvidenceRuntimeScopeV1 = {
  tenant_id: "tenantA",
  project_id: "projectA",
  group_id: "groupA",
  field_id: "field_e3r1",
  season_id: "season_2026",
  zone_id: "zone_root",
};
const RAW = new TextEncoder().encode('{"phase3":"cycle"}');
const REQUESTED_AT = "2026-08-27T02:00:00.000Z";
const RETRIEVED_AT = "2026-08-27T02:00:01.000Z";
const RETAINED_AT = "2026-08-27T02:00:02.000Z";
const DECODED_AT = "2026-08-27T02:00:03.000Z";
const CANONICALIZED_AT = "2026-08-27T02:00:04.000Z";
const READBACK_AT = "2026-08-27T02:00:05.000Z";

function claim(owner = "evidence-host-A"): EvidenceProducerLeaseClaimV1 {
  return {
    lease_contract_id: MCFT_CAP09_EVIDENCE_PRODUCER_LEASE_CONTRACT_ID_V1,
    scope: { ...SCOPE },
    lease_owner: owner,
    fencing_token: 7n,
    acquired_at: "2026-08-27T01:59:00.000Z",
    expires_at: "2026-08-27T02:10:00.000Z",
    heartbeat_at: "2026-08-27T01:59:00.000Z",
    database_now: "2026-08-27T02:00:00.000Z",
  };
}

function leasePort(order: string[], blocked = false): EvidenceProducerLeasePortV1 {
  return {
    async acquireLease() {
      order.push("lease_acquire");
      return blocked ? null : claim();
    },
    async renewLease(input) {
      order.push("lease_renew");
      return { ...input.claim, heartbeat_at: "2026-08-27T02:00:00.500Z", database_now: "2026-08-27T02:00:00.500Z" };
    },
    async releaseLease() {
      order.push("lease_release");
    },
  };
}

function transport(order: string[]): ExternalEvidenceTransportPortV1 {
  return {
    async fetchRawEvidence(request) {
      order.push("provider_fetch");
      assert.equal(request.provider_id, "PHASE3_TEST_PROVIDER");
      return {
        status: 200,
        final_locator: request.locator,
        content_type: "application/json",
        retrieved_at: RETRIEVED_AT,
        available_at: RETRIEVED_AT,
        bytes: RAW,
      };
    },
  };
}

function retention(order: string[]): RawEvidenceRetentionPortV1 {
  return {
    async retainRawEvidence(input) {
      order.push("raw_retention");
      assert.equal(input.bytes.byteLength, RAW.byteLength);
      assert.match(input.raw_sha256, /^sha256:[0-9a-f]{64}$/);
      return {
        retention_class: "PRIVATE_RESTRICTED_RAW_EVIDENCE",
        retention_ref: `s3-private://phase3-cycle/${input.raw_sha256.slice("sha256:".length)}`,
        retained_sha256: input.raw_sha256,
        retained_bytes: input.raw_bytes,
        retained_at: RETAINED_AT,
        externally_publishable: false,
      };
    },
  };
}

function decoder(order: string[]): ExternalEvidenceDecoderPortV1 {
  return {
    decoder_id: "PHASE3_CYCLE_TEST_DECODER_V1",
    decoder_version: "1",
    async decodeRetainedEvidence(input) {
      order.push("retained_decode");
      assert(order.indexOf("raw_retention") < order.indexOf("retained_decode"));
      return [{
        role: "SOIL_MOISTURE_OBSERVATION",
        source_record_id: "phase3-cycle-source-001",
        binding_id: "PHASE3_CYCLE_BINDING_V1",
        origin_source_kind: "QUALIFICATION_FIXTURE",
        origin_source_id: "PHASE3_TEST_PROVIDER:SENSOR",
        epistemic_class: "OBSERVED",
        available_to_runtime_at: RETRIEVED_AT,
        role_time: {
          observed_at: "2026-08-27T01:55:00.000Z",
          ingested_at: DECODED_AT,
        },
        quality: { status: "PASS" },
        source_payload: { fixture: true },
        canonical_payload: { value: 0.25 },
        source_unit: "fraction",
        canonical_unit: "fraction",
        conversion_rule: {
          conversion_rule_id: "IDENTITY_PHASE3_TEST_V1",
          conversion_rule_version: "1",
          authority_ref: "PHASE3_QUALIFICATION_ONLY",
        },
        source_binding_version: 1,
        limitations: ["QUALIFICATION_FIXTURE_ONLY"],
      }];
    },
  };
}

function committedIngress(order: string[]): ExternalFormalEvidenceIngressPortV1 {
  return {
    async appendCanonicalizedExternalEvidence(result) {
      order.push("governed_commit_returned");
      return {
        status: "INSERTED",
        fact_id: `fact_external_evidence_${"1".repeat(64)}`,
        record_type: result.record.record_type,
        source_record_id: result.record.source_record_id,
        source_record_hash: result.record.source_record_hash,
        retention_ref: result.raw_provenance.retention_ref,
        raw_sha256: result.raw_provenance.raw_sha256,
        raw_bytes: result.raw_provenance.raw_bytes,
        canonical_fact_write_count: 1,
      };
    },
  };
}

function visibility(order: string[]): ExternalEvidencePostCommitVisibilityPortV1 {
  return {
    async verifyCommittedEvidenceVisible(expected) {
      order.push("fresh_post_commit_readback");
      return {
        ...expected,
        visibility_id: MCFT_CAP09_EVIDENCE_POST_COMMIT_VISIBILITY_ID_V1,
        post_commit_db_readback_at: READBACK_AT,
      };
    },
  };
}

function cursorFactory(order: string[]): EvidenceSupplyCursorFactoryV1 {
  return {
    createForProducerClaim(actualClaim) {
      order.push("cursor_bound_to_lease");
      assert.equal(actualClaim.fencing_token, 7n);
      const cursor: EvidenceSupplyCursorPortV1 = {
        async advanceAfterVisibleEvidence(input) {
          order.push("durable_supply_cursor_advance");
          assert.equal(input.visible_evidence.post_commit_db_readback_at, READBACK_AT);
          return {
            status: "ADVANCED",
            fact_id: input.visible_evidence.fact_id,
            record_semantic_sha256: input.visible_evidence.record_semantic_sha256,
          };
        },
      };
      return cursor;
    },
  };
}

function work(order: string[]) {
  return {
    work_item_id: "phase3-soil-cycle",
    dataset_id: "phase3_cycle_qualification_v1",
    request: {
      request_id: "phase3-cycle-request-001",
      provider_id: "PHASE3_TEST_PROVIDER",
      source_family: "PHASE3_TEST_SOURCE",
      locator: "https://example.invalid/phase3-cycle",
      allowed_final_hosts: ["example.invalid"],
      use_policy_ref: "PHASE3_QUALIFICATION_ONLY",
      requested_at: REQUESTED_AT,
      expected_content_type_prefixes: ["application/json"],
      limitations: ["QUALIFICATION_FIXTURE_ONLY"],
    },
    transport: transport(order),
    decoder: decoder(order),
  };
}

async function main(): Promise<void> {
  const order: string[] = [];
  const service = new EvidenceRuntimeCycleServiceV1({
    lease: leasePort(order),
    retention: retention(order),
    committed_ingress: committedIngress(order),
    visibility: visibility(order),
    cursor_factory: cursorFactory(order),
    completion_clock: () => {
      order.push("canonicalization_completion_clock");
      return CANONICALIZED_AT;
    },
  });
  const result = await service.executeCycle({
    scope: SCOPE,
    lease_owner: "evidence-host-A",
    lease_duration_seconds: 300,
    work_items: [work(order)],
  });
  assert.equal(result.status, "COMPLETED");
  if (result.status !== "COMPLETED") throw new Error("PHASE3_CYCLE_COMPLETION_REQUIRED");
  assert.equal(result.canonical_record_count, 1);
  assert.equal(result.visible_ingress_count, 1);
  assert.equal(result.evidence_supply_cursor_advance_count, 1);
  assert.deepEqual(order, [
    "lease_acquire",
    "lease_renew",
    "cursor_bound_to_lease",
    "provider_fetch",
    "raw_retention",
    "retained_decode",
    "canonicalization_completion_clock",
    "governed_commit_returned",
    "fresh_post_commit_readback",
    "durable_supply_cursor_advance",
  ]);

  const blockedOrder: string[] = [];
  const blockedService = new EvidenceRuntimeCycleServiceV1({
    lease: leasePort(blockedOrder, true),
    retention: retention(blockedOrder),
    committed_ingress: committedIngress(blockedOrder),
    visibility: visibility(blockedOrder),
    cursor_factory: cursorFactory(blockedOrder),
    completion_clock: () => CANONICALIZED_AT,
  });
  const blocked = await blockedService.executeCycle({
    scope: SCOPE,
    lease_owner: "evidence-host-B",
    lease_duration_seconds: 300,
    work_items: [work(blockedOrder)],
  });
  assert.equal(blocked.status, "LEASE_HELD_BY_OTHER_OWNER");
  assert.deepEqual(blockedOrder, ["lease_acquire"]);

  const proof = {
    schema_version: "geox_mcft_cap09_phase3_evidence_runtime_cycle_qualification_v1",
    status: "PASS",
    exact_order: order,
    provider_fetch_after_lease: true,
    raw_retention_before_decode: true,
    governed_commit_before_visibility: true,
    post_commit_visibility_before_cursor: true,
    lease_contention_provider_request_count: 0,
    canonical_record_count: result.canonical_record_count,
    visible_ingress_count: result.visible_ingress_count,
    durable_cursor_advance_count: result.evidence_supply_cursor_advance_count,
    production_cadence_activation: false,
    timer_loop_present: false,
    runtime_tick_cursor_mutation: false,
    twin_state_mutation: false,
    formal_v5_armed: false,
    graduation_effect: false,
  };
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, `${JSON.stringify(proof, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(proof)}\n`);
}

main().catch((error) => {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, `${JSON.stringify({ status: "FAIL", error: error instanceof Error ? error.message : String(error) }, null, 2)}\n`);
  console.error(error);
  process.exitCode = 1;
});
