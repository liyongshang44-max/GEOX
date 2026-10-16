"use strict";
// Narrow TEST_ONLY evidence identity selector. This cannot grant permissions or
// transform a PostgreSQL login: the database's authenticated current_user remains authoritative.
const assert=require("node:assert/strict");
const LEGACY="geox_mcft_cap09_evidence_runtime_login_v1";
function expectedEvidenceLogin({stage,positive,negative,database,connectionString}){
  if(stage!=="PRODUCER")return LEGACY;
  const pos=/^mcft_cap09_requal_([a-f0-9]{12})_positive$/.exec(positive||"");
  assert(pos,"SCOPED_EVIDENCE_POSITIVE_DATABASE_REQUIRED");
  const run=pos[1];
  assert.equal(negative,`mcft_cap09_requal_${run}_negative`,"SCOPED_EVIDENCE_DATABASE_PAIR_MISMATCH");
  assert([positive,negative].includes(database),"SCOPED_EVIDENCE_UNKNOWN_DATABASE");
  const suffix=database===positive?"p_evidence":"n_evidence";
  const expected=`cap09_${run}_${suffix}`;
  const url=new URL(connectionString);
  assert(["postgres:","postgresql:"].includes(url.protocol),"SCOPED_EVIDENCE_POSTGRES_REQUIRED");
  assert.equal(decodeURIComponent(url.pathname.slice(1)),database,"SCOPED_EVIDENCE_URL_DATABASE_MISMATCH");
  assert.equal(decodeURIComponent(url.username),expected,"SCOPED_EVIDENCE_URL_ROLE_MISMATCH");
  return expected;
}
module.exports={expectedEvidenceLogin,LEGACY};
