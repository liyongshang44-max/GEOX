'use strict';
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
function canonical(v){if(Array.isArray(v))return`[${v.map(canonical).join(',')}]`;if(v&&typeof v==='object')return`{${Object.keys(v).sort().map(k=>`${JSON.stringify(k)}:${canonical(v[k])}`).join(',')}}`;return JSON.stringify(v);}
function sha(v){return crypto.createHash('sha256').update(typeof v==='string'?v:canonical(v)).digest('hex');}
function digest(v){return`sha256:${sha(v)}`;}
function required(value,code){if(typeof value!=='string'||!value.trim())throw new Error(code);return value;}
function exactScope(actual,expected,code='SCOPE_MISMATCH'){for(const k of['tenant_id','project_id','group_id','field_id','season_id','zone_id'])if(String(actual?.[k])!==String(expected[k]))throw new Error(`${code}:${k}`);}
function phaseForOrder(order){if(order===1||order===16)return'T16';if(order===24)return'G00';return`T${String(order).padStart(2,'0')}`;}
function phaseForLogicalTime(logical){const hour=new Date(logical).getUTCHours();return`T${String(hour).padStart(2,'0')}`;}
function member(recordSet,type){const values=recordSet.members.filter(x=>x.object_type===type);if(values.length!==1)throw new Error(`MEMBER_CARDINALITY:${type}:${values.length}`);return values[0];}
async function product(root,relative){return import(pathToFileURL(path.join(root,relative)).href);}
function readJson(root,relative){return JSON.parse(fs.readFileSync(path.join(root,relative),'utf8'));}
function factId(prefix,identity){return`fact_${prefix}_${sha(identity).slice(0,32)}`;}
function receipt(spec,role,objectType,objectRef,objectHash,phaseId,logicalTime){return{formal_run_id:spec.formal_run_id,...spec.scope,lineage_id:spec.lineage_id,revision_id:spec.revision_id,member_role:role,object_type:objectType,object_ref:objectRef,object_hash:objectHash,phase_id:phaseId,logical_time:logicalTime};}
module.exports={canonical,sha,digest,required,exactScope,phaseForOrder,phaseForLogicalTime,member,product,readJson,factId,receipt};
