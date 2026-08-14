#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = path.join(ROOT, 'acceptance-output/MCFT_CAP_09_BOUNDED_LIFECYCLE_CARRY_FORWARD.json');
const SUBJECT_SHA = String(process.env.MCFT_SUBJECT_SHA || '').trim();

const AGLOG_HOST = 'aglog.kbs.msu.edu';
const KBS_HOST = 'lter.kbs.msu.edu';
const T1R1_URL = `https://${AGLOG_HOST}/areas/1`;
const GLOBAL_INDEX_URL = `https://${AGLOG_HOST}/observations`;
const PROTOCOL_URL = `https://${KBS_HOST}/protocols/104`;

const A14_PATH = 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-14-POSITIVE-LIFECYCLE-ANCHOR-AUTHORITY.md';
const EXPECTED_A14_BLOB = '299e256bed5ab8c822990f34686b310da3bcf00e';
const EXPECTED_A14_MERGE_SHA = 'b7c65734681b7c9b05ebd16a8faae835af01a5ed';
const A14_AVAILABLE_AT = '2026-08-14T12:24:43.798Z';
const ANCHOR_ID = 6977;
const ANCHOR_DATE = '2026-05-27';
const ANCHOR_END_UTC = '2026-05-27T20:40:00.000Z';
const RESET_EVENT = /\b(harvest|termination|terminate)\b/i;
const SUCCESSOR_PLANTING_EVENT = /\bplanting\b/i;

function assert(condition, code) { if (!condition) throw new Error(code); }
function normalize(value) { return String(value || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim(); }
function dateOnly(value) { const match = String(value || '').match(/\b(\d{4}-\d{2}-\d{2})\b/); return match ? match[1] : null; }
function sha256(bytes) { return `sha256:${crypto.createHash('sha256').update(bytes).digest('hex')}`; }
function safeError(error) { return (error instanceof Error ? error.message : String(error)).replace(/https?:\/\/[^\s]+/g, '[URL_REDACTED]'); }
function write(value) { fs.mkdirSync(path.dirname(OUT), { recursive: true }); fs.writeFileSync(OUT, `${JSON.stringify(value, null, 2)}\n`, 'utf8'); console.log(JSON.stringify(value)); }
function gitBlob(file) { return crypto.createHash('sha1').update(`blob ${Buffer.byteLength(fs.readFileSync(file))}\0`).update(fs.readFileSync(file)).digest('hex'); }

async function fetchProof(page, url, allowedHost) {
  const requested = new URL(url);
  assert(requested.hostname === allowedHost, 'LIFECYCLE_CARRY_UNAPPROVED_HOST');
  const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 75_000 });
  assert(response?.ok(), `LIFECYCLE_CARRY_HTTP_${response?.status() ?? 'NO_RESPONSE'}`);
  const finalUrl = new URL(response.url());
  assert(finalUrl.hostname === allowedHost, 'LIFECYCLE_CARRY_REDIRECT_HOST_FORBIDDEN');
  const bytes = await response.body();
  const retrievedAt = new Date().toISOString();
  const text = normalize(await page.locator('body').innerText());
  return { text, proof: { response_sha256: sha256(bytes), response_bytes: bytes.byteLength, retrieved_at: retrievedAt, provider_body_emitted: false } };
}

async function parseRows(page) {
  const tableRows = page.locator('table tr');
  const rows = [];
  for (let i = 0; i < await tableRows.count(); i += 1) {
    const cells = tableRows.nth(i).locator('td');
    if (await cells.count() < 5) continue;
    const values = [];
    for (let c = 0; c < await cells.count(); c += 1) values.push(normalize(await cells.nth(c).innerText()));
    const observationDate = dateOnly(values[0]);
    if (!observationDate) continue;
    let observationId = null;
    const links = tableRows.nth(i).locator('a[href*="/observations/"]');
    for (let l = 0; l < await links.count(); l += 1) {
      const href = await links.nth(l).getAttribute('href');
      const match = String(href || '').match(/\/observations\/(\d+)/);
      if (match) { observationId = Number(match[1]); break; }
    }
    if (!Number.isInteger(observationId)) continue;
    rows.push({
      provider_observation_id: observationId,
      observation_date: observationDate,
      observation_type: values[1] || values[2] || '',
    });
  }
  return [...new Map(rows.map((row) => [row.provider_observation_id, row])).values()];
}

