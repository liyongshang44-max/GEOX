#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const CONFIG_PATH = path.join(ROOT, 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-T4R1-CONTEMPORANEOUS-STAGE-INPUT-REQUALIFICATION-V1.json');
const OUT = path.join(ROOT, 'acceptance-output/MCFT_CAP_09_T4R1_CONTEMPORANEOUS_STAGE_INPUT_REQUALIFICATION_V1.json');
const CONFIG = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
const SUBJECT_SHA = String(process.env.MCFT_SUBJECT_SHA || '').trim();
const { index_url: INDEX_URL, anchor_url: ANCHOR_URL, allowed_host: ALLOWED_HOST } = CONFIG.provider_scan;
const ANCHOR_DATE = CONFIG.formal_scope.planting_local_date;
const AREA_PATTERN = /\bT4(?:R1)?\b/i;
const ALL_REPS_PATTERN = /\ball\s+rep(?:s|lications)\b/i;
const REP1_PATTERN = /\breps?\b[^.]{0,140}\b1\b/i;
const CROP_PATTERN = /\b(corn|maize|43-96P)\b/i;
const TERMINATION_PATTERN = /\b(harvest|harvested|termination|terminated|terminate)\b/i;
const PHENOLOGY_SEMANTICS = [
  ['EMERGENCE', /\bemerg(?:e|ed|ence|ing)\b/i],
  ['TASSELING', /\btassel(?:ed|ing|s)?\b/i],
  ['SILKING', /\bsilk(?:ed|ing|s)?\b/i],
  ['BLISTER', /\bblister(?:ed|ing)?(?:\s+stage)?\b/i],
  ['MILK_STAGE', /\bmilk\s+stage\b/i],
  ['DOUGH_STAGE', /\bdough\s+stage\b/i],
  ['DENT_STAGE', /\bdent(?:ed|ing)?(?:\s+stage)?\b/i],
  ['PHYSIOLOGICAL_MATURITY', /\bphysiological\s+maturity\b/i],
  ['BLACK_LAYER', /\bblack\s+layer\b/i],
  ['SENESCENCE', /\bsenesc(?:ence|ent|ing)\b/i]
];

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
function semanticTokens(comment) {
  return PHENOLOGY_SEMANTICS.filter(([, pattern]) => pattern.test(comment)).map(([code]) => code);
}
function exactT4R1Applicability(areas, comment) {
  if (/\bT4R1\b/i.test(areas)) return { exact: true, basis: 'EXACT_T4R1_DETAIL_AREA' };
  if (/\bT4\b/i.test(areas) && ALL_REPS_PATTERN.test(comment) && REP1_PATTERN.test(comment)) {
    return { exact: true, basis: 'PARENT_T4_ALL_REPLICATIONS_EXPLICITLY_INCLUDING_R1' };
  }
  return { exact: false, basis: 'T4R1_EXACT_APPLICABILITY_NOT_PROVED' };
}
async function digestPage(page, url) {
  const requested = new URL(url);
  requireCondition(requested.protocol === 'https:' && requested.hostname === ALLOWED_HOST, 'T4R1_STAGE_INPUT_UNAPPROVED_HOST');
  const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 75_000 });
  requireCondition(response?.ok(), `T4R1_STAGE_INPUT_HTTP_${response?.status() ?? 'NO_RESPONSE'}`);
  requireCondition(new URL(response.url()).hostname === ALLOWED_HOST, 'T4R1_STAGE_INPUT_REDIRECT_HOST_FORBIDDEN');
  const bytes = await response.body();
  return { response_sha256: sha256(bytes), response_bytes: bytes.byteLength, retrieved_at: new Date().toISOString() };
}

