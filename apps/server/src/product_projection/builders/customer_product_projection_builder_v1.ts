// Canonical builders for the first real Customer Product Projection slice.
// Boundary: non-authoritative composition only. The builder never writes, recalculates MCFT state,
// invents business authority semantics, or upgrades missing data into business truth.

import { createHash } from "node:crypto";
import type { Pool } from "pg";

import {
  PRODUCT_PROJECTION_AUTHORITY_CEILING_V1,
  PRODUCT_PROJECTION_CONTRACT_VERSION_V1,
  type ProductProjectionAuthorityRefV1,
  type ProductProjectionEnvelopeV1,
  type ProductProjectionLimitationV1,
  type ProductProjectionNonAuthorityRefV1,
  type ProductProjectionSourceDigestV1,
} from "../contracts/product_projection_contracts_v1.js";
import {
  CUSTOMER_PRODUCT_PROJECTION_DERIVATION_VERSION_V1,
  assertCustomerOverviewProjectionV1,
  assertFieldSummaryProjectionV1,
  assertFieldWorkspaceProjectionV1,
  type CustomerOverviewProjectionV1,
  type FieldConditionMetricsV1,
  type FieldCurrentConditionProjectionV1,
  type FieldReportingStateProjectionV1,
  type FieldSummaryProjectionV1,
  type FieldWorkspaceProjectionV1,
} from "../contracts/customer_product_projection_contracts_v1.js";
import {
  PRODUCT_PROJECTION_SOURCE_BINDING_REGISTRY_VERSION_V1,
  assertCustomerFieldProjectionSourceBindingsV1,
  assertProductProjectionSourceBindingsV1,
  type ProductProjectionSourceBindingProofSetV1,
  type ProductProjectionSourceBindingProofV1,
} from "../contracts/product_projection_source_binding_registry_v1.js";
import {
  PostgresCustomerProductProjectionReaderV1,
  type CurrentMcftStateReadV1,
  type ProductCustomerReadScopeV1,
  type ProductFieldIdentitySourceV1,
  type ProductFieldSeasonSourceV1
} from "../readers/postgres_customer_product_projection_reader_v1.js";

type FieldBuildInternalV1 = {
  projection: FieldSummaryProjectionV1;
  proofs: ProductProjectionSourceBindingProofSetV1;
  refs: {
    field_identity_ref_key: string;
    field_season_ref_key: string | null;
    current_state_ref_key: string | null;
  };
};

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => [key, stableValue(item)]),
    );
  }
  return value;
}

function stableJson(value: unknown): string {
  return JSON.stringify(stableValue(value));
}

function sha256(value: unknown): string {
  return `sha256:${createHash("sha256").update(stableJson(value)).digest("hex")}`;
}

function finiteNumberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const numberValue = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function nestedRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function currentStateMetrics(state: CurrentMcftStateReadV1): FieldConditionMetricsV1 {
  if (state.status !== "AVAILABLE") {
    return {
      root_zone_storage_mm_mean: null,
      root_zone_vwc_fraction_mean: null,
      available_water_fraction: null,
      depletion_from_field_capacity_mm: null,
      confidence_status: null,
    };
  }
  const storage = nestedRecord(state.payload.root_zone_storage_mm);
  const vwc = nestedRecord(state.payload.root_zone_vwc_fraction);
  const confidence = nestedRecord(state.payload.confidence);
  return {
    root_zone_storage_mm_mean: finiteNumberOrNull(storage?.mean),
    root_zone_vwc_fraction_mean: finiteNumberOrNull(vwc?.mean),
    available_water_fraction: finiteNumberOrNull(state.payload.available_water_fraction),
    depletion_from_field_capacity_mm: finiteNumberOrNull(state.payload.depletion_from_field_capacity_mm),
    confidence_status: confidence ? String(confidence.status ?? "").trim() || null : null,
  };
}

function limitation(reasonCode: string, sourceRefKey: string | null = null, detail: string | null = null): ProductProjectionLimitationV1 {
  return { reason_code: reasonCode, source_ref_key: sourceRefKey, detail };
}

