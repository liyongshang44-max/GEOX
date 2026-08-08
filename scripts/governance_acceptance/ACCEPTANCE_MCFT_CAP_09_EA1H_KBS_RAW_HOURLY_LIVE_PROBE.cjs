#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '../..');
const OUT = path.join(ROOT, 'acceptance-output/MCFT_CAP_09_EA1H_KBS_RAW_HOURLY_LIVE_PROBE_STATIC_RESULT.json');
const BASE = process.env.MCFT_BASE_SHA || 'HEAD^';
const CONFIG = 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA1H-KBS-RAW-HOURLY-LIVE-PROBE-V1.json';
const PROBE = 'scripts/runtime_acceptance/PROBE_MCFT_CAP_09_EA1H_KBS_RAW_HOURLY_LIVE.mjs';
const EA1E = 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA1E-KBS-TRANSIENT-ROLE-MAP-PROBE-V1.json';
const EA1E_BLOB = '69835c9877474f4d46980487f6e5789add803df2';
const EA1F = 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA1F-ENVIROWEATHER-API-DISCOVERY-V1.json';
const EA1F_BLOB = '2366f581f30bae465d6591d71c81a7ad2a25ace7';
const FILES = [
  '.github/workflows/mcft-cap-09-ea1h-kbs-raw-hourly-live-probe.yml',
  CONFIG,
  'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_EA1H_KBS_RAW_HOURLY_LIVE_PROBE.cjs',
  PROBE,
].sort();

function git(args) { return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim(); }
function read(relative) { return fs.readFileSync(path.join(ROOT, relative), 'utf8'); }
function json(relative) { return JSON.parse(read(relative)); }
function write(value) { fs.mkdirSync(path.dirname(OUT), { recursive: true }); fs.writeFileSync(OUT, `${JSON.stringify(value, null, 2)}\n`); }

