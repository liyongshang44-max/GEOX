#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = path.join(ROOT, 'acceptance-output/MCFT_CAP_09_DIRECT_CURRENT_ANCHOR_REFRESH_DISCOVERY.json');
const SUBJECT_SHA = String(process.env.MCFT_SUBJECT_SHA || '').trim();

const HOST = 'aglog.kbs.msu.edu';
const T1R1_URL = `https://${HOST}/areas/1`;
const GLOBAL_INDEX_URL = `https://${HOST}/observations`;
const DETAIL_URL = (id) => `https://${HOST}/observations/${id}`;

const SEASON_ORIGIN_ID = 6931;
const SEASON_ORIGIN_DATE = '2026-05-11';
const KNOWN_HISTORICAL_ACTIVE_ANCHOR_ID = 6977;
const LAST_REVIEWED_T1R1_ROW_ID = 7095;
const LAST_REVIEWED_T1R1_ROW_DATE = '2026-06-25';
const RECENT_WINDOW_DAYS = 21;
const MAX_GLOBAL_PAGES = 20;

const RESET_SEMANTIC = /\b(harvest(?:ed|ing)?|termination|terminate(?:d|s|ing)?|crop\s+removed|removed\s+crop|killed\s+crop|crop\s+killed)\b/i;
const POSITIVE_MANAGEMENT_SEMANTIC = /\b(plant(?:ed|ing)?|fertiliz(?:e|ed|er|ing)|herbicide|irrigat(?:e|ed|ion|ing)|cultivat(?:e|ed|ion|ing)|mechanical\s+weed|fungicide|side\s*dress|spray(?:ed|ing)?)\b/i;
const POSITIVE_BIOLOGICAL_SEMANTIC = /\b(plant\s+height|crop\s+height|corn\s+plants?|standing\s+corn|canopy|leaf\s+area|tassel(?:ed|ing)?|silk(?:ed|ing)?|physiological\s+maturity|black\s+layer)\b/i;
const CORN_SEMANTIC = /\b(corn|maize|zea\s+mays)\b/i;
const HYBRID_SEMANTIC = /\bP0306Q\b/i;
const PHENOLOGY_PATTERNS = [
  ['VE', /\bVE\b/i],
  ['VT', /\bVT\b/i],
  ['V_STAGE', /\bV(?:[1-9]|1\d|2\d)\b/i],
  ['R1', /\bR1\b/i],
  ['R2', /\bR2\b/i],
  ['R3', /\bR3\b/i],
  ['R4', /\bR4\b/i],
  ['R5', /\bR5\b/i],
  ['R6', /\bR6\b/i],
  ['TASSEL', /\btassel(?:ed|ing)?\b/i],
  ['SILKING', /\bsilk(?:ed|ing)?\b/i],
  ['BLISTER', /\bblister\b/i],
  ['MILK', /\bmilk\s+stage\b/i],
  ['DOUGH', /\bdough\s+stage\b/i],
  ['DENT', /\bdent\s+stage\b/i],
  ['PHYSIOLOGICAL_MATURITY', /\bphysiological\s+maturity\b/i],
  ['BLACK_LAYER', /\bblack\s+layer\b/i]
];

function assert(condition, code) { if (!condition) throw new Error(code); }
function normalize(value) { return String(value || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim(); }
function dateOnly(value) { const m = String(value || '').match(/\b(\d{4}-\d{2}-\d{2})\b/); return m ? m[1] : null; }
function sha256(value) { return `sha256:${crypto.createHash('sha256').update(value).digest('hex')}`; }
function safeError(error) { return (error instanceof Error ? error.message : String(error)).replace(/https?:\/\/[^\s]+/g, '[URL_REDACTED]'); }
function write(value) { fs.mkdirSync(path.dirname(OUT), { recursive: true }); fs.writeFileSync(OUT, `${JSON.stringify(value, null, 2)}\n`, 'utf8'); console.log(JSON.stringify(value)); }
function isoDateDiffDays(a, b) { return Math.floor((Date.parse(a) - Date.parse(`${b}T00:00:00Z`)) / 86_400_000); }
function areaTokens(text) {
  return [...new Set((String(text || '').match(/\bT1R1\b|\bT1\b/g) || []))].sort();
}
function phenologyTokens(text) {
  return PHENOLOGY_PATTERNS.filter(([, pattern]) => pattern.test(text)).map(([name]) => name);
}

async function fetchPage(page, url) {
  const requested = new URL(url);
  assert(requested.hostname === HOST, 'DIRECT_CURRENT_ANCHOR_UNAPPROVED_HOST');
  const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 75_000 });
  assert(response?.ok(), `DIRECT_CURRENT_ANCHOR_HTTP_${response?.status() ?? 'NO_RESPONSE'}`);
  const finalUrl = new URL(response.url());
  assert(finalUrl.hostname === HOST, 'DIRECT_CURRENT_ANCHOR_REDIRECT_HOST_FORBIDDEN');
  const bytes = await response.body();
  return {
    raw_text: await page.locator('body').innerText(),
    proof: {
      response_sha256: sha256(bytes),
      response_bytes: bytes.byteLength,
      retrieved_at: new Date().toISOString(),
      final_pathname: finalUrl.pathname,
      provider_body_emitted: false
    }
  };
}

