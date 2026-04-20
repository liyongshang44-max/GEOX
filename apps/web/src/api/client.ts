import { clearSession, readSessionToken, readTenantContext } from "../auth/authStorage";

const DEFAULT_API_BASE = "http://127.0.0.1:3001";
const API_CONTRACT_VERSION = "2026-04-06";

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

export type ApiAuthCode =
  | "AUTH_MISSING"
  | "AUTH_INVALID"
  | "AUTH_REVOKED"
  | "AUTH_SCOPE_DENIED"
  | "AUTH_ROLE_DENIED"
  | "SERVICE_UNAVAILABLE";

export type ApiRequestResult<T> =
  | { ok: true; status: number; data: T }
  | { ok: false; status: number; data: null; bodyText: string; url: string };

export type ApiRequestPolicyOptions = {
  allowedStatuses?: number[];
  dedupe?: boolean;
  silent?: boolean;
  timeoutMs?: number;
};

export type RequestOptions = {
  allow404?: boolean;
  allow422?: boolean;
  silent?: boolean;
  dedupe?: boolean;
};

export function withQuery(path: string, params?: Record<string, unknown>): string {
  const query = new URLSearchParams();
  const tenant = readTenantContext();
  const merged = {
    ...params,
    tenant_id: (params?.tenant_id as string | undefined) ?? tenant?.tenant_id,
    project_id: (params?.project_id as string | undefined) ?? tenant?.project_id,
    group_id: (params?.group_id as string | undefined) ?? tenant?.group_id,
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

function parseErrorBodyCode(bodyText: string): string {
  try {
    const parsed = JSON.parse(bodyText) as { code?: string; error?: string; message?: string };
    return String(parsed.code || parsed.error || parsed.message || "").toUpperCase();
  } catch {
    return String(bodyText || "").toUpperCase();
  }
}

function toAuthCode(error: ApiError): ApiAuthCode | null {
  const bodyCode = parseErrorBodyCode(error.bodyText);
  if (error.status === 401 && (bodyCode.includes("REVOKED") || bodyCode.includes("AUTH_REVOKED"))) return "AUTH_REVOKED";
  if (error.status === 401 && (bodyCode.includes("MISSING") || bodyCode.includes("AUTH_MISSING") || bodyCode.includes("TOKEN_REQUIRED"))) return "AUTH_MISSING";
  if (error.status === 401) return "AUTH_INVALID";
  if (error.status === 403 && (bodyCode.includes("ROLE") || bodyCode.includes("AUTH_ROLE_DENIED"))) return "AUTH_ROLE_DENIED";
  if (error.status === 403) return "AUTH_SCOPE_DENIED";
  if (error.status === 408 || error.status >= 500) return "SERVICE_UNAVAILABLE";
  return null;
}

let lastGlobalFeedbackAt = 0;
function notifyGlobal(message: string): void {
  const now = Date.now();
  if (now - lastGlobalFeedbackAt < 2500) return;
  lastGlobalFeedbackAt = now;
  if (typeof window !== "undefined") window.alert(message);
}

function handleGlobalApiFailure(error: ApiError): void {
  if (typeof window === "undefined") return;
  const code = toAuthCode(error);
  if (!code) return;

  if (code === "AUTH_MISSING" || code === "AUTH_INVALID" || code === "AUTH_REVOKED") {
    clearSession();
    notifyGlobal("登录状态已失效，请重新登录。");
    if (window.location.pathname !== "/login") {
      window.location.assign(`/login?reason=${code}`);
    }
    return;
  }

  if (code === "AUTH_SCOPE_DENIED" || code === "AUTH_ROLE_DENIED") {
    notifyGlobal("当前身份仅允许查看/需联系实施或支持。");
    return;
  }

  if (code === "SERVICE_UNAVAILABLE") {
    notifyGlobal("服务暂不可用，请稍后重试。");
  }
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
const DEFAULT_API_TIMEOUT_MS = 12000;

export async function apiRequestWithPolicy<T>(
  path: string,
  init?: RequestInit,
  options?: ApiRequestPolicyOptions,
): Promise<ApiRequestResult<T>> {
  const token = readSessionToken();
  const tenant = readTenantContext();
  const finalUrl = resolveUrl(path);
  const key = buildRequestKey(finalUrl, init);
  if (options?.dedupe && inflightRequests.has(key)) {
    return inflightRequests.get(key)! as Promise<ApiRequestResult<T>>;
  }

  const runner = (async () => {
    try {
      const headers = new Headers(init?.headers ?? undefined);
      if (!(init?.body instanceof FormData) && !headers.has("Content-Type")) {
        headers.set("Content-Type", "application/json");
      }
      if (!headers.has("x-api-contract-version")) {
        headers.set("x-api-contract-version", API_CONTRACT_VERSION);
      }
      if (token && !headers.has("Authorization")) {
        headers.set("Authorization", `Bearer ${token}`);
      }
      if (tenant?.tenant_id && !headers.has("x-tenant-id")) {
        headers.set("x-tenant-id", tenant.tenant_id);
      }
      if (tenant?.project_id && !headers.has("x-project-id")) {
        headers.set("x-project-id", tenant.project_id);
      }
      if (tenant?.group_id && !headers.has("x-group-id")) {
        headers.set("x-group-id", tenant.group_id);
      }

      const timeoutMs = Number.isFinite(Number(options?.timeoutMs)) ? Math.max(1000, Number(options?.timeoutMs)) : DEFAULT_API_TIMEOUT_MS;
      const timeoutController = new AbortController();
      const externalSignal = init?.signal;
      const abortByExternalSignal = () => timeoutController.abort();
      if (externalSignal) {
        if (externalSignal.aborted) timeoutController.abort();
        else externalSignal.addEventListener("abort", abortByExternalSignal, { once: true });
      }
      const timer = setTimeout(() => timeoutController.abort(), timeoutMs);

      let response: Response;
      try {
        response = await fetch(finalUrl, {
          ...init,
          headers,
          signal: timeoutController.signal,
        });
      } finally {
        clearTimeout(timer);
        if (externalSignal) externalSignal.removeEventListener("abort", abortByExternalSignal);
      }

      const text = await response.text();
      if (!response.ok) {
        if (Array.isArray(options?.allowedStatuses) && options.allowedStatuses.includes(response.status)) {
          return { ok: false as const, status: response.status, data: null, bodyText: text, url: finalUrl };
        }
        throw new ApiError(response.status, text, finalUrl);
      }

      try {
        return { ok: true as const, status: response.status, data: text ? (JSON.parse(text) as T) : ({} as T) };
      } catch {
        throw new ApiError(response.status, `Invalid JSON response: ${text.slice(0, 300)}`, finalUrl);
      }
    } catch (error: any) {
      if (error?.name === "AbortError") {
        const timeoutMs = Number.isFinite(Number(options?.timeoutMs)) ? Math.max(1000, Number(options?.timeoutMs)) : DEFAULT_API_TIMEOUT_MS;
        const timeoutError = new ApiError(408, `Request timeout after ${timeoutMs}ms`, finalUrl);
        handleGlobalApiFailure(timeoutError);
        throw timeoutError;
      }
      if (error instanceof ApiError) {
        handleGlobalApiFailure(error);
      } else if (error instanceof TypeError) {
        const networkError = new ApiError(408, "Network request failed", finalUrl);
        handleGlobalApiFailure(networkError);
      }
      if (!options?.silent) {
        // no-op: reserved hook for future centralized logging
      }
      throw error;
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
  options?: ApiRequestPolicyOptions,
): Promise<T | null> {
  const allowedStatuses = options?.allowedStatuses ?? [...OPTIONAL_API_STATUSES];
  const res = await apiRequestWithPolicy<T>(path, init, {
    allowedStatuses,
    dedupe: options?.dedupe,
    silent: options?.silent,
    timeoutMs: options?.timeoutMs,
  });
  return res.ok ? res.data : null;
}

export async function request<T>(path: string, init?: RequestInit, options?: RequestOptions): Promise<ApiRequestResult<T>> {
  const allowedStatuses: number[] = [];
  if (options?.allow404) allowedStatuses.push(404);
  if (options?.allow422) allowedStatuses.push(422);
  return apiRequestWithPolicy<T>(path, init, {
    allowedStatuses,
    dedupe: options?.dedupe,
    silent: options?.silent,
  });
}

export const requestJson = apiRequest;
