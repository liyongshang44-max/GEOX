import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import type { CanonicalizedExternalEvidenceResultV1 } from "../../apps/server/src/external_evidence/mcft_cap09_external_collector_canonicalizer_v1.js";
import type { ExternalFormalEvidenceIngressResultV1 } from "../../apps/server/src/persistence/twin_runtime/postgres_external_formal_evidence_ingress_v1.js";
import {
  ExternalFormalExactBaseFactPromotionFailureV1,
  promoteExternalFormalExactBaseCanonicalFactsV1,
  type ExternalFormalExactBaseFactIngressPortV1,
} from "../../apps/server/src/runtime/twin_runtime/external_formal_exact_base_fact_promotion_v1.js";

const ROOT = process.cwd();
const OUT = path.join(ROOT, "acceptance-output/MCFT_CAP_09_V13_EXACT_BASE_FACT_PROMOTION_RESULT.json");
const BASE = "2099-04-01T10:00:00.000Z";
const TYPES = ["future_et0_assumption_v1", "future_weather_assumption_v1", "soil_moisture_observation_v1"] as const;

function result(recordType: typeof TYPES[number], index: number): CanonicalizedExternalEvidenceResultV1 {
  const sourceRecordId = `v13_exact_base_${recordType}_${index}`;
  const sourceRecordHash = `source-hash-${recordType}-${index}`;
  const semantic = `sha256:${String(index + 1).repeat(64)}`;
  const record: Record<string, any> = {
    record_type: recordType,
    source_record_id: sourceRecordId,
    source_record_hash: sourceRecordHash,
    role_time: recordType === "soil_moisture_observation_v1"
      ? { observed_at: "2099-04-01T09:50:00.000Z", ingested_at: "2099-04-01T09:55:00.000Z" }
      : { issued_at: "2099-04-01T09:00:00.000Z", ingested_at: "2099-04-01T09:30:00.000Z", valid_from: BASE, valid_to: "2099-04-04T10:00:00.000Z" },
  };
  return {
    record,
    record_semantic_sha256: semantic,
    raw_provenance: {
      retention_ref: `s3-private://geox-mcft-cap09-formal-raw-v1/mcft-cap09-formal-raw-v1/sha256/${String(index + 4).repeat(64)}`,
    },
  } as unknown as CanonicalizedExternalEvidenceResultV1;
}

const RESULTS = TYPES.map((type, index) => result(type, index));
const MANIFEST = RESULTS.map((item) => ({
  record_type: item.record.record_type,
  source_record_id: item.record.source_record_id,
  record_semantic_sha256: item.record_semantic_sha256,
}));

class SequenceIngress implements ExternalFormalExactBaseFactIngressPortV1 {
  calls = 0;
  constructor(private readonly mode: "INSERT_ALL" | "EXIST_ALL" | "MIXED" | "THROW_SECOND" | "MISMATCH_FIRST") {}

  async appendCanonicalizedExternalEvidence(item: CanonicalizedExternalEvidenceResultV1): Promise<ExternalFormalEvidenceIngressResultV1> {
    this.calls += 1;
    if (this.mode === "THROW_SECOND" && this.calls === 2) throw new Error("CONTROLLED_COMMIT_OUTCOME_UNKNOWN");
    const existing = this.mode === "EXIST_ALL" || (this.mode === "MIXED" && this.calls > 1);
    return {
      ingress_id: "MCFT_CAP09_EXTERNAL_FORMAL_EVIDENCE_INGRESS_V1",
      status: existing ? "EXISTING_IDEMPOTENT_SUCCESS" : "INSERTED",
      fact_id: `fact-${item.record.record_type}`,
      record_type: item.record.record_type,
      source_record_id: this.mode === "MISMATCH_FIRST" && this.calls === 1 ? "wrong-source-id" : item.record.source_record_id,
      source_record_hash: item.record.source_record_hash,
      retention_ref: item.raw_provenance.retention_ref,
      raw_sha256: `sha256:${"a".repeat(64)}`,
      raw_bytes: 100,
      canonical_fact_write_count: existing ? 0 : 1,
    };
  }
}

async function run(mode: ConstructorParameters<typeof SequenceIngress>[0]) {
  const ingress = new SequenceIngress(mode);
  const receipt = await promoteExternalFormalExactBaseCanonicalFactsV1({
    base_target_t: BASE,
    results: RESULTS,
    expected_semantic_manifest: MANIFEST,
  }, ingress);
  return { ingress, receipt };
}

