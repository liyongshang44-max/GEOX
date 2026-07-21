// Purpose: construct exact Runtime-root and action-lifecycle fixture chains for S4 PostgreSQL acceptance.
// Boundary: test fixture writes only; no production authority.

import { computeA0RecordSetDeterminismHashV1 } from "../../apps/server/src/domain/twin_runtime/canonical_identity_v1.js";
import { semanticHashV1 } from "../../apps/server/src/domain/twin_runtime/canonical_json_v1.js";
import { canonicalFact, canonicalObject, insertProjection, now, persistFacts, pool, projectionRow, replayPlanFact, scope, type CanonicalObject, type JsonRecord } from "./mcft_cap_07_s4_postgres_fixture_core_v1.js";

export async function seedRuntimeRoot(): Promise<{ posterior: CanonicalObject; currentForecast: CanonicalObject; oldForecast: CanonicalObject; oldScenario: CanonicalObject; terminalHealth: CanonicalObject; operationalHealth: CanonicalObject }> {
  const config = canonicalObject({ object_id: "config-s4", object_type: "twin_runtime_config_v1", logical_time: now(400), payload: { config: "s4" } });
  const common = { runtime_config_ref: config.object_id, runtime_config_hash: config.determinism_hash, lineage_id: "lineage-s4", revision_id: "revision-s4" };
  const lineage = canonicalObject({ object_id: "lineage-object-s4", object_type: "twin_runtime_lineage_v1", logical_time: now(401), payload: { lineage_kind: "INITIAL", activation_authority_ref: "lineage-object-s4" }, ...common });
  const evidence = canonicalObject({ object_id: "evidence-s4", object_type: "twin_evidence_window_v1", logical_time: now(402), payload: {}, ...common });
  const transition = canonicalObject({ object_id: "transition-s4", object_type: "twin_state_transition_v1", logical_time: now(403), payload: {}, ...common });
  const assimilation = canonicalObject({ object_id: "assimilation-s4", object_type: "twin_assimilation_update_v1", logical_time: now(404), payload: {}, ...common });
  const posterior = canonicalObject({ object_id: "posterior-root-s4", object_type: "twin_state_estimate_v1", logical_time: now(404), payload: { sequence: "runtime-root" }, ...common });
  const currentForecast = canonicalObject({ object_id: "forecast-current-blocked", object_type: "twin_forecast_run_v1", logical_time: now(405), payload: { status: "BLOCKED", source_posterior_ref: posterior.object_id, source_posterior_hash: posterior.determinism_hash }, ...common });
  const terminalHealth = canonicalObject({ object_id: "health-terminal-s4", object_type: "twin_runtime_health_v1", logical_time: now(406), payload: { status: "PASS" }, ...common });
  const checkpoint = canonicalObject({ object_id: "checkpoint-s4", object_type: "twin_runtime_checkpoint_v1", logical_time: now(407), payload: { last_completed_tick_ref: "tick-s4", last_posterior_state_ref: posterior.object_id, forecast_result_ref: currentForecast.object_id }, ...common });
  const tick = canonicalObject({ object_id: "tick-s4", object_type: "twin_runtime_tick_v1", logical_time: now(408), payload: { checkpoint_ref: checkpoint.object_id, evidence_window_ref: evidence.object_id, state_transition_ref: transition.object_id, assimilation_update_ref: assimilation.object_id, posterior_state_ref: posterior.object_id, forecast_result_ref: currentForecast.object_id }, ...common });
  const members = [lineage, evidence, transition, assimilation, posterior, currentForecast, tick, checkpoint, terminalHealth];
  const recordSetId = "record-set-s4";
  const recordSetHash = computeA0RecordSetDeterminismHashV1({ a0_record_set_id: recordSetId, members });
  const oldForecast = canonicalObject({ object_id: "forecast-old-success", object_type: "twin_forecast_run_v1", logical_time: now(350), payload: { status: "SUCCEEDED", source_posterior_ref: posterior.object_id, source_posterior_hash: posterior.determinism_hash }, ...common });
  const oldScenario = canonicalObject({ object_id: "scenario-old", object_type: "twin_scenario_set_v1", logical_time: now(351), payload: { source_forecast_ref: oldForecast.object_id, source_forecast_hash: oldForecast.determinism_hash, source_posterior_ref: posterior.object_id, source_posterior_hash: posterior.determinism_hash, scenario_policy_id: "policy-s4", option_count: 1 }, ...common });
  const attempt = canonicalObject({ object_id: "attempt-operational-s4", object_type: "twin_runtime_attempt_v1", logical_time: now(409), payload: {}, ...common });
  const operationalHealth = canonicalObject({ object_id: "health-operational-s4", object_type: "twin_runtime_health_v1", logical_time: now(410), payload: { attempt_ref: attempt.object_id, status: "FAIL" }, ...common });
  const rootFacts = [config, ...members, oldForecast, oldScenario, attempt, operationalHealth].map(canonicalFact);
  await persistFacts(rootFacts);
  const client = await pool.connect();
  try {
    await client.query(`INSERT INTO public.twin_object_idempotency_index_v1 VALUES('A0_RECORD_SET','idem-record-set',$1,$2,NULL,$3::jsonb,$4::jsonb)`, [recordSetId, recordSetHash, JSON.stringify(members.map((member) => member.object_id)), JSON.stringify(Object.fromEntries(members.map((member) => [member.object_id, member.determinism_hash])))]);
    await client.query(`INSERT INTO public.twin_active_lineage_index_v1 VALUES($1,$2,$3,$4,$5,$6,$7,$7)`, [...Object.values(scope), lineage.object_id]);
    await client.query(`INSERT INTO public.twin_runtime_checkpoint_latest_index_v1 VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`, [...Object.values(scope), checkpoint.object_id, checkpoint.determinism_hash, "lineage-s4"]);
    await client.query(`INSERT INTO public.twin_forecast_success_latest_index_v1 VALUES($1,$2,$3,$4,$5,$6,$7,$8)`, [...Object.values(scope), oldForecast.object_id, oldForecast.determinism_hash]);
    await client.query(`INSERT INTO public.twin_scenario_latest_index_v1 VALUES($1,$2,$3,$4,$5,$6,$7,$8)`, [...Object.values(scope), oldScenario.object_id, oldScenario.determinism_hash]);
    await client.query(`INSERT INTO public.twin_runtime_health_latest_index_v1 VALUES($1,$2,$3,$4,$5,$6,$7,$8)`, [...Object.values(scope), operationalHealth.object_id, operationalHealth.determinism_hash]);
    await insertProjection(client, "public.twin_forecast_run_projection_v1", projectionRow("public.twin_forecast_run_projection_v1", canonicalFact(oldForecast), oldForecast));
    await insertProjection(client, "public.twin_scenario_set_projection_v1", projectionRow("public.twin_scenario_set_projection_v1", canonicalFact(oldScenario), oldScenario));
  } finally { client.release(); }
  return { posterior, currentForecast, oldForecast, oldScenario, terminalHealth, operationalHealth };
}

