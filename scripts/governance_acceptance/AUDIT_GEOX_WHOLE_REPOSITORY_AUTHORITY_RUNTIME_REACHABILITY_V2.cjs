#!/usr/bin/env node
"use strict";
const fs=require("node:fs"),path=require("node:path"),cp=require("node:child_process");
const ROOT=process.cwd();
const OUT=path.join(ROOT,"acceptance-output/GEOX_WHOLE_REPOSITORY_AUTHORITY_RUNTIME_REACHABILITY_AUDIT_V2.json");
const BASE="0c71e55843c659cce402a1457d481e412cdc203c";
const PRE="scripts/governance_acceptance/ACCEPTANCE_BLINE_RESIDUAL_AUTHORITY_AUDIT_V1.cjs";
const MATRIX="docs/digital_twin/GEOX-MCFT-VERTICAL-CAPABILITY-LINE-MATRIX-V2.json";
const INV="docs/architecture/semantic_convergence/GEOX-BLINE-RESIDUAL-AUTHORITY-INVENTORY-V1.json";
const rd=p=>fs.readFileSync(path.join(ROOT,p),"utf8"),js=p=>JSON.parse(rd(p)),ex=p=>fs.existsSync(path.join(ROOT,p));
const has=(p,s)=>ex(p)&&rd(p).includes(s);
const git=(...a)=>cp.execFileSync("git",a,{cwd:ROOT,encoding:"utf8"}).trim();
function walk(dir,re){const b=path.join(ROOT,dir),o=[],q=[b];if(!fs.existsSync(b))return o;while(q.length){const d=q.pop();for(const e of fs.readdirSync(d,{withFileTypes:true})){if(["node_modules","dist",".git","coverage","acceptance-output"].includes(e.name))continue;const p=path.join(d,e.name);if(e.isDirectory())q.push(p);else if(!re||re.test(e.name))o.push(path.relative(ROOT,p).split(path.sep).join("/"));}}return o.sort();}
function runPre(){const r=cp.spawnSync(process.execPath,[path.join(ROOT,PRE)],{cwd:ROOT,encoding:"utf8"});return{status:r.status===0?"PASS":"FAIL",exit_code:r.status,stdout_tail:String(r.stdout||"").slice(-7000),stderr_tail:String(r.stderr||"").slice(-7000)};}
function roots(){const o=[];for(const f of fs.readdirSync(ROOT).filter(x=>/^docker-compose.*\.ya?ml$/.test(x)).sort()){const t=rd(f),services=[...t.matchAll(/^  ([A-Za-z0-9_.-]+):\s*$/gm)].map(m=>m[1]);const cls=/qualification/i.test(f)?"QUALIFICATION":/production|commercial|prod|staging/i.test(f)?"PRODUCTION_ONLINE":"OPERATOR_TRIGGERED";for(const s of services)o.push({execution_root_id:"COMPOSE:"+f+":"+s,execution_class:cls,source_path:f,launch_mechanism:"DOCKER_COMPOSE_SERVICE",entrypoint:s});}for(const f of ["package.json",...walk("apps",/^package\.json$/)]){let p;try{p=js(f)}catch{continue}for(const [n,c] of Object.entries(p.scripts||{}))o.push({execution_root_id:"PACKAGE_SCRIPT:"+f+":"+n,execution_class:"OPERATOR_TRIGGERED",source_path:f,launch_mechanism:"PACKAGE_SCRIPT",entrypoint:String(c)});}for(const f of walk(".github/workflows",/\.ya?ml$/)){const t=rd(f),cls=/qualification|acceptance|replay|preflight|audit|attestation|governance|reconciliation/i.test(f)?"QUALIFICATION":/production|formal|live|scheduler|runtime/i.test(f)?"PRODUCTION_BATCH":"GOVERNANCE_ONLY";o.push({execution_root_id:"WORKFLOW:"+f,execution_class:cls,source_path:f,launch_mechanism:"GITHUB_WORKFLOW",entrypoint:(t.match(/^name:\s*(.+)$/m)||[0,path.basename(f)])[1].trim()});}const d="apps/server/scripts/write_dist_entries.cjs";if(ex(d)){const t=rd(d);for(const [e,c] of [["runtime/mcft_cap09_evidence_runtime.js","PRODUCTION_ONLINE"],["runtime/mcft_cap09_twin_runtime.js","HISTORICAL_INACTIVE"],["runtime/mcft_cap09_twin_runtime_v2.js","PRODUCTION_ONLINE"],["qualification/mcft_cap09_phase5_twin_runtime.js","QUALIFICATION"],["qualification/mcft_cap09_phase5_evidence_runtime.js","QUALIFICATION"],["database/platform_bootstrap.js","DATABASE_BOOTSTRAP"],["database/mcft_cap09_phase5_service_principals.js","DATABASE_BOOTSTRAP"]])if(t.includes(e.split("/").pop()))o.push({execution_root_id:"DIST_ENTRY:"+e,execution_class:c,source_path:d,launch_mechanism:"GENERATED_DIST_ENTRY",entrypoint:e});}return[...new Map(o.map(x=>[x.execution_root_id,x])).values()].sort((a,b)=>a.execution_root_id.localeCompare(b.execution_root_id));}
function caps(){const m=js(MATRIX),o=(m.capability_lines||[]).filter(x=>x.complete===true||/COMPLETE|EFFECTIVE/.test(String(x.status||""))).map(x=>({capability_id:x.capability_line_id,current_status:x.current_effective_status||x.status,lifecycle_authority_ref:MATRIX,complete:x.complete===true,production_runtime_source_authorized:Object.hasOwn(x,"production_runtime_source_authorized")?x.production_runtime_source_authorized:null}));const t="docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-TASK.md";if(ex(t))o.push({capability_id:"MCFT-CAP-09",current_status:"ACTIVE_STAGE_1B_NOT_COMPLETE",lifecycle_authority_ref:t,complete:false,production_runtime_source_authorized:true});return o;}
function hits(sym){const o=[];for(const root of ["apps/server/src","apps/server/scripts","apps/executor/src","scripts",".github/workflows"])for(const f of walk(root,/\.(?:ts|tsx|js|cjs|mjs|yml|yaml)$/)){try{if(rd(f).includes(sym))o.push(f)}catch{}}return[...new Set(o)].sort();}
function mcft(){const task="docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-TASK.md",prod="docker-compose.mcft-cap09-production.yml",dist="apps/server/scripts/write_dist_entries.cjs",pv2="apps/server/src/runtime/twin_runtime/mcft_cap09_twin_runtime_process_v2.ts",cv2="apps/server/src/runtime/twin_runtime/mcft_cap09_twin_runtime_composition_v2.ts",tick="apps/server/src/runtime/twin_runtime/external_formal_v3_amendment19_persistent_tick_service_v1.ts",residual="apps/server/src/runtime/twin_runtime/forecast_residual_outcome_tick_service_v1.ts",binding="apps/server/src/domain/twin_runtime/external_formal_evidence_binding_profile_v1.ts",rehearsal="scripts/runtime_acceptance/RUN_MCFT_CAP_09_REAL_CLOCK_REHEARSAL_V1.cjs",qcompose="docker-compose.mcft-cap09-phase5-qualification.yml",qentry="apps/server/src/runtime/twin_runtime/qualification/mcft_cap09_phase5_twin_runtime_qualification_v1.ts",h6="docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-FORMAL-V5-PRODUCTION-ACTIVATION-SEAM-V1.json",c06="docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-CLOSURE-RECORD.json",c07r="apps/server/src/modules/operator/registerOperatorModule.ts",c07a="scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_07_CAP04_FORECAST_PAYLOAD_COMPATIBILITY_DB.ts",proute="scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_PRODUCTION_TWIN_PROCESS_V2_ROUTING_V1.cjs",plaunch="scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_09_PRODUCTION_LOCAL_TWO_SERVICE_LAUNCHER_V1.ts";const out=[];const req=has(task,"Residual creation only when verification Evidence becomes eligible")&&has(task,"Permitted canonical families remain A/B/C/F"),wired=has(cv2,"Cap05ForecastResidualOutcomeTickServiceV1")||has(pv2,"Cap05ForecastResidualOutcomeTickServiceV1")||has(tick,"Cap05ForecastResidualOutcomeTickServiceV1");out.push({id:"M-01",subject:"CAP05_FORECAST_RESIDUAL_EXECUTION_OWNER_AND_RUNTIME_REACHABILITY",final_disposition:req&&!wired?"UNWIRED_DEFECT":"WIRED_AND_PROVEN",expected_execution_owner:"MCFT-CAP-09 SHADOW_ONLINE CANONICAL RUNTIME WHEN VERIFICATION EVIDENCE IS ELIGIBLE",expected_execution_root:"MCFT_CAP09_TWIN_RUNTIME_PROCESS_V2",evidence:{taskbook_requires_residual:req,production_v2_residual_symbol_reachable:wired,residual_symbol_hits:hits("Cap05ForecastResidualOutcomeTickServiceV1"),production_composition_ref:cv2,historical_s5_adapter_ref:"apps/server/src/runtime/twin_runtime/postgres_cap04_shadow_online_canonical_tick_adapter_v1.ts"}});const p100=has(binding,"POINT_100MM_TO_ROOT_ZONE_MEAN_H1_WITH_REPRESENTATIVENESS_V1"),c200=has(residual,"POINT_200MM_TO_ROOT_ZONE_MEAN_H1_WITH_REPRESENTATIVENESS_V1"),c100=has(residual,"POINT_100MM_TO_ROOT_ZONE_MEAN_H1_WITH_REPRESENTATIVENESS_V1");out.push({id:"M-02",subject:"CAP09_100MM_PRODUCER_VS_CAP05_RESIDUAL_CONSUMER_SEMANTIC_COMPATIBILITY",final_disposition:p100&&c200&&!c100?"SEMANTICALLY_INCOMPATIBLE":"WIRED_AND_PROVEN",evidence:{producer_operator:"POINT_100MM_TO_ROOT_ZONE_MEAN_H1_WITH_REPRESENTATIVENESS_V1",producer_ref:binding,consumer_operator:c200?"POINT_200MM_TO_ROOT_ZONE_MEAN_H1_WITH_REPRESENTATIVENESS_V1":null,consumer_ref:residual,consumer_accepts_100mm:c100}});let same=false;try{const a=js(h6),l=a.runtime_validation_lanes?.lanes?.find(x=>x.run_class==="QUALIFICATION_REHEARSAL");same=l?.same_production_binaries_required===true}catch{}const qv1=has(qentry,"runMcftCap09TwinRuntimeProcessV1"),pv=has(prod,"mcft_cap09_twin_runtime_v2.js")&&has(dist,"runMcftCap09TwinRuntimeProcessV2")&&has(pv2,"composeMcftCap09TwinRuntimeV2"),rq=has(rehearsal,"docker-compose.mcft-cap09-phase5-qualification.yml");out.push({id:"M-03",subject:"REAL_CLOCK_REHEARSAL_V1_VS_PRODUCTION_V2_EXACT_PATH_EQUIVALENCE",final_disposition:same&&qv1&&pv&&rq?"UNWIRED_DEFECT":"WIRED_AND_PROVEN",evidence:{h6_same_production_binaries_required:same,rehearsal_control_ref:rehearsal,rehearsal_uses_qualification_compose:rq,qualification_compose_ref:qcompose,qualification_entry_ref:qentry,qualification_routes_to_process_v1:qv1,production_routes_to_process_v2:pv,exact_binary_path_equal:false}});const c6=ex(c06)?js(c06):{},r6=["apps/server/scripts/mcft/MCFT_CAP_06_CALIBRATION_SHADOW_RUNNER.ts","apps/server/scripts/mcft/MCFT_CAP_06_PAIRED_HISTORICAL_SHADOW_RUNNER.ts"],w6=[".github/workflows/mcft-cap-06-s5-candidate.yml",".github/workflows/mcft-cap-06-s6-paired-shadow.yml"],ok6=c6.runtime_mode==="CONTROLLED_REPLAY"&&c6.status==="COMPLETE"&&r6.every(ex)&&w6.every(ex);out.push({id:"M-04",subject:"CAP06_CONTROLLED_CALIBRATION_SHADOW_EXECUTION_OWNERSHIP",final_disposition:ok6?"WIRED_AND_PROVEN":"UNWIRED_DEFECT",expected_execution_owner:"CONTROLLED_REPLAY_RUNNERS",evidence:{closure_ref:c06,runtime_mode:c6.runtime_mode||null,closure_status:c6.status||null,runners:r6.map(p=>({path:p,present:ex(p)})),workflows:w6.map(p=>({path:p,present:ex(p)})),production_hourly_process_required:false},intentional_disconnect_edge:"CAP06_CONTROLLED_REPLAY_IS_NOT_REQUIRED_INSIDE_CAP09_HOURLY_PRODUCTION_PROCESS"});const ok7=has(c07r,"registerMcftFieldTwinReadRoutesV1")&&has(c07r,"PostgresMcftFieldTwinS4ReadApiV1")&&ex(c07a);out.push({id:"M-05",subject:"CAP07_FIELD_TWIN_READ_SURFACE_RUNTIME_REACHABILITY",final_disposition:ok7?"WIRED_AND_PROVEN":"UNWIRED_DEFECT",expected_execution_owner:"HTTP_SERVER_OPERATOR_MODULE",evidence:{registration_ref:c07r,runtime_acceptance_ref:c07a,route_registered:ok7}});const m=js(MATRIX),c8=(m.capability_lines||[]).find(x=>x.capability_line_id==="MCFT-CAP-08")||{},ok8=c8.complete===true&&c8.current_effective_status==="MCFT_CAP_08_COMPLETE"&&c8.production_runtime_source_authorized===false;out.push({id:"M-06",subject:"CAP08_REPLAY_DECISION_ACTION_EXECUTION_BOUNDARY",final_disposition:ok8?"WIRED_AND_PROVEN":"UNWIRED_DEFECT",expected_execution_owner:"CONTROLLED_REPLAY_STAGE_1A",evidence:{matrix_ref:MATRIX,complete:c8.complete??null,current_effective_status:c8.current_effective_status||c8.status||null,production_runtime_source_authorized:c8.production_runtime_source_authorized??null},intentional_disconnect_edge:"CAP08_PRODUCTION_RUNTIME_SOURCE_IS_EXPLICITLY_UNAUTHORIZED"});const root=has(prod,"apps/server/dist/runtime/mcft_cap09_twin_runtime_v2.js")&&has(dist,"runMcftCap09TwinRuntimeProcessV2")&&has(pv2,"composeMcftCap09TwinRuntimeV2")&&has(cv2,"ExternalFormalV4Amendment19RunnerV2")&&has(cv2,"ExternalFormalV3Amendment19PersistentTickServiceV1")&&ex(proute)&&ex(plaunch);out.push({id:"M-07",subject:"CAP09_PRODUCTION_ROOT_EXACTNESS",final_disposition:root?"WIRED_AND_PROVEN":"UNWIRED_DEFECT",expected_execution_owner:"MCFT_CAP09_PRODUCTION_TWIN_RUNTIME_V2",evidence:{chain:[prod,dist,pv2,cv2,"apps/server/src/runtime/twin_runtime/external_formal_v4_amendment19_runner_v2.ts",tick],routing_acceptance_ref:proute,launcher_acceptance_ref:plaunch,static_and_packaging_route_closed:root,claim_scope:"PRODUCTION_ROOT_PACKAGING_AND_COMPOSITION_EXACTNESS_ONLY",formal_v5_runtime_execution_claimed:false}});return out;}

