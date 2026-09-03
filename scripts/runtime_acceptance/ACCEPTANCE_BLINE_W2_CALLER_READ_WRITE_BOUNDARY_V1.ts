import Fastify from "fastify";
import { requireAoActScopeV0 } from "../../apps/server/src/auth/ao_act_authz_v0.js";
import { registerWeatherV1Routes } from "../../apps/server/src/routes/weather_v1.js";
import { registerControlPlaneV1Routes } from "../../apps/server/src/domain/controlplane/task_service.js";
import { registerAoActV1Routes } from "../../apps/server/src/routes/control_ao_act.js";
import { refreshFieldReadModelsWithObservabilityV1 } from "../../apps/server/src/services/field_read_model_refresh_v1.js";
import { projectManualExecutionQualityV1, listManualExecutionQualityTaskDetailsV1 } from "../../apps/server/src/projections/manual_execution_quality_v1.js";
import { projectSkillRegistryReadV1 } from "../../apps/server/src/projections/skill_registry_read_v1.js";
import { listSkills, getSkillDetail } from "../../apps/server/src/services/skills/skill_registry_service.js";
import { listSkillRuns, listSkillRunsLegacy } from "../../apps/server/src/services/skills/skill_runtime_service.js";
import { getSkillBindingProjection } from "../../apps/server/src/services/skills/skill_binding_service.js";
import { getSkillRunRuntimeStatusV1, getSkillRunRuntimeResultV1, getSkillRunRuntimeV1 } from "../../apps/server/src/services/skills/runtime_v1.js";

const saved = new Map<string,string|undefined>();
for (const k of ["GEOX_RUNTIME_ENV","GEOX_TOKENS_JSON","GEOX_TOKENS_FILE","GEOX_TOKEN_SSOT_PATH","GEOX_TOKEN","GEOX_AO_ACT_TOKEN","AO_ACT_TOKEN"]) saved.set(k,process.env[k]);
function restore(){ for(const [k,v] of saved){ if(v===undefined) delete process.env[k]; else process.env[k]=v; } }
function expect(c:any,m:string,d?:any){ if(!c) throw new Error(m+(d===undefined?"":": "+JSON.stringify(d))); }
function bearer(token:string){ return {authorization:`Bearer ${token}`}; }
function isMutation(sql:string):boolean {
  const normalized=String(sql??"").replace(/--.*$/gm," ").trim();
  return /\b(?:INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|TRUNCATE|GRANT|REVOKE)\b/i.test(normalized);
}

const tokenFile:any={version:"ao_act_tokens_v0",tokens:[
  {token:"w2_read_only",token_id:"tok_w2_read",actor_id:"reader",tenant_id:"tenantA",project_id:"projectA",group_id:"groupA",role:"client",scopes:["recommendation.read"],revoked:false},
  {token:"w2_writer",token_id:"tok_w2_writer",actor_id:"agronomist",tenant_id:"tenantA",project_id:"projectA",group_id:"groupA",role:"agronomist",scopes:["recommendation.write"],revoked:false},
  {token:"w2_admin",token_id:"tok_w2_admin",actor_id:"admin",tenant_id:"tenantA",project_id:"projectA",group_id:"groupA",role:"admin",scopes:["recommendation.write","telemetry.read","ao_act.index.read","skill.read","fields.read"],revoked:false},
]};

const skillDefinition={
  fact_id:"skill_def_w2", occurred_at:"2026-09-03T00:00:00.000Z",
  record_json:{type:"skill_definition_v1",payload:{tenant_id:"tenantA",project_id:"projectA",group_id:"groupA",skill_id:"w2_skill",version:"v1",category:"AGRONOMY",status:"ACTIVE",scope_type:"TENANT",rollout_mode:"DIRECT",trigger_stage:"before_recommendation",bind_target:"tenantA"}}
};
const skillRun={
  fact_id:"skill_run_fact_w2", occurred_at:"2026-09-03T00:01:00.000Z",
  record_json:{type:"skill_run_v1",payload:{tenant_id:"tenantA",project_id:"projectA",group_id:"groupA",run_id:"skill_run_w2",skill_id:"w2_skill",version:"v1",category:"AGRONOMY",status:"ACTIVE",result_status:"SUCCESS",scope_type:"TENANT",rollout_mode:"DIRECT",trigger_stage:"before_dispatch",bind_target:"tenantA",field_id:"field_w2",device_id:"device_w2"}}
};

