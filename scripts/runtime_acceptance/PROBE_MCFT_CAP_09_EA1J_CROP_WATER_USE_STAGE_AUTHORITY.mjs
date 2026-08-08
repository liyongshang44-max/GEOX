#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const CONFIG_PATH = path.join(ROOT, 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA1J-CROP-WATER-USE-STAGE-AUTHORITY-V1.json');
const OUT = path.join(ROOT, 'acceptance-output/MCFT_CAP_09_EA1J_CROP_WATER_USE_STAGE_AUTHORITY_RESULT.json');
const CONFIG = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
const SUBJECT_SHA = process.env.MCFT_SUBJECT_SHA || null;
const HOUR_MS = 3_600_000;
const DAY_HOURS = 24;

function sha256(input) {
  return `sha256:${crypto.createHash('sha256').update(input).digest('hex')}`;
}
function writeResult(value) {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}
function safeError(error) {
  return (error instanceof Error ? error.message : String(error)).replace(/https?:\/\/[^\s]+/g, '[URL_REDACTED]');
}
function normalizeText(value) {
  return String(value || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
}
async function fetchAuthorityPage(context, url, label, requiredMarkers = []) {
  const page = await context.newPage();
  const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  if (!response?.ok()) throw new Error(`${label}_HTTP_${response?.status() ?? 'NO_RESPONSE'}`);
  const text = normalizeText(await page.locator('body').innerText());
  const lower = text.toLowerCase();
  for (const marker of requiredMarkers) {
    if (!lower.includes(String(marker).toLowerCase())) throw new Error(`${label}_MARKER_MISSING:${marker.replace(/[^a-z0-9]+/gi, '_').slice(0,80)}`);
  }
  const bytes = await response.body();
  const result = {
    final_url: response.url(),
    response_sha256: sha256(bytes),
    response_bytes: bytes.byteLength,
    retrieved_at: new Date().toISOString(),
  };
  await page.close();
  return { ...result, text };
}
function variantBoundariesHours(variant) {
  const initialEnd = variant.initial_days * DAY_HOURS;
  const developmentEnd = initialEnd + variant.development_days * DAY_HOURS;
  const midEnd = developmentEnd + variant.mid_days * DAY_HOURS;
  const lateEnd = midEnd + variant.late_days * DAY_HOURS;
  return { initialEnd, developmentEnd, midEnd, lateEnd };
}
function stageAtElapsedHours(elapsedHours, variant) {
  const b = variantBoundariesHours(variant);
  if (elapsedHours < 0) return 'PRE_PLANTING';
  if (elapsedHours < b.initialEnd) return 'INITIAL';
  if (elapsedHours < b.developmentEnd) return 'DEVELOPMENT';
  if (elapsedHours < b.midEnd) return 'MID';
  if (elapsedHours < b.lateEnd) return 'LATE';
  return 'POST_MODEL_SEASON';
}
function requireFaoTableSemantics(text) {
  const lower = normalizeText(text).toLowerCase();
  const patterns = [
    /maize \(grain\).*?30\s+50\s+60\s+40\s+180\s+april\s+east africa/s,
    /25\s+40\s+45\s+30\s+140\s+dec\/jan\s+arid climate/s,
    /20\s+35\s+40\s+30\s+125\s+june\s+nigeria/s,
    /20\s+35\s+40\s+30\s+125\s+october\s+india/s,
    /30\s+40\s+50\s+30\s+150\s+april\s+spain/s,
    /30\s+40\s+50\s+50\s+170\s+april\s+idaho/s,
  ];
  patterns.forEach((pattern, index) => {
    if (!pattern.test(lower)) throw new Error(`EA1J_FAO_MAIZE_VARIANT_${index + 1}_NOT_FOUND`);
  });
  const limitationMarkers = [
    'may vary substantially from region to region',
    'crop variety',
    'general guide',
    'local observations',
  ];
  for (const marker of limitationMarkers) {
    if (!lower.includes(marker)) throw new Error(`EA1J_FAO_LIMITATION_MARKER_MISSING:${marker.replace(/\s+/g, '_')}`);
  }
}

let browser;
try {
  if (!SUBJECT_SHA || !/^[0-9a-f]{40}$/.test(SUBJECT_SHA)) throw new Error('EA1J_EXACT_SUBJECT_SHA_REQUIRED');
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();

  const planting = await fetchAuthorityPage(
    context,
    CONFIG.planting_authority.official_url,
    'EA1J_KBS_PLANTING',
    ['Observation Date', '2026-05-11', 'Planting', 'T1', 'corn'],
  );
  const fao = await fetchAuthorityPage(
    context,
    CONFIG.model_stage_prior.official_url,
    'EA1J_FAO56',
    ['Maize (grain)', 'TABLE 11', 'Lengths of crop development stages'],
  );
  requireFaoTableSemantics(fao.text);

  const authorityTime = Date.now();
  const plantingStart = Date.parse(CONFIG.planting_authority.possible_event_window_utc.start_inclusive);
  const plantingEnd = Date.parse(CONFIG.planting_authority.possible_event_window_utc.end_exclusive);
  if (!Number.isFinite(plantingStart) || !Number.isFinite(plantingEnd) || plantingEnd <= plantingStart) throw new Error('EA1J_PLANTING_WINDOW_INVALID');
  if (plantingEnd - plantingStart !== 24 * HOUR_MS) throw new Error('EA1J_PLANTING_DAY_UNCERTAINTY_MUST_BE_24H');
  if (authorityTime <= plantingEnd) throw new Error('EA1J_AUTHORITY_TIME_MUST_FOLLOW_PLANTING');

  const backwardHours = CONFIG.derivation_policy.backward_stability_hours;
  const forwardHours = CONFIG.derivation_policy.forward_transition_guard_hours;
  const guardStart = authorityTime - backwardHours * HOUR_MS;
  const guardEnd = authorityTime + forwardHours * HOUR_MS;

  const currentElapsedMinHours = (authorityTime - plantingEnd) / HOUR_MS;
  const currentElapsedMaxHours = (authorityTime - plantingStart) / HOUR_MS;
  const guardedElapsedMinHours = (guardStart - plantingEnd) / HOUR_MS;
  const guardedElapsedMaxHours = (guardEnd - plantingStart) / HOUR_MS;

  const variantResults = [];
  for (const variant of CONFIG.model_stage_prior.variants) {
    const currentMinStage = stageAtElapsedHours(currentElapsedMinHours, variant);
    const currentMaxStage = stageAtElapsedHours(currentElapsedMaxHours, variant);
    const guardMinStage = stageAtElapsedHours(guardedElapsedMinHours, variant);
    const guardMaxStage = stageAtElapsedHours(guardedElapsedMaxHours, variant);
    const boundaries = variantBoundariesHours(variant);
    const currentStageStableAcrossPlantingUncertainty = currentMinStage === currentMaxStage;
    const wholeGuardStable = guardMinStage === guardMaxStage && guardMinStage === currentMinStage;
    const nextBoundary = currentMinStage === 'INITIAL' ? boundaries.initialEnd
      : currentMinStage === 'DEVELOPMENT' ? boundaries.developmentEnd
        : currentMinStage === 'MID' ? boundaries.midEnd
          : currentMinStage === 'LATE' ? boundaries.lateEnd
            : null;
    const minimumHoursToNextBoundary = nextBoundary === null ? null : nextBoundary - currentElapsedMaxHours;
    variantResults.push({
      variant_id: variant.variant_id,
      current_stage: currentMinStage,
      current_stage_stable_across_planting_day_uncertainty: currentStageStableAcrossPlantingUncertainty,
      backward_6h_and_forward_30h_guard_stable: wholeGuardStable,
      minimum_hours_to_next_model_stage_boundary: minimumHoursToNextBoundary === null ? null : Number(minimumHoursToNextBoundary.toFixed(3)),
    });
    if (!currentStageStableAcrossPlantingUncertainty) throw new Error(`CROP_WATER_USE_STAGE_NO_CONSERVATIVE_CONSENSUS:${variant.variant_id}:PLANTING_TIME_UNCERTAINTY`);
    if (!wholeGuardStable) throw new Error(`STAGE_TRANSITION_RISK:${variant.variant_id}`);
    if (!CONFIG.derivation_policy.allowed_stage_codes.includes(currentMinStage)) throw new Error(`EA1J_STAGE_OUTSIDE_ALLOWED_MODEL_CODES:${currentMinStage}`);
  }

  const consensusStages = [...new Set(variantResults.map((result) => result.current_stage))];
  if (consensusStages.length !== 1) throw new Error(`CROP_WATER_USE_STAGE_NO_CONSERVATIVE_CONSENSUS:${consensusStages.join('|')}`);
  const derivedStage = consensusStages[0];
  const minimumTransitionMarginHours = Math.min(...variantResults.map((result) => result.minimum_hours_to_next_model_stage_boundary).filter(Number.isFinite));
  if (minimumTransitionMarginHours < forwardHours) throw new Error(`STAGE_TRANSITION_RISK:MIN_MARGIN_${minimumTransitionMarginHours.toFixed(3)}H`);

  const result = {
    schema_version: 'geox_mcft_cap09_ea1j_crop_water_use_stage_authority_result_v1',
    status: 'PASS',
    subject_sha: SUBJECT_SHA,
    authority_time_utc: new Date(authorityTime).toISOString(),
    derived_context_authority: CONFIG.derived_context_authority,
    scope_candidate: CONFIG.scope_candidate,
    planting_authority: {
      provider: CONFIG.planting_authority.provider,
      observation_id: CONFIG.planting_authority.observation_id,
      planting_local_date: CONFIG.planting_authority.planting_local_date,
      event_time_precision: CONFIG.planting_authority.event_time_precision,
      response_sha256: planting.response_sha256,
      raw_body_emitted: false,
    },
    model_stage_prior: {
      provider: CONFIG.model_stage_prior.provider,
      response_sha256: fao.response_sha256,
      variant_count: CONFIG.model_stage_prior.variants.length,
      single_region_best_fit_selected: false,
      site_phenology_truth_claimed: false,
    },
    derivation: {
      algorithm_id: CONFIG.derivation_policy.algorithm_id,
      derived_stage_code: derivedStage,
      biological_stage_truth_claimed: false,
      v_or_r_stage_claimed: false,
      current_elapsed_time_uncertainty_hours: {
        min: Number(currentElapsedMinHours.toFixed(3)),
        max: Number(currentElapsedMaxHours.toFixed(3)),
      },
      guarded_elapsed_time_uncertainty_hours: {
        min: Number(guardedElapsedMinHours.toFixed(3)),
        max: Number(guardedElapsedMaxHours.toFixed(3)),
      },
      backward_stability_hours: backwardHours,
      forward_transition_guard_hours: forwardHours,
      assumed_stage_transition_guard: 'PASS',
      minimum_hours_to_next_model_stage_boundary: Number(minimumTransitionMarginHours.toFixed(3)),
      all_fao_maize_grain_variants_agree: true,
      all_possible_planting_times_in_local_day_agree: true,
      future_observations_used: false,
      future_phenocam_observations_used: false,
      full_season_ex_post_normalization_used: false,
      hybrid_specific_gdd_stage_threshold_used: false,
      variants: variantResults,
    },
    qualification_findings: {
      current_derived_crop_water_use_stage_authority_candidate: 'PASS',
      current_derived_stage_code: derivedStage,
      formal_crop_context_authority_created: false,
      qualified_formal_site: false,
      formal_window_started: false,
    },
    raw_provider_body_persisted_or_uploaded: false,
    database_write_count: 0,
    formal_evidence_write_count: 0,
    runtime_product_source_delta: 0,
  };
  writeResult(result);
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  const result = {
    schema_version: 'geox_mcft_cap09_ea1j_crop_water_use_stage_authority_result_v1',
    status: 'FAIL',
    subject_sha: SUBJECT_SHA,
    error: safeError(error),
    observed_at: new Date().toISOString(),
    future_observations_used: false,
    raw_provider_body_persisted_or_uploaded: false,
    database_write_count: 0,
    formal_evidence_write_count: 0,
    qualified_formal_site: false,
    formal_window_started: false,
  };
  writeResult(result);
  console.error(JSON.stringify(result, null, 2));
  process.exitCode = 1;
} finally {
  await browser?.close();
}
