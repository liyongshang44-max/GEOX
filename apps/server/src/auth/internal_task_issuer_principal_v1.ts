import { readTokenFileV0 } from "./ao_act_authz_v0.js";

export const INTERNAL_TASK_ISSUER_REQUIRED_SCOPE_V1 = "action.task.create" as const;
export const INTERNAL_TASK_ISSUER_REQUIRED_ROLE_V1 = "operator" as const;
export const INTERNAL_TASK_ISSUER_DEFAULT_TOKEN_ID_V1 = "tok_internal_task_issuer_v1" as const;

export type InternalTaskIssuerPrincipalV1 = {
  authorization: string;
  token_id: string;
  actor_id: string;
  tenant_id: string;
  project_id: string;
  group_id: string;
  role: typeof INTERNAL_TASK_ISSUER_REQUIRED_ROLE_V1;
  scopes: readonly [typeof INTERNAL_TASK_ISSUER_REQUIRED_SCOPE_V1];
};

function issuerError(code: string): never {
  throw new Error(`INTERNAL_TASK_ISSUER_${code}`);
}

function requiredIdentity(value: unknown, label: string): string {
  const normalized = String(value ?? "").trim();
  if (!normalized) issuerError(`IDENTITY_INVALID:${label}`);
  return normalized;
}

function configuredTokenIdV1(): string {
  return String(process.env.GEOX_INTERNAL_TASK_ISSUER_TOKEN_ID ?? INTERNAL_TASK_ISSUER_DEFAULT_TOKEN_ID_V1).trim()
    || INTERNAL_TASK_ISSUER_DEFAULT_TOKEN_ID_V1;
}

function normalizeOptionalConfiguredSecretV1(): string | null {
  const raw = String(process.env.GEOX_INTERNAL_TASK_ISSUER_TOKEN ?? "").trim();
  if (!raw) return null;
  const match = /^Bearer\s+(.+)$/i.exec(raw);
  const token = String(match?.[1] ?? raw).trim();
  return token || null;
}

export function resolveInternalTaskIssuerPrincipalV1(): InternalTaskIssuerPrincipalV1 {
  const expectedTokenId = configuredTokenIdV1();
  const tokenFile = readTokenFileV0() as any;
  const records = Array.isArray(tokenFile?.tokens) ? tokenFile.tokens : [];
  const record = records.find((candidate: any) => String(candidate?.token_id ?? "").trim() === expectedTokenId) ?? null;
  if (!record) issuerError("PRINCIPAL_UNKNOWN");
  if (record.revoked === true) issuerError("PRINCIPAL_REVOKED");

  const role = String(record.role ?? "").trim();
  if (role !== INTERNAL_TASK_ISSUER_REQUIRED_ROLE_V1) {
    issuerError("ROLE_INVALID");
  }

  const scopes = Array.isArray(record.scopes)
    ? record.scopes.map((scope: unknown) => String(scope ?? "").trim()).filter(Boolean)
    : [];
  if (scopes.length !== 1 || scopes[0] !== INTERNAL_TASK_ISSUER_REQUIRED_SCOPE_V1) {
    issuerError("SCOPE_INVALID");
  }

  const token = requiredIdentity(record.token, "token");
  const configuredSecret = normalizeOptionalConfiguredSecretV1();
  if (configuredSecret && configuredSecret !== token) {
    issuerError("TOKEN_ID_SECRET_MISMATCH");
  }

  return {
    authorization: `Bearer ${token}`,
    token_id: requiredIdentity(record.token_id, "token_id"),
    actor_id: requiredIdentity(record.actor_id, "actor_id"),
    tenant_id: requiredIdentity(record.tenant_id, "tenant_id"),
    project_id: requiredIdentity(record.project_id, "project_id"),
    group_id: requiredIdentity(record.group_id, "group_id"),
    role: INTERNAL_TASK_ISSUER_REQUIRED_ROLE_V1,
    scopes: [INTERNAL_TASK_ISSUER_REQUIRED_SCOPE_V1],
  };
}

export function prepareInternalTaskIssuerPrincipalV1(): InternalTaskIssuerPrincipalV1 {
  const principal = resolveInternalTaskIssuerPrincipalV1();
  process.env.GEOX_INTERNAL_TASK_ISSUER_TOKEN = principal.authorization;
  return principal;
}