class ReadOnlyPool {
  mutationQueries:string[]=[];
  queries:string[]=[];
  connectCalls=0;
  async query(sql:any, params?:any[]) {
    const text=String(sql??"");
    this.queries.push(text);
    if(isMutation(text)){ this.mutationQueries.push(text); throw new Error("W2_READ_MUTATION_FORBIDDEN"); }
    if(/FROM\s+weather_forecast_index_v1/i.test(text)) return {rowCount:1,rows:[{
      forecast_id:"forecast_w2",tenant_id:"tenantA",project_id:"projectA",group_id:"groupA",field_id:"field_w2",
      provider:"MOCK",source_type:"MOCK",source_id:"w2",latitude:1,longitude:2,
      generated_at:"2026-09-03T00:00:00.000Z",issue_time:"2026-09-03T00:00:00.000Z",forecast_version:"v1",
      provider_run_id:null,external_forecast_id:null,version_json:{},valid_from:"2026-09-03T00:00:00.000Z",valid_to:"2026-09-06T00:00:00.000Z",
      horizon_hours:72,rainfall_forecast_mm_72h:1,temperature_max_c_72h:28,et0_mm_72h:4,hourly_json:[],quality_json:{stale:false,missing_fields:[],provider_status:"OK"},raw_payload_json:null,source_fact_id:null,
      created_at:"2026-09-03T00:00:00.000Z",updated_at:"2026-09-03T00:00:00.000Z"
    }]};
    if(/FROM\s+facts/i.test(text) && /skill_definition_v1/i.test(text) && /skill_binding_v1/i.test(text) && /skill_run_v1/i.test(text)) {
      return {rowCount:2,rows:[skillDefinition,skillRun]};
    }
    if(/FROM\s+facts/i.test(text) && /skill_binding_v1/i.test(text)) return {rowCount:0,rows:[]};
    return {rowCount:0,rows:[]};
  }
  async connect(){
    this.connectCalls++;
    throw new Error("W2_READ_CONNECT_FORBIDDEN");
  }
}