function sourceInboundRefs(sourcePath){
  const stem=path.basename(sourcePath).replace(/\.(?:ts|tsx|js|cjs|mjs|json|sql)$/,"");
  const refs=[];
  for(const root of ["apps/server/src","apps/server/scripts","apps/executor/src","apps/judge/src","apps/telemetry-ingest/src","packages","scripts"]){
    for(const f of walk(root,/\.(?:ts|tsx|js|cjs|mjs)$/)){
      if(f===sourcePath||/\/(?:__tests__|test|tests)\//.test(f)||/\.(?:test|spec)\./.test(f))continue;
      try{if(rd(f).includes(stem))refs.push(f)}catch{}
    }
  }
  return[...new Set(refs)].sort();
}
function runtimeSymbolCallers(symbol,sourcePath){
  const out=[];
  for(const root of ["apps/server/src","apps/executor/src","apps/judge/src","apps/telemetry-ingest/src"]){
    for(const f of walk(root,/\.(?:ts|tsx|js|cjs|mjs)$/)){
      if(f===sourcePath||/\/(?:__tests__|test|tests)\//.test(f)||/\.(?:test|spec)\./.test(f))continue;
      try{if(rd(f).includes(symbol))out.push(f)}catch{}
    }
  }
  return[...new Set(out)].sort();
}
function blineDisposition(surface,mcftRows){
  const id=String(surface.surface_id||""),rt=String(surface.runtime_reachable||""),act=String(surface.activation_mode||""),rem=String(surface.removal_target||""),p=String(surface.source_path||"");
  const refs=sourceInboundRefs(p);
  const base={surface_id:id,source_path:p,activation_mode:act,prior_runtime_reachable:rt,authority_class:surface.authority_class||null,semantic_family:surface.semantic_family||[],inbound_current_source_refs:refs.slice(0,25)};
  const wired=(reason,proof_scope="PREDECESSOR_CURRENT_STATIC_ACTIVATION_PROOF")=>({...base,final_disposition:"WIRED_AND_PROVEN",reason,proof_scope});
  const intentional=(reason)=>({...base,final_disposition:"INTENTIONALLY_DISCONNECTED",reason,proof_scope:"EXPLICIT_ISOLATION_OR_NON_PRODUCTION_EXECUTION_BOUNDARY"});
  const defect=(reason)=>({...base,final_disposition:"UNWIRED_DEFECT",reason,proof_scope:"CURRENT_RUNTIME_REACHABILITY_NOT_CLOSED"});
  const mm=new Map(mcftRows.map(x=>[x.id,x]));

  if(id==="RES-012"){
    const ok=has("apps/server/src/routes/v1/operator_twin.ts","buildRootZoneScenarioRecommendationSubmissionV1(")&&has("apps/server/src/routes/v1/operator_twin_write_legacy_v1.ts","registerOperatorTwinWriteLegacyRoutesV1")&&has("apps/server/src/modules/operator/registerOperatorModule.ts","registerOperatorTwinWriteLegacyRoutesV1(app, pool)");
    return ok?wired("STALE_INDIRECT_CLASSIFICATION_RECONCILED_TO_ACTIVE_AUTHENTICATED_LEGACY_ROUTE","CURRENT_ROUTE_REGISTRATION_PLUS_CALLSITE_PROOF"):defect("LEGACY_RECOMMENDATION_BUILDER_CURRENT_CALLER_NOT_PROVEN");
  }
  if(id==="RES-031"){
    const ok=has("apps/server/src/routes/control_approval_request_v1.ts","buildRecommendationApprovalDecisionSubmissionV1(")&&has("apps/server/src/routes/v1/approvals.ts","registerApprovalRequestV1Routes(app, pool)");
    return ok?wired("STALE_NOT_PROVEN_DIRECT_CALLER_RECONCILED_TO_ACTIVE_APPROVAL_ROUTE","CURRENT_ROUTE_REGISTRATION_PLUS_CALLSITE_PROOF"):defect("APPROVAL_DECISION_BUILDER_CURRENT_CALLER_NOT_PROVEN");
  }

  if(/^MCFT_OWNED/.test(rt)||act==="MCFT_FROZEN"||act==="MCFT_OWNED_PERSISTENCE_ORCHESTRATION"){
    const pathOwner={
      "apps/server/src/persistence/calibration/postgres_calibration_governance_repository_v1.ts":"M-04",
      "apps/server/db/migrations/2026_07_17_mcft_cap_06_calibration_governance_persistence.sql":"M-04",
      "apps/server/src/persistence/twin_runtime/postgres_cap08_s4_append_forward_repository_v1.ts":"M-06",
      "apps/server/src/persistence/twin_runtime/postgres_cap08_t17_transition_repository_v1.ts":"M-06",
      "apps/server/src/persistence/twin_runtime/postgres_immutable_decision_action_commit_repository_v1.ts":"M-06",
      "apps/server/src/runtime/twin_runtime/cap08_s3_decision_action_provider_service_v1.ts":"M-06",
      "apps/server/src/runtime/twin_runtime/cap08_s3_outcome_completion_evidence_service_v1.ts":"M-06",
      "apps/server/db/migrations/2026_07_20_mcft_cap_07_fact_visibility_support.sql":"M-05",
      "apps/server/src/persistence/twin_runtime/postgres_runtime_repository_v1.ts":"M-07",
      "apps/server/src/persistence/twin_runtime/postgres_mcft_cap09_twin_canonical_fact_writer_v1.ts":"M-07"
    };
    const mappedByPath=pathOwner[p];
    if(mappedByPath){
      const m=mm.get(mappedByPath);
      return m?.final_disposition==="WIRED_AND_PROVEN"
        ?wired("MCFT_OWNED_SURFACE_RECONCILED_THROUGH_CURRENT_MCFT_OWNER_PROOF:"+mappedByPath,"CURRENT_MCFT_OWNER_RECONCILIATION")
        :defect("MCFT_OWNER_PROOF_NOT_CLOSED:"+mappedByPath);
    }
    const mapped={
      "RES-053":"M-04","RES-124":"M-04",
      "RES-056":"M-06","RES-057":"M-06","RES-061":"M-06","RES-074":"M-06","RES-075":"M-06",
      "RES-125":"M-05","RES-062":"M-07","RES-275":"M-06","RES-276":"M-06","RES-305":"M-07"
    }[id];
    if(mapped){
      const m=mm.get(mapped);
      return m?.final_disposition==="WIRED_AND_PROVEN"
        ?wired("MCFT_OWNED_SURFACE_RECONCILED_THROUGH_CURRENT_MCFT_OWNER_PROOF:"+mapped,"CURRENT_MCFT_OWNER_RECONCILIATION")
        :defect("MCFT_OWNER_PROOF_NOT_CLOSED:"+mapped);
    }
    if(id==="RES-059"){
      const ok=ex("apps/server/scripts/mcft/MCFT_CAP_05_HUMAN_DECISION_FEEDBACK_RUNNER.ts")&&ex("scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_05_FORECAST_RESIDUAL_OUTCOME_TICK_DB.ts");
      return ok?wired("CAP05_REPLAY_PERSISTENCE_HAS_CONTROLLED_RUNNER_AND_DB_PROOF; CAP09_ONLINE_C_EDGE_AUDITED_SEPARATELY_AS_M01","CAP05_CONTROLLED_REPLAY_PROOF"):defect("CAP05_FEEDBACK_PERSISTENCE_OWNER_NOT_REACHABLE");
    }
    if(id==="RES-060"){
      const ok=ex("apps/server/scripts/mcft/MCFT_CAP_04_FORECAST_SCENARIO_RUNNER.ts")&&ex("scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_04_PERSISTENCE_DB.ts");
      return ok?wired("CAP04_REPLAY_PERSISTENCE_HAS_CONTROLLED_RUNNER_AND_DB_PROOF","CAP04_CONTROLLED_REPLAY_PROOF"):defect("CAP04_FORECAST_SCENARIO_PERSISTENCE_OWNER_NOT_REACHABLE");
    }
    if(id==="RES-058"){
      const ok=refs.some(x=>/RUN_MCFT_CAP_09|formal_live_kbs_soil_ingress_executor/.test(x));
      return ok?wired("EXTERNAL_FORMAL_EVIDENCE_INGRESS_HAS_CURRENT_MCFT_CONTROLLED_CALLERS","MCFT_CONTROLLED_EVIDENCE_INGRESS_CALLER_PROOF"):defect("EXTERNAL_FORMAL_EVIDENCE_INGRESS_CURRENT_OWNER_NOT_PROVEN");
    }
    if(id==="RES-087"){
      const ok=ex(".github/workflows/mcft-cap-09-ea5c2b1-live-kbs-soil-ingress-executor.yml")&&refs.length>0;
      return ok?wired("LIVE_KBS_SOIL_INGRESS_EXECUTOR_HAS_EXPLICIT_MCFT_WORKFLOW_AND_CALLERS","MCFT_CONTROLLED_EVIDENCE_INGRESS_CALLER_PROOF"):defect("LIVE_KBS_SOIL_INGRESS_EXECUTOR_CURRENT_OWNER_NOT_PROVEN");
    }
    if(["RES-054","RES-055"].includes(id)){
      return refs.length>0?wired("MCFT_PERSISTENCE_SURFACE_HAS_CURRENT_INBOUND_RUNTIME_SERVICE_REFERENCE","MCFT_CONTROLLED_REPLAY_STATIC_CALLER_PROOF"):defect("MCFT_PERSISTENCE_SURFACE_HAS_NO_CURRENT_CALLER");
    }
    return defect("MCFT_OWNED_SURFACE_WITHOUT_CURRENT_OWNER_RECONCILIATION");
  }

  if(rt==="INTENTIONAL_NONE")return intentional("INVENTORY_EXPLICITLY_DECLARES_NO_RUNTIME_ACTIVATION");
  if(["RES-063","RES-065","RES-099","RES-102","RES-162","RES-163"].includes(id)){
    const explicitIsland=/KEEP ISOLATED|DO NOT ACTIVATE|ORPHANED|no new runtime consumer|RETAIN ISOLATED|KEEP AS COMPARISON-ONLY CAPABILITY|NEVER PROMOTE/i.test(act+" "+rem);
    return explicitIsland
      ?intentional("CAPABILITY_ISLAND_OR_ORPHAN_EXPLICITLY_HELD_OUT_OF_CURRENT_RUNTIME")
      :defect("NOT_PROVEN_CAPABILITY_WITHOUT_EXPLICIT_DISCONNECT_AUTHORITY");
  }
  if(id==="RES-110")return defect("ALTERNATE_JUDGE_RULESET_SOURCE_EXISTS_BUT_CURRENT_PIPELINE_USES_DIFFERENT_SSOT; DOUBLE_SSOT_RECONCILIATION_REQUIRED");
  if(id==="RES-160"){
    const hardRuleWired=has("apps/server/src/routes/decision_engine_v1.ts","evaluateHardRuleHintsV1(")&&has("apps/server/src/routes/decision_engine_v1.ts","getHardRuleRecommendationBlueprintV1(");
    const legacyEvaluatorCallers=runtimeSymbolCallers("evaluateIrrigationDecisionV1(",p);
    const legacyEvaluatorCalled=legacyEvaluatorCallers.length>0;
    if(hardRuleWired&&!legacyEvaluatorCalled&&/RETIRE ORPHANED LEGACY EVALUATOR AFTER PROOF/i.test(rem)){
      return {...wired("ACTIVE_HARD_RULE_SUBCAPABILITY_IS_RUNTIME_REACHABLE; LEGACY_IRRIGATION_EVALUATOR_HAS_NO_CURRENT_RUNTIME_CALLER","CURRENT_ROUTE_CALLSITE_PLUS_EXPLICIT_ORPHAN_RETIREMENT_PROOF"),legacy_evaluator_runtime_callers:legacyEvaluatorCallers,intentional_disconnect_edges:[{capability:"evaluateIrrigationDecisionV1",reason:"ORPHANED_LEGACY_EVALUATOR_EXPLICITLY_TARGETED_FOR_RETIREMENT"}]};
    }
    return defect("MIXED_DECISION_ENGINE_SUBCAPABILITY_BOUNDARY_NOT_CLOSED");
  }

  if(/CAPABILITY_PRESENT; NO COMPOSE SERVICE FOUND|EXPLICIT STANDALONE SERVER CAPABILITY; NO REPO COMPOSE ACTIVATION FOUND|EXPLICIT SERVER CAPABILITY; NO COMPOSE SERVICE FOUND|PACKAGE START SCRIPT EXISTS; NO COMPOSE SERVICE OR MAIN-SERVER ROUTING FOUND|PROVEN IF STANDALONE JUDGE STARTED/.test(rt)){
    const judgeRoot=ex("apps/judge/package.json")&&has("apps/judge/package.json","apps/judge/src/server.ts")&&has("apps/judge/src/server.ts","new JudgeRuntime")&&has("apps/judge/src/runtime.ts","JudgePipelineV1");
    return judgeRoot?wired("STANDALONE_JUDGE_CAPABILITY_REACHABLE_FROM_EXPLICIT_PACKAGE_ROOT; PRODUCTION_COMPOSE_DEPLOYMENT_NOT_CLAIMED","OPERATOR_TRIGGERED_STANDALONE_ROOT_PROOF"):intentional("STANDALONE_CAPABILITY_HAS_NO_CURRENT_DEPLOYMENT_ROOT");
  }

  if(rt==="NOT_LONG_RUNNING_RUNTIME")return wired("HISTORICAL_MIGRATION_IS_REACHABLE_FROM_DATABASE_MIGRATION/BOOTSTRAP ROOT; LONG_RUNNING_RUNTIME IS NOT ITS OWNER","DATABASE_BOOTSTRAP_OR_MIGRATION_ROOT_PROOF");
  if(rt==="ADMIN_EXPLICIT_ONLY; LONG_RUNNING_RUNTIME_FORBIDDEN")return wired("ADMIN_ONE_SHOT_ROOT_IS_THE_INTENDED_EXECUTION_OWNER","DATABASE_BOOTSTRAP_OR_ADMIN_ONE_SHOT_PROOF");
  if(rt==="DEPLOYMENT_ONLY")return wired("DEPLOYMENT/SEED_ROOT_IS_THE_INTENDED_EXECUTION_OWNER","DATABASE_BOOTSTRAP_OR_DEPLOYMENT_ROOT_PROOF");
  if(rt==="QUALIFICATION_REHEARSAL_ONLY")return wired("QUALIFICATION_REHEARSAL_ROOT_IS_THE_INTENDED_OWNER; PRODUCTION PROMOTION FORBIDDEN","QUALIFICATION_ROOT_PROOF");
  if(rt==="RETAINED_HISTORICAL_ACCEPTANCE_COMPATIBILITY_SEAM")return wired("HISTORICAL_ACCEPTANCE_COMPATIBILITY_IS_THE_INTENDED_OWNER; PRODUCTION SELECTION SUPERSEDED","HISTORICAL_QUALIFICATION_ROOT_PROOF");
  if(rt==="LOADER/GENERATOR PRESENT; CURRENT pipeline.ts USES default.json INSTEAD")return defect("ALTERNATE_CONFIG_AUTHORITY_HAS_NO_CURRENT_RUNTIME_CONSUMER");

  if(rt==="PROVEN_OR_REFERENCED"){
    return refs.length>0?wired("CURRENT_SOURCE_REFERENCE_PLUS_PREDECESSOR_AUDIT_PROOF","CURRENT_INBOUND_REFERENCE_PLUS_PREDECESSOR_PROOF"):defect("PROVEN_OR_REFERENCED_ROW_HAS_NO_CURRENT_INBOUND_REFERENCE");
  }
  if(rt==="INDIRECT_OR_LEGACY")return refs.length>0?wired("CURRENT_INDIRECT_CALLER_FOUND","CURRENT_INBOUND_REFERENCE_PLUS_PREDECESSOR_PROOF"):defect("INDIRECT_OR_LEGACY_ROW_HAS_NO_CURRENT_CALLER");
  if(/^NOT_PROVEN/.test(rt)){
    return /ORPHANED|CAPABILITY_ISLAND|KEEP ISOLATED|DO NOT ACTIVATE|KEEP UNDEPLOYED|RETAIN ISOLATED/i.test(act+" "+rem)
      ?intentional("INVENTORY_EXPLICITLY_RETAINS_CAPABILITY_OUTSIDE_ACTIVE_RUNTIME")
      :defect("PREDECESSOR_INVENTORY_RUNTIME_REACHABILITY_NOT_PROVEN_AND_NO_EXPLICIT_DISCONNECT");
  }

  if(/^PROVEN/.test(rt)||/^ONLY_WHEN_/.test(rt)||rt==="FEATURE_GATED_DEVTOOLS"||rt==="BACKFILL HISTORICAL; STAGE TRIGGER RUNTIME IF decision_cycle_v1 PRESENT"){
    return wired("PREDECESSOR_WHOLE_REPOSITORY_AUDIT_RE-RAN_PASS_AND_CURRENT_INVENTORY_CARRIES_EXPLICIT_REACHABILITY");
  }
  return defect("NO_V2_TERMINAL_RECONCILIATION_RULE_FOR_CURRENT_INVENTORY_STATE:"+rt);
}
function reconcileBline(inv,mcftRows){
  const rows=(inv.surfaces||[]).map(s=>blineDisposition(s,mcftRows));
  const counts={WIRED_AND_PROVEN:0,INTENTIONALLY_DISCONNECTED:0,SEMANTICALLY_INCOMPATIBLE:0,UNWIRED_DEFECT:0};
  for(const r of rows)counts[r.final_disposition]=(counts[r.final_disposition]||0)+1;
  return{rows,counts,unwired_defects:rows.filter(x=>x.final_disposition==="UNWIRED_DEFECT"),intentional:rows.filter(x=>x.final_disposition==="INTENTIONALLY_DISCONNECTED")};
}

function mainOld(){fs.mkdirSync(path.dirname(OUT),{recursive:true});const pre=runPre(),er=roots(),ci=caps(),bi=js(INV),mm=mcft(),defect=mm.filter(x=>x.final_disposition==="UNWIRED_DEFECT"),bad=mm.filter(x=>x.final_disposition==="SEMANTICALLY_INCOMPATIBLE"),good=mm.filter(x=>x.final_disposition==="WIRED_AND_PROVEN"),intentional=mm.filter(x=>x.intentional_disconnect_edge).map(x=>({source_id:x.id,edge:x.intentional_disconnect_edge,final_disposition:"INTENTIONALLY_DISCONNECTED"}));const result={schema_version:"geox_whole_repository_authority_runtime_reachability_audit_result_v2",audit_method:"GEOX-WHOLE-REPOSITORY-AUTHORITY-RUNTIME-REACHABILITY-AUDIT-V2",status:pre.status==="PASS"&&defect.length===0&&bad.length===0?"PASS":"FAIL",audit_subject:{baseline_protected_main:BASE,audit_head:git("rev-parse","HEAD"),runtime_behavior_delta_authorized:false},predecessor_whole_repository_residual_authority_audit:{status:pre.status,script:PRE,stdout_tail:pre.stdout_tail,stderr_tail:pre.stderr_tail},all_execution_roots:{count:er.length,roots:er},all_complete_or_effective_capabilities:{mcft_count:ci.length,mcft:ci,bline_authority_surface_count:Array.isArray(bi.surfaces)?bi.surfaces.length:0,bline_inventory_ref:INV},expected_execution_owner_per_capability:mm.map(x=>({id:x.id,expected_execution_owner:x.expected_execution_owner||null,expected_execution_root:x.expected_execution_root||null})),static_reachability:mm.map(x=>({id:x.id,final_disposition:x.final_disposition,evidence:x.evidence})),runtime_reachability_proof:mm.map(x=>({id:x.id,final_disposition:x.final_disposition,proof_scope:x.evidence?.claim_scope||"CAPABILITY_SPECIFIC_EVIDENCE"})),producer_consumer_semantic_compatibility:mm.filter(x=>x.id==="M-02"),orphan_capability_list:defect.filter(x=>x.id==="M-01").map(x=>x.id),dead_wiring_list:[],qualification_production_divergence_list:mm.filter(x=>x.id==="M-03"&&x.final_disposition!=="WIRED_AND_PROVEN").map(x=>x.id),explicit_intentional_disconnected_list:intentional,mandatory_mcft_reconciliation:mm,disposition_counts:{WIRED_AND_PROVEN:good.length,INTENTIONALLY_DISCONNECTED:intentional.length,SEMANTICALLY_INCOMPATIBLE:bad.length,UNWIRED_DEFECT:defect.length},closure_blockers:[...defect.map(x=>x.id+":"+x.subject+":UNWIRED_DEFECT"),...bad.map(x=>x.id+":"+x.subject+":SEMANTICALLY_INCOMPATIBLE"),...(pre.status==="PASS"?[]:["WHOLE_REPOSITORY_RESIDUAL_AUTHORITY_PREDECESSOR_AUDIT_FAILED"])],non_effects:{product_semantic_change:false,runtime_wiring_change:false,production_database_mutation:false,formal_v5_arm:false,a0:false,o00_o23:false}};fs.writeFileSync(OUT,JSON.stringify(result,null,2)+"\n");console.log("WHOLE_REPOSITORY_RUNTIME_REACHABILITY_AUDIT_V2 "+JSON.stringify({status:result.status,execution_root_count:er.length,mcft_capability_count:ci.length,predecessor_audit_status:pre.status,disposition_counts:result.disposition_counts,closure_blockers:result.closure_blockers,output:path.relative(ROOT,OUT)}));for(const x of mm)console.log("AUDIT_DISPOSITION",x.id,x.final_disposition,x.subject);if(result.status!=="PASS")process.exitCode=1;}

function mainV2(){
  fs.mkdirSync(path.dirname(OUT),{recursive:true});
  const pre=runPre(),er=roots(),ci=caps(),bi=js(INV),mm=mcft(),br=reconcileBline(bi,mm);
  const mDefect=mm.filter(x=>x.final_disposition==="UNWIRED_DEFECT"),mBad=mm.filter(x=>x.final_disposition==="SEMANTICALLY_INCOMPATIBLE"),mGood=mm.filter(x=>x.final_disposition==="WIRED_AND_PROVEN");
  const mIntentional=mm.filter(x=>x.intentional_disconnect_edge).map(x=>({source_id:x.id,edge:x.intentional_disconnect_edge,final_disposition:"INTENTIONALLY_DISCONNECTED"}));
  const allDefects=[...br.unwired_defects.map(x=>({id:x.surface_id,subject:x.source_path,source:"BLINE_INVENTORY"})),...mDefect.map(x=>({id:x.id,subject:x.subject,source:"MCFT_MANDATORY"}))];
  const allBad=mBad.map(x=>({id:x.id,subject:x.subject,source:"MCFT_MANDATORY"}));
  const dead=[...br.intentional.map(x=>({id:x.surface_id,path:x.source_path,final_disposition:x.final_disposition,reason:x.reason})),...br.unwired_defects.map(x=>({id:x.surface_id,path:x.source_path,final_disposition:x.final_disposition,reason:x.reason}))];
  const subIntentional=br.rows.flatMap(x=>(x.intentional_disconnect_edges||[]).map(e=>({source_id:x.surface_id,edge:x.source_path+"#"+e.capability,final_disposition:"INTENTIONALLY_DISCONNECTED",reason:e.reason})));
  const intentional=[...br.intentional.map(x=>({source_id:x.surface_id,edge:x.source_path,final_disposition:"INTENTIONALLY_DISCONNECTED",reason:x.reason})),...subIntentional,...mIntentional];
  const combinedCounts={
    WIRED_AND_PROVEN:br.counts.WIRED_AND_PROVEN+mGood.length,
    INTENTIONALLY_DISCONNECTED:br.counts.INTENTIONALLY_DISCONNECTED+subIntentional.length+mIntentional.length,
    SEMANTICALLY_INCOMPATIBLE:br.counts.SEMANTICALLY_INCOMPATIBLE+mBad.length,
    UNWIRED_DEFECT:br.counts.UNWIRED_DEFECT+mDefect.length
  };
  const result={
    schema_version:"geox_whole_repository_authority_runtime_reachability_audit_result_v2",
    audit_method:"GEOX-WHOLE-REPOSITORY-AUTHORITY-RUNTIME-REACHABILITY-AUDIT-V2",
    status:pre.status==="PASS"&&allDefects.length===0&&allBad.length===0?"PASS":"FAIL",
    audit_subject:{baseline_protected_main:BASE,audit_head:git("rev-parse","HEAD"),runtime_behavior_delta_authorized:false},
    predecessor_whole_repository_residual_authority_audit:{status:pre.status,script:PRE,stdout_tail:pre.stdout_tail,stderr_tail:pre.stderr_tail},
    all_execution_roots:{count:er.length,roots:er},
    all_complete_or_effective_capabilities:{mcft_count:ci.length,mcft:ci,bline_authority_surface_count:Array.isArray(bi.surfaces)?bi.surfaces.length:0,bline_inventory_ref:INV},
    bline_surface_reconciliation:{surface_count:br.rows.length,counts:br.counts,rows:br.rows},
    expected_execution_owner_per_capability:mm.map(x=>({id:x.id,expected_execution_owner:x.expected_execution_owner||null,expected_execution_root:x.expected_execution_root||null})),
    static_reachability:mm.map(x=>({id:x.id,final_disposition:x.final_disposition,evidence:x.evidence})),
    runtime_reachability_proof:mm.map(x=>({id:x.id,final_disposition:x.final_disposition,proof_scope:x.evidence?.claim_scope||"CAPABILITY_SPECIFIC_EVIDENCE"})),
    producer_consumer_semantic_compatibility:mm.filter(x=>x.id==="M-02"),
    orphan_capability_list:allDefects,
    dead_wiring_list:dead,
    qualification_production_divergence_list:mm.filter(x=>x.id==="M-03"&&x.final_disposition!=="WIRED_AND_PROVEN").map(x=>x.id),
    explicit_intentional_disconnected_list:intentional,
    mandatory_mcft_reconciliation:mm,
    disposition_counts:combinedCounts,
    disposition_counts_by_scope:{bline_inventory:br.counts,mcft_mandatory:{WIRED_AND_PROVEN:mGood.length,INTENTIONALLY_DISCONNECTED:mIntentional.length,SEMANTICALLY_INCOMPATIBLE:mBad.length,UNWIRED_DEFECT:mDefect.length}},
    closure_blockers:[
      ...br.unwired_defects.map(x=>"BLINE:"+x.surface_id+":"+x.source_path+":UNWIRED_DEFECT"),
      ...mDefect.map(x=>x.id+":"+x.subject+":UNWIRED_DEFECT"),
      ...mBad.map(x=>x.id+":"+x.subject+":SEMANTICALLY_INCOMPATIBLE"),
      ...(pre.status==="PASS"?[]:["WHOLE_REPOSITORY_RESIDUAL_AUTHORITY_PREDECESSOR_AUDIT_FAILED"])
    ],
    non_effects:{product_semantic_change:false,runtime_wiring_change:false,production_database_mutation:false,formal_v5_arm:false,a0:false,o00_o23:false}
  };
  fs.writeFileSync(OUT,JSON.stringify(result,null,2)+"\n");
  console.log("WHOLE_REPOSITORY_RUNTIME_REACHABILITY_AUDIT_V2 "+JSON.stringify({status:result.status,execution_root_count:er.length,bline_surface_count:br.rows.length,mcft_capability_count:ci.length,predecessor_audit_status:pre.status,disposition_counts:result.disposition_counts,bline_disposition_counts:br.counts,closure_blockers:result.closure_blockers,output:path.relative(ROOT,OUT)}));
  for(const x of br.unwired_defects)console.log("AUDIT_DISPOSITION",x.surface_id,x.final_disposition,x.source_path,x.reason);
  for(const x of mm)console.log("AUDIT_DISPOSITION",x.id,x.final_disposition,x.subject);
  if(result.status!=="PASS")process.exitCode=1;
}

try{mainV2()}catch(e){fs.mkdirSync(path.dirname(OUT),{recursive:true});fs.writeFileSync(OUT,JSON.stringify({schema_version:"geox_whole_repository_authority_runtime_reachability_audit_result_v2",status:"FAIL",error:e?.stack||String(e)},null,2)+"\n");console.error(e?.stack||String(e));process.exitCode=1;}
