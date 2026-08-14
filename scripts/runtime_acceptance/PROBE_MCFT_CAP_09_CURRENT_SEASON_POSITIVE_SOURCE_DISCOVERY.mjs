#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = path.join(ROOT, 'acceptance-output/MCFT_CAP_09_CURRENT_SEASON_POSITIVE_SOURCE_DISCOVERY.json');
const SUBJECT_SHA = String(process.env.MCFT_SUBJECT_SHA || '').trim();
const HOST = 'aglog.kbs.msu.edu';
const INDEX_URL = `https://${HOST}/observations`;
const AREA_URLS = [
  { expected_name: 'T1', url: `https://${HOST}/areas/623` },
  { expected_name: 'T1R1', url: `https://${HOST}/areas/1` }
];
const PLANTING_DATE = '2026-05-11';
const PLANTING_OBSERVATION_ID = 6931;
const MAX_DETAILS = 80;

const CROP_TOKENS = ['corn', 'maize', 'soybean', 'wheat', 'barley', 'rye', 'canola', 'sorghum'];
const HYBRID_PATTERN = /\bP\d{4}[A-Z0-9-]*\b/g;
const PHENOLOGY = [
  ['EMERGENCE', /\bemerg(?:e|ed|ence|ing)\b/i],
  ['TASSELING', /\btassel(?:ed|ing|s)?\b/i],
  ['SILKING', /\bsilk(?:ed|ing|s)?\b/i],
  ['BLISTER', /\bblister(?:ed|ing)?\b/i],
  ['MILK_STAGE', /\bmilk\s+stage\b/i],
  ['DOUGH_STAGE', /\bdough\s+stage\b/i],
  ['DENT_STAGE', /\bdent(?:ed|ing)?(?:\s+stage)?\b/i],
  ['PHYSIOLOGICAL_MATURITY', /\bphysiological\s+maturity\b/i],
  ['BLACK_LAYER', /\bblack\s+layer\b/i],
  ['SENESCENCE', /\bsenesc(?:ence|ent|ing)\b/i]
];
const POSITIVE_MANAGEMENT_EVENT = /\b(planting|fertilizer application|herbicide application|fungicide application|insecticide application|irrigation|mechanical weed control|cultural control|observation|scouting|sampling)\b/i;
const TERMINATION_EVENT = /\b(harvest|termination|terminate)\b/i;

function assert(condition, code) { if (!condition) throw new Error(code); }
function normalize(value) { return String(value || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim(); }
function dateOnly(value) { const m = String(value || '').match(/\b(\d{4}-\d{2}-\d{2})\b/); return m ? m[1] : null; }
function sha256(bytes) { return `sha256:${crypto.createHash('sha256').update(bytes).digest('hex')}`; }
function write(value) { fs.mkdirSync(path.dirname(OUT), { recursive: true }); fs.writeFileSync(OUT, `${JSON.stringify(value, null, 2)}\n`, 'utf8'); console.log(JSON.stringify(value)); }
function safeError(error) { return (error instanceof Error ? error.message : String(error)).replace(/https?:\/\/[^\s]+/g, '[URL_REDACTED]'); }
function tokens(text) {
  const crop = CROP_TOKENS.filter((token) => new RegExp(`\\b${token}\\b`, 'i').test(text));
  const hybrids = [...new Set((text.match(HYBRID_PATTERN) || []).map((value) => value.toUpperCase()))].sort();
  const phenology = PHENOLOGY.filter(([, pattern]) => pattern.test(text)).map(([code]) => code);
  return { explicit_crop_tokens: [...new Set(crop)].sort(), explicit_hybrid_tokens: hybrids, phenology_semantic_tokens: phenology };
}
async function get(page, url) {
  const requested = new URL(url);
  assert(requested.hostname === HOST, 'POSITIVE_SOURCE_DISCOVERY_UNAPPROVED_HOST');
  const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 75_000 });
  assert(response?.ok(), `POSITIVE_SOURCE_DISCOVERY_HTTP_${response?.status() ?? 'NO_RESPONSE'}`);
  const finalUrl = new URL(response.url());
  assert(finalUrl.hostname === HOST, 'POSITIVE_SOURCE_DISCOVERY_REDIRECT_HOST_FORBIDDEN');
  const bytes = await response.body();
  return { response_sha256: sha256(bytes), response_bytes: bytes.byteLength, retrieved_at: new Date().toISOString() };
}
async function rowsFromCurrentPage(page) {
  const rows = page.locator('table tr');
  const out = [];
  for (let i = 0; i < await rows.count(); i += 1) {
    const cells = rows.nth(i).locator('td');
    if (await cells.count() < 5) continue;
    const values = [];
    for (let c = 0; c < await cells.count(); c += 1) values.push(normalize(await cells.nth(c).innerText()));
    const date = dateOnly(values[0]);
    if (!date) continue;
    let observationId = null;
    const links = rows.nth(i).locator('a[href*="/observations/"]');
    for (let l = 0; l < await links.count(); l += 1) {
      const href = await links.nth(l).getAttribute('href');
      const match = String(href || '').match(/\/observations\/(\d+)/);
      if (match) { observationId = Number(match[1]); break; }
    }
    if (!Number.isInteger(observationId)) continue;
    out.push({
      provider_observation_id: observationId,
      observation_date: date,
      observation_type: values[1] || values[2] || '',
      area_page_comment_token_count_only: normalize(values[2] || values[3] || '').split(/\s+/).filter(Boolean).length
    });
  }
  return out;
}