function exactActiveSeason(
  fieldId: string,
  seasons: readonly ProductFieldSeasonSourceV1[],
): { status: "EXACT"; value: ProductFieldSeasonSourceV1 } | { status: "NONE" | "MULTIPLE"; value: null } {
  const matches = seasons.filter((row) => row.field_id === fieldId);
  if (matches.length === 1) return { status: "EXACT", value: matches[0] };
  return { status: matches.length === 0 ? "NONE" : "MULTIPLE", value: null };
}

function sourceRefKey(prefix: string, ...parts: string[]): string {
  return [prefix, ...parts].join(":");
}

function uniqueByRefKey<T extends { ref_key: string }>(rows: readonly T[]): T[] {
  const result = new Map<string, T>();
  for (const row of rows) {
    const previous = result.get(row.ref_key);
    if (previous && stableJson(previous) !== stableJson(row)) {
      throw new Error(`PRODUCT_PROJECTION_SOURCE_REF_COLLISION:${row.ref_key}`);
    }
    result.set(row.ref_key, row);
  }
  return [...result.values()].sort((a, b) => a.ref_key.localeCompare(b.ref_key));
}

function uniqueDigests(rows: readonly ProductProjectionSourceDigestV1[]): ProductProjectionSourceDigestV1[] {
  const result = new Map<string, ProductProjectionSourceDigestV1>();
  for (const row of rows) {
    const key = `${row.source_ref_key}:${row.digest_kind}`;
    const previous = result.get(key);
    if (previous && previous.digest !== row.digest) throw new Error(`PRODUCT_PROJECTION_SOURCE_DIGEST_COLLISION:${key}`);
    result.set(key, row);
  }
  return [...result.values()].sort((a, b) => a.source_ref_key.localeCompare(b.source_ref_key) || a.digest_kind.localeCompare(b.digest_kind));
}

function uniqueProofs(rows: readonly ProductProjectionSourceBindingProofV1[]): ProductProjectionSourceBindingProofV1[] {
  const result = new Map<string, ProductProjectionSourceBindingProofV1>();
  for (const row of rows) {
    const previous = result.get(row.ref_key);
    if (previous && stableJson(previous) !== stableJson(row)) throw new Error(`PRODUCT_PROJECTION_SOURCE_PROOF_COLLISION:${row.ref_key}`);
    result.set(row.ref_key, row);
  }
  return [...result.values()].sort((a, b) => a.ref_key.localeCompare(b.ref_key));
}

function envelopeV1(input: {
  projection_type: "FIELD_SUMMARY" | "FIELD_WORKSPACE" | "CUSTOMER_OVERVIEW";
  projection_id: string;
  generated_at: string;
  scope: ProductCustomerReadScopeV1;
  field_id: string | null;
  season_id: string | null;
  zone_id: string | null;
  authority_refs: readonly ProductProjectionAuthorityRefV1[];
  non_authority_refs: readonly ProductProjectionNonAuthorityRefV1[];
  digests: readonly ProductProjectionSourceDigestV1[];
  limitations: readonly ProductProjectionLimitationV1[];
  current_state_ref_key: string | null;
  current_state_time: string | null;
}): ProductProjectionEnvelopeV1 {
  return {
    projection_id: input.projection_id,
    projection_type: input.projection_type,
    projection_schema_version: PRODUCT_PROJECTION_CONTRACT_VERSION_V1,
    generated_at: input.generated_at,
    derivation_version: CUSTOMER_PRODUCT_PROJECTION_DERIVATION_VERSION_V1,
    subject_scope: {
      tenant_id: input.scope.tenant_id,
      project_id: input.scope.project_id,
      group_id: input.scope.group_id,
      field_id: input.field_id,
      season_id: input.season_id,
      zone_id: input.zone_id,
    },
    source_authority_refs: [...input.authority_refs],
    source_non_authority_refs: [...input.non_authority_refs],
    source_content_digests: [...input.digests],
    source_effective_interval: input.current_state_ref_key && input.current_state_time
      ? {
          mode: "SINGLE_EXACT",
          effective_from: input.current_state_time,
          effective_until: input.current_state_time,
          basis_ref_keys: [input.current_state_ref_key],
        }
      : {
          mode: "NOT_ESTABLISHED",
          effective_from: null,
          effective_until: null,
          basis_ref_keys: [],
        },
    source_evidence_cutoff: null,
    authority_ceiling: PRODUCT_PROJECTION_AUTHORITY_CEILING_V1,
    limitations: [...input.limitations],
    freshness: {
      status: "UNKNOWN",
      evaluated_at: input.generated_at,
      basis: "UNESTABLISHED",
      reason_codes: ["SOURCE_VALIDITY_HORIZON_NOT_DECLARED"],
    },
    projection_semantics: "CURRENT_PROJECTION",
    non_authoritative: true,
  };
}

