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
function sortedUnique(values) {
  return [...new Set(values)].sort();
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

async function inspectHybridCandidate(page, text) {
  const policy = CONFIG.hybrid_discovery_probe;
  const codeRegex = new RegExp(`\\b(?:${policy.recognized_product_code_patterns.join('|')})\\b`, 'gi');
  const productCodes = sortedUnique((text.match(codeRegex) || []).map((value) => value.toUpperCase()));
  const relativeMaturityValues = [];
  const rmRegex = /relative\s+maturity.{0,48}?(\d{2,3})(?:\s*days?)?/gi;
  for (const match of text.matchAll(rmRegex)) relativeMaturityValues.push(Number(match[1]));
  const rmDays = sortedUnique(relativeMaturityValues.filter((value) => Number.isInteger(value) && value >= 70 && value <= 140));
  const materialIds = sortedUnique(await page.locator('a[href*="/materials/"]').evaluateAll((anchors) => anchors.flatMap((anchor) => {
    try {
      const match = new URL(anchor.href).pathname.match(/\/materials\/(\d+)\/?$/i);
      return match ? [match[1]] : [];
    } catch {
      return [];
    }
  })));
  const diagnostics = {
    source_candidate_id: policy.source_candidate_id,
    explicit_variety_label_present: /\bvariety\s+planted\b/i.test(text),
    explicit_relative_maturity_label_present: /\brelative\s+maturity\b/i.test(text),
    recognizable_hybrid_code_count: productCodes.length,
    relative_maturity_value_count: rmDays.length,
    provider_material_link_count: materialIds.length,
    recognizable_hybrid_code_set_sha256: sha256(productCodes.join('|')),
    relative_maturity_value_set_sha256: sha256(rmDays.join('|')),
    provider_material_link_id_set_sha256: sha256(materialIds.join('|')),
    provider_body_emitted: false,
  };
  if (productCodes.length === 1 && rmDays.length === 1 && diagnostics.explicit_variety_label_present && diagnostics.explicit_relative_maturity_label_present) {
    return {
      ...diagnostics,
      resolution: 'EXACT_UNAMBIGUOUS_HYBRID_AND_RELATIVE_MATURITY_DISCLOSED',
      hybrid_product_code: productCodes[0],
      relative_maturity_days: rmDays[0],
      derived_exact_hybrid_product_code_emitted: true,
      derived_exact_relative_maturity_days_emitted: true,
    };
  }
  const anyDisclosure = diagnostics.explicit_variety_label_present || diagnostics.explicit_relative_maturity_label_present || productCodes.length > 0 || materialIds.length > 0;
  return {
    ...diagnostics,
    resolution: anyDisclosure ? 'AMBIGUOUS_HYBRID_DISCLOSURE' : 'NO_HYBRID_DISCLOSURE',
    hybrid_product_code: null,
    relative_maturity_days: null,
    derived_exact_hybrid_product_code_emitted: false,
    derived_exact_relative_maturity_days_emitted: false,
  };
}

async function fetchCandidate(context, candidate) {
  const requested = new URL(candidate.official_url);
  assert(ALLOWED_HOSTS.has(requested.hostname), `EA9A_UNAPPROVED_PROVIDER_HOST:${candidate.candidate_id}`);
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
      required_markers_verified: true,
      provider_body_emitted: false,
    };
    if (candidate.candidate_id === CONFIG.hybrid_discovery_probe.source_candidate_id) {
      finding.hybrid_discovery = await inspectHybridCandidate(page, text);
    }
    return finding;
  } finally {
    await page.close();
  }
}

