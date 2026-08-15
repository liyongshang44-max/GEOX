#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const CONFIG_PATH = path.join(ROOT, 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-T3R1-PERSISTENT-LIFECYCLE-QUALIFICATION-V1.json');
const OUT = path.join(ROOT, 'acceptance-output/MCFT_CAP_09_T3R1_PERSISTENT_LIFECYCLE_QUALIFICATION_RESULT.json');
const CONFIG = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
const SUBJECT_SHA = String(process.env.MCFT_SUBJECT_SHA || '').trim();
const DAY_MS = 24 * 60 * 60 * 1000;

const CURRENT_CROP = /\b(corn|maize|P0306Q)\b/i;
const HYBRID = /\bP0306Q\b/i;
const OTHER_CROP = /\b(soybean|soybeans|wheat|barley|sorghum|bean|beans|alfalfa|canola|rye)\b/i;
const TERMINATION = /\b(harvest(?:ed|ing)?|termination|terminate(?:d|s|ing)?|crop destruction|destroyed crop|crop failure|failed crop|abandonment|abandoned crop)\b/i;

function assert(condition, code) {
  if (!condition) throw new Error(code);
}
function sha256(value) {
  return `sha256:${crypto.createHash('sha256').update(value).digest('hex')}`;
}
function normalize(value) {
  return String(value || '').replace(/^\uFEFF/, '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
}
function normalizeKey(value) {
  return normalize(value).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}
function dateOnly(value) {
  const match = String(value || '').match(/\b(\d{4}-\d{2}-\d{2})\b/);
  return match ? match[1] : null;
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
function parseDelimitedLine(line, delimiter) {
  const out = [];
  let value = '';
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') {
        value += '"';
        i += 1;
      } else quoted = !quoted;
    } else if (ch === delimiter && !quoted) {
      out.push(value);
      value = '';
    } else value += ch;
  }
  out.push(value);
  return out;
}
function parseTable(text, requiredColumns) {
  const lines = String(text).split(/\r?\n/);
  for (let i = 0; i < Math.min(lines.length, 40); i += 1) {
    if (!lines[i].trim()) continue;
    for (const delimiter of [',', '\t', ';', '|']) {
      const headers = parseDelimitedLine(lines[i], delimiter).map(normalizeKey);
      if (!requiredColumns.every((column) => headers.includes(column))) continue;
      const rows = [];
      for (const line of lines.slice(i + 1)) {
        if (!line.trim() || line.trim().startsWith('#')) continue;
        const cells = parseDelimitedLine(line, delimiter);
        if (cells.length < headers.length) continue;
        const row = {};
        headers.forEach((header, index) => { row[header] = cells[index] ?? ''; });
        rows.push(row);
      }
      return rows;
    }
  }
  throw new Error('T3R1_PERSISTENT_EXPANDED_LOG_HEADER_REQUIRED');
}
async function digestPage(page, url, expectedHost) {
  const requested = new URL(url);
  assert(requested.protocol === 'https:' && requested.hostname === expectedHost, 'T3R1_PERSISTENT_UNAPPROVED_ESTABLISHMENT_HOST');
  const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 75_000 });
  assert(response?.ok(), `T3R1_PERSISTENT_ESTABLISHMENT_HTTP_${response?.status() ?? 'NO_RESPONSE'}`);
  const finalUrl = new URL(response.url());
  assert(finalUrl.protocol === 'https:' && finalUrl.hostname === expectedHost, 'T3R1_PERSISTENT_ESTABLISHMENT_REDIRECT_HOST_FORBIDDEN');
  const bytes = await response.body();
  return {
    response_sha256: sha256(bytes),
    response_bytes: bytes.byteLength,
    retrieved_at: new Date().toISOString(),
  };
}
async function fetchBytes(url, expectedHost, expectedPath, code) {
  const requested = new URL(url);
  assert(requested.protocol === 'https:' && requested.hostname === expectedHost && requested.pathname === expectedPath, `${code}_URL_FORBIDDEN`);
  const response = await fetch(url, {
    method: 'GET',
    redirect: 'follow',
    headers: { 'user-agent': 'GEOX-MCFT-CAP09-T3R1-Persistent-Lifecycle/1.0' },
  });
  assert(response.ok, `${code}_HTTP_${response.status}`);
  const finalUrl = new URL(response.url);
  assert(finalUrl.protocol === 'https:' && finalUrl.hostname === expectedHost && finalUrl.pathname === expectedPath, `${code}_REDIRECT_FORBIDDEN`);
  const bytes = Buffer.from(await response.arrayBuffer());
  assert(bytes.byteLength > 0 && bytes.byteLength < 50_000_000, `${code}_BYTE_SIZE_INVALID`);
  return { bytes, response_sha256: sha256(bytes), response_bytes: bytes.byteLength, retrieved_at: new Date().toISOString() };
}
function latestPossiblePlantingMs() {
  const endExclusive = Date.parse(CONFIG.candidate_scope.possible_planting_window_utc.end_exclusive);
  assert(Number.isFinite(endExclusive), 'T3R1_PERSISTENT_PLANTING_END_INVALID');
  return endExclusive - 1;
}
function horizonEndIso() {
  return new Date(latestPossiblePlantingMs() + CONFIG.horizon_policy.maximum_total_days * DAY_MS).toISOString();
}
function laterIso(a, b) {
  const aMs = Date.parse(a);
  const bMs = Date.parse(b);
  assert(Number.isFinite(aMs) && Number.isFinite(bMs), 'T3R1_PERSISTENT_AVAILABILITY_TIME_INVALID');
  return new Date(Math.max(aMs, bMs)).toISOString();
}
function observationTypeSupports(type) {
  const normalized = normalize(type).toLowerCase();
  return CONFIG.transition_sweep.support_observation_types.some((candidate) => normalized.includes(candidate.toLowerCase()));
}
function buildExactT3R1Events(rows) {
  const scoped = rows.filter((row) => normalize(row.treatment).toUpperCase() === CONFIG.transition_sweep.exact_treatment
    && normalize(row.name).toUpperCase() === CONFIG.transition_sweep.exact_plot_name
    && dateOnly(row.obs_date));
  const grouped = new Map();
  for (const row of scoped) {
    const observationId = Number.parseInt(normalize(row.observation_id), 10);
    assert(Number.isInteger(observationId) && observationId > 0, 'T3R1_PERSISTENT_EXPANDED_LOG_OBSERVATION_ID_REQUIRED');
    const observationDate = dateOnly(row.obs_date);
    const observationType = normalize(row.observation_type);
    const comment = normalize(row.comment);
    assert(observationDate && observationType, `T3R1_PERSISTENT_EXPANDED_LOG_EVENT_FIELDS_REQUIRED:${observationId}`);
    const existing = grouped.get(observationId);
    if (!existing) {
      grouped.set(observationId, {
        provider_observation_id: observationId,
        observation_date: observationDate,
        observation_type: observationType,
        treatment: normalize(row.treatment),
        plot_name: normalize(row.name),
        comment,
        comment_sha256: sha256(comment),
        source_row_count: 1,
      });
      continue;
    }
    assert(existing.observation_date === observationDate, `T3R1_PERSISTENT_DUPLICATE_DATE_CONFLICT:${observationId}`);
    assert(existing.observation_type === observationType, `T3R1_PERSISTENT_DUPLICATE_TYPE_CONFLICT:${observationId}`);
    assert(existing.comment === comment, `T3R1_PERSISTENT_DUPLICATE_COMMENT_CONFLICT:${observationId}`);
    existing.source_row_count += 1;
  }
  return [...grouped.values()].sort((a, b) => a.observation_date.localeCompare(b.observation_date) || a.provider_observation_id - b.provider_observation_id);
}

