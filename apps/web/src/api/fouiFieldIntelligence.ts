// FOUI-owned same-origin read adapter.
// Boundary: consume existing GET-only canonical MCFT endpoints through the web /api proxy.
// It does not define authority, add backend routes, or alter the canonical MCFT client.

import {
  apiRequestWithPolicy,
} from "./client";
import type {
  McftApiErrorV1,
  McftCollectionPageV1,
  McftFieldTwinScopeV1,
  McftRuntimeReadModelV1,
} from "./mcftFieldTwinRuntime";
const MCFT_ALLOWED_ERROR_STATUSES = [400, 403, 404, 409, 503];

function sameOrigin(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  if (typeof window === "undefined") return normalized;
  return new URL(normalized, window.location.origin).toString();
}

function withParams(path: string, params?: Record<string, unknown>): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value === undefined || value === null || value === "") continue;
    query.set(key, String(value));
  }
  const suffix = query.toString();
  return sameOrigin(suffix ? `${path}?${suffix}` : path);
}

function parseMcftError(status: number, bodyText: string, url: string): McftApiErrorV1 {
  try {
    const parsed = JSON.parse(bodyText) as Partial<McftApiErrorV1> & { code?: string; error?: string };
    return {
      schema_version: String(parsed.schema_version || "mcft_field_twin_api_error_v1"),
      status,
      error_code: String(parsed.error_code || parsed.code || parsed.error || `HTTP_${status}`),
      failed_profiles: Array.isArray(parsed.failed_profiles) ? parsed.failed_profiles.map(String) : [],
      diagnostics: Array.isArray(parsed.diagnostics) ? parsed.diagnostics.map(String) : bodyText ? [bodyText.slice(0, 500)] : [],
      request_id: String(parsed.request_id || "NOT_PROVIDED"),
      url,
    };
  } catch {
    return {
      schema_version: "mcft_field_twin_api_error_v1",
      status,
      error_code: `HTTP_${status}`,
      failed_profiles: [],
      diagnostics: bodyText ? [bodyText.slice(0, 500)] : [],
      request_id: "NOT_PROVIDED",
      url,
    };
  }
}

function runtimePath(scope: McftFieldTwinScopeV1, suffix = ""): string {
  return `/api/v1/operator/twin/fields/${encodeURIComponent(scope.field_id)}/runtime${suffix}`;
}

async function getFouiMcft<T>(scope: McftFieldTwinScopeV1, suffix = "", extra?: Record<string, unknown>): Promise<T> {
  const url = withParams(runtimePath(scope, suffix), {
    tenant_id: scope.tenant_id,
    project_id: scope.project_id,
    group_id: scope.group_id,
    season_id: scope.season_id,
    zone_id: scope.zone_id,
    ...extra,
  });
  const result = await apiRequestWithPolicy<T>(
    url,
    { method: "GET" },
    {
      allowedStatuses: MCFT_ALLOWED_ERROR_STATUSES,
      dedupe: true,
      silent: true,
      timeoutMs: 15000,
    },
  );
  if (result.ok) return result.data;
  throw parseMcftError(result.status, result.bodyText, result.url);
}

export const readFouiMcftRuntime = (scope: McftFieldTwinScopeV1) =>
  getFouiMcft<McftRuntimeReadModelV1>(scope);

export const readFouiMcftStates = (scope: McftFieldTwinScopeV1) =>
  getFouiMcft<McftCollectionPageV1>(scope, "/states", { limit: 50 });

export const readFouiMcftForecasts = (scope: McftFieldTwinScopeV1) =>
  getFouiMcft<McftCollectionPageV1>(scope, "/forecasts", { limit: 50 });
