#!/usr/bin/env node
const fs = require("fs");
const cp = require("child_process");

const fail = (m) => { throw new Error(m); };
const read = (p) => fs.readFileSync(p,"utf8");
const json = (p) => JSON.parse(read(p));

const invPath = "docs/architecture/semantic_convergence/GEOX-B09E-EVIDENCE-CONSUMER-DEPENDENCY-INVENTORY-V1.json";
const inv = json(invPath);

if(inv.schema_version!=="evidence_consumer_dependency_inventory_v1") fail("B09E_SCHEMA_INVALID");
if(inv.phase!=="B-09e") fail("B09E_PHASE_INVALID");
if(inv.base_product_head!=="ac0d2d43c4914d53075de0ebc4e76bfeeca12d88") fail("B09E_BASE_HEAD_INVALID");
if(inv.analysis_mode!=="DEPENDENCY_ANALYSIS_ONLY") fail("B09E_ANALYSIS_MODE_INVALID");
if(inv.authority_removal_performed!==false) fail("B09E_AUTHORITY_REMOVAL_PERFORMED");
if(inv.consumer_migration_performed!==false) fail("B09E_CONSUMER_MIGRATION_PERFORMED");

const corpus=inv.runtime_corpus_evidence;
if(corpus.qualification_run_id!==33146582018) fail("B09E_CORPUS_RUN_INVALID");
if(corpus.validation_child_sha!=="fb0a3b6390346f2ed3281957fc3b4bbda86862ca") fail("B09E_CORPUS_CHILD_INVALID");
if(corpus.artifact_id!==9676031155) fail("B09E_CORPUS_ARTIFACT_INVALID");
if(corpus.artifact_digest!=="sha256:196d9730009af5b3feeb3f9af65177902c41e39a2ed156de2ca1ed69e08fdb0c") fail("B09E_CORPUS_DIGEST_INVALID");
if(corpus.product_head!=="ac0d2d43c4914d53075de0ebc4e76bfeeca12d88") fail("B09E_CORPUS_PRODUCT_HEAD_INVALID");
if(corpus.observed_comparison_count!==3) fail("B09E_CORPUS_COUNT_INVALID");
const expectedCounts={MATCH:1,DIVERGENT:1,INCOMPARABLE:1,CANONICAL_MISSING:0,LEGACY_MISSING:0};
if(JSON.stringify(corpus.state_counts)!==JSON.stringify(expectedCounts)) fail("B09E_CORPUS_STATE_COUNTS_INVALID:"+JSON.stringify(corpus.state_counts));
if(!Array.isArray(corpus.observed_judge_ids)||corpus.observed_judge_ids.length!==3) fail("B09E_CORPUS_JUDGE_IDS_INVALID");

const deps=new Map((inv.dependencies||[]).map(x=>[x.dependency_id,x]));
const self=deps.get("evidence-judge-self-surface");
const agr=deps.get("agronomy-caller-injected-evidence-verdict");
const stage1=deps.get("stage1-separate-evidence-authority");
if(!self||!agr||!stage1) fail("B09E_DEPENDENCY_SET_INCOMPLETE");
if(self.runtime_edge!=="PROVEN") fail("B09E_SELF_SURFACE_EDGE_INVALID");
if(agr.runtime_edge!=="NOT_PROVEN") fail("B09E_AGRONOMY_EDGE_OVERCLAIMED");
if(stage1.runtime_edge!=="PROVEN") fail("B09E_STAGE1_EDGE_INVALID");
if(agr.authority_removal_permitted!==false||stage1.authority_removal_permitted!==false) fail("B09E_REMOVAL_PERMISSION_INVALID");

const agronomy=read("apps/server/src/domain/judge/agronomy_judge_v2.ts");
if(!agronomy.includes("evidence_judge_verdict?: string | null")) fail("B09E_AGRONOMY_VERDICT_INPUT_MISSING");
if(agronomy.includes("evidence_judge_id")) fail("B09E_AGRONOMY_DOMAIN_SHOULD_NOT_LOAD_ID_FACT_CHANGED");
const blockNeedle='["DEVICE_OFFLINE", "INSUFFICIENT_EVIDENCE", "STALE_DATA"].includes(evidenceVerdict)';
if(!agronomy.includes(blockNeedle)) fail("B09E_AGRONOMY_BLOCK_SET_CHANGED");
if(blockNeedle.includes("SENSOR_DRIFT")) fail("B09E_INTERNAL_BLOCK_SET_FIXTURE_INVALID");

const route=read("apps/server/src/routes/judge_v2.ts");
if(!route.includes("evidence_judge_id: z.string().min(1).optional()")) fail("B09E_ROUTE_EVIDENCE_ID_INPUT_MISSING");
if(!route.includes("evidence_judge_verdict: z.string().min(1).optional()")) fail("B09E_ROUTE_EVIDENCE_VERDICT_INPUT_MISSING");
const start=route.indexOf('app.post("/api/v1/judge/agronomy/evaluate"');
const end=route.indexOf('app.post("/api/v1/judge/execution/evaluate"',start);
if(start<0||end<0) fail("B09E_AGRONOMY_ROUTE_BLOCK_MISSING");
const block=route.slice(start,end);
if(!block.includes("evaluateAgronomyJudgeV2(body)")) fail("B09E_AGRONOMY_ROUTE_CALL_MISSING");
if(block.includes("loadJudgeResultV2(")) fail("B09E_AGRONOMY_ROUTE_NOW_LOADS_JUDGE_RESULT");
if(block.includes("evaluateEvidenceJudgeV2")) fail("B09E_AGRONOMY_ROUTE_NOW_RUNS_EVIDENCE_JUDGE");