async function parseObservationRows(page) {
  const rows = [];
  const tableRows = page.locator('table tr');
  for (let i = 0; i < await tableRows.count(); i += 1) {
    const row = tableRows.nth(i);
    const cells = row.locator('td');
    if ((await cells.count()) < 2) continue;
    const values = [];
    for (let c = 0; c < await cells.count(); c += 1) values.push(normalize(await cells.nth(c).innerText()));
    const joined = normalize(values.join(' | '));
    const observationDate = dateOnly(joined);
    if (!observationDate) continue;
    let observationId = null;
    const links = row.locator('a[href*="/observations/"]');
    for (let l = 0; l < await links.count(); l += 1) {
      const href = await links.nth(l).getAttribute('href');
      const m = String(href || '').match(/\/observations\/(\d+)/);
      if (m) { observationId = Number(m[1]); break; }
    }
    if (!Number.isInteger(observationId)) continue;
    rows.push({
      provider_observation_id: observationId,
      observation_date: observationDate,
      row_text: joined,
      row_text_sha256: sha256(joined),
      row_area_tokens: areaTokens(joined)
    });
  }
  return [...new Map(rows.map((row) => [row.provider_observation_id, row])).values()];
}

function extractSection(rawText, startLabel, endLabels) {
  const lines = String(rawText || '').split(/\r?\n/).map((line) => line.trim());
  const start = lines.findIndex((line) => line === startLabel || line === `${startLabel}:`);
  if (start < 0) return '';
  const collected = [];
  for (let i = start + 1; i < lines.length; i += 1) {
    if (endLabels.some((label) => lines[i] === label || lines[i] === `${label}:`)) break;
    if (lines[i]) collected.push(lines[i]);
  }
  return normalize(collected.join(' '));
}

function parseDetail(rawText, proof, fallback) {
  const normalized = normalize(rawText);
  const observationDateMatch = normalized.match(/Observation Date\s+(\d{4}-\d{2}-\d{2})/i);
  const createdOnMatch = normalized.match(/Created on:\s*(\d{4}-\d{2}-\d{2})/i);
  const comment = extractSection(rawText, 'Comment', ['Areas', 'Observation Type']);
  const areas = extractSection(rawText, 'Areas', ['Observation Type', 'Activities']);
  const observationType = extractSection(rawText, 'Observation Type', ['Activities', 'Attachments']);
  const semanticText = normalize(`${observationType} ${comment}`);
  const scopeText = normalize(`${areas} ${fallback.row_text || ''}`);
  const tokens = areaTokens(scopeText);
  const phenology = phenologyTokens(semanticText);
  const reset = RESET_SEMANTIC.test(semanticText);
  const positiveManagement = POSITIVE_MANAGEMENT_SEMANTIC.test(semanticText);
  const positiveBiological = POSITIVE_BIOLOGICAL_SEMANTIC.test(semanticText);
  const corn = CORN_SEMANTIC.test(semanticText);
  const hybrid = HYBRID_SEMANTIC.test(semanticText);
  return {
    provider_observation_id: fallback.provider_observation_id,
    observation_date: observationDateMatch?.[1] || fallback.observation_date,
    provider_created_on_date: createdOnMatch?.[1] || null,
    observation_type: observationType || null,
    exact_t1r1_scope_token_present: tokens.includes('T1R1'),
    parent_t1_scope_token_present: tokens.includes('T1'),
    explicit_corn_semantic_present: corn,
    explicit_p0306q_semantic_present: hybrid,
    positive_management_semantic_present: positiveManagement,
    positive_biological_semantic_present: positiveBiological,
    reset_or_termination_semantic_present: reset,
    direct_phenology_tokens: phenology,
    comment_sha256: sha256(comment),
    detail_response_sha256: proof.response_sha256,
    detail_retrieved_at: proof.retrieved_at,
    provider_body_emitted: false
  };
}

