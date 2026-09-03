const fs=require("node:fs"),cp=require("node:child_process"),path=require("node:path");
const BASE="03db0c098a66053fd0b921cb8a3c5acdcf67d4d0";
const W2_ACCEPTED_HEAD="89e7ea6e5b322ae7745c04db3ad4ab584aecb6c2";
const PREDECESSOR="docs/architecture/semantic_convergence/GEOX-BLINE-PRODUCTION-CALLER-AUTHORITY-INVENTORY-V1.json";
const W2="docs/architecture/semantic_convergence/GEOX-BLINE-W2-CALLER-READ-WRITE-BOUNDARY-V1.json";
function sh(args){return cp.execFileSync("git",["-c","core.quotepath=false",...args],{encoding:"utf8"}).trim();}
function read(p){return fs.readFileSync(p,"utf8");}
function json(p){return JSON.parse(read(p));}
function assert(c,m,d){if(!c)throw new Error(m+(d===undefined?"":": "+JSON.stringify(d)));}
function extractFn(src,needle,next){const s=src.indexOf(needle);assert(s>=0,"function/handler missing",needle);const e=next?src.indexOf(next,s+needle.length):src.length;assert(e>s,"function/handler end missing",needle);return src.slice(s,e);}
const pred=json(PREDECESSOR),w2=json(W2);
assert(w2.authority_base===BASE,"W2 authority base drift",w2.authority_base);
assert(w2.discovery_policy==="NO_WHOLE_REPOSITORY_DISCOVERY; EXACT_PREDECESSOR_ROWS_ONLY","W2 discovery policy drift");
assert(sh(["diff","--name-only",BASE,"HEAD","--",PREDECESSOR])==="","frozen predecessor inventory modified");
for(const p of ["apps/server/src/domain/auth/roles.ts","config/auth/security_acceptance_tokens.json","config/auth/ao_act_tokens_v0.json"]){
  assert(sh(["diff","--name-only",BASE,"HEAD","--",p])==="","W2 may not rewrite identity/capability authority data",p);
}
const getRows=(pred.http_entrypoint_dispositions||[]).filter(x=>/WRITE_UNDER_GET|GET_PROJECTION_REFRESH|GET_DOMAIN_STATE_COMPATIBILITY_WRITE|GET_PROJECTION_SIDE_EFFECT|UNAUTHENTICATED_GET_PROJECTION_SIDE_EFFECT/.test(String(x.current_disposition||"")));
assert(getRows.length===23,"bounded predecessor GET mutation count drift",getRows.length);
assert(w2.known_get_count===23 && w2.known_get_read_product_state_mutations.length===23,"W2 frozen GET count drift");
const key=x=>[x.source_path,x.entry_symbol].join("|");
assert(JSON.stringify(getRows.map(key).sort())===JSON.stringify(w2.known_get_read_product_state_mutations.map(key).sort()),"W2 inventory is not exact predecessor bounded set");
const predecessorAnon=getRows.filter(x=>String(x.authn_mode)==="NONE").map(x=>x.entry_symbol).sort();
assert(JSON.stringify(predecessorAnon)===JSON.stringify(["GET /api/v1/weather/forecast/latest"]),"bounded anonymous read set drift",predecessorAnon);

const rec=(pred.surfaces||[]).find(x=>x.surface_id==="BSEC-051");
assert(rec && rec.source_path==="apps/server/src/routes/decision_engine_v1.ts","BSEC-051 predecessor missing");
assert(JSON.stringify(rec.authz_capability)===JSON.stringify(["recommendation.read","ao_act.index.read"]),"BSEC-051 predecessor capability drift",rec?.authz_capability);
const decision=read("apps/server/src/routes/decision_engine_v1.ts");
const recHandler=extractFn(decision,'app.post("/api/v1/recommendations/generate"','app.post(',);
assert(recHandler.includes('requireAoActScopeV0(req, reply, "recommendation.write")'),"Recommendation generate lacks writer authority");
assert(recHandler.includes("if (!auth) return reply;"),"Recommendation generate denied-auth path does not terminate Fastify reply ownership");
assert(!recHandler.includes('"recommendation.read"')&&!recHandler.includes('"ao_act.index.read"'),"Recommendation generate still authorizes by read capability");
assert(read("apps/server/src/domain/auth/roles.ts").includes('recommendation.write'),"existing recommendation.write capability missing");

