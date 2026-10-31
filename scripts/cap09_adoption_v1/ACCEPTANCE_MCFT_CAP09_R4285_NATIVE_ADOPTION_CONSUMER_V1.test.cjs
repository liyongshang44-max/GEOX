'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto'),cp=require('node:child_process'),path=require('node:path');
const n=require('./MCFT_CAP09_R4285_NATIVE_ADOPTION_CONSUMER_V1.cjs');
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
const SOURCE='a'.repeat(40),BASE='b'.repeat(40),MERGE='c'.repeat(40),TREE='d'.repeat(40);
const ZIP=Buffer.from('test-only-native-zip-placeholder'),RAW=Buffer.from(JSON.stringify(fixture().machine));
function fixture(count=71){
 const qcp={checks:Array.from({length:count},(_,i)=>({check_id:i===66?n.CHECK:i===69?n.CURRENT_CHECK:i===70?'CAP09_R4285_HOST_EXACT_SOURCE_ADMISSION_V1':'DEFINITION_'+String(i).padStart(3,'0')})),dependency_resolvers:{NATIVE_OWNER:{kind:'EXACT_PATH_SET',paths:[
 'scripts/cap09_adoption_v1/MCFT_CAP09_R4285_CURRENT_SUBJECT_ADOPTION_V1.cjs',
 'scripts/cap09_adoption_v1/MCFT_CAP09_R4285_NATIVE_ADOPTION_CONSUMER_V1.cjs',
 'scripts/cap09_adoption_v1/ACCEPTANCE_MCFT_CAP09_R4285_NATIVE_ADOPTION_CONSUMER_V1.test.cjs',
 'scripts/cap09_adoption_v1/ACCEPTANCE_MCFT_CAP09_R4285_CURRENT_SUBJECT_ADOPTION_V1.test.cjs']}}};
 const machine={status:'PASS',head_sha:SOURCE,base_sha:BASE,stage:'SUCCESSOR_SUBJECT_PRE_MERGE',
  counts:{fail:0,unknown:0,forbidden:0,authority_errors:0,unknown_changed_paths:0,blocker_count:0,
   total_checks:count,pass:count-1,not_applicable:1},blockers:[],
  results:qcp.checks.map((x,i)=>({check_id:x.check_id,status:i===1?'NOT_APPLICABLE':'PASS',...(i===1?{reason_code:'EXACT_HISTORIC_SCOPE_NOT_REPLAYED'}:{})}))};
 return {qcp,machine};
}
const meta=()=>({repository:'liyongshang44-max/GEOX',pr_number:3750,base_sha:BASE,source_head_sha:SOURCE,
 subject_sha:MERGE,qcp_run_id:101,qcp_run_attempt:1,qcp_job_id:111,qcp_artifact_id:131,
 qcp_zip_sha256:sha(ZIP),qcp_raw_sha256:sha(RAW),ci_run_id:102,ci_run_attempt:1});
function nativeFixtures(){const d=meta();return {pr:{number:d.pr_number,merged:true,state:'closed',
 base:{sha:BASE},head:{sha:SOURCE,repo:{full_name:d.repository}},merge_commit_sha:MERGE},
 baseCommit:{sha:BASE},sourceCommit:{sha:SOURCE,tree:{sha:TREE}},
 mergeCommit:{sha:MERGE,tree:{sha:TREE},parents:[{sha:BASE},{sha:SOURCE}]},
 main:{object:{sha:MERGE}},qcpRun:{id:101,head_sha:SOURCE,run_attempt:1,event:'pull_request',
 name:'mcft-cap-09-qualification-control-plane-v1',path:'.github/workflows/mcft-cap-09-qualification-control-plane-v1.yml',
 status:'completed',conclusion:'success',pull_requests:[]},
 qcpJobs:{jobs:[{id:111,name:'applicability-and-blocker-inventory',conclusion:'success',started_at:'2026-10-30T07:00:00.000Z',completed_at:'2026-10-30T07:12:00.000Z'}]},
 qcpArtifacts:{artifacts:[{id:131,expired:false,name:'mcft-cap09-qualification-control-plane-'+SOURCE,
 digest:'sha256:'+sha(ZIP),created_at:'2026-10-30T07:06:00.000Z',workflow_run:{id:101,head_sha:SOURCE}}]},
 ciRun:{id:102,head_sha:SOURCE,run_attempt:1,name:'ci',path:'.github/workflows/ci.yml',event:'pull_request',status:'completed',conclusion:'success'}};}
