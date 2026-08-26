import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { semanticHashV1 } from "../../apps/server/src/domain/twin_runtime/canonical_identity_v1.js";
import type { CanonicalizedExternalEvidenceResultV1 } from "../../apps/server/src/external_evidence/mcft_cap09_external_collector_canonicalizer_v1.js";
import type {
  ExternalFormalEvidenceIngressPortV1,
  ExternalFormalEvidenceIngressReceiptV1,
} from "../../apps/server/src/external_evidence/mcft_cap09_external_formal_collector_phase_orchestrator_v1.js";
import {
  MCFT_CAP09_EVIDENCE_POST_COMMIT_VISIBILITY_ID_V1,
  PostCommitVisibleExternalFormalEvidenceIngressV1,
  type EvidenceSupplyCursorPortV1,
} from "../../apps/server/src/external_evidence/mcft_cap09_evidence_visibility_supply_cursor_v1.js";
import { PostgresExternalFormalEvidenceVisibilityV1 } from "../../apps/server/src/persistence/external_evidence/postgres_external_formal_evidence_visibility_v1.js";

const ROOT = path.resolve(import.meta.dirname, "../..");
const OUT = path.join(ROOT, "acceptance-output/MCFT_CAP_09_PHASE2_POST_COMMIT_VISIBILITY_CURSOR_V1_RESULT.json");
const FACT_ID = `fact_external_evidence_${"1".repeat(64)}`;
const RAW_SHA = `sha256:${"2".repeat(64)}`;
const SOURCE_HASH = `sha256:${"3".repeat(64)}`;
const RETENTION_REF = `s3-private://mcft-cap09-formal-raw-v1/sha256/${"2".repeat(64)}`;
const READBACK_AT = "2026-08-26T14:00:01.000Z";

function fixture(): {
  result: CanonicalizedExternalEvidenceResultV1;
  record: Record<string, unknown>;
  receipt: ExternalFormalEvidenceIngressReceiptV1;
} {
  const rawProvenance = {
    raw_sha256: RAW_SHA,
    raw_bytes: 128,
    retention_ref: RETENTION_REF,
    retained_at: "2026-08-26T13:59:58.000Z",
    decoder_id: "MCFT_CAP09_PHASE2_TEST_DECODER_V1",
    decoder_version: "1",
    raw_payload_embedded: false,
  };
  const record = {
    tenant_id: "tenantA",
    project_id: "projectA",
    group_id: "groupA",
    field_id: "field_e3r1",
    season_id: "season_2026",
    zone_id: "zone_root",
    dataset_id: "phase2_visibility_acceptance_v1",
    source_record_id: "source-phase2-visible-001",
    source_record_hash: SOURCE_HASH,
    record_type: "soil_moisture_observation_v1",
    binding_id: "MCFT_CAP09_EXTERNAL_FORMAL_SOIL_BINDING_V1",
    origin_source_kind: "PUBLIC_PROVIDER",
    origin_source_id: "KBS_LTER_VARIATE_25",
    epistemic_class: "OBSERVED",
    available_to_runtime_at: "2026-08-26T14:00:00.000Z",
    role_time: { observed_at: "2026-08-26T13:55:00.000Z", ingested_at: "2026-08-26T14:00:00.000Z" },
    quality: { status: "LIMITED" },
    source_payload: { raw_provenance: rawProvenance },
    canonical_payload: { volumetric_water_content_decimal: "0.250000" },
    source_unit: "fraction",
    canonical_unit: "fraction",
    conversion_rule: { rule_id: "IDENTITY" },
    limitations: ["QUALIFICATION_FIXTURE_ONLY"],
  };
  const semantic = semanticHashV1(record);
  const result = {
    record,
    raw_provenance: rawProvenance,
    record_semantic_sha256: semantic,
  } as unknown as CanonicalizedExternalEvidenceResultV1;
  const receipt: ExternalFormalEvidenceIngressReceiptV1 = {
    status: "INSERTED",
    fact_id: FACT_ID,
    record_type: record.record_type,
    source_record_id: record.source_record_id,
    source_record_hash: SOURCE_HASH,
    retention_ref: RETENTION_REF,
    raw_sha256: RAW_SHA,
    raw_bytes: 128,
    canonical_fact_write_count: 1,
  };
  return { result, record, receipt };
}

function fakeIngress(
  order: string[],
  receipt: ExternalFormalEvidenceIngressReceiptV1,
): ExternalFormalEvidenceIngressPortV1 {
  return {
    async appendCanonicalizedExternalEvidence() {
      order.push("ingress_commit_returned");
      return structuredClone(receipt);
    },
  };
}

