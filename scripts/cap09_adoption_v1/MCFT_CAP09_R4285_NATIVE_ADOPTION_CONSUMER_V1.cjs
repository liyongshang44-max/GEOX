'use strict';
/* GEOX MCFT R4285: independent native current-subject Adoption consumer.
 * READ ONLY. Never signs, grants Permit, initializes children, or dispatches.
 * Requires actual GitHub current-main source QCP, registered installed material,
 * an independently signed inventory/ordinal Owner review, and R4285 Lineage.
 * Source QCP is a source-head run; exact merge identity is a separate proof.
 */
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),crypto=require('node:crypto');
const REPO='liyongshang44-max/GEOX',RUN='4285c3ce342c',HOST='LAPTOP-STN2A2P1';
const CHECK='CAP09_R4285_NATIVE_ADOPTION_CONSUMER_SOURCE_ONLY_V1';
const QCP_PATH='docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-QUALIFICATION-CONTROL-PLANE-V1.json';
const TRUST_PATH='scripts/runtime_acceptance/MCFT_CAP09_RETRY_TRUST_V1.json';
const NATIVE_FULLCHAIN='scripts/governance_acceptance/MCFT_CAP09_NONAUTHORIZED_FULL_CHAIN_PROOF_GATE_V1.cjs';
const SHA=/^[0-9a-f]{64}$/,HEAD=/^[0-9a-f]{40}$/;
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
function exact(obj,fields,code){assert(obj&&typeof obj==='object'&&!Array.isArray(obj),code);assert.deepEqual(Object.keys(obj).sort(),fields.slice().sort(),code)}
function readRegular(file,limit=16*1024*1024){
 assert(typeof file==='string'&&path.isAbsolute(file),'R4285_NATIVE_ABSOLUTE_FILE_REQUIRED');
 let p=path.resolve(file),end=p;
 for(;;){let s=fs.lstatSync(p);assert(!s.isSymbolicLink(),'R4285_NATIVE_SYMLINK_FORBIDDEN');
  if(p===end)assert(s.isFile()&&s.size>0&&s.size<=limit,'R4285_NATIVE_REGULAR_FILE_REQUIRED');
  let par=path.dirname(p);if(par===p)break;p=par;
 }
 return fs.readFileSync(file);
}
function readJson(file){return JSON.parse(readRegular(file).toString('utf8').replace(/^\uFEFF/,''))}
function readRootFile(root,relative){
 assert(path.isAbsolute(root)&&typeof relative==='string'&&relative.split('/').every(x=>/^[A-Za-z0-9_.-]+$/.test(x)&&x!=='.'&&x!=='..'),'R4285_NATIVE_REPOSITORY_FILE');
 return readRegular(path.join(root,...relative.split('/')));
}
function gitExactMain(root,subject){
 assert(path.isAbsolute(root)&&HEAD.test(subject),'R4285_NATIVE_GIT_ARGS');
 const git=(...args)=>cp.execFileSync('git',['-C',root,...args],{encoding:'utf8',timeout:20000,maxBuffer:1048576,windowsHide:true}).trim();
 assert.equal(git('rev-parse','HEAD'),subject,'R4285_NATIVE_GIT_HEAD');
 assert.equal(git('status','--porcelain','--untracked-files=all'),'','R4285_NATIVE_GIT_DIRTY');
 assert.equal(git('ls-remote','origin','refs/heads/main').split('\t')[0],subject,'R4285_NATIVE_REMOTE_MAIN_CHANGED');
 return true;
}
function checkQcp67(machine,definitions,sourceHead,baseHead){
 assert(HEAD.test(sourceHead)&&HEAD.test(baseHead)&&sourceHead!==baseHead,'R4285_QCP_SOURCE_ID');
 assert(machine?.status==='PASS'&&machine.head_sha===sourceHead,'R4285_QCP_RAW_NOT_SOURCE_PASS');
 assert(machine.base_sha===baseHead&&machine.stage==='SUCCESSOR_SUBJECT_PRE_MERGE','R4285_QCP_WRONG_BASE_STAGE');
 const counts=machine.counts||{};
 for(const key of ['fail','unknown','forbidden','authority_errors','unknown_changed_paths','blocker_count'])
  assert.equal(counts[key],0,'R4285_QCP_UNRESOLVED:'+key);
 assert.equal(counts.total_checks,67,'R4285_QCP67_REQUIRED');
 assert.equal(counts.pass+counts.not_applicable,67,'R4285_QCP67_COUNTS_INCOMPLETE');
 assert.deepEqual(machine.blockers,[],'R4285_QCP_BLOCKERS');
 assert(Array.isArray(definitions?.checks)&&definitions.checks.length===67,'R4285_QCP67_MANIFEST_REQUIRED');
 const expected=new Set(definitions.checks.map(x=>x.check_id));
 assert.equal(expected.size,67,'R4285_QCP_DEFINITION_DUPLICATED');
 assert(expected.has(CHECK),'R4285_QCP_R4285_NATIVE_CHECK_REQUIRED');
 // A green historical QCP67 cannot qualify newly added adoption code unless
 // the CURRENT QCP authority manifest actually owns its precise source paths.
 const owned=new Set(Object.values(definitions.dependency_resolvers||{}).flatMap(r=>
  r&&r.kind==='EXACT_PATH_SET'&&Array.isArray(r.paths)?r.paths:[]));
 for(const p of [
  'scripts/cap09_adoption_v1/MCFT_CAP09_R4285_CURRENT_SUBJECT_ADOPTION_V1.cjs',
  'scripts/cap09_adoption_v1/MCFT_CAP09_R4285_NATIVE_ADOPTION_CONSUMER_V1.cjs',
  'scripts/cap09_adoption_v1/ACCEPTANCE_MCFT_CAP09_R4285_NATIVE_ADOPTION_CONSUMER_V1.test.cjs',
  'scripts/cap09_adoption_v1/ACCEPTANCE_MCFT_CAP09_R4285_CURRENT_SUBJECT_ADOPTION_V1.test.cjs'])
  assert(owned.has(p),'R4285_QCP_ADOPTION_NEW_SOURCE_PATH_UNREGISTERED:'+p);
 assert(Array.isArray(machine.results)&&machine.results.length===67,'R4285_QCP67_RESULTS_REQUIRED');
 const observed=new Set();let passed=0,na=0;
 for(const r of machine.results){
  assert(r&&expected.has(r.check_id)&&!observed.has(r.check_id),'R4285_QCP_CHECK_ID_UNKNOWN_OR_DUPLICATE');
  observed.add(r.check_id);assert(['PASS','NOT_APPLICABLE'].includes(r.status),'R4285_QCP_UNRESOLVED_STATUS');
  if(r.status==='PASS')passed++;
  else {na++;assert(typeof r.reason_code==='string'&&r.reason_code.length>0,'R4285_QCP_NA_WITHOUT_REASON')}
  if(r.check_id===CHECK)assert.equal(r.status,'PASS','R4285_QCP_CURRENT_SIGNED_EVIDENCE_CHECK_NOT_PASS');
 }
 assert.equal(passed,counts.pass);assert.equal(na,counts.not_applicable);
 assert.deepEqual([...observed].sort(),[...expected].sort());
 return Object.freeze({status:'NATIVE_QCP67_SOURCE_MACHINE_VERIFIED_NOT_MERGE_HEAD_RUN',source_head:sourceHead,checks:67,passed,na});
}
function nativeGithubGet(urlPath){
 assert(/^\/(?:pulls\/[1-9]\d*|git\/commits\/[0-9a-f]{40}|git\/ref\/heads\/main|actions\/runs\/[1-9]\d*(?:\/attempts\/[1-9]\d*\/jobs\?per_page=100|\/artifacts\?per_page=100)?)$/.test(urlPath),'R4285_GITHUB_ENDPOINT_NOT_ALLOWED');
 const curl=process.platform==='win32'?'curl.exe':'curl';
 const s=cp.execFileSync(curl,['--fail','--silent','--show-error','--location','--max-time','20',
 '-H','Accept: application/vnd.github+json','-H','X-GitHub-Api-Version: 2022-11-28',
 'https://api.github.com/repos/'+REPO+urlPath],{encoding:'utf8',timeout:25000,maxBuffer:4*1024*1024,windowsHide:true});
 return JSON.parse(s);
}
function verifyGitHubNativeProof(meta,live,raw,zip,definitions,zipRaw){
 exact(meta,['repository','pr_number','base_sha','source_head_sha','subject_sha',
  'qcp_run_id','qcp_run_attempt','qcp_job_id','qcp_artifact_id','qcp_zip_sha256','qcp_raw_sha256',
  'ci_run_id','ci_run_attempt'],'R4285_NATIVE_PROOF_FIELDS');
 assert.equal(meta.repository,REPO);assert(HEAD.test(meta.source_head_sha)&&HEAD.test(meta.subject_sha)&&HEAD.test(meta.base_sha));
 assert(Number.isSafeInteger(meta.pr_number)&&meta.pr_number>0);
 for(const k of ['qcp_run_id','qcp_run_attempt','qcp_job_id','qcp_artifact_id','ci_run_id','ci_run_attempt'])
  assert(Number.isSafeInteger(meta[k])&&meta[k]>0,'R4285_NATIVE_PR_ID:'+k);
 assert(SHA.test(meta.qcp_zip_sha256)&&SHA.test(meta.qcp_raw_sha256));
 const {pr,baseCommit,sourceCommit,mergeCommit,main,qcpRun,qcpJobs,qcpArtifacts,ciRun}=live;
 assert(pr?.number===meta.pr_number&&pr.state==='closed'&&pr.merged===true,'R4285_NATIVE_PR_NOT_MERGED');
 assert.equal(pr.base?.sha,meta.base_sha,'R4285_NATIVE_PR_BASE_MISMATCH');
 assert.equal(pr.head?.sha,meta.source_head_sha,'R4285_NATIVE_PR_HEAD_MISMATCH');
 assert.equal(pr.head?.repo?.full_name,REPO,'R4285_NATIVE_PR_REPO');
 assert.equal(pr.merge_commit_sha,meta.subject_sha,'R4285_NATIVE_MERGE_SHA');
 assert.equal(baseCommit?.sha,meta.base_sha);assert.equal(sourceCommit?.sha,meta.source_head_sha);
 assert.equal(mergeCommit?.sha,meta.subject_sha);
 assert.deepEqual(mergeCommit.parents?.map(x=>x.sha),[meta.base_sha,meta.source_head_sha],
  'R4285_NATIVE_MERGE_PARENTS_NOT_EXACT');
 assert.equal(sourceCommit.tree?.sha,mergeCommit.tree?.sha,'R4285_NATIVE_MERGE_TREE_NOT_EXACT_SOURCE');
 assert.equal(main?.object?.sha,meta.subject_sha,'R4285_NATIVE_LIVE_MAIN_CHANGED');
 assert.equal(qcpRun?.id,meta.qcp_run_id);assert.equal(qcpRun.head_sha,meta.source_head_sha);
 assert.equal(qcpRun.run_attempt,meta.qcp_run_attempt);
 assert.equal(qcpRun.event,'pull_request');assert.equal(qcpRun.name,'mcft-cap-09-qualification-control-plane-v1');
 assert.equal(qcpRun.path,'.github/workflows/mcft-cap-09-qualification-control-plane-v1.yml');
 assert.equal(qcpRun.status,'completed');assert.equal(qcpRun.conclusion,'success','R4285_NATIVE_QCP_RUN_NOT_GREEN');
 assert(Array.isArray(qcpRun.pull_requests),'R4285_NATIVE_QCP_PR_ASSOCIATIONS');
 if(qcpRun.pull_requests.length)assert(qcpRun.pull_requests.some(p=>p.number===meta.pr_number),
  'R4285_NATIVE_QCP_WRONG_PR');
 const job=qcpJobs?.jobs?.find(j=>j.id===meta.qcp_job_id);
 assert(job&&job.name==='applicability-and-blocker-inventory'&&job.conclusion==='success',
  'R4285_NATIVE_QCP_JOB_NOT_GREEN');
 const artifact=qcpArtifacts?.artifacts?.find(a=>a.id===meta.qcp_artifact_id);
 assert(artifact&&!artifact.expired&&artifact.name==='mcft-cap09-qualification-control-plane-'+meta.source_head_sha,
  'R4285_NATIVE_ARTIFACT_NOT_CURRENT');
 assert.equal(artifact.digest,'sha256:'+meta.qcp_zip_sha256,'R4285_NATIVE_ARTIFACT_DIGEST');
 assert.equal(artifact.workflow_run?.id,qcpRun.id);
 assert.equal(artifact.workflow_run?.head_sha,meta.source_head_sha);
 const jobStart=Date.parse(job.started_at),jobEnd=Date.parse(job.completed_at),artifactCreated=Date.parse(artifact.created_at);
 assert([jobStart,jobEnd,artifactCreated].every(Number.isFinite)&&
  jobStart<=artifactCreated&&artifactCreated<=jobEnd,'R4285_NATIVE_QCP_ARTIFACT_NOT_FROM_QUALIFIED_JOB');
 assert.equal(ciRun?.id,meta.ci_run_id);assert.equal(ciRun.head_sha,meta.source_head_sha);
 assert.equal(ciRun.run_attempt,meta.ci_run_attempt);assert.equal(ciRun.status,'completed');
 assert.equal(ciRun.conclusion,'success','R4285_NATIVE_CI_NOT_GREEN');
 assert.equal(ciRun.name,'ci','R4285_NATIVE_CI_WRONG_WORKFLOW');
 assert.equal(ciRun.path,'.github/workflows/ci.yml','R4285_NATIVE_CI_WRONG_PATH');
 assert.equal(ciRun.event,'pull_request','R4285_NATIVE_CI_WRONG_EVENT');
 assert(Buffer.isBuffer(raw)&&Buffer.isBuffer(zip),'R4285_NATIVE_QCP_RAW_ZIP_REQUIRED');
 assert.equal(sha(raw),meta.qcp_raw_sha256,'R4285_NATIVE_RAW_CHANGED');
 assert.equal(sha(zip),meta.qcp_zip_sha256,'R4285_NATIVE_ZIP_CHANGED');
 assert(typeof zipRaw==='function'&&zipRaw(zip).equals(raw),'R4285_NATIVE_RAW_NOT_IN_GITHUB_ARTIFACT');
 const machine=JSON.parse(raw.toString('utf8').replace(/^\uFEFF/,''));
 const check=checkQcp67(machine,definitions,meta.source_head_sha,meta.base_sha);
 return Object.freeze({status:'GITHUB_NATIVE_MERGED_EXACT_QCP67_AND_CI_VERIFIED_NOT_ADOPTION',subject_sha:meta.subject_sha,
  source_head:meta.source_head_sha,source_qcp_only:true,merge_exact_tree:true,qcp:check});
}
function fetchLive(meta){
 return {pr:nativeGithubGet('/pulls/'+meta.pr_number),
 baseCommit:nativeGithubGet('/git/commits/'+meta.base_sha),
 sourceCommit:nativeGithubGet('/git/commits/'+meta.source_head_sha),
 mergeCommit:nativeGithubGet('/git/commits/'+meta.subject_sha),
 main:nativeGithubGet('/git/ref/heads/main'),
 qcpRun:nativeGithubGet('/actions/runs/'+meta.qcp_run_id),
 qcpJobs:nativeGithubGet('/actions/runs/'+meta.qcp_run_id+'/attempts/'+meta.qcp_run_attempt+'/jobs?per_page=100'),
 qcpArtifacts:nativeGithubGet('/actions/runs/'+meta.qcp_run_id+'/artifacts?per_page=100'),
 ciRun:nativeGithubGet('/actions/runs/'+meta.ci_run_id)};
}
const INPUT_FIELDS=['source_root','release_root','inventory_file','inventory_sha256',
 'authority_registry_file','authority_registry_sha256','owner_envelope_file','trust_file',
 'signed_evidence_input_file','qcp_provenance_file','qcp_provenance_sha256',
 'qcp_raw_file','qcp_zip_file','material_file','release_binding_file','release_binding_sha256',
 'adoption_envelope_file'];
