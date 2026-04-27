export type TenantTriple = { tenant_id: string; project_id: string; group_id: string };

export const SKILLS_API_CONTRACT_VERSION = "2026-04-06";
export const SKILLS_LEGACY_READ_SUCCESSOR_ENDPOINT = "/api/v1/skills";
export const SKILLS_LEGACY_RUNS_READ_SUCCESSOR_ENDPOINT = "/api/v1/skill-runs";
export const SKILLS_LEGACY_MUTATION_WRITE_SUCCESSOR_ENDPOINT = "/api/v1/skills/bindings/override";
export const SKILLS_DEPRECATION_SUNSET = "Wed, 30 Sep 2026 00:00:00 GMT";

export function tenantFromQuery(query: Record<string, unknown>, auth: TenantTriple): TenantTriple {
  return {
    tenant_id: String(query.tenant_id ?? auth.tenant_id).trim(),
    project_id: String(query.project_id ?? auth.project_id).trim(),
    group_id: String(query.group_id ?? auth.group_id).trim(),
  };
}

export function tenantFromBody(body: Record<string, unknown>, auth: TenantTriple): TenantTriple {
  return {
    tenant_id: String(body.tenant_id ?? auth.tenant_id).trim(),
    project_id: String(body.project_id ?? auth.project_id).trim(),
    group_id: String(body.group_id ?? auth.group_id).trim(),
  };
}

export function tenantMatches(auth: TenantTriple, tenant: TenantTriple): boolean {
  return auth.tenant_id === tenant.tenant_id && auth.project_id === tenant.project_id && auth.group_id === tenant.group_id;
}

export function toInt(value: unknown, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.trunc(n);
}

export function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

export function boolLike(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const s = value.trim().toLowerCase();
    if (s === "true" || s === "1") return true;
    if (s === "false" || s === "0") return false;
  }
  return fallback;
}

export function setSkillsLegacyDeprecationHeaders(reply: any, successorEndpoint: string): void {
  reply.header("Deprecation", "true");
  reply.header("Link", `<${successorEndpoint}>; rel=\"successor-version\"`);
  reply.header("Sunset", SKILLS_DEPRECATION_SUNSET);
}

export function mapSkillsInternalError(error: unknown): { status: number; payload: Record<string, unknown> } {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("INVALID_TRIGGER_STAGE") || (message.includes("Invalid enum value") && message.includes("trigger_stage"))) {
    return {
      status: 400,
      payload: {
        ok: false,
        error: "INVALID_TRIGGER_STAGE",
        message:
          message.includes("Invalid enum value")
            ? "trigger_stage 校验失败：before_approval 已弃用，请改用 after_recommendation。允许值：before_recommendation | before_dispatch | before_acceptance | after_acceptance | after_recommendation"
            : message,
      },
    };
  }
  return { status: 500, payload: { ok: false, error: message } };
}
