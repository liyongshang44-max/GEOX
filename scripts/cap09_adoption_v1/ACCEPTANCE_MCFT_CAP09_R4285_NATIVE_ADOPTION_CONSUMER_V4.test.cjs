"use strict";
/* Synthetic-only V4 source contract. No live GitHub, credentials, signing or Permit. */
const test=require("node:test"),assert=require("node:assert/strict");
const native=require("./MCFT_CAP09_R4285_NATIVE_ADOPTION_CONSUMER_V4.cjs");
test("V4 QCP74 requires newly owned check PASS",()=>{
 const base="a".repeat(40),head="b".repeat(40),check="CAP09_R4285_TRUST_V2_NATIVE_ADOPTION_V4_EXACT_SOURCE_V1";
 const prev="CAP09_R4285_PREPARE_LIVE_V3_EXACT_SOURCE_REVIEW_V1";
 const names=Array.from({length:72},(_,i)=>"OLD_"+i).concat(prev,check);
 const def={checks:names.map(check_id=>({check_id}))};
 const rows=names.map((check_id,i)=>i===73?{check_id,status:"PASS"}:{check_id,status:"NOT_APPLICABLE",reason_code:"HISTORIC_SOURCE_NOT_REISSUED"});
 const raw={status:"PASS",head_sha:head,base_sha:base,stage:"SUCCESSOR_SUBJECT_PRE_MERGE",
  counts:{total_checks:74,pass:1,not_applicable:73,fail:0,unknown:0,forbidden:0,
   authority_errors:0,unknown_changed_paths:0,blocker_count:0},blockers:[],results:rows};
 assert.equal(native.checkQcp74(raw,def,head,base).checks,74);
 const fake={...raw,results:rows.map(x=>x.check_id===check?{...x,status:"NOT_APPLICABLE",reason_code:"NO"}:x),
   counts:{...raw.counts,pass:0,not_applicable:74}};
 assert.throws(()=>native.checkQcp74(fake,def,head,base),/NEW_CHECK_REQUIRED/);
});
test("V4 requires independent trust governance authority input",()=>{
 assert(native.INPUT_FIELDS.includes("trust_successor_authority_file"));
 const bad=Object.fromEntries(native.INPUT_FIELDS.map(k=>[k,k.endsWith("_sha256")?"a".repeat(64):"/tmp/test"]));
 delete bad.trust_successor_authority_file;
 assert.throws(()=>native.checkInput(bad));
});
test("V4 refuses check-only qualification from synthetic JS object",()=>{
 assert.equal(native.isNativeVerified({status:"NATIVE_R4285_QCP74_ADOPTION_V5_VERIFIED_NOT_PERMIT"}),false);
});

// Pure negative boundary tests for the exact Timing source-only successor.
// Synthetic metadata never becomes a native QCP result or execution authority.
const timingScope=require("../governance_acceptance/VERIFY_MCFT_CAP09_R4285_TRUST_V2_SOURCE_V1.cjs");
function timingFixture(){return {
 base:"27dd160877d81446faaa857b0c80428eb80735c0",stage:"SUCCESSOR_SUBJECT_PRE_MERGE",pr:3776,
 branch:"fix/r4285-qcp-timing-path-triggers",
 paths:[".github/workflows/mcft-cap-09-qualification-control-plane-v1.yml",
  "scripts/governance_acceptance/VERIFY_MCFT_CAP09_R4285_TRUST_V2_SOURCE_V1.cjs",
  "scripts/governance_acceptance/PREFLIGHT_MCFT_CAP_09_ALL_BLOCKERS_V1.cjs",
  "scripts/cap09_adoption_v1/ACCEPTANCE_MCFT_CAP09_R4285_NATIVE_ADOPTION_CONSUMER_V4.test.cjs",".github/workflows/mcft-cap-09-frozen-v13-isolated-requalification-v1.yml",".github/workflows/mcft-cap09-adoption-v2-attempt3-engineering-v1.yml"],
 aux_sha256:{".github/workflows/mcft-cap-09-frozen-v13-isolated-requalification-v1.yml": "79f16bcafdfe7c37e0a7368d7535e4c4f1eaf829fa405808123cc5eeba36ef86", ".github/workflows/mcft-cap09-adoption-v2-attempt3-engineering-v1.yml": "e7844909532835f69bc55af851025e4314d11d1d6c5deea56e82e862fb08837a"},
 workflow_sha256:"66831e46e7a1e9c50f96bc041b54fee5245119abaee6d263e951b5e4b7b0cb46",
 preflight_sha256:"0d5fdcc82e6398c69f90fd93529e62d8f2d7758aa7f3ca9c315b7606a90ad3a7",
 timing_blob:"46868f9d0684934094a45ce431e272fbf00657fd",test_blob:"279fa791d6ded0415f0b5831f5fdb95cbff70f2e",
 manifest_unchanged:true,gate_prefix_preserved:true,tests_prefix_preserved:true,clean:true,
 merge_tree_exact:true,original_timing_negative_detected:true,unknown:[],authority_errors:[]};}
test("exact Timing delta shape is admissible only as source metadata",()=>{
 assert.equal(timingScope.validateTimingDeltaProof(timingFixture()),true);
 assert.equal(native.isNativeVerified(timingFixture()),false);
});
test("Timing scope rejects extra source, removed test and duplicate paths",()=>{
 for(const edit of [p=>p.paths.push("apps/server/src/extra.ts"),p=>p.paths.pop(),p=>p.paths.push(p.paths[0])]){
  const p=timingFixture();edit(p);assert.throws(()=>timingScope.validateTimingDeltaProof(p),/TIMING_EXACT_PATHS/);
 }
});
test("Timing scope rejects wrong base, event scope, PR and branch",()=>{
 for(const key of ["base","stage","pr","branch"]){const p=timingFixture();p[key]="wrong";
  assert.throws(()=>timingScope.validateTimingDeltaProof(p));}
});
test("Timing scope rejects unreviewed workflow, routing, business or test bytes",()=>{
 for(const key of ["workflow_sha256","preflight_sha256","timing_blob","test_blob"]){
  const p=timingFixture();p[key]="0".repeat(p[key].length);assert.throws(()=>timingScope.validateTimingDeltaProof(p));}
});
test("Timing scope preserves manifest, old tests, clean tree and real regression obligations",()=>{
 for(const key of ["manifest_unchanged","gate_prefix_preserved","tests_prefix_preserved","clean","merge_tree_exact","original_timing_negative_detected"]){
  const p=timingFixture();p[key]=false;assert.throws(()=>timingScope.validateTimingDeltaProof(p));}
 for(const key of ["unknown","authority_errors"]){const p=timingFixture();p[key].push("unexpected");
  assert.throws(()=>timingScope.validateTimingDeltaProof(p));}
});
test("Timing native source gate cannot accept synthetic context as GitHub proof",()=>{
 const r=timingScope.verifyTimingSuccessor({ROOT:"/does-not-exist",args:{},authority:{},plan:{},changed:[],stage:"test"});
 assert.equal(r.status,"FAIL");assert.equal(r.permit_issued,false);assert.equal(r.stages,0);
});

test("Timing scope rejects altered historical workflow routing",()=>{
 const p=timingFixture();p.aux_sha256[Object.keys(p.aux_sha256)[0]]="0".repeat(64);
 assert.throws(()=>timingScope.validateTimingDeltaProof(p),/TIMING_HISTORICAL_WORKFLOW_DRIFT/);
});
