const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process');
const BASE='a6d39df6af46ecfbf8e4ae99e48f400e00685875';
const ARTIFACT='docs/architecture/semantic_convergence/GEOX-BLINE-W6A-EXACT-PREDECESSOR-SELECTION-V1.json';
const PLANNER='apps/server/src/domain/planner/compiler_v1.ts';
const CROP='apps/server/src/domain/crop/crop_context_v1.ts';
const PROGRAMS='apps/server/src/routes/programs_core_v1.ts';
const CROP_HOOK='apps/server/src/routes/field_crop_context_hooks_v1.ts';
const REPORT_HOOK='apps/server/src/routes/field_report_semantics_hook_v1.ts';
const W5_ACCEPTED=BASE;
const W5_GATE='scripts/governance_acceptance/ACCEPTANCE_BLINE_W5_LEGACY_RUNTIME_CONTAINMENT_V1.cjs';
function sh(args,opts={}){return cp.execFileSync('git',['-c','core.quotepath=false',...args],{encoding:'utf8',...opts}).trim();}
function read(p){return fs.readFileSync(p,'utf8');}
function json(p){return JSON.parse(read(p));}
function assert(c,m,d){if(!c)throw new Error(m+(d===undefined?'':': '+JSON.stringify(d)));}
function lines(s){return s.split(/\r?\n/).filter(Boolean).sort();}
const head=sh(['rev-parse','HEAD']);
try{cp.execFileSync('git',['merge-base','--is-ancestor',BASE,head],{stdio:'ignore'});}catch{throw new Error(`W6-A head is not descended from exact authority base: ${head}`);}

const inv=json(ARTIFACT);
assert(inv.version==='GEOX_BLINE_W6A_EXACT_PREDECESSOR_SELECTION_V1','W6-A artifact version drift');
assert(inv.status==='FROZEN_BOUNDED_WORKSTREAM_INVENTORY','W6-A artifact status drift');
assert(inv.authority_base===BASE,'W6-A authority base drift',inv.authority_base);
assert(inv.blocker_count===2&&Array.isArray(inv.blockers)&&inv.blockers.length===2,'W6-A blocker count drift');
assert(JSON.stringify(inv.blockers.map(x=>x.id).sort())===JSON.stringify(['CROP-LATEST-01','PLANNER-LATEST-01']),'W6-A exact blocker set drift');
assert(String(inv.discovery_policy).includes('BOUNDED_DIRECT_CALLER_IMPORT_TRAVERSAL_FROM_TWO_FROZEN_ROOTS_ONLY'),'W6-A bounded traversal policy missing');
assert(String(inv.discovery_policy).includes('NO_WHOLE_REPOSITORY_DISCOVERY'),'W6-A whole-repository prohibition missing');
const byId=new Map(inv.blockers.map(x=>[x.id,x]));
assert(byId.get('PLANNER-LATEST-01')?.root===PLANNER,'planner root drift');
assert(JSON.stringify((byId.get('PLANNER-LATEST-01')?.direct_callers||[]).sort())===JSON.stringify([PROGRAMS]),'planner direct caller boundary drift');
assert(byId.get('CROP-LATEST-01')?.root===CROP,'crop root drift');
assert(JSON.stringify((byId.get('CROP-LATEST-01')?.direct_callers||[]).sort())===JSON.stringify([CROP_HOOK,REPORT_HOOK].sort()),'crop direct caller boundary drift');

const plannerRefs=lines(sh(['grep','-l','compileProgramActionsV1','--','apps/server/src']));
assert(JSON.stringify(plannerRefs)===JSON.stringify([PLANNER,PROGRAMS].sort()),'planner caller/import boundary expanded',plannerRefs);
const cropRefs=lines(sh(['grep','-l','resolveCropContextV1','--','apps/server/src']));
assert(JSON.stringify(cropRefs)===JSON.stringify([CROP,CROP_HOOK,REPORT_HOOK].sort()),'crop caller/import boundary expanded',cropRefs);

const planner=read(PLANNER),crop=read(CROP),programs=read(PROGRAMS),cropHook=read(CROP_HOOK);
for(const marker of ['PlannerPredecessorAmbiguityError','stableProgramLineageRoot','same program_id resolves to multiple stable program lineage roots','multiple acceptance histories','act_task_id','multiple versions of the same SLA name'])
  assert(planner.includes(marker),'planner exact/ambiguous selector marker missing',marker);
assert(!planner.includes('loadLatestPayloadByType'),'planner legacy latest selector helper remains');
assert(!/ORDER BY occurred_at DESC, fact_id DESC\s+LIMIT 1/.test(planner),'planner predecessor still selected by latest timestamp LIMIT 1');
for(const marker of ['CropContextResolutionStatusV1','PARENT_PROGRAM','MULTIPLE_SEASONS','CONFLICTING_PROGRAM_CONTEXT','UNIQUE_DECLARED_SEASON','UNIQUE_PROGRAM_SEASON'])
  assert(crop.includes(marker),'crop exact-season resolver marker missing',marker);
