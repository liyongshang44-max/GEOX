import { readSessionToken, readTenantContext } from "../auth/authStorage";

const DEFAULT_API_BASE = "http://127.0.0.1:3001";

export const API_BASE_URL = String(
  (import.meta as any)?.env?.VITE_API_BASE_URL ??
  (import.meta as any)?.env?.VITE_API_BASE ??
  DEFAULT_API_BASE
).replace(/\/+$/, "");

export const OPTIONAL_API_STATUSES = [404, 422] as const;

export class ApiError extends Error {
  public status: number;
  public bodyText: string;
  public url: string;

  constructor(status: number, bodyText: string, url: string) {
    super(`API ${status} ${url}`);
    this.status = status;
    this.bodyText = bodyText;
    this.url = url;
  }
}

export type ApiRequestResult<T> =
  | { ok: true; status: number; data: T }
  | { ok: false; status: number; data: null; bodyText: string; url: string };

export function withQuery(path: string, params?: Record<string, unknown>): string {
  const query = new URLSearchParams();
  const tenant = readTenantContext();
  const merged = {
    ...params,
    tenant_id: (params?.tenant_id as string | undefined) ?? tenant.tenant_id,
    project_id: (params?.project_id as string | undefined) ?? tenant.project_id,
    group_id: (params?.group_id as string | undefined) ?? tenant.group_id,
  };

  for (const [key, value] of Object.entries(merged ?? {})) {
    if (value === undefined || value === null || value === "") continue;
    if (Array.isArray(value)) {
      for (const item of value) query.append(key, String(item));
      continue;
    }
    query.set(key, String(value));
  }
  const queryString = query.toString();
  return queryString ? `${path}?${queryString}` : path;
}

function resolveUrl(path: string): string {
  return /^https?:\/\//i.test(path) ? path : `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

export async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await apiRequestWithPolicy<T>(path, init);
  if (!res.ok) {
    throw new ApiError(res.status, res.bodyText, res.url);
  }
  return res.data;
}

function buildRequestKey(url: string, init?: RequestInit): string {
  const method = (init?.method || "GET").toUpperCase();
  const body = typeof init?.body === "string" ? init.body : init?.body ? "[binary-body]" : "";
  return `${method}:${url}:${body}`;
}

const inflightRequests = new Map<string, Promise<ApiRequestResult<any>>>();

export async function apiRequestWithPolicy<T>(
  path: string,
  init?: RequestInit,
  options?: { allowedStatuses?: number[]; dedupe?: boolean },
): Promise<ApiRequestResult<T>> {
  const token = readSessionToken();
  const tenant = readTenantContext();
  const finalUrl = resolveUrl(path);
  const key = buildRequestKey(finalUrl, init);
  if (options?.dedupe && inflightRequests.has(key)) {
    return inflightRequests.get(key)! as Promise<ApiRequestResult<T>>;
  }

  const runner = (async () => {
  const baseHeaders = init?.body instanceof FormData
    ? { ...(init?.headers ?? {}) }
    : { "Content-Type": "application/json", ...(init?.headers ?? {}) };

  const response = await fetch(finalUrl, {
    ...init,
    headers: {
      ...baseHeaders,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(tenant.tenant_id ? { "x-tenant-id": tenant.tenant_id } : {}),
      ...(tenant.project_id ? { "x-project-id": tenant.project_id } : {}),
      ...(tenant.group_id ? { "x-group-id": tenant.group_id } : {}),
    },
  });

  const text = await response.text();
  if (!response.ok) {
    if (Array.isArray(options?.allowedStatuses) && options!.allowedStatuses!.includes(response.status)) {
      return { ok: false as const, status: response.status, data: null, bodyText: text, url: finalUrl };
    }
    throw new ApiError(response.status, text, finalUrl);
  }

  try {
    return { ok: true as const, status: response.status, data: text ? (JSON.parse(text) as T) : ({} as T) };
  } catch {
    throw new ApiError(response.status, `Invalid JSON response: ${text.slice(0, 300)}`, finalUrl);
  }
  })();

  if (!options?.dedupe) return runner;

  inflightRequests.set(key, runner as Promise<ApiRequestResult<any>>);
  try {
    return await runner;
  } finally {
    inflightRequests.delete(key);
  }
}

export async function apiRequestOptional<T>(
  path: string,
  init?: RequestInit,
  options?: { allowedStatuses?: number[]; dedupe?: boolean },
): Promise<T | null> {
  const allowedStatuses = options?.allowedStatuses ?? [...OPTIONAL_API_STATUSES];
  const res = await apiRequestWithPolicy<T>(path, init, {
    allowedStatuses,
    dedupe: options?.dedupe,
  });
  return res.ok ? res.data : null;
}

export const requestJson = apiRequest;