export async function seedCurrentScenarioDecisionPlanFeedback(currentForecast: CanonicalObject, posterior: CanonicalObject): Promise<void> {
  const scenario = canonicalObject({ object_id: "scenario-current", object_type: "twin_scenario_set_v1", logical_time: now(420), payload: { source_forecast_ref: currentForecast.object_id, source_forecast_hash: currentForecast.determinism_hash, source_posterior_ref: posterior.object_id, source_posterior_hash: posterior.determinism_hash, scenario_policy_id: "policy-s4", option_count: 1 }, runtime_config_ref: String(currentForecast.runtime_config_ref), runtime_config_hash: String(currentForecast.runtime_config_hash) });
  const decision = canonicalObject({ object_id: "decision-current", object_type: "twin_decision_record_v1", logical_time: now(421), context: true, payload: { scenario_set_ref: scenario.object_id, scenario_set_hash: scenario.determinism_hash, selected_option_ref: "option-current", selected_option_hash: semanticHashV1("option-current"), selected_option_id: "IRRIGATE_NOW_15MM", decision_request_evidence_ref: "decision-request-current", decision_request_evidence_hash: semanticHashV1("decision-request-current"), actor_ref: "operator-s4" }, runtime_config_ref: String(currentForecast.runtime_config_ref), runtime_config_hash: String(currentForecast.runtime_config_hash) });
  const plan = replayPlanFact("plan-current", now(422));
  const planHash = String((plan.record_json.payload as JsonRecord).source_record_hash);
  const feedback = canonicalObject({ object_id: "feedback-current", object_type: "twin_action_feedback_v1", logical_time: now(423), context: true, payload: { decision_ref: decision.object_id, decision_hash: decision.determinism_hash, approved_plan_evidence_ref: "plan-current", approved_plan_evidence_hash: planHash, dispatch_disposition: "EXTERNALLY_RECORDED", event_id: "event-current", source_record_id: "source-current", binding_id: "binding-current", origin_source_id: "origin-current", execution_status: "EXECUTED", validation_status: "VALIDATED", source_quality: "PASS", eligible_for_state_input: true, actual_amount_mm: "15.000000", spatial_coverage_fraction: "1.000000", target_scope_equivalent_irrigation_mm: "15.000000", execution_start: now(422), execution_end: now(423), available_to_runtime_at: now(423) }, runtime_config_ref: String(currentForecast.runtime_config_ref), runtime_config_hash: String(currentForecast.runtime_config_hash) });
  const facts = [canonicalFact(scenario), canonicalFact(decision), plan, canonicalFact(feedback)];
  await persistFacts(facts);
  const client = await pool.connect();
  try {
    await insertProjection(client, "public.twin_scenario_set_projection_v1", projectionRow("public.twin_scenario_set_projection_v1", facts[0], scenario));
    await insertProjection(client, "public.twin_decision_record_projection_v1", projectionRow("public.twin_decision_record_projection_v1", facts[1], decision));
    await insertProjection(client, "public.twin_action_feedback_projection_v1", projectionRow("public.twin_action_feedback_projection_v1", facts[3], feedback));
    await client.query(`INSERT INTO public.twin_approved_plan_binding_projection_v1 VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,true)`, [...Object.values(scope), decision.payload.decision_request_evidence_ref, decision.payload.decision_request_evidence_hash, decision.payload.selected_option_ref, decision.payload.selected_option_hash, "plan-current", planHash]);
  } finally { client.release(); }
}
