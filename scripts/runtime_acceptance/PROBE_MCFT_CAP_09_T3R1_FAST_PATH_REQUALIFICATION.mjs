#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const CONFIG_PATH = path.join(ROOT, 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-T3R1-FAST-PATH-REQUALIFICATION-V1.json');
const OUT = path.join(ROOT, 'acceptance-output/MCFT_CAP_09_T3R1_FAST_PATH_REQUALIFICATION_RESULT.json');
const SUBJECT_SHA = String(process.env.MCFT_SUBJECT_SHA || '').trim();
const CONFIG = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
const EA1J = JSON.parse(fs.readFileSync(path.join(ROOT, CONFIG.stage_and_kc_policy.stage_authority_path), 'utf8'));
const CONFIG_MATRIX = JSON.parse(fs.readFileSync(path.join(ROOT, CONFIG.stage_and_kc_policy.configuration_matrix_path), 'utf8'));
const HOUR_MS = 60 * 60 * 1000;

const POSITIVE_MANAGEMENT_EVENT = /\b(planting|fertilizer application|herbicide application|fungicide application|insecticide application|mechanical weed control|irrigation|cultivation)\b/i;
const TERMINATION_EVENT = /\b(harvest|termination|terminate)\b/i;
const CORN_TOKEN = /\b(corn|maize)\b/i;
const HYBRID_TOKEN = /\bP0306Q\b/i;

