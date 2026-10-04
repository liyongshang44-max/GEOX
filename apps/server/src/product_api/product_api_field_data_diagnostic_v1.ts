import {
  createProductApiReadOnlyPoolV1,
  resolveProductApiPublicRuntimeConfigV1,
} from "./product_api_public_runtime_v1.js";
import {
  PostgresCustomerProductProjectionBuilderV1,
  type CustomerProductReadScopeV1,
} from "../product_projection/customer/customer_product_projection_builder_v1.js";

type ProductToken = {
  token_id: string;
  actor_id: string;
  tenant_id: string;
  project_id: string;
  group_id: string;
  allowed_field_ids: string[];
};

function classifyRepair(reasonCodes: readonly string[]): {
  cause_class: string;
  repair_required: boolean;
  allowed_this_round: boolean;
  required_adjudication: string | null;
} {
  const reasons = new Set(reasonCodes);
  if (
    reasons.has("ATTENTION_QUEUE_BUILDER_NOT_IMPLEMENTED")
    || reasons.has("RECENT_CHANGES_BUILDER_NOT_IMPLEMENTED")
    || reasons.has("ACTION_CASE_BUILDER_NOT_IMPLEMENTED")
    || reasons.has("OPERATION_PROJECTION_NOT_IMPLEMENTED")
    || reasons.has("EXECUTION_EVIDENCE_PROJECTION_NOT_IMPLEMENTED")
    || reasons.has("OUTCOME_PROJECTION_NOT_IMPLEMENTED")
    || reasons.has("HISTORY_PROJECTION_NOT_IMPLEMENTED")
    || reasons.has("REPORT_PROJECTION_NOT_IMPLEMENTED")
    || reasons.has("FIELD_EVIDENCE_ARTIFACT_SUMMARY_NOT_PROJECTED_WAVE02")
  ) {
    return {
      cause_class: "CURRENT_INTERFACE_IMPLEMENTATION_MISSING",
      repair_required: true,
      allowed_this_round: true,
      required_adjudication: null,
    };
  }
  if (reasons.has("CAPABILITY_PROJECTION_NOT_BOUND_WAVE02")) {
    return {
      cause_class: "BLOCKED_BY_FROZEN_SCOPE",
      repair_required: false,
      allowed_this_round: false,
      required_adjudication: "CAPABILITY_PRODUCT_PROJECTION_SUCCESSOR_SCOPE",
    };
  }
  if (
    reasons.has("FIELD_FARM_DISPLAY_NOT_PROJECTED_WAVE02")
    || reasons.has("FIELD_CROP_DISPLAY_NOT_PROJECTED_WAVE02")
    || reasons.has("FIELD_CROP_STAGE_NOT_PROJECTED_WAVE02")
    || reasons.has("FIELD_SEASON_DISPLAY_NOT_PROJECTED_WAVE02")
    || reasons.has("FIELD_GEOMETRY_NOT_PROJECTED_WAVE02")
  ) {
    return {
      cause_class: "BACKEND_MAPPING_MISSING",
      repair_required: true,
      allowed_this_round: true,
      required_adjudication: null,
    };
  }
  if (
    reasons.has("MCFT_CURRENT_RUNTIME_NOT_ESTABLISHED")
    || reasons.has("MCFT_RUNTIME_NOT_ESTABLISHED")
    || reasons.has("MCFT_EXACT_RESOURCE_NOT_FOUND")
  ) {
    return {
      cause_class: "UPSTREAM_AUTHORITY_UNAVAILABLE",
      repair_required: false,
      allowed_this_round: false,
      required_adjudication: "UPSTREAM_FIELD_STATE_AUTHORITY_OR_RUNTIME_ESTABLISHMENT",
    };
  }
  if (reasons.has("FIELD_LEVEL_RUNTIME_SCOPE_AMBIGUOUS_NO_AGGREGATION_AUTHORITY")) {
    return {
      cause_class: "UPSTREAM_AUTHORITY_AMBIGUOUS",
      repair_required: false,
      allowed_this_round: false,
      required_adjudication: "FIELD_LEVEL_MULTI_SCOPE_AGGREGATION_AUTHORITY",
    };
  }
  if (
    [...reasons].some((code) =>
      /MISMATCH|DIVERGENCE|CARDINALITY|INCOMPLETE|POINTER|AUTHORITY|CANONICAL|INVALID/.test(code)
    )
  ) {
    return {
      cause_class: "UPSTREAM_OR_PROJECTION_INTEGRITY_FAILURE",
      repair_required: false,
      allowed_this_round: false,
      required_adjudication: "EXACT_MACHINE_EVIDENCE_REVIEW_REQUIRED",
    };
  }
  if (reasons.has("MCFT_CURRENT_STATE_CUSTOMER_PROJECTION_FIELDS_UNAVAILABLE")) {
    return {
      cause_class: "BACKEND_MAPPING_OR_SOURCE_PAYLOAD_INCOMPATIBLE",
      repair_required: true,
      allowed_this_round: true,
      required_adjudication: null,
    };
  }
  if (reasons.has("MCFT_READ_SURFACE_UNAVAILABLE")) {
    return {
      cause_class: "UPSTREAM_READ_SURFACE_UNAVAILABLE",
      repair_required: false,
      allowed_this_round: false,
      required_adjudication: "MCFT_READ_SURFACE_DIAGNOSTIC_REQUIRED",
    };
  }
  return {
    cause_class: reasons.size === 0 ? "NONE" : "OTHER",
    repair_required: reasons.size > 0,
    allowed_this_round: reasons.size > 0,
    required_adjudication: null,
  };
}

