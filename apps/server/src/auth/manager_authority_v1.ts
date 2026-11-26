// P6-B: consume FDW formal identity, never issue or exchange credentials.
 // No default production provider. A GEOX directory owner must supply the exact land grant.
export type ExternalRefV1 = {issuer:string;id:string;version:string};
export type ManagerActionV1 = "CREATE_FIELD"|"UPDATE_FIELD"|"READ_FIELD_GEOMETRY"|"READ_SOIL_DOCUMENT"|"UPLOAD_SOIL_DOCUMENT"|"CONFIRM_SOIL_DOCUMENT"|"REQUEST_CROP_REVIEW"|"READ_CROP_REVIEW";
export type VerifiedAssertion = {issuer:string;subject:string;principal_kind:string;canonical_tenant_ref:ExternalRefV1;membership_ref:ExternalRefV1;membership_status:string;mapping_version:string;credential_ref:string;valid_until:string};
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
// The authoritative directory explicitly authorizes enumeration; a tenant
// membership, CREATE_FIELD or a caller-supplied field id is not an inventory.
export type GeoxLandInventoryV1 = {
 purpose:"LIST_MANAGED_FIELDS";status:"ACTIVE";issuer:string;subject:string;
 canonical_tenant_ref:ExternalRefV1;membership_ref:ExternalRefV1;mapping_version:string;
 source_ref:ExternalRefV1;checked_at:string;valid_until:string;grants:GeoxLandGrantV1[];
};
export type ManagerInventoryAuthorityV1=Readonly<{fields:readonly ManagerAuthorityV1[];valid_until_ms:number}>;
export type ManagerAuthorizerV1 = {
 listAuthorizedFields?(credential:string):Promise<ManagerInventoryAuthorityV1>;
 assertInventoryCurrent?(inventory:ManagerInventoryAuthorityV1):void;
 authorize(credential:string,field:string|null,action:ManagerActionV1):Promise<ManagerAuthorityV1>;assertCurrent(authority:ManagerAuthorityV1,field:string|null,action:ManagerActionV1):void};
