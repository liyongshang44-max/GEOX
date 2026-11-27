'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process');
const a=require('./MCFT_CAP09_R4285_RELEASE_IDENTITY_V1.cjs'),audit=require('./MCFT_CAP09_R4285_RELEASE_IMPACT_AUDIT_V1.cjs');
const API='https://api.github.com/repos/liyongshang44-max/GEOX',sha='f'.repeat(64),head='a'.repeat(40),now=Date.now();
const rules={id:19167144,name:'main-strict-delivery-v1',source:'liyongshang44-max/GEOX',source_type:'Repository',target:'branch',enforcement:'active',conditions:{ref_name:{exclude:[],include:['~DEFAULT_BRANCH']}},bypass_actors:[],rules:['deletion','non_fast_forward','pull_request','required_status_checks'].map(type=>({type}))};
const policy={protected_paths:['runtime.cjs','trust.json'],revoked_subjects:[],ruleset:a.rulesetProjection(rules)};
function fixture(t){const root=fs.mkdtempSync(path.join(os.tmpdir(),'r4285-id-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));const git=(...x)=>cp.execFileSync('git',['-C',root,...x],{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();git('init','-b','main');git('config','user.name','Fixture');git('config','user.email','fixture@example.invalid');function commit(files){for(const [p,v] of Object.entries(files))fs.writeFileSync(path.join(root,p),v);git('add','-A');git('commit','-m','fixture');return git('rev-parse','HEAD');}const subject=commit({'runtime.cjs':'1','trust.json':'false','product.ts':'1'});return {root,subject,commit,inspect:(main,p=policy)=>a.corridor({root,subject,main,policy:p,policySha:sha})};}
function digest(x){return require('node:crypto').createHash('sha256').update(audit.canonical(x)).digest('hex');}
function review(proof){const evidence={schema_version:'MCFT_CAP09_R4285_NONINTERFERENCE_EVIDENCE_V1',assessments:proof.delta_rows.map(row=>({delta_row_sha256:digest(row),decision:'NO_EXECUTION_DEPENDENCY_OR_EXTERNAL_EFFECT',basis:'Fixture only: exact source and resource review.'}))};const body=audit.canonical({schema_version:'MCFT_CAP09_R4285_RELEASE_NONINTERFERENCE_V1',...proof.binding,review_evidence_sha256:digest(evidence),review_evidence:evidence,decision:'ACCEPT_EXACT_DELTA_NO_EXECUTION_DEPENDENCY_OR_EXTERNAL_EFFECT',execution_authorized:false,permit_authorized:false});const at=new Date(now-1000).toISOString();return {id:123,url:API+'/issues/comments/123',issue_url:API+'/issues/3757',user:{login:'liyongshang44-max'},author_association:'OWNER',created_at:at,updated_at:at,body};}
test('same subject has no review requirement, no authority capability',t=>{const f=fixture(t),p=f.inspect(f.subject);assert.equal(p.review_required,false);assert.equal(p.execution_authorized,false);assert.equal(a.isLiveIdentity(p),false);});
test('unrelated product delta needs exact native noninterference attestation; fixture cannot mint live identity',t=>{const f=fixture(t),p=f.inspect(f.commit({'product.ts':'2'}));assert.equal(p.review_required,true);assert.equal(p.delta_count,1);assert.match(a.inspectOwnerReview(review(p),123,p,now),/^[a-f0-9]{64}$/);assert.equal(a.isLiveIdentity(p),false);});
test('execution dependency change holds even when reverted',t=>{const f=fixture(t);f.commit({'runtime.cjs':'2'});assert.throws(()=>f.inspect(f.commit({'runtime.cjs':'1'})),/RELEASE_RELEVANT_CHANGE/);});
test('trust change holds',t=>{const f=fixture(t);assert.throws(()=>f.inspect(f.commit({'trust.json':'true'})),/RELEASE_RELEVANT_CHANGE/);});
test('revoked subject holds even without main drift',t=>{const f=fixture(t);assert.throws(()=>f.inspect(f.subject,{...policy,revoked_subjects:[f.subject]}),/RELEASE_REVOKED/);});
test('unrelated new path is not silently granted',t=>{const f=fixture(t);assert.equal(f.inspect(f.commit({'new-product.ts':'2'})).review_required,true);});
test('review cannot be replayed for newer main',t=>{const f=fixture(t),p=f.inspect(f.commit({'product.ts':'2'})),r=review(p);const next=f.inspect(f.commit({'product.ts':'3'}));assert.throws(()=>a.inspectOwnerReview(r,123,next,now),/RELEASE_IMPACT_BINDING/);});
test('wrong policy or delta identity rejected',t=>{const f=fixture(t),p=f.inspect(f.commit({'product.ts':'2'})),r=review(p);for(const k of ['dependency_policy_sha256','delta_sha256'])assert.throws(()=>a.inspectOwnerReview(r,123,{...p,binding:{...p.binding,[k]:'c'.repeat(64)}},now),/RELEASE_IMPACT_BINDING/);});
test('edited, deleted, non-owner or wrong PR comment rejected',t=>{const f=fixture(t),p=f.inspect(f.commit({'product.ts':'2'})),r=review(p);for(const bad of [null,{...r,updated_at:new Date(now).toISOString()},{...r,author_association:'MEMBER'},{...r,issue_url:API+'/issues/1'}])assert.throws(()=>a.inspectOwnerReview(bad,123,p,now));});
test('impact review cannot assert execution or permit permission',t=>{const f=fixture(t),p=f.inspect(f.commit({'product.ts':'2'})),r=review(p);r.body=audit.canonical({...JSON.parse(r.body),execution_authorized:true});assert.throws(()=>a.inspectOwnerReview(r,123,p,now),/RELEASE_IMPACT_DECISION/);});
test('current protected repo and ruleset exact; missing authority fails',()=>{const repo={full_name:'liyongshang44-max/GEOX',default_branch:'main'},branch={name:'main',protected:true,commit:{sha:head}};assert.equal(a.checkCurrent(repo,branch,rules,policy),head);for(const bad of [null,{...branch,protected:false}])assert.throws(()=>a.checkCurrent(repo,bad,rules,policy));assert.throws(()=>a.checkCurrent(repo,branch,null,policy));});
test('rule change, bypass, disabled ruleset and default branch drift fail closed',()=>{const repo={full_name:'liyongshang44-max/GEOX',default_branch:'main'},branch={name:'main',protected:true,commit:{sha:head}};for(const bad of [{...rules,bypass_actors:[{actor_id:1}]},{...rules,enforcement:'disabled'},{...rules,rules:rules.rules.slice(1)}])assert.throws(()=>a.checkCurrent(repo,branch,bad,policy));assert.throws(()=>a.checkCurrent({...repo,default_branch:'other'},branch,rules,policy));});
test('unqualified closure and missing mandatory trust/schema paths cannot enter native path',()=>{assert.throws(()=>a.checkPolicy({schema_version:'MCFT_CAP09_R4285_RELEASE_DEPENDENCY_POLICY_V1',state:'CANDIDATE_CLOSURE_OPEN',protected_paths:[]}),/RELEASE_CLOSURE_NOT_QUALIFIED/);assert.throws(()=>a.checkPolicy({schema_version:'MCFT_CAP09_R4285_RELEASE_DEPENDENCY_POLICY_V1',state:'QUALIFIED_CLOSURE',protected_paths:[a.POLICY]}),/RELEASE_MANDATORY_DEPENDENCY_MISSING/);});

test('Owner review binds each exact delta row and evidence digest',t=>{const f=fixture(t),p=f.inspect(f.commit({'product.ts':'2','new-product.ts':'1'})),r=review(p);const original=JSON.parse(r.body);const rebuild=e=>({...r,body:audit.canonical({...original,review_evidence:e,review_evidence_sha256:digest(e)})});const evidence=original.review_evidence;assert.equal(p.delta_rows.length,2);assert(Object.isFrozen(p.delta_rows)&&p.delta_rows.every(x=>Object.isFrozen(x)&&Object.isFrozen(x.after)));assert.throws(()=>a.inspectOwnerReview({...r,body:audit.canonical({...original,review_evidence_sha256:'f'.repeat(64)})},123,p,now),/EVIDENCE_DIGEST/);assert.throws(()=>a.inspectOwnerReview(rebuild({...evidence,assessments:evidence.assessments.slice(0,1)}),123,p,now),/COVERAGE/);assert.throws(()=>a.inspectOwnerReview(rebuild({...evidence,assessments:[evidence.assessments[0],evidence.assessments[0]]}),123,p,now),/ROW_BINDING/);assert.throws(()=>a.inspectOwnerReview(rebuild({...evidence,assessments:[...evidence.assessments].reverse()}),123,p,now),/ROW_BINDING/);assert.throws(()=>a.inspectOwnerReview(rebuild({...evidence,assessments:[{...evidence.assessments[0],decision:'UNKNOWN'},evidence.assessments[1]]}),123,p,now),/ROW_DECISION/);assert.throws(()=>a.inspectOwnerReview(rebuild({...evidence,assessments:[{...evidence.assessments[0],basis:''},evidence.assessments[1]]}),123,p,now),/BASIS/);});

// Real product source bytes, copied into independent Git fixtures; no edit to
// the candidate checkout and no native authority or data-plane access.
const realPolicy=JSON.parse(fs.readFileSync(path.join(__dirname,'../../docs/digital_twin/mcft/cap_09/GEOX-MCFT-R4285-RELEASE-DEPENDENCY-POLICY-V1.json'),'utf8'));
const CSS='apps/web/src/styles/customerDashboard.css',COPY='apps/web/src/lib/productCopy/customerLocale.ts';
function incrementalFixture(t){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'r4285-incremental-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const git=(...x)=>cp.execFileSync('git',['-C',root,...x],{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
 git('init','-b','main');git('config','user.name','Fixture');git('config','user.email','fixture@example.invalid');
 function commit(files){for(const [p,v] of Object.entries(files)){const file=path.join(root,p);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,v);}git('add','-A');git('commit','-m','fixture');return git('rev-parse','HEAD');}
 const css=fs.readFileSync(path.resolve(__dirname,'../..',CSS),'utf8'),copy=fs.readFileSync(path.resolve(__dirname,'../..',COPY),'utf8');
 const subject=commit({'runtime.cjs':'1','trust.json':'false','product.ts':'1',[CSS]:css,[COPY]:copy});
 const p={...policy,machine_effect_rules:realPolicy.machine_effect_rules};
 for(const rule of p.machine_effect_rules)assert.equal(git('rev-parse',subject+':'+rule.path),rule.anchor_blob,'TEST_REAL_PRODUCT_ANCHOR');
 const input=(main,overrides={})=>({root,subject,main,policy:p,policySha:sha,...overrides});
 const changedCss=css.replace('  gap: 18px;','  gap: 20px;');
 const changedCopy=copy.replace('  title: { zh: "经营总览", en: "Operating Overview" },','  title: { zh: "农田经营总览", en: "Farm Operating Overview" },');
 assert.notEqual(changedCss,css);assert.notEqual(changedCopy,copy);
 return {root,subject,commit,input,css,copy,changedCss,changedCopy};
}
function segmentReview(plan,from,through,id){
 const s=a.segmentDraft(plan,from,through);
 const e={schema_version:'MCFT_CAP09_R4285_NONINTERFERENCE_EVIDENCE_V1',assessments:s.delta_rows.map(row=>({delta_row_sha256:digest(row),decision:'NO_EXECUTION_DEPENDENCY_OR_EXTERNAL_EFFECT',basis:'Fixture review only; no real product backend claim.'}))};
 const body=audit.canonical({schema_version:'MCFT_CAP09_R4285_RELEASE_NONINTERFERENCE_SEGMENT_V1',...s.binding,review_evidence_sha256:digest(e),review_evidence:e,decision:'ACCEPT_EXACT_DELTA_NO_EXECUTION_DEPENDENCY_OR_EXTERNAL_EFFECT',execution_authorized:false,permit_authorized:false});
 const at=new Date(now-1000).toISOString();
 return {id,reply:{id,url:API+'/issues/comments/'+id,issue_url:API+'/issues/3757',user:{login:'liyongshang44-max'},author_association:'OWNER',created_at:at,updated_at:at,body}};
}
test('incremental: exact real customer TS title and CSS edits need zero Owner comments',t=>{
 const f=incrementalFixture(t),one=f.commit({[COPY]:f.changedCopy}),two=f.commit({[CSS]:f.changedCss});
 for(const [head,count] of [[one,1],[two,2]]){const r=a.evaluateIncremental(f.input(head));assert.equal(r.status,'CANDIDATE_INCREMENTAL_NONINTERFERENCE_PASS_NOT_ADMISSION');assert.equal(r.machine_rows.length,count);assert.equal(r.reviewed_segments.length,0);assert.equal(r.pending_rows.length,0);assert.equal(r.execution_authorized,false);assert.equal(a.isLiveIdentity(r),false);}
});
test('incremental: immutable reviewed prefix reused; only subsequent unknown rows require a new segment',t=>{
 const f=incrementalFixture(t),one=f.commit({'product.ts':'2'}),first=segmentReview(a.planIncremental(f.input(one)),f.subject,one,321);
 const two=f.commit({[COPY]:f.changedCopy,[CSS]:f.changedCss}),pass=a.evaluateIncremental(f.input(two),[first],now);
 assert.equal(pass.status,'CANDIDATE_INCREMENTAL_NONINTERFERENCE_PASS_NOT_ADMISSION');assert.equal(pass.reviewed_segments[0].delta_count,1);assert.equal(pass.machine_rows.length,2);
 const three=f.commit({'new-product.ts':'3'}),hold=a.evaluateIncremental(f.input(three),[first],now);
 assert.equal(hold.status,'HOLD_UNREVIEWED_INCREMENT');assert.equal(hold.pending_rows.length,1);assert.equal(hold.pending_rows[0].path,'new-product.ts');
 const second=segmentReview(a.planIncremental(f.input(three)),one,three,322);
 const done=a.evaluateIncremental(f.input(three),[first,second],now);assert.equal(done.pending_rows.length,0);assert.equal(done.reviewed_segments[1].delta_count,1);assert.equal(done.reviewed_segments[0].review_sha256,pass.reviewed_segments[0].review_sha256);
 for(const invalid of [[second],[second,first],[first,first]])assert.throws(()=>a.evaluateIncremental(f.input(three),invalid,now));
 assert.throws(()=>a.evaluateIncremental(f.input(three,{policySha:'e'.repeat(64)}),[first,second],now),/RELEASE_SEGMENT_BINDING/);
 assert.throws(()=>a.evaluateIncremental(f.input(three),[{...first,reply:{...first.reply,updated_at:new Date(now).toISOString()}},second],now),/RELEASE_SEGMENT_NATIVE_OWNER/);
 assert.throws(()=>a.evaluateIncremental(f.input(three),[{...first,reply:null}],now));
});
test('incremental: mixed product changes are not implicitly safe',t=>{
 const f=incrementalFixture(t),head=f.commit({[CSS]:f.changedCss,'product.ts':'db.write()'});
 const r=a.evaluateIncremental(f.input(head));assert.equal(r.machine_rows.length,1);assert.equal(r.pending_rows.length,1);assert.equal(r.status,'HOLD_UNREVIEWED_INCREMENT');
});
test('incremental: unproven presentation changes, unsafe literals and anchor drift HOLD',t=>{
 const f=incrementalFixture(t),one=f.commit({[CSS]:f.css.replace('  gap: 18px;','  background: url(https://example.invalid/a);')});
 assert.throws(()=>a.evaluateIncremental(f.input(one)),/RELEASE_MACHINE_EFFECT_UNPROVEN/);
 const g=incrementalFixture(t),two=g.commit({[COPY]:g.changedCopy.replace('Farm Operating Overview','${process.env.SECRET}')});
 assert.throws(()=>a.evaluateIncremental(g.input(two)),/RELEASE_MACHINE_EFFECT_UNPROVEN/);
 const h=incrementalFixture(t),input=h.input(h.subject);input.policy={...input.policy,machine_effect_rules:input.policy.machine_effect_rules.map(x=>({...x,anchor_blob:'a'.repeat(40)}))};
 assert.throws(()=>a.evaluateIncremental(input),/RELEASE_MACHINE_ANCHOR_CHANGED/);
});
test('incremental: a protected dependency change and revert can never be reviewed away',t=>{
 const f=incrementalFixture(t);f.commit({'runtime.cjs':'2'});const head=f.commit({'runtime.cjs':'1',[CSS]:f.changedCss});assert.throws(()=>a.evaluateIncremental(f.input(head)),/RELEASE_RELEVANT_CHANGE/);
});
