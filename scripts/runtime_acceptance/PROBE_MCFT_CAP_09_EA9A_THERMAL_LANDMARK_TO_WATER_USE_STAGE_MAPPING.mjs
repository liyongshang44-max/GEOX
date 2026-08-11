#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const CONFIG_PATH = path.join(ROOT, 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA9A-THERMAL-LANDMARK-TO-WATER-USE-STAGE-MAPPING-V1.json');
const OUT_DIR = path.join(ROOT, 'acceptance-output');
const OUT_PATH = path.join(OUT_DIR, 'MCFT_CAP_09_EA9A_THERMAL_LANDMARK_TO_WATER_USE_STAGE_MAPPING_RESULT.json');
const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));

const requireCondition = (condition, code) => {
  if (!condition) throw new Error(code);
};
const sha256 = (body) => `sha256:${crypto.createHash('sha256').update(body).digest('hex')}`;

function decodeEntities(text) {
  return text
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;|&#34;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#([0-9]+);/g, (_, dec) => String.fromCodePoint(Number.parseInt(dec, 10)));
}

function normalizeHtml(html) {
  return decodeEntities(html)
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[™®]/g, ' ')
    .replace(/[–—]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

async function fetchSource(source) {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 45000);
    try {
      const response = await fetch(source.url, {
        redirect: 'follow',
        signal: controller.signal,
        headers: {
          'user-agent': 'GEOX-MCFT-CAP09-EA9A-THERMAL-STAGE-MAPPING/1.0',
          accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.5',
          'cache-control': 'no-cache',
        },
      });
      const body = Buffer.from(await response.arrayBuffer());
      requireCondition(response.ok, `EA9A_MAPPING_SOURCE_HTTP_${source.source_id}_${response.status}`);
      requireCondition(body.length > 0 && body.length <= 20_000_000, `EA9A_MAPPING_SOURCE_BODY_${source.source_id}`);
      return {
        source_id: source.source_id,
        requested_url: source.url,
        final_url: response.url,
        http_status: response.status,
        bytes: body.length,
        response_sha256: sha256(body),
        text: normalizeHtml(body.toString('utf8')),
      };
    } catch (error) {
      lastError = error;
      if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, attempt * 750));
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error(`EA9A_MAPPING_SOURCE_FETCH_FAILED_${source.source_id}:${lastError?.message || 'UNKNOWN'}`);
}

const fetched = [];
for (const source of config.public_sources) fetched.push(await fetchSource(source));

const sourceResults = config.public_sources.map((source) => {
  const item = fetched.find((candidate) => candidate.source_id === source.source_id);
  const lower = item.text.toLowerCase();
  const marker_results = source.required_markers.map((marker) => ({
    marker,
    present: lower.includes(marker.toLowerCase()),
  }));
  return {
    source_id: source.source_id,
    provider_class: source.provider_class,
    requested_url: item.requested_url,
    final_url: item.final_url,
    http_status: item.http_status,
    bytes: item.bytes,
    response_sha256: item.response_sha256,
    marker_results,
    required_markers_all_present: marker_results.every((entry) => entry.present),
    raw_body_emitted: false,
  };
});

