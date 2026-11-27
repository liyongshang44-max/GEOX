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
function freezeDelta(rows){return Object.freeze(rows.map(row=>Object.freeze({...row,before:row.before===null?null:Object.freeze({...row.before}),after:row.after===null?null:Object.freeze({...row.after})})));}
function verifyReviewEvidence(evidence,claimedDigest,proof){
 exact(evidence,['schema_version','assessments'],'RELEASE_REVIEW_EVIDENCE_FIELDS');
 assert.equal(evidence.schema_version,'MCFT_CAP09_R4285_NONINTERFERENCE_EVIDENCE_V1','RELEASE_REVIEW_EVIDENCE_SCHEMA');
 assert(Array.isArray(proof.delta_rows)&&proof.delta_rows.length>0&&proof.review_required===true&&proof.delta_count===proof.delta_rows.length,'RELEASE_REVIEW_DELTA_REQUIRED');
 assert.equal(digest(proof.delta_rows),proof.binding.delta_sha256,'RELEASE_REVIEW_DELTA_DRIFT');
 assert.equal(digest(evidence),claimedDigest,'RELEASE_REVIEW_EVIDENCE_DIGEST');
 assert(Array.isArray(evidence.assessments)&&evidence.assessments.length===proof.delta_rows.length,'RELEASE_REVIEW_COVERAGE');
 for(const [i,a] of evidence.assessments.entries()){
  exact(a,['delta_row_sha256','decision','basis'],'RELEASE_REVIEW_ASSESSMENT_FIELDS');
  assert.equal(a.delta_row_sha256,digest(proof.delta_rows[i]),'RELEASE_REVIEW_ROW_BINDING');
  assert.equal(a.decision,'NO_EXECUTION_DEPENDENCY_OR_EXTERNAL_EFFECT','RELEASE_REVIEW_ROW_DECISION');
  assert(typeof a.basis==='string'&&a.basis.trim()===a.basis&&a.basis.length>0&&a.basis.length<=512&&!/[\x00-\x1f\x7f]/.test(a.basis),'RELEASE_REVIEW_BASIS');
 }
 return true;
}
function corridor({root,subject,main,policy,policySha}){
 assert(H.test(subject)&&H.test(main)&&S.test(policySha),'RELEASE_IDENTITY_FIELDS');
 assert(Array.isArray(policy.revoked_subjects)&&policy.revoked_subjects.every(x=>H.test(x))&&!policy.revoked_subjects.includes(subject),'RELEASE_REVOKED_OR_INVALID_POLICY');
 const result=audit.inspect(root,subject,main,policy.protected_paths);
 assert.equal(result.relevant.length,0,'RELEASE_RELEVANT_CHANGE');
 const binding=Object.freeze({subject_sha:subject,observed_main_sha:main,dependency_policy_sha256:policySha,delta_sha256:digest(result.unreviewed)});
 return Object.freeze({binding,delta_rows:freezeDelta(result.unreviewed),review_required:result.unreviewed.length>0,delta_count:result.unreviewed.length,first_parent_hops:result.first_parent_hops,execution_authorized:false,permit_authorized:false});
}
function inspectOwnerReview(reply,id,proof,now=Date.now()){
 const binding=proof.binding;
 assert(Number.isSafeInteger(id)&&id>0&&reply?.id===id&&reply.url===API+'/issues/comments/'+id&&reply.issue_url===API+'/issues/'+AUTHORITY_PR,'RELEASE_IMPACT_NATIVE_COMMENT_ID');
 assert(reply.user?.login===OWNER&&reply.author_association==='OWNER'&&reply.created_at===reply.updated_at&&Number.isFinite(Date.parse(reply.created_at))&&Date.parse(reply.created_at)<=now,'RELEASE_IMPACT_NATIVE_OWNER');
 assert(typeof reply.body==='string'&&Buffer.byteLength(reply.body)<=60000,'RELEASE_IMPACT_BODY');
 const p=JSON.parse(reply.body);assert.equal(reply.body,audit.canonical(p),'RELEASE_IMPACT_NONCANONICAL');
 exact(p,['schema_version','subject_sha','observed_main_sha','dependency_policy_sha256','delta_sha256','review_evidence_sha256','review_evidence','decision','execution_authorized','permit_authorized'],'RELEASE_IMPACT_FIELDS');
 assert.equal(p.schema_version,'MCFT_CAP09_R4285_RELEASE_NONINTERFERENCE_V1');
 for(const k of Object.keys(binding))assert.equal(p[k],binding[k],'RELEASE_IMPACT_BINDING:'+k);
 assert(S.test(p.review_evidence_sha256)&&p.decision==='ACCEPT_EXACT_DELTA_NO_EXECUTION_DEPENDENCY_OR_EXTERNAL_EFFECT'&&p.execution_authorized===false&&p.permit_authorized===false,'RELEASE_IMPACT_DECISION');
 verifyReviewEvidence(p.review_evidence,p.review_evidence_sha256,proof);
 return sha(Buffer.from(reply.body));
}
function git(root,...args){return cp.execFileSync('git',['--no-replace-objects','-C',root,...args],{encoding:'buffer',timeout:20000,maxBuffer:64*1024*1024,windowsHide:true});}
const gitText=(root,...args)=>git(root,...args).toString('utf8').trim();

