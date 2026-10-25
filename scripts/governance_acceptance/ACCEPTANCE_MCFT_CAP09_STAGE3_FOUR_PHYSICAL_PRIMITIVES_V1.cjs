"use strict";
const assert=require("node:assert/strict"),r=require("../runtime_acceptance/RUN_MCFT_CAP09_STAGE3_FOUR_PHYSICAL_PRIMITIVE_BODIES_V1.cjs");
let tests=0;
for(const stage of r.IDS)assert(/^(PRODUCER|TIMING_[123])$/.test(stage));tests++;
assert.equal(r.IDS.length,4);tests++;
assert.throws(()=>r.validateEnv("AGGREGATE","123456abcdef"),/STAGE3_PHYSICAL_STAGE_INVALID/);tests++;
assert.throws(()=>r.validateEnv("PRODUCER","da9db7129607"),/STAGE3_UNIQUE_RUN_REQUIRED/);tests++;
assert.throws(()=>r.validateEnv("TIMING_1","af64cc3aa84e"),/STAGE3_UNIQUE_RUN_REQUIRED/);tests++;
assert.throws(()=>r.verifyPhysical({schema_version:"geox_mcft_cap09_isolated_non_authorized_full_chain_contract_v1",status:"PASS",subject_sha:r.SUBJECT,test_run_id:"face123456ab",isolated_s3_bucket:"mcft-cap09-requal-face123456ab",pg_database:"mcft_cap09_requal_face123456ab_positive",permit_signed:true},"TIMING_1","face123456ab"),/STAGE3_REAL_BUSINESS_PRIMITIVE_NOT_OBSERVED|AssertionError/);tests++;
console.log(JSON.stringify({status:"PASS",negative_and_contract_checks:tests,
  real_physical_stage_bodies_executed:false,original_producer_or_timing_entrypoint_executed:false,
  execution_authority:false}));
