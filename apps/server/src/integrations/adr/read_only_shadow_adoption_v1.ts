import type { Pool, PoolClient } from "pg";
import {
  getLatestDerivedSensingStatesByFieldV1,
  type DerivedSensingStateV1Row,
} from "../../services/derived_sensing_state_v1.js";

type DbConn = Pool | PoolClient;

export const GEOX_ADR_READ_ONLY_SHADOW_CONTEXT_VERSION = "geox.adr-read-only-shadow-context.v1";
export const GEOX_ADR_READ_ONLY_SHADOW_OBSERVATION_VERSION = "geox.adr-read-only-shadow-observation.v1";

const ADR_SINK_CONTRACT_VERSION = "adr.geox-decision-result-sink.v1";
const ADR_TARGET_UNBOUND_MODE = "ADR_TARGET_UNBOUND_TO_GEOX_FIELD";
const ADR_CONSUMER_DISPOSITION = "DISPLAY_ONLY_ADVISORY_CANDIDATE";
const ADR_AUTHORITY_CLAIM = "NONE_GEOX_ADAPTER_RESULT_PROJECTION_ONLY";
const ADR_HUMAN_APPROVAL_NONE = "NONE_DECISION_RESULT_IS_NOT_HUMAN_APPROVAL_AUTHORITY";
const ADR_MACHINE_EXECUTION_NONE = "NONE_DECISION_RESULT_IS_NOT_MACHINE_EXECUTION_AUTHORITY";

function text(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`ADR_SHADOW_INPUT_INVALID:${label}`);
  }
  return value.trim();
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function frozenRow(row: DerivedSensingStateV1Row) {
  return Object.freeze({
    tenant_id: row.tenant_id,
    project_id: row.project_id,
    group_id: row.group_id,
    field_id: row.field_id,
    state_type: row.state_type,
    payload: Object.freeze(clone(row.payload)),
    confidence: row.confidence,
    explanation_codes: Object.freeze([...(row.explanation_codes ?? [])]),
    source_observation_ids: Object.freeze([...(row.source_observation_ids ?? [])]),
    source_device_ids: Object.freeze([...(row.source_device_ids ?? [])]),
    computed_at_ts_ms: row.computed_at_ts_ms,
    fact_id: row.fact_id,
  });
}

export type GeoxAdrReadOnlyShadowContextV1 = Awaited<ReturnType<typeof exportGeoxAdrReadOnlyShadowContextV1>>;

export async function exportGeoxAdrReadOnlyShadowContextV1(input: {
  db: DbConn;
  tenant_id: string;
  project_id: string;
  group_id: string;
  field_id: string;
}) {
  const tenant_id = text(input.tenant_id, "tenant_id");
  const project_id = text(input.project_id, "project_id");
  const group_id = text(input.group_id, "group_id");
  const field_id = text(input.field_id, "field_id");

  const rows = await getLatestDerivedSensingStatesByFieldV1(input.db, {
    tenant_id,
    project_id,
    group_id,
    field_id,
  });

  for (const row of rows) {
    if (row.tenant_id !== tenant_id
      || row.project_id !== project_id
      || row.group_id !== group_id
      || row.field_id !== field_id) {
      throw new Error("ADR_SHADOW_READ_MODEL_SCOPE_MISMATCH");
    }
  }

  return Object.freeze({
    contract_version: GEOX_ADR_READ_ONLY_SHADOW_CONTEXT_VERSION,
    routing_scope: Object.freeze({ tenant_id, project_id, group_id }),
    geox_field_id: field_id,
    reality_source: "GEOX_DERIVED_SENSING_STATE_READ_MODEL_V1",
    reality_rows: Object.freeze(rows.map(frozenRow)),
    identity_boundary: Object.freeze({
      geox_field_is_adr_target_identity: false,
      adr_target_binding_status: "UNRESOLVED",
      correspondence_or_equality_established: false,
    }),
    authority_boundary: Object.freeze({
      database_operation: "READ_ONLY_SELECT",
      recommendation_write_authorized: false,
      approval_authorized: false,
      operation_plan_or_task_creation_authorized: false,
      dispatch_authorized: false,
      machine_execution_authorized: false,
    }),
  });
}

type AdrDecisionResultProjectionV1 = {
  contract_version: string;
  routing_scope: { tenant_id: string; project_id: string; group_id: string };
  adr_decision_result_ref: Record<string, unknown>;
  decision_disposition: string;
  adr_structured_action: Record<string, unknown> | null;
  target_binding: { status: string; source_mode: string; reason_code: string };
  consumer_disposition: string;
  dispatch_authorized: boolean;
  field_actionable: boolean;
  upstream_authority_boundary: {
    human_approval_authority: string;
    machine_execution_authority: string;
  };
  authority_claim: string;
};

export function createGeoxAdrReadOnlyShadowObservationV1(input: {
  geox_context: GeoxAdrReadOnlyShadowContextV1;
  adr_projection: AdrDecisionResultProjectionV1;
}) {
  const context = input.geox_context;
  const projection = input.adr_projection;

  if (context.contract_version !== GEOX_ADR_READ_ONLY_SHADOW_CONTEXT_VERSION) {
    throw new Error("ADR_SHADOW_CONTEXT_CONTRACT_INVALID");
  }
  if (projection.contract_version !== ADR_SINK_CONTRACT_VERSION) {
    throw new Error("ADR_SHADOW_PROJECTION_CONTRACT_INVALID");
  }
  if (projection.routing_scope.tenant_id !== context.routing_scope.tenant_id
    || projection.routing_scope.project_id !== context.routing_scope.project_id
    || projection.routing_scope.group_id !== context.routing_scope.group_id) {
    throw new Error("ADR_SHADOW_ROUTING_SCOPE_MISMATCH");
  }
  if (projection.target_binding.status !== "UNRESOLVED"
    || projection.target_binding.source_mode !== ADR_TARGET_UNBOUND_MODE) {
    throw new Error("ADR_SHADOW_TARGET_BINDING_PROMOTION_FORBIDDEN");
  }
  if (projection.consumer_disposition !== ADR_CONSUMER_DISPOSITION
    || projection.field_actionable !== false
    || projection.dispatch_authorized !== false
    || projection.authority_claim !== ADR_AUTHORITY_CLAIM) {
    throw new Error("ADR_SHADOW_ACTIONABILITY_PROMOTION_FORBIDDEN");
  }
  if (projection.upstream_authority_boundary.human_approval_authority !== ADR_HUMAN_APPROVAL_NONE
    || projection.upstream_authority_boundary.machine_execution_authority !== ADR_MACHINE_EXECUTION_NONE) {
    throw new Error("ADR_SHADOW_EXECUTION_AUTHORITY_PROMOTION_FORBIDDEN");
  }

  return Object.freeze({
    contract_version: GEOX_ADR_READ_ONLY_SHADOW_OBSERVATION_VERSION,
    geox_context: context,
    adr_projection: Object.freeze(clone(projection)),
    comparison_status: "NOT_ESTABLISHED_NO_SAME_DOMAIN_INPUT_EQUIVALENCE_PROOF",
    target_relationship: "UNRESOLVED_NO_GEOX_FIELD_TO_ADR_TARGET_EQUALITY_CLAIM",
    consumer_mode: "READ_ONLY_SHADOW_OBSERVATION_ONLY",
    authority_boundary: Object.freeze({
      recommendation_write_authorized: false,
      approval_authorized: false,
      operation_plan_or_task_creation_authorized: false,
      dispatch_authorized: false,
      machine_execution_authorized: false,
      execution_receipt_created: false,
      outcome_created: false,
    }),
  });
}
