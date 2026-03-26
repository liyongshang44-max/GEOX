import { readSessionToken } from "../auth/authStorage";

export const API_BASE_URL = String(
  (import.meta as any)?.env?.VITE_API_BASE_URL ??
  (import.meta as any)?.env?.VITE_API_BASE ??
  "/api"
).replace(/\/+$/, "");

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

export function withQuery(path: string, params?: Record<string, unknown>): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params ?? {})) {
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
  const token = readSessionToken();
  const finalUrl = resolveUrl(path);
  const baseHeaders = init?.body instanceof FormData
    ? { ...(init?.headers ?? {}) }
    : { "Content-Type": "application/json", ...(init?.headers ?? {}) };

  const response = await fetch(finalUrl, {
    ...init,
    headers: {
      ...baseHeaders,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  const text = await response.text();
  if (!response.ok) {
    throw new ApiError(response.status, text, finalUrl);
  }

  try {
    return text ? (JSON.parse(text) as T) : ({} as T);
  } catch {
    throw new ApiError(response.status, `Invalid JSON response: ${text.slice(0, 300)}`, finalUrl);
  }
}

export const requestJson = apiRequest;