assert(!/ORDER BY occurred_at DESC\s+LIMIT 1/.test(crop),'crop resolver still performs cross-season latest LIMIT 1');
assert(crop.includes('allow_crop_specific_diagnosis: false')&&crop.includes('allow_crop_specific_prescription: false'),'crop ambiguity must fail closed crop-specific actions');
assert(cropHook.includes('resolveCropContextV1(pool, tenant, field_id, season_id, { program_id })'),'recommendation crop hook does not carry existing parent program identity');
assert(cropHook.includes('resolveCropContextV1(pool, tenant, field_id, text(rec.season_id), { program_id: text(rec.program_id) })'),'prescription crop hook does not carry persisted parent program identity');
assert(programs.includes('PlannerPredecessorAmbiguityError'),'planner route ambiguity type not wired');
assert(programs.includes('reply.status(409)'),'planner ambiguity route must fail closed with conflict response');
assert(!programs.includes('error: "PLANNER_PREDECESSOR_AMBIGUOUS"'),'route must use the typed compiler ambiguity error rather than duplicate selector authority');

const allowed=new Set([
  ARTIFACT,
  PLANNER,
  CROP,
  CROP_HOOK,
  PROGRAMS,
  'scripts/governance_acceptance/ACCEPTANCE_BLINE_W6A_EXACT_PREDECESSOR_SELECTION_V1.cjs',
  'scripts/runtime_acceptance/ACCEPTANCE_BLINE_W6A_EXACT_PREDECESSOR_SELECTION_V1.ts',
  'scripts/runtime_acceptance/ACCEPTANCE_BLINE_W6A_COMMERCIAL_EXACT_PREDECESSOR_SELECTION_V1.ts',
  '.github/workflows/bline-w6a-exact-predecessor-selection.yml'
]);
const changed=lines(sh(['diff','--name-only',BASE,'HEAD']));
for(const p of changed)assert(allowed.has(p),'W6-A scope expansion',p);
for(const p of changed)assert(!/mcft/i.test(p),'W6-A touched MCFT path',p);
for(const p of changed)assert(!/(docker-compose|mqtt|database_platform|action_qualification)/i.test(p),'W6-A entered forbidden W6-B/Action Qualification path',p);
for(const p of [
  'apps/server/src/routes/control_approval_request_v1.ts',
  'apps/server/src/routes/prescriptions_v1.ts',
  'apps/server/src/routes/v1/operator_approval_actions.ts',
  'apps/server/src/routes/control_ao_act.ts',
  'apps/server/src/domain/controlplane/task_service.ts',
  'apps/executor/src/runtime_loop.ts',
  'apps/executor/src/run_dispatch_once.ts'
])assert(!changed.includes(p),'W6-A reopened Recommendation/Approval/Execution authority',p);

const w5Protected=[
  '.github/workflows/bline-w5-legacy-runtime-containment.yml',
  'apps/server/src/app.ts',
  'apps/server/src/runtime/legacy_runtime_containment_v1.ts',
  'docs/architecture/semantic_convergence/GEOX-BLINE-W5-LEGACY-RUNTIME-CONTAINMENT-V1.json',
  'scripts/governance_acceptance/ACCEPTANCE_BLINE_W4_EXECUTION_DEVICE_RECEIPT_PROVENANCE_V1.cjs',
  'scripts/governance_acceptance/ACCEPTANCE_BLINE_W5_LEGACY_RUNTIME_CONTAINMENT_V1.cjs',
  'scripts/runtime_acceptance/ACCEPTANCE_BLINE_W5_COMMERCIAL_LEGACY_RUNTIME_CONTAINMENT_V1.ts',
  'scripts/runtime_acceptance/ACCEPTANCE_BLINE_W5_LEGACY_RUNTIME_CONTAINMENT_V1.ts'
];
const w5Drift=lines(sh(['diff','--name-only',W5_ACCEPTED,'HEAD','--',...w5Protected]));
assert(w5Drift.length===0,'W5 accepted source/artifact drift in W6-A',w5Drift);
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'geox-w5-accepted-'));
try{
  cp.execFileSync('git',['worktree','add','--detach',tmp,W5_ACCEPTED],{stdio:'ignore'});
  cp.execFileSync(process.execPath,[W5_GATE],{cwd:tmp,stdio:'inherit'});
}finally{
  try{cp.execFileSync('git',['worktree','remove','--force',tmp],{stdio:'ignore'});}catch{}
  try{fs.rmSync(tmp,{recursive:true,force:true});}catch{}
}

console.log(JSON.stringify({
  result:'PASS',
  workstream:'W6A_EXACT_PLANNER_CROP_PREDECESSOR_SELECTION',
  authority_base:BASE,
  head,
  blocker_ids:['PLANNER-LATEST-01','CROP-LATEST-01'],
  caller_boundary:{planner:[PLANNER,PROGRAMS],crop:[CROP,CROP_HOOK,REPORT_HOOK]},
  w5_successor_preserved:true,
  w5_historical_exact_head_gate_replayed:true,
  changed_files:changed,
  mcft_delta:0
},null,2));
