import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export type McftCap09OwnerCutoverScopeV1 = {
  tenant_id: string;
  project_id: string;
  group_id: string;
  field_id: string;
  season_id: string;
  zone_id: string;
};

export type McftCap09ProductionOwnerCutoverAuthorityInstanceV1 = {
  authority_ref: string;
  policy_ref: string;
  policy_sha256: string;
  deployment_subject_sha: string;
  host_id: string;
  scope: McftCap09OwnerCutoverScopeV1;
};

function record(value: unknown, code: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(code);
  return value as Record<string, unknown>;
}
function text(value: unknown, code: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(code);
  return value.trim();
}
function sha(value: unknown, code: string): string {
  const v=text(value,code); if(!/^[0-9a-f]{40}$/.test(v)) throw new Error(code); return v;
}
function digestBytes(file: string): string {
  return "sha256:" + crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}
function scope(value: unknown): McftCap09OwnerCutoverScopeV1 {
  const r=record(value,"MCFT_CAP09_OWNER_CUTOVER_SCOPE_REQUIRED");
  const out={} as McftCap09OwnerCutoverScopeV1;
  for(const key of ["tenant_id","project_id","group_id","field_id","season_id","zone_id"] as const) {
    out[key]=text(r[key],"MCFT_CAP09_OWNER_CUTOVER_SCOPE_REQUIRED:"+key);
  }
  return out;
}
function sameScope(a: McftCap09OwnerCutoverScopeV1,b: McftCap09OwnerCutoverScopeV1): boolean {
  return Object.keys(a).every((k)=>a[k as keyof McftCap09OwnerCutoverScopeV1]===b[k as keyof McftCap09OwnerCutoverScopeV1]);
}
export function readMcftCap09OwnerCutoverAuthorityV1(input:{
  authority_path:string;
  expected_deployment_subject_sha:string;
  expected_scope:McftCap09OwnerCutoverScopeV1;
}): McftCap09ProductionOwnerCutoverAuthorityInstanceV1 {
  const authorityPath=text(input.authority_path,"MCFT_CAP09_OWNER_CUTOVER_AUTHORITY_PATH_REQUIRED");
  const raw=record(JSON.parse(fs.readFileSync(authorityPath,"utf8")),"MCFT_CAP09_OWNER_CUTOVER_AUTHORITY_INVALID");
  if(raw.schema_version!=="geox_mcft_cap09_production_owner_cutover_authority_instance_v1"
    || raw.authority_id!=="GEOX-MCFT-CAP-09-PRODUCTION-OWNER-CUTOVER-AUTHORITY-INSTANCE-V1"
    || raw.status!=="AUTHORIZED"
    || raw.armed!==true) throw new Error("MCFT_CAP09_OWNER_CUTOVER_AUTHORITY_NOT_ARMED");
  const deployment=sha(raw.deployment_subject_sha,"MCFT_CAP09_OWNER_CUTOVER_DEPLOYMENT_SUBJECT_REQUIRED");
  if(deployment!==sha(input.expected_deployment_subject_sha,"MCFT_CAP09_OWNER_CUTOVER_EXPECTED_SUBJECT_REQUIRED")) {
    throw new Error("MCFT_CAP09_OWNER_CUTOVER_DEPLOYMENT_SUBJECT_MISMATCH");
  }
  const actualScope=scope(raw.scope);
  if(!sameScope(actualScope,input.expected_scope)) throw new Error("MCFT_CAP09_OWNER_CUTOVER_SCOPE_MISMATCH");
  for(const key of ["evidence_owner_activation_authorized","twin_owner_activation_authorized","non_github_hosting_binding_authorized"]) {
    if(raw[key]!==true) throw new Error("MCFT_CAP09_OWNER_CUTOVER_REQUIRED_AUTHORITY_MISSING:"+key);
  }
  for(const key of ["production_login_provisioning_authorized","formal_v5_arm_authorized","a0_authorized","o00_authorized"]) {
    if(raw[key]!==false) throw new Error("MCFT_CAP09_OWNER_CUTOVER_AUTHORITY_CEILING_DRIFT:"+key);
  }
  const policyRef=text(raw.policy_ref,"MCFT_CAP09_OWNER_CUTOVER_POLICY_REF_REQUIRED").replaceAll("\\","/");
  if(path.posix.isAbsolute(policyRef)||policyRef.startsWith("../")||policyRef.includes("/../")) throw new Error("MCFT_CAP09_OWNER_CUTOVER_POLICY_REF_INVALID");
  const policyPath=path.resolve(process.cwd(),policyRef);
  const observed=digestBytes(policyPath);
  const policyDigest=text(raw.policy_sha256,"MCFT_CAP09_OWNER_CUTOVER_POLICY_DIGEST_REQUIRED");
  if(observed!==policyDigest) throw new Error("MCFT_CAP09_OWNER_CUTOVER_POLICY_DIGEST_MISMATCH");
  const policy=record(JSON.parse(fs.readFileSync(policyPath,"utf8")),"MCFT_CAP09_OWNER_CUTOVER_POLICY_INVALID");
  if(policy.schema_version!=="geox_mcft_cap09_production_runtime_owner_cutover_authority_v1"
    || policy.status!=="AUTHORIZED_FOR_LOCAL_OPERATOR_MANAGED_DOCKER_CUTOVER") {
    throw new Error("MCFT_CAP09_OWNER_CUTOVER_POLICY_NOT_EFFECTIVE");
  }
  const contract=record(policy.cutover_contract,"MCFT_CAP09_OWNER_CUTOVER_POLICY_CONTRACT_REQUIRED");
  if(contract.dual_key_required!==true||contract.exact_one_live_fenced_owner_per_plane_required!==true
    ||contract.evidence_owner_activation_authorized!==true||contract.twin_owner_activation_authorized!==true
    ||contract.twin_mode!=="PRE_FORMAL_OWNER_STANDBY") throw new Error("MCFT_CAP09_OWNER_CUTOVER_POLICY_CONTRACT_INVALID");
  const ceiling=record(policy.later_authority_ceiling,"MCFT_CAP09_OWNER_CUTOVER_POLICY_CEILING_REQUIRED");
  for(const key of ["formal_v5_arm_authorized","a0_execution_authorized","o00_authorized","o00_o23_execution_authorized","mcft_cap09_completed"]) {
    if(ceiling[key]!==false) throw new Error("MCFT_CAP09_OWNER_CUTOVER_POLICY_CEILING_DRIFT:"+key);
  }
  return {
    authority_ref:text(raw.authority_ref,"MCFT_CAP09_OWNER_CUTOVER_AUTHORITY_REF_REQUIRED"),
    policy_ref:policyRef,policy_sha256:observed,deployment_subject_sha:deployment,
    host_id:text(raw.host_id,"MCFT_CAP09_OWNER_CUTOVER_HOST_ID_REQUIRED"),scope:actualScope
  };
}
