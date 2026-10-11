"use strict";
/**
 * Non-destructive real-delay execution adapter boundary for CAP-09.
 * This module is deliberately preparation-only. Real delay requires a
 * separately reviewed adapter bound to an isolated *disposable* database.
 * NEVER import the scaled controller fixture into the retained two DBs.
 */
const assert=require("node:assert/strict");
const fs=require("node:fs");
const crypto=require("node:crypto");
const FORBIDDEN=/\b(?:DROP\s+(?:SCHEMA|DATABASE|TABLE)|TRUNCATE\s+|ALTER\s+DATABASE|DELETE\s+FROM|CREATE\s+EXTENSION|SET\s+search_path)\b/i;
const REQUIRED=Object.freeze(["CROSS_WAKE_CAPTURE_OVERLAP","PROVIDER_LATENCY","RETRY_BACKOFF","STALE_OBSERVATION"]);
function validateDelayPlan(plan) {
 assert(plan&&typeof plan==="object","DELAY_PLAN_REQUIRED");
 assert.deepEqual(Object.keys(plan).sort(),["cases","schema_version","target"].sort(),"DELAY_PLAN_FIELDS_INVALID");
 assert.equal(plan.schema_version,"geox_mcft_cap09_non_destructive_delay_plan_v1");
 assert.equal(plan.target.kind,"DISPOSABLE_ISOLATED_TEST_FIXTURE","RETAINED_QUALIFICATION_DB_FORBIDDEN");
 assert(plan.target.name&&/^mcft_cap09_delay_scratch_[a-f0-9]{12}$/.test(plan.target.name),"DELAY_SCRATCH_NAME_REQUIRED");
 assert(Array.isArray(plan.cases)&&plan.cases.length===REQUIRED.length,"DELAY_CASE_COUNT_REQUIRED");
 for(let i=0;i<REQUIRED.length;i++){
  const c=plan.cases[i];assert.equal(c.id,REQUIRED[i],"DELAY_CASE_ORDER_REQUIRED");
  assert(Number.isSafeInteger(c.delay_ms)&&c.delay_ms>=0&&c.delay_ms<=120000,"DELAY_BUDGET_INVALID");
  assert(!Object.hasOwn(c,"sql")&&!Object.hasOwn(c,"command"),"ARBITRARY_EXECUTION_FORBIDDEN");
 }
 return {status:"DELAY_PLAN_STRUCTURAL_PASS_NOT_EXECUTABLE",run_authorized:false};
}
function inspectSqlFile(filename) {
 const bytes=fs.readFileSync(filename);
 assert(bytes.length<=1048576,"SQL_FILE_TOO_LARGE");
 assert(!FORBIDDEN.test(bytes.toString("utf8")),"DESTRUCTIVE_OR_SCOPE_MUTATING_SQL_FORBIDDEN");
 return {sha256:crypto.createHash("sha256").update(bytes).digest("hex"),safe_for_retained_databases:false,execution_authorized:false};
}
module.exports={REQUIRED,validateDelayPlan,inspectSqlFile};
