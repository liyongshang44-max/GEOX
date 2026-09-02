#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const CONFIG_PATH = path.join(ROOT, 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-T4R1-NATURAL-SEASON-SUCCESSOR-ADJUDICATION-V1.json');
const OUT = path.join(ROOT, 'acceptance-output/MCFT_CAP_09_T4R1_NATURAL_SEASON_SUCCESSOR_ADJUDICATION_V1.json');
const CONFIG = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
const SUBJECT_SHA = String(process.env.MCFT_SUBJECT_SHA || '').trim();
const PROBE = CONFIG.provider_probe;
const ANCHOR_DATE = CONFIG.historical_scope_anchor.planting_observation_date;
const INDEX_AREA_PATTERN = new RegExp(PROBE.candidate_index_area_regex, 'i');
const ALL_REPS_PATTERN = /\ball\s+rep(?:s|lications?)\b/i;
const REP1_PATTERN = /\brep(?:s|lications?)\b[^.]{0,180}\b1\b/i;

function requireCondition(condition, code) {
  if (!condition) throw new Error(code);
}
function normalize(value) {
  return String(value || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
}
function dateOnly(value) {
  return String(value || '').match(/\b(\d{4}-\d{2}-\d{2})\b/)?.[1] ?? null;
}
function sha256(bytes) {
  return `sha256:${crypto.createHash('sha256').update(bytes).digest('hex')}`;
}
function safeError(error) {
  return (error instanceof Error ? error.message : String(error)).replace(/https?:\/\/\S+/g, '[URL_REDACTED]');
}
function write(value) {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify(value));
}
function uniqueById(items) {
  return [...new Map(items.map((item) => [item.provider_observation_id, item])).values()]
    .sort((a, b) => a.provider_observation_id - b.provider_observation_id);
}
function section(text, startLabel, endLabel) {
  const lower = text.toLowerCase();
  const start = lower.indexOf(startLabel.toLowerCase());
  if (start < 0) return '';
  const bodyStart = start + startLabel.length;
  const end = lower.indexOf(endLabel.toLowerCase(), bodyStart);
  return normalize(text.slice(bodyStart, end < 0 ? text.length : end));
}
function exactT4R1Applicability(areas, comment) {
  if (/\bT4R1\b/i.test(areas)) return { exact: true, basis: 'EXACT_T4R1_DETAIL_AREA' };
  if (/\bT4\b/i.test(areas) && ALL_REPS_PATTERN.test(comment) && REP1_PATTERN.test(comment)) {
    return { exact: true, basis: 'PARENT_T4_ALL_REPLICATIONS_EXPLICITLY_INCLUDING_R1' };
  }
  return { exact: false, basis: 'T4R1_EXACT_APPLICABILITY_NOT_PROVED' };
}
function cropTokens(text) {
  return [...new Set(PROBE.recognized_explicit_crop_tokens.filter((token) => new RegExp(`\\b${token}\\b`, 'i').test(text)))].sort();
}
async function digestPage(page, url, candidateId) {
  const requested = new URL(url);
  requireCondition(requested.protocol === 'https:' && requested.hostname === PROBE.allowed_host, `T4R1_NATURAL_SEASON_UNAPPROVED_HOST:${candidateId}`);
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
  requireCondition(response?.ok(), `T4R1_NATURAL_SEASON_PROVIDER_FETCH_FAILED:${candidateId}:${safeError(lastError || 'NO_RESPONSE')}`);
  requireCondition(new URL(response.url()).hostname === PROBE.allowed_host, `T4R1_NATURAL_SEASON_REDIRECT_HOST_FORBIDDEN:${candidateId}`);
  const bytes = await response.body();
  return { response_sha256: sha256(bytes), response_bytes: bytes.byteLength, retrieved_at: new Date().toISOString() };
}

