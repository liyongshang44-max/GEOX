"use strict";
const assert = require("node:assert/strict");
const api = require("../runtime_acceptance/MCFT_CAP09_ISOLATED_LOGIN_IDENTITY_V1.cjs");
const run = "c1f7dcc6d04d";
const targets = {isolated_login_run_id:run, positive:`mcft_cap09_requal_${run}_positive`, negative:`mcft_cap09_requal_${run}_negative`, bucket:`mcft-cap09-requal-${run}`};
const expected = api.binding(targets, targets.positive);
const good = {database:expected.database,current_role:expected.login,session_role:expected.login,
 rolcanlogin:true,rolinherit:true,unexpired:true,evidence_execute:true,privilege_role_safe:true,
 rolsuper:false,rolcreatedb:false,rolcreaterole:false,rolreplication:false,rolbypassrls:false,
 facts_insert:false,schema_create:false,twin_execute:false,
 memberships:[{role:expected.privilege,admin:false,inherit:true,set:false}],effective_roles:[expected.privilege]};
let checks = 0;
const reject = fn => {assert.throws(fn);checks++;};
(async()=>{
 api.validateSnapshot(good,expected);checks++;
 for(const key of Object.keys(good)) {
   const bad=structuredClone(good);
   if(typeof bad[key]==="boolean")bad[key]=!bad[key];
   else if(typeof bad[key]==="string")bad[key]="wrong";
   else bad[key]=[];
   reject(()=>api.validateSnapshot(bad,expected));
 }
 for(const patch of [{admin:true},{set:true},{inherit:false},{role:"geox_mcft_cap09_evidence_runtime_v1"}])
   reject(()=>api.validateSnapshot({...good,memberships:[{...good.memberships[0],...patch}]},expected));
 reject(()=>api.validateSnapshot({...good,effective_roles:[expected.privilege,"pg_write_all_data"]},expected));
 reject(()=>api.binding({...targets,isolated_login_run_id:"../bad"},targets.positive));
 reject(()=>api.binding(targets,"postgres"));
 reject(()=>api.binding({...targets,bucket:"geox-mcft-cap09-formal-raw-v1"},targets.positive));
 reject(()=>api.binding({...targets,negative:"mcft_cap09_requal_72dc0304a21a_negative"},targets.positive));
 for(const rows of [[good],[{...good,twin_execute:true}],[]]){
   const calls=[];let released=0;
   const pool={connect:async()=>({query:async(sql,args)=>{calls.push({sql,args});return {rows:sql===api.SNAPSHOT_SQL?rows:[]};},release:()=>released++})};
   const promise=api.verifyEvidenceLogin(pool,targets,targets.positive);
   if(rows[0]===good)await promise;else await assert.rejects(promise);
   assert.deepEqual(calls.map(x=>x.sql),["BEGIN READ ONLY",api.SNAPSHOT_SQL,"ROLLBACK"]);
   assert.deepEqual(calls[1].args,[api.EVIDENCE_FUNCTION,api.TWIN_FUNCTION,expected.privilege]);
   assert.equal(released,1);checks++;
 }
 let connected=false;
 await assert.rejects(api.verifyEvidenceLogin({connect:async()=>{connected=true;}},targets,"postgres"));
 assert.equal(connected,false);checks++;
 console.log(JSON.stringify({status:"PASS",checks,actual_database_connections:0,provider_calls:0,execute_authorized:false}));
})().catch(e=>{console.error(e);process.exitCode=1;});
