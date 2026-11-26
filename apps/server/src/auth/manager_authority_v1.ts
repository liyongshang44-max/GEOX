// P6-B: consume FDW formal identity, never issue or exchange credentials.
 // No default production provider. A GEOX directory owner must supply the exact land grant.
export type ExternalRefV1 = {issuer:string;id:string;version:string};
export type ManagerActionV1 = "CREATE_FIELD"|"UPDATE_FIELD"|"READ_FIELD_GEOMETRY"|"READ_SOIL_DOCUMENT"|"UPLOAD_SOIL_DOCUMENT"|"CONFIRM_SOIL_DOCUMENT";
type VerifiedAssertion = {issuer:string;subject:string;principal_kind:string;canonical_tenant_ref:ExternalRefV1;membership_ref:ExternalRefV1;membership_status:string;mapping_version:string;credential_ref:string;valid_until:string};
export type FormalIdentityPortV1 = {
 readonly kind:"FORMAL_PROVIDER_NEUTRAL_IDENTITY";
 verify(credential:string,tenant:ExternalRefV1):Promise<unknown>;
 authorize(context:unknown):VerifiedAssertion;
 authorizeResource(context:unknown,request:{action:"CREATE_FIELD"}):unknown;
 invalidate(context:unknown):void;
};
export type GeoxLandGrantV1 = {
 status:"ACTIVE"; issuer:string; subject:string; canonical_tenant_ref:ExternalRefV1; membership_ref:ExternalRefV1;
 mapping_version:string; source_ref:ExternalRefV1; actor_id:string; tenant_id:string; project_id:string; group_id:string;
 field_id:string|null; action:ManagerActionV1; checked_at:string; valid_until:string;
};
export type ManagerAuthorityV1 = Readonly<{
 actor_id:string; tenant_id:string;project_id:string;group_id:string;field_id:string|null;action:ManagerActionV1;
 credential_ref:string; grant_source_ref:ExternalRefV1;mapping_version:string;valid_until_ms:number;
}>;
export class ManagerAuthorityErrorV1 extends Error {
 constructor(public readonly status:401|403|503,code:string){super(code);}
}
export type ManagerAuthorizerV1 = {authorize(credential:string,field:string|null,action:ManagerActionV1):Promise<ManagerAuthorityV1>;assertCurrent(authority:ManagerAuthorityV1,field:string|null,action:ManagerActionV1):void};
const id=(v:unknown):v is string=>typeof v==="string"&&/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/.test(v);
const ref=(v:ExternalRefV1|undefined)=>!!v&&[v.issuer,v.id,v.version].every(x=>typeof x==="string"&&x.trim()===x&&x.length>0&&x.length<=512);
const same=(a:ExternalRefV1,b:ExternalRefV1)=>ref(a)&&ref(b)&&a.issuer===b.issuer&&a.id===b.id&&a.version===b.version;
const denied=()=>new ManagerAuthorityErrorV1(403,"MANAGER_AUTHORITY_DENIED");
const actions=new Set<ManagerActionV1>(["CREATE_FIELD","UPDATE_FIELD","READ_FIELD_GEOMETRY","READ_SOIL_DOCUMENT","UPLOAD_SOIL_DOCUMENT","CONFIRM_SOIL_DOCUMENT"]);
export function createManagerAuthorizerV1(config:{
 identity:FormalIdentityPortV1; canonicalTenantRef:ExternalRefV1; issuer:string;
 resolveLandGrant(input:{assertion:VerifiedAssertion;field_id:string|null;action:ManagerActionV1}):Promise<GeoxLandGrantV1|null>;
 clock?:()=>number;
}):ManagerAuthorizerV1 {
 if(config.identity?.kind!=="FORMAL_PROVIDER_NEUTRAL_IDENTITY"||!ref(config.canonicalTenantRef)||!config.issuer||typeof config.resolveLandGrant!=="function")throw new Error("MANAGER_AUTHORITY_PROVIDER_REQUIRED");
 const clock=config.clock??Date.now;
 const issued=new WeakSet<object>();
 return Object.freeze({
  async authorize(credential:string,field:string|null,action:ManagerActionV1){
   if(typeof credential!=="string"||!credential||credential.length>16384)throw new ManagerAuthorityErrorV1(401,"MANAGER_CREDENTIAL_REQUIRED");
   if(!actions.has(action)||(action==="CREATE_FIELD"?field!==null:!id(field)))throw denied();
   let ctx:unknown;let a:VerifiedAssertion;
   try {
    ctx=await config.identity.verify(credential,structuredClone(config.canonicalTenantRef));
    a=config.identity.authorize(ctx);
    if(action==="CREATE_FIELD")config.identity.authorizeResource(ctx,{action:"CREATE_FIELD"});
   } catch {
    if(ctx!==undefined)config.identity.invalidate(ctx);
    throw denied();
   }
   try {
    if(a.issuer!==config.issuer||!a.subject||a.principal_kind!=="HUMAN"||a.membership_status!=="ACTIVE"||
       !same(a.canonical_tenant_ref,config.canonicalTenantRef)||!ref(a.membership_ref)||!a.mapping_version||
       !/^(?:sha256:)?[a-f0-9]{64}$/.test(a.credential_ref)||!Number.isFinite(Date.parse(a.valid_until)))throw denied();
    let g:GeoxLandGrantV1|null;
    try {g=await config.resolveLandGrant({assertion:structuredClone(a),field_id:field,action});}
    catch {throw new ManagerAuthorityErrorV1(503,"MANAGER_DIRECTORY_UNAVAILABLE");}
    const now=clock(),checked=Date.parse(g?.checked_at??""),until=Date.parse(g?.valid_until??"");
    if(!g||g.status!=="ACTIVE"||g.issuer!==a.issuer||g.subject!==a.subject||!same(g.canonical_tenant_ref,a.canonical_tenant_ref)||
      !same(g.membership_ref,a.membership_ref)||g.mapping_version!==a.mapping_version||!ref(g.source_ref)||
      ![g.actor_id,g.tenant_id,g.project_id,g.group_id].every(id)||g.field_id!==field||g.action!==action||
      !Number.isFinite(checked)||!Number.isFinite(until)||checked>now||now-checked>60000||until>checked+60000||
      Math.min(until,Date.parse(a.valid_until))<=now)throw denied();
    // Revalidate the original opaque context after the directory round trip.
    let current:VerifiedAssertion;
    try {current=config.identity.authorize(ctx);}catch{throw denied();}
    if(current.credential_ref!==a.credential_ref||current.mapping_version!==a.mapping_version||!same(current.membership_ref,a.membership_ref))throw denied();
    const output=Object.freeze({actor_id:g.actor_id,tenant_id:g.tenant_id,project_id:g.project_id,group_id:g.group_id,
      field_id:field,action,credential_ref:a.credential_ref,grant_source_ref:Object.freeze({...g.source_ref}),
      mapping_version:g.mapping_version,valid_until_ms:Math.min(until,Date.parse(a.valid_until),Date.parse(current.valid_until))});
    if(!Number.isFinite(output.valid_until_ms)||output.valid_until_ms<=clock())throw denied();
    issued.add(output);return output;
   } finally {config.identity.invalidate(ctx);}
  },
  assertCurrent(a:ManagerAuthorityV1,field:string|null,action:ManagerActionV1){
   if(!a||!issued.has(a)||a.field_id!==field||a.action!==action||a.valid_until_ms<=clock())throw denied();
  },
 });
}
