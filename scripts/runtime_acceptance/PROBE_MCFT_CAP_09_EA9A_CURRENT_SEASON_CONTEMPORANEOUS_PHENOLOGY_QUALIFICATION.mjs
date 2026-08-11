#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const CONFIG_PATH = path.join(ROOT, 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA9A-CURRENT-SEASON-CONTEMPORANEOUS-PHENOLOGY-QUALIFICATION-V1.json');
const OUT = path.join(ROOT, 'acceptance-output/MCFT_CAP_09_EA9A_CURRENT_SEASON_CONTEMPORANEOUS_PHENOLOGY_QUALIFICATION_RESULT.json');
const CONFIG = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
const SUBJECT_SHA = process.env.MCFT_SUBJECT_SHA || null;

const ALLOWED_HOSTS = new Set(['aglog.kbs.msu.edu', 'lter.kbs.msu.edu']);

function sha256(input) {
  return `sha256:${crypto.createHash('sha256').update(input).digest('hex')}`;
}
function normalizeText(value) {
  return String(value || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
}
function safeError(error) {
  return (error instanceof Error ? error.message : String(error)).replace(/https?:\/\/[^\s]+/g, '[URL_REDACTED]');
}
function writeResult(value) {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}
function assert(condition, code) {
  if (!condition) throw new Error(code);
}
function assertExact(value, expected, code) {
  if (value !== expected) throw new Error(`${code}:expected=${JSON.stringify(expected)}:actual=${JSON.stringify(value)}`);
}
function sortedUnique(values) {
  return [...new Set(values)].sort();
}

async function inspectPreterminalGddDisclosure(page, text) {
  const configured = CONFIG.preterminal_gdd_escape_probe;
  const codeRegex = new RegExp(`\\b(?:${configured.recognized_product_code_patterns.join('|')})\\b`, 'gi');
  const recognizedCodes = sortedUnique((text.match(codeRegex) || []).map((value) => value.toUpperCase()));
  const materialIds = sortedUnique(await page.locator('a[href*="/materials/"]').evaluateAll((anchors) => anchors.flatMap((anchor) => {
    try {
      const pathname = new URL(anchor.href).pathname;
      const match = pathname.match(/\/materials\/(\d+)\/?$/i);
      return match ? [match[1]] : [];
    } catch {
      return [];
    }
  })));
  const diagnostics = {
    source_candidate_id: configured.source_candidate_id,
    explicit_variety_label_present: /\bvariety\s+planted\b/i.test(text),
    explicit_relative_maturity_label_present: /\brelative\s+maturity\b/i.test(text),
    recognizable_hybrid_code_count: recognizedCodes.length,
    recognizable_hybrid_code_set_sha256: sha256(recognizedCodes.join('|')),
    provider_material_link_count: materialIds.length,
    provider_material_link_id_set_sha256: sha256(materialIds.join('|')),
    derived_product_code_text_emitted: false,
    provider_body_emitted: false,
  };
  diagnostics.any_hybrid_or_material_disclosure_present =
    diagnostics.explicit_variety_label_present ||
    diagnostics.explicit_relative_maturity_label_present ||
    diagnostics.recognizable_hybrid_code_count > 0 ||
    diagnostics.provider_material_link_count > 0;
  return diagnostics;
}

async function fetchCandidate(context, candidate) {
  const configured = new URL(candidate.official_url);
  assert(ALLOWED_HOSTS.has(configured.hostname), `EA9A_UNAPPROVED_PROVIDER_HOST:${candidate.candidate_id}`);
  const page = await context.newPage();
  try {
    let response;
    let lastError;
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        response = await page.goto(candidate.official_url, { waitUntil: 'domcontentloaded', timeout: 75_000 });
        if (response?.ok()) break;
        lastError = new Error(`HTTP_${response?.status() ?? 'NO_RESPONSE'}`);
      } catch (error) {
        lastError = error;
      }
      if (attempt < 2) await page.waitForTimeout(2_000);
    }
    if (!response?.ok()) throw new Error(`EA9A_PROVIDER_FETCH_FAILED:${candidate.candidate_id}:${safeError(lastError || 'NO_RESPONSE')}`);

    const finalUrl = new URL(response.url());
    assert(ALLOWED_HOSTS.has(finalUrl.hostname), `EA9A_PROVIDER_REDIRECT_HOST_FORBIDDEN:${candidate.candidate_id}`);
    const text = normalizeText(await page.locator('body').innerText());
    const lower = text.toLowerCase();
    for (const marker of candidate.required_markers) {
      if (!lower.includes(String(marker).toLowerCase())) {
        throw new Error(`EA9A_PROVIDER_MARKER_MISSING:${candidate.candidate_id}:${String(marker).replace(/[^a-z0-9]+/gi, '_').slice(0, 80)}`);
      }
    }
    const bytes = await response.body();
    const finding = {
      candidate_id: candidate.candidate_id,
      provider: candidate.provider,
      final_origin: finalUrl.origin,
      response_sha256: sha256(bytes),
      response_bytes: bytes.byteLength,
      retrieved_at: new Date().toISOString(),
      formal_scope_relationship: candidate.formal_scope_relationship,
      evidence_role: candidate.evidence_role,
      stage_determinative: candidate.stage_determinative,
      reason: candidate.reason,
      required_markers_verified: true,
      provider_body_emitted: false,
    };
    if (candidate.candidate_id === CONFIG.preterminal_gdd_escape_probe.source_candidate_id) {
      finding.preterminal_gdd_escape_diagnostics = await inspectPreterminalGddDisclosure(page, text);
    }
    return finding;
  } finally {
    await page.close();
  }
}