function assert(condition, code) {
  if (!condition) throw new Error(code);
}
function sha256(bytes) {
  return `sha256:${crypto.createHash('sha256').update(bytes).digest('hex')}`;
}
function normalize(value) {
  return String(value || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
}
function normalizeKey(value) {
  return normalize(value).replace(/^\uFEFF/, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}
function dateOnly(value) {
  const match = String(value || '').match(/\b(\d{4}-\d{2}-\d{2})\b/);
  return match ? match[1] : null;
}
function safeError(error) {
  return (error instanceof Error ? error.message : String(error)).replace(/https?:\/\/[^\s]+/g, '[URL_REDACTED]');
}
function write(value) {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify(value));
}
function parseDelimitedLine(line, delimiter) {
  const output = [];
  let value = '';
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (quoted && line[index + 1] === '"') { value += '"'; index += 1; }
      else quoted = !quoted;
    } else if (char === delimiter && !quoted) {
      output.push(value); value = '';
    } else value += char;
  }
  output.push(value);
  return output;
}
function parseTable(text, requiredColumns) {
  const lines = String(text).split(/\r?\n/);
  const delimiters = [',', '\t', ';', '|'];
  let headers = null;
  let delimiter = null;
  let headerIndex = -1;
  for (let index = 0, nonempty = 0; index < lines.length && nonempty < 40; index += 1) {
    if (!lines[index].trim()) continue;
    nonempty += 1;
    for (const candidate of delimiters) {
      const cells = parseDelimitedLine(lines[index], candidate).map(normalizeKey);
      if (requiredColumns.every((column) => cells.includes(column))) {
        headers = cells; delimiter = candidate; headerIndex = index; break;
      }
    }
    if (headers) break;
  }
  assert(headers && delimiter, 'T3R1_REQUIRED_CSV_HEADER_NOT_FOUND');
  const rows = [];
  for (const line of lines.slice(headerIndex + 1)) {
    if (!line.trim()) continue;
    const cells = parseDelimitedLine(line, delimiter);
    if (cells.length < headers.length) continue;
    const row = {};
    headers.forEach((header, index) => { row[header] = cells[index] ?? ''; });
    rows.push(row);
  }
  assert(rows.length > 0, 'T3R1_CSV_ROWS_REQUIRED');
  return rows;
}
function simplePolygonMetadata(raw, requiredSrid) {
  const value = String(raw || '').trim();
  if (!value) return { present: false, valid_simple_polygon: false, srid: null, vertex_count: 0, geometry_sha256: null };
  const match = value.match(/^SRID=(\d+);POLYGON\(\(([^()]+)\)\)$/i);
  if (!match) return { present: true, valid_simple_polygon: false, srid: null, vertex_count: 0, geometry_sha256: sha256(value) };
  const srid = Number(match[1]);
  const points = match[2].split(',').map((token) => token.trim().split(/\s+/).map(Number));
  const valid = srid === requiredSrid
    && points.length >= 4
    && points.every((point) => point.length === 2 && point.every(Number.isFinite))
    && points.every(([lon, lat]) => lon >= -180 && lon <= 180 && lat >= -90 && lat <= 90)
    && points[0][0] === points.at(-1)[0]
    && points[0][1] === points.at(-1)[1];
  return {
    present: true,
    valid_simple_polygon: valid,
    srid,
    vertex_count: Math.max(0, points.length - 1),
    geometry_sha256: sha256(value)
  };
}
async function digestPage(page, url, expectedHost) {
  const requested = new URL(url);
  assert(requested.protocol === 'https:' && requested.hostname === expectedHost, 'T3R1_UNAPPROVED_HOST');
  const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 75_000 });
  assert(response?.ok(), `T3R1_HTTP_${response?.status() ?? 'NO_RESPONSE'}`);
  const finalUrl = new URL(response.url());
  assert(finalUrl.protocol === 'https:' && finalUrl.hostname === expectedHost, 'T3R1_REDIRECT_HOST_FORBIDDEN');
  const bytes = await response.body();
  return { response_sha256: sha256(bytes), response_bytes: bytes.byteLength, retrieved_at: new Date().toISOString() };
}
function observationIdFromRow(row) {
  const hrefs = row.locator('a[href*="/observations/"]');
  return (async () => {
    for (let i = 0; i < await hrefs.count(); i += 1) {
      const href = await hrefs.nth(i).getAttribute('href');
      const match = String(href || '').match(/\/observations\/(\d+)/);
      if (match) return Number(match[1]);
    }
    return null;
  })();
}
function uniqueById(items) {
  return [...new Map(items.map((item) => [item.provider_observation_id, item])).values()]
    .sort((a, b) => a.observation_date.localeCompare(b.observation_date) || a.provider_observation_id - b.provider_observation_id);
}
function intervalStage(variant, minimumElapsedHours, maximumElapsedHours) {
  const stages = [
    ['INITIAL', 0, variant.initial_days * 24],
    ['DEVELOPMENT', variant.initial_days * 24, (variant.initial_days + variant.development_days) * 24],
    ['MID', (variant.initial_days + variant.development_days) * 24, (variant.initial_days + variant.development_days + variant.mid_days) * 24],
    ['LATE', (variant.initial_days + variant.development_days + variant.mid_days) * 24, variant.total_days * 24]
  ];
  for (const [stage, start, end] of stages) {
    if (minimumElapsedHours >= start && maximumElapsedHours < end) return stage;
  }
  return null;
}
function evaluateTarget(targetMs, variants, plantingStartMs, plantingEndExclusiveMs) {
  const backwardMs = CONFIG.stage_and_kc_policy.backward_stability_hours * HOUR_MS;
  const forwardMs = CONFIG.stage_and_kc_policy.forward_transition_guard_hours * HOUR_MS;
  const minimumElapsedHours = (targetMs - backwardMs - plantingEndExclusiveMs) / HOUR_MS;
  const maximumElapsedHours = (targetMs + forwardMs - plantingStartMs) / HOUR_MS;
  const evaluations = variants.map((variant) => ({
    variant_id: variant.variant_id,
    stage: intervalStage(variant, minimumElapsedHours, maximumElapsedHours)
  }));
  const stages = [...new Set(evaluations.map((entry) => entry.stage))];
  const consensusStage = stages.length === 1 && stages[0] !== null ? stages[0] : null;
  return {
    target_utc: new Date(targetMs).toISOString(),
    minimum_elapsed_hours: Number(minimumElapsedHours.toFixed(6)),
    maximum_elapsed_hours: Number(maximumElapsedHours.toFixed(6)),
    consensus_stage: consensusStage,
    variant_evaluations: evaluations
  };
}
function resolveKc(stage) {
  const source = CONFIG_MATRIX.configuration_source_definitions.find((item) => item.configuration_source_id === CONFIG.stage_and_kc_policy.configuration_source_id);
  assert(source, 'T3R1_KC_CONFIGURATION_SOURCE_REQUIRED');
  const schedule = source.parameters?.kc_schedule?.value;
  assert(Array.isArray(schedule), 'T3R1_KC_SCHEDULE_REQUIRED');
  const matches = schedule.filter((entry) => entry.stage_code === stage && Number.isFinite(Number(entry.kc)));
  assert(matches.length === 1, 'T3R1_KC_STAGE_MAPPING_MUST_BE_UNIQUE');
  return {
    configuration_source_id: source.configuration_source_id,
    configuration_semantic_hash: source.configuration_semantic_hash,
    stage_code: stage,
    kc: Number(matches[0].kc)
  };
}

