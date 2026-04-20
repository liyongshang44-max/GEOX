import { persistTenantContext } from "../auth/authStorage";
import { apiRequest, ApiError } from "./client";

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

export type LoginErrorCode = "MISSING_TOKEN" | "INVALID_TOKEN" | "MISSING_CONTEXT" | "INSUFFICIENT_SCOPE" | "SERVICE_UNREACHABLE" | "UNKNOWN";

export class LoginError extends Error {
  public readonly code: LoginErrorCode;

  constructor(code: LoginErrorCode, message?: string) {
    super(message ?? code);
    this.code = code;
  }
}

function parseCodeFromBody(bodyText: string): string {
  try {
    const parsed = JSON.parse(bodyText) as { code?: string; error?: string; message?: string };
    return String(parsed.code || parsed.error || parsed.message || "").toUpperCase();
  } catch {
    return String(bodyText || "").toUpperCase();
  }
}

function mapLoginApiError(error: unknown): LoginError {
  if (error instanceof ApiError) {
    const bodyCode = parseCodeFromBody(error.bodyText);

    if (error.status === 400 && (bodyCode.includes("MISSING_TOKEN") || bodyCode.includes("TOKEN_REQUIRED"))) {
      return new LoginError("MISSING_TOKEN");
    }

    if (error.status === 400 && (bodyCode.includes("MISSING_CONTEXT") || bodyCode.includes("TENANT") || bodyCode.includes("PROJECT") || bodyCode.includes("GROUP"))) {
      return new LoginError("MISSING_CONTEXT");
    }

    if (error.status === 401 || bodyCode.includes("INVALID_TOKEN") || bodyCode.includes("TOKEN_INVALID") || bodyCode.includes("UNAUTHORIZED")) {
      return new LoginError("INVALID_TOKEN");
    }

    if (error.status === 403 || bodyCode.includes("INSUFFICIENT_SCOPE") || bodyCode.includes("FORBIDDEN") || bodyCode.includes("SCOPE")) {
      return new LoginError("INSUFFICIENT_SCOPE");
    }

    if (error.status === 408 || error.status >= 500) {
      return new LoginError("SERVICE_UNREACHABLE");
    }

    return new LoginError("UNKNOWN");
  }

  return new LoginError("SERVICE_UNREACHABLE");
}

function ensureTenantContext(source: Pick<AuthMe, "tenant_id" | "project_id" | "group_id">): void {
  if (!source.tenant_id || !source.project_id || !source.group_id) {
    throw new LoginError("MISSING_CONTEXT");
  }
  persistTenantContext({
    tenant_id: source.tenant_id,
    project_id: source.project_id,
    group_id: source.group_id,
  });
}

export async function loginWithToken(token: string): Promise<AuthMe> {
  const cleanToken = String(token || "").trim();
  if (!cleanToken) {
    throw new LoginError("MISSING_TOKEN");
  }

  try {
    const me = await apiRequest<AuthMe>("/api/v1/auth/login", {
      method: "POST",
      body: JSON.stringify({ token: cleanToken }),
    });

    ensureTenantContext(me);
    return me;
  } catch (error) {
    throw mapLoginApiError(error);
  }
}

export async function fetchAuthMe(): Promise<AuthMe> {
  const me = await apiRequest<AuthMe>("/api/v1/auth/me");
  ensureTenantContext(me);
  return me;
}