let browser;
let gddEscapeDiagnostics = null;
try {
  assert(SUBJECT_SHA && /^[0-9a-f]{40}$/.test(SUBJECT_SHA), 'EA9A_EXACT_SUBJECT_SHA_REQUIRED');
  assertExact(CONFIG.frontier, 'S6-EA9A-CURRENT-SEASON-CONTEMPORANEOUS-PHENOLOGY-QUALIFICATION', 'EA9A_FRONTIER_REQUIRED');
  assertExact(CONFIG.formal_scope.site_id, 'KBS_MCSE_T1R1', 'EA9A_SITE_SCOPE_REQUIRED');
  assertExact(CONFIG.formal_scope.field_id, 'field_kbs_mcse_t1r1', 'EA9A_FIELD_SCOPE_REQUIRED');
  assertExact(CONFIG.formal_scope.season_id, 'season_2026_corn', 'EA9A_SEASON_SCOPE_REQUIRED');
  assertExact(CONFIG.formal_scope.crop, 'corn', 'EA9A_CROP_SCOPE_REQUIRED');
  assertExact(CONFIG.qualification_contract.this_candidate_expected_terminal_result, 'CURRENT_SEASON_PHENOLOGY_AUTHORITY_NOT_ESTABLISHED', 'EA9A_EXPECTED_FAIL_CLOSED_TERMINAL_REQUIRED');
  assertExact(CONFIG.qualification_contract.global_source_absence_claimed, false, 'EA9A_GLOBAL_ABSENCE_NONCLAIM_REQUIRED');
  assertExact(CONFIG.qualification_contract.future_observations_authorized, false, 'EA9A_FUTURE_OBSERVATIONS_MUST_BE_FORBIDDEN');
  assertExact(CONFIG.qualification_contract.future_phenocam_observations_authorized, false, 'EA9A_FUTURE_PHENOCAM_MUST_BE_FORBIDDEN');
  assertExact(CONFIG.qualification_contract.full_season_ex_post_normalization_authorized, false, 'EA9A_EX_POST_NORMALIZATION_MUST_BE_FORBIDDEN');
  assertExact(CONFIG.qualification_contract.gdd_stage_determinative, false, 'EA9A_GDD_MUST_REMAIN_NONDETERMINATIVE');
  assertExact(CONFIG.qualification_contract.minimum_backward_stability_hours, 6, 'EA9A_BACKWARD_STABILITY_MUST_BE_6H');
  assertExact(CONFIG.qualification_contract.minimum_forward_transition_guard_hours, 30, 'EA9A_FORWARD_GUARD_MUST_BE_30H');
  assertExact(CONFIG.preterminal_gdd_escape_probe.derived_product_code_text_may_be_emitted, false, 'EA9A_GDD_PRODUCT_CODE_TEXT_EMISSION_FORBIDDEN');
  assertExact(CONFIG.preterminal_gdd_escape_probe.historical_or_other_treatment_hybrid_inference_authorized, false, 'EA9A_GDD_CROSS_YEAR_TREATMENT_INFERENCE_FORBIDDEN');

  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'GEOX-MCFT-CAP09-EA9A-Qualification/1.0',
  });

  const findings = [];
  for (const candidate of CONFIG.enumerated_public_source_candidates) {
    findings.push(await fetchCandidate(context, candidate));
  }

  const byId = new Map(findings.map((finding) => [finding.candidate_id, finding]));
  const areaIdentity = byId.get('KBS_AGLOG_2026_T1R1_AREA_IDENTITY_6881');
  const planting = byId.get('KBS_AGLOG_2026_T1_PLANTING_6931');
  const mcseCatalog = byId.get('KBS_MCSE_AGRONOMIC_PRACTICES_CATALOG');
  const phenocam = byId.get('KBS_GLBRC_PHENOCAM_NETWORK_IMAGES');
  const glbrcPhenology = byId.get('KBS_GLBRC_PHENOLOGY_2013_PRESENT');
  assert(areaIdentity && planting && mcseCatalog && phenocam && glbrcPhenology, 'EA9A_REQUIRED_SOURCE_CANDIDATE_SET_INCOMPLETE');

  assertExact(areaIdentity.formal_scope_relationship, 'EXACT_PROVIDER_AREA_IDENTITY_DISCOVERY', 'EA9A_T1R1_AREA_RELATIONSHIP_REQUIRED');
  assertExact(areaIdentity.stage_determinative, false, 'EA9A_T1R1_MANAGEMENT_RECORD_MUST_NOT_BE_STAGE_TRUTH');
  assertExact(planting.formal_scope_relationship, 'CURRENT_SEASON_T1_MANAGEMENT_METADATA', 'EA9A_CURRENT_SEASON_PLANTING_RELATIONSHIP_REQUIRED');
  assertExact(planting.stage_determinative, false, 'EA9A_PLANTING_MUST_NOT_BECOME_STAGE_TRUTH');
  assertExact(mcseCatalog.formal_scope_relationship, 'SAME_EXPERIMENT_CATALOG_DISCOVERY', 'EA9A_MCSE_CATALOG_RELATIONSHIP_REQUIRED');
  assertExact(mcseCatalog.stage_determinative, false, 'EA9A_CATALOG_MUST_NOT_BECOME_STAGE_TRUTH');
  assertExact(phenocam.formal_scope_relationship, 'DIFFERENT_EXPERIMENT_GLBRC_BCSE', 'EA9A_PHENOCAM_EXPERIMENT_MISMATCH_REQUIRED');
  assertExact(phenocam.stage_determinative, false, 'EA9A_GLBRC_PHENOCAM_MUST_NOT_BE_MCSE_STAGE_TRUTH');
  assertExact(glbrcPhenology.formal_scope_relationship, 'DIFFERENT_EXPERIMENT_AND_NONCURRENT_PUBLIC_TABLE_WINDOW', 'EA9A_DIRECT_PHENOLOGY_EXPERIMENT_MISMATCH_REQUIRED');
  assertExact(glbrcPhenology.stage_determinative, false, 'EA9A_GLBRC_DIRECT_PHENOLOGY_MUST_NOT_BE_MCSE_STAGE_TRUTH');

  gddEscapeDiagnostics = planting.preterminal_gdd_escape_diagnostics;
  assert(gddEscapeDiagnostics, 'EA9A_PRETERMINAL_GDD_ESCAPE_DIAGNOSTICS_REQUIRED');
  assertExact(gddEscapeDiagnostics.derived_product_code_text_emitted, false, 'EA9A_DERIVED_PRODUCT_CODE_TEXT_MUST_NOT_BE_EMITTED');
  assertExact(gddEscapeDiagnostics.provider_body_emitted, false, 'EA9A_PROVIDER_BODY_MUST_NOT_BE_EMITTED');
  assertExact(
    gddEscapeDiagnostics.any_hybrid_or_material_disclosure_present,
    false,
    'EA9A_GDD_ESCAPE_DISCLOSURE_REQUIRES_FURTHER_QUALIFICATION_BEFORE_TERMINAL',
  );

  const stageDeterminative = findings.filter((finding) => finding.stage_determinative === true);
  assertExact(stageDeterminative.length, 0, 'EA9A_NO_ENUMERATED_STAGE_DETERMINATIVE_SOURCE_REQUIRED');

  const terminalResult = stageDeterminative.length > 0
    ? 'CURRENT_SEASON_CONTEMPORANEOUS_STAGE_AUTHORITY_ESTABLISHED'
    : 'CURRENT_SEASON_PHENOLOGY_AUTHORITY_NOT_ESTABLISHED';
  assertExact(terminalResult, CONFIG.qualification_contract.this_candidate_expected_terminal_result, 'EA9A_TERMINAL_RESULT_MISMATCH');

  const result = {
    schema_version: 'geox_mcft_cap09_ea9a_current_season_contemporaneous_phenology_qualification_result_v1',
    status: 'PASS',
    subject_sha: SUBJECT_SHA,
    authority_observed_at_utc: new Date().toISOString(),
    formal_scope: CONFIG.formal_scope,
    algorithm_id: CONFIG.decision_policy.algorithm_id,
    enumerated_candidate_count: findings.length,
    enumerated_candidate_findings: findings,
    preterminal_gdd_escape_diagnostics: gddEscapeDiagnostics,
    preterminal_gdd_escape_disclosure_proved_absent: true,
    stage_determinative_candidate_count: stageDeterminative.length,
    terminal_result: terminalResult,
    current_season_contemporaneous_stage_authority_established: false,
    current_season_stage_extended: false,
    current_season_late_stage_created: false,
    existing_ea2_mutated: false,
    global_source_absence_claimed: false,
    future_exact_provider_stage_record_may_be_requalified: true,
    future_observations_used: false,
    future_phenocam_observations_used: false,
    full_season_ex_post_normalization_used: false,
    gdd_stage_determinative: false,
    hidden_hybrid_or_relative_maturity_assumption_used: false,
    provider_payload_persisted_or_uploaded: false,
    provider_body_text_emitted: false,
    derived_provider_product_code_text_emitted: false,
    database_write_count: 0,
    formal_evidence_write_count: 0,
    raw_object_write_count: 0,
    runtime_config_write_count: 0,
    scheduler_write_count: 0,
    canonical_runtime_write_count: 0,
    successor_epoch_selected: false,
    new_natural_season_created: false,
    ea5e2_operational_activation_qualified: false,
    ea5e3_effective: false,
    formal_execution_count: '0/24',
    mcft_cap09_completed: false,
    next_primary_successor: 'S6-EA9B-NEW-NATURAL-SEASON-AUTHORITY-ADJUDICATION',
    parallel_operational_successor: 'S6-EA5E2-OPERATIONAL-ACTIVATION-QUALIFICATION-UNDER-AMENDMENT-08',
  };
  writeResult(result);
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  const result = {
    schema_version: 'geox_mcft_cap09_ea9a_current_season_contemporaneous_phenology_qualification_result_v1',
    status: 'FAIL',
    subject_sha: SUBJECT_SHA,
    error: safeError(error),
    observed_at_utc: new Date().toISOString(),
    terminal_result: null,
    current_season_contemporaneous_stage_authority_established: false,
    preterminal_gdd_escape_diagnostics: gddEscapeDiagnostics,
    preterminal_gdd_escape_disclosure_proved_absent: false,
    global_source_absence_claimed: false,
    future_observations_used: false,
    provider_payload_persisted_or_uploaded: false,
    provider_body_text_emitted: false,
    derived_provider_product_code_text_emitted: false,
    database_write_count: 0,
    formal_evidence_write_count: 0,
    raw_object_write_count: 0,
    runtime_config_write_count: 0,
    scheduler_write_count: 0,
    canonical_runtime_write_count: 0,
    successor_epoch_selected: false,
    new_natural_season_created: false,
    formal_execution_count: '0/24',
  };
  writeResult(result);
  console.error(JSON.stringify(result, null, 2));
  process.exitCode = 1;
} finally {
  await browser?.close();
}
