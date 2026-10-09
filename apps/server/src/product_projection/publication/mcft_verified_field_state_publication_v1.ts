// MCFT → Product verified publication V1.
// Pure attestation / read-validation. Not an MCFT authority, not a signer service.
import { createPublicKey, verify as verifySignature } from "node:crypto";
import { canonicalJsonV1, semanticHashV1 } from "../../domain/twin_runtime/canonical_json_v1.js";
import { MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1 } from "../../domain/twin_runtime/external_formal_runtime_config_v1.js";

export const PRODUCT_MCFT_PUBLICATION_SCHEMA_V1 =
  "geox.product-mcft.verified-field-state-publication.v1" as const;
export const PRODUCT_MCFT_PUBLICATION_DATABASE_V1 = "geox_mcft_cap09_production_runtime_v1" as const;
export const PRODUCT_MCFT_FORMAL_DATABASE_V1 = "geox_mcft_cap09_s6_formal_t4r1_24h_v5" as const;
export const PRODUCT_MCFT_PUBLICATION_SIGNER_PURPOSE_V1 =
  "GEOX_MCFT_FIELD_STATE_PUBLICATION_ONLY_V1" as const;

export type PublishedResearchScopeV1 = {
  tenant_id:string; project_id:string; group_id:string; field_id:string; season_id:string; zone_id:string;
};
export type PublishedWaterV1 = {
  available_water_fraction: number;
  depletion_from_field_capacity_mm: number;
  root_zone_water_storage_mm: { mean:number; stddev:number; interval_low:number; interval_high:number };
};
export type McftFieldStatePublicationStatementV1 = {
  schema_version: typeof PRODUCT_MCFT_PUBLICATION_SCHEMA_V1;
  signer_purpose: typeof PRODUCT_MCFT_PUBLICATION_SIGNER_PURPOSE_V1;
  scope: PublishedResearchScopeV1;
  source: {
    project_id: "delicate-glade-62464340";
    branch_id: "br-cold-dust-a6j6aymz";
    database_name: typeof PRODUCT_MCFT_FORMAL_DATABASE_V1;
    runtime_subject_sha: string;
    active_lineage_ref: string;
    active_lineage_hash: string;
    posterior_state_ref: string;
    posterior_state_hash: string;
    posterior_source_fact_ref: string;
    complete_exact_graph_receipt_sha256: string;
    readback_status: "CAP07_COMPLETE_EXACT_GRAPH";
    logical_time: string;
    evidence_visible_at: string;
    readback_as_of: string;
  };
  condition: {
    kind: "MODELED_ROOT_ZONE_WATER";
    water: PublishedWaterV1;
    water_stress_status: "NOT_ESTABLISHED";
    confidence_status: "NOT_ESTABLISHED";
  };
  certified_at: string;
  cap09_final_qualification_claim: false;
};
export type SignedMcftFieldStatePublicationV1 = {
  statement: McftFieldStatePublicationStatementV1;
  key_id: string;
  signature_base64: string;
};
export type McftPublicationTrustPolicyV1 = {
  key_id: string;
  public_key_pem: string;
  runtime_subject_sha: string;
  source_readback_receipt_digest: string;
  authority_status: "EFFECTIVE_PUBLICATION_SIGNER_AUTHORITY";
  allowed_scope: PublishedResearchScopeV1;
};
export type VerifiedMcftPublicationV1 = {
  publication_id: string;
  statement: McftFieldStatePublicationStatementV1;
  key_id: string;
  signature_base64: string;
};
function fail(code:string):never { throw new Error("PRODUCT_MCFT_PUBLICATION_"+code); }
function obj(value:unknown,code:string):Record<string,unknown> {
  if(!value || typeof value!=="object" || Array.isArray(value)) fail(code);
  return value as Record<string,unknown>;
}
function keys(v:Record<string,unknown>,expected:readonly string[],code:string) {
  if(Object.keys(v).sort().join("|")!==[...expected].sort().join("|")) fail(code);
}
function str(v:unknown,code:string):string {
  if(typeof v!=="string" || !v.trim() || v.length>256 || v!==v.trim()) fail(code);
  return v;
}
function digest(v:unknown,code:string):string {
  const s=str(v,code);
  if(!/^sha256:[a-f0-9]{64}$/.test(s)) fail(code);
  return s;
}
function time(v:unknown,code:string):number {
  const s=str(v,code);
  if(!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(s)) fail(code);
  const n=Date.parse(s);
  if(!Number.isFinite(n) || new Date(n).toISOString()!==s) fail(code);
  return n;
}
function finite(v:unknown,code:string):number {
  if(typeof v!=="number" || !Number.isFinite(v)) fail(code);
  return v;
}
function exactScope(scope:PublishedResearchScopeV1):boolean {
  return Object.entries(MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1)
    .every(([key,value])=>scope[key as keyof PublishedResearchScopeV1]===value);
}
export function verifyMcftFieldStatePublicationV1(
  signed: SignedMcftFieldStatePublicationV1,
  policy: McftPublicationTrustPolicyV1,
  databaseNowUtc: string,
): VerifiedMcftPublicationV1 {
  const now=time(databaseNowUtc,"DATABASE_TIME_INVALID");
  const p=obj(policy,"TRUST_POLICY_REQUIRED");
  keys(p,["key_id","public_key_pem","runtime_subject_sha","source_readback_receipt_digest","authority_status","allowed_scope"],"TRUST_POLICY_SHAPE_INVALID");
  if(p.authority_status!=="EFFECTIVE_PUBLICATION_SIGNER_AUTHORITY") fail("TRUST_AUTHORITY_NOT_EFFECTIVE");
  const keyId=str(p.key_id,"KEY_ID_INVALID");
  if(!/^[A-Za-z0-9_.:-]{4,96}$/.test(keyId)) fail("KEY_ID_INVALID");
  const subject=str(p.runtime_subject_sha,"TRUST_SUBJECT_INVALID");
  if(!/^[a-f0-9]{40}$/.test(subject)) fail("TRUST_SUBJECT_INVALID");
  const trustedReceipt=digest(p.source_readback_receipt_digest,"TRUST_READBACK_DIGEST_INVALID");
  const trustedScope=obj(p.allowed_scope,"TRUST_SCOPE_INVALID");
  keys(trustedScope,["tenant_id","project_id","group_id","field_id","season_id","zone_id"],"TRUST_SCOPE_SHAPE_INVALID");
  if(!exactScope(trustedScope as PublishedResearchScopeV1)) fail("TRUST_SCOPE_NOT_RESEARCH");
  const publicKey=str(p.public_key_pem,"PUBLIC_KEY_REQUIRED");
  let key;
  try { key=createPublicKey(publicKey); } catch { return fail("PUBLIC_KEY_INVALID"); }
  if(key.asymmetricKeyType!=="ed25519") fail("SIGNING_ALGORITHM_NOT_ED25519");

  const capsule=obj(signed,"SIGNED_CAPSULE_REQUIRED");
  keys(capsule,["statement","key_id","signature_base64"],"SIGNED_CAPSULE_SHAPE_INVALID");
  if(capsule.key_id!==keyId) fail("SIGNER_NOT_TRUSTED");
  const stmt=obj(capsule.statement,"STATEMENT_REQUIRED");
  keys(stmt,["schema_version","signer_purpose","scope","source","condition","certified_at","cap09_final_qualification_claim"],"STATEMENT_SHAPE_INVALID");
  if(stmt.schema_version!==PRODUCT_MCFT_PUBLICATION_SCHEMA_V1) fail("SCHEMA_NOT_SUPPORTED");
  if(stmt.signer_purpose!==PRODUCT_MCFT_PUBLICATION_SIGNER_PURPOSE_V1) fail("SIGNER_PURPOSE_MISMATCH");
  if(stmt.cap09_final_qualification_claim!==false) fail("UNQUALIFIED_COMPLETION_CLAIM");
  const scope=obj(stmt.scope,"SCOPE_REQUIRED");
  keys(scope,["tenant_id","project_id","group_id","field_id","season_id","zone_id"],"SCOPE_SHAPE_INVALID");
  if(!exactScope(scope as PublishedResearchScopeV1)) fail("SOURCE_SCOPE_NOT_RESEARCH");
  for(const [k,v] of Object.entries(scope)) if(v!==trustedScope[k]) fail("SOURCE_SCOPE_POLICY_MISMATCH");
  const source=obj(stmt.source,"SOURCE_REQUIRED");
  keys(source,["project_id","branch_id","database_name","runtime_subject_sha",
    "active_lineage_ref","active_lineage_hash","posterior_state_ref","posterior_state_hash",
    "posterior_source_fact_ref","complete_exact_graph_receipt_sha256","readback_status",
    "logical_time","evidence_visible_at","readback_as_of"],"SOURCE_SHAPE_INVALID");
  if(source.project_id!=="delicate-glade-62464340" || source.branch_id!=="br-cold-dust-a6j6aymz"
    || source.database_name!==PRODUCT_MCFT_FORMAL_DATABASE_V1) fail("SOURCE_DATABASE_IDENTITY_MISMATCH");
  if(source.runtime_subject_sha!==subject) fail("SOURCE_RUNTIME_SUBJECT_MISMATCH");
  if(source.readback_status!=="CAP07_COMPLETE_EXACT_GRAPH") fail("SOURCE_GRAPH_NOT_QUALIFIED");
  if(source.complete_exact_graph_receipt_sha256!==trustedReceipt) fail("SOURCE_READBACK_NOT_AUTHORIZED");
  str(source.active_lineage_ref,"LINEAGE_REF_MISSING");
  str(source.posterior_state_ref,"POSTERIOR_REF_MISSING");
  str(source.posterior_source_fact_ref,"SOURCE_FACT_REF_MISSING");
  digest(source.active_lineage_hash,"LINEAGE_HASH_INVALID");
  digest(source.posterior_state_hash,"POSTERIOR_HASH_INVALID");
  const logical=time(source.logical_time,"LOGICAL_TIME_INVALID");
  const visible=time(source.evidence_visible_at,"EVIDENCE_VISIBLE_TIME_INVALID");
  const readback=time(source.readback_as_of,"READBACK_TIME_INVALID");
  const certified=time(stmt.certified_at,"CERTIFIED_TIME_INVALID");
  if(logical>readback || visible>readback || readback>certified || certified>now)
    fail("CAUSAL_TIME_ORDER_INVALID");
  const cond=obj(stmt.condition,"CONDITION_REQUIRED");
  keys(cond,["kind","water","water_stress_status","confidence_status"],"CONDITION_SHAPE_INVALID");
  if(cond.kind!=="MODELED_ROOT_ZONE_WATER" || cond.water_stress_status!=="NOT_ESTABLISHED" ||
     cond.confidence_status!=="NOT_ESTABLISHED") fail("STATE_SEMANTICS_NOT_ESTABLISHED");
  const water=obj(cond.water,"WATER_REQUIRED");
  keys(water,["available_water_fraction","depletion_from_field_capacity_mm","root_zone_water_storage_mm"],"WATER_SHAPE_INVALID");
  const fraction=finite(water.available_water_fraction,"FRACTION_NOT_FINITE");
  if(fraction<0 || fraction>1) fail("FRACTION_OUT_OF_RANGE");
  finite(water.depletion_from_field_capacity_mm,"DEPLETION_NOT_FINITE");
  const storage=obj(water.root_zone_water_storage_mm,"ROOT_ZONE_STORAGE_REQUIRED");
  keys(storage,["mean","stddev","interval_low","interval_high"],"STORAGE_SHAPE_INVALID");
  const mean=finite(storage.mean,"STORAGE_MEAN_INVALID");
  const sd=finite(storage.stddev,"STORAGE_SD_INVALID");
  const lo=finite(storage.interval_low,"STORAGE_LO_INVALID");
  const hi=finite(storage.interval_high,"STORAGE_HI_INVALID");
  if(sd<0 || lo<0 || lo>mean || mean>hi) fail("ROOT_ZONE_INTERVAL_INVALID");

  const signatureText=str(capsule.signature_base64,"SIGNATURE_MISSING");
  if(!/^[A-Za-z0-9+/]{86}==$/.test(signatureText)) fail("SIGNATURE_ENCODING_INVALID");
  const signature=Buffer.from(signatureText,"base64");
  if(signature.length!==64 || signature.toString("base64")!==signatureText) fail("SIGNATURE_ENCODING_INVALID");
  let okay=false;
  try {okay=verifySignature(null,Buffer.from(canonicalJsonV1(stmt),"utf8"),key,signature);}
  catch {return fail("SIGNATURE_CHECK_FAILED");}
  if(!okay) fail("SIGNATURE_CHECK_FAILED");
  return {
    publication_id:semanticHashV1(stmt),
    statement:stmt as McftFieldStatePublicationStatementV1,
    key_id:keyId,
    signature_base64:signatureText,
  };
}
