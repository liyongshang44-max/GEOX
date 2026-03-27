import { persistTenantContext } from "../auth/authStorage";
import { apiRequest } from "./client";

export type AuthMe = {
  ok: boolean;
  actor_id: string;
  token_id: string;
  tenant_id: string;
  project_id: string;
  group_id: string;
  role: string;
  scopes: string[];
};

export async function fetchAuthMe(): Promise<AuthMe> {
  const me = await apiRequest<AuthMe>("/api/v1/auth/me");
  persistTenantContext({ tenant_id: me.tenant_id, project_id: me.project_id, group_id: me.group_id });
  return me;
}