function projectionId(type: string, payload: unknown): string {
  return `${type.toLowerCase()}:${sha256(payload).slice("sha256:".length, "sha256:".length + 24)}`;
}

export class CustomerProductProjectionBuilderV1 {
  private readonly reader: PostgresCustomerProductProjectionReaderV1;

  constructor(pool: Pool) {
    this.reader = new PostgresCustomerProductProjectionReaderV1(pool);
  }

  private async buildFieldInternals(
    scope: ProductCustomerReadScopeV1,
    generatedAt: string,
  ): Promise<readonly FieldBuildInternalV1[]> {
    const [fields, seasonRead, runtimeScopeRead] = await Promise.all([
      this.reader.readFieldIdentities(scope),
      this.reader.readActiveSeasons(scope),
      this.reader.readRuntimeScopes(scope),
    ]);

    const out: FieldBuildInternalV1[] = [];

    for (const field of fields) {
      const limitations: ProductProjectionLimitationV1[] = [];
      const authorityRefs: ProductProjectionAuthorityRefV1[] = [];
      const nonAuthorityRefs: ProductProjectionNonAuthorityRefV1[] = [];
      const digests: ProductProjectionSourceDigestV1[] = [];
      const proofs: ProductProjectionSourceBindingProofV1[] = [];

      const identityRefKey = sourceRefKey("field_identity", field.field_id);
      nonAuthorityRefs.push({
        ref_key: identityRefKey,
        ref_class: "OTHER_NON_AUTHORITY",
        object_kind: "field_index_v1",
        exact_ref: `field_index_v1:${scope.tenant_id}:${field.field_id}`,
        source_fact_ref: null,
      });
      digests.push({
        source_ref_key: identityRefKey,
        digest: sha256(field.source_row),
        digest_kind: "SHA256_STABLE_JSON",
      });
      proofs.push({
        ref_key: identityRefKey,
        binding_id: "GEOX_FIELD_INDEX_IDENTITY_V1",
        observed_object_kind: "field_index_v1",
        source_path: "public.field_index_v1",
      });

      if (!field.display_name) limitations.push(limitation("FIELD_DISPLAY_NAME_UNAVAILABLE", identityRefKey));
      limitations.push(limitation("FIELD_CROP_STAGE_NOT_PROJECTED_IN_FIRST_SLICE"));
      limitations.push(limitation("FIELD_ATTENTION_NOT_PROJECTED_IN_FIRST_SLICE"));
      limitations.push(limitation("FIELD_RECENT_OPERATION_NOT_PROJECTED_IN_FIRST_SLICE"));
      limitations.push(limitation("FIELD_GEOMETRY_NOT_PROJECTED_IN_FIRST_SLICE"));

      const season = exactActiveSeason(field.field_id, seasonRead.rows);
      let seasonRefKey: string | null = null;
      if (seasonRead.relation_status === "UNAVAILABLE") {
        limitations.push(limitation("FIELD_SEASON_SOURCE_UNAVAILABLE"));
      } else if (season.status === "NONE") {
        limitations.push(limitation("ACTIVE_FIELD_SEASON_NOT_ESTABLISHED"));
      } else if (season.status === "MULTIPLE") {
        limitations.push(limitation("MULTIPLE_ACTIVE_FIELD_SEASONS"));
      } else {
        seasonRefKey = sourceRefKey("field_season", field.field_id, season.value.season_id);
        nonAuthorityRefs.push({
          ref_key: seasonRefKey,
          ref_class: "OTHER_NON_AUTHORITY",
          object_kind: "field_season_index_v1",
          exact_ref: `field_season_index_v1:${scope.tenant_id}:${field.field_id}:${season.value.season_id}`,
          source_fact_ref: null,
        });
        digests.push({
          source_ref_key: seasonRefKey,
          digest: sha256(season.value.source_row),
          digest_kind: "SHA256_STABLE_JSON",
        });
        proofs.push({
          ref_key: seasonRefKey,
          binding_id: "GEOX_FIELD_SEASON_INDEX_V1",
          observed_object_kind: "field_season_index_v1",
          source_path: "public.field_season_index_v1",
        });
      }

      let state: CurrentMcftStateReadV1 = { status: "UNAVAILABLE", reason_code: "MCFT_RUNTIME_READ_UNAVAILABLE" };
      let currentStateRefKey: string | null = null;
      let reporting: FieldReportingStateProjectionV1;

      if (runtimeScopeRead.relation_status === "UNAVAILABLE") {
        limitations.push(limitation("MCFT_RUNTIME_SCOPE_SOURCE_UNAVAILABLE"));
        reporting = { state: "UNAVAILABLE", reason_codes: ["MCFT_RUNTIME_SCOPE_SOURCE_UNAVAILABLE"], last_qualified_at: null };
      } else {
        // A field-level current condition may use MCFT only when the authenticated field maps to
        // exactly one current Runtime scope across the whole project/group. A non-authoritative
        // season index is never allowed to select one MCFT authority object out of multiple scopes.
        const runtimeCandidates = runtimeScopeRead.rows.filter((row) => row.field_id === field.field_id);
        if (runtimeCandidates.length === 0) {
          limitations.push(limitation("MCFT_RUNTIME_SCOPE_NOT_ESTABLISHED"));
          reporting = { state: "UNAVAILABLE", reason_codes: ["MCFT_RUNTIME_SCOPE_NOT_ESTABLISHED"], last_qualified_at: null };
        } else if (runtimeCandidates.length !== 1) {
          limitations.push(limitation("MULTIPLE_RUNTIME_SCOPES_NO_FIELD_AGGREGATION"));
          reporting = { state: "LIMITED", reason_codes: ["MULTIPLE_RUNTIME_SCOPES_NO_FIELD_AGGREGATION"], last_qualified_at: null };
        } else {
          const runtimeScope = runtimeCandidates[0];
          state = await this.reader.readExactCurrentMcftState(runtimeScope);
          if (state.status === "AVAILABLE") {
            currentStateRefKey = sourceRefKey("mcft_state", field.field_id);
            authorityRefs.push({
              ref_key: currentStateRefKey,
              authority_domain: "MCFT",
              authority_object_kind: state.object_type,
              exact_ref: state.object_ref,
              source_fact_ref: state.source_fact_ref,
            });
            digests.push({
              source_ref_key: currentStateRefKey,
              digest: state.object_hash,
              digest_kind: "CANONICAL_DETERMINISM_HASH",
            });
            proofs.push({
              ref_key: currentStateRefKey,
              binding_id: "MCFT_RUNTIME_POSTERIOR_STATE_V1",
              observed_object_kind: state.object_type,
              source_path: "posterior_state",
            });

            let reportingReason = "EXACT_CURRENT_MCFT_RUNTIME_ESTABLISHED";
            let reportingState: FieldReportingStateProjectionV1["state"] = "CURRENT";
            if (seasonRead.relation_status === "UNAVAILABLE") {
              reportingState = "LIMITED";
              reportingReason = "FIELD_SEASON_SOURCE_UNAVAILABLE";
            } else if (season.status === "NONE") {
              reportingState = "LIMITED";
              reportingReason = "ACTIVE_FIELD_SEASON_NOT_ESTABLISHED";
            } else if (season.status === "MULTIPLE") {
              reportingState = "LIMITED";
              reportingReason = "MULTIPLE_ACTIVE_FIELD_SEASONS";
            } else if (season.value.season_id !== runtimeScope.season_id) {
              reportingState = "LIMITED";
              reportingReason = "ACTIVE_SEASON_RUNTIME_SCOPE_MISMATCH";
              limitations.push(limitation("ACTIVE_SEASON_RUNTIME_SCOPE_MISMATCH", seasonRefKey));
            }

            reporting = {
              state: reportingState,
              reason_codes: [reportingReason],
              last_qualified_at: state.logical_time,
            };
          } else {
            limitations.push(limitation(state.reason_code));
            reporting = { state: "UNAVAILABLE", reason_codes: [state.reason_code], last_qualified_at: null };
          }
        }
      }

      const currentCondition: FieldCurrentConditionProjectionV1 | null = state.status === "AVAILABLE"
        ? {
            status: "AVAILABLE",
            summary: null,
            effective_at: state.logical_time,
            support_state: "SUPPORTED",
            source_ref_key: currentStateRefKey,
            metrics: currentStateMetrics(state),
          }
        : null;

      const projectionSeed = {
        field_id: field.field_id,
        identity_digest: digests.find((row) => row.source_ref_key === identityRefKey)?.digest,
        season_ref: season.status === "EXACT" ? season.value.season_id : null,
        state_ref: state.status === "AVAILABLE" ? state.object_ref : null,
        state_hash: state.status === "AVAILABLE" ? state.object_hash : null,
        reporting,
        limitation_codes: limitations.map((row) => row.reason_code),
      };

      const exactSeason = season.status === "EXACT" ? season.value : null;
      const exactZone = state.status === "AVAILABLE" ? state.scope.zone_id : null;
      const envelope = envelopeV1({
        projection_type: "FIELD_SUMMARY",
        projection_id: projectionId("field-summary", projectionSeed),
        generated_at: generatedAt,
        scope,
        field_id: field.field_id,
        season_id: exactSeason?.season_id ?? null,
        zone_id: exactZone,
        authority_refs: authorityRefs,
        non_authority_refs: nonAuthorityRefs,
        digests,
        limitations,
        current_state_ref_key: currentStateRefKey,
        current_state_time: state.status === "AVAILABLE" ? state.logical_time : null,
      });

      const projection: FieldSummaryProjectionV1 = {
        envelope: envelope as FieldSummaryProjectionV1["envelope"],
        field_ref: field.field_id,
        identity: {
          display_name: field.display_name,
          farm_display_name: null,
          crop_display_name: exactSeason?.crop ?? null,
          crop_stage_display: null,
          season_display: exactSeason?.display_name ?? null,
          area: field.area,
          area_unit: field.area_unit,
        },
        current_condition: currentCondition,
        reporting_state: reporting,
        attention: {
          status: "UNAVAILABLE",
          has_attention: null,
          attention_item_refs: [],
        },
        recent_operation: {
          status: "UNAVAILABLE",
          operation: null,
        },
        geometry_availability: "UNAVAILABLE",
        capability_refs: [],
      };

      const proofSet: ProductProjectionSourceBindingProofSetV1 = {
        registry_version: PRODUCT_PROJECTION_SOURCE_BINDING_REGISTRY_VERSION_V1,
        proofs,
        non_authoritative: true,
      };

      assertFieldSummaryProjectionV1(projection);
      assertCustomerFieldProjectionSourceBindingsV1(projection.envelope, proofSet, {
        field_identity_ref_key: identityRefKey,
        field_season_ref_key: seasonRefKey,
        current_state_ref_key: currentStateRefKey,
      });

      out.push({
        projection,
        proofs: proofSet,
        refs: {
          field_identity_ref_key: identityRefKey,
          field_season_ref_key: seasonRefKey,
          current_state_ref_key: currentStateRefKey,
        },
      });
    }

    return out;
  }

