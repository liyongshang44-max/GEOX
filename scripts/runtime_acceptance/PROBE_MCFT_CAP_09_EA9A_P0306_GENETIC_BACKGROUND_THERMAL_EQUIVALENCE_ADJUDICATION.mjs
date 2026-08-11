#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const CONFIG_PATH = path.join(ROOT, 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA9A-P0306-GENETIC-BACKGROUND-THERMAL-EQUIVALENCE-ADJUDICATION-V1.json');
const OUT_DIR = path.join(ROOT, 'acceptance-output');
const OUT_PATH = path.join(OUT_DIR, 'MCFT_CAP_09_EA9A_P0306_GENETIC_BACKGROUND_THERMAL_EQUIVALENCE_ADJUDICATION_RESULT.json');
const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));

const sha256 = (body) => `sha256:${crypto.createHash('sha256').update(body).digest('hex')}`;
const requireCondition = (condition, code) => {
  if (!condition) throw new Error(code);
};

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
          'user-agent': 'GEOX-MCFT-CAP09-EA9A-P0306-THERMAL-ADJUDICATION/1.0',
          accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.5',
          'cache-control': 'no-cache',
        },
      });
      const body = Buffer.from(await response.arrayBuffer());
      requireCondition(response.ok, `EA9A_P0306_SOURCE_HTTP_${source.source_id}_${response.status}`);
      requireCondition(body.length > 0, `EA9A_P0306_SOURCE_EMPTY_${source.source_id}`);
      requireCondition(body.length <= 20_000_000, `EA9A_P0306_SOURCE_TOO_LARGE_${source.source_id}`);
      const contentType = (response.headers.get('content-type') || '').toLowerCase();
      requireCondition(contentType.includes('text/html') || contentType.includes('text/plain') || contentType === '', `EA9A_P0306_SOURCE_CONTENT_TYPE_${source.source_id}`);
      const html = body.toString('utf8');
      const text = normalizeHtml(html);
      return {
        source_id: source.source_id,
        requested_url: source.url,
        final_url: response.url,
        http_status: response.status,
        bytes: body.length,
        response_sha256: sha256(body),
        text,
      };
    } catch (error) {
      lastError = error;
      if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, attempt * 750));
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error(`EA9A_P0306_SOURCE_FETCH_FAILED_${source.source_id}:${lastError?.message || 'UNKNOWN'}`);
}

const byId = new Map();
for (const source of config.enumerated_public_sources) byId.set(source.source_id, await fetchSource(source));

const pioneerLegal = byId.get('PIONEER_CURRENT_HYBRID_FAMILY_SEMANTICS').text;
const bayer = byId.get('BAYER_P0306Q_P0306AMXT_SAME_GENETIC_BACKGROUND').text;
const pioneerMaturity = byId.get('PIONEER_CURRENT_SAME_FAMILY_MATURITY_VARIANCE').text;
const guide = byId.get('PIONEER_2020_PRODUCT_GUIDE_MIRROR_P0306_PROFILE').text;
const langfritz = byId.get('LANGFRITZ_P0306AM_GDU_VALUES').text;

const facts = {
  pioneer_hybrid_family_same_base_genetics_semantics: /hybrid family[^.]{0,160}same base genetics/i.test(pioneerLegal),
  pioneer_amxt_and_q_technology_segment_semantics_present: /\bamxt\b/i.test(pioneerLegal) && /qrome/i.test(pioneerLegal),
  p0306q_p0306amxt_same_genetic_background_explicit: /p0306q[\s\S]{0,700}p0306amxt[^.]{0,220}same genetic background as treatment 4/i.test(bayer),
  p0306q_rm_103_present: /103\s*rm[\s\S]{0,220}p0306q|p0306q[\s\S]{0,220}103\s*rm/i.test(bayer),
  pioneer_same_family_different_technology_trait_rule_present: /same genetic family[^.]{0,220}different technology traits[^.]{0,220}same maturity/i.test(pioneerMaturity),
  pioneer_same_family_maturity_variance_two_to_three_days_present: /differ by two to three days in maturity/i.test(pioneerMaturity),
  pioneer_base50_50f_86f_method_present: /base 50/i.test(pioneerMaturity) && /86\s*°?\s*f/i.test(pioneerMaturity) && /50\s*°?\s*f/i.test(pioneerMaturity),
  p0306am_profile_103_101_104_present: /p0306am\s+3100\s+103\s+101\s+104/i.test(guide),
  p0306amxt_profile_103_101_104_present: /p0306amxt\s+3125\s+103\s+101\s+104/i.test(guide),
  p0306am_p0306amxt_exact_same_genetic_background_explicit: false,
  p0306am_canadian_heat_units: 3100,
  p0306amxt_canadian_heat_units: 3125,
  canadian_heat_unit_difference: 25,
  p0306am_p0306amxt_same_crm: 103,
  p0306am_p0306amxt_same_silk_crm: 101,
  p0306am_p0306amxt_same_physiological_crm: 104,
  langfritz_independent_pioneer_sales_representative_identity_present: /independent sales representative for pioneer/i.test(langfritz),
  p0306am_secondary_103_crm_2500_phys_1330_silk_present: /p0306am[\s\S]{0,500}103 day crm[\s\S]{0,220}2500[^.]{0,220}1330/i.test(langfritz),
  p0306am_secondary_gdu_to_silk: 1330,
  p0306am_secondary_gdu_to_physiological_maturity: 2500,
  exact_p0306q_gdu_threshold_observed_in_enumerated_sources: false,
  exact_p0306amxt_gdu_threshold_observed_in_enumerated_sources: false,
  base50_daily_gdu_theoretical_max: 36,
  three_day_base50_gdu_theoretical_max: 108,
};

