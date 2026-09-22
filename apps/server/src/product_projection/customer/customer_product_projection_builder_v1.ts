// GEOX FOUI Product API Wave-02 — PostgreSQL-backed Customer Product Projection builder.
//
// Purpose: compose the first real Customer Product Projection from customer-safe field identity
// and the canonical MCFT CAP-07 read model.
// Boundary: SELECT/read-only only. No legacy Customer API dependency, no DDL/DML, no risk/severity/
// recommendation inference, no command authority, and no field-level aggregation across multiple zones.

import type { Pool } from "pg";
import { semanticHashV1 } from "../../domain/twin_runtime/canonical_json_v1.js";
import type {
  FieldTwinScopeV1,
  MinimalFieldTwinRuntimeReadModelV1,
  SemanticHashTextV1,
} from "../../domain/field_twin_read_model/index.js";
import {
  McftFieldTwinReadApiErrorV1,
  type McftFieldTwinReadApiV1,
} from "../../services/mcft_field_twin_read_api_v1.js";
import { PostgresMcftFieldTwinS4ReadApiV1 } from "../../services/mcft_field_twin_s4_read_api_v1.js";
import {
  PRODUCT_PROJECTION_AUTHORITY_CEILING_V1,
  PRODUCT_PROJECTION_CONTRACT_VERSION_V1,
  type ProductProjectionAuthorityRefV1,
  type ProductProjectionLimitationV1,
  type ProductProjectionNonAuthorityRefV1,
  type ProductProjectionSourceDigestV1,
} from "../contracts/product_projection_contracts_v1.js";
import {
  PRODUCT_PROJECTION_SOURCE_BINDING_REGISTRY_VERSION_V1,
  assertProductProjectionSourceBindingsV1,
  sourceBindingRegistrationV1,
  type ProductProjectionSourceBindingProofSetV1,
  type ProductProjectionSourceRoleV1,
} from "../contracts/product_projection_source_binding_registry_v1.js";
import {
  CUSTOMER_PRODUCT_PROJECTION_DERIVATION_VERSION_V1,
  assertCustomerOverviewProjectionV1,
  assertFieldSummaryProjectionV1,
  assertFieldWorkspaceProjectionV1,
  type CustomerOverviewProjectionV1,
  type CustomerProductProjectionEnvelopeV1,
  type FieldCurrentConditionProjectionV1,
  type FieldIdentityProjectionV1,
  type FieldReportingProjectionV1,
  type FieldSummaryProjectionV1,
  type FieldWorkspaceProjectionV1,
  type RootZoneWaterConditionV1,
} from "./customer_product_projection_contracts_v1.js";

export const CUSTOMER_PRODUCT_PROJECTION_MAX_FIELDS_V1 = 100 as const;

export type CustomerProductReadScopeV1 = {
  tenant_id: string;
  project_id: string;
  group_id: string;
  allowed_field_ids: readonly string[];
  can_preview_all_fields: boolean;
};

type FieldIdentityRowV1 = {
  field_id: string;
  field_name: string | null;
  area_ha: number | null;
  updated_ts_ms: number | null;
};

type RuntimeScopeRowV1 = {
  season_id: string;
  zone_id: string;
  active_lineage_ref: string;
  updated_at: string;
};

type StateProjectionRowV1 = {
  canonical_payload: unknown;
  logical_time: string;
  determinism_hash: string;
  source_fact_id: string;
};

type ExactFieldRuntimeV1 = {
  scope: FieldTwinScopeV1;
  runtime: MinimalFieldTwinRuntimeReadModelV1;
  state: StateProjectionRowV1;
};

type FieldRuntimeResolutionV1 =
  | { status: "AVAILABLE"; value: ExactFieldRuntimeV1; reason_codes: readonly string[] }
  | { status: "LIMITED" | "UNAVAILABLE"; value: null; reason_codes: readonly string[] };

export class CustomerProductProjectionReadErrorV1 extends Error {
  constructor(
    readonly code: string,
    readonly statusCode: 400 | 403 | 404 | 409 | 503,
    detail?: string,
  ) {
    super(detail ? `${code}:${detail}` : code);
    this.name = "CustomerProductProjectionReadErrorV1";
  }
}

export type CustomerProductProjectionBuilderOptionsV1 = {
  readApi?: McftFieldTwinReadApiV1;
  now?: () => string;
};

function safeIsoNowV1(now: () => string): string {
  const raw = String(now()).trim();
  const parsed = Date.parse(raw);
  if (!Number.isFinite(parsed)) throw new CustomerProductProjectionReadErrorV1("PRODUCT_CLOCK_INVALID", 503);
  return new Date(parsed).toISOString();
}

function uniqueSortedV1(values: readonly string[]): string[] {
  return Array.from(new Set(values.map((value) => String(value ?? "").trim()).filter(Boolean))).sort();
}

