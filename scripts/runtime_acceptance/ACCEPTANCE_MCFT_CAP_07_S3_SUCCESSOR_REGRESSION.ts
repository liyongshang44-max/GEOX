// Purpose: validate immutable S3 composer contracts and authority continuity from S4 or later delivery contexts.
// Boundary: successor regression and predecessor remediation only; no S3 candidate transition, changed-file boundary assertion, database, route, persistence, or mutation.

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  ActionLifecycleComposerV1,
  BoundedCollectionPageComposerV1,
  CurrentRuntimeComposerV1,
  FieldTwinTimelineComposerV1,
  FieldTwinTraceGraphComposerV1,
  ModelGovernanceComposerV1,
  RuntimeHealthComposerV1,
  canonicalUtcInstantV1,
  type FieldTwinCollectionAttachmentV1,
  type FieldTwinCollectionKindV1,
  type FieldTwinOptionalCollectionSummaryV1,
  type FieldTwinRuntimeHealthRoleResolutionV1,
  type FieldTwinScopeV1,
  type SemanticHashTextV1,
} from "../../apps/server/src/domain/field_twin_read_model/index.js";
import type { FieldTwinComposerObjectV1 } from "../../apps/server/src/domain/field_twin_read_model/composer_contracts_v1.js";
import { semanticHashV1 } from "../../apps/server/src/domain/twin_runtime/canonical_json_v1.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const CAP = "docs/digital_twin/mcft/cap_07";
const OUT = path.join(ROOT, "acceptance-output/MCFT_CAP_07_S3_COMPOSERS_RESULT.json");
const checks: Array<{ name: string; status: "PASS" }> = [];
const check = (name: string, action: () => void): void => { action(); checks.push({ name, status: "PASS" }); };
const load = (relative: string): any => JSON.parse(fs.readFileSync(path.join(ROOT, relative), "utf8"));
const hash = (value: unknown) => semanticHashV1(value) as SemanticHashTextV1;
const scope: FieldTwinScopeV1 = Object.freeze({ tenant_id: "tenant-a", project_id: "project-a", group_id: "group-a", field_id: "field-a", season_id: "season-a", zone_id: "zone-a" });
const responseStartedAt = canonicalUtcInstantV1("2026-07-21T00:00:00.000Z");

function composerObject(ref: string, logicalTime: string, objectType = "twin_runtime_health_v1"): FieldTwinComposerObjectV1 {
  return Object.freeze({
    object_ref: ref,
    object_type: objectType,
    object_hash: hash({ ref, objectType }),
    source_fact_ref: `fact-${ref}`,
    scope,
    lineage_id: "lineage-a",
    revision_id: "revision-a",
    logical_time: canonicalUtcInstantV1(logicalTime),
    source_refs: [],
    evidence_refs: [],
    validation_profile: "CANONICAL_TWIN_FACT_DIRECT",
    validation_status: "PASS",
    attachment_status: "ATTACHED_EXACT",
  });
}

function absentAttachment(reasonCode: string): FieldTwinCollectionAttachmentV1<never> {
  return { attachment_status: "ABSENT_OPTIONAL_DOMAIN", reason_code: reasonCode, item: null };
}

function emptySummary(kind: FieldTwinCollectionKindV1, endpoint: string): FieldTwinOptionalCollectionSummaryV1 {
  return {
    collection_kind: kind,
    attachment_status: "ABSENT_OPTIONAL_DOMAIN",
    reason_code: "NO_VISIBLE_ITEMS_IN_SCOPE",
    has_items: false,
    count_status: "NOT_COMPUTED",
    total_count: null,
    latest_item_ref: null,
    latest_item_hash: null,
    collection_endpoint: endpoint,
  };
}

function terminalResolution(ref: string): FieldTwinRuntimeHealthRoleResolutionV1 {
  return {
    health_object_ref: ref,
    transaction_family: "A_STATE_TICK_COMMIT",
    health_role: "TERMINAL_RECORD_SET_MEMBER",
    health_resolution_basis: "EXACT_RECORD_SET_MEMBERSHIP",
    health_resolution_evidence_refs: [{ ref_type: "RECORD_SET", ref_value: "record-set-a" }],
    atomic_group_ref: "record-set-a",
  };
}

