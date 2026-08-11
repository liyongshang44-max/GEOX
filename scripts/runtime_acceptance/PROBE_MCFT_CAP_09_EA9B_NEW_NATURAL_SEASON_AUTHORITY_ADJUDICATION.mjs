#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const CONFIG_PATH = path.join(ROOT, 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA9B-NEW-NATURAL-SEASON-AUTHORITY-ADJUDICATION-V1.json');
const OUT = path.join(ROOT, 'acceptance-output/MCFT_CAP_09_EA9B_NEW_NATURAL_SEASON_AUTHORITY_ADJUDICATION_RESULT.json');
const CONFIG = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
const SUBJECT_SHA = process.env.MCFT_SUBJECT_SHA || null;

function sha256(input) {
  return `sha256:${crypto.createHash('sha256').update(input).digest('hex')}`;
}
function normalizeText(value) {
  return String(value || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
}
function assert(condition, code) {
  if (!condition) throw new Error(code);
}
function assertExact(value, expected, code) {
  if (value !== expected) throw new Error(`${code}:expected=${JSON.stringify(expected)}:actual=${JSON.stringify(value)}`);
}
function safeError(error) {
  return (error instanceof Error ? error.message : String(error)).replace(/https?:\/\/[^\s]+/g, '[URL_REDACTED]');
}
function writeResult(value) {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}
function parseIsoDateOnly(value) {
  const match = String(value || '').match(/\b(\d{4}-\d{2}-\d{2})\b/);
  return match ? match[1] : null;
}
function compareDateOnly(a, b) {
  return String(a).localeCompare(String(b));
}
function sortedUnique(values) {
  return [...new Set(values)].sort((a, b) => String(a).localeCompare(String(b)));
}

async function navigateAndDigest(page, url, allowedHosts, candidateId) {
  const requested = new URL(url);
  assert(allowedHosts.includes(requested.hostname), `EA9B_UNAPPROVED_REQUEST_HOST:${candidateId}`);
  let response = null;
  let lastError = null;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 75_000 });
      if (response?.ok()) break;
      lastError = new Error(`HTTP_${response?.status() ?? 'NO_RESPONSE'}`);
    } catch (error) {
      lastError = error;
    }
    if (attempt < 2) await page.waitForTimeout(2_000);
  }
  if (!response?.ok()) throw new Error(`EA9B_PROVIDER_FETCH_FAILED:${candidateId}:${safeError(lastError || 'NO_RESPONSE')}`);
  const finalUrl = new URL(response.url());
  assert(allowedHosts.includes(finalUrl.hostname), `EA9B_REDIRECT_HOST_FORBIDDEN:${candidateId}`);
  const bytes = await response.body();
  return {
    final_origin: finalUrl.origin,
    response_sha256: sha256(bytes),
    response_bytes: bytes.byteLength,
    retrieved_at: new Date().toISOString()
  };
}

async function verifyHistoricalAnchor(context) {
  const page = await context.newPage();
  try {
    const digest = await navigateAndDigest(page, CONFIG.provider_probe.anchor_url, CONFIG.provider_probe.allowed_hosts, 'KBS_AGLOG_OLD_SEASON_ANCHOR_6931');
    const text = normalizeText(await page.locator('body').innerText());
    const lower = text.toLowerCase();
    for (const marker of CONFIG.provider_probe.anchor_required_markers) {
      assert(lower.includes(String(marker).toLowerCase()), `EA9B_ANCHOR_MARKER_MISSING:${String(marker).replace(/[^a-z0-9]+/gi, '_').slice(0, 80)}`);
    }
    return {
      candidate_id: 'KBS_AGLOG_OLD_SEASON_ANCHOR_6931',
      observation_id: CONFIG.historical_scope_anchor.planting_observation_id,
      observation_date: CONFIG.historical_scope_anchor.planting_observation_date,
      season_id: CONFIG.historical_scope_anchor.season_id,
      crop: CONFIG.historical_scope_anchor.crop,
      required_markers_verified: true,
      provider_body_emitted: false,
      ...digest
    };
  } finally {
    await page.close();
  }
}