function fakeVisibilityPool(input: {
  order: string[];
  record: Record<string, unknown>;
  row_count?: number;
}): ConstructorParameters<typeof PostgresExternalFormalEvidenceVisibilityV1>[0] {
  return {
    async query(_sql: string, params?: unknown[]) {
      input.order.push("fresh_post_commit_readback");
      assert.deepEqual(params, [FACT_ID]);
      const count = input.row_count ?? 1;
      return {
        rows: Array.from({ length: count }, () => ({
          record_json: { type: input.record.record_type, payload: structuredClone(input.record) },
          post_commit_db_readback_at: READBACK_AT,
        })),
      };
    },
  } as unknown as ConstructorParameters<typeof PostgresExternalFormalEvidenceVisibilityV1>[0];
}

function fakeCursor(input: {
  order: string[];
  calls: { value: number };
  fact_id?: string;
}): EvidenceSupplyCursorPortV1 {
  return {
    async advanceAfterVisibleEvidence(request) {
      input.order.push("evidence_supply_cursor_advance");
      input.calls.value += 1;
      assert.equal(request.cursor_contract_id, "MCFT_CAP09_EVIDENCE_SUPPLY_CURSOR_CONTRACT_V1");
      assert.equal(request.visible_evidence.visibility_id, MCFT_CAP09_EVIDENCE_POST_COMMIT_VISIBILITY_ID_V1);
      assert.equal(request.visible_evidence.fact_id, FACT_ID);
      assert.equal(request.binding_id, "MCFT_CAP09_EXTERNAL_FORMAL_SOIL_BINDING_V1");
      assert.equal(request.origin_source_id, "KBS_LTER_VARIATE_25");
      return {
        status: "ADVANCED",
        fact_id: input.fact_id ?? request.visible_evidence.fact_id,
        record_semantic_sha256: request.visible_evidence.record_semantic_sha256,
      };
    },
  };
}

async function expectReject(fn: () => Promise<unknown>, pattern: RegExp): Promise<void> {
  let error: unknown = null;
  try {
    await fn();
  } catch (caught) {
    error = caught;
  }
  assert(error instanceof Error, "EXPECTED_FAIL_CLOSED_ERROR");
  assert.match(error.message, pattern);
}

