// MCFT-CAP-09 production External Evidence HTTPS transport.
// Boundary: provider-side HTTPS byte acquisition only. No raw retention, decode,
// canonicalization, DB write, scheduler ownership, cursor mutation, Runtime mutation,
// or GitHub identity dependence. Product providers share the byte client below instead
// of creating provider-specific HTTP stacks.

import type {
  ExternalEvidenceFetchRequestV1,
  ExternalEvidenceFetchResponseV1,
  ExternalEvidenceTransportPortV1,
} from "../mcft_cap09_external_collector_canonicalizer_v1.js";

export const MCFT_CAP09_HTTPS_EXTERNAL_EVIDENCE_TRANSPORT_ID_V1 =
  "MCFT_CAP09_HTTPS_EXTERNAL_EVIDENCE_TRANSPORT_V1" as const;
export const MCFT_CAP09_CONTROLLED_HTTPS_BYTE_CLIENT_ID_V1 =
  "MCFT_CAP09_CONTROLLED_HTTPS_BYTE_CLIENT_V1" as const;

export type HttpsExternalEvidenceTransportConfigV1 = {
  fetch_impl?: typeof fetch;
  clock?: () => Date;
  user_agent: string;
  max_raw_bytes: number;
  timeout_ms: number;
  require_final_path_match?: boolean;
  error_prefix?: string;
};

export type ControlledHttpsByteRequestV1 = {
  locator: string;
  allowed_final_hosts: readonly string[];
  expected_statuses: readonly number[];
  expected_content_type_prefixes?: readonly string[];
  request_headers?: Readonly<Record<string, string>>;
  max_bytes: number;
  require_final_path_match?: boolean;
  error_prefix: string;
};

export type ControlledHttpsByteResponseV1 = {
  status: number;
  final_locator: string;
  content_type: string;
  response_headers: Readonly<Record<string, string>>;
  retrieved_at: string;
  bytes: Uint8Array;
};

export type ControlledHttpsByteClientConfigV1 = {
  fetch_impl?: typeof fetch;
  clock?: () => Date;
  user_agent: string;
  max_raw_bytes: number;
  timeout_ms: number;
};

function requiredTextV1(value: unknown, code: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(code);
  return value.trim();
}

function canonicalIsoV1(value: unknown, code: string): string {
  const text = requiredTextV1(value, code);
  const parsed = Date.parse(text);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== text) throw new Error(code);
  return text;
}

function requireConditionV1(condition: unknown, code: string): asserts condition {
  if (!condition) throw new Error(code);
}

