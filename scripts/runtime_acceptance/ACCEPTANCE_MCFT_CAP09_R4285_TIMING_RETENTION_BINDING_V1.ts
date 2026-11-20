import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import {
  validateExternalFormalExactBasePromotionInputV1,
} from "../../apps/server/src/runtime/twin_runtime/external_formal_exact_base_fact_promotion_v1.js";
import type { CanonicalizedExternalEvidenceResultV1 } from "../../apps/server/src/external_evidence/mcft_cap09_external_collector_canonicalizer_v1.js";

// Inspect the actual Timing constructor argument without importing its executable
// wrapper: importing the wrapper would start business work and require authority.
const source = fs.readFileSync(new URL("./RUN_MCFT_CAP09_R4285_TIMING_V1.ts", import.meta.url), "utf8");
const file = ts.createSourceFile("timing.ts", source, ts.ScriptTarget.Latest, true);
const constructors: ts.NewExpression[] = [];
function visit(node: ts.Node): void {
  if (ts.isNewExpression(node) && node.expression.getText(file) === "PostgresEvidenceRuntimeFencedExactBaseFactPromotionV1") constructors.push(node);
  ts.forEachChild(node, visit);
}
visit(file);
assert.equal(constructors.length, 1);
const configSource = constructors[0].arguments?.[2]?.getText(file);
assert(configSource, "TIMING_FENCED_PROMOTION_CONFIG_REQUIRED");
const SUBJECT = "b".repeat(40);
const RUN = "4285c3ce342c";
const BUCKET = `mcft-cap09-requal-${RUN}`;
const BASE = "2099-01-01T00:00:00.000Z";
const SHA = "a".repeat(64);
const PREFIX = "mcft-cap09-formal-raw-v1/sha256";
const TYPES = ["future_et0_assumption_v1", "future_weather_assumption_v1", "soil_moisture_observation_v1"];
function config(executionRun: string) {
  return vm.runInNewContext(`(${configSource})`, {
    MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1: "test-scope",
    epoch: "test-epoch", subject: SUBJECT, bucket: BUCKET,
    currentTargets: { bucket: BUCKET },
    // Deliberately different from the resource Run. This must never name the bucket.
    runId: String(parseInt(executionRun, 16)),
  });
}
function results(bucket = BUCKET): CanonicalizedExternalEvidenceResultV1[] {
  return TYPES.map((record_type, i) => ({
    record: { record_type, source_record_id: `controlled-${i}`,
      role_time: record_type === "soil_moisture_observation_v1" ? { observed_at: BASE } : { valid_from: BASE } },
    record_semantic_sha256: "sha256:" + String(i + 1).repeat(64),
    raw_provenance: { raw_sha256: "sha256:" + SHA,
      retention_ref: `s3-private://${bucket}/${PREFIX}/${SHA}` },
  } as unknown as CanonicalizedExternalEvidenceResultV1));
}
function check(retention_authority: ReturnType<typeof config>["retention_authority"], items = results()) {
  return validateExternalFormalExactBasePromotionInputV1({
    base_target_t: BASE, results: items, retention_authority,
    expected_semantic_manifest: items.map(item => ({ record_type: item.record.record_type,
      source_record_id: item.record.source_record_id, record_semantic_sha256: item.record_semantic_sha256 })),
  });
}
for (const executionRun of [RUN, "d0b9e7614a25"]) {
  const actual = config(executionRun);
  assert(actual.retention_authority, "TIMING_ISOLATED_RETENTION_AUTHORITY_REQUIRED");
  assert.equal(actual.subject_sha, SUBJECT);
  assert.equal(actual.retention_authority?.subject_sha, actual.subject_sha);
  assert.equal(actual.retention_authority?.mode, "ISOLATED_QUALIFICATION_ONLY");
  assert.equal(actual.retention_authority?.run_id, RUN);
  assert.equal(actual.retention_authority?.bucket, BUCKET);
  assert.equal(check(actual.retention_authority).results.length, 3);
}
const authority = config(RUN).retention_authority;
assert.throws(() => check(undefined), /PRIVATE_FORMAL_RETENTION_REQUIRED/, "ORIGINAL_OMISSION_MUST_FAIL");
assert.throws(() => check({ ...authority, run_id: "deadbeef0000" }), /AUTHORITY_INVALID/);
assert.throws(() => check(authority, results("mcft-cap09-requal-deadbeef0000")), /PRIVATE_FORMAL_RETENTION_REQUIRED/);
assert.throws(() => check(authority, results("geox-mcft-cap09-formal-raw-v1")), /PRIVATE_FORMAL_RETENTION_REQUIRED/);
assert.equal(check(undefined, results("geox-mcft-cap09-formal-raw-v1")).results.length, 3);
console.log(JSON.stringify({ status: "PASS", suite: "R4285_TIMING_RETENTION_BINDING",
  actual_timing_config_checked: true, legacy_and_successor_resource_binding_checked: true,
  missing_and_cross_run_authority_rejected: true, production_default_preserved: true,
  real_pg: false, real_s3: false, permit_consumed: false, execution_authorized: false }));
