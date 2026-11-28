import {issuer,tenant,membership} from './contract.mjs';
// Observational only. No token, assertion, subject, credential reference, raw
// exception or secret is emitted. All original return values/errors preserved.
const codes=new Set(['IDENTITY_UNAVAILABLE','IDENTITY_DENIED','IDENTITY_TRUST_MISMATCH','IDENTITY_EVIDENCE_STALE','IDENTITY_EXPIRED_OR_NOT_YET_VALID','CREDENTIAL_REVOKED','CREDENTIAL_MALFORMED','ACCESS_TOKEN_TYPE_REQUIRED','IDENTITY_SIGNATURE_INVALID','MEMBERSHIP_DENIED','MEMBERSHIP_INACTIVE','RESOURCE_ACCESS_DENIED','RESOURCE_ACTION_DENIED','RESOURCE_POLICY_INVALID','UNVERIFIED_CONTEXT','TENANT_BINDING_DENIED','IDENTITY_BINDING_CHANGED']);
const same=(a,b)=>!!a&&a.issuer===b.issuer&&a.id===b.id&&a.version===b.version;
export function diagnosticPorts(identity,grants,subject,readPolicy,emit){
 const report=(x)=>{try{emit(x)}catch{}};
 const bad=(stage,e)=>report({stage,result:'DENIED',code:codes.has(e?.code)?e.code:codes.has(e?.message)?e.message:'OTHER'});
 return {identity:{kind:identity.kind,
  async verify(...args){try{const x=await identity.verify(...args);report({stage:'FDW_VERIFY',result:'PASS'});return x}catch(e){bad('FDW_VERIFY',e);throw e}},
  authorize(...args){try{const a=identity.authorize(...args);report({stage:'FDW_ASSERTION',result:'PASS',subjectMatch:a.subject===subject,issuerMatch:a.issuer===issuer,human:a.principal_kind==='HUMAN',membershipActive:a.membership_status==='ACTIVE',tenantMatch:same(a.canonical_tenant_ref,tenant),membershipMatch:same(a.membership_ref,membership),mappingMatch:a.mapping_version==='fdw-local-mapping-v1',credentialShape:/^(?:sha256:)?[a-f0-9]{64}$/.test(a.credential_ref),fresh:Date.parse(a.valid_until)>Date.now()});return a}catch(e){bad('FDW_ASSERTION',e);throw e}},
  authorizeResource(...args){try{const x=identity.authorizeResource(...args);report({stage:'FDW_CREATE_CAPABILITY',result:'PASS'});return x}catch(e){bad('FDW_CREATE_CAPABILITY',e);throw e}},
  invalidate(...args){return identity.invalidate(...args)}
 },grants:{
  async resolveLandGrant(input){try{const g=await grants.resolveLandGrant(input);let phase='UNKNOWN',active=false;try{const p=readPolicy();phase=['PREWRITE','CREATE','FIELD'].includes(p.phase)?p.phase:'UNKNOWN';active=p.create_status==='ACTIVE'}catch{};report({stage:'GEOX_LAND_GRANT',result:g?'PASS':'DENIED',phase,active});return g}catch(e){bad('GEOX_LAND_GRANT',e);throw e}},
  resolveLandInventory(...args){return grants.resolveLandInventory(...args)}
 }};
}
