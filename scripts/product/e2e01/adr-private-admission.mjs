// Local single-process E2E01 trusted composition. No environment credential fallback.
// The caller must pin the exact Owner-authenticated local approval bytes independently;
// a self-asserted file, an IAM/source-rights grant, or a request body is not an approval.
import {createHash,randomBytes} from 'node:crypto';
import {lstatSync,readFileSync,existsSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
export const canonical=x=>JSON.stringify(x,(_k,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);
export const sha=x=>'sha256:'+createHash('sha256').update(x).digest('hex');
const same=(a,b)=>canonical(a)===canonical(b);
const hash=x=>typeof x==='string'&&/^sha256:[a-f0-9]{64}$/.test(x);
const must=(x)=>{if(!x)throw Error('E2E01_PRIVATE_ADMISSION_DENIED');};
const keys=(x,k)=>x&&typeof x==='object'&&!Array.isArray(x)&&same(Object.keys(x).sort(),[...k].sort());
const safeFile=p=>{const s=lstatSync(p);must(s.isFile()&&!s.isSymbolicLink()&&s.size>0&&s.size<262144);return readFileSync(p);};
const validTime=x=>typeof x==='string'&&Number.isFinite(Date.parse(x))&&new Date(x).toISOString()===x;
export const ownerDisplaySchema='geox.e2e01.owner-display-admission.v1';
export function sealOwnerDisplayApproval(basis){return {...structuredClone(basis),approval_ref:sha(canonical(basis))};}
// Approval is a local owner attestation, not a new native AuthorityLedger object.
// Protected directory + independent expected file digest are the local trust boundary.
export function createOwnerDisplayApprovalLoader({approvalPath,expectedFileSha256,revocationPath,managerPolicyPath,managerPolicySha256,checkpointSha256,ownerSubject,binding,rightsEnd,clock=Date.now}){
 must([approvalPath,revocationPath,managerPolicyPath].every(x=>typeof x==='string'&&resolve(x)===x)&&approvalPath!==revocationPath&&dirname(approvalPath)===dirname(revocationPath)&&hash(expectedFileSha256)&&hash(managerPolicySha256)&&hash(checkpointSha256)&&validTime(rightsEnd));
 const exactBinding=structuredClone(binding);
 return async()=>{
  try{
   // A dangling symlink or unreadable revocation path must deny, not mean absent.
   try{lstatSync(revocationPath);return null;}catch(e){if(e.code!=='ENOENT')return null;}
   const parent=lstatSync(dirname(approvalPath));must(parent.isDirectory()&&!parent.isSymbolicLink());
   const bytes=safeFile(approvalPath);must(sha(bytes)===expectedFileSha256&&sha(safeFile(managerPolicyPath))===managerPolicySha256);
   const a=JSON.parse(bytes.toString('utf8')), {approval_ref,...basis}=a;
   must(keys(a,['schema','decision','status','owner_subject','owner_authentication_sha256','checkpoint_sha256','manager_policy_sha256','binding','viewer_jurisdiction','purpose','approved_at','valid_until','approval_ref'])&&a.schema===ownerDisplaySchema&&a.decision==='AUTHORIZE_BOUNDED_DISPLAY_ADMISSION'&&a.status==='ACTIVE'&&a.owner_subject===ownerSubject&&hash(a.owner_authentication_sha256)&&a.checkpoint_sha256===checkpointSha256&&a.manager_policy_sha256===managerPolicySha256&&same(a.binding,exactBinding)&&a.viewer_jurisdiction===exactBinding.member.jurisdiction&&a.purpose==='GEOX_CUSTOMER_EVIDENCE'&&approval_ref===sha(canonical(basis)));
   const now=clock();must(validTime(a.approved_at)&&validTime(a.valid_until)&&Date.parse(a.approved_at)<=now&&now<Date.parse(a.valid_until)&&Date.parse(a.valid_until)<=Date.parse(rightsEnd)&&Date.parse(a.valid_until)-Date.parse(a.approved_at)<=7*86400000);
   return {status:'ACTIVE',permission:'ADR_A07_CUSTOMER_EVIDENCE_DISPLAY',approval_ref,valid_until:a.valid_until,binding:structuredClone(exactBinding)};
  }catch{return null;}
 };
}
const ops=Object.freeze({A01:Object.freeze(['createDecisionProblem']),A07:Object.freeze(['executeKnowledgeRetrieval','resolveCustomerEvidence'])});
const principalKey=p=>JSON.stringify({principalId:p.principalId,type:p.type,organizationId:p.organizationId,tenantId:p.tenantId??null,programIds:[...p.programIds].sort()});
const principalOk=p=>p&&p.type==='SERVICE_ACCOUNT'&&[p.principalId,p.organizationId,p.tenantId].every(x=>typeof x==='string'&&x.length>0)&&Array.isArray(p.programIds)&&p.programIds.length===1&&typeof p.programIds[0]==='string'&&p.programIds[0].length>0;
// Preparation lane ONLY. Credentials are random, ephemeral isolated harness values,
// never Keycloak credentials or authorization to activate the actual service clients.
// The formal start adapter will require its own explicit CTO/Owner run admission.
export function createIsolatedPrivateCredentialBinding({runtime,a01,a07,clock=Date.now,validUntilMs}){
 must(runtime?.ready===true&&runtime.metadata?.mode==='TEST_ONLY_GEOX_JOINT_BROWSER'&&runtime.tokenBindings instanceof Map&&runtime.tokenBindings.size===0&&runtime.tokenOperationPolicies instanceof Map&&runtime.tokenOperationPolicies.size===0&&principalOk(a01)&&principalOk(a07)&&a01.principalId!==a07.principalId&&same([a01.organizationId,a01.tenantId,a01.programIds],[a07.organizationId,a07.tenantId,a07.programIds])&&Number.isFinite(validUntilMs)&&validUntilMs>clock()&&validUntilMs<=clock()+900000);
 const values=new Map(),tokens=runtime.tokenBindings,policies=runtime.tokenOperationPolicies;let closed=false;
 for(const [ref,p] of [['A01',a01],['A07',a07]]){const token=randomBytes(32).toString('base64url');const actor=structuredClone(p);values.set(ref,token);tokens.set(token,actor);policies.set(principalKey(actor),[...ops[ref]]);}
 const close=()=>{closed=true;for(const t of values.values())tokens.delete(t);values.clear();policies.delete(principalKey(a01));policies.delete(principalKey(a07));clearTimeout(timer);};
 const timer=setTimeout(close,Math.max(1,validUntilMs-clock()));timer.unref?.();
 return Object.freeze({getCredential(ref){if(closed||clock()>=validUntilMs){close();return null;}return values.get(ref)??null;},close});
}
// Explicit private transport adapter: no arbitrary origins, redirects, browser
// credentials or public ADR listener. Only known operations over loopback.
export function createPrivateLoopbackTransport({port,logicalOrigin='https://adr.e2e01.private.invalid',fetchImpl=fetch}){
 must(Number.isInteger(port)&&port>0&&port<=65535&&new URL(logicalOrigin).origin===logicalOrigin&&logicalOrigin.startsWith('https://'));
 const allowed=new Set(['/v1/decision-problems','/v1/knowledge-retrieval-results','/v1/customer-evidence/resolve']);
 return async(url,init)=>{const u=new URL(String(url));must(u.origin===logicalOrigin&&!u.username&&!u.password&&!u.search&&!u.hash&&allowed.has(u.pathname)&&init?.method==='POST'&&init.redirect==='error');return fetchImpl('http://127.0.0.1:'+port+u.pathname,{...init,redirect:'error'});};
}