async function main() {
  requireCondition(/^[0-9a-f]{40}$/.test(SUBJECT_SHA), 'T4R1_NATURAL_SEASON_EXACT_SUBJECT_REQUIRED');
  requireCondition(CONFIG.frontier === 'T4R1_NATURAL_SEASON_SUCCESSOR_ADJUDICATION', 'T4R1_NATURAL_SEASON_FRONTIER_DRIFT');
  requireCondition(CONFIG.authority_predecessors.stage_input_requalification.exact_head_proof.result === 'NO_T4R1_CONTEMPORANEOUS_STAGE_INPUT_AUTHORITY_CURRENTLY_ESTABLISHED', 'T4R1_NATURAL_SEASON_STAGE_PREDECESSOR_REQUIRED');
  requireCondition(CONFIG.adjudication_contract.cross_season_state_stitching_authorized === false, 'T4R1_NATURAL_SEASON_STATE_STITCHING_FORBIDDEN');
  requireCondition(CONFIG.adjudication_contract.new_season_id_may_be_created_by_this_adjudication === false, 'T4R1_NATURAL_SEASON_CREATION_FORBIDDEN');

  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ userAgent: 'GEOX-MCFT-CAP09-T4R1-Natural-Season-Successor-Adjudication/1.0' });
    const page = await context.newPage();

    const anchorProof = await digestPage(page, PROBE.anchor_url, 'T4R1_CURRENT_SEASON_PLANTING_ANCHOR');
    const anchorText = normalize(await page.locator('body').innerText());
    for (const marker of ['Observation Date', ANCHOR_DATE, 'Areas', 'T4', 'Observation Type', 'Planting', 'corn', '43-96P']) {
      requireCondition(anchorText.toLowerCase().includes(marker.toLowerCase()), `T4R1_NATURAL_SEASON_ANCHOR_MARKER_MISSING:${marker}`);
    }

    const pageProofs = [];
    const leads = [];
    let reachedAnchor = false;
    let totalRows = 0;

    for (let pageNumber = 1; pageNumber <= PROBE.maximum_index_pages; pageNumber += 1) {
      const url = pageNumber === 1 ? PROBE.index_url : `${PROBE.index_url}?page=${pageNumber}`;
      const digest = await digestPage(page, url, `KBS_AGLOG_INDEX_PAGE_${pageNumber}`);
      const rows = page.locator('table tr');
      const rowCount = await rows.count();
      let parsedRows = 0;
      let minimumDate = null;
      let maximumDate = null;

      for (let rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
        const cells = rows.nth(rowIndex).locator('td');
        const cellCount = await cells.count();
        if (cellCount < 6) continue;
        const values = [];
        for (let column = 0; column < cellCount; column += 1) values.push(normalize(await cells.nth(column).innerText()));
        const observationDate = dateOnly(values[0]);
        if (!observationDate) continue;

        parsedRows += 1;
        totalRows += 1;
        minimumDate = !minimumDate || observationDate < minimumDate ? observationDate : minimumDate;
        maximumDate = !maximumDate || observationDate > maximumDate ? observationDate : maximumDate;
        if (observationDate <= ANCHOR_DATE) reachedAnchor = true;
        if (observationDate <= ANCHOR_DATE) continue;

        const observationType = values[2] || '';
        const areas = values[4] || '';
        if (!observationType.toLowerCase().includes(PROBE.candidate_observation_type_token.toLowerCase())) continue;
        if (!INDEX_AREA_PATTERN.test(areas)) continue;

        const links = rows.nth(rowIndex).locator('a[href*="/observations/"]');
        let observationId = null;
        for (let linkIndex = 0; linkIndex < await links.count(); linkIndex += 1) {
          const match = String(await links.nth(linkIndex).getAttribute('href') || '').match(/\/observations\/(\d+)/);
          if (match) { observationId = Number(match[1]); break; }
        }
        requireCondition(Number.isInteger(observationId), 'T4R1_NATURAL_SEASON_DETAIL_ID_REQUIRED');
        leads.push({ provider_observation_id: observationId, observation_date: observationDate, observation_type: observationType, index_area_identity: areas });
      }

      pageProofs.push({ page_number: pageNumber, parsed_observation_row_count: parsedRows, minimum_observation_date: minimumDate, maximum_observation_date: maximumDate, provider_body_emitted: false, ...digest });
      if (reachedAnchor) break;
      requireCondition(parsedRows > 0, `T4R1_NATURAL_SEASON_EMPTY_PAGE_BEFORE_ANCHOR:${pageNumber}`);
    }

    requireCondition(totalRows > 0, 'T4R1_NATURAL_SEASON_NO_INDEX_ROWS_PARSED');
    requireCondition(reachedAnchor, 'T4R1_NATURAL_SEASON_SCAN_DID_NOT_REACH_ANCHOR');
    const uniqueLeads = uniqueById(leads);
    requireCondition(uniqueLeads.length <= PROBE.maximum_detail_candidates, 'T4R1_NATURAL_SEASON_DETAIL_LIMIT_EXCEEDED');

    const inspections = [];
    for (const lead of uniqueLeads) {
      const detailProof = await digestPage(page, `${PROBE.index_url}/${lead.provider_observation_id}`, `T4R1_NATURAL_SEASON_DETAIL_${lead.provider_observation_id}`);
      const detailText = normalize(await page.locator('body').innerText());
      const comment = section(detailText, 'Comment:', 'Areas:');
      const areas = section(detailText, 'Areas:', 'Observation Type:');
      const observationType = section(detailText, 'Observation Type:', 'Activities:');
      const activities = section(detailText, 'Activities:', 'Attachments:');

      requireCondition(detailText.includes(lead.observation_date), 'T4R1_NATURAL_SEASON_DETAIL_DATE_MISMATCH');
      requireCondition(observationType.toLowerCase().includes('planting'), 'T4R1_NATURAL_SEASON_DETAIL_NOT_PLANTING');

      const applicability = exactT4R1Applicability(areas, comment);
      const crops = cropTokens(`${comment} ${activities}`);
      inspections.push({
        ...lead,
        detail_area_identity: areas,
        exact_t4r1_applicability: applicability.exact,
        exact_t4r1_applicability_basis: applicability.basis,
        explicit_crop_tokens: crops,
        crop_identity_complete_for_successor_authority: crops.length === 1,
        successor_candidate_evidence: applicability.exact,
        candidate_only_not_new_season_authority: true,
        provider_body_emitted: false,
        ...detailProof
      });
    }

    const candidates = inspections.filter((item) => item.successor_candidate_evidence);
    const result = candidates.length > 0
      ? 'T4R1_NATURAL_SEASON_SUCCESSOR_CANDIDATE_EVIDENCE_OBSERVED'
      : 'NO_T4R1_NATURAL_SEASON_SUCCESSOR_CANDIDATE_CURRENTLY_OBSERVED';

    write({
      schema_version: 'geox_mcft_cap09_t4r1_natural_season_successor_adjudication_result_v1',
      status: 'PASS',
      result,
      subject_sha: SUBJECT_SHA,
      observed_at_utc: new Date().toISOString(),
      historical_scope_anchor: {
        site_id: CONFIG.historical_scope_anchor.site_id,
        field_id: CONFIG.historical_scope_anchor.field_id,
        season_id: CONFIG.historical_scope_anchor.season_id,
        crop: CONFIG.historical_scope_anchor.crop,
        planting_observation_id: CONFIG.historical_scope_anchor.planting_observation_id,
        planting_observation_date: CONFIG.historical_scope_anchor.planting_observation_date,
        required_markers_verified: true,
        provider_body_emitted: false,
        ...anchorProof
      },
      provider_scan: {
        scanned_index_page_count: pageProofs.length,
        scanned_observation_row_count: totalRows,
        scan_reached_anchor: reachedAnchor,
        post_anchor_t4_planting_lead_count: uniqueLeads.length,
        inspected_detail_count: inspections.length,
        exact_t4r1_successor_candidate_count: candidates.length,
        inspections,
        page_proofs: pageProofs,
        provider_body_emitted: false,
        provider_payload_persisted_or_uploaded: false
      },
      time_gated_snapshot: candidates.length === 0,
      global_new_season_source_absence_claimed: false,
      candidate_result_is_new_season_authority: false,
      rotation_used_to_infer_crop: false,
      future_calendar_year_used_to_assign_season: false,
      new_natural_season_created: false,
      new_season_id: null,
      new_crop: null,
      new_crop_context_authority_established: false,
      historical_geometry_reused: false,
      new_canonical_bootstrap_authority_established: false,
      cross_season_state_stitching_authorized: false,
      cross_season_forecast_stitching_authorized: false,
      cross_season_checkpoint_stitching_authorized: false,
      cross_season_lineage_stitching_authorized: false,
      database_write_count: 0,
      raw_object_write_count: 0,
      runtime_config_write_count: 0,
      scheduler_write_count: 0,
      runtime_process_start: false,
      production_owner_activation: false,
      formal_v5_arm: false,
      a0_bootstrap: false,
      o00_started: false,
      formal_execution_count: '0/24',
      mcft_cap09_completed: false,
      next_primary_successor: candidates.length > 0 ? CONFIG.successor_policy.on_candidate : CONFIG.successor_policy.on_no_candidate,
      requalification_trigger: candidates.length > 0 ? null : CONFIG.successor_policy.requalification_trigger
    });
  } finally {
    await browser.close();
  }
}

try {
  await main();
} catch (error) {
  write({
    schema_version: 'geox_mcft_cap09_t4r1_natural_season_successor_adjudication_result_v1',
    status: 'FAIL',
    subject_sha: SUBJECT_SHA || null,
    observed_at_utc: new Date().toISOString(),
    error: safeError(error),
    result: null,
    new_natural_season_created: false,
    new_season_id: null,
    new_crop: null,
    cross_season_state_stitching_authorized: false,
    database_write_count: 0,
    runtime_process_start: false,
    formal_execution_count: '0/24',
    mcft_cap09_completed: false
  });
  process.exitCode = 1;
}