let browser;
let hybridDiscovery = null;
try {
  assert(SUBJECT_SHA && /^[0-9a-f]{40}$/.test(SUBJECT_SHA), 'EA9A_EXACT_SUBJECT_SHA_REQUIRED');
  assertExact(CONFIG.schema_version, 'geox_mcft_cap09_ea9a_current_season_contemporaneous_phenology_qualification_v2', 'EA9A_SCHEMA_V2_REQUIRED');
  assertExact(CONFIG.frontier, 'S6-EA9A-CURRENT-SEASON-CONTEMPORANEOUS-PHENOLOGY-QUALIFICATION', 'EA9A_FRONTIER_REQUIRED');
  assertExact(CONFIG.formal_scope.site_id, 'KBS_MCSE_T1R1', 'EA9A_SITE_SCOPE_REQUIRED');
  assertExact(CONFIG.formal_scope.season_id, 'season_2026_corn', 'EA9A_SEASON_SCOPE_REQUIRED');
  assertExact(CONFIG.qualification_contract.gdd_stage_determinative_under_current_ea1j, false, 'EA9A_GDD_CURRENTLY_NONDETERMINATIVE_REQUIRED');
  assertExact(CONFIG.qualification_contract.future_observations_authorized, false, 'EA9A_FUTURE_OBSERVATIONS_FORBIDDEN');
  assertExact(CONFIG.qualification_contract.full_season_ex_post_normalization_authorized, false, 'EA9A_EX_POST_NORMALIZATION_FORBIDDEN');
  assertExact(CONFIG.hybrid_discovery_probe.historical_or_other_treatment_hybrid_inference_authorized, false, 'EA9A_CROSS_YEAR_HYBRID_INFERENCE_FORBIDDEN');
  assertExact(CONFIG.data_use_policy.provider_body_text_may_be_emitted, false, 'EA9A_PROVIDER_BODY_EMISSION_FORBIDDEN');

  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ userAgent: 'GEOX-MCFT-CAP09-EA9A-Qualification/2.0' });
  const findings = [];
  for (const candidate of CONFIG.enumerated_public_source_candidates) findings.push(await fetchCandidate(context, candidate));
  const byId = new Map(findings.map((finding) => [finding.candidate_id, finding]));
  const planting = byId.get('KBS_AGLOG_2026_T1_PLANTING_6931');
  assert(planting, 'EA9A_EXACT_2026_T1_PLANTING_SOURCE_REQUIRED');
  hybridDiscovery = planting.hybrid_discovery;
  assert(hybridDiscovery, 'EA9A_HYBRID_DISCOVERY_REQUIRED');

  const directStageCandidates = findings.filter((finding) => finding.stage_determinative === true);
  assertExact(directStageCandidates.length, 0, 'EA9A_DIRECT_STAGE_AUTHORITY_MUST_NOT_BE_PREDECLARED');

  let progressResult = null;
  let terminalResult = null;
  let ea9aTerminalReached = false;
  let nextPrimarySuccessor;
  if (hybridDiscovery.resolution === 'EXACT_UNAMBIGUOUS_HYBRID_AND_RELATIVE_MATURITY_DISCLOSED') {
    progressResult = CONFIG.qualification_contract.allowed_nonterminal_progress_result;
    nextPrimarySuccessor = 'S6-EA9A-HYBRID-GDD-STAGE-QUALIFICATION';
  } else if (hybridDiscovery.resolution === 'NO_HYBRID_DISCLOSURE') {
    terminalResult = 'CURRENT_SEASON_PHENOLOGY_AUTHORITY_NOT_ESTABLISHED';
    ea9aTerminalReached = true;
    nextPrimarySuccessor = 'S6-EA9B-NEW-NATURAL-SEASON-AUTHORITY-ADJUDICATION';
  } else {
    throw new Error('EA9A_FAIL_CLOSED_AMBIGUOUS_HYBRID_DISCLOSURE');
  }

  const result = {
    schema_version: 'geox_mcft_cap09_ea9a_current_season_contemporaneous_phenology_qualification_result_v2',
    status: 'PASS',
    subject_sha: SUBJECT_SHA,
    authority_observed_at_utc: new Date().toISOString(),
    formal_scope: CONFIG.formal_scope,
    algorithm_id: CONFIG.decision_policy.algorithm_id,
    enumerated_candidate_count: findings.length,
    enumerated_candidate_findings: findings,
    protected_main_image_authority_audit: CONFIG.protected_main_image_authority_audit,
    direct_stage_determinative_candidate_count: directStageCandidates.length,
    hybrid_discovery: hybridDiscovery,
    progress_result: progressResult,
    terminal_result: terminalResult,
    ea9a_terminal_reached: ea9aTerminalReached,
    current_season_contemporaneous_stage_authority_established: false,
    hybrid_identity_is_stage_authority: false,
    relative_maturity_days_alone_is_stage_threshold_authority: false,
    gdd_stage_determinative_under_current_ea1j: false,
    current_season_stage_extended: false,
    current_season_late_stage_created: false,
    existing_ea2_mutated: false,
    global_source_absence_claimed: false,
    global_image_source_absence_claimed: false,
    future_observations_used: false,
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
    parallel_operational_successor: 'S6-EA5E2-OPERATIONAL-ACTIVATION-QUALIFICATION-UNDER-AMENDMENT-08',
  };
  writeResult(result);
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  const result = {
    schema_version: 'geox_mcft_cap09_ea9a_current_season_contemporaneous_phenology_qualification_result_v2',
    status: 'FAIL',
    subject_sha: SUBJECT_SHA,
    error: safeError(error),
    observed_at_utc: new Date().toISOString(),
    hybrid_discovery: hybridDiscovery,
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
    formal_execution_count: '0/24',
  };
  writeResult(result);
  console.error(JSON.stringify(result, null, 2));
  process.exitCode = 1;
} finally {
  await browser?.close();
}
