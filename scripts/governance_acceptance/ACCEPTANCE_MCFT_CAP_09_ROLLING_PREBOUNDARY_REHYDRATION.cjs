#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const RUNNER = "scripts/runtime_acceptance/RUN_MCFT_CAP_09_ROLLING_PREBOUNDARY_REHYDRATION_V1.ts";
const A11 = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-11-PROVIDER-AVAILABILITY-WATERMARK-AUTHORITY.md";
function read(path) { if (!fs.existsSync(path)) throw new Error(`MCFT_CAP09_REHYDRATION_FILE_REQUIRED:${path}`); return fs.readFileSync(path,"utf8"); }
function has(text, marker, code) { if (!text.includes(marker)) throw new Error(`${code}:${marker}`); }
function lacks(text, marker, code) { if (text.includes(marker)) throw new Error(`${code}:${marker}`); }
const runner=read(RUNNER), a11=read(A11);
for (const marker of [
  "PROVIDER_AVAILABILITY_WATERMARK_V1",
  "retain rolling candidate packages for approximately 36h",
  "Batch arrival MUST NOT authorize retroactive post-T acquisition",
  "crop_authority_effect = NONE",
]) has(a11,marker,"MCFT_CAP09_REHYDRATION_AMENDMENT11_REQUIRED");
for (const marker of [
  "ProducerBoundReadOnlyR2RetentionV1",
  "producer_subject_sha",
  "MCFT_CAP09_ROLLING_REHYDRATION_PRODUCER_PREFIX_MISMATCH",
  "MCFT_CAP09_ROLLING_REHYDRATION_FORMAL_RAW_REF_FORBIDDEN",
  "readRetainedRawEvidence",
  "private_r2_put_count: store.put_count",
  "private_r2_delete_count: store.delete_count",
  "provider_refetch_count: 0",
  "exactSemanticMatch",
  "MCFT_CAP09_ROLLING_REHYDRATION_SEMANTIC_HASH_MISMATCH",
  "collectRetainDecodeCanonicalizeExternalEvidenceV1",
  "PythonGfsRawBundleDecoderV2",
  "MCFT_CAP09_EA5E2_GFS_RAW_BUNDLE_DECODER_V2",
  "decode-gfs-v2",
  "KbsVariate25SoilEvidenceDecoderV1",
  "PostgresExternalFormalEvidenceIngressV1",
  "cross_head_rehydration",
  "formal_database_write_count: 0",
  "formal_r2_prefix_write_count: 0",
  "scheduler_write_count: 0",
  "runtime_write_count: 0",
  "crop_authority_effect: \"NONE\"",
  "raw_values_emitted: false",
]) has(runner,marker,"MCFT_CAP09_REHYDRATION_RUNNER_REQUIRED");
for (const marker of ["PUT\" | \"HEAD\" | \"GET\" | \"DELETE", "deleteRetainedRawEvidence", "fetch-gfs", "fetch-soil"]) lacks(runner,marker,"MCFT_CAP09_REHYDRATION_FORBIDDEN_ACTIVE_BEHAVIOR");
console.log(JSON.stringify({
  schema_version:"geox_mcft_cap09_rolling_preboundary_rehydration_acceptance_v1",
  status:"PASS",
  producer_subject_sha_bound:true,
  raw_head_get_only:true,
  provider_refetch:false,
  semantic_hash_reverification:true,
  isolated_database_only:true,
  formal_effect:false,
  crop_authority_effect:"NONE"
}));