try {
  const changed = git(['diff', '--name-only', `${BASE}...HEAD`]).split(/\r?\n/).filter(Boolean).sort();
  assert.deepEqual(changed, FILES, 'EA1H_EXACT_FOUR_FILE_BOUNDARY_REQUIRED');
  assert.equal(changed.length, 4, 'EA1H_EXACT_FILE_COUNT_REQUIRED');
  assert(!changed.some((file) => /(^|\/)(apps|packages)\//.test(file)), 'EA1H_RUNTIME_PRODUCT_SOURCE_DELTA_FORBIDDEN');
  assert(!changed.some((file) => /migration/i.test(file)), 'EA1H_MIGRATION_DELTA_FORBIDDEN');
  assert(!changed.some((file) => /MCFT-CANDIDATE-AUTHORITY-REGISTRY|MCFT-DELIVERY-POLICY/.test(file)), 'EA1H_DELIVERY_AUTHORITY_DELTA_FORBIDDEN');

  const ea1eBlobAtBase = git(['rev-parse', `${BASE}:${EA1E}`]);
  const ea1fBlobAtBase = git(['rev-parse', `${BASE}:${EA1F}`]);
  assert.equal(ea1eBlobAtBase, EA1E_BLOB, 'EA1H_EXACT_EA1E_BASE_AUTHORITY_REQUIRED');
  assert.equal(ea1fBlobAtBase, EA1F_BLOB, 'EA1H_EXACT_EA1F_BASE_AUTHORITY_REQUIRED');

  const config = json(CONFIG);
  const probe = read(PROBE);
  const probeCompact = probe.replace(/\s+/g, '');
  const packageJson = json('package.json');
  const signal = json('docs/digital_twin/mcft/MCFT-DELIVERY-CANDIDATE-SIGNAL-CONTRACT-V1.json');

  assert.equal(config.capability_line_id, 'MCFT-CAP-09');
  assert.equal(config.slice_id, 'MCFT-CAP-09.S6');
  assert.equal(config.base_main_sha, 'c01b61bcd688632ea4a8bcc355cc2e3efdf98dfb');
  assert.equal(config.source.provider, 'KBS_LTER');
  assert.equal(config.source.official_page, 'https://lter.kbs.msu.edu/datatables/13');
  assert.equal(config.source.official_host, 'lter.kbs.msu.edu');
  assert.equal(config.source.download_locator.required_resolved_path, '/datatables/13.csv');
  assert.equal(config.source.download_locator.same_official_host_required, true);
  assert.equal(config.source.download_locator.query_string_forbidden, true);
  assert.equal(config.source.direct_bcse_g1r1_field_equivalence, false);
  assert.equal(config.source.direct_root_zone_equivalence, false);

  assert.deepEqual(config.required_columns, {
    timestamp: 'datetime_utc',
    solar_radiation: 'solrad_avg',
    wind_speed: 'wind_speed',
    relative_humidity: 'rh',
    air_temperature: 'airtmp_107_avg',
    barometric_pressure: 'barometer_avg',
    rainfall: 'rain_mm',
  });
  assert.equal(config.epistemic_semantics.blank_or_non_numeric_value, 'MISSING_NOT_ZERO_NOT_OBSERVED');
  assert.equal(config.epistemic_semantics.provider_raw_not_checked, true);
  assert.equal(config.epistemic_semantics.provider_raw_not_checked_does_not_imply_estimated, true);
  assert.equal(config.freshness_and_continuity.latest_record_max_age_hours, 6);
  assert.equal(config.freshness_and_continuity.recent_window_hours, 30);
  assert.equal(config.freshness_and_continuity.minimum_recent_distinct_hours, 24);
  assert.equal(config.freshness_and_continuity.minimum_recent_complete_et0_hours, 24);
  assert.equal(config.freshness_and_continuity.minimum_recent_observed_rain_hours, 24);

  assert.equal(config.metadata_conflict_policy.page_excerpt_timestamp_is_not_live_authority, true);
  assert.equal(config.metadata_conflict_policy.download_latest_observation_timestamp_controls_live_freshness, true);
  assert.equal(config.metadata_conflict_policy.metadata_conflict_must_not_be_silently_reconciled, true);
  assert.equal(config.data_use_policy.provider_payload_may_be_committed, false);
  assert.equal(config.data_use_policy.provider_payload_may_be_uploaded_as_ci_artifact, false);
  assert.equal(config.data_use_policy.raw_numeric_values_may_be_emitted, false);
  assert.equal(config.data_use_policy.public_data_republication_right_claimed, false);
  assert.equal(config.data_use_policy.formal_runtime_use_right_established_by_probe, false);
  assert.equal(config.qualification_effect.formal_source_authority_created, false);
  assert.equal(config.qualification_effect.qualified_formal_site, false);
  assert.equal(config.qualification_effect.formal_window_started, false);

  assert.equal(packageJson.devDependencies['@playwright/test'], '^1.60.0', 'EA1H_PLAYWRIGHT_DEPENDENCY_REQUIRED');
  for (const marker of [
    "import{chromium}from'@playwright/test'",
    "getByRole('link',{name:CONFIG.source.download_locator.anchor_text})",
    'ensureOfficialDownload',
    'response_body_sha256',
    'EA1H_SOURCE_TOO_OLD:',
    'EA1H_RECENT_PHYSICAL_SANITY_FAILURE_ROWS:',
    'EA1H_RECENT_ET0_INPUT_CONTINUITY_INSUFFICIENT:',
    'EA1H_RECENT_RAIN_CONTINUITY_INSUFFICIENT:',
    'raw_numeric_values_emitted:false',
    'raw_provider_payload_persisted:false',
    'raw_provider_payload_uploaded:false',
    'database_write_count:0',
    'formal_evidence_write_count:0',
    'formal_window_started:false',
  ]) assert(probeCompact.includes(marker), `EA1H_PROBE_MARKER_REQUIRED:${marker}`);

  for (const forbidden of ['DATABASE_URL', 'INSERT INTO', 'public.facts', 'GEOX_MCFT_CAP09_S6_DATABASE_URL', "from'pg'", 'from"pg"']) {
    assert(!probeCompact.includes(forbidden.replace(/\s+/g, '')), `EA1H_DATABASE_OR_FORMAL_WRITE_FORBIDDEN:${forbidden}`);
  }

  assert(!signal.explicit_candidate_status_values.includes(config.record_status), 'EA1H_UNREGISTERED_CANDIDATE_STATUS_FORBIDDEN');

  write({
    schema_version: 'geox_mcft_cap09_ea1h_kbs_raw_hourly_static_acceptance_v1',
    status: 'PASS',
    base_sha: BASE,
    ea1e_blob_sha: ea1eBlobAtBase,
    ea1f_blob_sha: ea1fBlobAtBase,
    changed_files: changed,
    exact_file_count: changed.length,
    official_source: config.source.official_page,
    source_guard_whitespace_insensitive: true,
    page_excerpt_not_live_authority: true,
    download_timestamp_controls_freshness: true,
    runtime_product_source_delta: 0,
    migration_delta: 0,
    database_write_delta: 0,
    formal_evidence_write_delta: 0,
    formal_window_started: false,
  });
} catch (error) {
  write({ schema_version: 'geox_mcft_cap09_ea1h_kbs_raw_hourly_static_acceptance_v1', status: 'FAIL', error: error?.message || String(error) });
  console.error(error);
  process.exitCode = 1;
}