function moduleStatus(input: {
  implemented: boolean;
  status?: string | null;
  reason_codes: readonly string[];
}): {
  implementation_status:
    | "IMPLEMENTED_AND_DATA_AVAILABLE"
    | "IMPLEMENTED_BUT_NO_DATA"
    | "PARTIALLY_IMPLEMENTED"
    | "NOT_IMPLEMENTED"
    | "UPSTREAM_AUTHORITY_UNAVAILABLE"
    | "BLOCKED_BY_FROZEN_SCOPE";
  data_status: string;
  reason_codes: readonly string[];
  current_blocker: string | null;
  allowed_this_round: boolean;
  required_adjudication: string | null;
} {
  const repair = classifyRepair(input.reason_codes);
  if (!input.implemented) {
    if (repair.cause_class === "BLOCKED_BY_FROZEN_SCOPE") {
      return {
        implementation_status: "BLOCKED_BY_FROZEN_SCOPE",
        data_status: input.status ?? "UNAVAILABLE",
        reason_codes: input.reason_codes,
        current_blocker: input.reason_codes.join(",") || null,
        allowed_this_round: false,
        required_adjudication: repair.required_adjudication,
      };
    }
    return {
      implementation_status: "NOT_IMPLEMENTED",
      data_status: input.status ?? "UNAVAILABLE",
      reason_codes: input.reason_codes,
      current_blocker: input.reason_codes.join(",") || null,
      allowed_this_round: repair.allowed_this_round,
      required_adjudication: repair.required_adjudication,
    };
  }
  if (repair.cause_class.startsWith("UPSTREAM_")) {
    return {
      implementation_status: "UPSTREAM_AUTHORITY_UNAVAILABLE",
      data_status: input.status ?? "UNAVAILABLE",
      reason_codes: input.reason_codes,
      current_blocker: input.reason_codes.join(",") || null,
      allowed_this_round: false,
      required_adjudication: repair.required_adjudication,
    };
  }
  if ((input.status ?? "") === "AVAILABLE" || (input.status ?? "") === "CURRENT") {
    return {
      implementation_status: "IMPLEMENTED_AND_DATA_AVAILABLE",
      data_status: input.status ?? "AVAILABLE",
      reason_codes: input.reason_codes,
      current_blocker: null,
      allowed_this_round: false,
      required_adjudication: null,
    };
  }
  if ((input.status ?? "") === "LIMITED" || input.reason_codes.length > 0) {
    return {
      implementation_status: "PARTIALLY_IMPLEMENTED",
      data_status: input.status ?? "LIMITED",
      reason_codes: input.reason_codes,
      current_blocker: input.reason_codes.join(",") || null,
      allowed_this_round: repair.allowed_this_round,
      required_adjudication: repair.required_adjudication,
    };
  }
  return {
    implementation_status: "IMPLEMENTED_BUT_NO_DATA",
    data_status: input.status ?? "UNAVAILABLE",
    reason_codes: input.reason_codes,
    current_blocker: input.reason_codes.join(",") || null,
    allowed_this_round: repair.allowed_this_round,
    required_adjudication: repair.required_adjudication,
  };
}

