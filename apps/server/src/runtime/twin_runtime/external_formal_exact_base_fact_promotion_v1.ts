import {
  MCFT_CAP09_FORMAL_RAW_BUCKET_V1,
} from "../../external_evidence/producer_bound_transient_raw_evidence_reader_v1.js";
import {
  MCFT_CAP09_FORMAL_RAW_RETENTION_PREFIX_V1,
} from "../../external_evidence/s3_compatible_raw_evidence_retention_adapter_v1.js";
import type { CanonicalizedExternalEvidenceResultV1 } from "../../external_evidence/mcft_cap09_external_collector_canonicalizer_v1.js";
import type { ExternalFormalEvidenceIngressResultV1 } from "../../persistence/twin_runtime/postgres_external_formal_evidence_ingress_v1.js";
import type { ExternalFormalPhysicalFactIdentityV1 } from "./postgres_external_formal_forcing_base_continuity_repository_v1.js";

export const MCFT_CAP09_EXACT_BASE_FACT_PROMOTION_ID_V1 = "EXACT_BASE_CANONICAL_FACT_PROMOTION_V1" as const;

export type ExternalFormalExactBaseSemanticManifestRowV1 = {
  record_type: string;
  source_record_id: string;
  record_semantic_sha256: string;
};

export type ExternalFormalExactBaseFactPromotionMutationStateV1 =
  | "NO_FORMAL_MUTATION"
  | "PARTIAL_FORMAL_MUTATION"
  | "UNKNOWN_FORMAL_MUTATION";

export class ExternalFormalExactBaseFactPromotionFailureV1 extends Error {
  readonly failure_class: string;
  readonly mutation_state: ExternalFormalExactBaseFactPromotionMutationStateV1;
  readonly confirmed_new_fact_write_count: number | null;

  constructor(input: {
    failure_class: string;
    mutation_state: ExternalFormalExactBaseFactPromotionMutationStateV1;
    confirmed_new_fact_write_count: number | null;
    cause?: unknown;
  }) {
    super(input.failure_class, input.cause === undefined ? undefined : { cause: input.cause });
    this.name = "ExternalFormalExactBaseFactPromotionFailureV1";
    this.failure_class = input.failure_class;
    this.mutation_state = input.mutation_state;
    this.confirmed_new_fact_write_count = input.confirmed_new_fact_write_count;
  }
}

export interface ExternalFormalExactBaseFactIngressPortV1 {
  appendCanonicalizedExternalEvidence(result: CanonicalizedExternalEvidenceResultV1): Promise<ExternalFormalEvidenceIngressResultV1>;
}

export type ExternalFormalExactBaseFactPromotionReceiptV1 = {
  promotion_id: typeof MCFT_CAP09_EXACT_BASE_FACT_PROMOTION_ID_V1;
  status: "PASS";
  base_target_t: string;
  facts: readonly ExternalFormalPhysicalFactIdentityV1[];
  formal_fact_present_count: 3;
  formal_database_write_count: 0 | 1 | 2 | 3;
  idempotent_existing_fact_count: 0 | 1 | 2 | 3;
};

const EXPECTED_TYPES = [
  "future_et0_assumption_v1",
  "future_weather_assumption_v1",
  "soil_moisture_observation_v1",
] as const;

function canonicalHour(value: unknown, code: string): string {
  const text = typeof value === "string" ? value.trim() : "";
  const parsed = Date.parse(text);
  if (!text || !Number.isFinite(parsed) || new Date(parsed).toISOString() !== text || !text.endsWith(":00:00.000Z")) throw new Error(code);
  return text;
}

function recordKind(recordType: string): ExternalFormalPhysicalFactIdentityV1["kind"] {
  if (recordType === "future_weather_assumption_v1") return "WEATHER";
  if (recordType === "future_et0_assumption_v1") return "ET0";
  if (recordType === "soil_moisture_observation_v1") return "SOIL";
  throw new Error(`EXACT_BASE_FACT_PROMOTION_RECORD_TYPE_FORBIDDEN:${recordType}`);
}

