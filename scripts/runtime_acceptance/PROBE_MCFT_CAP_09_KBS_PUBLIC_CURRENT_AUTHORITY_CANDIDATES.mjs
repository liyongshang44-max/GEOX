#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = path.join(ROOT, 'acceptance-output/MCFT_CAP_09_KBS_PUBLIC_CURRENT_AUTHORITY_CANDIDATE_SCREEN.json');
const DIRECT_PROBE_OUT = path.join(ROOT, 'acceptance-output/MCFT_CAP_09_DIRECT_CURRENT_ANCHOR_REFRESH_DISCOVERY.json');
const DIRECT_PROBE = path.join(ROOT, 'scripts/runtime_acceptance/PROBE_MCFT_CAP_09_DIRECT_CURRENT_ANCHOR_REFRESH_DISCOVERY.mjs');
const SUBJECT_SHA = String(process.env.MCFT_SUBJECT_SHA || '').trim();

const URLS = Object.freeze({
  aglog_index: 'https://aglog.kbs.msu.edu/observations',
  aglog_t1r1: 'https://aglog.kbs.msu.edu/areas/1',
  aglog_material_p0306q: 'https://aglog.kbs.msu.edu/materials/392',
  aglog_observation_7095: 'https://aglog.kbs.msu.edu/observations/7095',
  kbs004_field_log: 'https://lter.kbs.msu.edu/datatables/16',
  kbs004_field_log_expanded: 'https://lter.kbs.msu.edu/datatables/150',
  kbs004_seeds: 'https://lter.kbs.msu.edu/datatables/17',
  kbs019_biomass: 'https://lter.kbs.msu.edu/datatables/39',
  kbs030_stand_counts: 'https://lter.kbs.msu.edu/datatables/172',
  kbs020_yields: 'https://lter.kbs.msu.edu/datatables/51',
  kbs037_processed_yield: 'https://lter.kbs.msu.edu/datatables/828',
  kbs092_glbrc_phenology: 'https://lter.kbs.msu.edu/datatables/514',
  kbs140_rex_anpp: 'https://lter.kbs.msu.edu/datatables/794',
  kbs039_plot_polygons: 'https://lter.kbs.msu.edu/datatables/829',
  kbs136_plot_centers: 'https://lter.kbs.msu.edu/datatables/644',
  kbs_gis: 'https://lter.kbs.msu.edu/data/gis-data/',
  kbs_2026_plot_map: 'https://lter.kbs.msu.edu/maps/images/current-kbs-lter-mcse-plot-map.pdf'
});

function assert(condition, code) {
  if (!condition) throw new Error(code);
}
function sha256(value) {
  return `sha256:${crypto.createHash('sha256').update(value).digest('hex')}`;
}
function safeError(error) {
  return error instanceof Error ? error.message : String(error);
}
function write(value) {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify(value));
}
function normalize(text) {
  return String(text || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
}
async function fetchBytes(url, code, maxBytes = 8_000_000) {
  const parsed = new URL(url);
  assert(parsed.protocol === 'https:', `${code}_HTTPS_REQUIRED`);
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(url, {
        redirect: 'follow',
        headers: { 'user-agent': 'GEOX-MCFT-CAP09-KBS-Authority-Candidate-Screen/1.0' },
        signal: AbortSignal.timeout(60_000)
      });
      assert(response.ok, `${code}_HTTP_${response.status}`);
      const finalUrl = new URL(response.url);
      assert(finalUrl.protocol === 'https:', `${code}_FINAL_HTTPS_REQUIRED`);
      const bytes = Buffer.from(await response.arrayBuffer());
      assert(bytes.byteLength > 0, `${code}_EMPTY`);
      assert(bytes.byteLength <= maxBytes, `${code}_TOO_LARGE_${bytes.byteLength}`);
      return {
        bytes,
        response_sha256: sha256(bytes),
        response_bytes: bytes.byteLength,
        retrieved_at: new Date().toISOString(),
        final_host: finalUrl.hostname,
        final_pathname: finalUrl.pathname
      };
    } catch (error) {
      lastError = error;
      if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, 1500 * attempt));
    }
  }
  throw lastError;
}
async function fetchText(url, code, maxBytes) {
  const fetched = await fetchBytes(url, code, maxBytes);
  return { ...fetched, text: fetched.bytes.toString('utf8') };
}
function surfaceBase(id, role, urls) {
  return { source_id: id, role, urls, retained_as_authority_candidate_source_family: false };
}
function marker(text, value) {
  return normalize(text).toLowerCase().includes(normalize(value).toLowerCase());
}
function material2026Slice(text) {
  const normalized = normalize(text);
  const index = normalized.indexOf('2026-05-20');
  return index < 0 ? '' : normalized.slice(index, index + 2400);
}
function findReviewedRecord(aglog, observationId) {
  return (aglog.reviewed_relevant_records || []).find((row) => row.provider_observation_id === observationId) || null;
}

