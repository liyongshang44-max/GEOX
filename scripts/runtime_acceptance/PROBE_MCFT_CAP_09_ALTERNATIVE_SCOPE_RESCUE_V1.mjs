#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const CONFIG_PATH = path.join(ROOT, 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-ALTERNATIVE-SCOPE-RESCUE-V1.json');
const OUT = path.join(ROOT, 'acceptance-output/MCFT_CAP_09_ALTERNATIVE_SCOPE_RESCUE_V1.json');
const CONFIG = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
const SUBJECT_SHA = String(process.env.MCFT_SUBJECT_SHA || '').trim();
const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;
const TREATMENT_PATTERN = /^T[1-6]$/;
const PLANTING_EVENT = /\bplanting\b/i;
const TERMINATION_EVENT = /\b(harvest|termination|terminate|crop failure|abandonment)\b/i;
const HYBRID_PATTERNS = [/\bP\d{4}[A-Z0-9-]*\b/g, /\b\d{2}-\d{2}[A-Z]\b/g];

function requireCondition(condition, code) {
  if (!condition) throw new Error(code);
}
function normalize(value) {
  return String(value || '').replace(/\u00a0/g, ' ').replace(/[’‘]/g, "'").replace(/\s+/g, ' ').trim();
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
function canonicalHourAfter(milliseconds) {
  return Math.ceil(milliseconds / HOUR_MS) * HOUR_MS;
}
function plantingWindowUtc(localDate) {
  // KBS is in EDT (UTC-04:00) for the governed May-August 2026 season.
  const start = Date.parse(`${localDate}T04:00:00.000Z`);
  requireCondition(Number.isFinite(start), 'ALTERNATIVE_SCOPE_PLANTING_DATE_INVALID');
  return { start_inclusive_ms: start, end_exclusive_ms: start + DAY_MS };
}
function stageAtHours(hoursSincePlanting, variant) {
  if (hoursSincePlanting < 0) return null;
  const names = ['INITIAL', 'DEVELOPMENT', 'MID', 'LATE'];
  let cumulative = 0;
  for (let index = 0; index < variant.length; index += 1) {
    cumulative += Number(variant[index]) * 24;
    if (hoursSincePlanting < cumulative) return names[index];
  }
  return null;
}
function evaluateSlot(logicalTimeMs, planting) {
  const policy = CONFIG.whole_window_policy;
  const guardedStart = logicalTimeMs - policy.backward_stability_hours * HOUR_MS;
  const guardedEnd = logicalTimeMs + policy.forward_transition_guard_hours * HOUR_MS;
  const minimumAgeHours = (guardedStart - planting.end_exclusive_ms) / HOUR_MS;
  const maximumAgeHours = (guardedEnd - planting.start_inclusive_ms) / HOUR_MS;
  const stages = [];
  for (const variant of policy.variant_stage_lengths_days) {
    const startStage = stageAtHours(minimumAgeHours, variant);
    const endStage = stageAtHours(maximumAgeHours, variant);
    if (!startStage || startStage !== endStage) return null;
    stages.push(startStage);
  }
  return new Set(stages).size === 1 ? stages[0] : null;
}
function legalWindows(planting, earliestO00Ms) {
  const policy = CONFIG.whole_window_policy;
  const output = [];
  for (let offset = 0; offset <= policy.planning_search_horizon_hours; offset += 1) {
    const o00 = earliestO00Ms + offset * HOUR_MS;
    const slots = Array.from({ length: policy.exact_slot_count }, (_, index) => evaluateSlot(o00 + index * HOUR_MS, planting));
    if (slots.every(Boolean) && new Set(slots).size === 1) {
      output.push({
        o00: new Date(o00).toISOString(),
        o23: new Date(o00 + (policy.exact_slot_count - 1) * HOUR_MS).toISOString(),
        stage: slots[0],
      });
    }
  }
  return output;
}
function treatmentFromArea(value) {
  const tokens = normalize(value).toUpperCase().split(/\s+/).filter(Boolean);
  const matches = tokens.filter((token) => TREATMENT_PATTERN.test(token));
  return matches.length === 1 ? matches[0] : null;
}
function hybridTokens(text) {
  const values = [];
  for (const pattern of HYBRID_PATTERNS) values.push(...(text.match(pattern) || []));
  return [...new Set(values.map((value) => value.toUpperCase()))].sort();
}
function explicitR1Inclusion(text, treatment) {
  const lower = text.toLowerCase();
  if (new RegExp(`\\b${treatment.toLowerCase()}r1\\b`).test(lower)) return true;
  if (/\ball rep(?:lication)?s?\b/.test(lower)) return true;
  const order = lower.match(/(?:replications?|reps?)\s+(?:in\s+the\s+order\s+of\s+)?\(([^)]+)\)/)?.[1] || '';
  return order.split(/[^0-9]+/).includes('1');
}
function areaIdentitySet(values) {
  return new Set(values
    .map((value) => normalize(value).toUpperCase())
    .filter((value) => /^T[1-6]R[1-6]$/.test(value)));
}
function parserSelfcheck() {
  requireCondition(explicitR1Inclusion(
    'Planted corn in T4 plots, all replications in the order of (5, 3, 4, 2, 1, and 6).',
    'T4',
  ), 'ALTERNATIVE_SCOPE_ALL_REPLICATIONS_POSITIVE_CONTROL_FAILED');
  requireCondition(explicitR1Inclusion('Planted corn in T4R1.', 'T4'), 'ALTERNATIVE_SCOPE_EXACT_R1_POSITIVE_CONTROL_FAILED');
  requireCondition(!explicitR1Inclusion('Planted corn in T4R2 only.', 'T4'), 'ALTERNATIVE_SCOPE_R2_NEGATIVE_CONTROL_FAILED');
  const areas = areaIdentitySet(['T4', 'T4R1', ' T4R2 ', 'T4PrairieStrips', 'T4R1P']);
  requireCondition(areas.has('T4R1') && areas.has('T4R2'), 'ALTERNATIVE_SCOPE_AREA_IDENTITY_POSITIVE_CONTROL_FAILED');
  requireCondition(!areas.has('T4R1P') && !areas.has('T4PRAIRIESTRIPS'), 'ALTERNATIVE_SCOPE_AREA_IDENTITY_NEGATIVE_CONTROL_FAILED');
}
function rankCandidates(left, right) {
  return right.legal_o00_count - left.legal_o00_count
    || left.earliest_legal_o00.localeCompare(right.earliest_legal_o00)
    || left.planting_observation_id - right.planting_observation_id
    || left.treatment.localeCompare(right.treatment);
}
async function digestPage(page, url) {
  const requested = new URL(url);
  requireCondition(requested.protocol === 'https:' && requested.hostname === CONFIG.provider_scan.allowed_host, 'ALTERNATIVE_SCOPE_UNAPPROVED_HOST');
  const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 75_000 });
  requireCondition(response?.ok(), `ALTERNATIVE_SCOPE_HTTP_${response?.status() ?? 'NO_RESPONSE'}`);
  requireCondition(new URL(response.url()).hostname === CONFIG.provider_scan.allowed_host, 'ALTERNATIVE_SCOPE_REDIRECT_HOST_FORBIDDEN');
  const bytes = await response.body();
  return { response_sha256: sha256(bytes), response_bytes: bytes.byteLength, retrieved_at: new Date().toISOString() };
}