async function main(): Promise<void> {
  const config = resolveProductApiPublicRuntimeConfigV1();
  const tokenSource = JSON.parse(config.tokenSourceJson) as { version: string; tokens: ProductToken[] };
  const pool = createProductApiReadOnlyPoolV1(config.databaseUrl);
  const builder = new PostgresCustomerProductProjectionBuilderV1(pool);

  try {
    const diagnostics = [];
    for (const token of tokenSource.tokens) {
      const scope: CustomerProductReadScopeV1 = {
        tenant_id: token.tenant_id,
        project_id: token.project_id,
        group_id: token.group_id,
        allowed_field_ids: [...token.allowed_field_ids],
        can_preview_all_fields: false,
      };

      const overview = await builder.buildCustomerOverviewV1(scope);
      const summaries = await builder.buildFieldSummariesV1(scope);
      const fields = [];

      for (const summary of summaries) {
        const workspace = await builder.buildFieldWorkspaceV1(scope, summary.field_ref);

        const active = await pool.query(
          `SELECT season_id, zone_id, active_lineage_ref, updated_at
             FROM public.twin_active_lineage_index_v1
            WHERE tenant_id = $1
              AND project_id = $2
              AND group_id = $3
              AND field_id = $4
            ORDER BY season_id ASC, zone_id ASC
            LIMIT 10`,
          [scope.tenant_id, scope.project_id, scope.group_id, summary.field_ref],
        );

        let historyInventory: null | {
          season_id: string;
          zone_id: string;
          history_row_count: number;
          latest_logical_time_inventory_only: string | null;
          authority_selection_basis: "NOT_USED_FOR_SELECTION";
        } = null;

        if (active.rows.length === 1) {
          const row = active.rows[0] as Record<string, unknown>;
          const history = await pool.query(
            `SELECT COUNT(*)::int AS history_row_count,
                    MAX(logical_time) AS latest_logical_time
               FROM public.twin_state_history_projection_v1
              WHERE tenant_id = $1
                AND project_id = $2
                AND group_id = $3
                AND field_id = $4
                AND season_id = $5
                AND zone_id = $6`,
            [
              scope.tenant_id,
              scope.project_id,
              scope.group_id,
              summary.field_ref,
              String(row.season_id),
              String(row.zone_id),
            ],
          );
          historyInventory = {
            season_id: String(row.season_id),
            zone_id: String(row.zone_id),
            history_row_count: Number(history.rows[0]?.history_row_count ?? 0),
            latest_logical_time_inventory_only: history.rows[0]?.latest_logical_time
              ? new Date(String(history.rows[0].latest_logical_time)).toISOString()
              : null,
            authority_selection_basis: "NOT_USED_FOR_SELECTION",
          };
        }

        const primaryReasons = Array.from(new Set([
          ...summary.current_condition.reason_codes,
          ...summary.reporting_state.reason_codes,
        ])).sort();
        const repair = classifyRepair(primaryReasons);

        fields.push({
          field_ref: summary.field_ref,
          display_name: summary.identity.display_name,
          module: "FIELD_CURRENT_CONDITION",
          status: summary.current_condition.status,
          reporting_state: summary.reporting_state.state,
          reason_code: primaryReasons[0] ?? null,
          reason_codes: primaryReasons,
          reason_detail: repair.cause_class,
          source_ref: summary.current_condition.source_ref_key,
          projection_ref: summary.envelope.projection_id,
          evidence_ref: summary.envelope.source_authority_refs.map((item) => item.ref_key),
          backend_path: [
            "public.field_index_v1",
            "public.twin_active_lineage_index_v1",
            "PostgresMcftFieldTwinS4ReadApiV1",
            "public.twin_state_history_projection_v1",
            "PostgresCustomerProductProjectionBuilderV1",
          ],
          repair_required: repair.repair_required,
          allowed_this_round: repair.allowed_this_round,
          required_adjudication: repair.required_adjudication,
          active_runtime_scope_count: active.rows.length,
          active_runtime_scopes: active.rows.map((row: Record<string, unknown>) => ({
            season_id: String(row.season_id),
            zone_id: String(row.zone_id),
            active_lineage_ref: String(row.active_lineage_ref),
            updated_at: row.updated_at ? new Date(String(row.updated_at)).toISOString() : null,
          })),
          history_inventory: historyInventory,
          modules: {
            overview_current_condition: moduleStatus({
              implemented: true,
              status: summary.current_condition.status,
              reason_codes: summary.current_condition.reason_codes,
            }),
            reporting: moduleStatus({
              implemented: true,
              status: summary.reporting_state.state,
              reason_codes: summary.reporting_state.reason_codes,
            }),
            activity_recent_changes: moduleStatus({
              implemented: false,
              status: workspace.recent_changes.status,
              reason_codes: workspace.recent_changes.reason_codes,
            }),
            activity_operations: moduleStatus({
              implemented: false,
              status: workspace.recent_operations.status,
              reason_codes: workspace.recent_operations.reason_codes,
            }),
            evidence_field_condition: moduleStatus({
              implemented: true,
              status: workspace.evidence_summary.field_condition.status,
              reason_codes: workspace.evidence_summary.field_condition.reason_codes,
            }),
            evidence_execution: moduleStatus({
              implemented: false,
              status: workspace.evidence_summary.execution_evidence.status,
              reason_codes: workspace.evidence_summary.execution_evidence.reason_codes,
            }),
            history: moduleStatus({
              implemented: false,
              status: workspace.history_summary.status,
              reason_codes: workspace.history_summary.reason_codes,
            }),
            action_cases: moduleStatus({
              implemented: false,
              status: workspace.open_action_cases.status,
              reason_codes: workspace.open_action_cases.reason_codes,
            }),
            observed_outcomes: moduleStatus({
              implemented: false,
              status: workspace.observed_outcomes.status,
              reason_codes: workspace.observed_outcomes.reason_codes,
            }),
            capability_availability: moduleStatus({
              implemented: false,
              status: workspace.capability_availability.status,
              reason_codes: workspace.capability_availability.reason_codes,
            }),
            geometry: moduleStatus({
              implemented: false,
              status: summary.geometry_availability,
              reason_codes: ["FIELD_GEOMETRY_NOT_PROJECTED_WAVE02"],
            }),
          },
          limitation_reason_codes: workspace.limitation_reason_codes,
        });
      }

      diagnostics.push({
        token_scope: {
          token_id: token.token_id,
          actor_id: token.actor_id,
          tenant_id: token.tenant_id,
          project_id: token.project_id,
          group_id: token.group_id,
          allowed_field_ids: token.allowed_field_ids,
        },
        overview: {
          projection_ref: overview.envelope.projection_id,
          reporting_summary: overview.reporting_summary,
          attention_items: moduleStatus({
            implemented: false,
            status: overview.attention_items.status,
            reason_codes: overview.attention_items.reason_codes,
          }),
          recent_operations: moduleStatus({
            implemented: false,
            status: overview.recent_operations.status,
            reason_codes: overview.recent_operations.reason_codes,
          }),
          latest_reports: moduleStatus({
            implemented: false,
            status: overview.latest_reports.status,
            reason_codes: overview.latest_reports.reason_codes,
          }),
          limitation_reason_codes: overview.limitation_reason_codes,
        },
        fields,
      });
    }

    console.log("PRODUCT_API_FIELD_DATA_DIAGNOSTIC_V1=" + JSON.stringify({
      schema_version: "product_api_field_data_diagnostic_v1",
      authority_ceiling: "READ_ONLY_NON_AUTHORITATIVE_DIAGNOSTIC",
      production_mutation: false,
      diagnostics,
    }));
    setInterval(() => undefined, 60_000);
  } catch (error) {
    console.error("PRODUCT_API_FIELD_DATA_DIAGNOSTIC_V1_FAILED", error);
    process.exitCode = 1;
    throw error;
  }
}

void main();