function checkInput(x){exact(x,INPUT_FIELDS,'R4285_NATIVE_ADOPTION_INPUT_FIELDS');
 for(const k of INPUT_FIELDS.filter(k=>k.endsWith('_file')||k.endsWith('_root')))assert(path.isAbsolute(x[k]),'R4285_NATIVE_ABSOLUTE:'+k);
 for(const k of INPUT_FIELDS.filter(k=>k.endsWith('_sha256')))assert(SHA.test(x[k]),'R4285_NATIVE_DIGEST:'+k);
 return x;}
function checkNativeAdoption(input,{now=Date.now()}={}){
 assert(process.platform==='win32'&&!process.env.CI&&!process.env.GITHUB_ACTIONS,'R4285_NATIVE_WINDOWS_ONLY');
 assert(!process.env.NODE_OPTIONS&&!process.env.NODE_PATH&&!process.env.PYTHONPATH&&!process.env.PYTHONHOME,
  'R4285_NATIVE_INJECTION_FORBIDDEN');
 checkInput(input);
 const root=input.source_root,releaseRoot=input.release_root;
 const trustBytes=readRootFile(root,TRUST_PATH),givenTrustBytes=readRegular(input.trust_file);
 assert(trustBytes.equals(givenTrustBytes),'R4285_NATIVE_TRUST_NOT_REPOSITORY_REGISTERED');
 const trust=JSON.parse(trustBytes.toString('utf8'));
 const native=require('./MCFT_CAP09_R4285_CURRENT_SUBJECT_ADOPTION_V1.cjs');
 const hostInput=readJson(input.signed_evidence_input_file);
 exact(hostInput,['signed_evidence'],'R4285_NATIVE_SIGNED_EVIDENCE_INPUT_FIELDS');
 const signedInput=hostInput.signed_evidence;
 assert.equal(signedInput.source_root,root,'R4285_NATIVE_SOURCE_ROOT_NOT_UNIFIED');
 assert.equal(path.resolve(signedInput.trust_file),path.resolve(input.trust_file),'R4285_NATIVE_LINEAGE_TRUST_DIFFERENT');
 const subject=signedInput.subject_sha;
 assert(HEAD.test(subject),'R4285_NATIVE_SUBJECT_SHA_REQUIRED');
 gitExactMain(root,subject);
 const ownerEnv=readJson(input.owner_envelope_file),inventoryBytes=readRegular(input.inventory_file),
  registryBytes=readRegular(input.authority_registry_file);
 assert.equal(sha(inventoryBytes),input.inventory_sha256,'R4285_NATIVE_INVENTORY_CHANGED');
 assert.equal(sha(registryBytes),input.authority_registry_sha256,'R4285_NATIVE_REGISTRY_CHANGED');
 const owner=native.verifyOwnerInventoryDecision({reportBytes:inventoryBytes,registryBytes,
  envelope:ownerEnv,trust,subjectSha:subject,now});
 assert(Number.isSafeInteger(owner.ordinal)&&owner.ordinal>3,'R4285_NATIVE_ORDINAL_NOT_ADJUDICATED');
 const gate=require('../governance_acceptance/MCFT_CAP09_R4285_SIGNED_EVIDENCE_GATE_V1.cjs');
 const lineage=gate.review(signedInput); // native 23-file Full-chain, real Ed25519, predecessor double-ledger
 assert.equal(lineage.subject_sha,subject);
 assert.equal(lineage.attempt_ordinal,owner.ordinal,'R4285_NATIVE_LINEAGE_ORDINAL_MISMATCH');
 const lineageEnv=readJson(signedInput.lineage_envelope_file);
 const lineageSha=sha(Buffer.from(native.canonical(lineageEnv)));
 const installed=require('./installed-material.cjs');
 const profile=readJson(input.material_file);
 const checked=installed.verify(profile,releaseRoot,process.env); // exact file inventory and environment
 const bound=JSON.parse(readRegular(input.release_binding_file).toString('utf8'));
 assert.equal(sha(readRegular(input.release_binding_file)),input.release_binding_sha256,'R4285_NATIVE_RELEASE_BINDING_DRIFT');
 assert.equal(bound.schema_version,'MCFT_CAP09_RELEASE_MATERIAL_BINDING_V1');
 assert.equal(bound.subject_commit_sha,subject,'R4285_NATIVE_RELEASE_HEAD_MISMATCH');
 const offline=require('./offline-context.cjs');
 offline.verifyReleaseSourceBinding(bound,profile); // exact signed release sources, 108 frozen paths and child scripts
 const nativeConsumerRel='scripts/cap09_adoption_v1/MCFT_CAP09_R4285_NATIVE_ADOPTION_CONSUMER_V1.cjs';
 const ownerConsumerRel='scripts/cap09_adoption_v1/MCFT_CAP09_R4285_CURRENT_SUBJECT_ADOPTION_V1.cjs';
 const materialIndex=new Map(profile.files.map(x=>[x.path,x.sha256]));
 const releaseIndex=new Map(bound.files.map(x=>[x.path,x.sha256]));
 for(const rel of [nativeConsumerRel,ownerConsumerRel]){
  const digest=sha(readRootFile(releaseRoot,rel));
  assert.equal(materialIndex.get(rel),digest,'R4285_NATIVE_UNBOUND_INSTALLED_CONSUMER:'+rel);
  assert.equal(releaseIndex.get(rel),digest,'R4285_NATIVE_UNBOUND_RELEASE_CONSUMER:'+rel);
 }
 assert.equal(path.resolve(__filename),path.resolve(path.join(releaseRoot,...nativeConsumerRel.split('/'))),
  'R4285_NATIVE_CONSUMER_MUST_EXECUTE_FROM_SIGNED_RELEASE');
 assert(profile.files.some(x=>x.path==='scripts/runtime_acceptance/MCFT_CAP09_R4285_HOST_SIGNED_EVIDENCE_PREFLIGHT_V1.cjs'),
  'R4285_NATIVE_RELEASE_R4285_HOST_MISSING');
 const provenance=JSON.parse(readRegular(input.qcp_provenance_file).toString('utf8'));
 assert.equal(sha(readRegular(input.qcp_provenance_file)),input.qcp_provenance_sha256,
  'R4285_NATIVE_QCP_PROVENANCE_BYTES_CHANGED');
 assert.equal(provenance.subject_sha,subject,'R4285_NATIVE_QCP_SUBJECT_MISMATCH');
 const definitions=JSON.parse(readRootFile(releaseRoot,QCP_PATH).toString('utf8'));
 const zipped=readRegular(input.qcp_zip_file),raw=readRegular(input.qcp_raw_file);
 const upstream=require('./MCFT_CAP09_ADOPTION_V2_EVIDENCE_CONSUMER.cjs');
 const qualified=verifyGitHubNativeProof(provenance,fetchLive(provenance),raw,zipped,definitions,upstream.zipRaw);
 assert.equal(qualified.subject_sha,subject);
 const adoptionEnv=readJson(input.adoption_envelope_file);
 const adopter=native.verifySignedAdoption({envelope:adoptionEnv,trust,now,context:{subject_sha:subject,
  inventory_sha256:input.inventory_sha256,authority_registry_sha256:input.authority_registry_sha256,
  owner_decision_sha256:owner.owner_decision_sha256,lineage_envelope_sha256:lineageSha,
  native_qcp67_result_sha256:sha(raw),installed_material_digest:checked.digest,
  release_binding_sha256:input.release_binding_sha256}});
 return Object.freeze({schema_version:'MCFT_CAP09_R4285_NATIVE_CURRENT_SUBJECT_ADOPTION_CONSUMER_V1',
  status:'NATIVE_R4285_CURRENT_SUBJECT_ADOPTION_VERIFIED_NOT_PERMIT',run_id:RUN,subject_sha:subject,
  owner_ordinal:owner.ordinal,owner_inventory_sha256:input.inventory_sha256,
  qcp67_source_run_id:provenance.qcp_run_id,qcp_executed_at_merge_head:false,
  source_and_merge_proven:qualified.status,material_digest:checked.digest,
  lineage:'NATIVE_R4285_SIGNED_LINEAGE_AND_FULLCHAIN_VERIFIED',adoption_digest:adopter.adoption_digest_sha256,
  resource_owner_fresh_signed:false,permit_issued:false,permit_consumed:false,
  host_execution_ready:false,execution_authorized:false,stage_count:0,production_authorized:false});
}
function run(argv){
 assert(process.platform==='win32'&&!process.env.CI&&!process.env.GITHUB_ACTIONS,'R4285_NATIVE_WINDOWS_ONLY');
 assert(argv.length===3&&argv[0]==='--adoption-check-only'&&argv[1]==='--input'&&path.isAbsolute(argv[2]),
  'R4285_NATIVE_CHECK_ONLY_NO_EXECUTION');
 return checkNativeAdoption(readJson(argv[2]));
}
if(require.main===module){try{console.log(JSON.stringify(run(process.argv.slice(2)),null,2));}
 catch(e){console.error(JSON.stringify({status:'HOLD_R4285_NATIVE_ADOPTION',first_blocker:String(e.message||e).slice(0,260),
  permit_issued:false,permit_consumed:false,execution_authorized:false,stage_count:0,production_authorized:false}));process.exitCode=1}}
module.exports={RUN,CHECK,QCP_PATH,INPUT_FIELDS,checkQcp67,verifyGitHubNativeProof,checkInput,gitExactMain,checkNativeAdoption,run};