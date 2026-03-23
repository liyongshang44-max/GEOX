import { readSessionToken } from "../auth/authStorage";

const API_BASE = "http://127.0.0.1:3000";

export class ApiError extends Error {
  public status: number;
  public bodyText: string;

  constructor(status: number, bodyText: string) {
    super(`API ${status}`);
    this.status = status;
    this.bodyText = bodyText;
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

export async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const token = readSessionToken();
  const finalUrl = /^https?:\/\//i.test(path) ? path : `${API_BASE}${path}`;
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
  if (!response.ok) throw new ApiError(response.status, text);
  return text ? (JSON.parse(text) as T) : ({} as T);
}