async function main(): Promise<void> {
  const fresh = await run("INSERT_ALL");
  assert.equal(fresh.receipt.formal_database_write_count, 3);
  assert.equal(fresh.receipt.idempotent_existing_fact_count, 0);
  assert.equal(fresh.receipt.formal_fact_present_count, 3);
  assert.equal(fresh.receipt.facts.length, 3);

  const restart = await run("EXIST_ALL");
  assert.equal(restart.receipt.formal_database_write_count, 0);
  assert.equal(restart.receipt.idempotent_existing_fact_count, 3);
  assert.equal(restart.receipt.formal_fact_present_count, 3);

  const mixed = await run("MIXED");
  assert.equal(mixed.receipt.formal_database_write_count, 1);
  assert.equal(mixed.receipt.idempotent_existing_fact_count, 2);
  assert.equal(mixed.receipt.formal_fact_present_count, 3);

  const invalid = RESULTS.map((item) => ({ ...item })) as CanonicalizedExternalEvidenceResultV1[];
  invalid[0] = {
    ...invalid[0],
    raw_provenance: { ...invalid[0].raw_provenance, retention_ref: `s3-private://geox-mcft-cap09-formal-raw-v1/mcft-cap09-ea5e2-readiness-transient-v1/${"b".repeat(64)}` },
  } as CanonicalizedExternalEvidenceResultV1;
  const untouched = new SequenceIngress("INSERT_ALL");
  await assert.rejects(
    () => promoteExternalFormalExactBaseCanonicalFactsV1({ base_target_t: BASE, results: invalid, expected_semantic_manifest: MANIFEST }, untouched),
    (error: unknown) => error instanceof ExternalFormalExactBaseFactPromotionFailureV1
      && error.mutation_state === "NO_FORMAL_MUTATION"
      && error.confirmed_new_fact_write_count === 0,
  );
  assert.equal(untouched.calls, 0);

  const uncertain = new SequenceIngress("THROW_SECOND");
  await assert.rejects(
    () => promoteExternalFormalExactBaseCanonicalFactsV1({ base_target_t: BASE, results: RESULTS, expected_semantic_manifest: MANIFEST }, uncertain),
    (error: unknown) => error instanceof ExternalFormalExactBaseFactPromotionFailureV1
      && error.mutation_state === "UNKNOWN_FORMAL_MUTATION"
      && error.confirmed_new_fact_write_count === null,
  );
  assert.equal(uncertain.calls, 2);

  const mismatch = new SequenceIngress("MISMATCH_FIRST");
  await assert.rejects(
    () => promoteExternalFormalExactBaseCanonicalFactsV1({ base_target_t: BASE, results: RESULTS, expected_semantic_manifest: MANIFEST }, mismatch),
    (error: unknown) => error instanceof ExternalFormalExactBaseFactPromotionFailureV1
      && error.mutation_state === "PARTIAL_FORMAL_MUTATION"
      && error.confirmed_new_fact_write_count === 1,
  );
  assert.equal(mismatch.calls, 1);

  const proof = {
    status: "PASS",
    acceptance_mode: "V13_EXACT_BASE_CANONICAL_FACT_PROMOTION_CONTRACT",
    fresh_three_new_writes_supported: fresh.receipt.formal_database_write_count === 3,
    restart_three_existing_idempotent_supported: restart.receipt.formal_database_write_count === 0 && restart.receipt.idempotent_existing_fact_count === 3,
    mixed_new_and_existing_supported: mixed.receipt.formal_database_write_count === 1 && mixed.receipt.idempotent_existing_fact_count === 2,
    pre_ingress_validation_failure_proves_zero_mutation: untouched.calls === 0,
    append_exception_never_assumed_rolled_back: uncertain.calls === 2,
    receipt_mismatch_after_confirmed_write_is_partial_mutation: mismatch.calls === 1,
    exact_three_fact_presence_is_success_authority: true,
    new_write_count_equals_success_authority: false,
    production_workflow_effect: false,
    mcft_cap09_completed: false,
  };
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(proof, null, 2) + "\n");
  console.log(JSON.stringify(proof, null, 2));
}

main().catch((error) => {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify({ status: "FAIL", error: error instanceof Error ? error.message : String(error) }, null, 2) + "\n");
  console.error(error);
  process.exitCode = 1;
});