async function main(){
  process.env.GEOX_RUNTIME_ENV="test";
  process.env.GEOX_TOKENS_JSON=JSON.stringify(tokenFile);
  delete process.env.GEOX_TOKENS_FILE; delete process.env.GEOX_TOKEN_SSOT_PATH; delete process.env.GEOX_TOKEN; delete process.env.GEOX_AO_ACT_TOKEN; delete process.env.AO_ACT_TOKEN;

  const authApp=Fastify({logger:false});
  authApp.get("/w2/recommendation-write",async(req,reply)=>{
    const auth=requireAoActScopeV0(req,reply,"recommendation.write");
    if(!auth)return reply;
    return reply.send({ok:true,role:auth.role});
  });
  await authApp.ready();
  const readDenied=await authApp.inject({method:"GET",url:"/w2/recommendation-write",headers:bearer("w2_read_only")});
  expect(readDenied.statusCode===403 && readDenied.json()?.error==="AUTH_SCOPE_DENIED","read-only recommendation token gained writer authority",{status:readDenied.statusCode,body:readDenied.body});
  const writerAllowed=await authApp.inject({method:"GET",url:"/w2/recommendation-write",headers:bearer("w2_writer")});
  expect(writerAllowed.statusCode===200,"recommendation writer token denied",{status:writerAllowed.statusCode,body:writerAllowed.body});
  await authApp.close();

  const pool=new ReadOnlyPool();
  const weatherApp=Fastify({logger:false});
  registerWeatherV1Routes(weatherApp,pool as any);
  await weatherApp.ready();
  const weatherAnon=await weatherApp.inject({method:"GET",url:"/api/v1/weather/forecast/latest?field_id=field_w2"});
  expect(weatherAnon.statusCode===401,"anonymous weather latest not denied",{status:weatherAnon.statusCode,body:weatherAnon.body});
  const weatherNoScope=await weatherApp.inject({method:"GET",url:"/api/v1/weather/forecast/latest?field_id=field_w2",headers:bearer("w2_read_only")});
  expect(weatherNoScope.statusCode===403,"weather latest accepted unrelated read scope",{status:weatherNoScope.statusCode,body:weatherNoScope.body});
  const weatherCross=await weatherApp.inject({method:"GET",url:"/api/v1/weather/forecast/latest?field_id=field_w2&tenant_id=tenantB&project_id=projectB&group_id=groupB",headers:bearer("w2_admin")});
  expect(weatherCross.statusCode===404,"weather latest cross-tenant read not hidden",{status:weatherCross.statusCode,body:weatherCross.body});
  const weatherOk=await weatherApp.inject({method:"GET",url:"/api/v1/weather/forecast/latest?field_id=field_w2",headers:bearer("w2_admin")});
  expect(weatherOk.statusCode===200 && weatherOk.json()?.weather_forecast_v1?.forecast_id==="forecast_w2","authorized weather latest failed",{status:weatherOk.statusCode,body:weatherOk.body});
  await weatherApp.close();

  const fieldResult=await refreshFieldReadModelsWithObservabilityV1(pool as any,{tenant_id:"tenantA",project_id:"projectA",group_id:"groupA",field_id:"field_w2",persist:false});
  expect(fieldResult && typeof fieldResult==="object","pure field read model computation failed");

  const manual=await projectManualExecutionQualityV1(pool as any,{tenant_id:"tenantA",project_id:"projectA",group_id:"groupA",dimension:"TEAM" as any},{persist:false});
  expect(manual && typeof manual==="object","pure manual quality computation failed");
  const manualDetails=await listManualExecutionQualityTaskDetailsV1(pool as any,{tenant_id:"tenantA",project_id:"projectA",group_id:"groupA",dimension:"TEAM" as any});
  expect(manualDetails && typeof manualDetails==="object","pure manual quality detail read failed");

  const projected=await projectSkillRegistryReadV1(pool as any,{tenant_id:"tenantA",project_id:"projectA",group_id:"groupA"},{persist:false});
  expect(projected.length===2,"pure skill projection did not compute expected rows",projected);
  const skills=await listSkills(pool as any,{tenant_id:"tenantA",project_id:"projectA",group_id:"groupA"},{});
  expect(skills.some((x:any)=>x.skill_id==="w2_skill"),"pure skill list lost definition",skills);
  const detail=await getSkillDetail(pool as any,{tenant_id:"tenantA",project_id:"projectA",group_id:"groupA"},"w2_skill");
  expect(detail?.skill_id==="w2_skill","pure skill detail failed",detail);
  const runs=await listSkillRuns(pool as any,{tenant_id:"tenantA",project_id:"projectA",group_id:"groupA"},{});
  expect(runs.items.some((x:any)=>x.skill_run_id==="skill_run_w2"),"pure skill runs failed",runs);
  const legacyRuns=await listSkillRunsLegacy(pool as any,{tenant_id:"tenantA",project_id:"projectA",group_id:"groupA"},{});
  expect(legacyRuns.items.some((x:any)=>x.run_id==="skill_run_w2"),"pure legacy skill runs failed",legacyRuns);
  const status=await getSkillRunRuntimeStatusV1(pool as any,{tenant_id:"tenantA",project_id:"projectA",group_id:"groupA"},"skill_run_w2");
  expect(status?.skill_run_id==="skill_run_w2","pure skill runtime status failed",status);
  const result=await getSkillRunRuntimeResultV1(pool as any,{tenant_id:"tenantA",project_id:"projectA",group_id:"groupA"},"skill_run_w2");
  expect(result?.result_status==="SUCCESS","pure skill runtime result failed",result);
  const run=await getSkillRunRuntimeV1(pool as any,{tenant_id:"tenantA",project_id:"projectA",group_id:"groupA"},"skill_run_w2");
  expect(run?.fact_id==="skill_run_fact_w2","pure skill runtime row failed",run);
  await getSkillBindingProjection(pool as any,{tenant_id:"tenantA",project_id:"projectA",group_id:"groupA"},{});

  const controlApp=Fastify({logger:false});
  registerControlPlaneV1Routes(controlApp,pool as any);
  await controlApp.ready();
  const dispatch=await controlApp.inject({method:"GET",url:"/api/v1/ao-act/dispatches?tenant_id=tenantA&project_id=projectA&group_id=groupA",headers:bearer("w2_admin")});
  expect(dispatch.statusCode===200,"dispatch GET failed under read-only DB proof",{status:dispatch.statusCode,body:dispatch.body});
  const consoleResp=await controlApp.inject({method:"GET",url:"/api/v1/operations/console?tenant_id=tenantA&project_id=projectA&group_id=groupA",headers:bearer("w2_admin")});
  expect(consoleResp.statusCode===200,"operations console GET failed under read-only DB proof",{status:consoleResp.statusCode,body:consoleResp.body});
  await controlApp.close();

  const actionApp=Fastify({logger:false});
  registerAoActV1Routes(actionApp,pool as any);
  await actionApp.ready();
  const actionIndex=await actionApp.inject({method:"GET",url:"/api/v1/actions/index?tenant_id=tenantA&project_id=projectA&group_id=groupA",headers:bearer("w2_admin")});
  expect(actionIndex.statusCode===200,"AO-ACT index GET failed under read-only DB proof",{status:actionIndex.statusCode,body:actionIndex.body});
  await actionApp.close();

  expect(pool.mutationQueries.length===0,"W2 read proof observed persistent mutation",pool.mutationQueries);
  expect(pool.connectCalls===0,"W2 read proof entered transaction/materialization path",pool.connectCalls);

  console.log(JSON.stringify({result:"PASS",workstream:"W2_CALLER_CAPABILITY_READ_WRITE_BOUNDARY",recommendation:{read_only_status:readDenied.statusCode,writer_status:writerAllowed.statusCode},weather:{anonymous:weatherAnon.statusCode,wrong_scope:weatherNoScope.statusCode,cross_tenant:weatherCross.statusCode,authorized:weatherOk.statusCode},pure_reads:{field:true,manual_quality:true,skills:true,dispatch:true,operations_console:true,action_index:true},mutation_query_count:pool.mutationQueries.length,connect_calls:pool.connectCalls,total_queries:pool.queries.length},null,2));
}
main().catch(e=>{console.error(e);process.exitCode=1;}).finally(restore);