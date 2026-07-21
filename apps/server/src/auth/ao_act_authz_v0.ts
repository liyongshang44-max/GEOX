// GEOX/apps/server/src/auth/ao_act_authz_v0.ts

import type { FastifyReply, FastifyRequest } from "fastify";
import { isScopeAllowedForRoleV1, type AuthRole } from "../domain/auth/roles.js";
import { defaultGeoxTokenFilePathV1, hasStructuredTokenSourceV1, isStrictRuntimeProfileV1, parseBearerTokenV1, readGeoxTokenFileV1 } from "./token_ssot_v1.js";

export type AoActScopeV0 =
  | "ao_act.task.write" | "ao_act.receipt.write" | "ao_act.index.read"
  | "telemetry.read" | "telemetry.write" | "devices.write" | "devices.read"
  | "devices.credentials.write" | "devices.credentials.revoke" | "devices.bind" | "devices.status.read"
  | "fields.read" | "fields.write" | "inspection.read" | "inspection.write"
  | "alerts.read" | "alerts.write" | "evidence_export.read" | "evidence_export.write" | "evidence.artifact.write"
  | "recommendation.write" | "recommendation.read" | "recommendation.approval_request"
  | "prescription.write" | "prescription.read" | "prescription.submit_approval"
  | "approval.request" | "approval.decide" | "approval.read"
  | "operation.plan.create" | "operation.plan.transition"
  | "action.task.create" | "action.task.dispatch" | "action.receipt.submit" | "action.read"
  | "judge.execution.write" | "judge.read" | "acceptance.evaluate" | "acceptance.read"
  | "water_response.verify" | "field_memory.read" | "field_memory.write"
  | "roi_ledger.write" | "roi_ledger.read" | "field.zone.write" | "field.zone.read"
  | "security.audit.read" | "security.admin" | "skill.read" | "skill.binding.write"
  | "skill.definition.write" | "skill.run.write" | "skill.trace.write" | "skill.admin";

export type AoActRoleV0 = AuthRole | "executor";
type TokenRecordV0 = { token:string; token_id:string; actor_id:string; tenant_id:string; project_id:string; group_id:string; scopes:AoActScopeV0[]; revoked:boolean; role?:AoActRoleV0; allowed_field_ids?:string[] };
type TokenFileV0 = { version:"ao_act_tokens_v0"; tokens:TokenRecordV0[] };
export type AoActAuthContextV0 = { actor_id:string; token_id:string; tenant_id:string; project_id:string; group_id:string; role:AoActRoleV0; scopes:AoActScopeV0[]; allowed_field_ids:string[] };

export function defaultAoActTokenFilePathV0():string{return defaultGeoxTokenFilePathV1();}
export function readTokenFileV0(fp?:string):TokenFileV0{return readGeoxTokenFileV1(fp) as TokenFileV0;}
function parseBearerToken(req:FastifyRequest):string|null{return parseBearerTokenV1(req);}
function roleFromRecord(rec:TokenRecordV0):AoActRoleV0{if(["operator","viewer","client","executor","agronomist","approver","auditor","support"].includes(String(rec.role)))return rec.role as AoActRoleV0;return"admin";}
function authContextFromRecord(rec:TokenRecordV0):AoActAuthContextV0{return{actor_id:rec.actor_id,token_id:rec.token_id,tenant_id:rec.tenant_id,project_id:rec.project_id,group_id:rec.group_id,role:roleFromRecord(rec),scopes:Array.isArray(rec.scopes)?rec.scopes.slice():[],allowed_field_ids:Array.isArray(rec.allowed_field_ids)?rec.allowed_field_ids.map((x)=>String(x??"").trim()).filter(Boolean):[]};}

export function requireAoActAuthV0(req:FastifyRequest,reply:FastifyReply,opts:{tokenFilePath?:string}={}):AoActAuthContextV0|null{
  const tok=parseBearerToken(req);if(!tok){reply.status(401).send({ok:false,error:"AUTH_MISSING"});return null;}
  if(isStrictRuntimeProfileV1()&&!hasStructuredTokenSourceV1()){reply.status(401).send({ok:false,error:"AUTH_PRODUCTION_TOKEN_SOURCE_INVALID"});return null;}
  const tf=readTokenFileV0(opts.tokenFilePath??defaultAoActTokenFilePathV0());const rec=tf.tokens.find((t)=>t.token===tok)??null;
  if(!rec){reply.status(401).send({ok:false,error:"AUTH_INVALID"});return null;}if(rec.revoked){reply.status(403).send({ok:false,error:"AUTH_REVOKED"});return null;}
  if(!rec.tenant_id?.trim()||!rec.project_id?.trim()||!rec.group_id?.trim()){reply.status(401).send({ok:false,error:"AUTH_INVALID"});return null;}
  return authContextFromRecord(rec);
}

export function requireAoActAdminV0(req:FastifyRequest,reply:FastifyReply,opts:{tokenFilePath?:string;deniedError?:string}={}):AoActAuthContextV0|null{const auth=requireAoActAuthV0(req,reply,opts);if(!auth)return null;if(auth.role!=="admin"){reply.status(403).send({ok:false,error:opts.deniedError??"AUTH_ROLE_DENIED"});return null;}return auth;}

export function requireAoActScopeV0(req:FastifyRequest,reply:FastifyReply,scope:AoActScopeV0,opts:{tokenFilePath?:string}={}):AoActAuthContextV0|null{
  const auth=requireAoActAuthV0(req,reply,opts);if(!auth)return null;
  const record=readTokenFileV0(opts.tokenFilePath??defaultAoActTokenFilePathV0()).tokens.find((candidate)=>candidate.token===parseBearerToken(req));
  if(!record?.scopes.includes(scope)){reply.status(403).send({ok:false,error:"AUTH_SCOPE_DENIED"});return null;}
  if(!isScopeAllowedForRoleV1(roleFromRecord(record) as AuthRole,scope)){reply.status(403).send({ok:false,error:"AUTH_ROLE_SCOPE_DENIED"});return null;}
  return auth;
}

export function requireAoActAnyScopeV0(req:FastifyRequest,reply:FastifyReply,scopes:AoActScopeV0[],opts:{tokenFilePath?:string}={}):AoActAuthContextV0|null{
  const auth=requireAoActAuthV0(req,reply,opts);if(!auth)return null;
  const record=readTokenFileV0(opts.tokenFilePath??defaultAoActTokenFilePathV0()).tokens.find((candidate)=>candidate.token===parseBearerToken(req));
  if(!record){reply.status(401).send({ok:false,error:"AUTH_INVALID"});return null;}
  const role=roleFromRecord(record) as AuthRole;
  if(!scopes.some((scope)=>record.scopes.includes(scope))){reply.status(403).send({ok:false,error:"AUTH_SCOPE_DENIED"});return null;}
  if(!scopes.some((scope)=>record.scopes.includes(scope)&&isScopeAllowedForRoleV1(role,scope))){reply.status(403).send({ok:false,error:"AUTH_ROLE_SCOPE_DENIED"});return null;}
  return auth;
}