const fieldRefresh=read("apps/server/src/services/field_read_model_refresh_v1.ts");
assert(fieldRefresh.includes("persist?: boolean"),"field read model non-persist mode missing");
assert(fieldRefresh.includes("persist: params.persist"),"field read model persist propagation missing");
for(const p of ["apps/server/src/projections/field_sensing_overview_v1.ts","apps/server/src/projections/field_sensing_summary_stage1_v1.ts","apps/server/src/projections/field_fertility_state_v1.ts"]){
  const s=read(p);
  assert(s.includes("persist?: boolean"),"projection non-persist option missing",p);
  assert(s.includes("persist === false"),"projection pure-return branch missing",p);
}
const dashboard=read("apps/server/src/routes/dashboard_v1.ts");
const fields=read("apps/server/src/routes/fields_v1.ts");
assert((dashboard.match(/persist:\s*false/g)||[]).length>=2,"dashboard bounded sensing GETs not pure");
assert((fields.match(/persist:\s*false/g)||[]).length>=3,"field bounded sensing GETs not pure");

const manual=read("apps/server/src/projections/manual_execution_quality_v1.ts");
assert(manual.includes("options: { persist?: boolean }"),"manual quality persist option missing");
assert(manual.includes("options.persist !== false"),"manual quality write guard missing");
assert(manual.includes("projectManualExecutionQualityV1(db, query, { persist: false })"),"manual quality detail GET still materializes");
assert(dashboard.includes("}, { persist: false });"),"manual quality dashboard GET still materializes");

const weatherProjection=read("apps/server/src/projections/weather_forecast_v1.ts");
assert(weatherProjection.includes("allow_compatibility_write?: boolean"),"weather pure read option missing");
assert(weatherProjection.includes("options.allow_compatibility_write !== false"),"weather compatibility write guard missing");
const weather=read("apps/server/src/routes/weather_v1.ts");
const weatherLatest=extractFn(weather,'app.get("/api/v1/weather/forecast/latest"','app.get(',);
assert(weatherLatest.includes('requireAoActScopeV0(req, reply, "telemetry.read")'),"weather latest not bound to existing telemetry.read");
assert(weatherLatest.includes("allow_compatibility_write: false"),"weather latest still mutates compatibility state");
assert(!weatherLatest.includes('?? "tenantA"')&&!weatherLatest.includes('?? "projectA"')&&!weatherLatest.includes('?? "groupA"'),"weather latest still has anonymous/default tenant fallback");
const reports=read("apps/server/src/routes/reports_v1.ts");
assert(reports.includes("allow_compatibility_write: false"),"report GET weather lookup still mutates compatibility state");
const reportsDashboard=read("apps/server/src/routes/reports_dashboard_v1.ts");
assert(reportsDashboard.includes("SELECT operation_plan_id AS operation_id, field_id"),"field portfolio bounded GET must read canonical operation_plan identity");
assert(!reportsDashboard.includes("COALESCE(operation_id, operation_plan_id) AS operation_id"),"field portfolio bounded GET still references non-canonical compatibility identity column");

const task=read("apps/server/src/domain/controlplane/task_service.ts");
const listDispatch=extractFn(task,"async function listDispatchQueue(","async function listDispatchQueueByIds(");
assert(!listDispatch.includes("ensureDispatchQueueRuntime"),"dispatch GET list still runs compatibility mutation");
const action=read("apps/server/src/routes/control_ao_act.ts");
const actionIndex=extractFn(action,"async function handleAoActIndexV1","export function registerAoActV1Routes");
assert(!actionIndex.includes("writeAoActAuthzAuditFactV0"),"AO-ACT index GET still writes persistent audit fact");
assert(actionIndex.includes("req.log.info"),"AO-ACT index GET lost nonpersistent audit evidence");