function rankCandidate(detail, snapshotAt) {
  const ageDays = Math.max(0, isoDateDiffDays(snapshotAt.slice(0, 10), detail.observation_date));
  const scopeMatch = detail.exact_t1r1_scope_token_present || detail.parent_t1_scope_token_present;
  const positive = detail.positive_management_semantic_present || detail.positive_biological_semantic_present;
  const cropBound = detail.explicit_corn_semantic_present || detail.explicit_p0306q_semantic_present;
  const recent = ageDays <= RECENT_WINDOW_DAYS;
  const candidate = scopeMatch && positive && cropBound && recent && !detail.reset_or_termination_semantic_present;
  let score = 0;
  if (detail.exact_t1r1_scope_token_present) score += 40;
  else if (detail.parent_t1_scope_token_present) score += 30;
  if (ageDays <= 7) score += 30;
  else if (recent) score += 20;
  if (detail.explicit_corn_semantic_present) score += 20;
  if (detail.explicit_p0306q_semantic_present) score += 10;
  if (detail.direct_phenology_tokens.length) score += 30;
  if (positive) score += 10;
  if (detail.reset_or_termination_semantic_present) score -= 100;
  return {
    ...detail,
    age_days_at_discovery: ageDays,
    within_descriptive_recent_window: recent,
    direct_positive_current_season_candidate_found: candidate,
    discovery_score: score
  };
}