const byId = Object.fromEntries(fetched.map((item) => [item.source_id, item.text.toLowerCase()]));
const facts = {
  fao_initial_from_planting_to_approximately_10pct_ground_cover:
    /initial stage[^.]{0,300}(planting date|sowing)[^.]{0,300}(10%|10 percent)/i.test(byId.FAO56_CROP_GROWTH_STAGE_SEMANTICS),
  fao_mid_and_late_stage_labels_present:
    byId.FAO56_CROP_GROWTH_STAGE_SEMANTICS.includes('mid-season') && byId.FAO56_CROP_GROWTH_STAGE_SEMANTICS.includes('late season'),
  fao_late_from_start_of_maturity_to_harvest_or_full_senescence:
    /late season stage[^.]{0,400}start of maturity[^.]{0,400}(harvest|full senescence)/i.test(byId.FAO56_CROP_GROWTH_STAGE_SEMANTICS),
  fao_mid_includes_flowering_and_grain_setting:
    /mid\s*-?\s*season stage[^.]{0,500}includes flowering and grain-setting/i.test(byId.FAO_CROP_WATER_NEEDS_STAGE_SEMANTICS),
  fao_late_includes_ripening:
    /late season stage[^.]{0,500}includes ripening/i.test(byId.FAO_CROP_WATER_NEEDS_STAGE_SEMANTICS),
  pioneer_r1_is_silking:
    /silking\s*\(r1\)[^.]{0,250}silks visible outside the husks/i.test(byId.PIONEER_CORN_GROWTH_STAGE_SEMANTICS),
  pioneer_r6_is_physiological_maturity:
    /physiological maturity\s*\(r6\)[\s\S]{0,800}maximum dry weight is attained/i.test(byId.PIONEER_CORN_GROWTH_STAGE_SEMANTICS),
};

const sourcePass = sourceResults.every((entry) => entry.required_markers_all_present);
const factsPass = Object.values(facts).every(Boolean);
const mappingEstablished = sourcePass && factsPass;
const resultCode = mappingEstablished
  ? 'PARTIAL_SAFE_THERMAL_TO_WATER_USE_STAGE_MAPPING_ESTABLISHED'
  : 'THERMAL_TO_WATER_USE_STAGE_MAPPING_NOT_ESTABLISHED';

const result = {
  schema_version: 'geox_mcft_cap09_ea9a_thermal_landmark_to_water_use_stage_mapping_result_v1',
  status: 'PASS',
  subject_head_sha: process.env.MCFT_SUBJECT_SHA || null,
  observed_at_utc: new Date().toISOString(),
  algorithm_id: config.decision_policy.algorithm_id,
  result: resultCode,
  source_markers_pass: sourcePass,
  semantic_facts_pass: factsPass,
  source_results: sourceResults,
  semantic_facts: facts,
  mapping: {
    mapping_class: 'PARTIAL_SAFE_THERMAL_LANDMARK_TO_MODEL_STAGE_MAPPING',
    r1_silking_exact_landmark_model_stage: mappingEstablished ? 'MID' : null,
    r6_physiological_maturity_at_or_after_before_harvest_model_stage: mappingEstablished ? 'LATE' : null,
    pre_r1_candidate_stages: ['INITIAL', 'DEVELOPMENT', 'MID'],
    post_r1_pre_r6_candidate_stages: ['MID', 'LATE'],
    post_r6_before_harvest_candidate_stages: ['LATE'],
    silking_as_mid_late_boundary: false,
    physiological_maturity_as_mid_late_boundary: false,
    full_continuous_gdd_to_four_stage_mapping_established: false,
  },
  bounded_proxy_rule: {
    proxy_class: 'ASSUMED_BOUNDED_PROXY',
    silk_interval_gdu: [1222, 1438],
    physiological_maturity_interval_gdu: [2392, 2608],
    deterministic_late_candidate_if: 'MINIMUM_ACCUMULATED_BASE50_GDD_ACROSS_ALL_UNCERTAINTY_GTE_2608_AND_NO_HARVEST_OR_TERMINATION_EVIDENCE',
    all_other_thermal_ranges_four_stage_determinative: false,
  },
  authority_effect: {
    current_season_stage_authority_established: false,
    mapping_candidate_only_until_merge: true,
    database_write_count: 0,
    formal_evidence_write_count: 0,
    raw_object_write_count: 0,
    runtime_config_write_count: 0,
    scheduler_write_count: 0,
    canonical_runtime_write_count: 0,
    successor_epoch_selected: false,
    ea5e2_operational_activation_qualified: false,
    ea5e3_effective: false,
    formal_execution_count: '0/24',
    mcft_cap09_completed: false,
  },
  next_primary_successor: mappingEstablished
    ? config.decision_policy.on_pass
    : config.decision_policy.on_fail,
  public_raw_body_emitted: false,
};

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(OUT_PATH, `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify(result, null, 2));