async function main() {
  assert(/^[0-9a-f]{40}$/.test(SUBJECT_SHA), 'KBS_AUTHORITY_SCREEN_EXACT_SUBJECT_REQUIRED');

  execFileSync(process.execPath, [DIRECT_PROBE], {
    cwd: ROOT,
    stdio: 'inherit',
    env: { ...process.env, MCFT_SUBJECT_SHA: SUBJECT_SHA }
  });
  const aglog = JSON.parse(fs.readFileSync(DIRECT_PROBE_OUT, 'utf8'));
  assert(aglog.status === 'PASS', 'KBS_AUTHORITY_SCREEN_AGLOG_DIRECT_PROBE_PASS_REQUIRED');

  const [
    material,
    fieldLog,
    expanded,
    seeds,
    biomass,
    standCounts,
    yields,
    processedYield,
    phenology,
    rex,
    polygons,
    centers,
    gis,
    plotMap,
    observation7095Detail
  ] = await Promise.all([
    fetchText(URLS.aglog_material_p0306q, 'KBS_AUTHORITY_SCREEN_P0306Q'),
    fetchText(URLS.kbs004_field_log, 'KBS_AUTHORITY_SCREEN_FIELD_LOG'),
    fetchText(URLS.kbs004_field_log_expanded, 'KBS_AUTHORITY_SCREEN_EXPANDED'),
    fetchText(URLS.kbs004_seeds, 'KBS_AUTHORITY_SCREEN_SEEDS'),
    fetchText(URLS.kbs019_biomass, 'KBS_AUTHORITY_SCREEN_BIOMASS'),
    fetchText(URLS.kbs030_stand_counts, 'KBS_AUTHORITY_SCREEN_STAND_COUNTS'),
    fetchText(URLS.kbs020_yields, 'KBS_AUTHORITY_SCREEN_YIELDS'),
    fetchText(URLS.kbs037_processed_yield, 'KBS_AUTHORITY_SCREEN_PROCESSED_YIELD'),
    fetchText(URLS.kbs092_glbrc_phenology, 'KBS_AUTHORITY_SCREEN_PHENOLOGY'),
    fetchText(URLS.kbs140_rex_anpp, 'KBS_AUTHORITY_SCREEN_REX'),
    fetchText(URLS.kbs039_plot_polygons, 'KBS_AUTHORITY_SCREEN_POLYGONS'),
    fetchText(URLS.kbs136_plot_centers, 'KBS_AUTHORITY_SCREEN_CENTERS'),
    fetchText(URLS.kbs_gis, 'KBS_AUTHORITY_SCREEN_GIS'),
    fetchBytes(URLS.kbs_2026_plot_map, 'KBS_AUTHORITY_SCREEN_PLOT_MAP', 4_000_000),
    fetchText(URLS.aglog_observation_7095, 'KBS_AUTHORITY_SCREEN_OBS7095_DETAIL')
  ]);

  const record6931 = findReviewedRecord(aglog, 6931);
  const record7095 = findReviewedRecord(aglog, 7095);
  assert(record6931, 'KBS_AUTHORITY_SCREEN_OBS6931_REQUIRED');
  assert(record7095, 'KBS_AUTHORITY_SCREEN_OBS7095_REQUIRED');

  const p0306q2026 = material2026Slice(material.text);
  const materialHas2026P0306Q = /2026-05-20/i.test(p0306q2026) && /P0306Q/i.test(p0306q2026);
  const materialFormalScopeMatch = /\bT1R1\b/i.test(p0306q2026) || /\bLTER\s+T1\b/i.test(p0306q2026);
  const materialT3PositiveControl = /\bLTER\s+T3\b/i.test(p0306q2026);

  const latestT1r1Date = aglog.source_scan.latest_t1r1_observation_date;
  const latestT1r1Id = aglog.source_scan.latest_t1r1_observation_id;
  const hasCurrentDirectCandidate = aglog.discovery_semantics.direct_positive_current_season_candidate_found === true;
  const hasDirectPhenologyCandidate = aglog.discovery_semantics.direct_candidate_with_provider_phenology_token_found === true;

  const obs7095PlantHeightBodyFact = /Plant\s+height(?:\s*\(ft\))?/i.test(normalize(observation7095Detail.text));
  const obs7095T1r1AreaMembership = latestT1r1Id === 7095 && latestT1r1Date === '2026-06-25';
  const obs7095DirectBiological = obs7095PlantHeightBodyFact
    && obs7095T1r1AreaMembership
    && Array.isArray(record7095.direct_phenology_tokens)
    && record7095.direct_phenology_tokens.length === 0;

  const surfaces = [];

  const aglogFamily = surfaceBase(
    'KBS_AGLOG_MCSE_LIVE_FAMILY',
    'PRIMARY_CURRENT_SEASON_EVENT_AND_OBSERVATION_SOURCE',
    [URLS.aglog_index, URLS.aglog_t1r1, URLS.kbs004_field_log, URLS.kbs004_field_log_expanded]
  );
  Object.assign(aglogFamily, {
    current_2026_provider_rows_observed: true,
    exact_t1r1_scope_supported: true,
    p0306q_season_origin_supported_by_observation_6931: record6931.explicit_p0306q_semantic_present === true,
    latest_t1r1_observation_id: latestT1r1Id,
    latest_t1r1_observation_date: latestT1r1Date,
    observation_7095_direct_biological_fact: obs7095DirectBiological,
    observation_7095_detail_body_plant_height_semantic: obs7095PlantHeightBodyFact,
    observation_7095_t1r1_area_membership: obs7095T1r1AreaMembership,
    observation_7095_detail_response_sha256: observation7095Detail.response_sha256,
    observation_7095_direct_phenology_token: false,
    current_as_of_screen_direct_positive_candidate_found: hasCurrentDirectCandidate,
    provider_direct_phenology_candidate_found: hasDirectPhenologyCandidate,
    retained_as_authority_candidate_source_family: true,
    retained_role: 'ONLY_KBS_PUBLIC_SOURCE_FAMILY_CAPABLE_OF_FORMING_FORMAL_SCOPE_LIFECYCLE_OR_DIRECT_PHENOLOGY_AUTHORITY_CANDIDATES',
    current_qualifying_authority_candidate: null,
    mirror_note: 'KBS004 /16 and /150 are derived public mirrors of the same underlying AgLog facts, not independent authorities.',
    response_digests: {
      field_log_html: fieldLog.response_sha256,
      expanded_field_log_html: expanded.response_sha256
    }
  });
  surfaces.push(aglogFamily);

  const seedsSurface = surfaceBase('KBS004_SEEDS_AND_PLANTING_DATE', 'SEASON_ORIGIN_MIRROR', [URLS.kbs004_seeds]);
  Object.assign(seedsSurface, {
    current_2026_row_visible: marker(seeds.text, '2026-'),
    provider_declared_coverage_marker: marker(seeds.text, 'November 1988 to May 2024'),
    treatment_level_only: true,
    reason_not_retained: 'Not replicate-specific and not a current biological/phenology fact; AgLog observation 6931 is the stronger origin source.',
    response_sha256: seeds.response_sha256
  });
  surfaces.push(seedsSurface);

  const materialSurface = surfaceBase('KBS_AGLOG_MATERIAL_P0306Q', 'HYBRID_TRANSACTION_INDEX', [URLS.aglog_material_p0306q]);
  Object.assign(materialSurface, {
    current_2026_p0306q_transaction_observed: materialHas2026P0306Q,
    current_2026_formal_t1_or_t1r1_match: materialFormalScopeMatch,
    current_2026_t3_positive_control: materialT3PositiveControl,
    response_sha256: material.response_sha256,
    underlying_source_family: 'KBS_AGLOG_MCSE_LIVE_FAMILY',
    independent_authority_source: false,
    reason_not_retained: materialFormalScopeMatch
      ? 'AgLog material history is an index/view of the same underlying AgLog transaction family, not independent evidence; formal-scope transactions remain within KBS_AGLOG_MCSE_LIVE_FAMILY.'
      : 'Current 2026 P0306Q transaction is out-of-scope T3 and the material page is an AgLog-family index; no T3-to-T1R1 substitution.'
  });
  surfaces.push(materialSurface);

  const plotMapSurface = surfaceBase('KBS_MCSE_2026_PLOT_MAP', 'CURRENT_SEASON_CROP_IDENTITY_SUPPORT', [URLS.kbs_2026_plot_map]);
  Object.assign(plotMapSurface, {
    current_2026_t1r1_corn_identity_previously_qualified_on_protected_main: true,
    direct_biological_fact: false,
    direct_phenology_fact: false,
    reason_not_retained: 'Supporting current-season crop identity only; does not observe living crop state or phenology.',
    response_sha256: plotMap.response_sha256
  });
  surfaces.push(plotMapSurface);

  const polygonSurface = surfaceBase('KBS039_MCSE_PLOT_POLYGONS', 'EXACT_SPATIAL_BINDING_SUPPORT', [URLS.kbs039_plot_polygons]);
  Object.assign(polygonSurface, {
    exact_t1r1_geometry_source: marker(polygons.text, 'KBS039-006.40') || marker(polygons.text, 'MCSE Plot polygons'),
    direct_crop_fact: false,
    direct_phenology_fact: false,
    reason_not_retained: 'Spatial authority only.',
    response_sha256: polygons.response_sha256
  });
  surfaces.push(polygonSurface);

  const centersSurface = surfaceBase('KBS136_MCSE_PLOT_CENTERS', 'SPATIAL_CROSSCHECK_SUPPORT', [URLS.kbs136_plot_centers]);
  Object.assign(centersSurface, {
    t1r1_record_surface: marker(centers.text, 'T1') && marker(centers.text, 'R1'),
    direct_crop_fact: false,
    direct_phenology_fact: false,
    reason_not_retained: 'Centroid/area support only.',
    response_sha256: centers.response_sha256
  });
  surfaces.push(centersSurface);

  const directStale = [
    ['KBS019_ANNUAL_CROP_BIOMASS', biomass, URLS.kbs019_biomass, 'May 1990 to September 2025', 'DIRECT_SPECIES_AND_BIOMASS_OBSERVATION', 'No 2026 formal-scope observation is published on this surface.'],
    ['KBS030_ANNUAL_CROP_STAND_COUNTS', standCounts, URLS.kbs030_stand_counts, '2025-07', 'DIRECT_SPECIES_AND_STAND_OBSERVATION', 'Latest visible rows are 2025; no 2026 formal-scope stand fact identified.'],
    ['KBS020_AGRONOMIC_YIELDS', yields, URLS.kbs020_yields, 'July 1989 to July 2025', 'DIRECT_HARVEST_OBSERVATION', 'No 2026 harvest row; not a current standing-crop/phenology source.'],
    ['KBS037_PROCESSED_GEOREFERENCED_YIELD', processedYield, URLS.kbs037_processed_yield, 'July 2012 to October 2025', 'DIRECT_GEOREFERENCED_HARVEST_OBSERVATION', 'No 2026 harvest; historical precision yield only.'],
    ['KBS092_GLBRC_PHENOLOGY', phenology, URLS.kbs092_glbrc_phenology, 'April 2013 to October 2017', 'DIRECT_PHENOLOGY_WRONG_EXPERIMENT', 'GLBRC experiment, not MCSE T1R1, and not current.'],
    ['KBS140_REX_ANPP', rex, URLS.kbs140_rex_anpp, 'September 2024', 'DIRECT_BIOMASS_MANIPULATED_SUBEXPERIMENT', 'REX/T2 rainfall-manipulation footprint; wrong scope and stale.']
  ];
  for (const [id, fetched, url, expectedMarker, role, reason] of directStale) {
    const s = surfaceBase(id, role, [url]);
    Object.assign(s, {
      expected_public_coverage_marker_observed: marker(fetched.text, expectedMarker),
      current_2026_formal_scope_fact_identified: false,
      reason_not_retained: reason,
      response_sha256: fetched.response_sha256
    });
    surfaces.push(s);
  }

  const gisSurface = surfaceBase('KBS_GIS_SATELLITE_AND_PUBLIC_IMAGE_SURFACES', 'GENERIC_IMAGERY_DISCOVERY', [URLS.kbs_gis]);
  Object.assign(gisSurface, {
    current_2026_t1r1_crop_bound_direct_phenology_product_identified: false,
    reason_not_retained: 'No repository-known KBS-native current T1R1 crop-bound direct phenology product identified; external CDSE review is outside this screen.',
    response_sha256: gis.response_sha256
  });
  surfaces.push(gisSurface);

  const retained = surfaces.filter((surface) => surface.retained_as_authority_candidate_source_family);
  const supportOnly = surfaces.filter((surface) => [
    'CURRENT_SEASON_CROP_IDENTITY_SUPPORT',
    'EXACT_SPATIAL_BINDING_SUPPORT',
    'SPATIAL_CROSSCHECK_SUPPORT',
    'SEASON_ORIGIN_MIRROR'
  ].includes(surface.role));

  write({
    schema_version: 'geox_mcft_cap09_kbs_public_current_authority_candidate_screen_v1',
    status: 'PASS',
    subject_sha: SUBJECT_SHA,
    screened_at: new Date().toISOString(),
    formal_scope: aglog.formal_scope,
    screening_rule: {
      retain_only_if: [
        'source can bind exact MCSE T1/T1R1 current-season evidence to the formal crop identity or form a legally reviewable composite binding',
        'source can provide a positive lifecycle/current-crop biological fact or provider-direct phenology fact',
        'wrong experiment/treatment/replicate, stale pre-2026 surfaces, generic imagery, and spatial-only sources are excluded from the current authority candidate set'
      ],
      direct_phenology_requires_provider_semantics_not_model_inference: true,
      t3_to_t1r1_substitution_authorized: false,
      rex_to_ambient_t1r1_substitution_authorized: false,
      duplicate_public_views_count_as_independent_authority_sources: false
    },
    source_surfaces_screened: surfaces,
    retained_authority_candidate_sources: retained.map((surface) => ({
      source_id: surface.source_id,
      retained_role: surface.retained_role,
      current_qualifying_authority_candidate: surface.current_qualifying_authority_candidate || null
    })),
    supporting_identity_or_spatial_sources: supportOnly.map((surface) => surface.source_id),
    adjudication: {
      retained_authority_candidate_source_count: retained.length,
      sole_retained_kbs_source_family: retained.length === 1 ? retained[0].source_id : null,
      latest_t1r1_observation_id: latestT1r1Id,
      latest_t1r1_observation_date: latestT1r1Date,
      observation_7095_direct_biological_fact_verified: obs7095DirectBiological,
      observation_7095_is_direct_phenology: false,
      current_qualifying_authority_candidate_count: hasCurrentDirectCandidate || hasDirectPhenologyCandidate ? 1 : 0,
      current_as_of_screen_direct_positive_candidate_found: hasCurrentDirectCandidate,
      direct_t1r1_provider_phenology_candidate_found: hasDirectPhenologyCandidate,
      current_runtime_lifecycle_authority_closed_by_this_screen: false,
      phenology_authority_closed_by_this_screen: false,
      crop_model_parameter_authority_closed_by_this_screen: false,
      kbs_public_search_space_reduced_to_aglog_family: retained.length === 1 && retained[0].source_id === 'KBS_AGLOG_MCSE_LIVE_FAMILY'
    },
    next_legal_frontier: 'WAIT_FOR_NEW_DIRECT_KBS_T1R1_CROP_OR_PHENOLOGY_FACT',
    authority_effect: 'NONE',
    database_write_count: 0,
    runtime_write_count: 0,
    scheduler_write_count: 0,
    formal_evidence_write_count: 0,
    ea5e2_operational_activation_qualified: false,
    formal_execution_count: '0/24'
  });
}

main().catch((error) => {
  write({
    schema_version: 'geox_mcft_cap09_kbs_public_current_authority_candidate_screen_v1',
    status: 'FAIL',
    subject_sha: SUBJECT_SHA,
    authority_effect: 'NONE',
    error: safeError(error),
    ea5e2_operational_activation_qualified: false,
    formal_execution_count: '0/24'
  });
  process.exitCode = 1;
});
