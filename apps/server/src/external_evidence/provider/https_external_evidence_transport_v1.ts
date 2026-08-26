// MCFT-CAP-09 production External Evidence HTTPS transport.
// Boundary: provider-side GET only. No raw retention, decode, canonicalization, DB write,
// scheduler ownership, cursor mutation, Runtime mutation, or GitHub identity dependence.

import type {
  ExternalEvidenceFetchRequestV1,
  ExternalEvidenceFetchResponseV1,
  ExternalEvidenceTransportPortV1,
} from "../mcft_cap09_external_collector_canonicalizer_v1.js";

export const MCFT_CAP09_HTTPS_EXTERNAL_EVIDENCE_TRANSPORT_ID_V1 =
  "MCFT_CAP09_HTTPS_EXTERNAL_EVIDENCE_TRANSPORT_V1" as const;

export type HttpsExternalEvidenceTransportConfigV1 = {
  fetch_impl?: typeof fetch;
  clock?: () => Date;
  user_agent: string;
  max_raw_bytes: number;
  timeout_ms: number;
  require_final_path_match?: boolean;
  error_prefix?: string;
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

export class HttpsExternalEvidenceTransportV1 implements ExternalEvidenceTransportPortV1 {
  readonly transport_id = MCFT_CAP09_HTTPS_EXTERNAL_EVIDENCE_TRANSPORT_ID_V1;
  private readonly fetchImpl: typeof fetch;
  private readonly clock: () => Date;
  private readonly userAgent: string;
  private readonly maxRawBytes: number;
  private readonly timeoutMs: number;
  private readonly requireFinalPathMatch: boolean;
  private readonly errorPrefix: string;

  constructor(config: HttpsExternalEvidenceTransportConfigV1) {
    this.fetchImpl = config.fetch_impl ?? fetch;
    this.clock = config.clock ?? (() => new Date());
    this.userAgent = requiredTextV1(config.user_agent, "EXTERNAL_EVIDENCE_HTTPS_USER_AGENT_REQUIRED");
    requireConditionV1(Number.isSafeInteger(config.max_raw_bytes) && config.max_raw_bytes > 0, "EXTERNAL_EVIDENCE_HTTPS_MAX_RAW_BYTES_INVALID");
    requireConditionV1(Number.isSafeInteger(config.timeout_ms) && config.timeout_ms > 0, "EXTERNAL_EVIDENCE_HTTPS_TIMEOUT_INVALID");
    this.maxRawBytes = config.max_raw_bytes;
    this.timeoutMs = config.timeout_ms;
    this.requireFinalPathMatch = config.require_final_path_match !== false;
    this.errorPrefix = requiredTextV1(config.error_prefix ?? "EXTERNAL_EVIDENCE_HTTPS", "EXTERNAL_EVIDENCE_HTTPS_ERROR_PREFIX_REQUIRED");
  }

  async fetchRawEvidence(request: ExternalEvidenceFetchRequestV1): Promise<ExternalEvidenceFetchResponseV1> {
    const prefix = this.errorPrefix;
    requiredTextV1(request.request_id, `${prefix}_REQUEST_ID_REQUIRED`);
    requiredTextV1(request.provider_id, `${prefix}_PROVIDER_ID_REQUIRED`);
    requiredTextV1(request.source_family, `${prefix}_SOURCE_FAMILY_REQUIRED`);
    requiredTextV1(request.use_policy_ref, `${prefix}_USE_POLICY_REQUIRED`);
    const requestedAt = canonicalIsoV1(request.requested_at, `${prefix}_REQUESTED_AT_INVALID`);
    requireConditionV1(Array.isArray(request.allowed_final_hosts) && request.allowed_final_hosts.length > 0, `${prefix}_ALLOWED_FINAL_HOSTS_REQUIRED`);
    requireConditionV1(
      request.allowed_final_hosts.every((host) => typeof host === "string" && host.trim() && host === host.toLowerCase()),
      `${prefix}_ALLOWED_FINAL_HOST_INVALID`,
    );
    requireConditionV1(
      Array.isArray(request.expected_content_type_prefixes) && request.expected_content_type_prefixes.length > 0,
      `${prefix}_EXPECTED_CONTENT_TYPES_REQUIRED`,
    );

    const initial = parseHttpsLocatorV1(request.locator, prefix);
    requireConditionV1(request.allowed_final_hosts.includes(initial.hostname), `${prefix}_INITIAL_HOST_NOT_ALLOWED:${initial.hostname}`);

    const accept = [...request.expected_content_type_prefixes, "*/*;q=0.5"].join(",");
    const response = await this.fetchImpl(initial.toString(), {
      method: "GET",
      redirect: "follow",
      headers: { Accept: accept, "User-Agent": this.userAgent },
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    requireConditionV1(response.status >= 200 && response.status < 300, `${prefix}_HTTP_STATUS:${response.status}`);

    const finalUrl = parseHttpsLocatorV1(response.url || initial.toString(), prefix);
    requireConditionV1(request.allowed_final_hosts.includes(finalUrl.hostname), `${prefix}_FINAL_HOST_NOT_ALLOWED:${finalUrl.hostname}`);
    if (this.requireFinalPathMatch) {
      requireConditionV1(
        finalUrl.pathname === initial.pathname && finalUrl.search === initial.search,
        `${prefix}_FINAL_IDENTITY_DRIFT`,
      );
    }

    const contentType = response.headers.get("content-type")?.trim() ?? "";
    const normalizedContentType = contentType.toLowerCase();
    requireConditionV1(
      request.expected_content_type_prefixes.some((value) => normalizedContentType.startsWith(value.toLowerCase())),
      `${prefix}_CONTENT_TYPE:${contentType || "MISSING"}`,
    );

    const bytes = new Uint8Array(await response.arrayBuffer());
    requireConditionV1(bytes.byteLength > 0 && bytes.byteLength <= this.maxRawBytes, `${prefix}_RAW_BYTES:${bytes.byteLength}`);

    const retrievedAt = canonicalIsoV1(this.clock().toISOString(), `${prefix}_RETRIEVED_AT_INVALID`);
    requireConditionV1(Date.parse(retrievedAt) >= Date.parse(requestedAt), `${prefix}_RETRIEVED_BEFORE_REQUEST`);

    return {
      status: response.status,
      final_locator: finalUrl.toString(),
      content_type: contentType,
      retrieved_at: retrievedAt,
      available_at: retrievedAt,
      bytes,
    };
  }
}
