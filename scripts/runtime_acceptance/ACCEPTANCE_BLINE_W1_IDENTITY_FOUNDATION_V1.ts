import Fastify from "fastify";
import { requireAoActAuthV0, requireAoActScopeV0 } from "../../apps/server/src/auth/ao_act_authz_v0.js";
import { registerDeviceStatusV1Routes } from "../../apps/server/src/routes/device_status_v1.js";
import { getRuntimeSecurityStatusV1 } from "../../apps/server/src/runtime/runtime_security_v1.js";

const saved = new Map<string,string|undefined>();
for (const k of ["GEOX_RUNTIME_ENV","GEOX_TOKENS_JSON","GEOX_TOKENS_FILE","GEOX_TOKEN_SSOT_PATH","GEOX_TOKEN","GEOX_AO_ACT_TOKEN","AO_ACT_TOKEN"]) saved.set(k,process.env[k]);
function restore(){ for(const [k,v] of saved){ if(v===undefined) delete process.env[k]; else process.env[k]=v; } }
function bearer(token:string){ return {authorization:`Bearer ${token}`}; }
function expect(cond:any,msg:string,detail?:any){ if(!cond) throw new Error(`${msg}${detail===undefined?"":`: ${JSON.stringify(detail)}`}`); }

const TOKENS:any = {
  version:"ao_act_tokens_v0",
  tokens:[
    {token:"admin_ok",token_id:"tok_admin_ok",actor_id:"admin_a",tenant_id:"tenantA",project_id:"projectA",group_id:"groupA",role:"admin",scopes:["security.admin"],revoked:false},
    {token:"tenant_b",token_id:"tok_tenant_b",actor_id:"reader_b",tenant_id:"tenantB",project_id:"projectB",group_id:"groupB",role:"viewer",scopes:[],revoked:false},
    {token:"bad_role",token_id:"tok_bad_role",actor_id:"bad",tenant_id:"tenantA",project_id:"projectA",group_id:"groupA",role:"superadmin",scopes:["security.admin"],revoked:false},
    {token:"missing_role",token_id:"tok_missing_role",actor_id:"missing",tenant_id:"tenantA",project_id:"projectA",group_id:"groupA",scopes:["security.admin"],revoked:false},
    {token:"operator_mismatch",token_id:"tok_operator_mismatch",actor_id:"operator",tenant_id:"tenantA",project_id:"projectA",group_id:"groupA",role:"operator",scopes:["security.admin"],revoked:false}
  ]
};

