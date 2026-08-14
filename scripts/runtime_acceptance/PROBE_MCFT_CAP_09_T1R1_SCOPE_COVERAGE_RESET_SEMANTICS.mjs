#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = path.join(ROOT, 'acceptance-output/MCFT_CAP_09_T1R1_SCOPE_COVERAGE_RESET_SEMANTICS.json');
const SUBJECT_SHA = String(process.env.MCFT_SUBJECT_SHA || '').trim();

const AGLOG_HOST = 'aglog.kbs.msu.edu';
const T1R1_URL = `https://${AGLOG_HOST}/areas/1`;
const GLOBAL_INDEX_URL = `https://${AGLOG_HOST}/observations`;
const DETAIL_URL = (id) => `https://${AGLOG_HOST}/observations/${id}`;

const A14_PATH = 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-14-POSITIVE-LIFECYCLE-ANCHOR-AUTHORITY.md';
const ORIGINAL_LAYER2_PROBE = 'scripts/runtime_acceptance/PROBE_MCFT_CAP_09_BOUNDED_LIFECYCLE_CARRY_FORWARD.mjs';
const EXPECTED_A14_BLOB = '299e256bed5ab8c822990f34686b310da3bcf00e';
const EXPECTED_ORIGINAL_LAYER2_PROBE_BLOB = '8dd32ba38f68f85b1cf8120a9b40c65c2c9e99ea';
const EXPECTED_BASE_MAIN = 'ab0ec4795a5d7be4da8cf6226520507f58265b5e';
const ANCHOR_ID = 6977;
const ANCHOR_DATE = '2026-05-27';
const ANCHOR_END_UTC = '2026-05-27T20:40:00.000Z';

const RESET_SEMANTIC = /\b(harvest(?:ed|ing)?|termination|terminate(?:d|s|ing)?|crop\s+removed|removed\s+crop|killed\s+crop|crop\s+killed)\b/i;
const SUCCESSOR_PLANTING_SEMANTIC = /\b(plant(?:ed|ing)?|replant(?:ed|ing)?)\b/i;

function assert(condition, code) { if (!condition) throw new Error(code); }
function normalize(value) { return String(value || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim(); }
function dateOnly(value) { const m = String(value || '').match(/\b(\d{4}-\d{2}-\d{2})\b/); return m ? m[1] : null; }
function sha256(bytes) { return `sha256:${crypto.createHash('sha256').update(bytes).digest('hex')}`; }
function safeError(error) { return (error instanceof Error ? error.message : String(error)).replace(/https?:\/\/[^\s]+/g, '[URL_REDACTED]'); }
function write(value) { fs.mkdirSync(path.dirname(OUT), { recursive: true }); fs.writeFileSync(OUT, `${JSON.stringify(value, null, 2)}\n`, 'utf8'); console.log(JSON.stringify(value)); }
function git(...args) { return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim(); }
function gitBlob(file) { const b = fs.readFileSync(path.join(ROOT, file)); return crypto.createHash('sha1').update(`blob ${b.length}\0`).update(b).digest('hex'); }

async function fetchProof(page, url) {
  const requested = new URL(url);
  assert(requested.hostname === AGLOG_HOST, 'T1R1_COVERAGE_UNAPPROVED_HOST');
  const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 75_000 });
  assert(response?.ok(), `T1R1_COVERAGE_HTTP_${response?.status() ?? 'NO_RESPONSE'}`);
  const finalUrl = new URL(response.url());
  assert(finalUrl.hostname === AGLOG_HOST, 'T1R1_COVERAGE_REDIRECT_HOST_FORBIDDEN');
  const bytes = await response.body();
  return {
    text: normalize(await page.locator('body').innerText()),
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
  const table = page.locator('table').first();
  assert(await table.count(), 'T1R1_COVERAGE_TABLE_REQUIRED');

  const headerCells = table.locator('thead tr').last().locator('th');
  const headers = [];
  for (let i = 0; i < await headerCells.count(); i += 1) headers.push(normalize(await headerCells.nth(i).innerText()).toLowerCase());

  const bodyRows = table.locator('tbody tr');
  const rows = [];
  for (let i = 0; i < await bodyRows.count(); i += 1) {
    const row = bodyRows.nth(i);
    const cells = row.locator('td');
    if (await cells.count() === 0) continue;
    const values = [];
    for (let c = 0; c < await cells.count(); c += 1) values.push(normalize(await cells.nth(c).innerText()));

    const byHeader = {};
    for (let c = 0; c < values.length; c += 1) byHeader[headers[c] || `col_${c}`] = values[c];

    const observationDate = dateOnly(byHeader.date || values[0]);
    if (!observationDate) continue;

    let observationId = null;
    const links = row.locator('a[href*="/observations/"]');
    for (let l = 0; l < await links.count(); l += 1) {
      const href = await links.nth(l).getAttribute('href');
      const m = String(href || '').match(/\/observations\/(\d+)/);
      if (m) { observationId = Number(m[1]); break; }
    }
    if (!Number.isInteger(observationId)) continue;

    const typeKey = headers.find((h) => /observation\s*type/.test(h));
    const commentKey = headers.find((h) => /^comment$/.test(h));

    rows.push({
      provider_observation_id: observationId,
      observation_date: observationDate,
      observation_type: normalize((typeKey ? byHeader[typeKey] : '') || values[1] || values[2] || ''),
      list_comment: normalize(commentKey ? byHeader[commentKey] : ''),
    });
  }
  return [...new Map(rows.map((r) => [r.provider_observation_id, r])).values()];
}