async function main() {
  requireCondition(/^[0-9a-f]{40}$/.test(SUBJECT_SHA), 'ALTERNATIVE_SCOPE_EXACT_SUBJECT_REQUIRED');
  requireCondition(CONFIG.frontier === 'S6-ALTERNATIVE-SCOPE-RESCUE', 'ALTERNATIVE_SCOPE_FRONTIER_DRIFT');
  requireCondition(CONFIG.selection_contract.locked_before_live_scan === true, 'ALTERNATIVE_SCOPE_SELECTION_NOT_PREDECLARED');
  requireCondition(CONFIG.selection_contract.preferred_treatment === null
    && CONFIG.selection_contract.preferred_field === null
    && CONFIG.selection_contract.preferred_hybrid === null, 'ALTERNATIVE_SCOPE_PREFERRED_OUTCOME_FORBIDDEN');
  parserSelfcheck();

  const observedAtMs = Date.now();
  const earliestO00Ms = canonicalHourAfter(observedAtMs + CONFIG.whole_window_policy.minimum_candidate_lead_hours * HOUR_MS);
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ userAgent: 'GEOX-MCFT-CAP09-Alternative-Scope-Rescue/1.0' });
    const page = await context.newPage();
    const areasProof = await digestPage(page, CONFIG.provider_scan.areas_url);
    // KBS renders the nested treatment tree collapsed, so visible innerText omits
    // replicate anchors. Bind to exact provider area anchor identities instead.
    const areaIdentities = areaIdentitySet(await page.locator('a[href*="/areas/"]').allTextContents());
    for (const treatment of CONFIG.selection_contract.eligible_treatments) {
      requireCondition(areaIdentities.has(`${treatment}R1`), `ALTERNATIVE_SCOPE_PROVIDER_R1_AREA_MISSING:${treatment}`);
    }
    const pageProofs = [];
    const plantingLeads = [];
    const terminationLeads = [];
    let reachedSeasonStart = false;
    let totalRows = 0;

    for (let pageNumber = 1; pageNumber <= CONFIG.provider_scan.maximum_pages; pageNumber += 1) {
      const url = pageNumber === 1 ? CONFIG.provider_scan.index_url : `${CONFIG.provider_scan.index_url}?page=${pageNumber}`;
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
        if (observationDate < CONFIG.provider_scan.season_scan_start_local_date) reachedSeasonStart = true;
        if (observationDate < CONFIG.provider_scan.season_scan_start_local_date) continue;
        const observationType = values[2] || '';
        const providerArea = values[4] || '';
        const treatment = treatmentFromArea(providerArea);
        if (!treatment) continue;
        const links = rows.nth(rowIndex).locator('a[href*="/observations/"]');
        let observationId = null;
        for (let linkIndex = 0; linkIndex < await links.count(); linkIndex += 1) {
          const match = String(await links.nth(linkIndex).getAttribute('href') || '').match(/\/observations\/(\d+)/);
          if (match) { observationId = Number(match[1]); break; }
        }
        requireCondition(Number.isInteger(observationId), 'ALTERNATIVE_SCOPE_OBSERVATION_ID_REQUIRED');
        const lead = { provider_observation_id: observationId, observation_date: observationDate, observation_type: observationType, provider_area_identity: providerArea, treatment };
        if (PLANTING_EVENT.test(observationType)) plantingLeads.push(lead);
        if (TERMINATION_EVENT.test(observationType)) terminationLeads.push(lead);
      }
      pageProofs.push({ page_number: pageNumber, parsed_observation_row_count: parsedRows, minimum_observation_date: minimumDate, maximum_observation_date: maximumDate, provider_body_emitted: false, ...digest });
      if (reachedSeasonStart) break;
      requireCondition(parsedRows > 0, `ALTERNATIVE_SCOPE_EMPTY_PAGE_BEFORE_SEASON_START:${pageNumber}`);
    }
    requireCondition(reachedSeasonStart, 'ALTERNATIVE_SCOPE_SCAN_DID_NOT_CROSS_SEASON_START');

    const uniquePlantingLeads = [...new Map(plantingLeads.map((lead) => [lead.provider_observation_id, lead])).values()];
    requireCondition(uniquePlantingLeads.length <= CONFIG.provider_scan.maximum_detail_candidates, 'ALTERNATIVE_SCOPE_DETAIL_LIMIT_EXCEEDED');
    const inspected = [];
    for (const lead of uniquePlantingLeads) {
      const detailUrl = `${CONFIG.provider_scan.index_url}/${lead.provider_observation_id}`;
      const detailProof = await digestPage(page, detailUrl);
      // Planting notes can be present in provider DOM sections that are not
      // currently visible. Read DOM text without persisting or emitting it.
      const detailText = normalize(await page.locator('body').textContent());
      const lower = detailText.toLowerCase();
      requireCondition(detailText.includes(lead.observation_date), 'ALTERNATIVE_SCOPE_DETAIL_DATE_MISMATCH');
      requireCondition(new RegExp(`\\b${lead.treatment}\\b`, 'i').test(detailText), 'ALTERNATIVE_SCOPE_DETAIL_TREATMENT_MISSING');
      const cropBound = CONFIG.selection_contract.required_crop_tokens.some((token) => new RegExp(`\\b${token}\\b`, 'i').test(detailText));
      const hybrids = hybridTokens(detailText);
      const r1Bound = explicitR1Inclusion(detailText, lead.treatment) && areaIdentities.has(`${lead.treatment}R1`);
      const planting = plantingWindowUtc(lead.observation_date);
      const lifecycleHorizonEndMs = planting.end_exclusive_ms + CONFIG.lifecycle_candidate_policy.maximum_maize_grain_horizon_days * DAY_MS;
      const windows = legalWindows(planting, earliestO00Ms).filter((window) => Date.parse(window.o23) < lifecycleHorizonEndMs);
      const treatmentTerminations = terminationLeads.filter((item) => item.treatment === lead.treatment && item.observation_date >= lead.observation_date);
      const eligible = cropBound && hybrids.length > 0 && r1Bound && windows.length > 0 && observedAtMs < lifecycleHorizonEndMs;
      inspected.push({
        planting_observation_id: lead.provider_observation_id,
        planting_local_date: lead.observation_date,
        provider_area_identity: lead.provider_area_identity,
        treatment: lead.treatment,
        replicate: 'R1',
        crop: cropBound ? 'corn' : null,
        explicit_hybrid_identity_tokens: hybrids,
        explicit_r1_inclusion: r1Bound,
        provider_r1_area_identity_present: areaIdentities.has(`${lead.treatment}R1`),
        lifecycle_horizon_end_exclusive: new Date(lifecycleHorizonEndMs).toISOString(),
        termination_candidate_count: treatmentTerminations.length,
        absence_of_termination_used_as_active_proof: false,
        legal_o00_count: windows.length,
        earliest_legal_o00: windows[0]?.o00 ?? null,
        latest_legal_o00: windows.at(-1)?.o00 ?? null,
        planned_stage: windows[0]?.stage ?? null,
        geometry_qualification_mode: ['T3', 'T4'].includes(lead.treatment)
          ? 'FRESH_CONSERVATIVE_CROP_ONLY_SUBZONE_REQUIRED'
          : 'FRESH_PROVIDER_MAIN_POLYGON_AND_CROP_ONLY_SCOPE_QUALIFICATION_REQUIRED',
        candidate_eligibility_status: eligible ? 'ELIGIBLE_FOR_SEPARATE_REQUALIFICATION' : 'NOT_CURRENTLY_ELIGIBLE',
        candidate_only_not_authority: true,
        provider_body_emitted: false,
        ...detailProof,
      });
    }

    const eligibleCandidates = inspected.filter((candidate) => candidate.candidate_eligibility_status === 'ELIGIBLE_FOR_SEPARATE_REQUALIFICATION').sort(rankCandidates);
    const selected = eligibleCandidates[0] ? {
      ...eligibleCandidates[0],
      prospective_site_id: `KBS_MCSE_${eligibleCandidates[0].treatment}R1_CANDIDATE`,
      prospective_field_id: `field_kbs_mcse_${eligibleCandidates[0].treatment.toLowerCase()}r1`,
      deterministic_rank: 1,
      lifecycle_authority_status: 'QUALIFICATION_REQUIRED',
      geometry_authority_status: 'QUALIFICATION_REQUIRED',
      source_rebind_authority_status: 'QUALIFICATION_REQUIRED',
      alternative_scope_authority_created: false,
    } : null;
    const terminalResult = selected
      ? 'ALTERNATIVE_SCOPE_CANDIDATE_DETECTED_REQUALIFICATION_REQUIRED'
      : 'NO_ALTERNATIVE_SCOPE_CANDIDATE_CURRENTLY_ESTABLISHED';

    write({
      schema_version: 'geox_mcft_cap09_alternative_scope_rescue_result_v1',
      status: 'PASS',
      result: terminalResult,
      subject_sha: SUBJECT_SHA,
      observed_at_utc: new Date(observedAtMs).toISOString(),
      earliest_planned_o00_utc: new Date(earliestO00Ms).toISOString(),
      selection_contract_locked_before_live_scan: true,
      preferred_treatment_used: false,
      provider_scan: {
        source: 'KBS_AGLOG',
        scanned_index_page_count: pageProofs.length,
        scanned_observation_row_count: totalRows,
        scan_crossed_season_start: reachedSeasonStart,
        planting_lead_count: uniquePlantingLeads.length,
        inspected_candidate_count: inspected.length,
        eligible_candidate_count: eligibleCandidates.length,
        page_proofs: pageProofs,
        areas_proof: areasProof,
        provider_body_emitted: false,
        provider_payload_persisted_or_uploaded: false,
      },
      candidates: inspected.sort((left, right) => left.planting_observation_id - right.planting_observation_id),
      selected_candidate: selected,
      alternative_scope_authority_created: false,
      lifecycle_authority_created: false,
      geometry_authority_created: false,
      source_rebind_authority_created: false,
      whole_window_authority_passed: false,
      successor_epoch_selected: false,
      v4_qualification_store_opened: false,
      database_write_count: 0,
      raw_object_write_count: 0,
      runtime_config_write_count: 0,
      scheduler_write_count: 0,
      formal_execution_count: '0/24',
      mcft_cap09_completed: false,
    });
  } finally {
    await browser.close();
  }
}

try {
  await main();
} catch (error) {
  write({
    schema_version: 'geox_mcft_cap09_alternative_scope_rescue_result_v1',
    status: 'FAIL',
    subject_sha: SUBJECT_SHA || null,
    error: safeError(error),
    alternative_scope_authority_created: false,
    v4_qualification_store_opened: false,
    database_write_count: 0,
    formal_execution_count: '0/24',
    mcft_cap09_completed: false,
  });
  process.exitCode = 1;
}