function exactFormalRetention(result: CanonicalizedExternalEvidenceResultV1): void {
  let parsed: URL;
  try { parsed = new URL(result.raw_provenance.retention_ref); }
  catch { throw new Error("EXACT_BASE_FACT_PROMOTION_FORMAL_RETENTION_REF_INVALID"); }
  if (parsed.protocol !== "s3-private:" || parsed.hostname !== MCFT_CAP09_FORMAL_RAW_BUCKET_V1) {
    throw new Error("EXACT_BASE_FACT_PROMOTION_PRIVATE_FORMAL_RETENTION_REQUIRED");
  }
  const key = parsed.pathname.replace(/^\/+/, "");
  if (!key.startsWith(`${MCFT_CAP09_FORMAL_RAW_RETENTION_PREFIX_V1}/`)) {
    throw new Error("EXACT_BASE_FACT_PROMOTION_CONTENT_ADDRESS_FORMAL_RAW_REQUIRED");
  }
  if (key.includes("mcft-cap09-ea5e2-readiness-transient-v1")) {
    throw new Error("EXACT_BASE_FACT_PROMOTION_TRANSIENT_RETENTION_FORBIDDEN");
  }
}

function normalizedManifest(rows: readonly ExternalFormalExactBaseSemanticManifestRowV1[]): ExternalFormalExactBaseSemanticManifestRowV1[] {
  return rows.map((row) => ({ ...row })).sort((a, b) => a.record_type.localeCompare(b.record_type) || a.source_record_id.localeCompare(b.source_record_id));
}

export function validateExternalFormalExactBasePromotionInputV1(input: {
  base_target_t: string;
  results: readonly CanonicalizedExternalEvidenceResultV1[];
  expected_semantic_manifest: readonly ExternalFormalExactBaseSemanticManifestRowV1[];
}): { base: string; results: CanonicalizedExternalEvidenceResultV1[] } {
  const base = canonicalHour(input.base_target_t, "EXACT_BASE_FACT_PROMOTION_BASE_INVALID");
  const results = [...input.results].sort((a, b) => a.record.record_type.localeCompare(b.record.record_type));
  if (results.length !== 3 || JSON.stringify(results.map((item) => item.record.record_type)) !== JSON.stringify(EXPECTED_TYPES)) {
    throw new Error("EXACT_BASE_FACT_PROMOTION_EXACT_THREE_TYPES_REQUIRED");
  }
  const actualManifest = normalizedManifest(results.map((item) => ({
    record_type: item.record.record_type,
    source_record_id: item.record.source_record_id,
    record_semantic_sha256: item.record_semantic_sha256,
  })));
  if (JSON.stringify(actualManifest) !== JSON.stringify(normalizedManifest(input.expected_semantic_manifest))) {
    throw new Error("EXACT_BASE_FACT_PROMOTION_SEMANTIC_MANIFEST_MISMATCH");
  }

  for (const result of results) {
    exactFormalRetention(result);
    const record = result.record as any;
    if (record.record_type === "future_weather_assumption_v1" || record.record_type === "future_et0_assumption_v1") {
      if (record.role_time?.valid_from !== base) throw new Error(`EXACT_BASE_FACT_PROMOTION_VALID_FROM_MISMATCH:${record.record_type}`);
    } else {
      const observedAt = Date.parse(String(record.role_time?.observed_at ?? ""));
      if (!Number.isFinite(observedAt) || observedAt > Date.parse(base)) throw new Error("EXACT_BASE_FACT_PROMOTION_SOIL_AFTER_BASE_FORBIDDEN");
    }
  }
  return { base, results };
}

function asBoundedCount(value: number, code: string): 0 | 1 | 2 | 3 {
  if (!Number.isInteger(value) || value < 0 || value > 3) throw new Error(code);
  return value as 0 | 1 | 2 | 3;
}

