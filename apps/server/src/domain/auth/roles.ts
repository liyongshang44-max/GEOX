import type { AoActScopeV0 } from "../../auth/ao_act_authz_v0.js";

export type AuthRole = "admin" | "operator" | "viewer" | "client" | "agronomist" | "approver" | "executor" | "auditor" | "support";
export type AuthResource = "reports" | "operations" | "dashboard" | "fields" | "portfolio" | "summary" | "tags";
export type AuthAction = "read" | "execute" | "write";

export const ROLE_SCOPE_MATRIX_V1: Record<AuthRole, (AoActScopeV0 | "*")[]> = {
  admin: ["*"],
  agronomist: ["recommendation.write","recommendation.read","prescription.write","prescription.read","prescription.submit_approval","field.zone.read","field_memory.read","roi_ledger.read"],
  approver: ["approval.read","approval.decide","prescription.read","recommendation.read","field.zone.read"],
  executor: ["action.read","action.receipt.submit","field.zone.read"],
  operator: ["action.read","action.task.create","action.task.dispatch","action.receipt.submit","judge.execution.write","acceptance.evaluate","field.zone.read"],
  auditor: ["recommendation.read","prescription.read","approval.read","action.read","judge.read","acceptance.read","field_memory.read","roi_ledger.read","security.audit.read"],
  viewer: ["recommendation.read","prescription.read","action.read","field_memory.read","roi_ledger.read","field.zone.read"],
  client: ["recommendation.read","prescription.read","action.read","field_memory.read","roi_ledger.read","field.zone.read"],
  support: ["recommendation.read","prescription.read","approval.read","action.read","judge.read","acceptance.read","field_memory.read","roi_ledger.read","field.zone.read"],
};

export function isScopeAllowedForRoleV1(role: AuthRole, scope: AoActScopeV0): boolean {
  const row = ROLE_SCOPE_MATRIX_V1[role] ?? [];
  return row.includes("*") || row.includes(scope);
}

export const ROLE_ACTION_MATRIX: Record<AuthRole, Record<AuthResource, Record<AuthAction, boolean>>> = {
  admin:{reports:{read:true,execute:true,write:true},operations:{read:true,execute:true,write:true},dashboard:{read:true,execute:true,write:true},fields:{read:true,execute:true,write:true},portfolio:{read:true,execute:true,write:true},summary:{read:true,execute:true,write:true},tags:{read:true,execute:true,write:true}},
  operator:{reports:{read:true,execute:false,write:false},operations:{read:true,execute:true,write:false},dashboard:{read:true,execute:false,write:false},fields:{read:true,execute:false,write:false},portfolio:{read:true,execute:false,write:false},summary:{read:true,execute:false,write:false},tags:{read:true,execute:true,write:true}},
  viewer:{reports:{read:true,execute:false,write:false},operations:{read:true,execute:false,write:false},dashboard:{read:true,execute:false,write:false},fields:{read:true,execute:false,write:false},portfolio:{read:true,execute:false,write:false},summary:{read:true,execute:false,write:false},tags:{read:true,execute:false,write:false}},
  client:{reports:{read:true,execute:false,write:false},operations:{read:true,execute:false,write:false},dashboard:{read:true,execute:false,write:false},fields:{read:true,execute:false,write:false},portfolio:{read:true,execute:false,write:false},summary:{read:true,execute:false,write:false},tags:{read:true,execute:false,write:false}},
  agronomist:{reports:{read:true,execute:false,write:false},operations:{read:true,execute:true,write:false},dashboard:{read:true,execute:false,write:false},fields:{read:true,execute:false,write:false},portfolio:{read:true,execute:false,write:false},summary:{read:true,execute:false,write:false},tags:{read:true,execute:false,write:false}},
  approver:{reports:{read:true,execute:false,write:false},operations:{read:true,execute:true,write:false},dashboard:{read:true,execute:false,write:false},fields:{read:true,execute:false,write:false},portfolio:{read:true,execute:false,write:false},summary:{read:true,execute:false,write:false},tags:{read:true,execute:false,write:false}},
  executor:{reports:{read:true,execute:false,write:false},operations:{read:true,execute:true,write:false},dashboard:{read:true,execute:false,write:false},fields:{read:true,execute:false,write:false},portfolio:{read:true,execute:false,write:false},summary:{read:true,execute:false,write:false},tags:{read:true,execute:false,write:false}},
  auditor:{reports:{read:true,execute:false,write:false},operations:{read:true,execute:false,write:false},dashboard:{read:true,execute:false,write:false},fields:{read:true,execute:false,write:false},portfolio:{read:true,execute:false,write:false},summary:{read:true,execute:false,write:false},tags:{read:true,execute:false,write:false}},
  support:{reports:{read:true,execute:false,write:false},operations:{read:true,execute:false,write:false},dashboard:{read:true,execute:false,write:false},fields:{read:true,execute:false,write:false},portfolio:{read:true,execute:false,write:false},summary:{read:true,execute:false,write:false},tags:{read:true,execute:false,write:false}},
};

export function isRoleAllowed(role: AuthRole, resource: AuthResource, action: AuthAction): boolean { return Boolean(ROLE_ACTION_MATRIX[role]?.[resource]?.[action]); }
export function methodToAction(method: string): AuthAction { const m=String(method||"").toUpperCase(); if(["GET","HEAD","OPTIONS"].includes(m)) return "read"; if(["POST","PUT","PATCH","DELETE"].includes(m)) return "execute"; return "write"; }