async function scanIndex(context) {
  const page = await context.newPage();
  const probe = CONFIG.provider_probe;
  const anchorDate = probe.new_candidate_min_observation_date_exclusive;
  const areaRegex = new RegExp(probe.candidate_area_regex, 'i');
  const plantingToken = probe.candidate_observation_type_token.toLowerCase();
  const candidates = [];
  const pageProofs = [];
  let reachedAnchorOrEarlier = false;
  let totalRowsParsed = 0;

  try {
    for (let pageNumber = 1; pageNumber <= probe.maximum_index_pages; pageNumber += 1) {
      const url = pageNumber === 1 ? probe.index_url : `${probe.index_url}?${probe.index_page_parameter}=${pageNumber}`;
      const digest = await navigateAndDigest(page, url, probe.allowed_hosts, `KBS_AGLOG_INDEX_PAGE_${pageNumber}`);
      const rows = page.locator('table tr');
      const count = await rows.count();
      let parsedOnPage = 0;
      let minimumDateOnPage = null;
      let maximumDateOnPage = null;

      for (let i = 0; i < count; i += 1) {
        const row = rows.nth(i);
        const cells = row.locator('td');
        const cellCount = await cells.count();
        if (cellCount < 6) continue;
        const values = [];
        for (let c = 0; c < cellCount; c += 1) values.push(normalizeText(await cells.nth(c).innerText()));
        const observationDate = parseIsoDateOnly(values[0]);
        if (!observationDate) continue;
        parsedOnPage += 1;
        totalRowsParsed += 1;
        if (!minimumDateOnPage || observationDate < minimumDateOnPage) minimumDateOnPage = observationDate;
        if (!maximumDateOnPage || observationDate > maximumDateOnPage) maximumDateOnPage = observationDate;
        if (compareDateOnly(observationDate, anchorDate) <= 0) reachedAnchorOrEarlier = true;

        const observationType = values[2] || '';
        const areas = values[4] || '';
        const isPostAnchor = compareDateOnly(observationDate, anchorDate) > 0;
        const isPlanting = observationType.toLowerCase().includes(plantingToken);
        const hasT1SpatialToken = areaRegex.test(areas);
        if (!(isPostAnchor && isPlanting && hasT1SpatialToken)) continue;

        const links = row.locator('a[href*="/observations/"]');
        const linkCount = await links.count();
        let observationId = null;
        for (let l = 0; l < linkCount; l += 1) {
          const href = await links.nth(l).getAttribute('href');
          const match = String(href || '').match(/\/observations\/(\d+)/);
          if (match) {
            observationId = Number(match[1]);
            break;
          }
        }
        assert(Number.isInteger(observationId), `EA9B_POST_ANCHOR_T1_PLANTING_ROW_MISSING_PROVIDER_OBSERVATION_ID:${observationDate}`);

        const rowText = normalizeText(values.join(' ')).toLowerCase();
        const explicitCropTokens = sortedUnique(probe.recognized_explicit_crop_tokens.filter((token) => new RegExp(`\\b${token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(rowText)));
        candidates.push({
          provider_observation_id: observationId,
          observation_date: observationDate,
          observation_type: observationType,
          provider_area_identity: areas,
          explicit_crop_tokens: explicitCropTokens,
          crop_identity_complete_for_new_season_authority: explicitCropTokens.length === 1,
          candidate_only_not_new_season_authority: true,
          provider_body_emitted: false
        });
      }

      pageProofs.push({
        page_number: pageNumber,
        parsed_observation_row_count: parsedOnPage,
        minimum_observation_date: minimumDateOnPage,
        maximum_observation_date: maximumDateOnPage,
        provider_body_emitted: false,
        ...digest
      });

      if (reachedAnchorOrEarlier) break;
      assert(parsedOnPage > 0, `EA9B_INDEX_PAGINATION_EMPTY_BEFORE_ANCHOR:page=${pageNumber}`);
    }
  } finally {
    await page.close();
  }

  assert(totalRowsParsed > 0, 'EA9B_NO_PROVIDER_INDEX_ROWS_PARSED');
  assert(reachedAnchorOrEarlier, `EA9B_INDEX_SCAN_DID_NOT_REACH_ANCHOR_WITHIN_${probe.maximum_index_pages}_PAGES`);
  const deduped = [];
  const seen = new Set();
  for (const candidate of candidates.sort((a, b) => a.provider_observation_id - b.provider_observation_id)) {
    if (seen.has(candidate.provider_observation_id)) continue;
    seen.add(candidate.provider_observation_id);
    deduped.push(candidate);
  }
  return { pageProofs, candidates: deduped, totalRowsParsed, reachedAnchorOrEarlier };
}

let browser;
try {
  assert(SUBJECT_SHA && /^[0-9a-f]{40}$/.test(SUBJECT_SHA), 'EA9B_EXACT_SUBJECT_SHA_REQUIRED');
  assertExact(CONFIG.schema_version, 'geox_mcft_cap09_ea9b_new_natural_season_authority_adjudication_v1', 'EA9B_SCHEMA_REQUIRED');
  assertExact(CONFIG.base_main_sha, '87eab32bfade35f2d2e9ab945031a61288e20adf', 'EA9B_EXACT_BASE_REQUIRED');
  assertExact(CONFIG.authority_predecessors.ea9a_terminal_exact_head_proof.terminal_result, 'CURRENT_SEASON_PHENOLOGY_AUTHORITY_NOT_ESTABLISHED', 'EA9B_EA9A_TERMINAL_PREDECESSOR_REQUIRED');
  assertExact(CONFIG.authority_predecessors.ea9a_terminal_exact_head_proof.ea9a_terminal_reached, true, 'EA9B_EA9A_TERMINAL_FLAG_REQUIRED');
  assertExact(CONFIG.adjudication_contract.new_season_id_may_be_created_by_this_adjudication, false, 'EA9B_SEASON_CREATION_FORBIDDEN');
  assertExact(CONFIG.adjudication_contract.new_crop_identity_may_be_inferred_from_rotation, false, 'EA9B_ROTATION_CROP_INFERENCE_FORBIDDEN');
  assertExact(CONFIG.adjudication_contract.post_anchor_planting_event_alone_may_establish_natural_season, false, 'EA9B_PLANTING_ALONE_NOT_SEASON_AUTHORITY_REQUIRED');
  assertExact(CONFIG.adjudication_contract.cross_season_canonical_stitching_authorized, false, 'EA9B_CROSS_SEASON_STITCHING_FORBIDDEN');
  assertExact(CONFIG.data_use_policy.provider_body_text_may_be_emitted, false, 'EA9B_PROVIDER_BODY_EMISSION_FORBIDDEN');

  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ userAgent: 'GEOX-MCFT-CAP09-EA9B-Natural-Season-Adjudication/1.0' });
  const anchor = await verifyHistoricalAnchor(context);
  const scan = await scanIndex(context);
  const candidateObserved = scan.candidates.length > 0;
  const adjudicationResult = candidateObserved
    ? 'NEW_NATURAL_SEASON_CANDIDATE_EVIDENCE_OBSERVED'
    : 'NO_NEW_NATURAL_SEASON_CANDIDATE_EVIDENCE_CURRENTLY_OBSERVED';
  assert(CONFIG.adjudication_contract.allowed_results.includes(adjudicationResult), 'EA9B_RESULT_NOT_ALLOWED');

  const result = {
    schema_version: 'geox_mcft_cap09_ea9b_new_natural_season_authority_adjudication_result_v1',
    status: 'PASS',
    subject_sha: SUBJECT_SHA,
    authority_observed_at_utc: new Date().toISOString(),
    algorithm_id: CONFIG.decision_policy.algorithm_id,
    historical_scope_anchor: anchor,
    scanned_index_page_count: scan.pageProofs.length,
    scanned_observation_row_count: scan.totalRowsParsed,
    scan_reached_old_season_anchor_or_earlier: scan.reachedAnchorOrEarlier,
    scanned_index_page_proofs: scan.pageProofs,
    post_anchor_t1_planting_candidate_count: scan.candidates.length,
    post_anchor_t1_planting_candidates: scan.candidates,
    adjudication_result: adjudicationResult,
    time_gated_snapshot: !candidateObserved,
    global_new_season_source_absence_claimed: false,
    candidate_result_is_new_season_authority: false,
    rotation_used_to_infer_crop: false,
    future_calendar_year_used_to_assign_season: false,
    new_natural_season_created: false,
    new_season_id: null,
    new_crop: null,
    new_crop_context_authority_established: false,
    physical_field_zone_identity_reuse_authorized: false,
    new_canonical_bootstrap_authority_established: false,
    cross_season_state_stitching_authorized: false,
    current_season_2026_recovery_reopened: false,
    future_observations_used: false,
    provider_body_text_emitted: false,
    provider_payload_persisted_or_uploaded: false,
    database_write_count: 0,
    formal_evidence_write_count: 0,
    raw_object_write_count: 0,
    runtime_config_write_count: 0,
    scheduler_write_count: 0,
    canonical_runtime_write_count: 0,
    successor_epoch_selected: false,
    ea5e2_operational_activation_qualified: false,
    ea5e3_effective: false,
    formal_execution_count: '0/24',
    mcft_cap09_completed: false,
    next_primary_successor: candidateObserved ? CONFIG.successor_policy.on_candidate : CONFIG.successor_policy.on_no_candidate,
    requalification_trigger: candidateObserved ? null : CONFIG.successor_policy.requalification_trigger,
    parallel_operational_successor: CONFIG.successor_policy.parallel_operational_successor
  };
  writeResult(result);
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  const result = {
    schema_version: 'geox_mcft_cap09_ea9b_new_natural_season_authority_adjudication_result_v1',
    status: 'FAIL',
    subject_sha: SUBJECT_SHA,
    observed_at_utc: new Date().toISOString(),
    error: safeError(error),
    adjudication_result: null,
    new_natural_season_created: false,
    new_season_id: null,
    new_crop: null,
    provider_body_text_emitted: false,
    database_write_count: 0,
    runtime_config_write_count: 0,
    scheduler_write_count: 0,
    canonical_runtime_write_count: 0,
    successor_epoch_selected: false,
    formal_execution_count: '0/24'
  };
  writeResult(result);
  console.error(JSON.stringify(result, null, 2));
  process.exitCode = 1;
} finally {
  await browser?.close();
}