async function main(){
  process.env.GEOX_RUNTIME_ENV="pilot";
  process.env.GEOX_TOKENS_JSON=JSON.stringify(TOKENS);
  delete process.env.GEOX_TOKENS_FILE;
  delete process.env.GEOX_TOKEN_SSOT_PATH;
  delete process.env.GEOX_TOKEN;
  delete process.env.GEOX_AO_ACT_TOKEN;
  delete process.env.AO_ACT_TOKEN;

  const selectParams:any[]=[];
  const pool:any={
    query: async (sql:string,params?:any[])=>{
      if(/FROM\s+device_status_index_v1/i.test(sql)){
        selectParams.push(Array.isArray(params)?params.slice():[]);
        return {rowCount:1,rows:[{
          device_id:String(params?.[1]??"dev_w1"),
          last_telemetry_ts_ms:Date.now(),
          last_heartbeat_ts_ms:Date.now(),
          battery_percent:91,
          rssi_dbm:-50,
          fw_ver:"w1",
          updated_ts_ms:Date.now(),
          status:"ONLINE"
        }]};
      }
      return {rowCount:0,rows:[]};
    }
  };

  const app=Fastify({logger:false});
  app.get("/w1/auth",async(req,reply)=>{
    const auth=requireAoActAuthV0(req,reply);
    if(!auth) return reply;
    return reply.send({ok:true,role:auth.role,tenant_id:auth.tenant_id});
  });
  app.get("/w1/security-admin",async(req,reply)=>{
    const auth=requireAoActScopeV0(req,reply,"security.admin");
    if(!auth) return reply;
    return reply.send({ok:true,role:auth.role});
  });
  registerDeviceStatusV1Routes(app,pool);
  await app.ready();
  await new Promise(r=>setImmediate(r));

  const malformed=await app.inject({method:"GET",url:"/w1/auth",headers:bearer("bad_role")});
  expect(malformed.statusCode===401,"unknown role did not fail closed",{status:malformed.statusCode,body:malformed.body});
  expect(malformed.json()?.error==="AUTH_ROLE_INVALID","unknown role error drift",malformed.json());

  const missing=await app.inject({method:"GET",url:"/w1/auth",headers:bearer("missing_role")});
  expect(missing.statusCode===401&&missing.json()?.error==="AUTH_ROLE_INVALID","missing role did not fail closed",{status:missing.statusCode,body:missing.body});

  const mismatch=await app.inject({method:"GET",url:"/w1/security-admin",headers:bearer("operator_mismatch")});
  expect(mismatch.statusCode===403&&mismatch.json()?.error==="AUTH_ROLE_SCOPE_DENIED","token-role mismatch was not denied",{status:mismatch.statusCode,body:mismatch.body});

  const admin=await app.inject({method:"GET",url:"/w1/security-admin",headers:bearer("admin_ok")});
  expect(admin.statusCode===200&&admin.json()?.role==="admin","explicit admin role regression",{status:admin.statusCode,body:admin.body});

  const beforeSelect=selectParams.length;
  const badDevice=await app.inject({method:"GET",url:"/api/v1/devices/dev_w1/status",headers:bearer("bad_role")});
  expect(badDevice.statusCode===401&&badDevice.json()?.error==="AUTH_ROLE_INVALID","Device Status malformed role did not fail closed",{status:badDevice.statusCode,body:badDevice.body});
  expect(selectParams.length===beforeSelect,"Device Status queried DB after failed identity");

  const device=await app.inject({method:"GET",url:"/api/v1/devices/dev_w1/status",headers:bearer("tenant_b")});
  expect(device.statusCode===200,"Device Status tenantB auth failed",{status:device.statusCode,body:device.body});
  const last=selectParams.at(-1);
  expect(Array.isArray(last)&&last[0]==="tenantB"&&last[1]==="dev_w1","Device Status query not bound to authenticated tenant",last);
  expect(!selectParams.some(p=>p?.[0]==="tenantA"&&p?.[1]==="dev_w1"),"Device Status fell back to tenantA",selectParams);

  delete process.env.GEOX_TOKENS_JSON;
  process.env.GEOX_TOKENS_FILE="/app/config/auth/security_acceptance_tokens.json";
  const tracked=await app.inject({method:"GET",url:"/w1/auth",headers:bearer("admin_token")});
  expect(tracked.statusCode===401&&tracked.json()?.error==="AUTH_PRODUCTION_TOKEN_SOURCE_INVALID","pilot accepted tracked acceptance credential source",{status:tracked.statusCode,body:tracked.body});
  const security=getRuntimeSecurityStatusV1();
  expect(security.errors.includes("RUNTIME_ACCEPTANCE_TOKEN_FIXTURE_FORBIDDEN"),"runtime security did not flag tracked acceptance credential source",security);

  delete process.env.GEOX_TOKENS_FILE;
  process.env.GEOX_TOKENS_JSON=JSON.stringify(TOKENS);
  const isolated=await app.inject({method:"GET",url:"/w1/auth",headers:bearer("admin_ok")});
  expect(isolated.statusCode===200,"isolated structured credential source failed",{status:isolated.statusCode,body:isolated.body});

  await app.close();
  console.log(JSON.stringify({
    result:"PASS",
    workstream:"W1_IDENTITY_FOUNDATION",
    malformed_role:{status:malformed.statusCode,error:malformed.json().error},
    missing_role:{status:missing.statusCode,error:missing.json().error},
    token_role_mismatch:{status:mismatch.statusCode,error:mismatch.json().error},
    explicit_admin:{status:admin.statusCode},
    device_status:{status:device.statusCode,query_tenant:last?.[0],tenantA_fallback:false},
    commercial_credential_source:{tracked_fixture_status:tracked.statusCode,tracked_fixture_error:tracked.json().error,isolated_inline_status:isolated.statusCode},
    request_selects:selectParams
  },null,2));
}

main().catch(e=>{console.error(e);process.exitCode=1;}).finally(restore);