const b07c=read("docs/architecture/semantic_convergence/GEOX-B07C-AGRONOMY-JUDGE-ELIGIBILITY-PRECURSOR-ADAPTER-V1.md");
if(!b07c.includes("It maps only to:")||!b07c.includes("QUALIFIED_EVIDENCE = MISSING")) fail("B09E_B07C_EVIDENCE_CRITERION_BOUNDARY_MISSING");
if(!b07c.includes("It never maps directly to canonical BLOCK.")) fail("B09E_B07C_DIRECT_BLOCK_PROHIBITION_MISSING");

const reg=json("docs/architecture/semantic_convergence/GEOX-SEMANTIC-OWNERSHIP-REGISTER-V1.json");
const ev=(reg.semantics||[]).find(x=>x.semantic_id==="evidence.qualification");
if(!ev) fail("B09E_EVIDENCE_SEMANTIC_MISSING");
const rc=new Map((ev.runtime_consumers||[]).map(x=>[x.consumer_id,x]));
if(rc.get("judge-v2-evidence-route")?.evidence_edge_id!=="C-005") fail("B09E_JUDGE_ROUTE_EDGE_INVALID");
if(rc.get("stage1-recommendation-path")?.evidence_edge_id!=="C-003") fail("B09E_STAGE1_RUNTIME_EDGE_INVALID");

const graph=json("docs/architecture/semantic_convergence/GEOX-PARALLEL-AUTHORITY-GRAPH-V1.json");
const c004=(graph.current_connectivity_edges||[]).find(x=>x.edge_id==="C-004");
const c003=(graph.current_connectivity_edges||[]).find(x=>x.edge_id==="C-003");
if(!c004||c004.runtime_edge!=="NOT_PROVEN"||c004.status!=="NOT_WIRED") fail("B09E_C004_FACT_CHANGED");
if(!c003||c003.runtime_edge!=="PROVEN"||c003.status!=="CURRENT_PROVEN") fail("B09E_C003_FACT_CHANGED");

const migration=(reg.semantics||[]).find(x=>x.semantic_id==="governance.semantic_authority_migration");
if(!migration) fail("B09E_MIGRATION_SEMANTIC_MISSING");
const report=(migration.registered_producers||[]).find(x=>x.producer_id==="evidence-consumer-dependency-inventory-v1");
if(!report) fail("B09E_REPORT_PRODUCER_MISSING");
if(report.connection_class!=="REPORTING_ARTIFACT_PLANE"||report.activation!=="MANUAL"||report.runtime_edge!=="INTENTIONAL_NONE") fail("B09E_REPORT_PRODUCER_CLASS_INVALID");
if(report.new_runtime_consumer_creation!=="FORBIDDEN") fail("B09E_REPORT_RUNTIME_CONSUMER_NOT_FORBIDDEN");

const stageGuard=(reg.static_guards||[]).find(x=>x.guard_id==="G-B02-25-stage1-shadow-comparator-runtime-disconnection");
const expectedStage=["apps/server/src/domain/decision/evidence_semantic_shadow_comparator_v1.ts"];
if(!stageGuard||JSON.stringify(stageGuard.registered_paths)!==JSON.stringify(expectedStage)) fail("B09E_STAGE1_COMPARATOR_CONNECTION_CHANGED");

const readiness=json("docs/architecture/semantic_convergence/GEOX-B09-REPLACEMENT-READINESS-V1.json");
if(readiness.authority_removal_performed!==false) fail("B09E_READINESS_AUTHORITY_REMOVAL_CHANGED");
const family=(readiness.families||[]).find(x=>x.semantic_id==="evidence.qualification");
if(!family) fail("B09E_READINESS_EVIDENCE_MISSING");
if(family.consumer_migration_state!=="PARTIAL") fail("B09E_CONSUMER_MIGRATION_STATE_CHANGED");
if(family.authority_removal_state!=="PENDING_CONSUMER_MIGRATION") fail("B09E_REMOVAL_STATE_CHANGED");

const before=jsonFromGit("ac0d2d43c4914d53075de0ebc4e76bfeeca12d88:docs/architecture/semantic_convergence/GEOX-SEMANTIC-OWNERSHIP-REGISTER-V1.json");
function jsonFromGit(spec){ return JSON.parse(cp.execFileSync("git",["show",spec],{encoding:"utf8"})); }
const flatten=(r)=>(r.semantics||[]).flatMap(s=>(s.registered_producers||[])
  .filter(p=>p.grandfathered_duplicate===true)
  .map(p=>({semantic_id:s.semantic_id,...p})))
  .sort((a,b)=>(a.semantic_id+"::"+a.producer_id).localeCompare(b.semantic_id+"::"+b.producer_id));
const b=flatten(before),a=flatten(reg);
if(b.length!==29||a.length!==29) fail("B09E_GRANDFATHERED_COUNT_INVALID:"+b.length+":"+a.length);
if(JSON.stringify(b)!==JSON.stringify(a)) fail("B09E_GRANDFATHERED_AUTHORITY_MUTATED");

console.log("B09E_RUNTIME_CORPUS_IDENTITY_PASS");
console.log("B09E_AGRONOMY_CALLER_INJECTED_VERDICT_DEPENDENCY_PASS");
console.log("B09E_B07_ELIGIBILITY_TARGET_BOUNDARY_PASS");
console.log("B09E_STAGE1_SEPARATE_AUTHORITY_PASS");
console.log("B09E_ZERO_CONSUMER_MIGRATION_ZERO_AUTHORITY_REMOVAL_PASS");
console.log("B09E_EVIDENCE_CONSUMER_DEPENDENCY_ANALYSIS_PASS");
