import {createHash} from 'node:crypto';
export const field='field_geox_e2e01_001';
export const scope=Object.freeze({tenant_id:'tenant_geox_e2e01',project_id:'project_geox_e2e01',group_id:'group_geox_e2e01'});
export const issuer='https://auth.fdw.localhost:18443/realms/fdw-local';
export const tenant=Object.freeze({issuer,id:'fdw-local-tenant-a',version:'1'});
export const membership=Object.freeze({issuer,id:'group:/fdw-manager-a',version:'1'});
export const fieldActions=Object.freeze(['UPDATE_FIELD','READ_FIELD_GEOMETRY','READ_SOIL_DOCUMENT','UPLOAD_SOIL_DOCUMENT','CONFIRM_SOIL_DOCUMENT','REQUEST_CROP_REVIEW','READ_CROP_REVIEW']);
export const hash=x=>createHash('sha256').update(x).digest('hex');
const base='/api/v1/manager/fields', f=base+'/'+field, soil='/api/v1/fields/'+field+'/soil-documents', id='[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}';
export function managerRoute(method,path){
 if(typeof path!=='string'||path.includes('?')||path.includes('%')||path.includes('\\'))return false;
 if(path===base)return method==='GET'||method==='POST';
 if(path===f)return method==='PUT';
 if(path===f+'/geometry')return method==='GET';
 if(path===soil)return method==='GET'||method==='POST';
 if(new RegExp('^'+soil+'/'+id+'/confirm$').test(path))return method==='POST';
 if(path===f+'/crop-reviews')return method==='GET'||method==='POST';
 if(new RegExp('^'+f+'/crop-reviews/'+id+'$').test(path))return method==='GET';
 if(new RegExp('^'+f+'/crop-reviews/'+id+'/native-assessment$').test(path))return method==='GET'||method==='POST';
 if(new RegExp('^'+f+'/crop-reviews/'+id+'/scientific-result$').test(path))return method==='GET';
 return false;
}
export function createBodyAllowed(body){
 return !!body&&typeof body==='object'&&!Array.isArray(body)&&body.field_id===field&&Object.keys(body).every(k=>['field_id','name','area_ha'].includes(k));
}
const same=(a,b)=>!!a&&a.issuer===b.issuer&&a.id===b.id&&a.version===b.version;
export function validatePolicy(p,subject){
 if(!p||p.schema!=='geox.local-owner-land-grants.e2e01.v1'||p.decision!=='AUTHORIZE_BOUNDED_MANAGER_INTEGRATION'||p.subject!==subject||
 !['REVOKED','ACTIVE'].includes(p.create_status)||!Number.isSafeInteger(p.revision)||p.revision<1||
 !Array.isArray(p.field_grants)||new Set(p.field_grants).size!==p.field_grants.length||!p.field_grants.every(a=>fieldActions.includes(a))||
 !['PREWRITE','CREATE','FIELD'].includes(p.phase)||p.phase==='PREWRITE'&&(p.create_status!=='REVOKED'||p.field_grants.length)||
 p.phase==='CREATE'&&(p.create_status!=='ACTIVE'||p.field_grants.length)||p.phase==='FIELD'&&p.create_status!=='REVOKED')throw Error('E2E01_OWNER_POLICY_INVALID');
 return p;
}
export function directory(readPolicy,subject,fieldExists,clock=Date.now){
 if(!/^[a-f0-9-]{36}$/.test(subject))throw Error('E2E01_SUBJECT_REQUIRED');
 const load=a=>{
  if(a.issuer!==issuer||a.subject!==subject||a.principal_kind!=='HUMAN'||a.membership_status!=='ACTIVE'||a.mapping_version!=='fdw-local-mapping-v1'||!same(a.canonical_tenant_ref,tenant)||!same(a.membership_ref,membership))return null;
  const p=validatePolicy(readPolicy(),subject), now=clock();
  return {p,common:{status:'ACTIVE',issuer,subject,canonical_tenant_ref:tenant,membership_ref:membership,mapping_version:a.mapping_version,source_ref:{issuer:'urn:geox:local-owner:e2e01',id:'explicit-land-grants',version:String(p.revision)+':'+hash(JSON.stringify(p))},checked_at:new Date(now).toISOString(),valid_until:new Date(now+15000).toISOString()}};
 };
 const grant=(d,action,fid)=>({...d.common,...scope,actor_id:'fdw_'+subject,field_id:fid,action});
 return {
  async resolveLandGrant({assertion,field_id,action}){
   const d=load(assertion);if(!d)return null;
   if(action==='CREATE_FIELD')return field_id===null&&d.p.phase==='CREATE'&&d.p.create_status==='ACTIVE'?grant(d,action,null):null;
   return field_id===field&&d.p.phase==='FIELD'&&d.p.field_grants.includes(action)&&await fieldExists()?grant(d,action,field):null;
  },
  async resolveLandInventory({assertion}){
   const d=load(assertion);if(!d)return null;
   const grants=d.p.phase==='FIELD'&&d.p.field_grants.includes('READ_FIELD_GEOMETRY')&&await fieldExists()?[grant(d,'READ_FIELD_GEOMETRY',field)]:[];
   return {...d.common,purpose:'LIST_MANAGED_FIELDS',grants};
  }
 };
}