  async buildFieldSummaries(
    scope: ProductCustomerReadScopeV1,
    generatedAt: string,
  ): Promise<readonly FieldSummaryProjectionV1[]> {
    return (await this.buildFieldInternals(scope, generatedAt)).map((row) => row.projection);
  }

  async buildFieldWorkspace(
    scope: ProductCustomerReadScopeV1,
    fieldId: string,
    generatedAt: string,
  ): Promise<FieldWorkspaceProjectionV1 | null> {
    if (!scope.allowed_field_ids.includes(fieldId)) return null;
    const narrowedScope: ProductCustomerReadScopeV1 = { ...scope, allowed_field_ids: [fieldId] };
    const internal = (await this.buildFieldInternals(narrowedScope, generatedAt))[0];
    if (!internal) return null;

    const summary = internal.projection;
    const limitations: ProductProjectionLimitationV1[] = [
      ...summary.envelope.limitations,
      limitation("FIELD_RECENT_CHANGES_NOT_PROJECTED_IN_FIRST_SLICE"),
      limitation("ACTION_CASE_PRODUCT_VIEW_NOT_PROJECTED_IN_FIRST_SLICE"),
      limitation("FIELD_OPERATIONS_NOT_PROJECTED_IN_FIRST_SLICE"),
      limitation("EXECUTION_EVIDENCE_NOT_PROJECTED_IN_FIRST_SLICE"),
      limitation("OUTCOME_NOT_PROJECTED_IN_FIRST_SLICE"),
      limitation("FULL_FIELD_HISTORY_NOT_PROJECTED_IN_FIRST_SLICE"),
    ];

    const envelope = envelopeV1({
      projection_type: "FIELD_WORKSPACE",
      projection_id: projectionId("field-workspace", {
        field_summary_projection_id: summary.envelope.projection_id,
        limitation_codes: limitations.map((row) => row.reason_code),
      }),
      generated_at: generatedAt,
      scope: narrowedScope,
      field_id: fieldId,
      season_id: summary.envelope.subject_scope.season_id,
      zone_id: summary.envelope.subject_scope.zone_id,
      authority_refs: summary.envelope.source_authority_refs,
      non_authority_refs: summary.envelope.source_non_authority_refs,
      digests: summary.envelope.source_content_digests,
      limitations,
      current_state_ref_key: internal.refs.current_state_ref_key,
      current_state_time: summary.current_condition?.effective_at ?? null,
    });

    const workspace: FieldWorkspaceProjectionV1 = {
      envelope: envelope as FieldWorkspaceProjectionV1["envelope"],
      field_ref: fieldId,
      identity: summary.identity,
      current_condition: summary.current_condition,
      reporting_state: summary.reporting_state,
      recent_changes: { status: "UNAVAILABLE", items: [] },
      open_action_cases: { status: "UNAVAILABLE", items: [] },
      recent_operations: { status: "UNAVAILABLE", items: [] },
      evidence_summary: {
        field_condition: summary.current_condition
          ? {
              status: "LIMITED",
              artifact_count: null,
              reason_codes: ["FIELD_CONDITION_EVIDENCE_DETAIL_NOT_PROJECTED"],
            }
          : {
              status: "UNAVAILABLE",
              artifact_count: null,
              reason_codes: ["CURRENT_FIELD_CONDITION_UNAVAILABLE"],
            },
        execution_evidence: {
          status: "UNAVAILABLE",
          artifact_count: null,
          reason_codes: ["EXECUTION_EVIDENCE_NOT_PROJECTED_IN_FIRST_SLICE"],
        },
      },
      observed_outcomes: { status: "UNAVAILABLE", items: [] },
      capability_availability: [],
      history_summary: summary.current_condition?.effective_at
        ? {
            status: "LIMITED",
            latest_event_at: summary.current_condition.effective_at,
            reason_codes: ["ONLY_CURRENT_STATE_EVENT_AVAILABLE_IN_FIRST_SLICE"],
          }
        : {
            status: "UNAVAILABLE",
            latest_event_at: null,
            reason_codes: ["FULL_FIELD_HISTORY_NOT_PROJECTED_IN_FIRST_SLICE"],
          },
      provenance_summary: {
        source_authority_count: envelope.source_authority_refs.length,
        source_non_authority_count: envelope.source_non_authority_refs.length,
      },
    };

    assertFieldWorkspaceProjectionV1(workspace);
    assertCustomerFieldProjectionSourceBindingsV1(workspace.envelope, internal.proofs, internal.refs);
    return workspace;
  }