export async function promoteExternalFormalExactBaseCanonicalFactsV1(
  input: {
    base_target_t: string;
    results: readonly CanonicalizedExternalEvidenceResultV1[];
    expected_semantic_manifest: readonly ExternalFormalExactBaseSemanticManifestRowV1[];
  },
  ingress: ExternalFormalExactBaseFactIngressPortV1,
): Promise<ExternalFormalExactBaseFactPromotionReceiptV1> {
  let validated: { base: string; results: CanonicalizedExternalEvidenceResultV1[] };
  try {
    validated = validateExternalFormalExactBasePromotionInputV1(input);
  } catch (error) {
    throw new ExternalFormalExactBaseFactPromotionFailureV1({
      failure_class: error instanceof Error ? error.message : String(error),
      mutation_state: "NO_FORMAL_MUTATION",
      confirmed_new_fact_write_count: 0,
      cause: error,
    });
  }

  const facts: ExternalFormalPhysicalFactIdentityV1[] = [];
  let newWrites = 0;
  let existing = 0;
  for (const result of validated.results) {
    let receipt: ExternalFormalEvidenceIngressResultV1;
    try {
      receipt = await ingress.appendCanonicalizedExternalEvidence(result);
    } catch (error) {
      // Commit outcome of the current append is not safely knowable from an exception alone.
      // Even with zero previously-confirmed writes, never downgrade this to NO_FORMAL_MUTATION.
      throw new ExternalFormalExactBaseFactPromotionFailureV1({
        failure_class: `EXACT_BASE_FACT_PROMOTION_INGRESS_OUTCOME_UNCERTAIN:${error instanceof Error ? error.message : String(error)}`,
        mutation_state: "UNKNOWN_FORMAL_MUTATION",
        confirmed_new_fact_write_count: null,
        cause: error,
      });
    }

    newWrites += receipt.canonical_fact_write_count;
    if (receipt.status === "EXISTING_IDEMPOTENT_SUCCESS") existing += 1;
    try {
      if (
        receipt.record_type !== result.record.record_type
        || receipt.source_record_id !== result.record.source_record_id
        || receipt.source_record_hash !== result.record.source_record_hash
      ) {
        throw new Error("EXACT_BASE_FACT_PROMOTION_INGRESS_RECEIPT_IDENTITY_MISMATCH");
      }
      facts.push({
        kind: recordKind(result.record.record_type),
        fact_id: receipt.fact_id,
        source_record_id: receipt.source_record_id,
        source_record_hash: receipt.source_record_hash,
        record_semantic_hash: result.record_semantic_sha256,
      });
    } catch (error) {
      throw new ExternalFormalExactBaseFactPromotionFailureV1({
        failure_class: error instanceof Error ? error.message : String(error),
        mutation_state: newWrites > 0 ? "PARTIAL_FORMAL_MUTATION" : "UNKNOWN_FORMAL_MUTATION",
        confirmed_new_fact_write_count: newWrites > 0 ? newWrites : null,
        cause: error,
      });
    }
  }

  if (facts.length !== 3 || newWrites + existing !== 3) {
    throw new ExternalFormalExactBaseFactPromotionFailureV1({
      failure_class: "EXACT_BASE_FACT_PROMOTION_EXACT_THREE_PRESENT_REQUIRED",
      mutation_state: newWrites > 0 ? "PARTIAL_FORMAL_MUTATION" : "UNKNOWN_FORMAL_MUTATION",
      confirmed_new_fact_write_count: newWrites > 0 ? newWrites : null,
    });
  }

  return {
    promotion_id: MCFT_CAP09_EXACT_BASE_FACT_PROMOTION_ID_V1,
    status: "PASS",
    base_target_t: validated.base,
    facts,
    formal_fact_present_count: 3,
    formal_database_write_count: asBoundedCount(newWrites, "EXACT_BASE_FACT_PROMOTION_NEW_WRITE_COUNT_INVALID"),
    idempotent_existing_fact_count: asBoundedCount(existing, "EXACT_BASE_FACT_PROMOTION_EXISTING_COUNT_INVALID"),
  };
}