function operationalResolution(ref: string): FieldTwinRuntimeHealthRoleResolutionV1 {
  return {
    health_object_ref: ref,
    transaction_family: "F_OPERATIONAL_ATTEMPT_HEALTH",
    health_role: "OPERATIONAL_ATTEMPT_AUDIT",
    health_resolution_basis: "EXACT_OPERATIONAL_ATTEMPT_RELATION",
    health_resolution_evidence_refs: [{ ref_type: "RUNTIME_ATTEMPT", ref_value: "attempt-a" }],
    atomic_group_ref: null,
  };
}

try {
  check("S3_COMPOSER_EXPORT_INVENTORY_PRESERVED", () => {
    const constructors = [
      CurrentRuntimeComposerV1,
      FieldTwinTimelineComposerV1,
      FieldTwinTraceGraphComposerV1,
      ActionLifecycleComposerV1,
      ModelGovernanceComposerV1,
      BoundedCollectionPageComposerV1,
      RuntimeHealthComposerV1,
    ];
    assert.equal(constructors.length, 7);
    for (const constructor of constructors) assert.equal(typeof constructor, "function");
  });

  check("S2_ATTESTATION_CONSUMPTION_PRESERVED", () => {
    const predecessor = load(`${CAP}/GEOX-MCFT-CAP-07-S3-PREDECESSOR-ATTESTATION-CONSUMPTION-V1.json`);
    assert.equal(predecessor.status, "PASS");
    assert.equal(predecessor.merge_commit, "27fcba8cf39cd62b7c9e71ee20577feced182ab0");
    assert.equal(predecessor.candidate_to_merge_tree_delta, 0);
    assert.equal(predecessor.attestation_workflow_run_id, 29765257247);
    assert.equal(predecessor.artifact_id, 8470534831);
    assert.equal(predecessor.effective_frontier, "S3");
  });

  check("S3_AUTHORITY_NOT_REGRESSED", () => {
    const s3 = load(`${CAP}/GEOX-MCFT-CAP-07-S3-DELIVERY-STATUS-V1.json`);
    assert.equal(s3.s3_candidate_implemented, true);
    assert.equal(s3.implementation_authorized, true);
    assert.equal(s3.runtime_authority_delta, "READ_ONLY_COMPOSERS_ONLY");
    assert.equal(s3.canonical_write_authority_delta, "ZERO");
    assert.equal(s3.migration_authority_delta, "ZERO");
    assert.equal(s3.route_authority_delta, "ZERO");
    assert.equal(s3.frontend_authority_delta, "ZERO");
  });

  check("SUCCESSOR_STATE_COHERENT_WITHOUT_STALE_S4_SEED_ASSERTION", () => {
    const s4 = load(`${CAP}/GEOX-MCFT-CAP-07-S4-DELIVERY-STATUS-V1.json`);
    if (s4.s4_candidate_implemented === true) {
      assert.equal(s4.implementation_authorized, true);
      assert.equal(s4.canonical_write_authorized, false);
      assert.equal(s4.runtime_source_authorized, false);
    } else {
      assert.equal(s4.s4_candidate_implemented, false);
      assert.equal(s4.implementation_authorized, false);
    }
  });

  check("CAPABILITY_AUTHORITY_NO_FORBIDDEN_ESCALATION", () => {
    const manifest = load(`${CAP}/GEOX-MCFT-CAP-07-RESOLVED-MANIFEST-V1.json`);
    assert.equal(manifest.document_status, "FROZEN");
    assert.equal(manifest.canonical_write_authorized, false);
    assert.equal(manifest.runtime_source_authorized, false);
    assert.equal(manifest.mcft_cap_08_authorized, false);
    assert.ok(["S3", "S4", "S5", "S6"].includes(manifest.current_slice));
  });

  check("REGISTRY_S3_AND_SUCCESSOR_TRANSITIONS_PRESERVED", () => {
    const registry = load("docs/digital_twin/mcft/MCFT-CANDIDATE-AUTHORITY-REGISTRY-V1.json");
    assert.equal(registry.registry_revision, "1.1");
    const cap = registry.capabilities.find((entry: any) => entry.capability_line === "MCFT-CAP-07");
    assert.ok(cap);
    assert.ok(cap.candidate_transition_fields.some((entry: any) => entry.status_file.endsWith("S3-DELIVERY-STATUS-V1.json") && entry.field_path === "s3_candidate_implemented"));
    assert.ok(cap.candidate_transition_fields.some((entry: any) => entry.status_file.endsWith("S4-DELIVERY-STATUS-V1.json") && entry.field_path === "s4_candidate_implemented"));
  });

  check("S3_STATIC_NO_DATABASE_ROUTE_OR_WRITE_REGRESSION", () => {
    const files = [
      "composer_contracts_v1.ts",
      "current_runtime_composer_v1.ts",
      "bounded_page_composers_v1.ts",
      "trace_graph_composer_v1.ts",
      "runtime_health_composer_v1.ts",
      "action_and_governance_composers_v1.ts",
    ].map((file) => path.join(ROOT, "apps/server/src/domain/field_twin_read_model", file));
    for (const file of files) {
      const source = fs.readFileSync(file, "utf8");
      assert.doesNotMatch(source, /from\s+["']pg["']/);
      assert.doesNotMatch(source, /\/repositories\//);
      assert.doesNotMatch(source, /\/infra\//);
      assert.doesNotMatch(source, /\/routes\//);
      assert.doesNotMatch(source, /\b(?:INSERT|UPDATE|DELETE|UPSERT|CREATE|ALTER|DROP|TRUNCATE|GRANT|REVOKE)\b/i);
    }
  });

  check("OPTIONAL_SUMMARY_NOT_COMPUTED_CONTRACT_ACCEPTED", () => {
    const action = new ActionLifecycleComposerV1().compose({
      request_scope: scope,
      response_started_at: responseStartedAt,
      current_human_decision: absentAttachment("NO_HUMAN_DECISION_IN_SCOPE"),
      current_approved_plan: absentAttachment("NO_APPROVED_PLAN_IN_SCOPE"),
      action_feedback_summary: emptySummary("ACTION_FEEDBACK", "/action-lifecycle"),
      exact_edges: [],
      limitations: [],
    });
    assert.equal(action.action_feedback_summary.count_status, "NOT_COMPUTED");
    assert.equal(action.action_feedback_summary.total_count, null);

    const governance = new ModelGovernanceComposerV1().compose({
      database_profile: "PROFILE_A_RUNTIME",
      request_scope: scope,
      response_started_at: responseStartedAt,
      calibration_candidates: [],
      shadow_evaluations: [],
      model_activations: [],
      calibration_candidate_summary: emptySummary("CALIBRATION_CANDIDATE", "/model-governance"),
      shadow_evaluation_summary: emptySummary("SHADOW_EVALUATION", "/model-governance"),
      model_activation_summary: emptySummary("MODEL_ACTIVATION", "/model-governance"),
      attached_activation_relation: null,
      exact_available_refs: [],
      limitations: [],
    });
    assert.equal(governance.calibration_candidate_summary.total_count, null);
  });

  check("CURRENT_RUNTIME_SUMMARY_AND_SCENARIO_CONTRACT_REMEDIATED", () => {
    const runtime = new CurrentRuntimeComposerV1().compose({
      request_scope: scope,
      response_started_at: responseStartedAt,
      root_graph_status: "NOT_AVAILABLE",
      active_lineage: null,
      active_lineage_authority_validation: null,
      checkpoint: null,
      runtime_tick: null,
      evidence_window: null,
      state_transition: null,
      assimilation_update: null,
      posterior_state: null,
      terminal_record_set_health: null,
      runtime_config: null,
      record_set_validation: null,
      current_tick_forecast_result: null,
      latest_successful_forecast: absentAttachment("NO_SUCCESSFUL_FORECAST_IN_SCOPE"),
      scenario_source_forecast: absentAttachment("NO_SCENARIO_SOURCE_FORECAST_IN_SCOPE"),
      current_scenario_attachment: absentAttachment("NO_SCENARIO_ATTACHED_TO_CURRENT_RUNTIME"),
      latest_scenario_in_scope: absentAttachment("NO_SCENARIO_IN_SCOPE"),
      current_human_decision: absentAttachment("NO_HUMAN_DECISION_IN_SCOPE"),
      current_approved_plan: absentAttachment("NO_APPROVED_PLAN_IN_SCOPE"),
      action_feedback_summary: emptySummary("ACTION_FEEDBACK", "/action-lifecycle"),
      forecast_residual_summary: emptySummary("FORECAST_RESIDUAL", "/residuals"),
      calibration_candidate_summary: emptySummary("CALIBRATION_CANDIDATE", "/model-governance"),
      shadow_evaluation_summary: emptySummary("SHADOW_EVALUATION", "/model-governance"),
      model_activation_summary: emptySummary("MODEL_ACTIVATION", "/model-governance"),
      limitations: [],
      validation_summary: [],
    });
    assert.equal(runtime.root_graph_status, "NOT_AVAILABLE");
    assert.equal(runtime.action_feedback_summary.count_status, "NOT_COMPUTED");
  });

  check("RUNTIME_HEALTH_FROZEN_FIVE_STATE_CONTRACT", () => {
    const terminal = composerObject("health-terminal", "2026-07-21T00:00:00.000Z");
    const operational = composerObject("health-operational", "2026-07-21T01:00:00.000Z");
    const composer = new RuntimeHealthComposerV1();
    const baseInput = { request_scope: scope, response_started_at: responseStartedAt, health_pointer_validation_summary: [] } as const;

    assert.equal(composer.compose({ ...baseInput, terminal_record_set_health: terminal, terminal_role_resolution: terminalResolution(terminal.object_ref), latest_operational_runtime_health: terminal, operational_role_resolution: terminalResolution(terminal.object_ref) }).health_relationship, "SAME_OBJECT");
    assert.equal(composer.compose({ ...baseInput, terminal_record_set_health: terminal, terminal_role_resolution: terminalResolution(terminal.object_ref), latest_operational_runtime_health: operational, operational_role_resolution: operationalResolution(operational.object_ref) }).health_relationship, "LATEST_OPERATIONAL_IS_LATER");
    assert.equal(composer.compose({ ...baseInput, terminal_record_set_health: terminal, terminal_role_resolution: terminalResolution(terminal.object_ref), latest_operational_runtime_health: null, operational_role_resolution: null }).health_relationship, "TERMINAL_ONLY");
    assert.equal(composer.compose({ ...baseInput, terminal_record_set_health: null, terminal_role_resolution: null, latest_operational_runtime_health: operational, operational_role_resolution: operationalResolution(operational.object_ref) }).health_relationship, "OPERATIONAL_ONLY");
    assert.equal(composer.compose({ ...baseInput, terminal_record_set_health: null, terminal_role_resolution: null, latest_operational_runtime_health: null, operational_role_resolution: null }).health_relationship, "BOTH_ABSENT");

    const nonLater = composerObject("health-non-later", "2026-07-20T23:59:00.000Z");
    assert.throws(() => composer.compose({ ...baseInput, terminal_record_set_health: terminal, terminal_role_resolution: terminalResolution(terminal.object_ref), latest_operational_runtime_health: nonLater, operational_role_resolution: operationalResolution(nonLater.object_ref) }), /MCFT_RUNTIME_HEALTH_RELATIONSHIP_INVALID/);
  });

  const result = {
    schema_version: "geox_mcft_cap_07_s3_composers_result_v1",
    status: "PASS",
    execution_mode: "SUCCESSOR_REGRESSION_MODE",
    remediation_scope: "FROZEN_COMPOSER_CONTRACT_CORRECTION_WITH_ZERO_AUTHORITY_DELTA",
    check_count: checks.length,
    checks,
    composer_count: 7,
    composer_names: ["CurrentRuntimeComposerV1", "FieldTwinTimelineComposerV1", "FieldTwinTraceGraphComposerV1", "ActionLifecycleComposerV1", "ModelGovernanceComposerV1", "BoundedCollectionPageComposerV1", "RuntimeHealthComposerV1"],
    default_page_limit: 50,
    maximum_page_limit: 200,
    runtime_authority_delta: "READ_ONLY_COMPOSERS_ONLY",
    canonical_write_authority_delta: "ZERO",
    direct_database_access_performed: false,
    route_implementation_performed: false,
    frontend_implementation_performed: false,
    migration_performed: false,
    persistence_performed: false,
    cap_08_authorized: false,
  };
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  console.log(`MCFT-CAP-07 S3 successor regression: ${checks.length} PASS`);
} catch (error) {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, `${JSON.stringify({ schema_version: "geox_mcft_cap_07_s3_composers_result_v1", status: "FAIL", execution_mode: "SUCCESSOR_REGRESSION_MODE", error: error instanceof Error ? error.message : String(error), checks }, null, 2)}\n`, "utf8");
  console.error(error);
  process.exitCode = 1;
}