const sourceMarkerResults = config.enumerated_public_sources.map((source) => {
  const fetched = byId.get(source.source_id);
  const lower = fetched.text.toLowerCase();
  const marker_results = source.required_markers.map((marker) => ({ marker, present: lower.includes(marker.toLowerCase()) }));
  return {
    source_id: source.source_id,
    provider_class: source.provider_class,
    evidence_role: source.evidence_role,
    requested_url: fetched.requested_url,
    final_url: fetched.final_url,
    http_status: fetched.http_status,
    bytes: fetched.bytes,
    response_sha256: fetched.response_sha256,
    required_marker_count: marker_results.length,
    required_markers_all_present: marker_results.every((item) => item.present),
    marker_results,
    raw_body_emitted: false,
  };
});

const requiredFactKeys = [
  'pioneer_hybrid_family_same_base_genetics_semantics',
  'pioneer_amxt_and_q_technology_segment_semantics_present',
  'p0306q_p0306amxt_same_genetic_background_explicit',
  'p0306q_rm_103_present',
  'pioneer_same_family_different_technology_trait_rule_present',
  'pioneer_same_family_maturity_variance_two_to_three_days_present',
  'pioneer_base50_50f_86f_method_present',
  'p0306am_profile_103_101_104_present',
  'p0306amxt_profile_103_101_104_present',
  'langfritz_independent_pioneer_sales_representative_identity_present',
  'p0306am_secondary_103_crm_2500_phys_1330_silk_present',
];

const sourceMarkersPass = sourceMarkerResults.every((source) => source.required_markers_all_present);
const evidenceFactsPass = requiredFactKeys.every((key) => facts[key] === true);
const supported = sourceMarkersPass && evidenceFactsPass;
const resultCode = supported
  ? 'P0306_BOUNDED_THERMAL_TRANSFER_POLICY_ADJUDICATION_SUPPORTED'
  : 'P0306_BOUNDED_THERMAL_TRANSFER_POLICY_ADJUDICATION_NOT_SUPPORTED';

const result = {
  schema_version: 'geox_mcft_cap09_ea9a_p0306_genetic_background_thermal_equivalence_adjudication_result_v1',
  status: 'PASS',
  observed_at_utc: new Date().toISOString(),
  subject_head_sha: process.env.MCFT_SUBJECT_SHA || null,
  algorithm_id: config.decision_policy.algorithm_id,
  result: resultCode,
  source_markers_pass: sourceMarkersPass,
  evidence_facts_pass: evidenceFactsPass,
  source_results: sourceMarkerResults,
  derived_evidence_facts: facts,
  interpretation: {
    explicit_q_to_amxt_genetic_bridge_established: facts.p0306q_p0306amxt_same_genetic_background_explicit,
    explicit_am_to_amxt_genetic_bridge_established: false,
    am_to_amxt_maturity_profile_correlated: facts.p0306am_profile_103_101_104_present && facts.p0306amxt_profile_103_101_104_present,
    am_to_amxt_exact_thermal_identity_established: false,
    nonzero_canadian_heat_unit_difference_preserved: facts.canadian_heat_unit_difference === 25,
    canadian_heat_units_converted_to_base50_gdu: false,
    p0306am_1330_2500_source_class: 'SECONDARY_INDEPENDENT_PIONEER_SALES_REPRESENTATIVE',
    p0306am_1330_2500_stage_determinative: false,
    p0306am_point_threshold_transferred_to_p0306q: false,
    p0306q_point_threshold_authority_established: false,
    p0306q_bounded_thermal_transfer_authorized: false,
    three_day_108_gdu_value_is_policy_review_bound_only: true,
  },
  authority_effect: {
    historical_ea9a_terminal_result_preserved: true,
    ea9b_time_gated_frontier_preserved: true,
    current_season_2026_recovery_reopened: false,
    current_season_stage_authority_established: false,
    amendment_10_authority_created: false,
    amendment_10_candidate_development_authorized: supported,
    new_natural_season_created: false,
    successor_epoch_selected: false,
    ea5e2_operational_activation_qualified: false,
    ea5e3_effective: false,
    formal_execution_count: '0/24',
    database_write_count: 0,
    formal_evidence_write_count: 0,
    raw_object_write_count: 0,
    runtime_config_write_count: 0,
    scheduler_write_count: 0,
    canonical_runtime_write_count: 0,
    mcft_cap09_completed: false,
  },
  next_primary_successor: supported
    ? config.decision_policy.successor_if_supported
    : config.decision_policy.successor_if_not_supported,
  parallel_operational_successor: config.decision_policy.parallel_operational_successor,
  public_raw_body_emitted: false,
};

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(OUT_PATH, `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify(result, null, 2));
