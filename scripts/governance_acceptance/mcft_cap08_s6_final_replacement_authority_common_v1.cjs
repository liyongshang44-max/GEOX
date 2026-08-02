'use strict';
const A=require('node:assert/strict'),C=require('node:crypto'),X=require('node:child_process'),F=require('node:fs'),P=require('node:path');
const R=P.resolve(__dirname,'../..'),D='docs/digital_twin/mcft/cap_08',q=n=>`${D}/${n}`;
const paths={
 B:q('GEOX-MCFT-CAP-08-S6-FINAL-REPLACEMENT-FORMAL-EXECUTION-AUTHORITY-BOUNDARY-V1.json'),
 I:q('GEOX-MCFT-CAP-08-S6-FINAL-REPLACEMENT-FORMAL-EXECUTION-AUTHORITY-ISSUANCE-V1.json'),
 M:q('GEOX-MCFT-CAP-08-S6-FINAL-REPLACEMENT-FORMAL-EXECUTION-AUTHORITY-OBJECT-SET-V1.json'),
 A:q('GEOX-MCFT-CAP-08-S6-FINAL-REPLACEMENT-FORMAL-RUN-A-AUTHORITY-V1.json'),
 Z:q('GEOX-MCFT-CAP-08-S6-FINAL-REPLACEMENT-FORMAL-RUN-B-AUTHORITY-V1.json'),
 W:'.github/workflows/mcft-cap-08-s6-final-replacement-formal-execution-authority.yml',
 H:'scripts/governance_acceptance/mcft_cap08_s6_final_replacement_authority_common_v1.cjs',
 V:'scripts/governance_acceptance/mcft_cap08_s6_final_replacement_authority_checks_v1.cjs',
 E:'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_08_S6_FINAL_REPLACEMENT_FORMAL_EXECUTION_AUTHORITY_V1.cjs'
};
const O=P.join(R,'acceptance-output/MCFT_CAP_08_S6_FINAL_REPLACEMENT_FORMAL_EXECUTION_AUTHORITY_RESULT.json');
const text=p=>F.readFileSync(P.join(R,p),'utf8'),json=p=>JSON.parse(text(p)),git=(...a)=>X.execFileSync('git',a,{cwd:R,encoding:'utf8'}).trim();
const canon=v=>Array.isArray(v)?`[${v.map(canon)}]`:v&&typeof v==='object'?`{${Object.keys(v).sort().map(k=>`${JSON.stringify(k)}:${canon(v[k])}`).join(',')}}`:JSON.stringify(v);
const sem=v=>{v=structuredClone(v);delete v.semantic_digest;return`sha256:${C.createHash('sha256').update(canon(v)).digest('hex')}`};
const output=v=>{F.mkdirSync(P.dirname(O),{recursive:true});F.writeFileSync(O,JSON.stringify(v,null,2)+'\n')};
const pin=(base,p,s,l)=>{A.match(s,/^[0-9a-f]{40}$/,`${l}:SHA`);A.equal(git('rev-parse',`${base}:${p}`),s,`${l}:DRIFT`)};
function candidate(base,b){const p=git('rev-list','--parents','-n','1','HEAD').split(/\s+/);let h='HEAD';if(p.length===3){A.equal(p[1],base,'MERGE_BASE');h=p[2]}else A.equal(p.length,2,'PARENTS');h=git('rev-parse',h);A.equal(git('merge-base',base,h),base,'ANCESTOR');A.equal(git('rev-list','--count',`${base}..${h}`),'1','COMMITS');A.equal(git('diff','--check',`${base}...${h}`),'','DIFF_CHECK');const c=git('diff','--name-only',`${base}...${h}`).split(/\r?\n/).filter(Boolean).sort();A.deepEqual(c,[...b.changed_files].sort(),'BOUNDARY');A.equal(c.length,9);A.deepEqual(c.filter(p=>/^(apps|packages|db|scripts\/runtime_acceptance)\//.test(p)||p.includes('qualification_ports')),[],'PROTECTED_CHANGE');return h}
const statuses={recovery_adjudication:'FORMAL_AUTHORITY_CHAIN_RECOVERY_ADJUDICATED',product_effectiveness:'MERGED_MAIN_PRODUCT_IMPLEMENTATION_EFFECTIVE',orchestrator_effectiveness:'FINAL_FORMAL_RUN_ORCHESTRATOR_IMPLEMENTED_EFFECTIVE',workflow_effectiveness:'SINGLE_RUN_DATABASE_EXECUTION_WORKFLOW_CONTROL_PLANE_IMPLEMENTED_EFFECTIVE',port_bundle_effectiveness:'EXACT_DATABASE_PORT_BUNDLE_EFFECTIVE'};
function predecessors(base,x){A.deepEqual(Object.keys(x).sort(),Object.keys(statuses).sort(),'PREDECESSOR_KEYS');for(const[n,r]of Object.entries(x)){A.equal(r.required_status,statuses[n],`${n}:EXPECTED`);pin(base,r.path,r.blob_sha,n);A.equal(JSON.parse(git('show',`${base}:${r.path}`)).record_status,r.required_status,`${n}:STATUS`)}}
module.exports={A,R,paths,text,json,git,sem,output,pin,candidate,predecessors};
