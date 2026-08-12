#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = path.join(ROOT, 'acceptance-output/MCFT_CAP_09_EA9B_CURRENT_MAIN_WINDOW_READINESS.json');
const SUBJECT_SHA = process.env.MCFT_SUBJECT_SHA || null;
const INDEX_URL = 'https://aglog.kbs.msu.edu/observations';
const ANCHOR_URL = 'https://aglog.kbs.msu.edu/observations/6931';
const ANCHOR_DATE = '2026-05-11';
const MAX_PAGES = 20;

function sha256(bytes) {
  return `sha256:${crypto.createHash('sha256').update(bytes).digest('hex')}`;
}
function normalize(value) {
  return String(value || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
}
function dateOnly(value) {
  const m = String(value || '').match(/\b(\d{4}-\d{2}-\d{2})\b/);
  return m ? m[1] : null;
}
function write(value) {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}
function assert(condition, code) {
  if (!condition) throw new Error(code);
}
function safeError(error) {
  return (error instanceof Error ? error.message : String(error)).replace(/https?:\/\/[^\s]+/g, '[URL_REDACTED]');
}

async function digestPage(page, url) {
  const requested = new URL(url);
  assert(requested.hostname === 'aglog.kbs.msu.edu', 'EA9B_WINDOW_OBSERVER_UNAPPROVED_HOST');
  const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 75_000 });
  assert(response?.ok(), `EA9B_WINDOW_OBSERVER_HTTP_${response?.status() ?? 'NO_RESPONSE'}`);
  const finalUrl = new URL(response.url());
  assert(finalUrl.hostname === 'aglog.kbs.msu.edu', 'EA9B_WINDOW_OBSERVER_REDIRECT_HOST_FORBIDDEN');
  const bytes = await response.body();
  return {
    response_sha256: sha256(bytes),
    response_bytes: bytes.byteLength,
    retrieved_at: new Date().toISOString()
  };
}