async function main() {
  assert(/^[0-9a-f]{40}$/.test(SUBJECT_SHA), 'T3R1_EXACT_SUBJECT_REQUIRED');
  assert(CONFIG.frontier === 'S6-T3R1-FAST-PATH-REQUALIFICATION', 'T3R1_FRONTIER_MISMATCH');
  assert(CONFIG.stage_and_kc_policy.stage_algorithm_id === 'FAO56_MAIZE_GRAIN_CONSENSUS_ENVELOPE_FROM_PLANTING_DATE_V1', 'T3R1_STAGE_ALGORITHM_ID_MISMATCH');
  assert(CONFIG.lifecycle_policy.absence_of_termination_row_proves_active === false, 'T3R1_ACTIVE_FROM_SILENCE_FORBIDDEN');
  assert(CONFIG.lifecycle_policy.current_active_authorized_by_this_probe === false, 'T3R1_PREMATURE_ACTIVE_AUTHORITY_FORBIDDEN');
  assert(CONFIG.geometry_discovery.crop_only_zone_policy.whole_t3r1_polygon_may_not_be_assumed_crop_only === true, 'T3R1_WHOLE_PLOT_CROP_ONLY_FORBIDDEN');
  assert(EA1J.derivation_policy.algorithm_id === CONFIG.stage_and_kc_policy.stage_algorithm_id, 'T3R1_EA1J_ALGORITHM_MISMATCH');
  assert(EA1J.derivation_policy.backward_stability_hours === CONFIG.stage_and_kc_policy.backward_stability_hours, 'T3R1_EA1J_BACKWARD_GUARD_MISMATCH');
  assert(EA1J.derivation_policy.forward_transition_guard_hours === CONFIG.stage_and_kc_policy.forward_transition_guard_hours, 'T3R1_EA1J_FORWARD_GUARD_MISMATCH');

  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ userAgent: 'GEOX-MCFT-CAP09-T3R1-Fast-Path/1.0' });
    const page = await context.newPage();

    const targetDate = CONFIG.candidate_scope.planting_local_date;
    const indexProofs = [];
    const t3Leads = [];
    let reachedPlantingDate = false;
    let totalRows = 0;

    for (let pageNumber = 1; pageNumber <= CONFIG.aglog_discovery.maximum_pages; pageNumber += 1) {
      const url = pageNumber === 1 ? CONFIG.aglog_discovery.index_url : `${CONFIG.aglog_discovery.index_url}?page=${pageNumber}`;
      const digest = await digestPage(page, url, CONFIG.aglog_discovery.allowed_host);
      const rows = page.locator('table tr');
      const rowCount = await rows.count();
      let parsedRows = 0;
      let minimumDate = null;
      let maximumDate = null;
      for (let rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
        const row = rows.nth(rowIndex);
        const cells = row.locator('td');
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
        if (observationDate <= targetDate) reachedPlantingDate = true;
        if (observationDate < targetDate) continue;
        const observationType = values[2] || '';
        const comment = values[3] || '';
        const areas = values[4] || '';
        if (!/\bT3\b/i.test(areas) && !/\bLTER\s+T3\b/i.test(comment)) continue;
        const observationId = await observationIdFromRow(row);
        assert(Number.isInteger(observationId), 'T3R1_OBSERVATION_ID_REQUIRED');
        t3Leads.push({
          provider_observation_id: observationId,
          observation_date: observationDate,
          observation_type: observationType,
          provider_area_identity: areas,
          index_comment_mentions_t3: /\bT3\b/i.test(comment),
          index_positive_management_event: POSITIVE_MANAGEMENT_EVENT.test(observationType),
          index_termination_event: TERMINATION_EVENT.test(observationType)
        });
      }
      indexProofs.push({ page_number: pageNumber, parsed_observation_row_count: parsedRows, minimum_observation_date: minimumDate, maximum_observation_date: maximumDate, provider_body_emitted: false, ...digest });
      if (reachedPlantingDate) break;
      assert(parsedRows > 0, `T3R1_EMPTY_PAGE_BEFORE_PLANTING:${pageNumber}`);
    }
    assert(reachedPlantingDate, 'T3R1_SCAN_DID_NOT_REACH_PLANTING_DATE');

    const uniqueLeads = uniqueById(t3Leads);
    assert(uniqueLeads.length <= CONFIG.aglog_discovery.maximum_t3_detail_candidates, 'T3R1_DETAIL_LIMIT_EXCEEDED');
    const detailInspections = [];
    for (const lead of uniqueLeads) {
      const detailUrl = `${CONFIG.aglog_discovery.index_url}/${lead.provider_observation_id}`;
      const proof = await digestPage(page, detailUrl, CONFIG.aglog_discovery.allowed_host);
      const detailText = normalize(await page.locator('body').innerText());
      const exactT3 = /\bT3(?:R[1-6])?\b/i.test(detailText);
      const cropBound = CORN_TOKEN.test(detailText) || HYBRID_TOKEN.test(detailText);
      detailInspections.push({
        ...lead,
        detail_t3_scope_present: exactT3,
        explicit_corn_token: CORN_TOKEN.test(detailText),
        explicit_p0306q_token: HYBRID_TOKEN.test(detailText),
        explicit_replicate_1_inclusion: /replications?\s*\([^)]*\b1\b[^)]*\)/i.test(detailText) || /\breps?\b[^.]{0,120}\b1\b/i.test(detailText),
        positive_management_event: POSITIVE_MANAGEMENT_EVENT.test(lead.observation_type),
        termination_event: TERMINATION_EVENT.test(lead.observation_type),
        current_season_crop_bound: cropBound,
        provider_body_emitted: false,
        ...proof
      });
    }

    const plantingMatches = detailInspections.filter((item) => item.observation_date === targetDate
      && /\bPlanting\b/i.test(item.observation_type)
      && item.detail_t3_scope_present
      && item.explicit_corn_token
      && item.explicit_p0306q_token
      && item.explicit_replicate_1_inclusion);
    assert(plantingMatches.length === 1, `T3R1_EXACT_PLANTING_MATCH_COUNT_${plantingMatches.length}`);
    const planting = plantingMatches[0];

    const postPlanting = detailInspections.filter((item) => item.observation_date > targetDate);
    const positiveManagement = postPlanting.filter((item) => item.positive_management_event && item.detail_t3_scope_present);
    const terminationCandidates = postPlanting.filter((item) => item.termination_event && item.detail_t3_scope_present && item.current_season_crop_bound);
    const latestPositive = positiveManagement.at(-1) ?? null;
    const latestPublishedT3 = detailInspections.at(-1) ?? planting;
    const lifecycleStatus = terminationCandidates.length > 0 ? 'TERMINATED' : CONFIG.lifecycle_policy.fallback_status;
    const lifecycleReason = lifecycleStatus === 'TERMINATED'
      ? 'POSITIVE_CURRENT_SEASON_CROP_BOUND_TERMINATION_EVIDENCE'
      : CONFIG.lifecycle_policy.fallback_reason;

    const plantingStartMs = Date.parse(CONFIG.candidate_scope.possible_planting_window_utc.start_inclusive);
    const plantingEndExclusiveMs = Date.parse(CONFIG.candidate_scope.possible_planting_window_utc.end_exclusive);
    assert(Number.isFinite(plantingStartMs) && Number.isFinite(plantingEndExclusiveMs) && plantingEndExclusiveMs > plantingStartMs, 'T3R1_PLANTING_WINDOW_INVALID');
    const variants = EA1J.model_stage_prior.variants;
    assert(Array.isArray(variants) && variants.length >= 2, 'T3R1_EA1J_VARIANTS_REQUIRED');
    const authorityTime = new Date();
    let firstTargetMs = Math.ceil(authorityTime.getTime() / HOUR_MS) * HOUR_MS;
    if (firstTargetMs <= authorityTime.getTime()) firstTargetMs += HOUR_MS;
    const legalTargets = [];
    let firstFailure = null;
    for (let offset = 0; offset < CONFIG.stage_and_kc_policy.maximum_horizon_search_hours; offset += 1) {
      const evaluation = evaluateTarget(firstTargetMs + offset * HOUR_MS, variants, plantingStartMs, plantingEndExclusiveMs);
      if (!evaluation.consensus_stage) { firstFailure = evaluation; break; }
      if (legalTargets.length > 0 && evaluation.consensus_stage !== legalTargets[0].consensus_stage) { firstFailure = evaluation; break; }
      legalTargets.push(evaluation);
    }
    const enoughLegalTargets = legalTargets.length >= CONFIG.stage_and_kc_policy.minimum_contiguous_legal_target_hours_for_fast_path;
    const derivedStage = enoughLegalTargets && legalTargets.length > 0 ? legalTargets[0].consensus_stage : null;
    const kcAuthority = derivedStage ? resolveKc(derivedStage) : null;

    const structureProof = await digestPage(page, CONFIG.treatment_structure_source.official_url, CONFIG.treatment_structure_source.allowed_host);
    const structureText = normalize(await page.locator('body').innerText()).toLowerCase();
    for (const marker of CONFIG.treatment_structure_source.required_markers) {
      assert(structureText.includes(marker.toLowerCase()), `T3R1_TREATMENT_STRUCTURE_MARKER_MISSING:${marker}`);
    }

    const geometryPageProof = await digestPage(page, CONFIG.geometry_discovery.official_page, CONFIG.geometry_discovery.allowed_host);
    const geometryPageText = normalize(await page.locator('body').innerText()).toLowerCase();
    for (const marker of ['MCSE Plot polygons', CONFIG.geometry_discovery.datatable_id, 'submeter accuracy GPS', 'Download complete data table']) {
      assert(geometryPageText.includes(marker.toLowerCase()), `T3R1_GEOMETRY_PAGE_MARKER_MISSING:${marker}`);
    }
    const downloadAnchor = page.getByRole('link', { name: /Download complete data table/i }).first();
    assert(await downloadAnchor.count() === 1, 'T3R1_GEOMETRY_DOWNLOAD_ANCHOR_REQUIRED');
    const href = await downloadAnchor.getAttribute('href');
    assert(href, 'T3R1_GEOMETRY_DOWNLOAD_HREF_REQUIRED');
    const resolved = new URL(href, CONFIG.geometry_discovery.official_page);
    assert(resolved.protocol === 'https:'
      && resolved.hostname === CONFIG.geometry_discovery.allowed_host
      && resolved.pathname === CONFIG.geometry_discovery.download_path
      && !resolved.search, 'T3R1_GEOMETRY_DOWNLOAD_LOCATOR_MISMATCH');
    const csvResponse = await context.request.get(resolved.href, { timeout: 120_000, headers: { accept: 'text/csv,text/plain;q=0.9,*/*;q=0.5' } });
    assert(csvResponse.ok(), `T3R1_GEOMETRY_CSV_HTTP_${csvResponse.status()}`);
    const csvBytes = await csvResponse.body();
    assert(csvBytes.byteLength <= 20 * 1024 * 1024, 'T3R1_GEOMETRY_CSV_TOO_LARGE');
    const csvText = csvBytes.toString('utf8');
    assert(!/^\s*<!doctype html|^\s*<html/i.test(csvText), 'T3R1_GEOMETRY_CSV_HTML_FORBIDDEN');
    const geometryRows = parseTable(csvText, ['treatment', 'replicate', 'subplot', 'geometry']);
    const mainSpec = CONFIG.geometry_discovery.main_row;
    const stripSpec = CONFIG.geometry_discovery.strip_row;
    const mainMatches = geometryRows.filter((row) => normalize(row.treatment).toUpperCase() === mainSpec.treatment
      && normalize(row.replicate).toUpperCase() === mainSpec.replicate
      && normalize(row.subplot).toLowerCase() === mainSpec.subplot);
    const stripMatches = geometryRows.filter((row) => normalize(row.treatment).toUpperCase() === stripSpec.treatment
      && normalize(row.replicate).toUpperCase() === stripSpec.replicate
      && normalize(row.subplot).toLowerCase() === stripSpec.subplot);
    assert(mainMatches.length === mainSpec.expected_match_count, `T3R1_MAIN_GEOMETRY_MATCH_COUNT_${mainMatches.length}`);
    assert(stripMatches.length >= stripSpec.minimum_match_count, `T3R1_STRIP_ROW_MATCH_COUNT_${stripMatches.length}`);
    const mainGeometry = simplePolygonMetadata(mainMatches[0].geometry, CONFIG.geometry_discovery.required_srid);
    assert(mainGeometry.present && mainGeometry.valid_simple_polygon, 'T3R1_MAIN_GEOMETRY_VALID_POLYGON_REQUIRED');
    const stripGeometryMetadata = stripMatches.map((row) => simplePolygonMetadata(row.geometry, CONFIG.geometry_discovery.required_srid));
    const validStripGeometryCount = stripGeometryMetadata.filter((item) => item.present && item.valid_simple_polygon).length;
    const cropOnlyGeometryStatus = validStripGeometryCount > 0
      ? 'UNRESOLVED_MAIN_MINUS_STRIP_AUTHORITY_REQUIRED'
      : 'UNRESOLVED_PRAIRIE_STRIP_GEOMETRY_NOT_MACHINE_AVAILABLE';

    const blockers = [];
    if (lifecycleStatus !== 'ACTIVE') blockers.push(lifecycleStatus === 'TERMINATED' ? 'T3R1_CURRENT_SEASON_TERMINATED' : 'T3R1_CURRENT_SEASON_LIFECYCLE_UNRESOLVED');
    if (!derivedStage) blockers.push('T3R1_DERIVED_STAGE_NO_24H_CONTIGUOUS_CONSENSUS');
    if (!kcAuthority) blockers.push('T3R1_REQUIRED_KC_UNRESOLVED');
    if (cropOnlyGeometryStatus !== 'RESOLVED') blockers.push('T3R1_CROP_ONLY_FORMAL_GEOMETRY_UNRESOLVED');

    const result = {
      schema_version: 'geox_mcft_cap09_t3r1_fast_path_requalification_result_v1',
      status: 'PASS',
      subject_sha: SUBJECT_SHA,
      authority_time_utc: authorityTime.toISOString(),
      frontier: CONFIG.frontier,
      candidate_scope: CONFIG.candidate_scope,
      planting_crop_hybrid_authority_candidate: {
        status: 'RESOLVED_CANDIDATE',
        provider_observation_id: planting.provider_observation_id,
        observation_date: planting.observation_date,
        crop: 'corn',
        hybrid_product_code: 'P0306Q',
        replicate_1_explicitly_included: true,
        provider_body_emitted: false
      },
      provider_scan: {
        scanned_index_page_count: indexProofs.length,
        scanned_observation_row_count: totalRows,
        scan_reached_planting_date: reachedPlantingDate,
        t3_detail_lead_count: uniqueLeads.length,
        inspected_t3_detail_count: detailInspections.length,
        latest_published_t3_observation: latestPublishedT3 ? {
          provider_observation_id: latestPublishedT3.provider_observation_id,
          observation_date: latestPublishedT3.observation_date,
          observation_type: latestPublishedT3.observation_type,
          provider_area_identity: latestPublishedT3.provider_area_identity
        } : null,
        historical_positive_management_anchor_candidate: latestPositive ? {
          provider_observation_id: latestPositive.provider_observation_id,
          observation_date: latestPositive.observation_date,
          observation_type: latestPositive.observation_type,
          current_season_crop_bound_on_same_detail: latestPositive.current_season_crop_bound
        } : null,
        crop_bound_termination_candidate_count: terminationCandidates.length,
        page_proofs: indexProofs,
        detail_inspections: detailInspections,
        provider_body_emitted: false,
        provider_payload_persisted_or_uploaded: false
      },
      current_season_lifecycle_authority: {
        status: lifecycleStatus,
        reason: lifecycleReason,
        active_established: false,
        terminated_established: lifecycleStatus === 'TERMINATED',
        absence_of_termination_used_to_prove_active: false,
        provider_retrieval_time_used_as_coverage_watermark: false,
        global_aglog_freshness_used_as_t3_scope_completeness: false,
        historical_positive_anchor_used_as_current_active: false
      },
      derived_crop_water_use_stage_authority_candidate: {
        status: derivedStage ? 'RESOLVED' : 'UNRESOLVED',
        stage: derivedStage,
        observed_biological_stage_claimed: false,
        algorithm_id: CONFIG.stage_and_kc_policy.stage_algorithm_id,
        variant_count: variants.length,
        first_legal_target_utc: legalTargets[0]?.target_utc ?? null,
        last_contiguous_legal_target_utc: legalTargets.at(-1)?.target_utc ?? null,
        contiguous_legal_target_hours: legalTargets.length,
        minimum_required_hours: CONFIG.stage_and_kc_policy.minimum_contiguous_legal_target_hours_for_fast_path,
        first_target_evaluation: legalTargets[0] ?? null,
        first_failure_after_contiguous_window: firstFailure,
        single_fao_variant_selected: false
      },
      crop_model_parameter_authority_candidate: {
        status: kcAuthority ? 'RESOLVED' : 'UNRESOLVED',
        parameter: 'Kc',
        kc: kcAuthority?.kc ?? null,
        stage_code: kcAuthority?.stage_code ?? null,
        configuration_source_id: kcAuthority?.configuration_source_id ?? null,
        configuration_semantic_hash: kcAuthority?.configuration_semantic_hash ?? null,
        invented: false
      },
      t3r1_crop_only_geometry_authority_candidate: {
        status: cropOnlyGeometryStatus,
        treatment_structure_prairie_strip_confirmed: true,
        main_row_match_count: mainMatches.length,
        main_geometry_present: mainGeometry.present,
        main_geometry_valid_simple_polygon: mainGeometry.valid_simple_polygon,
        main_geometry_sha256: mainGeometry.geometry_sha256,
        strip_row_match_count: stripMatches.length,
        strip_valid_machine_polygon_count: validStripGeometryCount,
        whole_t3r1_polygon_assumed_crop_only: false,
        prairie_strip_relabelled_corn: false,
        automatic_main_minus_strip_authority_created: false,
        raw_geometry_emitted: false,
        raw_geometry_persisted_or_uploaded: false,
        treatment_structure_proof: structureProof,
        geometry_page_proof: geometryPageProof,
        geometry_csv_sha256: sha256(csvBytes),
        geometry_csv_bytes: csvBytes.byteLength
      },
      fast_path_readiness: {
        status: blockers.length === 0 ? 'READY_FOR_SEPARATE_FORMAL_REBIND_DESIGN' : 'BLOCKED',
        blockers,
        t1r1_formal_binding_mutated: false,
        formal_rebind_authorized: false,
        ea5e2_operational_activation_authorized: false
      },
      next_frontier: blockers.length === 0
        ? 'T3R1_FORMAL_SCOPE_REBIND_AUTHORITY_DESIGN'
        : blockers.includes('T3R1_CURRENT_SEASON_LIFECYCLE_UNRESOLVED') && blockers.includes('T3R1_CROP_ONLY_FORMAL_GEOMETRY_UNRESOLVED')
          ? 'T3R1_CURRENT_LIFECYCLE_AND_CROP_ONLY_GEOMETRY_AUTHORITY'
          : blockers.includes('T3R1_CURRENT_SEASON_LIFECYCLE_UNRESOLVED')
            ? 'T3R1_CURRENT_LIFECYCLE_AUTHORITY'
            : blockers.includes('T3R1_CROP_ONLY_FORMAL_GEOMETRY_UNRESOLVED')
              ? 'T3R1_CROP_ONLY_GEOMETRY_AUTHORITY'
              : 'T3R1_FAST_PATH_REQUALIFICATION_REVIEW',
      database_write_count: 0,
      formal_evidence_write_count: 0,
      raw_object_write_count: 0,
      runtime_config_write_count: 0,
      scheduler_write_count: 0,
      canonical_runtime_write_count: 0,
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
    schema_version: 'geox_mcft_cap09_t3r1_fast_path_requalification_result_v1',
    status: 'FAIL',
    subject_sha: SUBJECT_SHA || null,
    error: safeError(error),
    t1r1_formal_binding_mutated: false,
    formal_rebind_authorized: false,
    ea5e2_operational_activation_authorized: false,
    database_write_count: 0,
    formal_evidence_write_count: 0,
    raw_object_write_count: 0,
    runtime_config_write_count: 0,
    scheduler_write_count: 0,
    canonical_runtime_write_count: 0,
    formal_window_started: false,
    formal_execution_count: '0/24'
  });
  process.exitCode = 1;
}