async function main(): Promise<void> {
  const successful = fixture();
  const order: string[] = [];
  const cursorCalls = { value: 0 };
  const visibility = new PostgresExternalFormalEvidenceVisibilityV1(
    fakeVisibilityPool({ order, record: successful.record }),
  );
  const visibleIngress = new PostCommitVisibleExternalFormalEvidenceIngressV1(
    fakeIngress(order, successful.receipt),
    visibility,
    fakeCursor({ order, calls: cursorCalls }),
  );
  const receipt = await visibleIngress.appendCanonicalizedExternalEvidence(successful.result);
  assert.deepEqual(order, ["ingress_commit_returned", "fresh_post_commit_readback", "evidence_supply_cursor_advance"]);
  assert.equal(cursorCalls.value, 1);
  assert.equal(receipt.post_commit_visibility_verified, true);
  assert.equal(receipt.post_commit_db_readback_at, READBACK_AT);
  assert.equal(receipt.evidence_supply_cursor_advanced, true);

  const absent = fixture();
  const absentOrder: string[] = [];
  const absentCursorCalls = { value: 0 };
  const absentIngress = new PostCommitVisibleExternalFormalEvidenceIngressV1(
    fakeIngress(absentOrder, absent.receipt),
    new PostgresExternalFormalEvidenceVisibilityV1(
      fakeVisibilityPool({ order: absentOrder, record: absent.record, row_count: 0 }),
    ),
    fakeCursor({ order: absentOrder, calls: absentCursorCalls }),
  );
  await expectReject(
    () => absentIngress.appendCanonicalizedExternalEvidence(absent.result),
    /PHASE2_VISIBILITY_EXACT_ONE_FACT_REQUIRED:0/,
  );
  assert.equal(absentCursorCalls.value, 0);
  assert.deepEqual(absentOrder, ["ingress_commit_returned", "fresh_post_commit_readback"]);

  const drift = fixture();
  const driftOrder: string[] = [];
  const driftCursorCalls = { value: 0 };
  const driftedRecord = structuredClone(drift.record);
  driftedRecord.source_record_hash = `sha256:${"9".repeat(64)}`;
  const driftIngress = new PostCommitVisibleExternalFormalEvidenceIngressV1(
    fakeIngress(driftOrder, drift.receipt),
    new PostgresExternalFormalEvidenceVisibilityV1(
      fakeVisibilityPool({ order: driftOrder, record: driftedRecord }),
    ),
    fakeCursor({ order: driftOrder, calls: driftCursorCalls }),
  );
  await expectReject(
    () => driftIngress.appendCanonicalizedExternalEvidence(drift.result),
    /PHASE2_VISIBILITY_SOURCE_RECORD_HASH_MISMATCH/,
  );
  assert.equal(driftCursorCalls.value, 0);

  const missingReceipt = fixture();
  const missingOrder: string[] = [];
  const missingCursorCalls = { value: 0 };
  delete missingReceipt.receipt.fact_id;
  const missingReceiptIngress = new PostCommitVisibleExternalFormalEvidenceIngressV1(
    fakeIngress(missingOrder, missingReceipt.receipt),
    new PostgresExternalFormalEvidenceVisibilityV1(
      fakeVisibilityPool({ order: missingOrder, record: missingReceipt.record }),
    ),
    fakeCursor({ order: missingOrder, calls: missingCursorCalls }),
  );
  await expectReject(
    () => missingReceiptIngress.appendCanonicalizedExternalEvidence(missingReceipt.result),
    /PHASE2_VISIBLE_INGRESS_FACT_ID_REQUIRED/,
  );
  assert.deepEqual(missingOrder, ["ingress_commit_returned"]);
  assert.equal(missingCursorCalls.value, 0);

  const cursorDrift = fixture();
  const cursorDriftOrder: string[] = [];
  const cursorDriftCalls = { value: 0 };
  const cursorDriftIngress = new PostCommitVisibleExternalFormalEvidenceIngressV1(
    fakeIngress(cursorDriftOrder, cursorDrift.receipt),
    new PostgresExternalFormalEvidenceVisibilityV1(
      fakeVisibilityPool({ order: cursorDriftOrder, record: cursorDrift.record }),
    ),
    fakeCursor({ order: cursorDriftOrder, calls: cursorDriftCalls, fact_id: "wrong-fact-id" }),
  );
  await expectReject(
    () => cursorDriftIngress.appendCanonicalizedExternalEvidence(cursorDrift.result),
    /PHASE2_SUPPLY_CURSOR_RESULT_IDENTITY_MISMATCH/,
  );
  assert.equal(cursorDriftCalls.value, 1);

  const wrapperSource = fs.readFileSync(
    path.join(ROOT, "apps/server/src/external_evidence/mcft_cap09_evidence_visibility_supply_cursor_v1.ts"),
    "utf8",
  );
  const adapterSource = fs.readFileSync(
    path.join(ROOT, "apps/server/src/persistence/external_evidence/postgres_external_formal_evidence_visibility_v1.ts"),
    "utf8",
  );
  for (const forbidden of ["scripts/runtime_acceptance", "process.env", "child_process", "setTimeout(", "fetch("]) {
    assert.equal(wrapperSource.includes(forbidden), false, `PHASE2_WRAPPER_FORBIDDEN_DEPENDENCY:${forbidden}`);
  }
  assert.equal(/from\s+["'][^"']*runtime\/twin_runtime\//.test(wrapperSource), false, "PHASE2_WRAPPER_TWIN_RUNTIME_IMPORT_FORBIDDEN");
  assert.equal(/from\s+["'][^"']*runtime\/twin_runtime\//.test(adapterSource), false, "PHASE2_VISIBILITY_TWIN_RUNTIME_IMPORT_FORBIDDEN");
  assert.equal(/\bINSERT\s+INTO\b/i.test(adapterSource), false, "PHASE2_VISIBILITY_DB_WRITE_FORBIDDEN");
  assert.equal(/\bUPDATE\s+public\.facts\b/i.test(adapterSource), false, "PHASE2_VISIBILITY_DB_UPDATE_FORBIDDEN");
  assert.equal(/\bDELETE\s+FROM\b/i.test(adapterSource), false, "PHASE2_VISIBILITY_DB_DELETE_FORBIDDEN");

  const proof = {
    status: "PASS",
    acceptance_id: "MCFT_CAP09_PHASE2_POST_COMMIT_VISIBILITY_CURSOR_V1",
    ordering: ["GOVERNED_INGRESS_COMMIT_RETURN", "FRESH_DB_READBACK", "EXACT_IDENTITY_VERIFY", "EVIDENCE_SUPPLY_CURSOR_ADVANCE"],
    successful_cursor_advance_count: cursorCalls.value,
    missing_visibility_cursor_advance_count: absentCursorCalls.value,
    identity_drift_cursor_advance_count: driftCursorCalls.value,
    missing_receipt_cursor_advance_count: missingCursorCalls.value,
    cursor_identity_conflict_fails_closed: true,
    postgres_visibility_read_only: true,
    raw_object_fallback: false,
    runtime_tick_cursor_mutation: false,
    twin_state_mutation: false,
    production_evidence_runtime_activation: false,
    production_twin_runtime_activation: false,
    provider_production_cadence_owner_activation: false,
    formal_database_mutation: false,
    formal_v5_armed: false,
    graduation_effect: false,
    mcft_cap09_completed: false,
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