const skillProjection=read("apps/server/src/projections/skill_registry_read_v1.ts");
const skillPure=extractFn(skillProjection,"export async function computeSkillRegistryReadRowsV1","export async function projectSkillRegistryReadV1");
const skillWriter=extractFn(skillProjection,"export async function projectSkillRegistryReadV1","export function filterSkillRegistryReadRowsV1");
assert(skillPure.includes("FROM facts"),"skill pure-read helper must derive rows from facts");
assert(skillPure.includes("return latest"),"skill pure-read helper must return computed rows");
for(const forbidden of ["ensureSkillRegistryReadTable","pool.connect(","DELETE FROM skill_registry_read_v1","INSERT INTO skill_registry_read_v1","CREATE TABLE","ALTER TABLE"]){
  assert(!skillPure.includes(forbidden),"skill pure-read helper contains persistent mutation",forbidden);
}
for(const required of ["ensureSkillRegistryReadTable","pool.connect(","DELETE FROM skill_registry_read_v1","INSERT INTO skill_registry_read_v1"]){
  assert(skillWriter.includes(required),"skill writer path lost predecessor persistence semantics",required);
}
for(const p of [
 "apps/server/src/services/skills/runtime_v1.ts",
 "apps/server/src/services/skills/skill_runtime_service.ts",
 "apps/server/src/services/skills/skill_registry_service.ts"
]){
  assert(read(p).includes("computeSkillRegistryReadRowsV1"),"skill GET service missing dedicated pure-read helper",p);
}
const registryService=read("apps/server/src/services/skills/skill_registry_service.ts");
const updateSkill=extractFn(registryService,"export async function updateSkillStatus","");
assert(updateSkill.includes("projectSkillRegistryReadV1(pool, tenant)"),"skill writer service no longer materializes projection");
const runtimeSkill=read("apps/server/src/services/skills/runtime_v1.ts");
const runtimeRead=extractFn(runtimeSkill,"async function findSkillRunByRunIdReadOnly","async function findSkillRunByRunIdForMutation");
const runtimeMutation=extractFn(runtimeSkill,"async function findSkillRunByRunIdForMutation","export async function executeSkillRuntimeV1");
const cancelSkill=extractFn(runtimeSkill,"export async function cancelSkillRuntimeV1","export async function getSkillRunRuntimeStatusV1");
assert(runtimeRead.includes("computeSkillRegistryReadRowsV1")&&!runtimeRead.includes("projectSkillRegistryReadV1"),"skill runtime GET helper is not pure");
assert(runtimeMutation.includes("projectSkillRegistryReadV1(pool, tenant)"),"skill cancel mutation helper lost projection writer");
assert(cancelSkill.includes("findSkillRunByRunIdForMutation"),"skill cancel no longer uses mutation-preserving lookup");

const binding=read("apps/server/src/services/skills/skill_binding_service.ts");
const bindingGet=extractFn(binding,"export async function getSkillBindingProjection","export async function resolveDeviceSkillBindingForTask");
const bindingResolve=extractFn(binding,"export async function resolveDeviceSkillBindingForTask","");
assert(!bindingGet.includes("projectSkillRegistryReadV1"),"skill binding GET still materializes registry projection");
assert(bindingResolve.includes("projectSkillRegistryReadV1(pool, tenant)"),"action execution binding resolution lost predecessor projection writer");
const rules=read("apps/server/src/routes/skills_rules_v1.ts");
const rulesGet=extractFn(rules,'app.get("/api/v1/skills/rules"','app.post(',);
assert(rulesGet.includes("computeSkillRegistryReadRowsV1"),"skill rules GET missing dedicated pure-read helper");
assert(!rulesGet.includes("projectSkillRegistryReadV1"),"skill rules GET still materializes registry projection");
assert(!rulesGet.includes("recordSecurityAuditEventV1")&&!rulesGet.includes("denyWithAuditV1"),"skill rules GET still persists security audit");

