'use strict';

// scripts/h54/h54_2_actionable_irrigation_approval_adapter.cjs
// Purpose: adapt an H53.4-like positive irrigation recommendation into the existing approval request builder contract.
// Boundary: pure transformation only; no database access, network calls, fact writes, approval decisions, operation plans, AO-ACT tasks, receipts, acceptance, verification, ROI, or Field Memory.

function text(value) {
  return String(value ?? '').trim();
}

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function evidenceRefs(value) {
  if (!Array.isArray(value)) return [];
  return value.map(text).filter(Boolean);
}

function primitiveMap(value) {
  const source = asObject(value);
  const out = {};
  for (const [key, item] of Object.entries(source)) {
    if (!text(key)) continue;
    if (typeof item === 'number' && Number.isFinite(item)) out[key] = item;
    else if (typeof item === 'boolean') out[key] = item;
    else if (typeof item === 'string') out[key] = item;
  }
  return out;
}

function classifyAction(source) {
  const suggested = asObject(source.suggested_action || source.suggested_action_json);
  const actionType = text(suggested.action_type);
  const amountMm = number(suggested.amount_mm ?? suggested.water_mm ?? suggested.total_irrigation_mm);
  const effectiveAmountMm = number(suggested.effective_amount_mm ?? suggested.effective_water_mm ?? suggested.total_effective_irrigation_mm ?? amountMm);
  return { suggested, actionType, amountMm, effectiveAmountMm };
}

function reject(source, status, reason) {
  return {
    ok: false,
    adapter_status: status,
    reason,
    source_recommendation_id: text(source && source.recommendation_id),
    adapted_recommendation: null,
  };
}

function adaptH534PositiveIrrigationRecommendationV1(sourceInput, options = {}) {
  const source = asObject(sourceInput);
  const { suggested, actionType, amountMm, effectiveAmountMm } = classifyAction(source);
  const selectedOptionId = text(source.selected_scenario_option_id || suggested.selected_scenario_option_id || source.source_option_id);
  const recommendationId = text(source.recommendation_id || options.recommendation_id);
  const evidence = evidenceRefs(source.evidence_refs).length > 0 ? evidenceRefs(source.evidence_refs) : [`recommendation:${recommendationId}`].filter(Boolean);
  if (!recommendationId) return reject(source, 'REJECTED_INVALID_INPUT', 'MISSING_RECOMMENDATION_ID');
  if (source.human_approval_required !== true) return reject(source, 'REJECTED_NOT_HUMAN_APPROVAL_REQUIRED', 'HUMAN_APPROVAL_REQUIRED_MUST_BE_TRUE');
  if (source.no_direct_execution !== true) return reject(source, 'REJECTED_DIRECT_EXECUTION_FORBIDDEN', 'NO_DIRECT_EXECUTION_MUST_BE_TRUE');
  if (source.approval_created === true || source.operation_plan_created === true || source.task_created === true || source.dispatch_created === true || source.roi_created === true || source.field_memory_created === true) return reject(source, 'REJECTED_DOWNSTREAM_ALREADY_CREATED', 'DOWNSTREAM_ARTIFACT_ALREADY_CREATED');
  if (!['IRRIGATE', 'DELAYED_IRRIGATION'].includes(actionType)) return reject(source, 'REJECTED_NOT_ACTIONABLE_IRRIGATION', 'ACTION_TYPE_NOT_APPROVAL_ACTIONABLE');
  if (!Number.isFinite(amountMm) || amountMm <= 0) return reject(source, 'REJECTED_NOT_ACTIONABLE_IRRIGATION', 'IRRIGATION_AMOUNT_MUST_BE_POSITIVE');
  if (!Number.isFinite(effectiveAmountMm) || effectiveAmountMm < 0) return reject(source, 'REJECTED_NOT_ACTIONABLE_IRRIGATION', 'EFFECTIVE_IRRIGATION_AMOUNT_MUST_BE_NON_NEGATIVE');
  if (!selectedOptionId || selectedOptionId === 'NO_ACTION') return reject(source, 'REJECTED_NOT_ACTIONABLE_IRRIGATION', 'SOURCE_OPTION_MUST_BE_ACTIONABLE');
  const adapted = {
    ...source,
    recommendation_id: recommendationId,
    tenant_id: text(source.tenant_id),
    project_id: text(source.project_id),
    group_id: text(source.group_id),
    field_id: text(source.field_id),
    zone_id: source.zone_id === undefined || source.zone_id === null ? null : text(source.zone_id),
    season_id: source.season_id === undefined || source.season_id === null ? null : text(source.season_id),
    source: 'ROOT_ZONE_SCENARIO_SELECTION',
    source_option_id: selectedOptionId,
    source_submission_id: text(source.source_submission_id || source.source_scenario_set_id || suggested.source_scenario_set_id || options.source_submission_id),
    status: 'CANDIDATE',
    recommendation_status: source.recommendation_status || 'RECOMMENDED',
    recommendation_kind: 'IRRIGATION_CANDIDATE_FROM_SCENARIO',
    proposed_action: {
      action_type: actionType,
      total_irrigation_mm: amountMm,
      total_effective_irrigation_mm: effectiveAmountMm,
    },
    parameters: {
      ...primitiveMap(source.parameters),
      irrigation_mm: amountMm,
      effective_irrigation_mm: effectiveAmountMm,
      source_option_id: selectedOptionId,
    },
    constraints: primitiveMap(source.constraints),
    human_approval_required: true,
    no_direct_execution: true,
    approval_created: false,
    operation_plan_created: false,
    task_created: false,
    dispatch_created: false,
    roi_created: false,
    field_memory_created: false,
    adapter: {
      adapter_version: 'h54.2.v1',
      adapter_status: 'ADAPTED_TO_APPROVAL_REQUEST_CANDIDATE',
      source_schema: 'decision_recommendation_v1:h53.4-like',
      target_contract: 'recommendation_approval_request_builder_v1',
      no_direct_execution: true,
    },
    evidence_refs: evidence,
  };
  return {
    ok: true,
    adapter_status: 'ADAPTED_TO_APPROVAL_REQUEST_CANDIDATE',
    source_recommendation_id: recommendationId,
    adapted_recommendation: adapted,
  };
}

module.exports = { adaptH534PositiveIrrigationRecommendationV1 };