async function main() {
  requireCondition(/^[0-9a-f]{40}$/.test(SUBJECT_SHA), 'T4R1_STAGE_INPUT_EXACT_SUBJECT_REQUIRED');
  requireCondition(CONFIG.frontier === 'T4R1_CONTEMPORANEOUS_STAGE_INPUT_REQUALIFICATION', 'T4R1_STAGE_INPUT_FRONTIER_DRIFT');
  requireCondition(CONFIG.stage_requalification_policy.semantic_candidate_alone_resolves_stage === false, 'T4R1_STAGE_INPUT_TOKEN_STAGE_FORBIDDEN');
  requireCondition(CONFIG.stage_requalification_policy.elapsed_calendar_time_resolves_stage === false, 'T4R1_STAGE_INPUT_CALENDAR_STAGE_FORBIDDEN');
  requireCondition(CONFIG.stage_requalification_policy.minimum_backward_stability_hours === 6, 'T4R1_STAGE_INPUT_6H_GUARD_REQUIRED');
  requireCondition(CONFIG.stage_requalification_policy.minimum_forward_transition_guard_hours === 30, 'T4R1_STAGE_INPUT_30H_GUARD_REQUIRED');

  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ userAgent: 'GEOX-MCFT-CAP09-T4R1-Stage-Input-Requalification/1.0' });
    const page = await context.newPage();

    const anchorProof = await digestPage(page, ANCHOR_URL);
    const anchorText = normalize(await page.locator('body').innerText());
    for (const marker of ['Observation Date', ANCHOR_DATE, 'Areas', 'T4', 'Observation Type', 'Planting', 'corn', '43-96P']) {
      requireCondition(anchorText.toLowerCase().includes(marker.toLowerCase()), `T4R1_STAGE_INPUT_ANCHOR_MARKER_MISSING:${marker}`);
    }

    const pageProofs = [];
    const leads = [];
    let reachedAnchor = false;
    let totalRows = 0;

    for (let pageNumber = 1; pageNumber <= CONFIG.provider_scan.maximum_pages; pageNumber += 1) {
      const url = pageNumber === 1 ? INDEX_URL : `${INDEX_URL}?page=${pageNumber}`;
      const digest = await digestPage(page, url);
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
        if (!AREA_PATTERN.test(areas)) continue;

        const links = rows.nth(rowIndex).locator('a[href*="/observations/"]');
        let observationId = null;
        for (let linkIndex = 0; linkIndex < await links.count(); linkIndex += 1) {
          const match = String(await links.nth(linkIndex).getAttribute('href') || '').match(/\/observations\/(\d+)/);
          if (match) {
            observationId = Number(match[1]);
            break;
          }
        }
        requireCondition(Number.isInteger(observationId), 'T4R1_STAGE_INPUT_DETAIL_ID_REQUIRED');
        leads.push({
          provider_observation_id: observationId,
          observation_date: observationDate,
          observation_type: observationType,
          index_area_identity: areas
        });
      }

      pageProofs.push({
        page_number: pageNumber,
        parsed_observation_row_count: parsedRows,
        minimum_observation_date: minimumDate,
        maximum_observation_date: maximumDate,
        provider_body_emitted: false,
        ...digest
      });

      if (reachedAnchor) break;
      requireCondition(parsedRows > 0, `T4R1_STAGE_INPUT_EMPTY_PAGE_BEFORE_ANCHOR:${pageNumber}`);
    }

    requireCondition(reachedAnchor, 'T4R1_STAGE_INPUT_SCAN_DID_NOT_REACH_ANCHOR');
    const uniqueLeads = uniqueById(leads);
    requireCondition(uniqueLeads.length <= CONFIG.provider_scan.maximum_detail_candidates, 'T4R1_STAGE_INPUT_DETAIL_LIMIT_EXCEEDED');

    const inspections = [];
    for (const lead of uniqueLeads) {
      const detailProof = await digestPage(page, `${INDEX_URL}/${lead.provider_observation_id}`);
      const detailText = normalize(await page.locator('body').innerText());
      const comment = section(detailText, 'Comment:', 'Areas:');
      const areas = section(detailText, 'Areas:', 'Observation Type:');
      const detailObservationType = section(detailText, 'Observation Type:', 'Activities:');

      requireCondition(detailText.includes(lead.observation_date), 'T4R1_STAGE_INPUT_DETAIL_DATE_MISMATCH');
      requireCondition(detailObservationType.length > 0, 'T4R1_STAGE_INPUT_DETAIL_TYPE_MISSING');

      const applicability = exactT4R1Applicability(areas, comment);
      const cropBound = CROP_PATTERN.test(comment);
      const phenology = semanticTokens(comment);
      const termination = TERMINATION_PATTERN.test(detailObservationType) || TERMINATION_PATTERN.test(comment);

      inspections.push({
        ...lead,
        detail_observation_type: detailObservationType,
        detail_area_identity: areas,
        exact_t4r1_applicability: applicability.exact,
        exact_t4r1_applicability_basis: applicability.basis,
        current_season_corn_binding_candidate: cropBound,
        phenology_semantic_tokens: phenology,
        direct_stage_input_candidate: applicability.exact && cropBound && phenology.length > 0,
        termination_input_candidate: applicability.exact && cropBound && termination,
        semantic_candidate_alone_used_as_stage: false,
        elapsed_calendar_time_used_as_stage: false,
        requires_separate_mapping_and_6h_30h_guard_proof: true,
        provider_body_emitted: false,
        ...detailProof
      });
    }

    const stageCandidates = inspections.filter((item) => item.direct_stage_input_candidate);
    const terminationCandidates = inspections.filter((item) => item.termination_input_candidate);
    const result = stageCandidates.length > 0
      ? 'T4R1_CONTEMPORANEOUS_STAGE_INPUT_CANDIDATE_DETECTED_MAPPING_AND_GUARD_PROOF_REQUIRED'
      : terminationCandidates.length > 0
        ? 'T4R1_TERMINATION_INPUT_CANDIDATE_DETECTED_LIFECYCLE_REQUALIFICATION_REQUIRED'
        : 'NO_T4R1_CONTEMPORANEOUS_STAGE_INPUT_AUTHORITY_CURRENTLY_ESTABLISHED';

    write({
      schema_version: 'geox_mcft_cap09_t4r1_contemporaneous_stage_input_requalification_result_v1',
      status: 'PASS',
      result,
      subject_sha: SUBJECT_SHA,
      observed_at_utc: new Date().toISOString(),
      formal_scope: CONFIG.formal_scope,
      provider_scan: {
        source: 'KBS_AGLOG',
        scanned_index_page_count: pageProofs.length,
        scanned_observation_row_count: totalRows,
        scan_reached_anchor: reachedAnchor,
        inspected_detail_count: inspections.length,
        direct_stage_input_candidate_count: stageCandidates.length,
        termination_input_candidate_count: terminationCandidates.length,
        inspections,
        anchor_proof: anchorProof,
        page_proofs: pageProofs,
        provider_body_emitted: false,
        provider_payload_persisted_or_uploaded: false
      },
      stage_authority: {
        status: 'UNRESOLVED',
        stage: null,
        backward_stability_hours_required: 6,
        forward_transition_guard_hours_required: 30,
        whole_window_guard_passed: false,
        semantic_candidate_alone_used_as_stage: false,
        elapsed_calendar_time_used_as_stage: false
      },
      lifecycle_authority_mutated: false,
      natural_season_authority_created: false,
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
      mcft_cap09_completed: false
    });
  } finally {
    await browser.close();
  }
}

try {
  await main();
} catch (error) {
  write({
    schema_version: 'geox_mcft_cap09_t4r1_contemporaneous_stage_input_requalification_result_v1',
    status: 'FAIL',
    subject_sha: SUBJECT_SHA || null,
    error: safeError(error),
    stage_authority: {
      status: 'UNRESOLVED',
      stage: null,
      backward_stability_hours_required: 6,
      forward_transition_guard_hours_required: 30,
      whole_window_guard_passed: false
    },
    database_write_count: 0,
    runtime_process_start: false,
    formal_execution_count: '0/24',
    mcft_cap09_completed: false
  });
  process.exitCode = 1;
}