function parseHttpsLocatorV1(value: string, code: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${code}_URL_INVALID`);
  }
  requireConditionV1(parsed.protocol === "https:", `${code}_HTTPS_REQUIRED`);
  requireConditionV1(!parsed.username && !parsed.password && !parsed.hash, `${code}_CREDENTIAL_OR_FRAGMENT_FORBIDDEN`);
  return parsed;
}

function normalizedAllowedHostsV1(hosts: readonly string[], code: string): readonly string[] {
  requireConditionV1(Array.isArray(hosts) && hosts.length > 0, `${code}_ALLOWED_FINAL_HOSTS_REQUIRED`);
  requireConditionV1(
    hosts.every((host) => typeof host === "string" && host.trim() && host === host.toLowerCase()),
    `${code}_ALLOWED_FINAL_HOST_INVALID`,
  );
  return hosts;
}

function normalizedRequestHeadersV1(headers: Readonly<Record<string, string>> | undefined, code: string): Headers {
  const out = new Headers();
  for (const [rawName, rawValue] of Object.entries(headers ?? {})) {
    const name = requiredTextV1(rawName, `${code}_REQUEST_HEADER_NAME_INVALID`);
    const value = requiredTextV1(rawValue, `${code}_REQUEST_HEADER_VALUE_INVALID:${name}`);
    const lower = name.toLowerCase();
    requireConditionV1(
      lower === "accept" || lower === "cache-control" || lower === "range",
      `${code}_REQUEST_HEADER_FORBIDDEN:${name}`,
    );
    out.set(name, value);
  }
  return out;
}

function responseHeadersV1(headers: Headers): Readonly<Record<string, string>> {
  const out: Record<string, string> = {};
  headers.forEach((value, key) => { out[key.toLowerCase()] = value; });
  return Object.freeze(out);
}

export class ControlledHttpsByteClientV1 {
  readonly client_id = MCFT_CAP09_CONTROLLED_HTTPS_BYTE_CLIENT_ID_V1;
  private readonly fetchImpl: typeof fetch;
  private readonly clock: () => Date;
  private readonly userAgent: string;
  private readonly maxRawBytes: number;
  private readonly timeoutMs: number;

  constructor(config: ControlledHttpsByteClientConfigV1) {
    this.fetchImpl = config.fetch_impl ?? fetch;
    this.clock = config.clock ?? (() => new Date());
    this.userAgent = requiredTextV1(config.user_agent, "CONTROLLED_HTTPS_USER_AGENT_REQUIRED");
    requireConditionV1(Number.isSafeInteger(config.max_raw_bytes) && config.max_raw_bytes > 0, "CONTROLLED_HTTPS_MAX_RAW_BYTES_INVALID");
    requireConditionV1(Number.isSafeInteger(config.timeout_ms) && config.timeout_ms > 0, "CONTROLLED_HTTPS_TIMEOUT_INVALID");
    this.maxRawBytes = config.max_raw_bytes;
    this.timeoutMs = config.timeout_ms;
  }

  async requestBytes(request: ControlledHttpsByteRequestV1): Promise<ControlledHttpsByteResponseV1> {
    const prefix = requiredTextV1(request.error_prefix, "CONTROLLED_HTTPS_ERROR_PREFIX_REQUIRED");
    const allowedHosts = normalizedAllowedHostsV1(request.allowed_final_hosts, prefix);
    requireConditionV1(
      Array.isArray(request.expected_statuses) && request.expected_statuses.length > 0 &&
        request.expected_statuses.every((status) => Number.isInteger(status) && status >= 100 && status <= 599),
      `${prefix}_EXPECTED_STATUSES_INVALID`,
    );
    requireConditionV1(
      Number.isSafeInteger(request.max_bytes) && request.max_bytes > 0 && request.max_bytes <= this.maxRawBytes,
      `${prefix}_MAX_BYTES_INVALID`,
    );

    const initial = parseHttpsLocatorV1(request.locator, prefix);
    requireConditionV1(allowedHosts.includes(initial.hostname), `${prefix}_INITIAL_HOST_NOT_ALLOWED:${initial.hostname}`);

    const headers = normalizedRequestHeadersV1(request.request_headers, prefix);
    if (!headers.has("Accept")) headers.set("Accept", "*/*");
    headers.set("User-Agent", this.userAgent);

    const response = await this.fetchImpl(initial.toString(), {
      method: "GET",
      redirect: "follow",
      headers,
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    requireConditionV1(request.expected_statuses.includes(response.status), `${prefix}_HTTP_STATUS:${response.status}`);

    const finalUrl = parseHttpsLocatorV1(response.url || initial.toString(), prefix);
    requireConditionV1(allowedHosts.includes(finalUrl.hostname), `${prefix}_FINAL_HOST_NOT_ALLOWED:${finalUrl.hostname}`);
    if (request.require_final_path_match !== false) {
      requireConditionV1(
        finalUrl.pathname === initial.pathname && finalUrl.search === initial.search,
        `${prefix}_FINAL_IDENTITY_DRIFT`,
      );
    }

    const contentType = response.headers.get("content-type")?.trim() ?? "";
    const expectedTypes = request.expected_content_type_prefixes ?? [];
    if (expectedTypes.length > 0) {
      const normalizedContentType = contentType.toLowerCase();
      requireConditionV1(
        expectedTypes.some((value) => normalizedContentType.startsWith(value.toLowerCase())),
        `${prefix}_CONTENT_TYPE:${contentType || "MISSING"}`,
      );
    }

    const bytes = new Uint8Array(await response.arrayBuffer());
    requireConditionV1(bytes.byteLength > 0 && bytes.byteLength <= request.max_bytes, `${prefix}_RAW_BYTES:${bytes.byteLength}`);

    return {
      status: response.status,
      final_locator: finalUrl.toString(),
      content_type: contentType,
      response_headers: responseHeadersV1(response.headers),
      retrieved_at: canonicalIsoV1(this.clock().toISOString(), `${prefix}_RETRIEVED_AT_INVALID`),
      bytes,
    };
  }
}

export class HttpsExternalEvidenceTransportV1 implements ExternalEvidenceTransportPortV1 {
  readonly transport_id = MCFT_CAP09_HTTPS_EXTERNAL_EVIDENCE_TRANSPORT_ID_V1;
  private readonly clock: () => Date;
  private readonly byteClient: ControlledHttpsByteClientV1;
  private readonly maxRawBytes: number;
  private readonly requireFinalPathMatch: boolean;
  private readonly errorPrefix: string;

  constructor(config: HttpsExternalEvidenceTransportConfigV1) {
    this.clock = config.clock ?? (() => new Date());
    this.maxRawBytes = config.max_raw_bytes;
    this.requireFinalPathMatch = config.require_final_path_match !== false;
    this.errorPrefix = requiredTextV1(config.error_prefix ?? "EXTERNAL_EVIDENCE_HTTPS", "EXTERNAL_EVIDENCE_HTTPS_ERROR_PREFIX_REQUIRED");
    this.byteClient = new ControlledHttpsByteClientV1(config);
  }

  async fetchRawEvidence(request: ExternalEvidenceFetchRequestV1): Promise<ExternalEvidenceFetchResponseV1> {
    const prefix = this.errorPrefix;
    requiredTextV1(request.request_id, `${prefix}_REQUEST_ID_REQUIRED`);
    requiredTextV1(request.provider_id, `${prefix}_PROVIDER_ID_REQUIRED`);
    requiredTextV1(request.source_family, `${prefix}_SOURCE_FAMILY_REQUIRED`);
    requiredTextV1(request.use_policy_ref, `${prefix}_USE_POLICY_REQUIRED`);
    const requestedAt = canonicalIsoV1(request.requested_at, `${prefix}_REQUESTED_AT_INVALID`);
    requireConditionV1(
      Array.isArray(request.expected_content_type_prefixes) && request.expected_content_type_prefixes.length > 0,
      `${prefix}_EXPECTED_CONTENT_TYPES_REQUIRED`,
    );

    const response = await this.byteClient.requestBytes({
      locator: request.locator,
      allowed_final_hosts: request.allowed_final_hosts,
      expected_statuses: [200, 201, 202, 203, 204, 205, 206, 207, 208, 226],
      expected_content_type_prefixes: request.expected_content_type_prefixes,
      request_headers: {
        Accept: [...request.expected_content_type_prefixes, "*/*;q=0.5"].join(","),
      },
      max_bytes: this.maxRawBytes,
      require_final_path_match: this.requireFinalPathMatch,
      error_prefix: prefix,
    });

    const retrievedAt = canonicalIsoV1(this.clock().toISOString(), `${prefix}_RETRIEVED_AT_INVALID`);
    requireConditionV1(Date.parse(retrievedAt) >= Date.parse(requestedAt), `${prefix}_RETRIEVED_BEFORE_REQUEST`);

    return {
      status: response.status,
      final_locator: response.final_locator,
      content_type: response.content_type,
      retrieved_at: retrievedAt,
      available_at: retrievedAt,
      bytes: response.bytes,
    };
  }
}