async function main() {
  assert(/^[0-9a-f]{40}$/.test(SUBJECT_SHA), 'POSITIVE_SOURCE_DISCOVERY_EXACT_SUBJECT_REQUIRED');
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ userAgent: 'GEOX-MCFT-CAP09-Positive-Lifecycle-Stage-Source-Discovery/1.0' });
    const page = await context.newPage();

    const areaProofs = [];
    const areaRows = [];
    for (const area of AREA_URLS) {
      const digest = await get(page, area.url);
      const body = normalize(await page.locator('body').innerText());
      assert(new RegExp(`\\b${area.expected_name}\\b`, 'i').test(body), `POSITIVE_SOURCE_DISCOVERY_AREA_NAME_MISSING:${area.expected_name}`);
      const parsed = await rowsFromCurrentPage(page);
      areaProofs.push({ area: area.expected_name, row_count: parsed.length, provider_body_emitted: false, ...digest });
      for (const row of parsed) areaRows.push({ ...row, source_area_page: area.expected_name });
    }

    const postPlanting = [...new Map(
      areaRows
        .filter((row) => row.observation_date >= PLANTING_DATE)
        .map((row) => [row.provider_observation_id, row])
    ).values()].sort((a, b) => a.provider_observation_id - b.provider_observation_id);
    assert(postPlanting.some((row) => row.provider_observation_id === PLANTING_OBSERVATION_ID), 'POSITIVE_SOURCE_DISCOVERY_PLANTING_ANCHOR_NOT_ON_AREA_PAGE');
    assert(postPlanting.length <= MAX_DETAILS, 'POSITIVE_SOURCE_DISCOVERY_DETAIL_LIMIT_EXCEEDED');

    const details = [];
    for (const row of postPlanting) {
      const proof = await get(page, `${INDEX_URL}/${row.provider_observation_id}`);
      const body = normalize(await page.locator('body').innerText());
      const lower = body.toLowerCase();
      assert(lower.includes(row.observation_date), 'POSITIVE_SOURCE_DISCOVERY_DETAIL_DATE_MISMATCH');
      assert(/\bt1(?:r1)?\b/i.test(body), 'POSITIVE_SOURCE_DISCOVERY_DETAIL_SCOPE_MISSING');
      const extracted = tokens(body);
      details.push({
        ...row,
        ...extracted,
        explicit_current_crop_binding: extracted.explicit_crop_tokens.includes('corn') || extracted.explicit_crop_tokens.includes('maize') || extracted.explicit_hybrid_tokens.includes('P0306Q'),
        positive_management_event_candidate: POSITIVE_MANAGEMENT_EVENT.test(row.observation_type),
        termination_event_candidate: TERMINATION_EVENT.test(row.observation_type),
        candidate_only_not_authority: true,
        provider_body_emitted: false,
        ...proof
      });
    }

    const positive = details.filter((item) => item.positive_management_event_candidate);
    const explicitCropPositive = positive.filter((item) => item.explicit_current_crop_binding);
    const termination = details.filter((item) => item.termination_event_candidate);
    const phenology = details.filter((item) => item.phenology_semantic_tokens.length > 0);
    const latest = details.length ? [...details].sort((a, b) => b.observation_date.localeCompare(a.observation_date) || b.provider_observation_id - a.provider_observation_id)[0] : null;
    const latestPositive = positive.length ? [...positive].sort((a, b) => b.observation_date.localeCompare(a.observation_date) || b.provider_observation_id - a.provider_observation_id)[0] : null;
    const latestExplicitCropPositive = explicitCropPositive.length ? [...explicitCropPositive].sort((a, b) => b.observation_date.localeCompare(a.observation_date) || b.provider_observation_id - a.provider_observation_id)[0] : null;

    write({
      schema_version: 'geox_mcft_cap09_current_season_positive_source_discovery_v1',
      status: 'PASS',
      subject_sha: SUBJECT_SHA,
      observed_at_utc: new Date().toISOString(),
      formal_scope: { site_id: 'KBS_MCSE_T1R1', season_id: 'season_2026_corn', crop: 'corn', hybrid_product_code: 'P0306Q', provider_area_identity: 'T1R1' },
      discovery_only_not_authority: true,
      provider: 'KBS_AGLOG',
      area_proofs: areaProofs,
      post_planting_event_count: details.length,
      positive_management_event_candidate_count: positive.length,
      explicit_current_crop_positive_management_candidate_count: explicitCropPositive.length,
      termination_event_candidate_count: termination.length,
      phenology_semantic_candidate_count: phenology.length,
      latest_post_planting_event: latest,
      latest_positive_management_event_candidate: latestPositive,
      latest_explicit_current_crop_positive_management_candidate: latestExplicitCropPositive,
      termination_event_candidates: termination,
      phenology_semantic_candidates: phenology,
      post_planting_events: details,
      lifecycle_active_established: false,
      phenology_stage_established: false,
      crop_model_parameter_established: false,
      provider_body_emitted: false,
      provider_payload_persisted_or_uploaded: false,
      database_write_count: 0,
      formal_evidence_write_count: 0,
      raw_object_write_count: 0,
      runtime_config_write_count: 0,
      scheduler_write_count: 0,
      canonical_runtime_write_count: 0,
      formal_window_started: false,
      formal_execution_count: '0/24'
    });
  } finally {
    await browser.close();
  }
}

try { await main(); }
catch (error) {
  write({ schema_version: 'geox_mcft_cap09_current_season_positive_source_discovery_v1', status: 'FAIL', subject_sha: SUBJECT_SHA || null, error: safeError(error), lifecycle_active_established: false, phenology_stage_established: false, crop_model_parameter_established: false, database_write_count: 0, formal_window_started: false, formal_execution_count: '0/24' });
  process.exitCode = 1;
}