  async buildCustomerOverview(
    scope: ProductCustomerReadScopeV1,
    generatedAt: string,
  ): Promise<CustomerOverviewProjectionV1> {
    const internals = await this.buildFieldInternals(scope, generatedAt);
    const fields = internals.map((row) => row.projection);

    const authorityRefs = uniqueByRefKey(fields.flatMap((field) => [...field.envelope.source_authority_refs]));
    const nonAuthorityRefs = uniqueByRefKey(fields.flatMap((field) => [...field.envelope.source_non_authority_refs]));
    const digests = uniqueDigests(fields.flatMap((field) => [...field.envelope.source_content_digests]));
    const proofs: ProductProjectionSourceBindingProofSetV1 = {
      registry_version: PRODUCT_PROJECTION_SOURCE_BINDING_REGISTRY_VERSION_V1,
      proofs: uniqueProofs(internals.flatMap((row) => [...row.proofs.proofs])),
      non_authoritative: true,
    };

    const limitations: ProductProjectionLimitationV1[] = [
      limitation("CUSTOMER_ATTENTION_NOT_PROJECTED_IN_FIRST_SLICE"),
      limitation("CUSTOMER_RECENT_OPERATIONS_NOT_PROJECTED_IN_FIRST_SLICE"),
      limitation("CUSTOMER_LATEST_REPORTS_NOT_PROJECTED_IN_FIRST_SLICE"),
    ];
    if (fields.some((field) => field.reporting_state.state !== "CURRENT")) {
      limitations.push(limitation("ONE_OR_MORE_FIELDS_NOT_CURRENTLY_REPORTABLE"));
    }

    const envelope = envelopeV1({
      projection_type: "CUSTOMER_OVERVIEW",
      projection_id: projectionId("customer-overview", {
        fields: fields.map((field) => field.envelope.projection_id),
        limitation_codes: limitations.map((row) => row.reason_code),
      }),
      generated_at: generatedAt,
      scope,
      field_id: null,
      season_id: null,
      zone_id: null,
      authority_refs: authorityRefs,
      non_authority_refs: nonAuthorityRefs,
      digests,
      limitations,
      current_state_ref_key: null,
      current_state_time: null,
    });

    const overview: CustomerOverviewProjectionV1 = {
      envelope: envelope as CustomerOverviewProjectionV1["envelope"],
      reporting_summary: {
        total_fields: fields.length,
        current_fields: fields.filter((field) => field.reporting_state.state === "CURRENT").length,
        limited_fields: fields.filter((field) => field.reporting_state.state === "LIMITED").length,
        unavailable_fields: fields.filter((field) => field.reporting_state.state === "UNAVAILABLE").length,
      },
      attention: { status: "UNAVAILABLE", items: [] },
      field_previews: fields,
      recent_operations: { status: "UNAVAILABLE", items: [] },
      latest_reports: { status: "UNAVAILABLE", items: [] },
    };

    assertCustomerOverviewProjectionV1(overview);
    assertProductProjectionSourceBindingsV1(overview.envelope, proofs);
    return overview;
  }
}