async function main() {
  assert(/^[0-9a-f]{40}$/.test(SUBJECT_SHA), 'LIFECYCLE_CARRY_EXACT_SUBJECT_REQUIRED');
  assert(gitBlob(path.join(ROOT, A14_PATH)) === EXPECTED_A14_BLOB, 'LIFECYCLE_CARRY_AMENDMENT14_BLOB_DRIFT');

  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ userAgent: 'GEOX-MCFT-CAP09-Bounded-Lifecycle-Carry-Forward/1.0' });
    const page = await context.newPage();

    const protocol = await fetchProof(page, PROTOCOL_URL, KBS_HOST);
    for (const marker of [
      'MCSE: Agronomic Protocol',
      'Active',
      'planned management for the current year',
      'actual field operations may differ',
      'recorded in the ag log'
    ]) assert(protocol.text.toLowerCase().includes(marker.toLowerCase()), `LIFECYCLE_CARRY_PROTOCOL_MARKER_MISSING:${marker}`);

    const area = await fetchProof(page, T1R1_URL, AGLOG_HOST);
    assert(/\bT1R1\b/i.test(area.text), 'LIFECYCLE_CARRY_T1R1_AREA_IDENTITY_REQUIRED');
    const paginationLinkCount = await page.locator('a[href*="?page="]').count();
    assert(paginationLinkCount === 0, 'LIFECYCLE_CARRY_T1R1_PAGINATION_UNQUALIFIED');
    const areaRows = await parseRows(page);
    assert(areaRows.length >= 300, 'LIFECYCLE_CARRY_T1R1_HISTORY_DEPTH_REQUIRED');
    assert(areaRows.some((row) => row.provider_observation_id === ANCHOR_ID), 'LIFECYCLE_CARRY_POSITIVE_ANCHOR_MISSING');

    const historicalHarvests = areaRows.filter((row) => row.observation_date < ANCHOR_DATE && RESET_EVENT.test(row.observation_type));
    assert(historicalHarvests.length > 0, 'LIFECYCLE_CARRY_T1R1_HISTORICAL_HARVEST_OBSERVABILITY_REQUIRED');

    const afterAnchor = areaRows
      .filter((row) => row.observation_date > ANCHOR_DATE || (row.observation_date === ANCHOR_DATE && row.provider_observation_id > ANCHOR_ID))
      .sort((a, b) => a.observation_date.localeCompare(b.observation_date) || a.provider_observation_id - b.provider_observation_id);
    const resetAfterAnchor = afterAnchor.filter((row) => RESET_EVENT.test(row.observation_type));
    const successorPlantingAfterAnchor = afterAnchor.filter((row) => SUCCESSOR_PLANTING_EVENT.test(row.observation_type));
    assert(resetAfterAnchor.length === 0, 'LIFECYCLE_CARRY_RESET_AFTER_ANCHOR_PRESENT');
    assert(successorPlantingAfterAnchor.length === 0, 'LIFECYCLE_CARRY_SUCCESSOR_PLANTING_AFTER_ANCHOR_PRESENT');

    const global = await fetchProof(page, GLOBAL_INDEX_URL, AGLOG_HOST);
    const globalRows = await parseRows(page);
    assert(globalRows.length > 0, 'LIFECYCLE_CARRY_GLOBAL_INDEX_ROWS_REQUIRED');
    const globalDates = globalRows.map((row) => row.observation_date).sort();
    const latestGlobalObservationDate = globalDates.at(-1);
    assert(latestGlobalObservationDate >= ANCHOR_DATE, 'LIFECYCLE_CARRY_GLOBAL_INDEX_NOT_CURRENT_ENOUGH_FOR_ANCHOR');

    const areaDates = areaRows.map((row) => row.observation_date).sort();
    const snapshotAt = area.proof.retrieved_at;
    assert(Date.parse(snapshotAt) >= Date.parse(A14_AVAILABLE_AT), 'LIFECYCLE_CARRY_SNAPSHOT_BEFORE_A14_AVAILABILITY');

    const providerRecordedManagementState = 'ACTIVE';
    const futureForwardValidityHours = 0;

    write({
      schema_version: 'geox_mcft_cap09_bounded_lifecycle_carry_forward_qualification_v1',
      status: 'PASS',
      subject_sha: SUBJECT_SHA,
      qualification_time_utc: new Date().toISOString(),
      qualification_only_not_authority: true,
      layer: 'BOUNDED_LIFECYCLE_CARRY_FORWARD',
      predecessor: {
        amendment_14_merge_sha: EXPECTED_A14_MERGE_SHA,
        amendment_14_blob_sha: EXPECTED_A14_BLOB,
        positive_anchor_observation_id: ANCHOR_ID,
        positive_anchor_event_end_utc: ANCHOR_END_UTC,
        positive_anchor_authority_available_to_runtime_at: A14_AVAILABLE_AT
      },
      provider_semantics: {
        actual_field_operations_recorded_in_aglog: true,
        exact_t1r1_area_view_qualified: true,
        t1r1_history_row_count: areaRows.length,
        t1r1_history_minimum_date: areaDates[0],
        t1r1_history_maximum_date: areaDates.at(-1),
        t1r1_area_pagination_observed: false,
        historical_t1r1_harvest_observability_count: historicalHarvests.length,
        global_latest_observation_date_on_first_page: latestGlobalObservationDate,
        protocol_proof: protocol.proof,
        t1r1_area_snapshot_proof: area.proof,
        global_index_snapshot_proof: global.proof
      },
      bounded_absence_evidence: {
        interval_start_basis: 'POSITIVE_ACTIVE_ANCHOR_6977',
        interval_start_event_end_utc: ANCHOR_END_UTC,
        interval_end_basis: 'CURRENT_PROVIDER_T1R1_AREA_SNAPSHOT_RETRIEVAL',
        interval_end_utc: snapshotAt,
        post_anchor_area_event_count: afterAnchor.length,
        post_anchor_area_events: afterAnchor,
        published_harvest_or_termination_after_anchor_count: resetAfterAnchor.length,
        published_successor_planting_after_anchor_count: successorPlantingAfterAnchor.length,
        absence_used_to_create_active: false,
        absence_used_only_to_carry_forward_preexisting_positive_active_anchor: true,
        unpublished_physical_operation_lag_upper_bound_established: false
      },
      lifecycle_adjudication: {
        management_lifecycle_not_biological_vitality: true,
        provider_recorded_management_lifecycle_as_of_snapshot: providerRecordedManagementState,
        provider_recorded_state_valid_through_utc: snapshotAt,
        physical_real_world_lifecycle_beyond_provider_record_not_claimed: true,
        bounded_carry_forward_to_provider_snapshot_candidate_qualified: true,
        current_runtime_lifecycle_authority_established_by_this_probe: false,
        future_forward_validity_hours: futureForwardValidityHours,
        future_forward_validity_established: false,
        future_target_wholly_inside_lifecycle_validity_established: false,
        reason_future_forward_validity_unresolved: 'NO_QUALIFIED_FORWARD_MANAGEMENT_LIFECYCLE_GUARD_BEYOND_PROVIDER_SNAPSHOT',
        next_frontier: 'LIFECYCLE_FORWARD_VALIDITY_OR_DIRECT_CURRENT_ANCHOR_REFRESH_QUALIFICATION'
      },
      phenology_stage_authority: { status: 'UNRESOLVED', stage: null },
      crop_model_parameter_authority: { status: 'UNRESOLVED', parameter: 'Kc', kc: null },
      hard_nonclaims: [
        'NO_ACTIVE_CREATED_FROM_ABSENCE',
        'NO_UNPUBLISHED_PHYSICAL_TERMINATION_EXCLUSION',
        'NO_FORWARD_LIFECYCLE_LEASE',
        'NO_PHENOLOGY_INFERENCE',
        'NO_THERMAL_ACTIVE_INFERENCE',
        'NO_KC_INVENTION',
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
    schema_version: 'geox_mcft_cap09_bounded_lifecycle_carry_forward_qualification_v1',
    status: 'FAIL',
    subject_sha: SUBJECT_SHA || null,
    error: safeError(error),
    current_runtime_lifecycle_authority_established: false,
    future_forward_validity_established: false,
    future_target_wholly_inside_lifecycle_validity_established: false,
    database_write_count: 0,
    formal_window_started: false,
    formal_execution_count: '0/24'
  });
  process.exitCode = 1;
}