async function main() {
  assert(/^[0-9a-f]{40}$/.test(SUBJECT_SHA), 'DIRECT_CURRENT_ANCHOR_EXACT_SUBJECT_REQUIRED');
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ userAgent: 'GEOX-MCFT-CAP09-Direct-Current-Anchor-Discovery/1.0' });
    const page = await context.newPage();

    const t1r1 = await fetchPage(page, T1R1_URL);
    const t1r1Rows = await parseObservationRows(page);
    assert(t1r1Rows.length > 0, 'DIRECT_CURRENT_ANCHOR_T1R1_ROWS_REQUIRED');
    const latestT1r1 = [...t1r1Rows].sort((a, b) => b.observation_date.localeCompare(a.observation_date) || b.provider_observation_id - a.provider_observation_id)[0];

    const globalRows = [];
    const globalProofs = [];
    for (let pageNumber = 1; pageNumber <= MAX_GLOBAL_PAGES; pageNumber += 1) {
      const url = pageNumber === 1 ? GLOBAL_INDEX_URL : `${GLOBAL_INDEX_URL}?page=${pageNumber}`;
      const fetched = await fetchPage(page, url);
      const rows = await parseObservationRows(page);
      if (!rows.length) break;
      globalProofs.push({ page: pageNumber, ...fetched.proof });
      globalRows.push(...rows);
      const oldest = [...rows].sort((a, b) => a.observation_date.localeCompare(b.observation_date))[0]?.observation_date;
      if (oldest && oldest < SEASON_ORIGIN_DATE) break;
    }
    const dedupGlobalRows = [...new Map(globalRows.map((row) => [row.provider_observation_id, row])).values()];
    assert(dedupGlobalRows.length > 0, 'DIRECT_CURRENT_ANCHOR_GLOBAL_ROWS_REQUIRED');
    const latestGlobal = [...dedupGlobalRows].sort((a, b) => b.observation_date.localeCompare(a.observation_date) || b.provider_observation_id - a.provider_observation_id)[0];

    const relevantRows = new Map();
    for (const row of t1r1Rows) {
      if (row.observation_date >= SEASON_ORIGIN_DATE) relevantRows.set(row.provider_observation_id, row);
    }
    for (const row of dedupGlobalRows) {
      if (row.observation_date < SEASON_ORIGIN_DATE) continue;
      if (row.row_area_tokens.includes('T1R1') || row.row_area_tokens.includes('T1')) relevantRows.set(row.provider_observation_id, row);
    }

    const details = [];
    for (const row of [...relevantRows.values()].sort((a, b) => a.provider_observation_id - b.provider_observation_id)) {
      const fetched = await fetchPage(page, DETAIL_URL(row.provider_observation_id));
      details.push(parseDetail(fetched.raw_text, fetched.proof, row));
    }

    const snapshotAt = new Date().toISOString();
    const ranked = details.map((detail) => rankCandidate(detail, snapshotAt)).sort((a, b) => b.discovery_score - a.discovery_score || b.observation_date.localeCompare(a.observation_date));
    const candidates = ranked.filter((detail) => detail.direct_positive_current_season_candidate_found);
    const best = candidates[0] || null;

    const newSinceLastReview = ranked.filter((detail) => detail.observation_date > LAST_REVIEWED_T1R1_ROW_DATE || detail.provider_observation_id > LAST_REVIEWED_T1R1_ROW_ID);
    const directPhenologyCandidates = candidates.filter((detail) => detail.direct_phenology_tokens.length > 0);

    write({
      schema_version: 'geox_mcft_cap09_direct_current_anchor_refresh_discovery_v1',
      status: 'PASS',
      subject_sha: SUBJECT_SHA,
      discovery_snapshot_at: snapshotAt,
      formal_scope: {
        site_id: 'KBS_MCSE_T1R1',
        field_id: 'field_kbs_mcse_t1r1',
        season_id: 'season_2026_corn',
        crop: 'corn',
        hybrid_product_code: 'P0306Q',
        provider_area_identity: 'T1R1',
        season_origin_observation_id: SEASON_ORIGIN_ID,
        known_historical_active_anchor_observation_id: KNOWN_HISTORICAL_ACTIVE_ANCHOR_ID
      },
      source_scan: {
        source_class: 'KBS_AGLOG_DIRECT_CURRENT_ANCHOR_DISCOVERY',
        t1r1_area_response_sha256: t1r1.proof.response_sha256,
        t1r1_area_retrieved_at: t1r1.proof.retrieved_at,
        t1r1_row_count: t1r1Rows.length,
        latest_t1r1_observation_id: latestT1r1.provider_observation_id,
        latest_t1r1_observation_date: latestT1r1.observation_date,
        global_pages_scanned: globalProofs.length,
        latest_global_observation_id: latestGlobal.provider_observation_id,
        latest_global_observation_date: latestGlobal.observation_date,
        relevant_detail_count: ranked.length,
        every_relevant_row_detail_fetched: ranked.length === relevantRows.size,
        provider_body_emitted: false
      },
      discovery_semantics: {
        recent_window_days_is_discovery_ranking_only_not_validity_authority: RECENT_WINDOW_DAYS,
        absence_used_as_positive_evidence: false,
        retrieval_timestamp_used_as_scope_coverage_watermark: false,
        observation_id_used_as_event_time_chronology: false,
        thermal_or_gdd_evidence_used_to_create_lifecycle: false,
        model_inference_used_to_create_phenology: false,
        direct_positive_current_season_candidate_count: candidates.length,
        direct_positive_current_season_candidate_found: candidates.length > 0,
        direct_candidate_with_provider_phenology_token_count: directPhenologyCandidates.length,
        direct_candidate_with_provider_phenology_token_found: directPhenologyCandidates.length > 0,
        new_relevant_detail_count_since_last_reviewed_t1r1_row: newSinceLastReview.length,
        best_candidate: best
      },
      reviewed_relevant_records: ranked,
      authority_effect: {
        current_runtime_lifecycle_authority_established: false,
        phenology_authority_established: false,
        crop_model_parameter_authority_established: false,
        kc: null,
        future_legal_t_established: false,
        ea5e2_operational_activation_qualified: false,
        formal_window_started: false,
        formal_execution_count: '0/24'
      },
      next_frontier: best
        ? (best.direct_phenology_tokens.length > 0 ? 'DIRECT_CURRENT_ANCHOR_PLUS_PHENOLOGY_CANDIDATE_QUALIFICATION' : 'DIRECT_CURRENT_ANCHOR_CANDIDATE_QUALIFICATION')
        : 'DIRECT_CURRENT_ANCHOR_PUBLIC_SOURCE_GAP_ADJUDICATION',
      database_write_count: 0,
      runtime_write_count: 0,
      scheduler_write_count: 0,
      formal_evidence_write_count: 0
    });
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  write({
    schema_version: 'geox_mcft_cap09_direct_current_anchor_refresh_discovery_v1',
    status: 'FAIL',
    error: safeError(error),
    current_runtime_lifecycle_authority_established: false,
    phenology_authority_established: false,
    crop_model_parameter_authority_established: false,
    future_legal_t_established: false,
    ea5e2_operational_activation_qualified: false,
    formal_window_started: false,
    formal_execution_count: '0/24'
  });
  process.exitCode = 1;
});
