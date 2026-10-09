#!/usr/bin/env node
"use strict";
const assert=require("node:assert/strict");
const {isTransientReadError,pollExactPair}=require("./MCFT_CAP_09_AM22_GFS_READ_ONLY_POLL_V1.cjs");
const pair=[{role:"weather"},{role:"et0"}];
async function run(sequence,options={}){
 let current=0,t=0,retries=[];
 const result=await pollExactPair({
   readRows:async()=>{const value=sequence[Math.min(current++,sequence.length-1)];if(value instanceof Error)throw value;return value;},
   validate:rows=>{assert.equal(rows.length,2);if(options.invalid)throw Error("GFS_PROVENANCE_MISMATCH");return {ok:true};},
   now:()=>t,deadlineMs:options.deadline??100,
   intervalMs:10,maxConsecutiveTransient:options.maxConsecutiveTransient??3,
   sleep:async ms=>{t+=ms;},onTransient:v=>retries.push(v),
 });return {result,retries};
}
async function expectRejection(sequence,regex,options){await assert.rejects(()=>run(sequence,options),regex);}
(async()=>{
 for(const code of ["ETIMEDOUT","ECONNRESET","ECONNREFUSED","EPIPE","EAI_AGAIN","ENOTFOUND","08006","57P01"]){assert.equal(isTransientReadError(Object.assign(Error("network"),{code})),true);}
 assert.equal(isTransientReadError(Error("Query read timeout")),true);
 for(const code of ["28P01","42501","3D000","42P01","23505"]){assert.equal(isTransientReadError(Object.assign(Error("fatal"),{code})),false);}
 assert.equal(isTransientReadError(Error("GFS_BINDING_ID_MISMATCH")),false);
 let r=await run([Error("Query read timeout"),pair]);assert.equal(r.result.pair.ok,true);assert.equal(r.result.transientCount,1);
 r=await run([Object.assign(Error("reset"),{code:"ECONNRESET"}),[],pair]);assert.equal(r.result.transientCount,1);assert.equal(r.result.pollCount,2);
 await expectRejection([Error("Query read timeout")],/AM22_GFS_BOOTSTRAP_TRANSIENT_DB_RETRY_LIMIT/);
 await expectRejection([Object.assign(Error("permissions"),{code:"42501"})],/permissions/);
 await expectRejection([pair],/GFS_PROVENANCE_MISMATCH/,{invalid:true});
 r=await run([[],[],[],[],[],[],[],[],[],[],[]]);assert.equal(r.result.pair,null);assert.equal(r.result.pollCount,10);
 r=await run([Object.assign(Error("reset"),{code:"ECONNRESET"}),pair],{deadline:10});assert.equal(r.result.pair,null);
 await expectRejection([[...pair,{role:"extra"}]],/AM22_GFS_BOOTSTRAP_DUPLICATE_PAIR_ROWS/);
 process.stdout.write(JSON.stringify({status:"PASS",suite:"AM22_GFS_READ_ONLY_POLL_V1",cases:20,provider_calls:0,production_writes:0})+"\n");
})().catch(error=>{process.stderr.write(String(error.stack||error)+"\n");process.exitCode=1;});