async function extractLabeledValue(page, labelPattern) {
  const trs = page.locator('tr');
  for (let i = 0; i < await trs.count(); i += 1) {
    const cells = trs.nth(i).locator('th,td');
    const count = await cells.count();
    if (count < 2) continue;
    const label = normalize(await cells.nth(0).innerText()).replace(/:$/, '');
    if (labelPattern.test(label)) {
      const values = [];
      for (let c = 1; c < count; c += 1) values.push(normalize(await cells.nth(c).innerText()));
      return normalize(values.join(' '));
    }
  }

  const dts = page.locator('dt');
  for (let i = 0; i < await dts.count(); i += 1) {
    const label = normalize(await dts.nth(i).innerText()).replace(/:$/, '');
    if (!labelPattern.test(label)) continue;
    const dd = dts.nth(i).locator('xpath=following-sibling::dd[1]');
    if (await dd.count()) return normalize(await dd.innerText());
  }

  const body = normalize(await page.locator('body').innerText());
  const escapedStart = labelPattern.source.replace(/^\^|\$$/g, '');
  const m = body.match(new RegExp(`(?:${escapedStart})\\s*:?\\s*(.*?)\\s+(?:Areas?|Materials?|Created on|Observation Date|Observation Type|Actions?)\\b`, 'i'));
  return normalize(m?.[1] || '');
}

async function fetchObservationDetail(page, row) {
  const fetched = await fetchProof(page, DETAIL_URL(row.provider_observation_id));
  assert(
    fetched.proof.final_pathname === `/observations/${row.provider_observation_id}`,
    `T1R1_DETAIL_PATH_IDENTITY_MISMATCH:${row.provider_observation_id}`
  );

  const comment = await extractLabeledValue(page, /^comment$/i);
  const detailType = await extractLabeledValue(page, /^observation\s*type$/i);
  assert(comment.length > 0, `T1R1_DETAIL_COMMENT_REQUIRED:${row.provider_observation_id}`);
  assert((detailType || row.observation_type).length > 0, `T1R1_DETAIL_TYPE_REQUIRED:${row.provider_observation_id}`);

  return {
    provider_observation_id: row.provider_observation_id,
    observation_date: row.observation_date,
    observation_type: detailType || row.observation_type,
    comment,
    detail_retrieved_at: fetched.proof.retrieved_at,
    detail_response_sha256: fetched.proof.response_sha256,
    reset_semantic_detected: RESET_SEMANTIC.test(`${detailType || row.observation_type} ${comment}`),
    successor_planting_semantic_detected: SUCCESSOR_PLANTING_SEMANTIC.test(`${detailType || row.observation_type} ${comment}`)
  };
}

