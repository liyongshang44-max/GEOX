#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const CONFIG_PATH = path.join(ROOT, 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA9A-P0306Q-THERMAL-THRESHOLD-AUTHORITY-V1.json');
const OUT = path.join(ROOT, 'acceptance-output/MCFT_CAP_09_EA9A_P0306Q_THERMAL_THRESHOLD_AUTHORITY_RESULT.json');
const CONFIG = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
const SUBJECT_SHA = process.env.MCFT_SUBJECT_SHA || null;

function sha256(input) {
  return `sha256:${crypto.createHash('sha256').update(input).digest('hex')}`;
}
function normalizeText(value) {
  return String(value || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
}
function sortedUnique(values) {
  return [...new Set(values)].sort((a, b) => typeof a === 'number' && typeof b === 'number' ? a - b : String(a).localeCompare(String(b)));
}
function assert(condition, code) {
  if (!condition) throw new Error(code);
}
function assertExact(value, expected, code) {
  if (value !== expected) throw new Error(`${code}:expected=${JSON.stringify(expected)}:actual=${JSON.stringify(value)}`);
}
function safeError(error) {
  return (error instanceof Error ? error.message : String(error)).replace(/https?:\/\/[^\s]+/g, '[URL_REDACTED]');
}
function writeResult(value) {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}
function extractValues(text, patterns, min, max) {
  const values = [];
  for (const pattern of patterns) {
    const regex = new RegExp(pattern, 'gi');
    for (const match of text.matchAll(regex)) {
      const value = Number(match[1]);
      if (Number.isFinite(value) && value >= min && value <= max) values.push(value);
    }
  }
  return sortedUnique(values);
}
function productContexts(text, productCode, radius) {
  const upper = text.toUpperCase();
  const needle = productCode.toUpperCase();
  const contexts = [];
  let from = 0;
  while (true) {
    const index = upper.indexOf(needle, from);
    if (index < 0) break;
    contexts.push(text.slice(Math.max(0, index - radius), Math.min(text.length, index + needle.length + radius)));
    from = index + needle.length;
  }
  return contexts;
}
function inspectExactProductThreshold(text) {
  const parser = CONFIG.exact_product_threshold_parser;
  const contexts = productContexts(text, parser.target_product_code, parser.product_context_radius_chars);
  const silkValues = sortedUnique(contexts.flatMap((context) => extractValues(context, parser.gdu_to_silk_patterns, parser.plausible_gdu_min, parser.plausible_gdu_max)));
  const maturityValues = sortedUnique(contexts.flatMap((context) => extractValues(context, parser.gdu_to_physiological_maturity_patterns, parser.plausible_gdu_min, parser.plausible_gdu_max)));
  const established = contexts.length > 0 && silkValues.length === 1 && maturityValues.length === 1;
  return {
    target_product_code: parser.target_product_code,
    product_code_occurrence_count: contexts.length,
    gdu_to_silk_candidate_count: silkValues.length,
    gdu_to_physiological_maturity_candidate_count: maturityValues.length,
    product_specific_threshold_authority_candidate_established: established,
    exact_gdu_to_silk: established ? silkValues[0] : null,
    exact_gdu_to_physiological_maturity: established ? maturityValues[0] : null,
    candidate_value_sets_emitted_only_when_qualified: true,
    provider_body_emitted: false
  };
}

async function fetchCandidate(context, candidate) {
  const requested = new URL(candidate.official_url);
  assert(candidate.allowed_hosts.includes(requested.hostname), `EA9A_THERMAL_UNAPPROVED_REQUEST_HOST:${candidate.candidate_id}`);
  const page = await context.newPage();
  try {
    let response = null;
    let lastError = null;
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
    if (!response?.ok()) throw new Error(`EA9A_THERMAL_PROVIDER_FETCH_FAILED:${candidate.candidate_id}:${safeError(lastError || 'NO_RESPONSE')}`);
    const finalUrl = new URL(response.url());
    assert(candidate.allowed_hosts.includes(finalUrl.hostname), `EA9A_THERMAL_REDIRECT_HOST_FORBIDDEN:${candidate.candidate_id}`);
    const text = normalizeText(await page.locator('body').innerText());
    const lower = text.toLowerCase();
    for (const marker of candidate.required_markers) {
      assert(lower.includes(String(marker).toLowerCase()), `EA9A_THERMAL_PROVIDER_MARKER_MISSING:${candidate.candidate_id}:${String(marker).replace(/[^a-z0-9]+/gi, '_').slice(0, 80)}`);
    }
    const bytes = await response.body();
    const finding = {
      candidate_id: candidate.candidate_id,
      provider: candidate.provider,
      final_origin: finalUrl.origin,
      response_sha256: sha256(bytes),
      response_bytes: bytes.byteLength,
      retrieved_at: new Date().toISOString(),
      evidence_role: candidate.evidence_role,
      may_establish_exact_p0306q_threshold: candidate.may_establish_exact_p0306q_threshold,
      required_markers_verified: true,
      provider_body_emitted: false
    };
    if (candidate.candidate_id === 'PIONEER_OFFICIAL_MATURITY_METHOD') {
      finding.method_semantics = {
        crm_not_actual_days_from_planting_or_emergence: /do not represent actual days from planting or emergence/i.test(text),
        base_50f_present: /50\s*°?f/i.test(text),
        maximum_86f_present: /86\s*°?f/i.test(text),
        gdu_to_silk_semantics_present: /gdu(?:s|'s)?\s+to\s+silk/i.test(text),
        gdu_to_physiological_maturity_semantics_present: /gdu(?:s|'s)?\s+to\s+(?:phys(?:iological)?\.?\s*)?maturity/i.test(text),
        provider_body_emitted: false
      };
    }
    if (candidate.candidate_id === 'PIONEER_OFFICIAL_CURRENT_CORN_CATALOG') {
      finding.exact_product_threshold_discovery = inspectExactProductThreshold(text);
    }
    if (candidate.candidate_id === 'PIONEER_OFFICIAL_GDU_CALCULATOR') {
      finding.generic_tool_semantics = {
        crm_input_present: /comparative relative maturity/i.test(text),
        silking_layer_present: /\bsilking\b/i.test(text),
        black_layer_present: /black layer/i.test(text),
        exact_product_code_input_claimed: false,
        provider_body_emitted: false
      };
    }
    if (candidate.candidate_id === 'LANGFRITZ_SECONDARY_P0306AM_THRESHOLD') {
      finding.secondary_related_code = {
        related_code: 'P0306AM',
        numeric_threshold_markers_verified: true,
        exact_p0306q_product_identity: false,
        threshold_values_emitted: false,
        stage_determinative: false,
        provider_body_emitted: false
      };
    }
    return finding;
  } finally {
    await page.close();
  }
}

let browser;
try {
  assert(SUBJECT_SHA && /^[0-9a-f]{40}$/.test(SUBJECT_SHA), 'EA9A_THERMAL_EXACT_SUBJECT_SHA_REQUIRED');
  assertExact(CONFIG.schema_version, 'geox_mcft_cap09_ea9a_p0306q_thermal_threshold_authority_v1', 'EA9A_THERMAL_SCHEMA_REQUIRED');
  assertExact(CONFIG.base_main_sha, '565e2a59cfd34b18185998744b8380c1101ea45b', 'EA9A_THERMAL_BASE_REQUIRED');
  assertExact(CONFIG.formal_scope.hybrid_product_code, 'P0306Q', 'EA9A_THERMAL_EXACT_HYBRID_REQUIRED');
  assertExact(CONFIG.formal_scope.relative_maturity_days, 103, 'EA9A_THERMAL_RM_103_REQUIRED');
  assertExact(CONFIG.qualification_contract.relative_maturity_to_gdu_conversion_authorized, false, 'EA9A_THERMAL_RM_TO_GDU_FORBIDDEN');
  assertExact(CONFIG.qualification_contract.sibling_or_related_product_point_threshold_transfer_authorized, false, 'EA9A_THERMAL_RELATED_PRODUCT_TRANSFER_FORBIDDEN');
  assertExact(CONFIG.qualification_contract.stage_authority_created_by_this_qualification, false, 'EA9A_THERMAL_STAGE_CREATION_FORBIDDEN');
  assertExact(CONFIG.data_use_policy.provider_body_text_may_be_emitted, false, 'EA9A_THERMAL_BODY_EMISSION_FORBIDDEN');

  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ userAgent: 'GEOX-MCFT-CAP09-EA9A-P0306Q-Thermal-Qualification/1.0' });
  const findings = [];
  for (const candidate of CONFIG.enumerated_public_source_candidates) findings.push(await fetchCandidate(context, candidate));
  const byId = new Map(findings.map((finding) => [finding.candidate_id, finding]));

  const method = byId.get('PIONEER_OFFICIAL_MATURITY_METHOD');
  assert(method?.method_semantics, 'EA9A_THERMAL_FIRST_PARTY_METHOD_REQUIRED');
  assertExact(method.method_semantics.crm_not_actual_days_from_planting_or_emergence, true, 'EA9A_THERMAL_CRM_NOT_DAYS_SEMANTIC_REQUIRED');
  assertExact(method.method_semantics.base_50f_present, true, 'EA9A_THERMAL_BASE_50_REQUIRED');
  assertExact(method.method_semantics.maximum_86f_present, true, 'EA9A_THERMAL_MAX_86_REQUIRED');
  assertExact(method.method_semantics.gdu_to_silk_semantics_present, true, 'EA9A_THERMAL_SILK_SEMANTIC_REQUIRED');
  assertExact(method.method_semantics.gdu_to_physiological_maturity_semantics_present, true, 'EA9A_THERMAL_MATURITY_SEMANTIC_REQUIRED');

  const catalog = byId.get('PIONEER_OFFICIAL_CURRENT_CORN_CATALOG');
  assert(catalog?.exact_product_threshold_discovery, 'EA9A_THERMAL_PRODUCT_CATALOG_DISCOVERY_REQUIRED');
  const discovery = catalog.exact_product_threshold_discovery;
  const thresholdEstablished = discovery.product_specific_threshold_authority_candidate_established === true;

  const progressResult = thresholdEstablished ? CONFIG.qualification_contract.allowed_progress_result : null;
  const terminalResult = thresholdEstablished ? null : CONFIG.qualification_contract.allowed_ea9a_terminal_result;
  const nextPrimarySuccessor = thresholdEstablished ? CONFIG.qualification_contract.successor_on_progress : CONFIG.qualification_contract.successor_on_terminal;

  const result = {
    schema_version: 'geox_mcft_cap09_ea9a_p0306q_thermal_threshold_authority_result_v1',
    status: 'PASS',
    subject_sha: SUBJECT_SHA,
    authority_observed_at_utc: new Date().toISOString(),
    formal_scope: CONFIG.formal_scope,
    algorithm_id: CONFIG.decision_policy.algorithm_id,
    enumerated_candidate_count: findings.length,
    enumerated_candidate_findings: findings,
    first_party_thermal_method_qualified: true,
    exact_p0306q_product_specific_threshold_authority_established: thresholdEstablished,
    exact_gdu_to_silk: thresholdEstablished ? discovery.exact_gdu_to_silk : null,
    exact_gdu_to_physiological_maturity: thresholdEstablished ? discovery.exact_gdu_to_physiological_maturity : null,
    relative_maturity_to_gdu_conversion_used: false,
    related_product_point_threshold_transfer_used: false,
    secondary_dealer_threshold_used_as_stage_authority: false,
    generic_crm_calculator_used_as_stage_authority: false,
    source_meteorology_consumed: false,
    progress_result: progressResult,
    terminal_result: terminalResult,
    ea9a_terminal_reached: !thresholdEstablished,
    current_season_contemporaneous_stage_authority_established: false,
    biological_v_or_r_truth_claimed: false,
    model_stage_initial_development_mid_late_claimed: false,
    existing_ea2_mutated: false,
    global_product_source_absence_claimed: false,
    future_exact_product_source_may_be_separately_requalified: true,
    future_observations_used: false,
    full_season_ex_post_normalization_used: false,
    provider_payload_persisted_or_uploaded: false,
    provider_body_text_emitted: false,
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
    next_primary_successor: nextPrimarySuccessor,
    parallel_operational_successor: 'S6-EA5E2-OPERATIONAL-ACTIVATION-QUALIFICATION-UNDER-AMENDMENT-08'
  };
  writeResult(result);
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  const result = {
    schema_version: 'geox_mcft_cap09_ea9a_p0306q_thermal_threshold_authority_result_v1',
    status: 'FAIL',
    subject_sha: SUBJECT_SHA,
    error: safeError(error),
    observed_at_utc: new Date().toISOString(),
    terminal_result: null,
    ea9a_terminal_reached: false,
    current_season_contemporaneous_stage_authority_established: false,
    provider_body_text_emitted: false,
    database_write_count: 0,
    raw_object_write_count: 0,
    runtime_config_write_count: 0,
    scheduler_write_count: 0,
    canonical_runtime_write_count: 0,
    successor_epoch_selected: false,
    formal_execution_count: '0/24'
  };
  writeResult(result);
  console.error(JSON.stringify(result, null, 2));
  process.exitCode = 1;
} finally {
  await browser?.close();
}
