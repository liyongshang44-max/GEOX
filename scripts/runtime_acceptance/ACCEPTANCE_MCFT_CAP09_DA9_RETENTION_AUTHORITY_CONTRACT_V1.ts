import assert from "node:assert/strict";
import {
  validateExternalFormalExactBasePromotionInputV1,
  type ExternalFormalExactBaseRetentionAuthorityV1,
} from "../../apps/server/src/runtime/twin_runtime/external_formal_exact_base_fact_promotion_v1.js";
import type { CanonicalizedExternalEvidenceResultV1 } from "../../apps/server/src/external_evidence/mcft_cap09_external_collector_canonicalizer_v1.js";

const RUN = "abcdef012345";
const SUBJECT = "b".repeat(40);
const BASE = "2099-01-01T00:00:00.000Z";
const PREFIX = "mcft-cap09-formal-raw-v1/sha256";
const SHA = "a".repeat(64);
const BUCKET = "mcft-cap09-requal-" + RUN;
const PRODUCTION = "geox-mcft-cap09-formal-raw-v1";
const TYPES = [
  "future_et0_assumption_v1",
  "future_weather_assumption_v1",
  "soil_moisture_observation_v1",
] as const;
const authority:ExternalFormalExactBaseRetentionAuthorityV1 = {
  mode: "ISOLATED_QUALIFICATION_ONLY",
  run_id: RUN,
  subject_sha: SUBJECT,
  bucket: BUCKET,
};

function results(bucket: string): CanonicalizedExternalEvidenceResultV1[] {
  return TYPES.map((record_type, index) => ({
    record: {
      record_type,
      source_record_id: "controlled-fixture-" + index,
      role_time: record_type === "soil_moisture_observation_v1"
        ? { observed_at: BASE }
        : { valid_from: BASE },
    },
    record_semantic_sha256: "sha256:" + String(index + 1).repeat(64),
    raw_provenance: {
      raw_sha256: "sha256:" + SHA,
      retention_ref: `s3-private://${bucket}/${PREFIX}/${SHA}`,
    },
  } as unknown as CanonicalizedExternalEvidenceResultV1));
}
function check(items:CanonicalizedExternalEvidenceResultV1[], useAuthority?:ExternalFormalExactBaseRetentionAuthorityV1) {
  return validateExternalFormalExactBasePromotionInputV1({
    base_target_t: BASE,
    results: items,
    expected_semantic_manifest: items.map(item => ({
      record_type:item.record.record_type,
      source_record_id:item.record.source_record_id,
      record_semantic_sha256:item.record_semantic_sha256,
    })),
    ...(useAuthority ? {retention_authority:useAuthority} : {}),
  });
}
function changed(items:CanonicalizedExternalEvidenceResultV1[], ref:string) {
  return items.map((item,i) => i===0 ? {
    ...item, raw_provenance:{...item.raw_provenance,retention_ref:ref},
  } : item);
}
const production = results(PRODUCTION);
assert.equal(check(production).results.length,3,"PRODUCTION_FORMAL_DEFAULT_MUST_PASS");
assert.throws(()=>check(results(BUCKET)),/PRIVATE_FORMAL_RETENTION_REQUIRED/,"PRODUCTION_CANNOT_ACCEPT_ISOLATED_BY_DEFAULT");
assert.equal(check(results(BUCKET),authority).results.length,3,"EXACT_ISOLATED_QUALIFICATION_MUST_PASS");
assert.throws(()=>check(production,authority),/PRIVATE_FORMAL_RETENTION_REQUIRED/,"ISOLATED_CANNOT_USE_PRODUCTION");
assert.throws(()=>check(results(BUCKET),{...authority,bucket:"mcft-cap09-requal-123456789abc"}),/AUTHORITY_INVALID/);
assert.throws(()=>check(results(BUCKET),{...authority,run_id:"123456789abc"}),/AUTHORITY_INVALID/);
assert.throws(()=>check(results(BUCKET),{...authority,mode:"PRODUCTION" as never}),/AUTHORITY_INVALID/);
const items=results(BUCKET);
assert.throws(()=>check(changed(items,`s3-private://mcft-cap09-requal-deadbeef0000/${PREFIX}/${SHA}`),authority),/PRIVATE_FORMAL_RETENTION_REQUIRED/);
assert.throws(()=>check(changed(items,`s3-private://${BUCKET}/mcft-cap09-ea5e2-readiness-transient-v1/${SHA}`),authority),/CONTENT_ADDRESS_FORMAL_RAW_REQUIRED/);
assert.throws(()=>check(changed(items,`s3-private://${BUCKET}/${PREFIX}/${"c".repeat(64)}`),authority),/ISOLATED_CONTENT_ADDRESS_MISMATCH/);
assert.throws(()=>check(changed(items,`s3-private://${BUCKET}/${PREFIX}/${SHA}?name=x`),authority),/PRIVATE_FORMAL_RETENTION_REQUIRED/);
assert.throws(()=>check(changed(items,`s3-private://${BUCKET}/${PREFIX}/${SHA}#x`),authority),/PRIVATE_FORMAL_RETENTION_REQUIRED/);
console.log(JSON.stringify({
  status:"PASS",
  suite:"DA9_EXACT_ISOLATED_RETENTION_AUTHORITY_CONTRACT",
  production_guard_unchanged:true,
  isolated_exact_binding_positive:true,
  cross_run_production_prefix_digest_mutations_rejected:true,
  real_s3:false,
  real_pg:false,
  permit_signed:false,
  execute_authorized:false,
}));
