"use strict";
/**
 * Read-only retry execution-admission bridge. This module cannot activate
 * an ARM, invoke Producer or create evidence. A distinct reviewed activation
 * successor is mandatory before host side effects.
 */
const assert=require("node:assert/strict");
const crypto=require("node:crypto");
const fs=require("node:fs");
const {assessIsolatedReadiness}=require("./MCFT_CAP09_ISOLATED_EVIDENCE_DRIVEN_CLOCK_V1.cjs");
const {ANCHORS}=require("./MCFT_CAP_09_ISOLATED_RETRY_AUTHORITY_POLICY_V1.cjs");
const {HASHES:HISTORICAL_HASHES,verifyHistoricalEvidence}=require("./MCFT_CAP09_RETRY_HISTORICAL_EVIDENCE_V1.cjs");
const {assertDedicatedPgEndpoint}=require("./MCFT_CAP09_DEDICATED_PG_ENDPOINT_V1.cjs");
const SHA=/^[0-9a-f]{64}$/;
const RUN=/^[0-9a-f]{12}$/;
const HEAD=/^[0-9a-f]{40}$/;
function admitProposedRetry(arm,observed) {
  assert(arm && observed && typeof arm==="object" && typeof observed==="object","RETRY_INPUT_REQUIRED");
  assert.equal(arm.schema_version,"geox_mcft_cap09_isolated_retry_arm_v1");
  assert.equal(arm.mode,"ISOLATED_QUALIFICATION");
  assert.equal(arm.parent_run_id,"72dc0304a21a");
  assert(RUN.test(arm.run_id) && arm.run_id!==arm.parent_run_id,"FRESH_RETRY_RUN_ID_REQUIRED");
  assert.equal(arm.attempt_ordinal,2,"SECOND_ATTEMPT_ORDINAL_REQUIRED");
  assert(HEAD.test(arm.protected_main_sha),"PINNED_MAIN_REQUIRED");
  assert.equal(arm.protected_main_sha,observed.head,"RETRY_HEAD_MISMATCH");
  assert.equal(arm.protected_main_sha,observed.protected_main,"RETRY_REMOTE_MAIN_MISMATCH");
  assert.equal(arm.first_execution_provider_calls,null,"UNKNOWN_PROVIDER_COUNT_MUST_NOT_BE_INVENTED");
  for(const k of ["production_recovery_authorized","owner_cutover_authorized","formal_v5_authorized","a0_authorized","o00_o23_authorized","automatic_retry_authorized","historical_reset_authorized"])
    assert.equal(arm[k],false,"FORBIDDEN_SIDE_EFFECT:"+k);
  assert.equal(observed.qcp_blocker_count,0,"QCP_NOT_CLOSED");
  assert(observed.inherited_qcp_check_count>=51,"INHERITED_QCP_MISSING");
  assert.equal(observed.frozen_runtime_paths_verified,108,"FROZEN_RUNTIME_NOT_VERIFIED");
  assert.equal(observed.windows_postmerge_verified,true,"WINDOWS_POSTMERGE_UNVERIFIED");
  assert.equal(observed.original_evidence_preserved,true,"FIRST_ATTEMPT_NOT_PRESERVED");
  assert.equal(observed.output_exists,false,"REUSED_OUTPUT_FORBIDDEN");
  assert.equal(observed.output_seen_in_attempt_ledger,false,"ATTEMPT_LEDGER_REUSE_FORBIDDEN");
  assert(typeof arm.output_directory==="string"&&arm.output_directory.length>0,"NEW_OUTPUT_REQUIRED");
  assert.equal(observed.output_directory,arm.output_directory,"OUTPUT_MISMATCH");
  assert.equal(arm.retry_adjudication?.retry_admissible,true,"RETRY_ADJUDICATION_NOT_APPROVED");
  assert.equal(arm.retry_adjudication?.prior_denial_explicitly_superseded,true,"PREVIOUS_RETRY_DENIAL_NOT_SUPERSEDED");
  assert.equal(arm.retry_adjudication?.unknown_provider_count_acknowledged,true,"FIRST_PROVIDER_UNKNOWN_NOT_ACKNOWLEDGED");
  assert.equal(arm.retry_adjudication?.run_id,arm.run_id,"ADJUDICATION_RUN_MISMATCH");
  assert.equal(arm.retry_adjudication?.protected_main_sha,arm.protected_main_sha,"ADJUDICATION_MAIN_MISMATCH");
  assert(typeof arm.retry_adjudication?.decision_id==="string"&&arm.retry_adjudication.decision_id.length>0,"DECISION_ID_MISSING");
  const hashes=arm.evidence_sha256;
  for(const [key,value] of Object.entries(ANCHORS)) assert.equal(hashes?.[key],value,"FIRST_ANCHOR_CHANGED:"+key);
  verifyHistoricalEvidence();
  assert.deepEqual(Object.keys(hashes).sort(),[...Object.keys(ANCHORS),...Object.keys(HISTORICAL_HASHES),"retry_adjudication"].sort(),"RETRY_EVIDENCE_KEYS_INVALID");
  for(const [key,value] of Object.entries(HISTORICAL_HASHES)) assert.equal(hashes[key],value,"HISTORY_EVIDENCE_MISMATCH:"+key);
  assert(SHA.test(hashes.retry_adjudication),"NEW_RETRY_ADJUDICATION_DIGEST_REQUIRED");
  assert(!Object.values(HISTORICAL_HASHES).includes(hashes.retry_adjudication),"HISTORICAL_REPORT_IS_NOT_RETRY_ADJUDICATION");
  for(const [key,value] of Object.entries(hashes)) assert.equal(observed.evidence_sha256?.[key],value,"EVIDENCE_HASH_MISMATCH:"+key);
  const resource=arm.resources;
  // Preserve the existing synthetic/structural retry contract for unrelated run IDs.
  // Only this evidence-qualified run may claim the dedicated 55434 endpoint.
  if(arm.run_id==="800c023cf337") assertDedicatedPgEndpoint(arm.run_id,resource);
  else assert(resource && resource.database_host==="127.0.0.1"&&resource.database_port===55432,"LOCAL_DB_REQUIRED");
  // Only the evidence-bound dedicated instance uses the dedicated audit admin.
  // This is catalog/readback identity, never an application runtime credential.
  if(arm.run_id==="800c023cf337")
    assert.equal(resource.audit_user,"qual_dedicated_admin","DEDICATED_AUDIT_USER_REQUIRED");
  else assert.equal(resource.audit_user,"qual_admin","AUDIT_USER_MUST_BE_QUAL_ADMIN");
  assert.equal(resource.positive_database,"mcft_cap09_requal_"+arm.run_id+"_positive","FRESH_POSITIVE_DB_REQUIRED");
  assert.equal(resource.negative_database,"mcft_cap09_requal_"+arm.run_id+"_negative","FRESH_NEGATIVE_DB_REQUIRED");
  assert.equal(resource.bucket_endpoint,"http://127.0.0.1:59000","LOOPBACK_BUCKET_REQUIRED");
  assert.equal(resource.bucket,"mcft-cap09-requal-"+arm.run_id,"RUN_SCOPED_BUCKET_REQUIRED");
  assert.deepEqual(observed.resources,resource,"RESOURCE_READBACK_MISMATCH");
  assert.equal(observed.fresh_readback?.status,"PASS","FRESH_RESOURCE_READBACK_REQUIRED");
  assert.equal(observed.fresh_readback?.run_id,arm.run_id,"FRESH_READBACK_RUN_MISMATCH");
  assert.equal(observed.fresh_readback?.all_rows_zero,true,"RESOURCE_ROWS_NOT_ZERO");
  assert.equal(observed.fresh_readback?.bucket_empty_including_versions_multipart,true,"OBJECT_VERSIONS_OR_UPLOADS_PENDING");
  assert.equal(observed.fresh_readback?.production_bindings_present,false,"PRODUCTION_BINDINGS_FORBIDDEN");
  const readiness=assessIsolatedReadiness({
    now_utc:observed.now_utc,authorized_at_utc:arm.authorized_at,expires_at_utc:arm.expires_at,
    provider_deadline_utc:observed.provider_deadline_utc,source_exact_main:true,
    source_clean:observed.source_clean,retry_adjudicated:true,prior_attempt_preserved:true,
    data_available:observed.provider_data_available,provider_observation_causally_visible:observed.provider_causal_visibility,
    resources_fresh:observed.fresh_readback_current,owner_isolation_verified:observed.owner_isolation_verified,
    run_output_absent:true,measured_worst_case_ms:observed.measured_worst_case_ms,
    deadline_safety_margin_ms:observed.deadline_safety_margin_ms
  });
  // Structural admissibility is not issuer trust, signature verification or
  // the consumption of a single-use nonce. Never mint execution authority.
  return {...readiness,admissibility:"STRUCTURAL_ONLY_ISSUER_AND_SINGLE_USE_NOT_VERIFIED",
    authority_adopted:false,execute_authorized:false,retry_authorized:false};
}
function sha256File(file) {return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");}
module.exports={admitProposedRetry,sha256File};