const allowed=new Set([
 ".github/workflows/bline-w2-caller-read-write-boundary.yml",".github/workflows/ci.yml",".github/workflows/bline-pr-sec2-batch008.yml",".github/workflows/bline-pr-sec2-containment.yml",
 W2,
 "apps/server/src/routes/decision_engine_v1.ts","apps/server/src/routes/weather_v1.ts","apps/server/src/routes/reports_v1.ts","apps/server/src/routes/reports_dashboard_v1.ts",
 "apps/server/src/routes/dashboard_v1.ts","apps/server/src/routes/fields_v1.ts","apps/server/src/routes/control_ao_act.ts","apps/server/src/routes/skills_rules_v1.ts",
 "apps/server/src/projections/weather_forecast_v1.ts","apps/server/src/projections/field_sensing_overview_v1.ts","apps/server/src/projections/field_sensing_summary_stage1_v1.ts","apps/server/src/projections/field_fertility_state_v1.ts","apps/server/src/projections/manual_execution_quality_v1.ts","apps/server/src/projections/skill_registry_read_v1.ts",
 "apps/server/src/services/field_read_model_refresh_v1.ts","apps/server/src/services/skills/runtime_v1.ts","apps/server/src/services/skills/skill_runtime_service.ts","apps/server/src/services/skills/skill_registry_service.ts","apps/server/src/services/skills/skill_binding_service.ts",
 "apps/server/src/domain/controlplane/task_service.ts",
 "scripts/governance_acceptance/ACCEPTANCE_BLINE_W2_CALLER_READ_WRITE_BOUNDARY_V1.cjs",
 "scripts/runtime_acceptance/ACCEPTANCE_BLINE_W2_CALLER_READ_WRITE_BOUNDARY_V1.ts",
 "scripts/runtime_acceptance/ACCEPTANCE_BLINE_W2_COMMERCIAL_READ_ONLY_V1.ts",
 "scripts/governance_acceptance/ACCEPTANCE_BLINE_PRODUCTION_CALLER_AUTHORITY_INVENTORY_V1.cjs",
 "scripts/governance_acceptance/ACCEPTANCE_BLINE_W1_IDENTITY_FOUNDATION_V1.cjs",
 "scripts/governance_acceptance/ACCEPTANCE_BLINE_PR_SEC_2_EVIDENCE_EXPORT_WRITE_CAPABILITY_V1.cjs"
]);
const head=sh(["rev-parse","HEAD"]);
const changed=sh(["diff","--name-only",BASE,"HEAD"]).split(/\r?\n/).filter(Boolean);
if(head===W2_ACCEPTED_HEAD){
  for(const p of changed) assert(allowed.has(p),"W2 scope expansion",p);
  for(const p of changed) assert(!/mcft/i.test(p),"W2 touched MCFT",p);
  for(const p of changed) assert(!/(approval|planner|crop.*latest|executor|device_status|legacy.*twin|monitoring)/i.test(p),"W2 forbidden workstream path changed",p);
} else {
  assert(sh(["diff","--name-only",W2_ACCEPTED_HEAD,"HEAD","--",W2])==="","closed W2 bounded inventory drift in successor workstream",W2);
}
console.log(JSON.stringify({result:"PASS",workstream:"W2_CALLER_CAPABILITY_READ_WRITE_BOUNDARY",authority_base:BASE,accepted_head:W2_ACCEPTED_HEAD,qualification_mode:head===W2_ACCEPTED_HEAD?"EXACT_W2_SCOPE":"SUCCESSOR_PRESERVATION",bounded_inventory:{recommendation_generate:"BSEC-051",known_get_mutation_count:23,anonymous_sensitive_reads:predecessorAnon},repairs:{recommendation_writer_capability:true,get_mutations_removed:true,anonymous_weather_read_bound:true,cd02_scope_only:true},changed_files:changed,mcft_delta:0},null,2));