function withProof(mutator=()=>{}){const f=fixture(),m=meta(),live=nativeFixtures();mutator({f,m,live});
 return n.verifyGitHubNativeProof(m,live,RAW,ZIP,f.qcp,()=>RAW);}
test('QCP67 original native source result remains independently exact',()=>{
 const f=fixture(67),s=n.checkQcp67(f.machine,f.qcp,SOURCE,BASE);
 assert.equal(s.checks,67);assert.equal(s.passed,66);assert.equal(s.na,1);});
test('normal source PR native QCP and CI + exact first-parent merge is proof only',()=>{
 let x=withProof();assert.equal(x.subject_sha,MERGE);assert.equal(x.source_qcp_only,true);});
test('new QCP71 exactly requires the successor Host check on qualified source SHA',()=>{
 const f=fixture();const pass=n.checkQcp71(f.machine,f.qcp,SOURCE,BASE);
 assert.equal(pass.checks,71);
 for(const update of [
  f=>{f.machine.results[70].status='NOT_APPLICABLE';f.machine.results[70].reason_code='historical';f.machine.counts.pass--;f.machine.counts.not_applicable++;},
  f=>{f.qcp.checks.pop();},
  f=>{f.machine.counts.unknown_changed_paths=1;},
  f=>{f.machine.head_sha=MERGE;}
 ]){
  const x=fixture();update(x);assert.throws(()=>n.checkQcp71(x.machine,x.qcp,SOURCE,BASE));
 }
});
test('historic QCP70 cannot be passed to QCP71 Adoption verification',()=>{
 const f=fixture(70);assert.throws(()=>n.checkQcp71(f.machine,f.qcp,SOURCE,BASE),/QCP71/);
});
test('QCP69 is not sufficient for exact QCP70 adoption',()=>{const f=fixture(70);f.qcp.checks.pop();assert.throws(()=>n.checkQcp70(f.machine,f.qcp,SOURCE,BASE),/QCP70_MANIFEST/);});
test('QCP70 green without new consumer source ownership does not qualify it',()=>{const f=fixture(70);delete f.qcp.dependency_resolvers;assert.throws(()=>n.checkQcp70(f.machine,f.qcp,SOURCE,BASE),/NEW_SOURCE_PATH_UNREGISTERED/);});
test('native QCP result not on source SHA is rejected',()=>{const f=fixture(70);f.machine.head_sha=MERGE;assert.throws(()=>n.checkQcp70(f.machine,f.qcp,SOURCE,BASE),/QCP_RAW/);});
test('native QCP result wrong base is rejected',()=>{const f=fixture(70);f.machine.base_sha=MERGE;assert.throws(()=>n.checkQcp70(f.machine,f.qcp,SOURCE,BASE),/WRONG_BASE/);});
test('new R4285 successor contract check not PASS is rejected',()=>{const f=fixture(70);f.machine.results[69].status='NOT_APPLICABLE';f.machine.results[69].reason_code='non-applicable';f.machine.counts.pass--;f.machine.counts.not_applicable++;assert.throws(()=>n.checkQcp70(f.machine,f.qcp,SOURCE,BASE),/QCP70_CONTRACT_CHECK_NOT_PASS/);});
test('zero missing and exact check set are mandatory',()=>{const f=fixture(70);f.machine.results[3].check_id='unregistered';assert.throws(()=>n.checkQcp70(f.machine,f.qcp,SOURCE,BASE),/CHECK_ID/);});
test('unknown paths and unresolved counts fail closed',()=>{const f=fixture(70);f.machine.counts.unknown_changed_paths=1;assert.throws(()=>n.checkQcp70(f.machine,f.qcp,SOURCE,BASE),/UNRESOLVED/);});
test('missing NOT_APPLICABLE reason fails closed',()=>{const f=fixture(70);delete f.machine.results[1].reason_code;assert.throws(()=>n.checkQcp70(f.machine,f.qcp,SOURCE,BASE),/NA_WITHOUT_REASON/);});
test('merging wrong tree cannot inherit QCP source evidence',()=>assert.throws(()=>withProof(({live})=>live.mergeCommit.tree.sha='e'.repeat(40)),/MERGE_TREE/));
test('merge with wrong parents cannot inherit native QCP',()=>assert.throws(()=>withProof(({live})=>live.mergeCommit.parents=[{sha:SOURCE},{sha:BASE}]),/MERGE_PARENTS/));
test('current main moved cannot claim exact-current Subject',()=>assert.throws(()=>withProof(({live})=>live.main.object.sha='e'.repeat(40)),/LIVE_MAIN/));
test('unmerged PR cannot impersonate qualified source',()=>assert.throws(()=>withProof(({live})=>live.pr.merged=false),/PR_NOT_MERGED/));
test('wrong GitHub PR identity fails closed',()=>assert.throws(()=>withProof(({live})=>live.pr.number=3751),/PR_NOT_MERGED/));
test('QCP run not green fails closed',()=>assert.throws(()=>withProof(({live})=>live.qcpRun.conclusion='failure'),/QCP_RUN_NOT_GREEN/));
test('wrong GitHub QCP artifact digest fails closed',()=>assert.throws(()=>withProof(({live})=>live.qcpArtifacts.artifacts[0].digest='sha256:'+'e'.repeat(64)),/ARTIFACT_DIGEST/));
test('wrong GitHub QCP artifact origin fails closed',()=>assert.throws(()=>withProof(({live})=>live.qcpArtifacts.artifacts[0].workflow_run.head_sha=MERGE),/deepEqual|Expected values to be strictly equal/));
test('CI workflow path and PR event are immutable provenance',()=>assert.throws(()=>withProof(({live})=>live.ciRun.path='.github/workflows/untrusted.yml'),/CI_WRONG_PATH/));
test('QCP artifact must originate inside exact qualified job interval',()=>assert.throws(()=>withProof(({live})=>live.qcpArtifacts.artifacts[0].created_at='2026-10-30T09:00:00.000Z'),/ARTIFACT_NOT_FROM_QUALIFIED_JOB/));
test('CI success is independent and required',()=>assert.throws(()=>withProof(({live})=>live.ciRun.conclusion='failure'),/CI_NOT_GREEN/));
test('raw source must be bytes inside original GitHub artifact ZIP',()=>{const f=fixture();assert.throws(()=>n.verifyGitHubNativeProof(meta(),nativeFixtures(),RAW,ZIP,f.qcp,()=>Buffer.from('fake')),/RAW_NOT_IN_GITHUB/);});
test('raw bytes and artifact ZIP digests are both required',()=>{const f=fixture();assert.throws(()=>n.verifyGitHubNativeProof(meta(),nativeFixtures(),RAW,Buffer.from('changed'),f.qcp,()=>RAW),/ZIP_CHANGED/);});
test('no caller-provided prequalification status may skip genuine Host inputs',()=>assert.throws(()=>n.checkInput({source_root:'C:\\tmp',verified:true}),/INPUT_FIELDS/));
test('no arbitrary unchecked digest accepted',()=>{const obj=Object.fromEntries(n.INPUT_FIELDS.map(k=>[k,k.endsWith('_sha256')?'z'.repeat(64):path.resolve(process.cwd(),'synthetic-file')]));assert.throws(()=>n.checkInput(obj),/DIGEST/);});
test('non-Windows CLI always rejects --execute before any I/O',()=>{const p=cp.spawnSync(process.execPath,[path.join(__dirname,'MCFT_CAP09_R4285_NATIVE_ADOPTION_CONSUMER_V1.cjs'),'--execute'],{encoding:'utf8'});if(process.platform!=='win32'){assert.notEqual(p.status,0);const o=JSON.parse(p.stderr.trim());assert.equal(o.permit_issued,false);assert.equal(o.execution_authorized,false);}});
test('module has no signing, Permit issuing, consumption, child dispatch or execution entrypoint',()=>{
 for(const k of Object.keys(n))assert(!/sign[A-Z]|issue|consume|dispatch|execute|provision/i.test(k),k);
});
test('historical 67-check proof cannot be substituted for QCP70 native adoption',()=>{const f=fixture(67);const raw=Buffer.from(JSON.stringify(f.machine));assert.throws(()=>n.verifyGitHubNativeProof(meta(),nativeFixtures(),raw,ZIP,f.qcp,()=>raw));});