async function main() {
  assert(/^[0-9a-f]{40}$/.test(SUBJECT_SHA), 'T1R1_COVERAGE_EXACT_SUBJECT_REQUIRED');
  assert(git('merge-base', EXPECTED_BASE_MAIN, SUBJECT_SHA) === EXPECTED_BASE_MAIN, 'T1R1_COVERAGE_MUST_DESCEND_FROM_EXACT_MAIN');
  assert(gitBlob(A14_PATH) === EXPECTED_A14_BLOB, 'T1R1_COVERAGE_AMENDMENT14_BLOB_DRIFT');
  assert(gitBlob(ORIGINAL_LAYER2_PROBE) === EXPECTED_ORIGINAL_LAYER2_PROBE_BLOB, 'T1R1_COVERAGE_ORIGINAL_LAYER2_PROBE_DRIFT');

  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ userAgent: 'GEOX-MCFT-CAP09-T1R1-Coverage-Reset-Semantics/1.0' });
    const page = await context.newPage();

    const area = await fetchProof(page, T1R1_URL);
    assert(/\bT1R1\b/i.test(area.text), 'T1R1_COVERAGE_AREA_IDENTITY_REQUIRED');
    const paginationLinkCount = await page.locator('a[href*="?page="]').count();
    assert(paginationLinkCount === 0, 'T1R1_COVERAGE_PAGINATION_UNQUALIFIED');

    const areaRows = await parseObservationRows(page);
    assert(areaRows.length >= 300, 'T1R1_COVERAGE_HISTORY_DEPTH_REQUIRED');
    assert(areaRows.some((r) => r.provider_observation_id === ANCHOR_ID), 'T1R1_COVERAGE_ANCHOR_MISSING');

    const sameDayNonAnchorRows = areaRows.filter((r) => r.observation_date === ANCHOR_DATE && r.provider_observation_id !== ANCHOR_ID);
    assert(sameDayNonAnchorRows.length === 0, 'T1R1_COVERAGE_SAME_DAY_EVENT_CHRONOLOGY_UNRESOLVED');

    const postAnchorRows = areaRows
      .filter((r) => r.observation_date > ANCHOR_DATE)
      .sort((a, b) => a.observation_date.localeCompare(b.observation_date));

    const detailRows = [];
    for (const row of postAnchorRows) detailRows.push(await fetchObservationDetail(page, row));

    const resetRows = detailRows.filter((r) => r.reset_semantic_detected);
    const successorPlantingRows = detailRows.filter((r) => r.successor_planting_semantic_detected);

    const historicalHarvestObservability = areaRows.filter((r) => r.observation_date < ANCHOR_DATE && RESET_SEMANTIC.test(`${r.observation_type} ${r.list_comment}`));
    assert(historicalHarvestObservability.length > 0, 'T1R1_COVERAGE_HISTORICAL_HARVEST_OBSERVABILITY_REQUIRED');

    const global = await fetchProof(page, GLOBAL_INDEX_URL);
    const globalRows = await parseObservationRows(page);
    assert(globalRows.length > 0, 'T1R1_COVERAGE_GLOBAL_INDEX_ROWS_REQUIRED');
    const globalDates = globalRows.map((r) => r.observation_date).filter(Boolean).sort();

    const t1r1Dates = areaRows.map((r) => r.observation_date).sort();
    const latestT1R1PublishedDate = t1r1Dates.at(-1);
    const latestGlobalPublishedDate = globalDates.at(-1);

    write({
      schema_version: 'geox_mcft_cap09_t1r1_scope_coverage_reset_semantics_qualification_v1',
      status: 'PASS',
      subject_sha: SUBJECT_SHA,
      exact_base_main: EXPECTED_BASE_MAIN,
      qualification_time_utc: new Date().toISOString(),
      qualification_only_not_authority: true,
      predecessor: {
        positive_active_anchor_observation_id: ANCHOR_ID,
        positive_active_anchor_event_end_utc: ANCHOR_END_UTC,
        amendment_14_blob_sha: EXPECTED_A14_BLOB,
        original_layer2_probe_blob_sha: EXPECTED_ORIGINAL_LAYER2_PROBE_BLOB
      },
      t1r1_snapshot: {
        area_retrieved_at: area.proof.retrieved_at,
        area_response_sha256: area.proof.response_sha256,
        row_count: areaRows.length,
        pagination_observed: false,
        latest_published_observation_date: latestT1R1PublishedDate,
        retrieval_timestamp_is_scope_coverage_watermark: false,
        scope_specific_coverage_completeness_established: false,
        publication_lag_upper_bound_established: false
      },
      global_index_context: {
        retrieved_at: global.proof.retrieved_at,
        latest_published_observation_date_on_first_page: latestGlobalPublishedDate,
        global_freshness_is_t1r1_scope_coverage_proof: false
      },
      chronology: {
        observation_id_order_used_as_event_time_order: false,
        same_day_non_anchor_row_count: sameDayNonAnchorRows.length,
        same_day_event_chronology_resolved: sameDayNonAnchorRows.length === 0
      },
      reset_semantics: {
        post_anchor_row_count: postAnchorRows.length,
        post_anchor_detail_count: detailRows.length,
        every_post_anchor_row_detail_comment_classified: detailRows.length === postAnchorRows.length,
        detail_rows: detailRows,
        published_reset_semantic_count: resetRows.length,
        published_successor_planting_semantic_count: successorPlantingRows.length,
        no_published_reset_observed_as_of_retrieval: resetRows.length === 0 && successorPlantingRows.length === 0,
        historical_harvest_observability_count: historicalHarvestObservability.length,
        reset_semantic_classification_complete_for_retrieved_post_anchor_rows: detailRows.length === postAnchorRows.length
      },
      lifecycle_adjudication: {
        current_runtime_lifecycle_authority_established: false,
        bounded_active_validity_interval_beyond_anchor_established: false,
        active_valid_through_retrieval_time_established: false,
        future_forward_validity_hours: 0,
        future_forward_validity_established: false,
        future_target_wholly_inside_lifecycle_validity_established: false,
        exact_remaining_layer2_blocker: 'T1R1_SCOPE_COVERAGE_COMPLETENESS_UNRESOLVED',
        preferred_if_kbs_has_no_completeness_authority: 'DIRECT_CURRENT_ANCHOR_REFRESH'
      },
      hard_nonclaims: [
        'NO_RETRIEVAL_TIME_AS_COVERAGE_WATERMARK',
        'NO_GLOBAL_FRESHNESS_AS_T1R1_COMPLETENESS',
        'NO_OBSERVATION_ID_AS_EVENT_CHRONOLOGY',
        'NO_ACTIVE_VALID_THROUGH_RETRIEVAL',
        'NO_FORWARD_LIFECYCLE_LEASE',
        'NO_PHENOLOGY_INFERENCE',
        'NO_KC_RESOLUTION',
        'NO_FUTURE_LEGAL_T',
        'NO_EA5E2_GO'
      ],
      database_write_count: 0,
      formal_evidence_write_count: 0,
      raw_object_write_count: 0,
      runtime_config_write_count: 0,
      scheduler_write_count: 0,
      formal_window_started: false,
      formal_execution_count: '0/24'
    });
  } finally {
    await browser.close();
  }
}

try { await main(); }
catch (error) {
  write({
    schema_version: 'geox_mcft_cap09_t1r1_scope_coverage_reset_semantics_qualification_v1',
    status: 'FAIL',
    subject_sha: SUBJECT_SHA || null,
    error: safeError(error),
    current_runtime_lifecycle_authority_established: false,
    bounded_active_validity_interval_beyond_anchor_established: false,
    active_valid_through_retrieval_time_established: false,
    future_forward_validity_established: false,
    future_target_wholly_inside_lifecycle_validity_established: false,
    database_write_count: 0,
    formal_window_started: false,
    formal_execution_count: '0/24'
  });
  process.exitCode = 1;
}
