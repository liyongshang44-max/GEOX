'use strict';
// Release identity only. Historical QCP, Adoption, Material and physical authority remain separate.
// No execution caller is wired to this candidate until its closure is qualified.
const assert=require('node:assert/strict'),cp=require('node:child_process'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const audit=require('./MCFT_CAP09_R4285_RELEASE_IMPACT_AUDIT_V1.cjs');
const REPO='liyongshang44-max/GEOX',API='https://api.github.com/repos/'+REPO,OWNER='liyongshang44-max',RULESET=19167144,AUTHORITY_PR=3757;
const POLICY='docs/digital_twin/mcft/cap_09/GEOX-MCFT-R4285-RELEASE-DEPENDENCY-POLICY-V1.json';
const H=/^[0-9a-f]{40}$/,S=/^[0-9a-f]{64}$/;
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const digest=x=>sha(audit.canonical(x));
const exact=(x,keys,code)=>{assert(x&&typeof x==='object'&&!Array.isArray(x),code);assert.deepEqual(Object.keys(x).sort(),keys.slice().sort(),code);};
const live=new WeakMap();
function rulesetProjection(x){return {id:x.id,name:x.name,target:x.target,enforcement:x.enforcement,conditions:x.conditions,bypass_actors:x.bypass_actors,rules:x.rules};}
function checkRuleset(actual,expected){
 assert(actual&&actual.id===RULESET&&actual.name==='main-strict-delivery-v1'&&actual.target==='branch'&&actual.enforcement==='active','RELEASE_RULESET_INACTIVE');
 assert(actual.source===REPO&&actual.source_type==='Repository','RELEASE_RULESET_SOURCE');
 assert.deepEqual(actual.conditions,{ref_name:{exclude:[],include:['~DEFAULT_BRANCH']}},'RELEASE_RULESET_SCOPE');
 assert.deepEqual(actual.bypass_actors,[],'RELEASE_RULESET_BYPASS');
 for(const type of ['deletion','non_fast_forward','pull_request','required_status_checks'])assert(actual.rules?.some(r=>r.type===type),'RELEASE_RULESET_MISSING:'+type);
 assert.equal(digest(rulesetProjection(actual)),digest(expected),'RELEASE_RULESET_CHANGED');
 return true;
}
function checkCurrent(repo,branch,ruleset,policy){
 assert(repo?.full_name===REPO&&repo.default_branch==='main','RELEASE_REPOSITORY_OR_DEFAULT_BRANCH');
 assert(branch?.name==='main'&&branch.protected===true&&H.test(branch.commit?.sha),'RELEASE_PROTECTED_MAIN_UNAVAILABLE');
 checkRuleset(ruleset,policy.ruleset);return branch.commit.sha;
}
function corridor({root,subject,main,policy,policySha}){
 assert(H.test(subject)&&H.test(main)&&S.test(policySha),'RELEASE_IDENTITY_FIELDS');
 assert(Array.isArray(policy.revoked_subjects)&&policy.revoked_subjects.every(x=>H.test(x))&&!policy.revoked_subjects.includes(subject),'RELEASE_REVOKED_OR_INVALID_POLICY');
 const result=audit.inspect(root,subject,main,policy.protected_paths);
 assert.equal(result.relevant.length,0,'RELEASE_RELEVANT_CHANGE');
 const binding=Object.freeze({subject_sha:subject,observed_main_sha:main,dependency_policy_sha256:policySha,delta_sha256:digest(result.unreviewed)});
 return Object.freeze({binding,review_required:result.unreviewed.length>0,delta_count:result.unreviewed.length,first_parent_hops:result.first_parent_hops,execution_authorized:false,permit_authorized:false});
}
function inspectOwnerReview(reply,id,binding,now=Date.now()){
 assert(Number.isSafeInteger(id)&&id>0&&reply?.id===id&&reply.url===API+'/issues/comments/'+id&&reply.issue_url===API+'/issues/'+AUTHORITY_PR,'RELEASE_IMPACT_NATIVE_COMMENT_ID');
 assert(reply.user?.login===OWNER&&reply.author_association==='OWNER'&&reply.created_at===reply.updated_at&&Number.isFinite(Date.parse(reply.created_at))&&Date.parse(reply.created_at)<=now,'RELEASE_IMPACT_NATIVE_OWNER');
 assert(typeof reply.body==='string'&&Buffer.byteLength(reply.body)<=8192,'RELEASE_IMPACT_BODY');
 const p=JSON.parse(reply.body);assert.equal(reply.body,audit.canonical(p),'RELEASE_IMPACT_NONCANONICAL');
 exact(p,['schema_version','subject_sha','observed_main_sha','dependency_policy_sha256','delta_sha256','review_evidence_sha256','decision','execution_authorized','permit_authorized'],'RELEASE_IMPACT_FIELDS');
 assert.equal(p.schema_version,'MCFT_CAP09_R4285_RELEASE_NONINTERFERENCE_V1');
 for(const k of Object.keys(binding))assert.equal(p[k],binding[k],'RELEASE_IMPACT_BINDING:'+k);
 assert(S.test(p.review_evidence_sha256)&&p.decision==='ACCEPT_EXACT_DELTA_NO_EXECUTION_DEPENDENCY_OR_EXTERNAL_EFFECT'&&p.execution_authorized===false&&p.permit_authorized===false,'RELEASE_IMPACT_DECISION');
 return sha(Buffer.from(reply.body));
}
function git(root,...args){return cp.execFileSync('git',['--no-replace-objects','-C',root,...args],{encoding:'buffer',timeout:20000,maxBuffer:64*1024*1024,windowsHide:true});}
const gitText=(root,...args)=>git(root,...args).toString('utf8').trim();
function verifyLocal(root,subject){
 assert(path.isAbsolute(root)&&H.test(subject),'RELEASE_LOCAL_ID');
 assert(!Object.keys(process.env).some(k=>/^GIT_/i.test(k)),'RELEASE_GIT_ENV_INJECTION');
 assert.equal(fs.realpathSync(root),fs.realpathSync(gitText(root,'rev-parse','--show-toplevel')),'RELEASE_LOCAL_ROOT');
 assert.equal(gitText(root,'rev-parse','HEAD'),subject,'RELEASE_LOCAL_HEAD');
 assert.equal(gitText(root,'rev-parse','--is-shallow-repository'),'false','RELEASE_SHALLOW_HISTORY');
 assert.equal(gitText(root,'for-each-ref','--format=%(refname)','refs/replace'),'','RELEASE_REPLACE_REFS');
 const graft=gitText(root,'rev-parse','--git-path','info/grafts');assert(!fs.existsSync(path.resolve(root,graft)),'RELEASE_GRAFTS');
 assert(!gitText(root,'ls-files','-v').split(/\r?\n/).some(x=>/^[a-zS] /.test(x)),'RELEASE_HIDDEN_INDEX_ENTRY');
 assert.equal(gitText(root,'status','--porcelain','--untracked-files=all'),'','RELEASE_LOCAL_DIRTY');
}
function checkPolicy(p){
 assert(p?.schema_version==='MCFT_CAP09_R4285_RELEASE_DEPENDENCY_POLICY_V1'&&p.state==='QUALIFIED_CLOSURE','RELEASE_CLOSURE_NOT_QUALIFIED');
 assert(Array.isArray(p.protected_paths)&&new Set(p.protected_paths).size===p.protected_paths.length,'RELEASE_POLICY_PATHS');
 for(const required of [POLICY,'scripts/governance_acceptance/MCFT_CAP09_R4285_RELEASE_IDENTITY_V1.cjs','scripts/governance_acceptance/MCFT_CAP09_R4285_RELEASE_IMPACT_AUDIT_V1.cjs','scripts/runtime_acceptance/MCFT_CAP09_RETRY_TRUST_V1.json','scripts/runtime_acceptance/MCFT_CAP09_RETRY_TRUST_V2.json','pnpm-lock.yaml','package.json','apps/server/src/db/schema.sql'])assert(p.protected_paths.includes(required),'RELEASE_MANDATORY_DEPENDENCY_MISSING:'+required);
 return p;
}
function readPolicy(root,subject){
 verifyLocal(root,subject);
 const raw=git(root,'show',subject+':'+POLICY),local=fs.readFileSync(path.join(root,...POLICY.split('/'))),installed=fs.readFileSync(path.join(__dirname,'../..',...POLICY.split('/')));
 assert(raw.equals(local)&&raw.equals(installed),'RELEASE_POLICY_SOURCE_OR_INSTALLED_DRIFT');
 return {policy:checkPolicy(JSON.parse(raw.toString('utf8'))),sha256:sha(raw)};
}
function nativeOnly(){assert(process.platform==='win32'&&!process.env.CI&&!process.env.GITHUB_ACTIONS&&!process.env.NODE_OPTIONS&&!process.env.NODE_PATH,'RELEASE_NATIVE_WINDOWS_ONLY');}
function get(api){
 assert(/^\/(?:branches\/main|rulesets\/19167144|issues\/comments\/[1-9][0-9]*|)$/.test(api),'RELEASE_NATIVE_ENDPOINT');
 return JSON.parse(cp.execFileSync('curl.exe',['-q','--fail','--silent','--show-error','--proto','=https','--max-time','8','-H','Accept: application/vnd.github+json','-H','X-GitHub-Api-Version: 2022-11-28',API+(api==='/'?'':api)],{encoding:'utf8',timeout:10000,maxBuffer:2*1024*1024,windowsHide:true}));
}
function nativeCurrent(policy){return checkCurrent(get('/'),get('/branches/main'),get('/rulesets/'+RULESET),policy);}
function prepare({source_root,subject_sha,impact_review_comment_id=null}){
 nativeOnly();const {policy,sha256}=readPolicy(source_root,subject_sha),main=nativeCurrent(policy);
 const proof=corridor({root:source_root,subject:subject_sha,main,policy,policySha:sha256});
 if(proof.review_required)assert(Number.isSafeInteger(impact_review_comment_id)&&impact_review_comment_id>0,'RELEASE_IMPACT_REVIEW_REQUIRED');
 const review=proof.review_required?inspectOwnerReview(get('/issues/comments/'+impact_review_comment_id),impact_review_comment_id,proof.binding):null;
 if(!proof.review_required)assert.equal(impact_review_comment_id,null,'RELEASE_UNNECESSARY_REVIEW');
 const tip=get('/branches/main');assert(tip.name==='main'&&tip.protected===true&&tip.commit?.sha===main,'RELEASE_MAIN_CHANGED_DURING_REVIEW');
 live.set(proof,{root:source_root,subject:subject_sha,policySha:sha256,main,id:impact_review_comment_id,review});return proof;
}
function requireCurrent(proof,root,subject){
 nativeOnly();const p=live.get(proof);assert(p&&p.root===root&&p.subject===subject,'RELEASE_LIVE_IDENTITY_REQUIRED');
 const {policy,sha256}=readPolicy(root,subject);assert.equal(sha256,p.policySha,'RELEASE_POLICY_DRIFT');
 assert.equal(nativeCurrent(policy),p.main,'RELEASE_IMPACT_RECHECK_REQUIRED');
 if(p.review!==null)assert.equal(inspectOwnerReview(get('/issues/comments/'+p.id),p.id,proof.binding),p.review,'RELEASE_IMPACT_REVIEW_CHANGED');
 const tip=get('/branches/main');assert(tip.protected===true&&tip.commit?.sha===p.main,'RELEASE_MAIN_CHANGED_DURING_REFRESH');return true;
}
module.exports={POLICY,rulesetProjection,checkRuleset,checkCurrent,checkPolicy,corridor,inspectOwnerReview,prepare,requireCurrent,isLiveIdentity:x=>live.has(x)};
