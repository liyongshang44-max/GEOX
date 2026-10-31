'use strict';
/*
 * R4285 registered-source Windows readback. READ ONLY, non-authorizing.
 * Closed world: adopted CAP-09 TEST_ONLY Permit V1/V2 source registration;
 * NOT a claim that arbitrary external Windows software/roots do not exist.
 * No caller-controlled roots, trust, scope, keys, or grants.
 */
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),crypto=require('node:crypto');
const REPO='liyongshang44-max/GEOX';
const MERGE='96861b78674571adf4414b88c3a2894b61de2eb5';
const SOURCE='3dd409810748b5ef9f361fb1b7a2003786e4475b';
const BASE='43b7c467fe1eb55eb72359d0d15372feccf8f1cb';
const POLICY='docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP09-R4285-FORMAL-AUTHORITY-SOURCE-SCOPE-REVIEW-20261031.md';
const POLICY_BLOB='3af5f7cad328c5f856e64db111d12a0d5c789666';
const POLICY_SHA='ffb5742647594ec1ac144f1d3831ecbbffe2144bd9a765c1a8d4f3c855c30b62';
const TRUST='scripts/runtime_acceptance/MCFT_CAP09_RETRY_TRUST_V1.json';
const TRUST_BLOB='61d7949d49a2707aef5844e90440c4566584fbe7';
const TRUST_SHA='dce2a16f6a82779873dfe25b30194f0445f23b894f5eb41c41a7274b1eb19cf7';
const RUN='4285c3ce342c',HOST='LAPTOP-STN2A2P1';
const ROOT='D:\\gptdown\\MCFT-CAP09-AUTHORITY-LEDGER';
const OLD_V1='da9db7129607',OLD_V2='6ff9b41f6f7f';
const V1_SHA='f8c55961e2b4972e8e2b92ad0d788b6030240f97e2bc274edf206fb5833ea21a';
const V2_SHA='753c83f4dbc87ee91d8ee01499353940b29009f3671616826dba5da32ddd94fb';
const SOURCE_BLOBS=Object.freeze({
 'scripts/runtime_acceptance/MCFT_CAP09_RETRY_PERMIT_V1.cjs':'80a7c6d721a219430d9d99e9cad075bc9cdf6e41',
 'scripts/runtime_acceptance/MCFT_CAP09_GOVERNED_RETRY_HOST_V1.cjs':'77e726f1e0ee4a623d6ea7492f660accd424cbe0',
 'scripts/runtime_acceptance/MCFT_CAP09_WINDOWS_LOCAL_QUALIFICATION_ENTRY_V1.ps1':'fe0332a0804f300af34e8f21ac6be94b623d27c8',
 'scripts/cap09_adoption_v1/da9-retry-bundle.cjs':'fad9380056e3e0fc2925295984b50f2580152984',
 'scripts/cap09_adoption_v1/da9-retry-bundle-v2.cjs':'d39d3e9c0cee9e0554475a44a24c8766b328be6c',
 'scripts/runtime_acceptance/MCFT_CAP09_ATTEMPT3_PERMIT_V2_READONLY.cjs':'4529af70366d925e57c6ceed14043edf09cd2e5a',
 'scripts/runtime_acceptance/MCFT_CAP09_ATTEMPT3_PERMIT_V2_ATOMIC.cjs':'ae142ad854ed7ba6c8b84aa6297330076182ae10',
 'scripts/runtime_acceptance/MCFT_CAP09_ATTEMPT3_HOST_V2.cjs':'318f5abda2396fb6eed5fbffcc40a0b109193ccd',
 'scripts/cap09_adoption_v1/MCFT_CAP09_R4285_NATIVE_ADOPTION_CONSUMER_V1.cjs':'97e7728ac059e6cbd1b752c396f68a9a336729c3',
 'scripts/runtime_acceptance/MCFT_CAP09_R4285_HOST_SIGNED_EVIDENCE_PREFLIGHT_V1.cjs':'e264609349fb9f81e7bb09617e4001abfbc165fc'
});
const H64=/^[a-f0-9]{64}$/,H40=/^[a-f0-9]{40}$/,ID=/^[a-f0-9]{12}$/;
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
function guard(condition,reason){if(!condition)throw Error('HOLD_R4285_'+reason);}
function regular(file,max=8*1024*1024){
 const s=fs.lstatSync(file);guard(s.isFile()&&!s.isSymbolicLink()&&s.size>0&&s.size<=max,'FILE_INVALID:'+path.basename(file));
 return fs.readFileSync(file);
}
function directory(dir){
 guard(path.isAbsolute(dir),'ABSOLUTE_DIRECTORY_REQUIRED');
 let at=path.resolve(dir);
 for(;;){const s=fs.lstatSync(at);guard(s.isDirectory()&&!s.isSymbolicLink(),'DIRECTORY_LINK_OR_MISSING:'+path.basename(at));
  guard(path.resolve(fs.realpathSync.native(at)).toLowerCase()===at.toLowerCase(),'DIRECTORY_REPARSE:'+path.basename(at));
  const parent=path.dirname(at);if(parent===at)break;at=parent;
 }
}
function fixedSourceFile(root,rel){
 guard(rel.split('/').every(x=>/^[A-Za-z0-9_.-]+$/.test(x)&&x!=='.'&&x!=='..'),'SOURCE_RELATIVE');
 let at=root;directory(at);
 for(const seg of rel.split('/').slice(0,-1)){at=path.join(at,seg);directory(at);}
 return regular(path.join(root,...rel.split('/')));
}
function git(root,...args){return cp.execFileSync('git',['-C',root,...args],
 {encoding:'utf8',timeout:30000,maxBuffer:2*1024*1024,windowsHide:true}).trim();}