const id=(v:unknown):v is string=>typeof v==="string"&&/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/.test(v);
const ref=(v:ExternalRefV1|undefined)=>!!v&&[v.issuer,v.id,v.version].every(x=>typeof x==="string"&&x.trim()===x&&x.length>0&&x.length<=512);
const same=(a:ExternalRefV1,b:ExternalRefV1)=>ref(a)&&ref(b)&&a.issuer===b.issuer&&a.id===b.id&&a.version===b.version;
const denied=()=>new ManagerAuthorityErrorV1(403,"MANAGER_AUTHORITY_DENIED");
const actions=new Set<ManagerActionV1>(["CREATE_FIELD","UPDATE_FIELD","READ_FIELD_GEOMETRY","READ_SOIL_DOCUMENT","UPLOAD_SOIL_DOCUMENT","CONFIRM_SOIL_DOCUMENT","REQUEST_CROP_REVIEW","READ_CROP_REVIEW"]);
export function createManagerAuthorizerV1(config:{
 identity:FormalIdentityPortV1; canonicalTenantRef:ExternalRefV1; issuer:string;
 resolveLandGrant(input:{assertion:VerifiedAssertion;field_id:string|null;action:ManagerActionV1}):Promise<GeoxLandGrantV1|null>;
 resolveLandInventory?(input:{assertion:VerifiedAssertion}):Promise<GeoxLandInventoryV1|null>;
 clock?:()=>number;
}):ManagerAuthorizerV1 {
 if(config.identity?.kind!=="FORMAL_PROVIDER_NEUTRAL_IDENTITY"||!ref(config.canonicalTenantRef)||!config.issuer||typeof config.resolveLandGrant!=="function")throw new Error("MANAGER_AUTHORITY_PROVIDER_REQUIRED");
 const clock=config.clock??Date.now;
 const issued=new WeakSet<object>(),inventories=new WeakSet<object>();
 function validateAssertion(a:VerifiedAssertion){
  if(a.issuer!==config.issuer||!a.subject||a.principal_kind!=="HUMAN"||a.membership_status!=="ACTIVE"||
     !same(a.canonical_tenant_ref,config.canonicalTenantRef)||!ref(a.membership_ref)||!a.mapping_version||
     !/^(?:sha256:)?[a-f0-9]{64}$/.test(a.credential_ref)||!Number.isFinite(Date.parse(a.valid_until))||Date.parse(a.valid_until)<=clock())throw denied();
 }
 async function withAssertion<T>(credential:string,create:boolean,fn:(a:VerifiedAssertion,refresh:()=>VerifiedAssertion)=>Promise<T>):Promise<T>{
  if(typeof credential!=="string"||!credential||credential.length>16384)throw new ManagerAuthorityErrorV1(401,"MANAGER_CREDENTIAL_REQUIRED");
  let ctx:unknown;let a:VerifiedAssertion;
  try {
   ctx=await config.identity.verify(credential,structuredClone(config.canonicalTenantRef));
   a=structuredClone(config.identity.authorize(ctx));validateAssertion(a);
   if(create)config.identity.authorizeResource(ctx,{action:"CREATE_FIELD"});
  }catch{if(ctx!==undefined)config.identity.invalidate(ctx);throw denied();}
  try {
   const refresh=()=>{
    let current:VerifiedAssertion;
    try{current=config.identity.authorize(ctx);validateAssertion(current);}catch{throw denied();}
    if(current.issuer!==a.issuer||current.subject!==a.subject||current.credential_ref!==a.credential_ref||current.mapping_version!==a.mapping_version||!same(current.membership_ref,a.membership_ref))throw denied();
    return current;
   };
   return await fn(a,refresh);
  }finally{config.identity.invalidate(ctx);}
 }
 function evidenceUntil(a:VerifiedAssertion,g:Pick<GeoxLandGrantV1,"status"|"issuer"|"subject"|"canonical_tenant_ref"|"membership_ref"|"mapping_version"|"source_ref"|"checked_at"|"valid_until">|null){
  const now=clock(),checked=Date.parse(g?.checked_at??""),until=Date.parse(g?.valid_until??"");
  if(!g||g.status!=="ACTIVE"||g.issuer!==a.issuer||g.subject!==a.subject||!same(g.canonical_tenant_ref,a.canonical_tenant_ref)||
    !same(g.membership_ref,a.membership_ref)||g.mapping_version!==a.mapping_version||!ref(g.source_ref)||
    !Number.isFinite(checked)||!Number.isFinite(until)||checked>now||now-checked>60000||until>checked+60000||
    Math.min(until,Date.parse(a.valid_until))<=now)throw denied();
  return Math.min(until,Date.parse(a.valid_until));
 }
 function grant(a:VerifiedAssertion,g:GeoxLandGrantV1|null,field:string|null,action:ManagerActionV1,cap:number){
  const until=evidenceUntil(a,g);
  if(!g||![g.actor_id,g.tenant_id,g.project_id,g.group_id].every(id)||g.field_id!==field||g.action!==action)throw denied();
  const output=Object.freeze({actor_id:g.actor_id,tenant_id:g.tenant_id,project_id:g.project_id,group_id:g.group_id,
   field_id:field,action,credential_ref:a.credential_ref,grant_source_ref:Object.freeze({...g.source_ref}),
   mapping_version:g.mapping_version,valid_until_ms:Math.min(until,cap)});
  if(!Number.isFinite(output.valid_until_ms)||output.valid_until_ms<=clock())throw denied();
  issued.add(output);return output;
 }
 return Object.freeze({
  async authorize(credential:string,field:string|null,action:ManagerActionV1){
   if(!actions.has(action)||(action==="CREATE_FIELD"?field!==null:!id(field)))throw denied();
   return withAssertion(credential,action==="CREATE_FIELD",async(a,refresh)=>{
    let g:GeoxLandGrantV1|null;
    try{g=await config.resolveLandGrant({assertion:structuredClone(a),field_id:field,action});}
    catch{throw new ManagerAuthorityErrorV1(503,"MANAGER_DIRECTORY_UNAVAILABLE");}
    return grant(a,g,field,action,Date.parse(refresh().valid_until));
   });
  },
  async listAuthorizedFields(credential:string){
   return withAssertion(credential,false,async(a,refresh)=>{
    if(!config.resolveLandInventory)throw new ManagerAuthorityErrorV1(503,"MANAGER_LAND_INVENTORY_PROVIDER_REQUIRED");
    let inv:GeoxLandInventoryV1|null;
    try{inv=structuredClone(await config.resolveLandInventory({assertion:structuredClone(a)}));}
    catch{throw new ManagerAuthorityErrorV1(503,"MANAGER_DIRECTORY_UNAVAILABLE");}
    const until=Math.min(evidenceUntil(a,inv),Date.parse(refresh().valid_until));
    if(!inv||inv.purpose!=="LIST_MANAGED_FIELDS"||!Array.isArray(inv.grants)||inv.grants.length>100)throw denied();
    const seen=new Set<string>();
    const fields=inv.grants.map(g=>{
     if(!g||!id(g.field_id)||seen.has(g.field_id))throw denied();
     seen.add(g.field_id);
     return grant(a,g,g.field_id,"READ_FIELD_GEOMETRY",until);
    });
    // One opaque short-lived list authority, including an explicitly empty list.
    // Expiry covers every individual grant and the directory inventory itself.
    const output=Object.freeze({fields:Object.freeze(fields),valid_until_ms:Math.min(until,...fields.map(g=>g.valid_until_ms))});
    if(output.valid_until_ms<=clock())throw denied();inventories.add(output);return output;
   });
  },
  assertInventoryCurrent(a:ManagerInventoryAuthorityV1){
   if(!a||!inventories.has(a)||a.valid_until_ms<=clock()||a.fields.some(g=>!issued.has(g)||g.action!=="READ_FIELD_GEOMETRY"||g.valid_until_ms<=clock()))throw denied();
  },
  assertCurrent(a:ManagerAuthorityV1,field:string|null,action:ManagerActionV1){
   if(!a||!issued.has(a)||a.field_id!==field||a.action!==action||a.valid_until_ms<=clock())throw denied();
  },
 });
}
