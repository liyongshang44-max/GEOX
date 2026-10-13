"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {RUN,PORT,assertDedicatedPgEndpoint,assertDedicatedPgUrl}=require("./MCFT_CAP09_DEDICATED_PG_ENDPOINT_V1.cjs");
const root=path.resolve(__dirname,"../..");
let checked=0;
function pass(fn){fn();checked++;}
function denied(fn){assert.throws(fn);checked++;}
const resource={database_host:"127.0.0.1",database_port:55434};
const pos="mcft_cap09_requal_800c023cf337_positive";
const neg="mcft_cap09_requal_800c023cf337_negative";
pass(()=>assertDedicatedPgEndpoint(RUN,resource));
pass(()=>assertDedicatedPgUrl(RUN,"postgresql://user:password@127.0.0.1:55434/"+pos,pos));
pass(()=>assertDedicatedPgUrl(RUN,"postgres://user:password@127.0.0.1:55434/"+neg,neg));
for(const port of [55432,5432,55435]) {
 denied(()=>assertDedicatedPgEndpoint(RUN,{...resource,database_port:port}));
 denied(()=>assertDedicatedPgUrl(RUN,"postgresql://user:password@127.0.0.1:"+port+"/"+pos,pos));
}
denied(()=>assertDedicatedPgEndpoint("72dc0304a21a",resource));
denied(()=>assertDedicatedPgEndpoint("c1f7dcc6d04d",resource));
denied(()=>assertDedicatedPgEndpoint("879279919ca5",resource));
denied(()=>assertDedicatedPgEndpoint(RUN,{...resource,database_host:"0.0.0.0"}));
denied(()=>assertDedicatedPgUrl(RUN,"postgresql://user:password@localhost:55434/"+pos,pos));
denied(()=>assertDedicatedPgUrl(RUN,"postgresql://user:password@127.0.0.1:55434/"+neg,pos));
denied(()=>assertDedicatedPgUrl(RUN,"postgresql://user:password@127.0.0.1:55434/"+pos+"?sslmode=disable",pos));
denied(()=>assertDedicatedPgUrl(RUN,"http://127.0.0.1:55434/"+pos,pos));
const bridge=fs.readFileSync(path.join(root,"scripts/governance_acceptance/MCFT_CAP09_ISOLATED_RETRY_ADMISSION_BRIDGE_V1.cjs"),"utf8");
const host=fs.readFileSync(path.join(root,"scripts/runtime_acceptance/MCFT_CAP09_GOVERNED_RETRY_HOST_V1.cjs"),"utf8");
pass(()=>assert(bridge.includes("assertDedicatedPgEndpoint(arm.run_id,resource);")));
pass(()=>assert(host.includes("assertDedicatedPgUrl(valid.arm.run_id,env[key],name);")));
pass(()=>assert(bridge.includes('if(arm.run_id==="800c023cf337") assertDedicatedPgEndpoint(arm.run_id,resource);')));
pass(()=>assert(bridge.includes('else assert(resource && resource.database_host==="127.0.0.1"&&resource.database_port===55432,"LOCAL_DB_REQUIRED");')));
pass(()=>assert(!host.includes('u.port,"55432"')));
const trust=JSON.parse(fs.readFileSync(path.join(root,"scripts/runtime_acceptance/MCFT_CAP09_RETRY_TRUST_V1.json"),"utf8"));
pass(()=>assert.equal(trust.execution_enabled,false));
pass(()=>assert.equal(trust.adopted,false));
pass(()=>assert.equal(trust.issuers.length,1));
pass(()=>assert.equal(trust.host_id,"LAPTOP-STN2A2P1"));
pass(()=>assert.equal(trust.operator_id,"mcft_cap09_operator_mylr1"));
pass(()=>assert.equal(trust.issuers[0].role,"ACCOUNTABLE_SINGLE_OPERATOR"));
pass(()=>assert.equal(trust.issuers[0].issuer_id,trust.operator_id));
console.log("DEDICATED_PG_ENDPOINT_REGRESSION_PASS checks="+checked+" port="+PORT+" execute_authorized=false");