function parseJsonRecordV1(value: unknown): Record<string, unknown> | null {
  if (!value) return null;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? parsed as Record<string, unknown>
        : null;
    } catch {
      return null;
    }
  }
  return typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function recordV1(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function finiteV1(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function nullableTextV1(value: unknown): string | null {
  const text = String(value ?? "").trim();
  return text || null;
}

function normalizeFieldIdV1(value: unknown): string | null {
  const fieldId = String(value ?? "").trim();
  if (!fieldId || fieldId.length > 128 || !/^[A-Za-z0-9_\-:.]+$/.test(fieldId)) return null;
  return fieldId;
}

function fieldRefKeyV1(fieldId: string, suffix: string): string {
  return `field:${fieldId}:${suffix}`;
}

function identityExactRefV1(row: FieldIdentityRowV1, tenantId: string): string {
  return `field_index_v1:${tenantId}:${row.field_id}:updated:${row.updated_ts_ms ?? "UNVERSIONED"}`;
}

function identityDigestV1(row: FieldIdentityRowV1, tenantId: string): SemanticHashTextV1 {
  return semanticHashV1({
    source: "public.field_index_v1",
    tenant_id: tenantId,
    field_id: row.field_id,
    field_name: row.field_name,
    area_ha: row.area_ha,
    updated_ts_ms: row.updated_ts_ms,
  }) as SemanticHashTextV1;
}

function projectionIdV1(input: {
  projection_type: string;
  subject_scope: Record<string, unknown>;
  source_content_digests: readonly ProductProjectionSourceDigestV1[];
}): string {
  return `product-projection:${input.projection_type.toLowerCase()}:${semanticHashV1({
    projection_type: input.projection_type,
    derivation_version: CUSTOMER_PRODUCT_PROJECTION_DERIVATION_VERSION_V1,
    subject_scope: input.subject_scope,
    source_content_digests: input.source_content_digests,
  })}`;
}

function limitationV1(reasonCode: string, sourceRefKey: string | null = null, detail: string | null = null): ProductProjectionLimitationV1 {
  return { reason_code: reasonCode, source_ref_key: sourceRefKey, detail };
}

function assertSourceRoleV1(
  proofSet: ProductProjectionSourceBindingProofSetV1,
  refKey: string,
  role: ProductProjectionSourceRoleV1,
): void {
  const proof = proofSet.proofs.find((item) => item.ref_key === refKey);
  if (!proof) throw new CustomerProductProjectionReadErrorV1("PRODUCT_SOURCE_BINDING_PROOF_REQUIRED", 409, refKey);
  const registration = sourceBindingRegistrationV1(proof.binding_id);
  if (!registration || !registration.allowed_product_roles.includes(role)) {
    throw new CustomerProductProjectionReadErrorV1("PRODUCT_SOURCE_ROLE_BINDING_FORBIDDEN", 409, `${refKey}:${role}`);
  }
}

function baseEnvelopeV1(input: {
  projection_type: "CUSTOMER_OVERVIEW" | "FIELD_SUMMARY" | "FIELD_WORKSPACE";
  generated_at: string;
  subject_scope: CustomerProductProjectionEnvelopeV1["subject_scope"];
  source_authority_refs: readonly ProductProjectionAuthorityRefV1[];
  source_non_authority_refs: readonly ProductProjectionNonAuthorityRefV1[];
  source_content_digests: readonly ProductProjectionSourceDigestV1[];
  limitations: readonly ProductProjectionLimitationV1[];
  exact_state_time?: string | null;
  exact_state_ref_key?: string | null;
}): CustomerProductProjectionEnvelopeV1 {
  const exactStateTime = input.exact_state_time ?? null;
  const exactStateRefKey = input.exact_state_ref_key ?? null;
  const envelope: CustomerProductProjectionEnvelopeV1 = {
    projection_id: "",
    projection_type: input.projection_type,
    projection_schema_version: PRODUCT_PROJECTION_CONTRACT_VERSION_V1,
    generated_at: input.generated_at,
    derivation_version: CUSTOMER_PRODUCT_PROJECTION_DERIVATION_VERSION_V1,
    subject_scope: input.subject_scope,
    source_authority_refs: input.source_authority_refs,
    source_non_authority_refs: input.source_non_authority_refs,
    source_content_digests: input.source_content_digests,
    source_effective_interval: exactStateTime && exactStateRefKey
      ? {
          mode: "SINGLE_EXACT",
          effective_from: exactStateTime,
          effective_until: exactStateTime,
          basis_ref_keys: [exactStateRefKey],
        }
      : {
          mode: "NOT_ESTABLISHED",
          effective_from: null,
          effective_until: null,
          basis_ref_keys: [],
        },
    source_evidence_cutoff: null,
    authority_ceiling: PRODUCT_PROJECTION_AUTHORITY_CEILING_V1,
    limitations: input.limitations,
    freshness: {
      status: "UNKNOWN",
      evaluated_at: input.generated_at,
      basis: "UNESTABLISHED",
      reason_codes: ["PRODUCT_TEMPORAL_FRESHNESS_POLICY_NOT_ESTABLISHED"],
    },
    projection_semantics: "CURRENT_PROJECTION",
    non_authoritative: true,
  };
  envelope.projection_id = projectionIdV1({
    projection_type: envelope.projection_type,
    subject_scope: envelope.subject_scope,
    source_content_digests: envelope.source_content_digests,
  });
  return envelope;
}

function identityProjectionV1(row: FieldIdentityRowV1): FieldIdentityProjectionV1 {
  return {
    display_name: row.field_name,
    display_name_status: row.field_name ? "AVAILABLE" : "UNAVAILABLE",
    farm_display_name: null,
    crop_display_name: null,
    crop_stage_display: null,
    season_display: null,
    area: row.area_ha,
    area_unit: row.area_ha === null ? null : "ha",
  };
}

function unavailableConditionV1(
  status: "LIMITED" | "UNAVAILABLE",
  reasonCodes: readonly string[],
): FieldCurrentConditionProjectionV1 {
  return {
    status,
    condition_kind: "ROOT_ZONE_WATER_STATE",
    effective_at: null,
    support_state: status === "LIMITED" ? "LIMITED" : "UNAVAILABLE",
    source_ref_key: null,
    root_zone_water: null,
    reason_codes: uniqueSortedV1(reasonCodes),
  };
}

function reportingFromResolutionV1(
  resolution: FieldRuntimeResolutionV1,
): FieldReportingProjectionV1 {
  if (resolution.status === "AVAILABLE") {
    return {
      state: "CURRENT",
      reason_codes: [],
      last_qualified_at: resolution.value.state.logical_time,
    };
  }
  return {
    state: resolution.status,
    reason_codes: uniqueSortedV1(resolution.reason_codes),
    last_qualified_at: null,
  };
}

function rootZoneWaterFromStateV1(payload: Record<string, unknown>): RootZoneWaterConditionV1 | null {
  const derived = recordV1(payload.derived_state);
  const storage = recordV1(derived?.root_zone_water_storage_mm);
  const unavailable = recordV1(payload.unavailable_state);
  const confidence = recordV1(payload.confidence);
  const available = finiteV1(derived?.available_water_fraction);
  const depletion = finiteV1(derived?.depletion_from_field_capacity_mm);
  const mean = finiteV1(storage?.mean);
  const stddev = finiteV1(storage?.stddev);
  const low = finiteV1(storage?.interval_low);
  const high = finiteV1(storage?.interval_high);
  const stressReason = nullableTextV1(unavailable?.water_stress_state);
  const confidenceStatus = nullableTextV1(confidence?.status);
  const confidenceReason = nullableTextV1(confidence?.reason_code);
  if (
    available === null || available < 0 || available > 1
    || depletion === null || depletion < 0
    || mean === null || mean < 0
    || stddev === null || stddev < 0
    || low === null || high === null || low > mean || mean > high
    || stressReason === null
    || confidenceStatus !== "NOT_ESTABLISHED"
    || confidenceReason === null
  ) {
    return null;
  }
  return {
    available_water_fraction: available,
    depletion_from_field_capacity_mm: depletion,
    root_zone_water_storage_mm: {
      mean,
      stddev,
      interval_low: low,
      interval_high: high,
    },
    water_stress_state: {
      status: "NOT_ESTABLISHED",
      reason_code: stressReason,
    },
    confidence: {
      status: "NOT_ESTABLISHED",
      reason_code: confidenceReason,
    },
  };
}

function mapMcftReadFailureV1(error: unknown): { status: "LIMITED" | "UNAVAILABLE"; reason_codes: string[] } {
  const code = error instanceof McftFieldTwinReadApiErrorV1
    ? error.code
    : String((error as { code?: unknown; message?: unknown })?.code
      ?? (error as { message?: unknown })?.message
      ?? "MCFT_READ_SURFACE_UNAVAILABLE").split(":", 1)[0];

  if (code === "MCFT_RUNTIME_NOT_ESTABLISHED" || code === "MCFT_EXACT_RESOURCE_NOT_FOUND") {
    return { status: "UNAVAILABLE", reason_codes: [code] };
  }
  if (/MISMATCH|DIVERGENCE|CARDINALITY|INCOMPLETE|POINTER|AUTHORITY|CANONICAL|INVALID/.test(code)) {
    return { status: "LIMITED", reason_codes: [code] };
  }
  return { status: "UNAVAILABLE", reason_codes: ["MCFT_READ_SURFACE_UNAVAILABLE"] };
}

export class PostgresCustomerProductProjectionBuilderV1 {
  private readonly readApi: McftFieldTwinReadApiV1;
  private readonly now: () => string;

  constructor(
    private readonly pool: Pool,
    options: CustomerProductProjectionBuilderOptionsV1 = {},
  ) {
    this.readApi = options.readApi ?? new PostgresMcftFieldTwinS4ReadApiV1(pool);
    this.now = options.now ?? (() => new Date().toISOString());
  }

  private async listFieldRowsV1(scope: CustomerProductReadScopeV1): Promise<FieldIdentityRowV1[]> {
    if (!scope.can_preview_all_fields && scope.allowed_field_ids.length === 0) return [];
    const params: unknown[] = [scope.tenant_id];
    let fieldPredicate = "";
    if (!scope.can_preview_all_fields) {
      params.push([...scope.allowed_field_ids]);
      fieldPredicate = " AND field_id = ANY($2::text[])";
    }
    const result = await this.pool.query(
      `SELECT field_id,
              COALESCE(field_name, name) AS field_name,
              area_ha,
              updated_ts_ms
         FROM public.field_index_v1
        WHERE tenant_id = $1${fieldPredicate}
        ORDER BY field_id ASC
        LIMIT ${CUSTOMER_PRODUCT_PROJECTION_MAX_FIELDS_V1 + 1}`,
      params,
    );
    if (result.rows.length > CUSTOMER_PRODUCT_PROJECTION_MAX_FIELDS_V1) {
      throw new CustomerProductProjectionReadErrorV1(
        "PRODUCT_SCOPE_TOO_LARGE_FOR_WAVE02",
        409,
        String(result.rows.length),
      );
    }
    return result.rows.map((row: Record<string, unknown>) => ({
      field_id: String(row.field_id ?? "").trim(),
      field_name: nullableTextV1(row.field_name),
      area_ha: Number.isFinite(Number(row.area_ha)) ? Number(row.area_ha) : null,
      updated_ts_ms: Number.isFinite(Number(row.updated_ts_ms)) ? Number(row.updated_ts_ms) : null,
    })).filter((row: FieldIdentityRowV1) => Boolean(row.field_id));
  }

  private async oneFieldRowV1(
    scope: CustomerProductReadScopeV1,
    fieldId: string,
  ): Promise<FieldIdentityRowV1 | null> {
    if (!scope.can_preview_all_fields && !scope.allowed_field_ids.includes(fieldId)) return null;
    const result = await this.pool.query(
      `SELECT field_id,
              COALESCE(field_name, name) AS field_name,
              area_ha,
              updated_ts_ms
         FROM public.field_index_v1
        WHERE tenant_id = $1
          AND field_id = $2
        LIMIT 2`,
      [scope.tenant_id, fieldId],
    );
    if (result.rows.length > 1) {
      throw new CustomerProductProjectionReadErrorV1("FIELD_IDENTITY_CARDINALITY_INVALID", 409, fieldId);
    }
    if (!result.rows[0]) return null;
    const row = result.rows[0] as Record<string, unknown>;
    return {
      field_id: String(row.field_id ?? "").trim(),
      field_name: nullableTextV1(row.field_name),
      area_ha: Number.isFinite(Number(row.area_ha)) ? Number(row.area_ha) : null,
      updated_ts_ms: Number.isFinite(Number(row.updated_ts_ms)) ? Number(row.updated_ts_ms) : null,
    };
  }

  private async runtimeScopeForFieldV1(
    scope: CustomerProductReadScopeV1,
    fieldId: string,
  ): Promise<
    | { status: "EXACT"; scope: FieldTwinScopeV1 }
    | { status: "NONE"; scope: null; reason_codes: readonly string[] }
    | { status: "AMBIGUOUS"; scope: null; reason_codes: readonly string[] }
  > {
    const result = await this.pool.query<RuntimeScopeRowV1>(
      `SELECT season_id, zone_id, active_lineage_ref, updated_at
         FROM public.twin_active_lineage_index_v1
        WHERE tenant_id = $1
          AND project_id = $2
          AND group_id = $3
          AND field_id = $4
        ORDER BY season_id ASC, zone_id ASC
        LIMIT 3`,
      [scope.tenant_id, scope.project_id, scope.group_id, fieldId],
    );
    if (result.rows.length === 0) {
      return {
        status: "NONE",
        scope: null,
        reason_codes: ["MCFT_CURRENT_RUNTIME_NOT_ESTABLISHED"],
      };
    }
    if (result.rows.length !== 1) {
      return {
        status: "AMBIGUOUS",
        scope: null,
        reason_codes: ["FIELD_LEVEL_RUNTIME_SCOPE_AMBIGUOUS_NO_AGGREGATION_AUTHORITY"],
      };
    }
    const row = result.rows[0];
    return {
      status: "EXACT",
      scope: {
        tenant_id: scope.tenant_id,
        project_id: scope.project_id,
        group_id: scope.group_id,
        field_id: fieldId,
        season_id: String(row.season_id),
        zone_id: String(row.zone_id),
      },
    };
  }

  private async exactStateProjectionRowV1(
    exactScope: FieldTwinScopeV1,
    runtime: MinimalFieldTwinRuntimeReadModelV1,
  ): Promise<StateProjectionRowV1> {
    const stateRef = runtime.posterior_state;
    if (!stateRef) {
      throw new CustomerProductProjectionReadErrorV1("MCFT_CURRENT_STATE_REF_MISSING", 409);
    }
    const result = await this.pool.query<StateProjectionRowV1>(
      `SELECT canonical_payload, logical_time, determinism_hash, source_fact_id
         FROM public.twin_state_history_projection_v1
        WHERE tenant_id = $1
          AND project_id = $2
          AND group_id = $3
          AND field_id = $4
          AND season_id = $5
          AND zone_id = $6
          AND state_object_id = $7
        LIMIT 2`,
      [
        exactScope.tenant_id,
        exactScope.project_id,
        exactScope.group_id,
        exactScope.field_id,
        exactScope.season_id,
        exactScope.zone_id,
        stateRef.object_ref,
      ],
    );
    if (result.rows.length !== 1) {
      throw new CustomerProductProjectionReadErrorV1(
        "MCFT_CURRENT_STATE_PROJECTION_CARDINALITY_INVALID",
        409,
        stateRef.object_ref,
      );
    }
    const row = result.rows[0];
    if (
      String(row.determinism_hash) !== stateRef.object_hash
      || String(row.source_fact_id) !== String(stateRef.source_fact_ref ?? "")
    ) {
      throw new CustomerProductProjectionReadErrorV1(
        "MCFT_CURRENT_STATE_PROJECTION_EXACT_REF_MISMATCH",
        409,
        stateRef.object_ref,
      );
    }
    const logicalTime = new Date(String(row.logical_time)).toISOString();
    return {
      canonical_payload: row.canonical_payload,
      logical_time: logicalTime,
      determinism_hash: String(row.determinism_hash),
      source_fact_id: String(row.source_fact_id),
    };
  }

  private async resolveRuntimeV1(
    scope: CustomerProductReadScopeV1,
    fieldId: string,
  ): Promise<FieldRuntimeResolutionV1> {
    const runtimeScope = await this.runtimeScopeForFieldV1(scope, fieldId);
    if (runtimeScope.status === "NONE") {
      return { status: "UNAVAILABLE", value: null, reason_codes: runtimeScope.reason_codes };
    }
    if (runtimeScope.status === "AMBIGUOUS") {
      return { status: "LIMITED", value: null, reason_codes: runtimeScope.reason_codes };
    }
    try {
      const body = await this.readApi.readRuntime({ scope: runtimeScope.scope });
      const runtime = body as unknown as MinimalFieldTwinRuntimeReadModelV1;
      if (
        runtime.schema_version !== "minimal_field_twin_runtime_read_model_v1"
        || runtime.root_graph_status !== "COMPLETE_EXACT_GRAPH"
        || !runtime.posterior_state
        || !runtime.active_lineage
      ) {
        return {
          status: "LIMITED",
          value: null,
          reason_codes: ["MCFT_CURRENT_RUNTIME_EXACT_GRAPH_UNAVAILABLE"],
        };
      }
      const state = await this.exactStateProjectionRowV1(runtimeScope.scope, runtime);
      if (!rootZoneWaterFromStateV1(parseJsonRecordV1(state.canonical_payload) ?? {})) {
        return {
          status: "LIMITED",
          value: null,
          reason_codes: ["MCFT_CURRENT_STATE_CUSTOMER_PROJECTION_FIELDS_UNAVAILABLE"],
        };
      }
      return {
        status: "AVAILABLE",
        value: { scope: runtimeScope.scope, runtime, state },
        reason_codes: [],
      };
    } catch (error) {
      const mapped = mapMcftReadFailureV1(error);
      return { status: mapped.status, value: null, reason_codes: mapped.reason_codes };
    }
  }

  private buildFieldSummaryFromResolvedV1(input: {
    scope: CustomerProductReadScopeV1;
    row: FieldIdentityRowV1;
    resolution: FieldRuntimeResolutionV1;
    generated_at: string;
  }): FieldSummaryProjectionV1 {
    const identityRefKey = fieldRefKeyV1(input.row.field_id, "identity");
    const nonAuthorityRefs: ProductProjectionNonAuthorityRefV1[] = [{
      ref_key: identityRefKey,
      ref_class: "OTHER_NON_AUTHORITY",
      object_kind: "field_index_v1",
      exact_ref: identityExactRefV1(input.row, input.scope.tenant_id),
      source_fact_ref: null,
    }];
    const authorityRefs: ProductProjectionAuthorityRefV1[] = [];
    const digests: ProductProjectionSourceDigestV1[] = [{
      source_ref_key: identityRefKey,
      digest: identityDigestV1(input.row, input.scope.tenant_id),
      digest_kind: "PRODUCT_SOURCE_ROW_DIGEST",
    }];
    const proofs: ProductProjectionSourceBindingProofSetV1["proofs"][number][] = [{
      ref_key: identityRefKey,
      binding_id: "GEOX_FIELD_INDEX_V1",
      observed_object_kind: "field_index_v1",
      source_path: "public.field_index_v1",
    }];
    const limitationCodes = new Set<string>([
      "FIELD_FARM_DISPLAY_NOT_PROJECTED_WAVE02",
      "FIELD_CROP_DISPLAY_NOT_PROJECTED_WAVE02",
      "FIELD_CROP_STAGE_NOT_PROJECTED_WAVE02",
      "FIELD_SEASON_DISPLAY_NOT_PROJECTED_WAVE02",
      "FIELD_GEOMETRY_NOT_PROJECTED_WAVE02",
      "ATTENTION_QUEUE_BUILDER_NOT_IMPLEMENTED",
      "OPERATION_PROJECTION_NOT_IMPLEMENTED",
    ]);
    if (!input.row.field_name) limitationCodes.add("FIELD_DISPLAY_NAME_UNAVAILABLE");

    let currentCondition: FieldCurrentConditionProjectionV1;
    let exactStateTime: string | null = null;
    let exactStateRefKey: string | null = null;
    let subjectSeasonId: string | null = null;
    let subjectZoneId: string | null = null;

    if (input.resolution.status === "AVAILABLE") {
      const { runtime, state, scope } = input.resolution.value;
      const stateRef = runtime.posterior_state!;
      const lineageRef = runtime.active_lineage!;
      const stateRefKey = fieldRefKeyV1(input.row.field_id, "mcft-current-state");
      const lineageRefKey = fieldRefKeyV1(input.row.field_id, "mcft-active-lineage");
      authorityRefs.push(
        {
          ref_key: stateRefKey,
          authority_domain: "MCFT",
          authority_object_kind: stateRef.object_type,
          exact_ref: stateRef.object_ref,
          source_fact_ref: stateRef.source_fact_ref,
        },
        {
          ref_key: lineageRefKey,
          authority_domain: "MCFT",
          authority_object_kind: lineageRef.object_type,
          exact_ref: lineageRef.object_ref,
          source_fact_ref: lineageRef.source_fact_ref,
        },
      );
      digests.push(
        { source_ref_key: stateRefKey, digest: stateRef.object_hash, digest_kind: "MCFT_DETERMINISM_HASH" },
        { source_ref_key: lineageRefKey, digest: lineageRef.object_hash, digest_kind: "MCFT_DETERMINISM_HASH" },
      );
      proofs.push(
        {
          ref_key: stateRefKey,
          binding_id: "MCFT_RUNTIME_POSTERIOR_STATE_V1",
          observed_object_kind: stateRef.object_type,
          source_path: "posterior_state",
        },
        {
          ref_key: lineageRefKey,
          binding_id: "MCFT_RUNTIME_ACTIVE_LINEAGE_V1",
          observed_object_kind: lineageRef.object_type,
          source_path: "active_lineage",
        },
      );
      const water = rootZoneWaterFromStateV1(parseJsonRecordV1(state.canonical_payload) ?? {});
      if (!water) {
        throw new CustomerProductProjectionReadErrorV1("MCFT_CURRENT_STATE_CUSTOMER_PROJECTION_FIELDS_UNAVAILABLE", 409);
      }
      currentCondition = {
        status: "AVAILABLE",
        condition_kind: "ROOT_ZONE_WATER_STATE",
        effective_at: state.logical_time,
        support_state: "SUPPORTED",
        source_ref_key: stateRefKey,
        root_zone_water: water,
        reason_codes: [],
      };
      limitationCodes.add("MCFT_WATER_STRESS_NOT_ESTABLISHED");
      limitationCodes.add("MCFT_CONFIDENCE_NOT_ESTABLISHED");
      exactStateTime = state.logical_time;
      exactStateRefKey = stateRefKey;
      subjectSeasonId = scope.season_id;
      subjectZoneId = scope.zone_id;
    } else {
      currentCondition = unavailableConditionV1(input.resolution.status, input.resolution.reason_codes);
      input.resolution.reason_codes.forEach((reason) => limitationCodes.add(reason));
    }

    const envelopeLimitations = uniqueSortedV1([...limitationCodes]).map((reason) => limitationV1(reason));
    const envelope = baseEnvelopeV1({
      projection_type: "FIELD_SUMMARY",
      generated_at: input.generated_at,
      subject_scope: {
        tenant_id: input.scope.tenant_id,
        project_id: input.scope.project_id,
        group_id: input.scope.group_id,
        field_id: input.row.field_id,
        season_id: subjectSeasonId,
        zone_id: subjectZoneId,
      },
      source_authority_refs: authorityRefs,
      source_non_authority_refs: nonAuthorityRefs,
      source_content_digests: digests,
      limitations: envelopeLimitations,
      exact_state_time: exactStateTime,
      exact_state_ref_key: exactStateRefKey,
    });

    const proofSet: ProductProjectionSourceBindingProofSetV1 = {
      registry_version: PRODUCT_PROJECTION_SOURCE_BINDING_REGISTRY_VERSION_V1,
      proofs,
      non_authoritative: true,
    };
    assertProductProjectionSourceBindingsV1(envelope, proofSet);
    assertSourceRoleV1(proofSet, identityRefKey, "FIELD_IDENTITY");
    if (exactStateRefKey) {
      assertSourceRoleV1(proofSet, exactStateRefKey, "FIELD_CURRENT_STATE");
      assertSourceRoleV1(
        proofSet,
        fieldRefKeyV1(input.row.field_id, "mcft-active-lineage"),
        "FIELD_CURRENT_RUNTIME_LINEAGE",
      );
    }

    const projection: FieldSummaryProjectionV1 = {
      envelope: envelope as FieldSummaryProjectionV1["envelope"],
      field_ref: input.row.field_id,
      identity: identityProjectionV1(input.row),
      current_condition: currentCondition,
      reporting_state: reportingFromResolutionV1(input.resolution),
      attention: {
        status: "UNAVAILABLE",
        has_attention: null,
        attention_item_refs: [],
        reason_codes: ["ATTENTION_QUEUE_BUILDER_NOT_IMPLEMENTED"],
      },
      recent_operation: null,
      geometry_availability: "UNAVAILABLE",
      capability_refs: [],
      limitation_reason_codes: uniqueSortedV1([...limitationCodes]),
    };
    assertFieldSummaryProjectionV1(projection);
    return projection;
  }

  async buildFieldSummariesV1(scope: CustomerProductReadScopeV1): Promise<FieldSummaryProjectionV1[]> {
    const generatedAt = safeIsoNowV1(this.now);
    const rows = await this.listFieldRowsV1(scope);
    const out: FieldSummaryProjectionV1[] = [];
    for (const row of rows) {
      const resolution = await this.resolveRuntimeV1(scope, row.field_id);
      out.push(this.buildFieldSummaryFromResolvedV1({ scope, row, resolution, generated_at: generatedAt }));
    }
    return out;
  }

  async buildFieldSummaryV1(
    scope: CustomerProductReadScopeV1,
    fieldRef: string,
  ): Promise<FieldSummaryProjectionV1> {
    const fieldId = normalizeFieldIdV1(fieldRef);
    if (!fieldId) throw new CustomerProductProjectionReadErrorV1("PRODUCT_FIELD_NOT_FOUND", 404);
    const row = await this.oneFieldRowV1(scope, fieldId);
    if (!row) throw new CustomerProductProjectionReadErrorV1("PRODUCT_FIELD_NOT_FOUND", 404);
    const resolution = await this.resolveRuntimeV1(scope, fieldId);
    return this.buildFieldSummaryFromResolvedV1({
      scope,
      row,
      resolution,
      generated_at: safeIsoNowV1(this.now),
    });
  }

  async buildFieldWorkspaceV1(
    scope: CustomerProductReadScopeV1,
    fieldRef: string,
  ): Promise<FieldWorkspaceProjectionV1> {
    const summary = await this.buildFieldSummaryV1(scope, fieldRef);
    const limitationCodes = uniqueSortedV1([
      ...summary.limitation_reason_codes,
      "RECENT_CHANGES_BUILDER_NOT_IMPLEMENTED",
      "ACTION_CASE_BUILDER_NOT_IMPLEMENTED",
      "OPERATION_PROJECTION_NOT_IMPLEMENTED",
      "EXECUTION_EVIDENCE_PROJECTION_NOT_IMPLEMENTED",
      "OUTCOME_PROJECTION_NOT_IMPLEMENTED",
      "CAPABILITY_PROJECTION_NOT_BOUND_WAVE02",
      "HISTORY_PROJECTION_NOT_IMPLEMENTED",
    ]);
    const envelope: FieldWorkspaceProjectionV1["envelope"] = {
      ...summary.envelope,
      projection_id: "",
      projection_type: "FIELD_WORKSPACE",
      limitations: limitationCodes.map((reason) => limitationV1(reason)),
    };
    envelope.projection_id = projectionIdV1({
      projection_type: envelope.projection_type,
      subject_scope: envelope.subject_scope,
      source_content_digests: envelope.source_content_digests,
    });

    const projection: FieldWorkspaceProjectionV1 = {
      envelope,
      field_ref: summary.field_ref,
      identity: summary.identity,
      current_condition: summary.current_condition,
      reporting_state: summary.reporting_state,
      recent_changes: {
        status: "UNAVAILABLE",
        items: [],
        reason_codes: ["RECENT_CHANGES_BUILDER_NOT_IMPLEMENTED"],
      },
      open_action_cases: {
        status: "UNAVAILABLE",
        items: [],
        reason_codes: ["ACTION_CASE_BUILDER_NOT_IMPLEMENTED"],
      },
      recent_operations: {
        status: "UNAVAILABLE",
        items: [],
        reason_codes: ["OPERATION_PROJECTION_NOT_IMPLEMENTED"],
      },
      evidence_summary: {
        field_condition: {
          status: summary.current_condition.status === "AVAILABLE" ? "LIMITED" : "UNAVAILABLE",
          artifact_count: null,
          reason_codes: ["FIELD_EVIDENCE_ARTIFACT_SUMMARY_NOT_PROJECTED_WAVE02"],
        },
        execution_evidence: {
          status: "UNAVAILABLE",
          artifact_count: null,
          reason_codes: ["EXECUTION_EVIDENCE_PROJECTION_NOT_IMPLEMENTED"],
        },
      },
      observed_outcomes: {
        status: "UNAVAILABLE",
        items: [],
        reason_codes: ["OUTCOME_PROJECTION_NOT_IMPLEMENTED"],
      },
      capability_availability: {
        status: "UNAVAILABLE",
        items: [],
        reason_codes: ["CAPABILITY_PROJECTION_NOT_BOUND_WAVE02"],
      },
      history_summary: {
        status: "UNAVAILABLE",
        latest_event_at: null,
        reason_codes: ["HISTORY_PROJECTION_NOT_IMPLEMENTED"],
      },
      limitation_reason_codes: limitationCodes,
      provenance_summary: {
        source_authority_count: envelope.source_authority_refs.length,
        source_non_authority_count: envelope.source_non_authority_refs.length,
      },
    };
    assertFieldWorkspaceProjectionV1(projection);
    return projection;
  }

  async buildCustomerOverviewV1(
    scope: CustomerProductReadScopeV1,
  ): Promise<CustomerOverviewProjectionV1> {
    const fieldPreviews = await this.buildFieldSummariesV1(scope);
    const generatedAt = fieldPreviews[0]?.envelope.generated_at ?? safeIsoNowV1(this.now);
    const authorityRefs = fieldPreviews.flatMap((item) => item.envelope.source_authority_refs);
    const nonAuthorityRefs = fieldPreviews.flatMap((item) => item.envelope.source_non_authority_refs);
    const digests = fieldPreviews.flatMap((item) => item.envelope.source_content_digests);

    const current = fieldPreviews.filter((item) => item.reporting_state.state === "CURRENT").length;
    const limited = fieldPreviews.filter((item) => item.reporting_state.state === "LIMITED").length;
    const unavailable = fieldPreviews.filter((item) => item.reporting_state.state === "UNAVAILABLE").length;
    const limitationCodes = uniqueSortedV1([
      ...fieldPreviews.flatMap((item) => item.limitation_reason_codes),
      "ATTENTION_QUEUE_BUILDER_NOT_IMPLEMENTED",
      "OPERATION_PROJECTION_NOT_IMPLEMENTED",
      "REPORT_PROJECTION_NOT_IMPLEMENTED",
    ]);

    const envelope = baseEnvelopeV1({
      projection_type: "CUSTOMER_OVERVIEW",
      generated_at: generatedAt,
      subject_scope: {
        tenant_id: scope.tenant_id,
        project_id: scope.project_id,
        group_id: scope.group_id,
        field_id: null,
        season_id: null,
        zone_id: null,
      },
      source_authority_refs: authorityRefs,
      source_non_authority_refs: nonAuthorityRefs,
      source_content_digests: digests,
      limitations: limitationCodes.map((reason) => limitationV1(reason)),
    }) as CustomerOverviewProjectionV1["envelope"];

    const projection: CustomerOverviewProjectionV1 = {
      envelope,
      reporting_summary: {
        total_fields: fieldPreviews.length,
        current_fields: current,
        limited_fields: limited,
        unavailable_fields: unavailable,
      },
      attention_items: {
        status: "UNAVAILABLE",
        items: [],
        reason_codes: ["ATTENTION_QUEUE_BUILDER_NOT_IMPLEMENTED"],
      },
      field_previews: fieldPreviews,
      recent_operations: {
        status: "UNAVAILABLE",
        items: [],
        reason_codes: ["OPERATION_PROJECTION_NOT_IMPLEMENTED"],
      },
      latest_reports: {
        status: "UNAVAILABLE",
        items: [],
        reason_codes: ["REPORT_PROJECTION_NOT_IMPLEMENTED"],
      },
      limitation_reason_codes: limitationCodes,
    };
    assertCustomerOverviewProjectionV1(projection);
    return projection;
  }
}
