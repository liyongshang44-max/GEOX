#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const CONFIG_PATH = path.join(ROOT, 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-T4R1-PERSISTENT-LIFECYCLE-QUALIFICATION-V1.json');
const OUT = path.join(ROOT, 'acceptance-output/MCFT_CAP_09_T4R1_PERSISTENT_LIFECYCLE_QUALIFICATION_RESULT.json');
const CONFIG = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
const SUBJECT_SHA = String(process.env.MCFT_SUBJECT_SHA || '').trim();
const DAY_MS = 24 * 60 * 60 * 1000;

const CURRENT_CROP = /\b(corn|maize|43-96P)\b/i;
const HYBRID = /\b43-96P\b/i;
const OTHER_CROP = /\b(soybean|soybeans|wheat|barley|sorghum|bean|beans|alfalfa|canola|rye)\b/i;
const TERMINATION = /\b(harvest(?:ed|ing)?\b(?!\s+international\b)|termination|terminate(?:d|s|ing)?|crop destruction|destroyed crop|crop failure|failed crop|abandonment|abandoned crop)\b/i;
const SUPPORT_TYPES = new Set(CONFIG.transition_sweep.support_observation_types.map((x) => x.toLowerCase()));

function assert(condition, code) {
  if (!condition) throw new Error(code);
}
function sha256(value) {
  return `sha256:${crypto.createHash('sha256').update(value).digest('hex')}`;
}
function normalize(value) {
  return String(value || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
}
function normalizeMultiline(value) {
  return String(value || '').replace(/\r/g, '').replace(/\u00a0/g, ' ');
}
function dateOnly(value) {
  const match = String(value || '').match(/\b(\d{4}-\d{2}-\d{2})\b/);
  return match ? match[1] : null;
}
function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
function safeError(error) {
  return (error instanceof Error ? error.message : String(error))
    .replace(/https?:\/\/[^\s]+/g, '[URL_REDACTED]');
}
function write(value) {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify(value));
}
async function digestPage(page, url, expectedHost, code = 'T4R1_PERSISTENT_PAGE') {
  const requested = new URL(url);
  assert(requested.protocol === 'https:' && requested.hostname === expectedHost, `${code}_UNAPPROVED_HOST`);
  const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 75_000 });
  assert(response?.ok(), `${code}_HTTP_${response?.status() ?? 'NO_RESPONSE'}`);
  const finalUrl = new URL(response.url());
  assert(finalUrl.protocol === 'https:' && finalUrl.hostname === expectedHost, `${code}_REDIRECT_HOST_FORBIDDEN`);
  const bytes = await response.body();
  return {
    response_sha256: sha256(bytes),
    response_bytes: bytes.byteLength,
    retrieved_at: new Date().toISOString(),
  };
}
async function observationIdFromRow(row) {
  const hrefs = row.locator('a[href*="/observations/"]');
  for (let i = 0; i < await hrefs.count(); i += 1) {
    const href = await hrefs.nth(i).getAttribute('href');
    const match = String(href || '').match(/\/observations\/(\d+)/);
    if (match) return Number(match[1]);
  }
  return null;
}
function uniqueById(items) {
  return [...new Map(items.map((item) => [item.provider_observation_id, item])).values()]
    .sort((a, b) => a.observation_date.localeCompare(b.observation_date) || a.provider_observation_id - b.provider_observation_id);
}
function latestPossiblePlantingMs() {
  const endExclusive = Date.parse(CONFIG.candidate_scope.possible_planting_window_utc.end_exclusive);
  assert(Number.isFinite(endExclusive), 'T4R1_PERSISTENT_PLANTING_END_INVALID');
  return endExclusive - 1;
}
function horizonEndIso() {
  return new Date(latestPossiblePlantingMs() + CONFIG.horizon_policy.maximum_total_days * DAY_MS).toISOString();
}
function hasStandaloneT4(value) {
  return /(?:^|[\s,;/()])T4(?:$|[\s,;/()])/i.test(normalize(value));
}
function hasExactT4R1(value) {
  return /\bT4R1\b/i.test(normalize(value));
}
function hasLterT4(value) {
  return /\bLTER\s+T4\b/i.test(normalize(value));
}
function r1Explicit(value) {
  const text = normalize(value);
  return /replications?\s*(?:in\s+the\s+order\s+of\s*)?\([^)]*\b1\b[^)]*\)/i.test(text)
    || /\breps?\b[^.]{0,220}\b1\b/i.test(text)
    || /\bT4R1\b/i.test(text);
}
function indexT4LeadScope(areas, comment) {
  return hasStandaloneT4(areas) || hasExactT4R1(areas) || hasLterT4(comment);
}
function localDateAt(instant, timeZone) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(instant);
  const values = Object.fromEntries(parts.filter((p) => p.type !== 'literal').map((p) => [p.type, p.value]));
  return `${values.year}-${values.month}-${values.day}`;
}
function findLabel(text, label, from = 0) {
  const regex = new RegExp(`(?:^|\\n)\\s*${escapeRegex(label)}\\s*(?:\\n|$)`, 'ig');
  regex.lastIndex = from;
  return regex.exec(text);
}
function extractSection(text, startLabel, endLabels, code) {
  const start = findLabel(text, startLabel, 0);
  assert(start, `${code}_${normalize(startLabel).replace(/[^A-Za-z0-9]+/g, '_').toUpperCase()}_LABEL_REQUIRED`);
  const contentStart = start.index + start[0].length;
  let contentEnd = text.length;
  for (const endLabel of endLabels) {
    const match = findLabel(text, endLabel, contentStart);
    if (match && match.index < contentEnd) contentEnd = match.index;
  }
  const value = normalize(text.slice(contentStart, contentEnd));
  assert(value.length > 0, `${code}_${normalize(startLabel).replace(/[^A-Za-z0-9]+/g, '_').toUpperCase()}_VALUE_REQUIRED`);
  return value;
}
async function extractObservationDetail(page, lead) {
  const raw = normalizeMultiline(await page.locator('body').innerText());
  const labels = CONFIG.transition_sweep.detail_field_contract;
  const comment = extractSection(raw, labels.comment_label, [labels.areas_label], 'T4R1_PERSISTENT_DETAIL');
  const areas = extractSection(raw, labels.areas_label, [labels.observation_type_label], 'T4R1_PERSISTENT_DETAIL');
  const observationType = extractSection(raw, labels.observation_type_label, [labels.activities_label], 'T4R1_PERSISTENT_DETAIL');
  const detailDateMatch = raw.match(/(?:^|\n)\s*Observation Date\s+(\d{4}-\d{2}-\d{2})\b/i);
  assert(detailDateMatch, 'T4R1_PERSISTENT_DETAIL_DATE_REQUIRED');
  const detailDate = detailDateMatch[1];
  assert(detailDate === lead.observation_date, `T4R1_PERSISTENT_INDEX_DETAIL_DATE_MISMATCH:${lead.provider_observation_id}`);
  assert(normalize(observationType).toLowerCase() === normalize(lead.observation_type).toLowerCase(), `T4R1_PERSISTENT_INDEX_DETAIL_TYPE_MISMATCH:${lead.provider_observation_id}`);
  return { observation_date: detailDate, comment, areas, observation_type: observationType };
}
function t4r1Applicability(detail) {
  if (hasExactT4R1(detail.areas)) return { applies: true, basis: 'EXACT_T4R1_DETAIL_AREA' };
  if (hasStandaloneT4(detail.areas) && r1Explicit(detail.comment)) return { applies: true, basis: 'PARENT_T4_AREA_PLUS_EXPLICIT_R1_COMMENT' };
  if (hasLterT4(detail.comment) && r1Explicit(detail.comment)) return { applies: true, basis: 'EXPLICIT_LTER_T4_PLUS_EXPLICIT_R1_COMMENT' };
  return { applies: false, basis: 'NO_EXACT_T4R1_APPLICABILITY' };
}