async function main() {
  assert(/^[0-9a-f]{40}$/.test(SUBJECT_SHA), 'T3R1_PERSISTENT_EXACT_SUBJECT_REQUIRED');
  assert(CONFIG.frontier === 'T3R1_CURRENT_SEASON_PERSISTENT_LIFECYCLE_QUALIFICATION', 'T3R1_PERSISTENT_FRONTIER_MISMATCH');
  assert(CONFIG.persistent_state_policy.provider_silence_used_as_evidence === false, 'T3R1_PERSISTENT_SILENCE_EVIDENCE_FORBIDDEN');
  assert(CONFIG.persistent_state_policy.provider_retrieval_time_used_as_coverage_watermark === false, 'T3R1_PERSISTENT_RETRIEVAL_WATERMARK_FORBIDDEN');
  assert(CONFIG.horizon_policy.horizon_may_create_active === false, 'T3R1_PERSISTENT_HORIZON_CREATE_ACTIVE_FORBIDDEN');
  assert(CONFIG.horizon_policy.support_event_may_renew_horizon === false, 'T3R1_PERSISTENT_SUPPORT_RENEWAL_FORBIDDEN');

  const computedHorizonEnd = horizonEndIso();
  assert(computedHorizonEnd === CONFIG.horizon_policy.expected_horizon_end_utc, `T3R1_PERSISTENT_HORIZON_MISMATCH:${computedHorizonEnd}`);

  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ userAgent: 'GEOX-MCFT-CAP09-T3R1-Persistent-Lifecycle/1.0' });
    const page = await context.newPage();

    const establishmentPageProof = await digestPage(page, CONFIG.establishment_source.url, CONFIG.establishment_source.allowed_host);
    const establishmentText = normalize(await page.locator('body').innerText());
    for (const marker of CONFIG.establishment_source.required_normalized_markers) {
      assert(establishmentText.toLowerCase().includes(marker.toLowerCase()), `T3R1_PERSISTENT_ESTABLISHMENT_MARKER_MISSING:${marker}`);
    }

    const transitionSource = CONFIG.transition_sweep;
    const expandedLog = await fetchBytes(
      transitionSource.download_url,
      transitionSource.allowed_host,
      `/datatables/${transitionSource.datatable_id}.csv`,
      'T3R1_PERSISTENT_EXPANDED_LOG',
    );
    const rows = parseTable(expandedLog.bytes.toString('utf8'), transitionSource.required_columns);
    assert(rows.length > 0, 'T3R1_PERSISTENT_EXPANDED_LOG_ROWS_REQUIRED');
    const exactEvents = buildExactT3R1Events(rows);
    assert(exactEvents.length > 0, 'T3R1_PERSISTENT_EXACT_T3R1_EVENTS_REQUIRED');

    const targetDate = CONFIG.candidate_scope.planting_local_date;
    const plantingMatches = exactEvents.filter((event) => event.provider_observation_id === CONFIG.establishment_source.expected_observation_id
      && event.observation_date === targetDate
      && /\bPlanting\b/i.test(event.observation_type)
      && CURRENT_CROP.test(event.comment)
      && HYBRID.test(event.comment));
    assert(plantingMatches.length === 1, `T3R1_PERSISTENT_EXACT_PLANTING_MATCH_COUNT_${plantingMatches.length}`);
    const planting = plantingMatches[0];
    assert(!TERMINATION.test(`${planting.observation_type} ${planting.comment}`), 'T3R1_PERSISTENT_ESTABLISHMENT_TERMINATION_SEMANTIC_CONTAMINATION');

    const onOrAfterPlanting = exactEvents.filter((event) => event.observation_date >= targetDate);
    const classified = onOrAfterPlanting.map((event) => {
      const semanticText = `${event.observation_type} ${event.comment}`;
      return {
        ...event,
        current_crop_bound: CURRENT_CROP.test(event.comment),
        hybrid_bound: HYBRID.test(event.comment),
        other_crop_mentioned: OTHER_CROP.test(event.comment),
        termination_semantic: TERMINATION.test(semanticText),
        planting_semantic: /\bPlanting\b/i.test(event.observation_type),
        support_semantic: observationTypeSupports(event.observation_type),
        post_establishment_date: event.observation_date > targetDate,
        same_establishment_date: event.observation_date === targetDate,
      };
    });

    const postPlanting = classified.filter((event) => event.post_establishment_date);
    const sameDayOtherTransitions = classified.filter((event) => event.same_establishment_date
      && event.provider_observation_id !== planting.provider_observation_id
      && (event.termination_semantic || event.planting_semantic));
    const knownTerminations = postPlanting.filter((event) => event.termination_semantic
      && event.current_crop_bound
      && !event.other_crop_mentioned);
    const ambiguousTerminationCandidates = postPlanting.filter((event) => event.termination_semantic
      && (!event.current_crop_bound || event.other_crop_mentioned));
    const plantingConflicts = postPlanting.filter((event) => event.planting_semantic);
    const explicitCropConflicts = postPlanting.filter((event) => event.other_crop_mentioned
      && (event.planting_semantic || event.termination_semantic));
    const conflictMap = new Map();
    for (const event of [...sameDayOtherTransitions, ...plantingConflicts, ...explicitCropConflicts, ...ambiguousTerminationCandidates]) {
      conflictMap.set(event.provider_observation_id, event);
    }
    const contradictions = [...conflictMap.values()].sort((a, b) => a.observation_date.localeCompare(b.observation_date) || a.provider_observation_id - b.provider_observation_id);
    const supportEvents = postPlanting.filter((event) => event.support_semantic && !event.termination_semantic);
    const lastSupport = supportEvents.length ? supportEvents.at(-1) : null;

    const stateEvaluationTime = new Date();
    const authorityEvaluatedAt = new Date();
    const horizonEndMs = Date.parse(computedHorizonEnd);
    assert(Number.isFinite(horizonEndMs), 'T3R1_PERSISTENT_HORIZON_END_INVALID');

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
    } else if (contradictions.length > 0) {
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
    const establishmentAvailableAt = laterIso(establishmentPageProof.retrieved_at, expandedLog.retrieved_at);

    const sanitizedEvents = classified.map((event) => ({
      provider_observation_id: event.provider_observation_id,
      observation_date: event.observation_date,
      observation_type: event.observation_type,
      treatment: event.treatment,
      plot_name: event.plot_name,
      comment_sha256: event.comment_sha256,
      source_row_count: event.source_row_count,
      current_crop_bound: event.current_crop_bound,
      hybrid_bound: event.hybrid_bound,
      other_crop_mentioned: event.other_crop_mentioned,
      termination_semantic: event.termination_semantic,
      planting_semantic: event.planting_semantic,
      support_semantic: event.support_semantic,
      comment_emitted: false,
    }));

    write({
      schema_version: 'geox_mcft_cap09_t3r1_persistent_lifecycle_qualification_result_v1',
      status: 'PASS',
      subject_sha: SUBJECT_SHA,
      qualification_outcome: qualificationOutcome,
      authority_effect: 'STACKED_CANDIDATE_NONE_UNTIL_AMENDMENT_16_EFFECTIVE_ON_PROTECTED_MAIN_AND_EXACT_MAIN_RERUN',
      represented_scope: CONFIG.candidate_scope,
      state_evaluation_time: stateEvaluationTime.toISOString(),
      authority_evaluated_at: authorityEvaluatedAt.toISOString(),
      lifecycle_establishment: {
        status: 'RESOLVED_CANDIDATE',
        provider: 'KBS_AGLOG_AND_KBS_LTER_CORE_EXPANDED_AGRONOMIC_LOG',
        provider_observation_id: planting.provider_observation_id,
        event_time_precision: CONFIG.candidate_scope.planting_event_time_precision,
        possible_event_window_utc: CONFIG.candidate_scope.possible_planting_window_utc,
        available_to_runtime_at: establishmentAvailableAt,
        materials_page_available_to_runtime_at: establishmentPageProof.retrieved_at,
        expanded_log_available_to_runtime_at: expandedLog.retrieved_at,
        crop: CONFIG.candidate_scope.crop,
        hybrid_product_code: CONFIG.candidate_scope.hybrid_product_code,
        exact_plot_name: planting.plot_name,
        provider_body_emitted: false,
      },
      transition_sweep: {
        provider: transitionSource.provider,
        datatable_id: transitionSource.datatable_id,
        response_sha256: expandedLog.response_sha256,
        response_bytes: expandedLog.response_bytes,
        retrieved_at: expandedLog.retrieved_at,
        total_source_row_count: rows.length,
        exact_t3r1_event_count: exactEvents.length,
        exact_t3r1_on_or_after_planting_event_count: classified.length,
        full_comment_semantics_consumed: true,
        exact_plot_scope_consumed: true,
        known_termination_result: knownTerminations.length === 0 ? 'NONE_FOUND' : 'FOUND',
        known_termination_count: knownTerminations.length,
        ambiguous_termination_candidate_count: ambiguousTerminationCandidates.length,
        same_day_transition_ambiguity_count: sameDayOtherTransitions.length,
        known_contradiction_result: contradictions.length === 0 ? 'NONE_FOUND' : 'FOUND',
        known_contradiction_count: contradictions.length,
        provider_coverage_completeness_proven: false,
        proved_no_termination_occurred: false,
        provider_silence_used_as_evidence: false,
        provider_retrieval_time_used_as_coverage_watermark: false,
        events: sanitizedEvents,
        provider_body_emitted: false,
        provider_payload_persisted_or_uploaded: false,
      },
      continuity_support: lastSupport ? {
        role: 'IN_SEASON_CONTINUITY_SUPPORT',
        provider_observation_id: lastSupport.provider_observation_id,
        observation_date: lastSupport.observation_date,
        observation_type: lastSupport.observation_type,
        available_to_runtime_at: expandedLog.retrieved_at,
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
        termination_available_to_runtime_at: terminationEvent ? expandedLog.retrieved_at : null,
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
    });
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  write({
    schema_version: 'geox_mcft_cap09_t3r1_persistent_lifecycle_qualification_result_v1',
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
