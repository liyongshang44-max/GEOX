"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const pg=require("./MCFT_CAP09_R4285_PG_READONLY_V3.cjs");
const identity=require("./MCFT_CAP09_R4285_EXECUTION_IDENTITY_V3.cjs");
function fixture(run=identity.SUCCESSOR){
 const resourceRun=identity.get(run).resource_run_id;
 const positive=`mcft_cap09_requal_${resourceRun}_positive`,negative=`mcft_cap09_requal_${resourceRun}_negative`;
 return {admission:{resourceEnvelope:{payload:{run_id:run,database_host:"127.0.0.1",database_port:55492,positive_database:positive,negative_database:negative}},permitEnvelope:{payload:{run_id:run}}},environment:{DATABASE_URL:`postgres://cap09_${resourceRun}_p_evidence:UNIT_ONLY@127.0.0.1:55492/${positive}`,BLOCKED_DATABASE_URL:`postgres://cap09_${resourceRun}_n_evidence:UNIT_ONLY@127.0.0.1:55492/${negative}`}};
}
function check(f){return pg.scopedDbConnectionBindings(f.admission,f.environment);}
test("registered successor retains execution identity and binds both reused resource databases and real URL role selector",()=>{
 const f=fixture(),rows=check(f);
 assert.equal(f.admission.resourceEnvelope.payload.run_id,"d0b9e7614a25");
 assert.equal(f.admission.permitEnvelope.payload.run_id,"d0b9e7614a25");
 assert.deepEqual(rows.map(x=>({side:x.side,database:x.database,role:x.role})),[
  {side:"positive",database:"mcft_cap09_requal_4285c3ce342c_positive",role:"cap09_4285c3ce342c_p_evidence"},
  {side:"negative",database:"mcft_cap09_requal_4285c3ce342c_negative",role:"cap09_4285c3ce342c_n_evidence"}]);
 assert.deepEqual(rows.map(x=>x.url),[f.environment.DATABASE_URL,f.environment.BLOCKED_DATABASE_URL]);
});
test("legacy registered execution retains the same resource binding",()=>assert.equal(check(fixture(identity.LEGACY))[0].database,"mcft_cap09_requal_4285c3ce342c_positive"));
test("Owner and Permit must still name the same execution Run",()=>{const f=fixture();f.admission.resourceEnvelope.payload.run_id=identity.LEGACY;assert.throws(()=>check(f),/V2_PG_SIGNED_RESOURCE_RUN_MISMATCH/);});
test("unknown execution identity is rejected without a fallback",()=>{const f=fixture();f.admission.resourceEnvelope.payload.run_id=f.admission.permitEnvelope.payload.run_id="111111111111";assert.throws(()=>check(f),/V3_EXECUTION_RUN_UNREGISTERED/);});
for(const side of ["positive","negative"]){
 test(`${side} database may not be renamed to the execution Run`,()=>{const f=fixture();f.admission.resourceEnvelope.payload[side+"_database"]=`mcft_cap09_requal_${identity.SUCCESSOR}_${side}`;assert.throws(()=>check(f),new RegExp("V2_PG_SIGNED_"+side.toUpperCase()+"_DATABASE"));});
 const key=side==="positive"?"DATABASE_URL":"BLOCKED_DATABASE_URL";
 for(const [label,mutate,code] of [
  ["URL database",u=>{u.pathname="/other"},"SCOPED_EVIDENCE_URL_DATABASE_MISMATCH"],
  ["URL role",u=>{u.username=`cap09_${identity.SUCCESSOR}_${side[0]}_evidence`},"SCOPED_EVIDENCE_URL_ROLE_MISMATCH"],
  ["host",u=>{u.hostname="localhost"},"V2_PG_ENDPOINT_HOST_MISMATCH"],
  ["port",u=>{u.port="5432"},"V2_PG_ENDPOINT_PORT_MISMATCH"],
  ["query override",u=>{u.search="?options=unsafe"},"V2_PG_URL_OVERRIDE_FORBIDDEN"],
  ["fragment",u=>{u.hash="unsafe"},"V2_PG_URL_OVERRIDE_FORBIDDEN"],
  ["missing password",u=>{u.password=""},"V2_PG_EXPLICIT_PASSWORD_REQUIRED"],
  ["scheme",u=>{u.protocol="other:"},"V2_PG_SCHEME_INVALID"]
 ])test(`${side} ${label} remains rejected`,()=>{const f=fixture(),u=new URL(f.environment[key]);mutate(u);f.environment[key]=u.href;assert.throws(()=>check(f),new RegExp(code));});
}
