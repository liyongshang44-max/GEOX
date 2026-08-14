#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = path.join(ROOT, 'acceptance-output/MCFT_CAP_09_KBS_PROJECTLOG_OBSERVATION_SOURCE_QUALIFICATION.json');
const SUBJECT_SHA = String(process.env.MCFT_SUBJECT_SHA || '').trim();

const PROJECTLOG_HOST = 'projectlog.kbs.msu.edu';
const PROJECTLOG_URL = `https://${PROJECTLOG_HOST}/`;
const SITE_AUTHORITY = path.join(ROOT, 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S6-FORMAL-SITE-AUTHORITY-V1.json');
const AMENDMENT_13 = path.join(ROOT, 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-13-CURRENT-CROP-AUTHORITY-REQUALIFICATION-SEPARATION.md');

const EXACT_T1R1 = /\bT1\s*R1\b/i;
const CORN = /\bcorn\b/i;
const DIRECT_FIELD_CORN_ACTIVITY = /(?:cut|cutting|sample|sampling|inspect|inspection|measure|measuring|flag|path|paths|walk|walking)[^\n]{0,120}\bcorn\b|\bcorn\b[^\n]{0,120}(?:cut|cutting|sample|sampling|inspect|inspection|measure|measuring|flag|path|paths|walk|walking)/i;
const CROP_RESET = /\b(?:corn\s+harvest(?:ed|ing)?|harvest(?:ed|ing)?\s+(?:the\s+)?corn|crop\s+removed|removed\s+crop|crop\s+terminated|terminated\s+crop)\b/i;
const KNOWN_ANCHOR_SIGNATURE = /cut\s+station\s+paths\s+through\s+the\s+corn\s+with\s+a\s+machete\s+in\s+T1R1/i;
const PHENOLOGY_PATTERNS = [
  ['VT', /\bVT\b/i], ['R1', /\bR1\b/i], ['R2', /\bR2\b/i], ['R3', /\bR3\b/i],
  ['R4', /\bR4\b/i], ['R5', /\bR5\b/i], ['R6', /\bR6\b/i], ['TASSEL', /\btassel(?:ed|ing)?\b/i],
  ['SILKING', /\bsilk(?:ed|ing)?\b/i], ['DENT', /\bdent\b/i],
  ['PHYSIOLOGICAL_MATURITY', /\bphysiological\s+maturity\b/i], ['BLACK_LAYER', /\bblack\s+layer\b/i]
];

function assert(condition, code) { if (!condition) throw new Error(code); }
function normalize(value) { return String(value || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim(); }
function sha256(value) { return `sha256:${crypto.createHash('sha256').update(value).digest('hex')}`; }
function dateOnly(value) { return String(value || '').match(/\b(2026-\d{2}-\d{2})\b/)?.[1] || null; }
function phenologyTokens(text) { return PHENOLOGY_PATTERNS.filter(([, re]) => re.test(text)).map(([name]) => name); }
function safeError(error) { return (error instanceof Error ? error.message : String(error)).replace(/https?:\/\/[^\s]+/g, '[URL_REDACTED]'); }
function write(value) { fs.mkdirSync(path.dirname(OUT), { recursive: true }); fs.writeFileSync(OUT, `${JSON.stringify(value, null, 2)}\n`, 'utf8'); console.log(JSON.stringify(value)); }

async function fetchProjectlog(page) {
  const response = await page.goto(PROJECTLOG_URL, { waitUntil: 'networkidle', timeout: 90_000 });
  assert(response?.ok(), `PROJECTLOG_HTTP_${response?.status() ?? 'NO_RESPONSE'}`);
  const finalUrl = new URL(response.url());
  assert(finalUrl.hostname === PROJECTLOG_HOST, 'PROJECTLOG_REDIRECT_HOST_FORBIDDEN');
  const bytes = await response.body();
  await page.getByText('Projectlog Entries List', { exact: false }).first().waitFor({ timeout: 30_000 });
  return {
    response_sha256: sha256(bytes),
    response_bytes: bytes.byteLength,
    retrieved_at: new Date().toISOString(),
    body_text_sha256: sha256(await page.locator('body').innerText()),
    final_pathname: finalUrl.pathname,
    provider_body_emitted: false
  };
}

async function parseRows(page) {
  const rows = [];
  const tr = page.locator('table tr');
  for (let i = 0; i < await tr.count(); i += 1) {
    const row = tr.nth(i);
    const td = row.locator('td');
    if ((await td.count()) < 3) continue;
    const values = [];
    for (let c = 0; c < await td.count(); c += 1) values.push(normalize(await td.nth(c).innerText()));
    const joined = normalize(values.join(' | '));
    const date = dateOnly(joined);
    if (!date) continue;
    const author = values[1] || null;
    const exactT1R1 = EXACT_T1R1.test(joined);
    const corn = CORN.test(joined);
    const directFieldCornActivity = DIRECT_FIELD_CORN_ACTIVITY.test(joined);
    const reset = CROP_RESET.test(joined);
    rows.push({
      event_date: date,
      author_present: Boolean(author),
      author_sha256: author ? sha256(author) : null,
      row_sha256: sha256(joined),
      exact_t1r1_scope_token_present: exactT1R1,
      explicit_corn_semantic_present: corn,
      direct_physical_field_corn_activity_present: directFieldCornActivity,
      crop_reset_semantic_present: reset,
      direct_phenology_tokens: phenologyTokens(joined),
      known_2026_06_26_t1r1_anchor_signature_present: date === '2026-06-26' && KNOWN_ANCHOR_SIGNATURE.test(joined),
      provider_row_body_emitted: false
    });
  }
  return rows;
}

async function main() {
  assert(/^[0-9a-f]{40}$/.test(SUBJECT_SHA), 'PROJECTLOG_EXACT_SUBJECT_REQUIRED');

  const site = JSON.parse(fs.readFileSync(SITE_AUTHORITY, 'utf8'));
  assert(site.site?.qualified_formal_site_id === 'KBS_MCSE_T1R1', 'PROJECTLOG_FORMAL_SITE_T1R1_REQUIRED');
  assert(site.site?.current_season === '2026', 'PROJECTLOG_FORMAL_SEASON_2026_REQUIRED');
  assert(String(site.site?.crop || '').toLowerCase() === 'corn', 'PROJECTLOG_FORMAL_CROP_CORN_REQUIRED');
  assert(site.formal_scope_identity?.field_id === 'field_kbs_mcse_t1r1', 'PROJECTLOG_FORMAL_FIELD_ID_REQUIRED');

  const amendment13 = fs.readFileSync(AMENDMENT_13, 'utf8');
  assert(amendment13.includes('### 7.2 Other trustworthy KBS current-season observations'), 'PROJECTLOG_AMENDMENT13_SECTION_7_2_REQUIRED');
  assert(amendment13.includes('separate exact qualification of source identity, spatial applicability, temporal semantics, crop/season linkage, and stage/model mapping'), 'PROJECTLOG_SEPARATE_QUALIFICATION_RULE_REQUIRED');

  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ userAgent: 'GEOX-MCFT-CAP09-KBS-Projectlog-Qualification/1.0' });
    const page = await context.newPage();
    const proof = await fetchProjectlog(page);
    const rows = await parseRows(page);
    assert(rows.length > 0, 'PROJECTLOG_ROWS_REQUIRED');

    const exactT1R1Rows = rows.filter((row) => row.exact_t1r1_scope_token_present);
    const positiveCandidates = exactT1R1Rows.filter((row) =>
      row.explicit_corn_semantic_present &&
      row.direct_physical_field_corn_activity_present &&
      !row.crop_reset_semantic_present
    );
    const knownAnchor = positiveCandidates.find((row) => row.known_2026_06_26_t1r1_anchor_signature_present);
    assert(knownAnchor, 'PROJECTLOG_KNOWN_2026_06_26_T1R1_CORN_ANCHOR_REQUIRED');

    const best = [...positiveCandidates].sort((a, b) => b.event_date.localeCompare(a.event_date))[0] || null;
    assert(best, 'PROJECTLOG_POSITIVE_T1R1_CORN_ACTIVITY_REQUIRED');

    write({
      schema_version: 'geox_mcft_cap09_kbs_projectlog_observation_source_qualification_v1',
      status: 'PASS',
      subject_sha: SUBJECT_SHA,
      predecessor_authority: {
        amendment_13_section_7_2_consumed: true,
        formal_site_id: site.site.qualified_formal_site_id,
        formal_field_id: site.formal_scope_identity.field_id,
        formal_season_id: site.formal_scope_identity.season_id,
        formal_crop: site.site.crop
      },
      source_qualification: {
        provider: 'KBS_PROJECTLOG',
        provider_host: PROJECTLOG_HOST,
        provider_host_under_kbs_msu_edu: PROJECTLOG_HOST.endsWith('.kbs.msu.edu'),
        public_page_readable: true,
        current_2026_rows_present: rows.some((row) => row.event_date.startsWith('2026-')),
        row_author_identity_present: rows.some((row) => row.author_present),
        exact_provider_response_hash_recorded: true,
        response_sha256: proof.response_sha256,
        body_text_sha256: proof.body_text_sha256,
        retrieved_at: proof.retrieved_at,
        provider_body_emitted: false,
        source_use_rights_expanded_by_this_probe: false,
        source_authority_established_by_this_probe: false
      },
      temporal_semantics: {
        provider_event_date_present: true,
        provider_intraday_event_time_present: false,
        event_time_precision: 'DAY',
        retrieval_time_used_as_event_time: false,
        available_to_runtime_at: proof.retrieved_at,
        available_to_runtime_at_backdated: false,
        future_observation_consumed: false
      },
      spatial_semantics: {
        exact_t1r1_row_count: exactT1R1Rows.length,
        exact_t1r1_token_required_for_candidate: true,
        parent_t1_only_treated_as_t1r1: false,
        other_replicate_substituted_for_t1r1: false,
        geographic_proximity_used_as_field_truth: false
      },
      candidate_observation: {
        candidate_count: positiveCandidates.length,
        best_candidate_event_date: best.event_date,
        best_candidate_row_sha256: best.row_sha256,
        best_candidate_exact_t1r1_scope: best.exact_t1r1_scope_token_present,
        best_candidate_explicit_corn_semantic: best.explicit_corn_semantic_present,
        best_candidate_direct_physical_field_corn_activity: best.direct_physical_field_corn_activity_present,
        best_candidate_crop_reset_semantic: best.crop_reset_semantic_present,
        best_candidate_direct_phenology_tokens: best.direct_phenology_tokens,
        known_2026_06_26_t1r1_anchor_signature_present: Boolean(knownAnchor),
        positive_lifecycle_anchor_candidate_qualified: true,
        direct_p0306q_semantic_present: false,
        p0306q_season_identity_continuity_established_by_this_probe: false,
        phenology_stage_candidate_qualified: false,
        crop_model_parameter_candidate_qualified: false
      },
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
      database_write_count: 0,
      runtime_write_count: 0,
      scheduler_write_count: 0,
      formal_evidence_write_count: 0,
      next_frontier: 'PROJECTLOG_T1R1_SEASON_IDENTITY_CONTINUITY_AND_LIFECYCLE_ANCHOR_QUALIFICATION'
    });
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  write({
    schema_version: 'geox_mcft_cap09_kbs_projectlog_observation_source_qualification_v1',
    status: 'FAIL',
    subject_sha: SUBJECT_SHA || null,
    error: safeError(error),
    database_write_count: 0,
    runtime_write_count: 0,
    scheduler_write_count: 0,
    formal_evidence_write_count: 0,
    authority_effect: {
      current_runtime_lifecycle_authority_established: false,
      phenology_authority_established: false,
      crop_model_parameter_authority_established: false,
      kc: null,
      future_legal_t_established: false,
      ea5e2_operational_activation_qualified: false,
      formal_window_started: false,
      formal_execution_count: '0/24'
    }
  });
  process.exitCode = 1;
});