async function main() {
  assert(/^[0-9a-f]{40}$/.test(SUBJECT_SHA), 'T4R1_PERSISTENT_EXACT_SUBJECT_REQUIRED');
  assert(CONFIG.frontier === 'T4R1_CURRENT_SEASON_PERSISTENT_LIFECYCLE_QUALIFICATION', 'T4R1_PERSISTENT_FRONTIER_MISMATCH');
  assert(CONFIG.persistent_state_policy.provider_silence_used_as_evidence === false, 'T4R1_PERSISTENT_SILENCE_EVIDENCE_FORBIDDEN');
  assert(CONFIG.persistent_state_policy.provider_retrieval_time_used_as_coverage_watermark === false, 'T4R1_PERSISTENT_RETRIEVAL_WATERMARK_FORBIDDEN');
  assert(CONFIG.horizon_policy.horizon_may_create_active === false, 'T4R1_PERSISTENT_HORIZON_CREATE_ACTIVE_FORBIDDEN');
  assert(CONFIG.horizon_policy.support_event_may_renew_horizon === false, 'T4R1_PERSISTENT_SUPPORT_RENEWAL_FORBIDDEN');
  assert(CONFIG.transition_sweep.detail_field_contract.whole_page_body_semantic_classification_forbidden === true, 'T4R1_PERSISTENT_WHOLE_BODY_SEMANTICS_FORBIDDEN');
  assert(r1Explicit('all replications in the order of (5, 3, 4, 2, 1, and 6)'), 'T4R1_PERSISTENT_R1_ORDER_POSITIVE_CONTROL_FAILED');
  assert(!r1Explicit('T4R2 only'), 'T4R1_PERSISTENT_R2_NEGATIVE_CONTROL_FAILED');
  assert(!TERMINATION.test('JD 7330 tractor and Harvest International planter'), 'T4R1_PERSISTENT_EQUIPMENT_BRAND_NEGATIVE_CONTROL_FAILED');
  assert(TERMINATION.test('Corn was harvested from T4R1'), 'T4R1_PERSISTENT_HARVEST_POSITIVE_CONTROL_FAILED');

  const computedHorizonEnd = horizonEndIso();
  assert(computedHorizonEnd === CONFIG.horizon_policy.expected_horizon_end_utc, `T4R1_PERSISTENT_HORIZON_MISMATCH:${computedHorizonEnd}`);

  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ userAgent: 'GEOX-MCFT-CAP09-T4R1-Persistent-Lifecycle/1.0' });
    const page = await context.newPage();

    const establishmentPageProof = await digestPage(page, CONFIG.establishment_source.url, CONFIG.establishment_source.allowed_host, 'T4R1_PERSISTENT_ESTABLISHMENT');
    const establishmentText = normalize(await page.locator('body').innerText());
    for (const marker of CONFIG.establishment_source.required_normalized_markers) {
      assert(establishmentText.toLowerCase().includes(marker.toLowerCase()), `T4R1_PERSISTENT_ESTABLISHMENT_MARKER_MISSING:${marker}`);
    }

    const targetDate = CONFIG.candidate_scope.planting_local_date;
    const indexProofs = [];
    const leads = [];
    let reachedPlantingDate = false;
    let scannedRows = 0;

    for (let pageNumber = 1; pageNumber <= CONFIG.transition_sweep.maximum_pages; pageNumber += 1) {
      const url = pageNumber === 1 ? CONFIG.transition_sweep.index_url : `${CONFIG.transition_sweep.index_url}?page=${pageNumber}`;
      const proof = await digestPage(page, url, CONFIG.transition_sweep.allowed_host, 'T4R1_PERSISTENT_INDEX');
      const rows = page.locator('table tr');
      const rowCount = await rows.count();
      let parsedRows = 0;
      let minimumDate = null;
      let maximumDate = null;

      for (let rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
        const row = rows.nth(rowIndex);
        const cells = row.locator('td');
        const cellCount = await cells.count();
        if (cellCount < 6) continue;
        const values = [];
        for (let c = 0; c < cellCount; c += 1) values.push(normalize(await cells.nth(c).innerText()));
        const observationDate = dateOnly(values[0]);
        if (!observationDate) continue;
        parsedRows += 1;
        scannedRows += 1;
        minimumDate = !minimumDate || observationDate < minimumDate ? observationDate : minimumDate;
        maximumDate = !maximumDate || observationDate > maximumDate ? observationDate : maximumDate;
        // A local date may span two adjacent index pages. Do not stop on a
        // page whose minimum merely equals the planting date; cross strictly
        // earlier so every planting-day row is included.
        if (observationDate < targetDate) {
          reachedPlantingDate = true;
          continue;
        }

        const observationType = values[2] || '';
        const comment = values[3] || '';
        const areas = values[4] || '';
        if (!indexT4LeadScope(areas, comment)) continue;
        const observationId = await observationIdFromRow(row);
        assert(Number.isInteger(observationId), 'T4R1_PERSISTENT_OBSERVATION_ID_REQUIRED');
        leads.push({
          provider_observation_id: observationId,
          observation_date: observationDate,
          observation_type: observationType,
          index_comment_sha256: sha256(comment),
          index_areas_sha256: sha256(areas),
          index_candidate_scope_basis: hasExactT4R1(areas)
            ? 'EXACT_T4R1_INDEX_AREA'
            : hasStandaloneT4(areas)
              ? 'PARENT_T4_INDEX_AREA'
              : 'EXPLICIT_LTER_T4_INDEX_COMMENT',
        });
      }

      indexProofs.push({
        page_number: pageNumber,
        parsed_observation_row_count: parsedRows,
        minimum_observation_date: minimumDate,
        maximum_observation_date: maximumDate,
        provider_body_emitted: false,
        ...proof,
      });
      if (reachedPlantingDate) break;
      assert(parsedRows > 0, `T4R1_PERSISTENT_EMPTY_PAGE_BEFORE_PLANTING:${pageNumber}`);
    }

    assert(reachedPlantingDate, 'T4R1_PERSISTENT_SCAN_DID_NOT_REACH_PLANTING_DATE');
    const uniqueLeads = uniqueById(leads);
    assert(uniqueLeads.length > 0 && uniqueLeads.length <= CONFIG.transition_sweep.maximum_detail_candidates, `T4R1_PERSISTENT_DETAIL_COUNT_${uniqueLeads.length}`);

    const inspections = [];
    for (const lead of uniqueLeads) {
      const proof = await digestPage(page, `${CONFIG.transition_sweep.index_url}/${lead.provider_observation_id}`, CONFIG.transition_sweep.allowed_host, 'T4R1_PERSISTENT_DETAIL');
      const detail = await extractObservationDetail(page, lead);
      const scope = t4r1Applicability(detail);
      const semanticText = `${detail.observation_type} ${detail.comment}`;
      inspections.push({
        provider_observation_id: lead.provider_observation_id,
        observation_date: detail.observation_date,
        observation_type: detail.observation_type,
        detail_field_contract_verified: true,
        t4r1_applicable: scope.applies,
        t4r1_scope_basis: scope.basis,
        comment_sha256: sha256(detail.comment),
        areas_sha256: sha256(detail.areas),
        current_crop_bound: CURRENT_CROP.test(detail.comment),
        hybrid_bound: HYBRID.test(detail.comment),
        other_crop_mentioned: OTHER_CROP.test(detail.comment),
        termination_semantic: TERMINATION.test(semanticText),
        planting_semantic: /\bPlanting\b/i.test(detail.observation_type),
        support_semantic: SUPPORT_TYPES.has(detail.observation_type.toLowerCase()),
        explicit_r1_in_comment: r1Explicit(detail.comment),
        comment_emitted: false,
        areas_emitted: false,
        provider_body_emitted: false,
        ...proof,
      });
    }

    const plantingMatches = inspections.filter((item) => item.provider_observation_id === CONFIG.establishment_source.expected_observation_id
      && item.observation_date === targetDate
      && item.planting_semantic
      && item.t4r1_applicable
      && item.current_crop_bound
      && item.hybrid_bound);
    assert(plantingMatches.length === 1, `T4R1_PERSISTENT_EXACT_PLANTING_MATCH_COUNT_${plantingMatches.length}`);
    const planting = plantingMatches[0];
    assert(planting.termination_semantic === false, 'T4R1_PERSISTENT_ESTABLISHMENT_TERMINATION_SEMANTIC_CONTAMINATION');

    const applicable = inspections.filter((item) => item.t4r1_applicable);
    const sameDayOtherTransitions = applicable.filter((item) => item.observation_date === targetDate
      && item.provider_observation_id !== planting.provider_observation_id
      && (item.termination_semantic || item.planting_semantic));
    const postPlanting = applicable.filter((item) => item.observation_date > targetDate);
    const knownTerminations = postPlanting.filter((item) => item.termination_semantic
      && item.current_crop_bound
      && !item.other_crop_mentioned);
    const ambiguousTerminationCandidates = postPlanting.filter((item) => item.termination_semantic
      && (!item.current_crop_bound || item.other_crop_mentioned));
    const plantingConflicts = postPlanting.filter((item) => item.planting_semantic);
    const explicitCropConflicts = postPlanting.filter((item) => item.other_crop_mentioned
      && (item.planting_semantic || item.termination_semantic));
    const conflictMap = new Map();
    for (const item of [...sameDayOtherTransitions, ...plantingConflicts, ...explicitCropConflicts, ...ambiguousTerminationCandidates]) {
      conflictMap.set(item.provider_observation_id, item);
    }
    const contradictions = [...conflictMap.values()].sort((a, b) => a.observation_date.localeCompare(b.observation_date) || a.provider_observation_id - b.provider_observation_id);
    const supportEvents = postPlanting.filter((item) => item.support_semantic && !item.termination_semantic);
    const lastSupport = supportEvents.length ? supportEvents.at(-1) : null;

    const stateEvaluationTime = new Date();
    const authorityEvaluatedAt = new Date();
    const evaluationLocalDate = localDateAt(stateEvaluationTime, CONFIG.candidate_scope.timezone);
    const sameEvaluationDayUncertainTransitions = applicable.filter((item) => item.observation_date === evaluationLocalDate
      && (item.termination_semantic || item.planting_semantic)
      && item.provider_observation_id !== planting.provider_observation_id);
    for (const item of sameEvaluationDayUncertainTransitions) conflictMap.set(item.provider_observation_id, item);
    const finalContradictions = [...conflictMap.values()].sort((a, b) => a.observation_date.localeCompare(b.observation_date) || a.provider_observation_id - b.provider_observation_id);

    const horizonEndMs = Date.parse(computedHorizonEnd);
    assert(Number.isFinite(horizonEndMs), 'T4R1_PERSISTENT_HORIZON_END_INVALID');

    let domainState = 'ACTIVE';
    let authorityStatus = 'RESOLVED';
    let authorityValidity = 'VALID';
    let authorityMode = 'GOVERNED_PERSISTENT_STATE';
    let qualificationOutcome = 'ACTIVE_CANDIDATE';
    let terminationEvent = null;

    if (knownTerminations.length > 0) {
      terminationEvent = knownTerminations[0];
      domainState = 'TERMINATED';
      authorityStatus = 'RESOLVED';
      authorityMode = 'DIRECT_EVENT';
      qualificationOutcome = 'TERMINATED';
    } else if (finalContradictions.length > 0) {
      authorityStatus = 'CONFLICTED';
      qualificationOutcome = 'CONFLICTED';
    } else if (stateEvaluationTime.getTime() > horizonEndMs) {
      authorityStatus = 'UNRESOLVED';
      authorityValidity = 'EXPIRED';
      qualificationOutcome = 'EXPIRED';
    }

    const activeConsumableCandidate = domainState === 'ACTIVE'
      && authorityStatus === 'RESOLVED'
      && authorityValidity === 'VALID';

    const result = {
      schema_version: 'geox_mcft_cap09_t4r1_persistent_lifecycle_qualification_result_v1',
      status: 'PASS',
      subject_sha: SUBJECT_SHA,
      qualification_outcome: qualificationOutcome,
      authority_effect: 'STACKED_CANDIDATE_NONE_UNTIL_AMENDMENT_16_EFFECTIVE_ON_PROTECTED_MAIN_AND_EXACT_MAIN_RERUN',
      represented_scope: CONFIG.candidate_scope,
      state_evaluation_time: stateEvaluationTime.toISOString(),
      authority_evaluated_at: authorityEvaluatedAt.toISOString(),
      lifecycle_establishment: {
        status: 'RESOLVED_CANDIDATE',
        provider: 'KBS_AGLOG',
        provider_observation_id: planting.provider_observation_id,
        event_time_precision: CONFIG.candidate_scope.planting_event_time_precision,
        possible_event_window_utc: CONFIG.candidate_scope.possible_planting_window_utc,
        available_to_runtime_at: planting.retrieved_at,
        materials_page_available_to_runtime_at: establishmentPageProof.retrieved_at,
        crop: CONFIG.candidate_scope.crop,
        hybrid_product_code: CONFIG.candidate_scope.hybrid_product_code,
        t4r1_scope_basis: planting.t4r1_scope_basis,
        provider_body_emitted: false,
      },
      transition_sweep: {
        provider: CONFIG.transition_sweep.provider,
        scanned_index_page_count: indexProofs.length,
        scanned_observation_row_count: scannedRows,
        scan_reached_planting_date: reachedPlantingDate,
        t4_detail_candidate_count: uniqueLeads.length,
        t4r1_applicable_detail_count: applicable.length,
        structured_detail_fields_consumed: ['Comment', 'Areas', 'Observation Type'],
        whole_page_body_semantic_classification_used: false,
        index_detail_date_agreement_required: true,
        index_detail_observation_type_agreement_required: true,
        known_termination_result: knownTerminations.length === 0 ? 'NONE_FOUND' : 'FOUND',
        known_termination_count: knownTerminations.length,
        ambiguous_termination_candidate_count: ambiguousTerminationCandidates.length,
        same_day_transition_ambiguity_count: sameDayOtherTransitions.length,
        same_evaluation_day_transition_ambiguity_count: sameEvaluationDayUncertainTransitions.length,
        known_contradiction_result: finalContradictions.length === 0 ? 'NONE_FOUND' : 'FOUND',
        known_contradiction_count: finalContradictions.length,
        provider_coverage_completeness_proven: false,
        proved_no_termination_occurred: false,
        provider_silence_used_as_evidence: false,
        provider_retrieval_time_used_as_coverage_watermark: false,
        page_proofs: indexProofs,
        detail_inspections: inspections,
        provider_body_emitted: false,
        provider_payload_persisted_or_uploaded: false,
      },
      continuity_support: lastSupport ? {
        role: 'IN_SEASON_CONTINUITY_SUPPORT',
        provider_observation_id: lastSupport.provider_observation_id,
        observation_date: lastSupport.observation_date,
        observation_type: lastSupport.observation_type,
        available_to_runtime_at: lastSupport.retrieved_at,
        refreshes_direct_biological_observation: false,
        renews_lifecycle_horizon: false,
      } : null,
      lifecycle_horizon: {
        authority_source: CONFIG.horizon_policy.authority_source,
        algorithm: CONFIG.horizon_policy.algorithm,
        maximum_total_days: CONFIG.horizon_policy.maximum_total_days,
        latest_possible_planting_instant_utc: new Date(latestPossiblePlantingMs()).toISOString(),
        horizon_end_utc: computedHorizonEnd,
        valid_at_evaluation_time: stateEvaluationTime.getTime() <= horizonEndMs,
        creates_active: false,
        truncation_only: true,
        support_event_renewal_used: false,
      },
      season_lifecycle: {
        domain_state: domainState,
        authority_status: authorityStatus,
        authority_validity: authorityValidity,
        authority_mode: authorityMode,
        active_consumable_candidate: activeConsumableCandidate,
        termination_event_id: terminationEvent?.provider_observation_id ?? null,
        termination_event_date: terminationEvent?.observation_date ?? null,
        termination_event_time_precision: terminationEvent ? 'LOCAL_CALENDAR_DAY_ONLY' : null,
        termination_available_to_runtime_at: terminationEvent?.retrieved_at ?? null,
        latest_direct_biological_observation_at: null,
        observation_freshness_refreshed_by_persistence: false,
        evaluated_at_emitted_as_observed_at: false,
      },
      amendment_16_effectiveness: {
        predecessor_subject_sha: CONFIG.exact_predecessor_sha,
        amendment_16_effective_on_protected_main_for_this_stacked_run: false,
        current_result_may_be_adopted_as_protected_main_authority: false,
        exact_main_rerun_required_after_effectiveness: true,
      },
      runtime_write_count: 0,
      database_write_count: 0,
      scheduler_write_count: 0,
      formal_evidence_write_count: 0,
      ea5e2_operational_activation_qualified: false,
      formal_window_started: false,
      formal_execution_count: '0/24',
      next_frontier: qualificationOutcome === 'ACTIVE_CANDIDATE'
        ? CONFIG.next_frontier_on_candidate_active
        : qualificationOutcome === 'TERMINATED'
          ? CONFIG.next_frontier_on_termination
          : qualificationOutcome === 'CONFLICTED'
            ? CONFIG.next_frontier_on_conflict
            : CONFIG.next_frontier_on_horizon_expiry,
    };

    write(result);
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  write({
    schema_version: 'geox_mcft_cap09_t4r1_persistent_lifecycle_qualification_result_v1',
    status: 'FAIL',
    subject_sha: SUBJECT_SHA || null,
    authority_effect: 'NONE',
    runtime_write_count: 0,
    database_write_count: 0,
    scheduler_write_count: 0,
    formal_evidence_write_count: 0,
    ea5e2_operational_activation_qualified: false,
    formal_window_started: false,
    formal_execution_count: '0/24',
    error: safeError(error),
  });
  process.exitCode = 1;
});