function curlJson(url){
 const raw=cp.execFileSync('curl.exe',['--fail','--silent','--show-error','--location','--max-time','25',
  '-H','Accept: application/vnd.github+json','-H','X-GitHub-Api-Version: 2022-11-28',url],
  {encoding:'utf8',timeout:30000,maxBuffer:2*1024*1024,windowsHide:true});
 return JSON.parse(raw);
}
function verifyNativeRegistration(root){
 guard(process.platform==='win32'&&!process.env.CI&&!process.env.GITHUB_ACTIONS,'WINDOWS_NATIVE_ONLY');
 for(const k of ['NODE_OPTIONS','NODE_PATH','PYTHONPATH','PYTHONHOME'])guard(!process.env[k],'INJECTION_ENV:'+k);
 directory(root);
 const head=git(root,'rev-parse','HEAD');
 guard(H40.test(head),'SOURCE_HEAD_INVALID');
 guard(git(root,'status','--porcelain','--untracked-files=all')==='','SOURCE_DIRTY');
 const remote=git(root,'ls-remote','origin','refs/heads/main').split(/\s+/)[0];
 guard(remote===head,'REMOTE_MAIN_OR_LOCAL_HEAD_MISMATCH');
 guard(cp.spawnSync('git',['-C',root,'merge-base','--is-ancestor',MERGE,head],
  {timeout:30000,windowsHide:true}).status===0,'POLICY_MERGE_NOT_ANCESTOR');
 for(const [rel,blob] of [[POLICY,POLICY_BLOB],[TRUST,TRUST_BLOB],...Object.entries(SOURCE_BLOBS)]){
  guard(git(root,'rev-parse',MERGE+':'+rel)===blob,'REGISTERED_BLOB_DRIFT:'+rel);
  guard(git(root,'rev-parse','HEAD:'+rel)===blob,'SOURCE_VERSION_UNREGISTERED:'+rel);
  guard(git(root,'hash-object','--',path.join(root,...rel.split('/')))===blob,'INSTALLED_BYTES_DRIFT:'+rel);
 }
 const policy=fixedSourceFile(root,POLICY),tb=fixedSourceFile(root,TRUST);
 guard(sha(policy)===POLICY_SHA&&sha(tb)===TRUST_SHA,'POLICY_OR_TRUST_RAW_SHA');
 const trust=JSON.parse(tb.toString('utf8'));
 guard(trust.schema_version==='geox_mcft_cap09_retry_trust_v1'&&trust.host_id===HOST&&
   trust.operator_id==='mcft_cap09_operator_mylr1'&&trust.ledger_root===ROOT&&
   trust.adopted===false&&trust.execution_enabled===false,'TRUST_SCOPE_OR_FLAGS');
 guard(Array.isArray(trust.issuers)&&trust.issuers.length===2,'REGISTERED_ISSUER_COUNT');
 const identities=[
  ['mcft_cap09_operator_mylr1','ACCOUNTABLE_SINGLE_OPERATOR','223c806e89c4e6df5e91a089e0b22e5cef05934d42ee7df817faaeaa67553365'],
  ['mcft_cap09_independent_retry_governance','INDEPENDENT_RETRY_GOVERNANCE','ef7459a5918e35c90913532a7c8af545fbca4fec0b7dc95916797db3303fa870']
 ];
 for(let i=0;i<2;i++){
  const k=trust.issuers[i],e=identities[i];
  guard(k.issuer_id===e[0]&&k.role===e[1]&&k.spki_sha256===e[2]&&!k.revoked,'ISSUER_UNREGISTERED_OR_REVOKED');
  const pub=crypto.createPublicKey(k.public_key_pem);
  guard(pub.asymmetricKeyType==='ed25519'&&sha(pub.export({type:'spki',format:'der'}))===e[2],'ISSUER_KEY_MISMATCH');
  guard(Date.now()>=Date.parse(k.not_before)&&Date.now()<Date.parse(k.not_after),'ISSUER_EXPIRED');
 }
 const url='https://api.github.com/repos/'+REPO;
 const pr=curlJson(url+'/pulls/3752'),commit=curlJson(url+'/git/commits/'+MERGE);
 const main=curlJson(url+'/git/ref/heads/main');
 guard(pr.merged===true&&pr.merge_commit_sha===MERGE&&pr.head?.sha===SOURCE&&pr.base?.sha===BASE,
   'NATIVE_POLICY_PR_IDENTITY');
 guard(pr.merged_by?.login==='liyongshang44-max'&&pr.merged_by?.type==='User','NATIVE_OWNER_MERGER');
 guard(commit.verification?.verified===true&&commit.tree?.sha==='1e94d64e4fcf6f6067268066f4bb0b868fb644ec'&&
  JSON.stringify(commit.parents?.map(x=>x.sha))===JSON.stringify([BASE,SOURCE]),'NATIVE_MERGE_VERIFICATION');
 guard(main.object?.sha===head,'NATIVE_REMOTE_MAIN_CHANGED');
 return {head,trust,source_blobs:SOURCE_BLOBS,policy_sha256:sha(policy),trust_sha256:sha(tb)};
}
const STAGES=Object.freeze(['A0','A18D','O00','O01','O02','O03','O04','O05','O06','O07','O08','O09','O10','O11','O12','O13','O14','O15','O16','O17','O18','O19','O20','O21','O22','O23']);
// Only the root's run/nonce namespaces are globally significant. Historical
// per-run non-Permit artifacts are indexed as bytes, never interpreted as grants.
function fullIndex(root){
 directory(root);
 let entries=[],num=0,total=0;
 function walk(at,relative,depth){
  guard(depth<=7,'LEDGER_INDEX_DEPTH_LIMIT');
  const names=fs.readdirSync(at).sort();
  guard(names.length<=512,'LEDGER_DIRECTORY_TRUNCATED');
  for(const name of names){
   guard(name!=='.'&&name!=='..'&&!name.includes('/')&&!name.includes('\\'),'LEDGER_BAD_NAME');
   const rel=relative?relative+'/'+name:name,file=path.join(at,name);
   if(depth===0)guard(/^run-[a-f0-9]{12}$/.test(name)||/^nonce-[a-f0-9]{64}$/.test(name),
    'UNREGISTERED_ROOT_CHILD:'+name);
   const s=fs.lstatSync(file,{bigint:true});
   guard(!s.isSymbolicLink(),'LEDGER_SYMLINK:'+rel);
   num++;guard(num<=2048,'LEDGER_SCAN_TRUNCATED');
   if(s.isDirectory()){
    guard(path.resolve(fs.realpathSync.native(file)).toLowerCase()===path.resolve(file).toLowerCase(),
      'LEDGER_REPARSE:'+rel);
    entries.push([rel,'D',String(s.dev),String(s.ino),String(s.mtimeNs),String(s.ctimeNs)]);
    walk(file,rel,depth+1);
   }else{
    guard(s.isFile()&&s.size>0n&&s.size<=8n*1024n*1024n,'LEDGER_FILE_BOUND:'+rel);
    total+=Number(s.size);guard(total<=96*1024*1024,'LEDGER_BYTES_TRUNCATED');
    const data=fs.readFileSync(file);
    guard(BigInt(data.length)===s.size,'LEDGER_RACE_SIZE:'+rel);
    entries.push([rel,'F',String(s.dev),String(s.ino),String(s.size),String(s.mtimeNs),String(s.ctimeNs),sha(data)]);
   }
  }
 }
 walk(root,'',0);
 return {entries,sha256:sha(Buffer.from(JSON.stringify(entries))),files:entries.filter(x=>x[1]==='F').length,
 directories:entries.filter(x=>x[1]==='D').length};
}
function consumedRead(root,runId,expectedSha,expectedSchema){
 guard(ID.test(runId)&&H64.test(expectedSha),'CONSUMED_ID_INVALID');
 const at=path.join(root,'run-'+runId);
 directory(at);
 const data=regular(path.join(at,'CONSUMED.json'));
 const record=JSON.parse(data.toString('utf8'));
 guard(record.schema_version===expectedSchema,'CONSUMED_SCHEMA:'+runId);
 const p=expectedSchema.endsWith('_v1')?record.payload:record;
 guard(p?.run_id===runId&&H64.test(p.nonce),'CONSUMED_RUN_NONCE:'+runId);
 guard(record.status==='CONSUMED_NO_AUTOMATIC_RETRY'&&record.execute_authorized===false,
  'CONSUMED_STATUS:'+runId);
 guard(expectedSchema.endsWith('attempt3_v2')?record.production_authorized===false:true,'CONSUMED_PRODUCTION:'+runId);
 const nr=path.join(root,'nonce-'+p.nonce);
 directory(nr);
 const sibling=regular(path.join(nr,'CONSUMED.json'));
 guard(data.equals(sibling),'DUAL_LEDGER_BYTES:'+runId);
 guard(sha(data)===expectedSha,'HISTORICAL_CONSUMED_DIGEST:'+runId);
 return {run_id:runId,nonce:p.nonce,consumed_sha256:sha(data),schema_version:record.schema_version,
  pair_bytes_equal:true,production_authorized:false};
}
function auditFixedLedger(root){
 const before=fullIndex(root);
 const rows=[
  consumedRead(root,OLD_V1,V1_SHA,'geox_mcft_cap09_consumed_permit_v1'),
  consumedRead(root,OLD_V2,V2_SHA,'geox_mcft_cap09_consumed_permit_attempt3_v2')
 ];
 const after=fullIndex(root);
 guard(JSON.stringify(before.entries)===JSON.stringify(after.entries),'LEDGER_TOCTOU_CHANGED');
 const consumedRuns=before.entries.filter(x=>x[1]==='D'&&/^run-[a-f0-9]{12}$/.test(x[0])).map(x=>x[0].slice(4)).sort();
 const consumedNonces=before.entries.filter(x=>x[1]==='D'&&/^nonce-[a-f0-9]{64}$/.test(x[0])).map(x=>x[0].slice(6)).sort();
 guard(JSON.stringify(consumedRuns)===JSON.stringify([OLD_V1,OLD_V2].sort()),'EXTRA_OR_MISSING_RUN_SLOT');
 guard(JSON.stringify(consumedNonces)===JSON.stringify(rows.map(r=>r.nonce).sort()),'EXTRA_OR_MISSING_NONCE_SLOT');
 return {snapshot_before_sha256:before.sha256,snapshot_after_sha256:after.sha256,
  indexed_files:after.files,indexed_directories:after.directories,consumed:rows};
}
function runNative(argv,root=path.resolve(__dirname,'../..')){
 guard(argv.length===1&&argv[0]==='--readback-only','READBACK_ONLY_CLI');
 guard(process.platform==='win32'&&!process.env.CI&&!process.env.GITHUB_ACTIONS,'WINDOWS_ONLY');
 const registered=verifyNativeRegistration(root);
 const review=auditFixedLedger(registered.trust.ledger_root);
 return Object.freeze({schema_version:'MCFT_CAP09_R4285_AUTHORITY_ROOT_REGISTRY_READBACK_V1',
  status:'REGISTERED_SOURCE_LEDGER_READBACK_COMPLETE_TEST_ONLY_NOT_OWNER_APPROVAL',
  host_id:HOST,run_id:RUN,source_head_sha:registered.head,
  scope:'ALL_REGISTERED_CAP09_FORMAL_PERMIT_AUTHORITIES',
  scope_limit:'REGISTERED_CAP09_TEST_ONLY_NOT_ALL_WINDOWS_SOURCES',
  source_policy_merge_sha:MERGE,source_policy_sha256:registered.policy_sha256,
  source_trust_sha256:registered.trust_sha256,registered_source_count:Object.keys(SOURCE_BLOBS).length,
  registered_sources:Object.keys(SOURCE_BLOBS).sort(),registered_issuer_count:registered.trust.issuers.length,
  registered_authority_roots:[registered.trust.ledger_root],enumeration_complete:true,
  unknown_authority_sources_count:0,unreadable_sources_count:0,scan_truncated:false,
  ledger:review,authorized_by_owner:false,owner_ordinal_adjudicated:false,permit_authorized:false,
  permit_issued:false,permit_consumed_by_this_readback:false,execution_authorized:false,
  production_authorized:false});
}
if(require.main===module){
 try{console.log(JSON.stringify(runNative(process.argv.slice(2)),null,2));}
 catch(e){console.error(JSON.stringify({status:'HOLD_REGISTERED_SOURCE_OR_WINDOWS_LEDGER_READBACK',
  blocker:String(e.message||e).slice(0,400),registered_source_completeness:'HOLD',
  ledger_readback:'HOLD',owner_signature:'HOLD',permit_authorized:false,execution_authorized:false,
  production_authorized:false}));process.exitCode=1;}
}
module.exports={MERGE,SOURCE,BASE,POLICY_SHA,TRUST_SHA,ROOT,RUN,HOST,SOURCE_BLOBS,
 verifyNativeRegistration,fullIndex,consumedRead,auditFixedLedger,runNative};
