#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const CONFIG_PATH = path.join(ROOT, 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-CURRENT-CROP-AUTHORITY-REQUALIFICATION-V1.json');
const OUT = path.join(ROOT, 'acceptance-output/MCFT_CAP_09_CURRENT_CROP_AUTHORITY_REQUALIFICATION_RESULT.json');
const SUBJECT_SHA = String(process.env.MCFT_SUBJECT_SHA || '').trim();
const CONFIG = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
const INDEX_URL = CONFIG.provider_scan.index_url;
const ANCHOR_URL = CONFIG.provider_scan.anchor_url;
const ANCHOR_DATE = CONFIG.formal_scope.planting_local_date;
const MAX_PAGES = CONFIG.provider_scan.maximum_pages;
const MAX_DETAILS = CONFIG.provider_scan.maximum_detail_candidates;

const PHENOLOGY_EVENT = /\b(observation|scouting|sampling)\b/i;
const TERMINATION_EVENT = /\b(harvest|mowing|termination|terminate)\b/i;
const PHENOLOGY_SEMANTICS = [
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
const CROP_TOKENS = ['corn', 'maize', 'soybean', 'wheat', 'barley', 'rye', 'canola', 'sorghum'];
const HYBRID_PATTERN = /\bP\d{4}[A-Z0-9-]*\b/g;

function sha256(bytes) {
  return `sha256:${crypto.createHash('sha256').update(bytes).digest('hex')}`;
}
function normalize(value) {
  return String(value || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
}
function dateOnly(value) {
  const match = String(value || '').match(/\b(\d{4}-\d{2}-\d{2})\b/);
  return match ? match[1] : null;
}
function assert(condition, code) {
  if (!condition) throw new Error(code);
}
function safeError(error) {
  return (error instanceof Error ? error.message : String(error)).replace(/https?:\/\/[^\s]+/g, '[URL_REDACTED]');
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
function tokensFromDetail(text) {
  const crop = CROP_TOKENS.filter((token) => new RegExp(`\\b${token}\\b`, 'i').test(text));
  const hybrids = [...new Set((text.match(HYBRID_PATTERN) || []).map((value) => value.toUpperCase()))].sort();
  const phenology = PHENOLOGY_SEMANTICS.filter(([, pattern]) => pattern.test(text)).map(([code]) => code);
  return {
    explicit_crop_tokens: [...new Set(crop)].sort(),
    explicit_hybrid_tokens: hybrids,
    phenology_semantic_tokens: phenology
  };
}
async function digestPage(page, url) {
  const requested = new URL(url);
  assert(requested.hostname === CONFIG.provider_scan.allowed_host, 'CURRENT_CROP_REQUAL_UNAPPROVED_HOST');
  const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 75_000 });
  assert(response?.ok(), `CURRENT_CROP_REQUAL_HTTP_${response?.status() ?? 'NO_RESPONSE'}`);
  const finalUrl = new URL(response.url());
  assert(finalUrl.hostname === CONFIG.provider_scan.allowed_host, 'CURRENT_CROP_REQUAL_REDIRECT_HOST_FORBIDDEN');
  const bytes = await response.body();
  return {
    response_sha256: sha256(bytes),
    response_bytes: bytes.byteLength,
    retrieved_at: new Date().toISOString()
  };
}

async function main() {
  assert(/^[0-9a-f]{40}$/.test(SUBJECT_SHA), 'CURRENT_CROP_REQUAL_EXACT_SUBJECT_REQUIRED');
  assert(CONFIG.frontier === 'S6-CURRENT-CROP-AUTHORITY-REQUALIFICATION', 'CURRENT_CROP_REQUAL_CONFIG_FRONTIER_MISMATCH');
  assert(CONFIG.season_lifecycle_policy.absence_of_termination_row_proves_active === false, 'CURRENT_CROP_REQUAL_ACTIVE_FROM_ABSENCE_FORBIDDEN');
  assert(CONFIG.season_lifecycle_policy.active_status_authorized_by_this_v1_probe === false, 'CURRENT_CROP_REQUAL_V1_ACTIVE_AUTHORITY_FORBIDDEN');
  assert(CONFIG.phenology_stage_policy.semantic_candidate_alone_resolves_current_stage === false, 'CURRENT_CROP_REQUAL_STAGE_FROM_TOKEN_FORBIDDEN');

  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ userAgent: 'GEOX-MCFT-CAP09-Current-Crop-Requalification/1.0' });
    const page = await context.newPage();

    const anchorProof = await digestPage(page, ANCHOR_URL);
    const anchorText = normalize(await page.locator('body').innerText());
    const anchorLower = anchorText.toLowerCase();
    for (const marker of ['observation date', ANCHOR_DATE, 'areas', 't1', 'observation type', 'planting', 'corn']) {
      assert(anchorLower.includes(marker.toLowerCase()), `CURRENT_CROP_REQUAL_ANCHOR_MARKER_MISSING:${marker}`);
    }

    const indexProofs = [];
    const detailLeads = [];
    let reachedAnchor = false;
    let totalRows = 0;

    for (let pageNumber = 1; pageNumber <= MAX_PAGES; pageNumber += 1) {
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
        const inT1 = /\bT1(?:R[1-6])?\b/i.test(areas);
        const interesting = PHENOLOGY_EVENT.test(observationType) || TERMINATION_EVENT.test(observationType);
        if (!inT1 || !interesting) continue;

        let observationId = null;
        const links = rows.nth(rowIndex).locator('a[href*="/observations/"]');
        for (let linkIndex = 0; linkIndex < await links.count(); linkIndex += 1) {
          const href = await links.nth(linkIndex).getAttribute('href');
          const match = String(href || '').match(/\/observations\/(\d+)/);
          if (match) { observationId = Number(match[1]); break; }
        }
        assert(Number.isInteger(observationId), 'CURRENT_CROP_REQUAL_DETAIL_ID_REQUIRED');
        detailLeads.push({
          provider_observation_id: observationId,
          observation_date: observationDate,
          observation_type: observationType,
          provider_area_identity: areas,
          index_phenology_event: PHENOLOGY_EVENT.test(observationType),
          index_termination_event: TERMINATION_EVENT.test(observationType)
        });
      }

      indexProofs.push({
        page_number: pageNumber,
        parsed_observation_row_count: parsedRows,
        minimum_observation_date: minimumDate,
        maximum_observation_date: maximumDate,
        provider_body_emitted: false,
        ...digest
      });
      if (reachedAnchor) break;
      assert(parsedRows > 0, `CURRENT_CROP_REQUAL_EMPTY_PAGE_BEFORE_ANCHOR:${pageNumber}`);
    }

    assert(reachedAnchor, 'CURRENT_CROP_REQUAL_SCAN_DID_NOT_REACH_ANCHOR');
    const uniqueLeads = uniqueById(detailLeads);
    assert(uniqueLeads.length <= MAX_DETAILS, 'CURRENT_CROP_REQUAL_DETAIL_LIMIT_EXCEEDED');

    const detailInspections = [];
    for (const lead of uniqueLeads) {
      const detailProof = await digestPage(page, `${INDEX_URL}/${lead.provider_observation_id}`);
      const detailText = normalize(await page.locator('body').innerText());
      const lower = detailText.toLowerCase();
      assert(lower.includes(lead.observation_date), 'CURRENT_CROP_REQUAL_DETAIL_DATE_MISMATCH');
      assert(/\bt1(?:r[1-6])?\b/i.test(detailText), 'CURRENT_CROP_REQUAL_DETAIL_T1_SCOPE_MISSING');
      const extracted = tokensFromDetail(detailText);
      detailInspections.push({
        ...lead,
        ...extracted,
        current_season_crop_binding_candidate: extracted.explicit_crop_tokens.includes('corn') || extracted.explicit_crop_tokens.includes('maize') || extracted.explicit_hybrid_tokens.includes('P0306Q'),
        phenology_semantic_candidate: extracted.phenology_semantic_tokens.length > 0,
        termination_semantic_candidate: lead.index_termination_event,
        candidate_only_not_authority: true,
        provider_body_emitted: false,
        ...detailProof
      });
    }

    const boundTermination = detailInspections.filter((item) => item.termination_semantic_candidate && item.current_season_crop_binding_candidate);
    const boundPhenology = detailInspections.filter((item) => item.phenology_semantic_candidate && item.current_season_crop_binding_candidate);
    const lifecycleStatus = boundTermination.length > 0 ? 'TERMINATED' : 'UNRESOLVED';
    const lifecycleReason = lifecycleStatus === 'TERMINATED'
      ? 'POSITIVE_CURRENT_SEASON_CORN_TERMINATION_EVIDENCE'
      : CONFIG.season_lifecycle_policy.fallback_reason;

    const phenologyStatus = 'UNRESOLVED';
    const modelParameterStatus = 'UNRESOLVED';
    const readinessBlocker = lifecycleStatus === 'TERMINATED'
      ? CONFIG.readiness_interpretation.terminated_blocker
      : CONFIG.readiness_interpretation.lifecycle_unresolved_blocker;

    const result = {
      schema_version: 'geox_mcft_cap09_current_crop_authority_requalification_result_v1',
      status: 'PASS',
      subject_sha: SUBJECT_SHA,
      authority_time_utc: new Date().toISOString(),
      authority_frontier: CONFIG.frontier,
      formal_scope: CONFIG.formal_scope,
      provider_scan: {
        source: 'KBS_AGLOG',
        scanned_index_page_count: indexProofs.length,
        scanned_observation_row_count: totalRows,
        scan_reached_anchor: reachedAnchor,
        current_season_detail_lead_count: uniqueLeads.length,
        inspected_current_season_detail_count: detailInspections.length,
        bound_phenology_candidate_count: boundPhenology.length,
        bound_termination_candidate_count: boundTermination.length,
        provider_body_emitted: false,
        provider_payload_persisted_or_uploaded: false,
        anchor_proof: anchorProof,
        page_proofs: indexProofs,
        current_season_detail_inspections: detailInspections
      },
      season_lifecycle_authority: {
        status: lifecycleStatus,
        management_lifecycle_not_biological_vitality: true,
        reason: lifecycleReason,
        active_established: false,
        terminated_established: lifecycleStatus === 'TERMINATED',
        absence_of_termination_used_to_prove_active: false,
        positive_termination_candidates: boundTermination
      },
      phenology_stage_authority: {
        status: phenologyStatus,
        stage: null,
        reason: CONFIG.phenology_stage_policy.fallback_reason,
        direct_semantic_candidates: boundPhenology,
        semantic_candidate_alone_used_as_stage: false,
        historical_six_model_authority_rewritten: false,
        bounded_gdd_terminal_proof_rewritten: false
      },
      crop_model_parameter_authority: {
        status: modelParameterStatus,
        parameter: 'Kc',
        kc: null,
        reason: CONFIG.crop_model_parameter_policy.fallback_reason,
        invented_from_lifecycle: false,
        invented_from_unmapped_phenology: false
      },
      ea5e2_readiness: {
        status: 'BLOCKED',
        blocker: readinessBlocker,
        diagnostic_causes: lifecycleStatus === 'UNRESOLVED'
          ? ['ACTIVE_LIFECYCLE_NOT_PROVEN_BY_PROVIDER_SILENCE', 'REQUIRED_PHENOLOGY_STAGE_UNRESOLVED', 'REQUIRED_CROP_MODEL_PARAMETER_AUTHORITY_UNRESOLVED']
          : ['CURRENT_SEASON_LIFECYCLE_TERMINATED'],
        legacy_no_future_legal_target_blocker_emitted: false,
        protected_main_live_dispatch_authorized: false,
        ea5e2_operational_activation_qualified: false
      },
      next_evidence_frontier: lifecycleStatus === 'TERMINATED'
        ? 'REAL_HISTORICAL_SEASON_RUNTIME_CORRECTNESS_QUALIFICATION_DESIGN_REVIEW'
        : 'CURRENT_SEASON_POSITIVE_LIFECYCLE_OR_STAGE_SOURCE_QUALIFICATION',
      database_write_count: 0,
      formal_evidence_write_count: 0,
      raw_object_write_count: 0,
      runtime_config_write_count: 0,
      scheduler_write_count: 0,
      canonical_runtime_write_count: 0,
      successor_epoch_selected: false,
      formal_window_started: false,
      formal_execution_count: '0/24'
    };

    write(result);
  } finally {
    await browser.close();
  }
}

try {
  await main();
} catch (error) {
  write({
    schema_version: 'geox_mcft_cap09_current_crop_authority_requalification_result_v1',
    status: 'FAIL',
    subject_sha: SUBJECT_SHA || null,
    error: safeError(error),
    protected_main_live_dispatch_authorized: false,
    ea5e2_operational_activation_qualified: false,
    database_write_count: 0,
    formal_window_started: false,
    formal_execution_count: '0/24'
  });
  process.exitCode = 1;
}