// Candidate effect classes are deliberately narrow and anchored to reviewed
// source objects. Neither a product directory nor a changed-file list proves
// noninterference. Unrecognised edits to these exact surfaces must HOLD.
const MACHINE_RULES=Object.freeze({
 CSS_NUMERIC_PRESENTATION_V1:'apps/web/src/styles/customerDashboard.css',
 CUSTOMER_DASHBOARD_TITLE_COPY_V1:'apps/web/src/lib/productCopy/customerLocale.ts'
});
function machineRules(root,subject,policy){
 const rules=policy.machine_effect_rules??[];
 assert(Array.isArray(rules)&&rules.length<=Object.keys(MACHINE_RULES).length,'RELEASE_MACHINE_RULES');
 const byPath=new Map();
 for(const rule of rules){
  exact(rule,['path','rule_id','anchor_blob'],'RELEASE_MACHINE_RULE_FIELDS');
  assert(Object.hasOwn(MACHINE_RULES,rule.rule_id)&&MACHINE_RULES[rule.rule_id]===rule.path&&H.test(rule.anchor_blob),'RELEASE_MACHINE_RULE_IDENTITY');
  assert(!byPath.has(rule.path)&&!policy.protected_paths.includes(rule.path),'RELEASE_MACHINE_RULE_OVERLAP');
  assert.equal(gitText(root,'ls-tree',subject,'--',rule.path),'100644 blob '+rule.anchor_blob+'\t'+rule.path,'RELEASE_MACHINE_ANCHOR_CHANGED');
  byPath.set(rule.path,rule);
 }
 return byPath;
}
function blobText(root,oid){
 assert(H.test(oid),'RELEASE_MACHINE_BLOB_ID');
 const b=git(root,'cat-file','blob',oid);
 assert(b.length>0&&b.length<=1024*1024&&!b.includes(0),'RELEASE_MACHINE_BLOB_SIZE');
 return new TextDecoder('utf-8',{fatal:true}).decode(b);
}
function numericPresentation(before,after){
 const a=before.split('\n'),b=after.split('\n');
 if(a.length!==b.length)return false;
 const re=/^([ \t]+(?:gap|row-gap|column-gap|margin-top|margin-bottom|padding-top|padding-bottom|font-size|border-radius): )([0-9]{1,3})px(;[ \t]*)$/;
 let changed=0;
 for(let i=0;i<a.length;i++)if(a[i]!==b[i]){
  const x=re.exec(a[i]),y=re.exec(b[i]);
  if(!x||!y||x[1]!==y[1]||x[3]!==y[3]||Number(x[2])>128||Number(y[2])>128)return false;
  changed++;
 }
 return changed>0;
}
function dashboardTitleCopy(before,after){
 const a=before.split('\n'),b=after.split('\n');
 if(a.length!==b.length)return false;
 const header='export const CUSTOMER_DASHBOARD_COPY = {';
 const i=a.indexOf(header)+2;
 if(i<2||a.indexOf(header)!==a.lastIndexOf(header)||a[i-2]!==header)return false;
 const re=/^  title: \{ zh: "([\p{L}\p{N}\p{M}\p{Zs}.,!?、，。！？：()-]{1,80})", en: "([\p{L}\p{N}\p{M}\p{Zs}.,!?、，。！？：()-]{1,80})" \},$/u;
 if(!re.test(a[i])||!re.test(b[i])||a[i]===b[i])return false;
 return a.every((line,j)=>j===i||line===b[j]);
}
function classifyMachine(root,row,rule){
 assert(row.before?.type==='blob'&&row.after?.type==='blob'&&row.before.mode==='100644'&&row.after.mode==='100644','RELEASE_MACHINE_FILE_IDENTITY');
 const before=blobText(root,row.before.oid),after=blobText(root,row.after.oid);
 const ok=rule.rule_id==='CSS_NUMERIC_PRESENTATION_V1'?numericPresentation(before,after):dashboardTitleCopy(before,after);
 assert(ok,'RELEASE_MACHINE_EFFECT_UNPROVEN:'+row.path);
 return Object.freeze({rule_id:rule.rule_id,delta_row_sha256:digest(row)});
}
// All results here are engineering candidates; this function cannot create
// the native in-process capability or substitute for qualified closure.
function planIncremental({root,subject,main,policy,policySha}){
 const proof=corridor({root,subject,main,policy,policySha});
 const chain=Object.freeze([subject,...(subject===main?[]:gitText(root,'rev-list','--first-parent','--reverse',subject+'..'+main).split(/\r?\n/))]);
 assert.equal(chain.length,proof.first_parent_hops+1,'RELEASE_INCREMENTAL_CHAIN_LENGTH');
 assert.equal(chain.at(-1),main,'RELEASE_INCREMENTAL_CHAIN_TIP');
 assert(chain.every(x=>H.test(x))&&new Set(chain).size===chain.length,'RELEASE_INCREMENTAL_CHAIN');
 const rules=machineRules(root,subject,policy),machine=[],unknown=[];
 for(const row of proof.delta_rows){
  const i=chain.indexOf(row.head);
  assert(i>0&&chain[i-1]===row.parent,'RELEASE_INCREMENTAL_PARENT');
  const rule=rules.get(row.path);
  if(rule)machine.push(classifyMachine(root,row,rule));else unknown.push(row);
 }
 return Object.freeze({binding:proof.binding,chain,delta_rows:proof.delta_rows,machine_rows:Object.freeze(machine),unknown_rows:freezeDelta(unknown),execution_authorized:false,permit_authorized:false});
}
function segmentDraft(plan,from,through){
 const a=plan.chain.indexOf(from),b=plan.chain.indexOf(through);
 assert(a>=0&&b>a,'RELEASE_SEGMENT_NOT_FORWARD_CORRIDOR');
 const inSegment=row=>{const i=plan.chain.indexOf(row.head);return i>a&&i<=b;};
 const all=plan.delta_rows.filter(inSegment),rows=freezeDelta(plan.unknown_rows.filter(inSegment));
 const binding=Object.freeze({subject_sha:plan.binding.subject_sha,from_main_sha:from,through_main_sha:through,dependency_policy_sha256:plan.binding.dependency_policy_sha256,segment_delta_sha256:digest(all),delta_sha256:digest(rows)});
 return Object.freeze({binding,delta_rows:rows,delta_count:rows.length,review_required:rows.length>0,execution_authorized:false,permit_authorized:false});
}
function inspectSegmentReview(reply,id,segment,now){
 assert(Number.isSafeInteger(id)&&id>0&&reply?.id===id&&reply.url===API+'/issues/comments/'+id&&reply.issue_url===API+'/issues/'+AUTHORITY_PR,'RELEASE_SEGMENT_NATIVE_COMMENT_ID');
 assert(reply.user?.login===OWNER&&reply.author_association==='OWNER'&&reply.created_at===reply.updated_at&&Number.isFinite(Date.parse(reply.created_at))&&Date.parse(reply.created_at)<=now,'RELEASE_SEGMENT_NATIVE_OWNER');
 assert(typeof reply.body==='string'&&Buffer.byteLength(reply.body)<=60000,'RELEASE_SEGMENT_BODY');
 const p=JSON.parse(reply.body);assert.equal(reply.body,audit.canonical(p),'RELEASE_SEGMENT_NONCANONICAL');
 exact(p,['schema_version',...Object.keys(segment.binding),'review_evidence_sha256','review_evidence','decision','execution_authorized','permit_authorized'],'RELEASE_SEGMENT_FIELDS');
 assert.equal(p.schema_version,'MCFT_CAP09_R4285_RELEASE_NONINTERFERENCE_SEGMENT_V1');
 for(const k of Object.keys(segment.binding))assert.equal(p[k],segment.binding[k],'RELEASE_SEGMENT_BINDING:'+k);
 assert(S.test(p.review_evidence_sha256)&&p.decision==='ACCEPT_EXACT_DELTA_NO_EXECUTION_DEPENDENCY_OR_EXTERNAL_EFFECT'&&p.execution_authorized===false&&p.permit_authorized===false,'RELEASE_SEGMENT_DECISION');
 verifyReviewEvidence(p.review_evidence,p.review_evidence_sha256,segment);
 return sha(Buffer.from(reply.body));
}
// Replies are deliberately supplied only to this pure evidence evaluator.
// The future native wrapper must fetch every referenced comment itself and
// refresh protection/trust/revocation; fixtures cannot mint authority.
function evaluateIncremental(input,segments=[],now=Date.now()){
 const plan=planIncremental(input);
 assert(Array.isArray(segments)&&segments.length<=64,'RELEASE_SEGMENT_CARDINALITY');
 const ids=new Set(),accepted=[];let cursor=input.subject;
 for(const item of segments){
  exact(item,['id','reply'],'RELEASE_SEGMENT_INPUT_FIELDS');
  assert(!ids.has(item.id),'RELEASE_SEGMENT_DUPLICATE_ID');ids.add(item.id);
  assert(typeof item.reply?.body==='string'&&Buffer.byteLength(item.reply.body)<=60000,'RELEASE_SEGMENT_BODY');
  const p=JSON.parse(item.reply.body);
  assert.equal(p.from_main_sha,cursor,'RELEASE_SEGMENT_GAP_OR_OVERLAP');
  const segment=segmentDraft(plan,cursor,p.through_main_sha);
  assert(segment.review_required,'RELEASE_SEGMENT_UNNECESSARY_REVIEW');
  const review_sha256=inspectSegmentReview(item.reply,item.id,segment,now);
  accepted.push(Object.freeze({comment_id:item.id,review_sha256,from_main_sha:cursor,through_main_sha:p.through_main_sha,delta_count:segment.delta_count}));
  cursor=p.through_main_sha;
 }
 const pending=plan.unknown_rows.filter(row=>plan.chain.indexOf(row.head)>plan.chain.indexOf(cursor));
 return Object.freeze({status:pending.length?'HOLD_UNREVIEWED_INCREMENT':'CANDIDATE_INCREMENTAL_NONINTERFERENCE_PASS_NOT_ADMISSION',binding:plan.binding,reviewed_through:cursor,reviewed_segments:Object.freeze(accepted),machine_rows:plan.machine_rows,pending_rows:freezeDelta(pending),execution_authorized:false,permit_authorized:false});
}

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
 const review=proof.review_required?inspectOwnerReview(get('/issues/comments/'+impact_review_comment_id),impact_review_comment_id,proof):null;
 if(!proof.review_required)assert.equal(impact_review_comment_id,null,'RELEASE_UNNECESSARY_REVIEW');
 const tip=get('/branches/main');assert(tip.name==='main'&&tip.protected===true&&tip.commit?.sha===main,'RELEASE_MAIN_CHANGED_DURING_REVIEW');
 live.set(proof,{root:source_root,subject:subject_sha,policySha:sha256,main,id:impact_review_comment_id,review});return proof;
}
function requireCurrent(proof,root,subject){
 nativeOnly();const p=live.get(proof);assert(p&&p.root===root&&p.subject===subject,'RELEASE_LIVE_IDENTITY_REQUIRED');
 const {policy,sha256}=readPolicy(root,subject);assert.equal(sha256,p.policySha,'RELEASE_POLICY_DRIFT');
 assert.equal(nativeCurrent(policy),p.main,'RELEASE_IMPACT_RECHECK_REQUIRED');
 if(p.review!==null)assert.equal(inspectOwnerReview(get('/issues/comments/'+p.id),p.id,proof),p.review,'RELEASE_IMPACT_REVIEW_CHANGED');
 const tip=get('/branches/main');assert(tip.protected===true&&tip.commit?.sha===p.main,'RELEASE_MAIN_CHANGED_DURING_REFRESH');return true;
}
module.exports={planIncremental,segmentDraft,evaluateIncremental,freezeDelta,verifyReviewEvidence,POLICY,rulesetProjection,checkRuleset,checkCurrent,checkPolicy,corridor,inspectOwnerReview,prepare,requireCurrent,isLiveIdentity:x=>live.has(x)};
