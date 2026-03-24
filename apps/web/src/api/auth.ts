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
  return apiRequest<AuthMe>("/api/v1/auth/me");
}
