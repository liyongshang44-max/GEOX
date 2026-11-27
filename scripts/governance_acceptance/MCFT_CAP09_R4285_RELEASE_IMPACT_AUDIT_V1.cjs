'use strict';
// Read-only engineering evidence. Never returns an execution/admission capability.
const assert=require('node:assert/strict'),cp=require('node:child_process');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const H=/^[0-9a-f]{40}$/,S=/^[0-9a-f]{64}$/;
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
const canonical=v=>{if(v===null||typeof v==='boolean'||typeof v==='string')return JSON.stringify(v);if(typeof v==='number'){assert(Number.isSafeInteger(v));return String(v);}if(Array.isArray(v))return '['+v.map(canonical).join(',')+']';assert(v&&Object.getPrototypeOf(v)===Object.prototype);return '{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}';};
function safe(p){assert(typeof p==='string'&&p.length&&!/[\x00-\x1f\x7f]/.test(p)&&!p.includes('\\')&&!p.includes(':')&&p.split('/').every(s=>s&&s!=='.'&&s!=='..'),'UNSAFE_PATH');return p;}
function git(root,args){assert(path.isAbsolute(root),'ABSOLUTE_ROOT');const r=cp.spawnSync('git', ['--no-replace-objects','-C',root,...args],{encoding:'buffer',timeout:60000,maxBuffer:64*1024*1024,windowsHide:true});assert(r.status===0&&!r.error,'GIT_READ_FAILED:'+args[0]);return r.stdout;}
function text(root,args){return git(root,args).toString('utf8').trim();}
function parseTree(raw){const out=new Map(),fold=new Set();for(const row of new TextDecoder('utf-8',{fatal:true}).decode(raw).split('\0').filter(Boolean)){const m=/^(\d{6}) (blob|commit) ([0-9a-f]{40})\t(.+)$/.exec(row);assert(m,'TREE_ROW_UNSUPPORTED');const p=safe(m[4]);assert(!fold.has(p.normalize('NFC').toLowerCase()),'TREE_CASE_COLLISION');fold.add(p.normalize('NFC').toLowerCase());out.set(p,{mode:m[1],type:m[2],oid:m[3]});}return out;}
function tree(root,head){assert(H.test(head),'HEAD_ID');return parseTree(git(root,['ls-tree','-r','-z','--full-tree',head]));}
function delta(before,after){const rows=[];for(const p of [...new Set([...before.keys(),...after.keys()])].sort()){const a=before.get(p)||null,b=after.get(p)||null;if(canonical(a)!==canonical(b))rows.push({path:p,before:a,after:b});}return rows;}
function inspect(root,subject,observedMain,dependencies,reviewedRows=[]){
 assert(H.test(subject)&&H.test(observedMain),'HEAD_ID');
 assert.equal(text(root,['rev-parse','--is-shallow-repository']),'false','SHALLOW_HISTORY');
 const chain=text(root,['rev-list','--first-parent',observedMain]).split(/\r?\n/);const at=chain.indexOf(subject);assert(at>=0,'NOT_FIRST_PARENT_ANCESTOR');
 const deps=new Set(dependencies.map(safe));assert(deps.size===dependencies.length&&deps.size>0,'DEPENDENCY_SET');
 const allowed=new Set(reviewedRows.map(x=>canonical(x)));assert.equal(allowed.size,reviewedRows.length,'DUPLICATE_REVIEW');
 let previous=subject,prevTree=tree(root,subject);const relevant=[],unreviewed=[],reviewed=[];
 for(const p of deps)assert(prevTree.has(p),'DEPENDENCY_NOT_IN_RELEASE:'+p);
 for(const head of chain.slice(0,at).reverse()){
  assert(H.test(head),'CHAIN_ID');const next=tree(root,head);
  for(const d of delta(prevTree,next)){
   const row={parent:previous,head,...d};
   if(deps.has(d.path)||[d.before,d.after].some(x=>x&&(x.mode==='120000'||x.mode==='160000'||x.type!=='blob')))relevant.push(row);
   else if(allowed.has(canonical(row)))reviewed.push(row);else unreviewed.push(row);
  }
  previous=head;prevTree=next;
 }
 return {status:relevant.length?'HOLD_RELEVANT_CHANGE':unreviewed.length?'HOLD_UNREVIEWED_CHANGE':'NO_RELEVANT_DELTA_OBSERVED_REVIEW_ONLY',subject_sha:subject,observed_main_sha:observedMain,first_parent_hops:at,relevant,unreviewed,reviewed,execution_authorized:false,permit_authorized:false};
}
function auditClosure({root,bindingFile,materialFile,subject,bindingSha,materialDigest}){
 assert(H.test(subject)&&S.test(bindingSha)&&S.test(materialDigest),'AUDIT_IDENTITY');
 assert.equal(text(root,['rev-parse','HEAD']),subject,'SOURCE_HEAD');assert.equal(text(root,['status','--porcelain','--untracked-files=all']),'','SOURCE_DIRTY');
 const br=fs.readFileSync(bindingFile),binding=JSON.parse(br),material=JSON.parse(fs.readFileSync(materialFile));
 assert.equal(sha(br),bindingSha,'RELEASE_BINDING_DIGEST');assert.equal(sha(canonical(material)),materialDigest,'MATERIAL_DIGEST');
 assert.equal(binding.subject_commit_sha,subject,'RELEASE_SUBJECT');assert.equal(sha(canonical(binding.files)),binding.content_inventory_sha256,'RELEASE_INVENTORY');
 const installed=new Map(material.files.map(x=>[safe(x.path),x.sha256]));assert.equal(installed.size,material.files.length,'MATERIAL_DUPLICATE');
 const tracked=tree(root,subject),bound=new Map(),untrackedBound=[];
 for(const row of binding.files){const p=safe(row.path);assert(S.test(row.sha256)&&!bound.has(p)&&installed.get(p)===row.sha256,'BINDING_MATERIAL_DRIFT:'+p);bound.set(p,row.sha256);if(!tracked.has(p))untrackedBound.push(p);}
 const plannerRel='scripts/governance_acceptance/PLAN_MCFT_CAP_09_CHECK_APPLICABILITY_V1.cjs';
 const qcpRel='docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-QUALIFICATION-CONTROL-PLANE-V1.json';
 const read=p=>{const b=fs.readFileSync(path.join(root,...p.split('/')));assert.equal(sha(b),bound.get(p),'SOURCE_BINDING:'+p);return b;};
 read(plannerRel);const qcp=JSON.parse(read(qcpRel));
 const roots=[...binding.execution_entrypoints,
 'scripts/runtime_acceptance/MCFT_CAP09_R4285_WINDOWS_HOST_EXEC_V3.cjs',
 'scripts/runtime_acceptance/MCFT_CAP09_R4285_RESOURCE_OWNER_PRODUCER_V3.cjs',
 'scripts/cap09_adoption_v1/SIGN_R4285_OWNER_LINEAGE_ADOPTION_V5_TRUST_V2_LOCAL.cjs',
 'scripts/cap09_adoption_v1/MCFT_CAP09_R4285_NATIVE_ADOPTION_CONSUMER_V4.cjs',
 'scripts/runtime_acceptance/RUN_MCFT_CAP09_R4285_PRODUCER_V1.ts',
 'scripts/runtime_acceptance/RUN_MCFT_CAP09_R4285_TIMING_V1.ts',
 'scripts/runtime_acceptance/AGGREGATE_MCFT_CAP09_R4285_TIMING_V1.ts',
 'scripts/runtime_acceptance/MCFT_CAP09_R4285_CONTROLLED_DELAY_V2.cjs',
 'apps/server/src/external_evidence/provider/python/mcft_cap09_gfs_scientific_core_v1.py'];
 const qcpExact=new Set([plannerRel,qcpRel]);for(const [id,r] of Object.entries(qcp.dependency_resolvers)){if(!/^(?:V13_|CAP09_R4285_)/.test(id))continue;if(r.kind==='IMPORT_CLOSURE')roots.push(...r.roots);for(const p of [...(r.paths||[]),...(r.additional_exact_paths||[])])qcpExact.add(safe(p));}
 const graph=require(path.join(root,...plannerRel.split('/'))).buildImportClosure(root,[...new Set(roots.map(safe))]);
 const dependencyCandidates=[...new Set([...graph.paths,...qcpExact])].sort();
 const dynamicReview=[];for(const p of graph.paths.filter(x=>/\.(?:[cm]?js|tsx?|py)$/.test(x))){const body=fs.readFileSync(path.join(root,...p.split('/')),'utf8');const lines=body.split(/\r?\n/);for(let i=0;i<lines.length;i++)if(/\b(?:spawn(?:Sync)?|execFile(?:Sync)?|execSync|createRequire|require\.resolve|readFileSync|readdirSync|globSync|importlib|subprocess|import_module)\b|\brequire\(\s*[^"'\s]|\bimport\(\s*[^"'\s]/.test(lines[i]))dynamicReview.push({path:p,line:i+1});}
 return {status:'CLOSURE_INVENTORY_REVIEW_ONLY_NOT_ADMISSION',subject_sha:subject,release_binding_sha256:bindingSha,material_digest:materialDigest,tracked_tree_count:tracked.size,release_bound_count:bound.size,material_count:installed.size,roots:[...new Set(roots)].sort(),literal_import_paths:graph.paths,unresolved_literal_imports:graph.missing,qcp_exact_paths:[...qcpExact].sort(),dependency_candidates:dependencyCandidates,not_bound_in_release:dependencyCandidates.filter(p=>!bound.has(p)),not_in_source:dependencyCandidates.filter(p=>!tracked.has(p)),untracked_bound_paths:untrackedBound.sort(),dynamic_review_sites:dynamicReview,release_bound_paths:[...bound.keys()].sort(),execution_authorized:false,permit_authorized:false};
}
if(require.main===module){try{const [root,bindingFile,materialFile,subject,bindingSha,materialDigest]=process.argv.slice(2);assert.equal(process.argv.length,8,'USAGE: node audit.cjs SOURCE BINDING MATERIAL SUBJECT BINDING_SHA MATERIAL_DIGEST');console.log(JSON.stringify(auditClosure({root,bindingFile,materialFile,subject,bindingSha,materialDigest})));}catch(e){console.error(JSON.stringify({status:'HOLD_RELEASE_AUDIT',reason:String(e.message).split('\n')[0],execution_authorized:false}));process.exitCode=2;}}
module.exports={canonical,parseTree,delta,inspect,auditClosure};