async function main() {
  assert(SUBJECT_SHA && /^[0-9a-f]{40}$/.test(SUBJECT_SHA), 'EA9B_WINDOW_OBSERVER_EXACT_SUBJECT_REQUIRED');

  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({
      userAgent: 'GEOX-MCFT-CAP09-EA9B-Current-Main-Window-Observer/1.0'
    });
    const page = await context.newPage();

    const anchorDigest = await digestPage(page, ANCHOR_URL);
    const anchorText = normalize(await page.locator('body').innerText()).toLowerCase();
    for (const marker of ['observation date', ANCHOR_DATE, 'areas', 't1', 'observation type', 'planting', 'corn']) {
      assert(anchorText.includes(marker.toLowerCase()), `EA9B_WINDOW_OBSERVER_ANCHOR_MARKER_MISSING:${marker}`);
    }

    const pageProofs = [];
    const candidates = [];
    let reachedAnchor = false;
    let totalRows = 0;

    for (let pageNumber = 1; pageNumber <= MAX_PAGES; pageNumber += 1) {
      const url = pageNumber === 1 ? INDEX_URL : `${INDEX_URL}?page=${pageNumber}`;
      const digest = await digestPage(page, url);
      const rows = page.locator('table tr');
      const rowCount = await rows.count();
      let parsedRows = 0;
      let minDate = null;
      let maxDate = null;

      for (let i = 0; i < rowCount; i += 1) {
        const cells = rows.nth(i).locator('td');
        const cellCount = await cells.count();
        if (cellCount < 6) continue;
        const values = [];
        for (let c = 0; c < cellCount; c += 1) values.push(normalize(await cells.nth(c).innerText()));
        const observationDate = dateOnly(values[0]);
        if (!observationDate) continue;
        parsedRows += 1;
        totalRows += 1;
        minDate = !minDate || observationDate < minDate ? observationDate : minDate;
        maxDate = !maxDate || observationDate > maxDate ? observationDate : maxDate;
        if (observationDate <= ANCHOR_DATE) reachedAnchor = true;

        const observationType = values[2] || '';
        const areas = values[4] || '';
        const postAnchor = observationDate > ANCHOR_DATE;
        const planting = observationType.toLowerCase().includes('planting');
        const t1 = /\bT1(?:R[1-6])?\b/i.test(areas);
        if (!(postAnchor && planting && t1)) continue;

        const links = rows.nth(i).locator('a[href*="/observations/"]');
        let observationId = null;
        for (let l = 0; l < await links.count(); l += 1) {
          const href = await links.nth(l).getAttribute('href');
          const match = String(href || '').match(/\/observations\/(\d+)/);
          if (match) { observationId = Number(match[1]); break; }
        }
        assert(Number.isInteger(observationId), 'EA9B_WINDOW_OBSERVER_CANDIDATE_MISSING_OBSERVATION_ID');

        const rowText = values.join(' ').toLowerCase();
        const cropTokens = ['corn', 'soybean', 'wheat', 'barley', 'rye', 'canola', 'sorghum']
          .filter((token) => new RegExp(`\\b${token}\\b`, 'i').test(rowText));

        candidates.push({
          provider_observation_id: observationId,
          observation_date: observationDate,
          provider_area_identity: areas,
          explicit_crop_tokens: [...new Set(cropTokens)].sort(),
          candidate_only_not_authority: true,
          provider_body_emitted: false
        });
      }

      pageProofs.push({
        page_number: pageNumber,
        parsed_observation_row_count: parsedRows,
        minimum_observation_date: minDate,
        maximum_observation_date: maxDate,
        provider_body_emitted: false,
        ...digest
      });

      if (reachedAnchor) break;
      assert(parsedRows > 0, `EA9B_WINDOW_OBSERVER_EMPTY_PAGE_BEFORE_ANCHOR:${pageNumber}`);
    }

    assert(reachedAnchor, 'EA9B_WINDOW_OBSERVER_SCAN_DID_NOT_REACH_ANCHOR');

    const unique = [...new Map(candidates.map((candidate) => [candidate.provider_observation_id, candidate])).values()]
      .sort((a, b) => a.provider_observation_id - b.provider_observation_id);

    const result = {
      schema_version: 'geox_mcft_cap09_ea9b_current_main_window_readiness_v1',
      status: 'PASS',
      subject_sha: SUBJECT_SHA,
      observed_at_utc: new Date().toISOString(),
      source: 'KBS_AGLOG',
      anchor_observation_id: 6931,
      anchor_observation_date: ANCHOR_DATE,
      scanned_index_page_count: pageProofs.length,
      scanned_observation_row_count: totalRows,
      scan_reached_anchor: reachedAnchor,
      candidate_count: unique.length,
      candidates: unique,
      readiness: unique.length > 0 ? 'CANDIDATE_DETECTED' : 'NO_NEW_CANDIDATE_CURRENTLY_OBSERVED',
      time_gated_snapshot: unique.length === 0,
      global_absence_claimed: false,
      new_season_created: false,
      new_season_id: null,
      new_crop_context_authority_established: false,
      successor_epoch_selected: false,
      ea5e2_operational_activation_qualified: false,
      ea5e3_effective: false,
      formal_execution_count: '0/24',
      provider_body_emitted: false,
      provider_payload_persisted_or_uploaded: false,
      database_write_count: 0,
      formal_evidence_write_count: 0,
      raw_object_write_count: 0,
      runtime_config_write_count: 0,
      scheduler_write_count: 0,
      canonical_runtime_write_count: 0,
      anchor_proof: anchorDigest,
      page_proofs: pageProofs
    };

    write(result);
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await browser.close();
  }
}

try {
  await main();
} catch (error) {
  const result = {
    schema_version: 'geox_mcft_cap09_ea9b_current_main_window_readiness_v1',
    status: 'FAIL',
    subject_sha: SUBJECT_SHA,
    observed_at_utc: new Date().toISOString(),
    error: safeError(error),
    provider_body_emitted: false,
    provider_payload_persisted_or_uploaded: false,
    database_write_count: 0,
    formal_evidence_write_count: 0,
    raw_object_write_count: 0,
    runtime_config_write_count: 0,
    scheduler_write_count: 0,
    canonical_runtime_write_count: 0,
    successor_epoch_selected: false,
    formal_execution_count: '0/24'
  };
  write(result);
  console.error(JSON.stringify(result, null, 2));
  process.exitCode = 1;
}
