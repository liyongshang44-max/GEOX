#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const CONFIG_PATH = path.join(ROOT, 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA1K-GFS-EXACT-CYCLE-72H-AUTHORITY-V1.json');
const OUT = path.join(ROOT, 'acceptance-output/MCFT_CAP_09_EA1K_GFS_EXACT_CYCLE_72H_AUTHORITY_RESULT.json');
const CONFIG = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
const SUBJECT_SHA = process.env.MCFT_SUBJECT_SHA || null;
const HOUR_MS = 3_600_000;
const REQUEST_TIMEOUT_MS = 30_000;
const CONCURRENCY = 8;

function sha256(input) {
  return `sha256:${crypto.createHash('sha256').update(input).digest('hex')}`;
}
function writeResult(value) {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}
function safeError(error) {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/https?:\/\/[^\s]+/g, '[URL_REDACTED]');
}
function pad(value, width = 2) {
  return String(value).padStart(width, '0');
}
function floorUtcHour(timestamp) {
  return Math.floor(timestamp / HOUR_MS) * HOUR_MS;
}
function cycleStamp(cycleTime) {
  const date = new Date(cycleTime);
  return {
    ymd: `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}`,
    hour: pad(date.getUTCHours()),
  };
}
function objectUrls(cycleTime, lead) {
  const stamp = cycleStamp(cycleTime);
  const file = `gfs.t${stamp.hour}z.pgrb2.0p25.f${pad(lead, 3)}`;
  const base = `${CONFIG.provider_authority.production_root}/gfs.${stamp.ymd}/${stamp.hour}/atmos/${file}`;
  return { grib: base, index: `${base}.idx`, file };
}
function parseHttpTime(raw, code) {
  if (!raw) throw new Error(`${code}_LAST_MODIFIED_REQUIRED`);
  const parsed = Date.parse(raw);
  if (!Number.isFinite(parsed)) throw new Error(`${code}_LAST_MODIFIED_INVALID`);
  return parsed;
}
async function fetchIndex(url, code) {
  const response = await fetch(url, {
    method: 'GET',
    redirect: 'follow',
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    headers: {
      'user-agent': 'GEOX-MCFT-CAP09-EA1K-METADATA-ONLY-PROBE/1.1',
      accept: 'text/plain,*/*;q=0.5',
    },
  });
  if (!response.ok) throw new Error(`${code}_INDEX_HTTP_${response.status}`);
  const lastModified = parseHttpTime(response.headers.get('last-modified'), `${code}_INDEX`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength > 2_000_000) throw new Error(`${code}_INDEX_TOO_LARGE_${bytes.byteLength}`);
  const text = new TextDecoder().decode(bytes);
  if (/^\s*<!doctype html|^\s*<html/i.test(text)) throw new Error(`${code}_INDEX_HTML_FORBIDDEN`);
  return {
    text,
    sha256: sha256(bytes),
    bytes: bytes.byteLength,
    lastModified,
    contentType: String(response.headers.get('content-type') || 'unknown').split(';')[0].toLowerCase(),
  };
}
async function headGrib(url, code) {
  const response = await fetch(url, {
    method: 'HEAD',
    redirect: 'follow',
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    headers: { 'user-agent': 'GEOX-MCFT-CAP09-EA1K-METADATA-ONLY-PROBE/1.1' },
  });
  if (!response.ok) throw new Error(`${code}_GRIB_HEAD_HTTP_${response.status}`);
  const lastModified = parseHttpTime(response.headers.get('last-modified'), `${code}_GRIB`);
  const contentLengthRaw = response.headers.get('content-length');
  const contentLength = contentLengthRaw && /^\d+$/.test(contentLengthRaw) ? Number(contentLengthRaw) : null;
  return { lastModified, contentLength };
}
function extractInventoryRecords(indexText, gribVar, level, code, requireUnique) {
  const markerVar = `:${gribVar}:`;
  const markerLevel = `:${level}:`;
  const matches = indexText.split(/\r?\n/).filter((line) => line.includes(markerVar) && line.includes(markerLevel));
  if (matches.length < 1) throw new Error(`${code}_${gribVar}_AT_${level.replace(/[^a-z0-9]+/gi, '_')}_MATCH_COUNT_0`);
  if (requireUnique && matches.length !== 1) throw new Error(`${code}_${gribVar}_AT_${level.replace(/[^a-z0-9]+/gi, '_')}_MATCH_COUNT_${matches.length}`);
  return matches.map((line) => {
    const levelIndex = line.indexOf(markerLevel);
    const descriptor = levelIndex >= 0 ? line.slice(levelIndex + markerLevel.length).replace(/:+$/, '').trim() : '';
    if (!descriptor) throw new Error(`${code}_${gribVar}_TEMPORAL_DESCRIPTOR_REQUIRED`);
    return { descriptor, lineSha256: sha256(line) };
  });
}
function classifyDescriptor(descriptor) {
  const normalized = descriptor.toLowerCase().replace(/\s+/g, ' ').trim();
  let match = normalized.match(/(?:^|:)(\d+)-(\d+) hour (ave|acc) fcst(?:$|:)/);
  if (!match) match = normalized.match(/^(\d+)-(\d+) hour (ave|acc) fcst$/);
  if (match) {
    const start = Number(match[1]);
    const end = Number(match[2]);
    const statistic = match[3] === 'ave' ? 'AVERAGE_WINDOW' : 'ACCUMULATION_WINDOW';
    return {
      class: statistic,
      windowStartLeadHours: start,
      windowEndLeadHours: end,
      windowLengthHours: end - start,
      exactOneHourWindow: end - start === 1,
    };
  }
  match = normalized.match(/(?:^|:)(\d+) hour fcst(?:$|:)/) || normalized.match(/^(\d+) hour fcst$/);
  if (match) {
    return {
      class: 'INSTANTANEOUS_FORECAST_POINT',
      forecastLeadHours: Number(match[1]),
      windowLengthHours: 0,
      exactOneHourWindow: false,
    };
  }
  if (normalized === 'anl') return { class: 'ANALYSIS', windowLengthHours: 0, exactOneHourWindow: false };
  return { class: 'UNPARSEABLE_OR_OTHER', windowLengthHours: null, exactOneHourWindow: false };
}
function summarizeFieldSemantics(field, leadEntries) {
  const allRecords = leadEntries.flatMap((entry) => entry.records);
  const classes = [...new Set(allRecords.map((entry) => entry.class))].sort();
  const windowLengths = [...new Set(allRecords.map((entry) => entry.windowLengthHours).filter(Number.isFinite))].sort((a, b) => a - b);
  const recordCountSet = [...new Set(leadEntries.map((entry) => entry.matchingRecordCount))].sort((a, b) => a - b);
  const exactOneHourCandidateCounts = leadEntries.map((entry) => entry.records.filter((record) => record.exactOneHourWindow).length);
  const exactOneHourCandidateCountSet = [...new Set(exactOneHourCandidateCounts)].sort((a, b) => a - b);
  const leadsWithUniqueExactOneHourCandidate = exactOneHourCandidateCounts.filter((count) => count === 1).length;
  const isInstantaneousField = CONFIG.temporal_semantics_policy.instantaneous_state_fields.includes(field.grib_var);
  const instantaneousCount = allRecords.filter((entry) => entry.class === 'INSTANTANEOUS_FORECAST_POINT').length;
  const unparseableCount = allRecords.filter((entry) => entry.class === 'UNPARSEABLE_OR_OTHER').length;
  const multiHourCount = allRecords.filter((entry) => Number.isFinite(entry.windowLengthHours) && entry.windowLengthHours > 1).length;
  const extraNonOneHourRecordsPresent = leadEntries.some((entry) => entry.records.some((record) => !record.exactOneHourWindow));
  const recordSelectionRequired = !isInstantaneousField && leadEntries.some((entry) => entry.matchingRecordCount > 1);
  const allPointsHaveUniqueExactOneHourCandidate = !isInstantaneousField && leadsWithUniqueExactOneHourCandidate === leadEntries.length;
  const temporalNormalizationRequired = !isInstantaneousField && !allPointsHaveUniqueExactOneHourCandidate;
  return {
    field_id: field.field_id,
    point_count: leadEntries.length,
    total_matching_inventory_records: allRecords.length,
    matching_record_count_per_lead_set: recordCountSet,
    temporal_statistic_classes: classes,
    window_length_hours_set: windowLengths,
    exact_1h_candidate_count_per_lead_set: exactOneHourCandidateCountSet,
    leads_with_unique_exact_1h_candidate: leadsWithUniqueExactOneHourCandidate,
    all_points_have_unique_exact_1h_candidate: allPointsHaveUniqueExactOneHourCandidate,
    instantaneous_point_record_count: instantaneousCount,
    unparseable_or_other_record_count: unparseableCount,
    multi_hour_record_count: multiHourCount,
    extra_non_1h_records_present: extraNonOneHourRecordsPresent,
    record_selection_required: recordSelectionRequired,
    temporal_normalization_required: temporalNormalizationRequired,
    normalization_required: temporalNormalizationRequired,
    canonical_record_selected_by_this_probe: false,
    descriptor_chain_sha256: sha256(allRecords.map((entry) => entry.lineSha256).join('\n')),
  };
}
async function mapLimit(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  async function worker() {
    while (true) {
      const index = next;
      next += 1;
      if (index >= items.length) return;
      results[index] = await fn(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return results;
}
function candidateCycles(tickBoundary) {
  const date = new Date(tickBoundary);
  const hour = date.getUTCHours();
  const cycleHour = hour - (hour % 6);
  let first = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), cycleHour, 0, 0, 0);
  if (first > tickBoundary) first -= 6 * HOUR_MS;
  return Array.from({ length: 9 }, (_, index) => first - index * 6 * HOUR_MS);
}
async function probeLead(cycleTime, lead, tickBoundary, targetValidTime) {
  const urls = objectUrls(cycleTime, lead);
  const code = `EA1K_F${pad(lead, 3)}`;
  const [index, grib] = await Promise.all([
    fetchIndex(urls.index, code),
    headGrib(urls.grib, code),
  ]);
  if (index.lastModified > tickBoundary) throw new Error(`${code}_INDEX_PUBLISHED_AFTER_TICK`);
  if (grib.lastModified > tickBoundary) throw new Error(`${code}_GRIB_PUBLISHED_AFTER_TICK`);
  const validTime = cycleTime + lead * HOUR_MS;
  if (validTime !== targetValidTime) throw new Error(`${code}_VALID_TIME_IDENTITY_MISMATCH`);

  const semantics = {};
  for (const field of CONFIG.required_field_inventory) {
    const requireUnique = CONFIG.temporal_semantics_policy.instantaneous_state_fields.includes(field.grib_var);
    const records = extractInventoryRecords(index.text, field.grib_var, field.level, code, requireUnique)
      .map((inventory) => ({ ...classifyDescriptor(inventory.descriptor), lineSha256: inventory.lineSha256 }));
    if (requireUnique && (records.length !== 1 || records[0].class !== 'INSTANTANEOUS_FORECAST_POINT')) {
      throw new Error(`${code}_${field.field_id}_INSTANTANEOUS_SEMANTICS_REQUIRED`);
    }
    semantics[field.field_id] = { matchingRecordCount: records.length, records };
  }
  return {
    lead,
    validTime,
    indexLastModified: index.lastModified,
    gribLastModified: grib.lastModified,
    gribContentLength: grib.contentLength,
    indexSha256: index.sha256,
    indexBytes: index.bytes,
    semantics,
  };
}
async function probeCandidate(cycleTime, tickBoundary) {
  const cycleAgeHours = (tickBoundary - cycleTime) / HOUR_MS;
  if (!Number.isInteger(cycleAgeHours) || cycleAgeHours < 0) throw new Error('EA1K_CYCLE_AGE_INVALID');
  const leadStart = cycleAgeHours + 1;
  const leadEnd = cycleAgeHours + CONFIG.tick_and_cycle_policy.canonical_point_count;
  if (leadStart < CONFIG.tick_and_cycle_policy.candidate_requires_lead_start_gte) {
    return { pass: false, reason: 'LEAD_START_BELOW_ALLOWED_RANGE', cycleTime, leadStart, leadEnd };
  }
  if (leadEnd > CONFIG.tick_and_cycle_policy.candidate_requires_lead_end_lte) {
    return { pass: false, reason: 'LEAD_END_EXCEEDS_HOURLY_120H_QUALIFICATION_BOUND', cycleTime, leadStart, leadEnd };
  }

  const targetValidStart = tickBoundary + HOUR_MS;
  const targetValidEnd = tickBoundary + CONFIG.tick_and_cycle_policy.canonical_point_count * HOUR_MS;
  try {
    const terminal = await probeLead(cycleTime, leadEnd, tickBoundary, targetValidEnd);
    const leads = Array.from({ length: CONFIG.tick_and_cycle_policy.canonical_point_count }, (_, index) => leadStart + index);
    const results = await mapLimit(leads, CONCURRENCY, async (lead, index) => {
      if (lead === leadEnd) return terminal;
      return probeLead(cycleTime, lead, tickBoundary, targetValidStart + index * HOUR_MS);
    });
    const fieldObservations = Object.fromEntries(CONFIG.required_field_inventory.map((field) => [field.field_id, []]));
    for (const result of results) {
      for (const field of CONFIG.required_field_inventory) fieldObservations[field.field_id].push(result.semantics[field.field_id]);
    }
    for (const field of CONFIG.required_field_inventory.filter((entry) => CONFIG.temporal_semantics_policy.instantaneous_state_fields.includes(entry.grib_var))) {
      const observations = fieldObservations[field.field_id];
      if (observations.some((entry) => entry.matchingRecordCount !== 1 || entry.records.length !== 1 || entry.records[0].class !== 'INSTANTANEOUS_FORECAST_POINT')) {
        throw new Error(`EA1K_${field.field_id}_INSTANTANEOUS_SEMANTICS_REQUIRED`);
      }
    }
    const maxLastModified = Math.max(...results.flatMap((entry) => [entry.indexLastModified, entry.gribLastModified]));
    const minLastModified = Math.min(...results.flatMap((entry) => [entry.indexLastModified, entry.gribLastModified]));
    const chainMaterial = results.map((entry) => [
      entry.lead,
      new Date(entry.validTime).toISOString(),
      new Date(entry.indexLastModified).toISOString(),
      new Date(entry.gribLastModified).toISOString(),
      entry.gribContentLength ?? 'unknown',
      entry.indexSha256,
    ].join('|')).join('\n');
    const fieldSemantics = Object.fromEntries(CONFIG.required_field_inventory.map((field) => [
      field.field_id,
      summarizeFieldSemantics(field, fieldObservations[field.field_id]),
    ]));
    return {
      pass: true,
      cycleTime,
      cycleAgeHours,
      leadStart,
      leadEnd,
      targetValidStart,
      targetValidEnd,
      results,
      minLastModified,
      maxLastModified,
      fieldSemantics,
      indexChainSha256: sha256(chainMaterial),
    };
  } catch (error) {
    return { pass: false, reason: safeError(error), cycleTime, leadStart, leadEnd };
  }
}

try {
  if (!SUBJECT_SHA || !/^[0-9a-f]{40}$/.test(SUBJECT_SHA)) throw new Error('EA1K_EXACT_SUBJECT_SHA_REQUIRED');
  const probeStartedAt = Date.now();
  const tickBoundary = floorUtcHour(probeStartedAt);
  const candidates = candidateCycles(tickBoundary);
  const rejectionLog = [];
  let selected = null;
  for (const cycleTime of candidates) {
    const candidate = await probeCandidate(cycleTime, tickBoundary);
    if (candidate.pass) { selected = candidate; break; }
    rejectionLog.push({
      cycle_time_utc: new Date(cycleTime).toISOString(),
      lead_start: candidate.leadStart,
      lead_end: candidate.leadEnd,
      rejection_reason: candidate.reason,
    });
  }
  if (!selected) throw new Error(`EA1K_NO_COMPLETE_GFS_CYCLE_BEFORE_TICK:${rejectionLog.map((entry) => `${entry.cycle_time_utc}:${entry.rejection_reason}`).join('|')}`);

  const newerCycleRejections = rejectionLog.filter((entry) => Date.parse(entry.cycle_time_utc) > selected.cycleTime);
  const fieldSemantics = selected.fieldSemantics;
  const statisticalFields = ['DOWNWARD_SHORTWAVE_SURFACE','TOTAL_PRECIPITATION_SURFACE','PRECIPITATION_RATE_SURFACE'];
  const statisticalSummary = Object.fromEntries(statisticalFields.map((fieldId) => [fieldId, fieldSemantics[fieldId]]));
  const statisticalRecordSelectionRequired = statisticalFields.some((fieldId) => fieldSemantics[fieldId].record_selection_required);
  const statisticalTemporalNormalizationRequired = statisticalFields.some((fieldId) => fieldSemantics[fieldId].temporal_normalization_required);

  const result = {
    schema_version: 'geox_mcft_cap09_ea1k_gfs_exact_cycle_72h_authority_result_v1',
    status: 'PASS',
    subject_sha: SUBJECT_SHA,
    probe_started_at_utc: new Date(probeStartedAt).toISOString(),
    qualification_tick_boundary_utc: new Date(tickBoundary).toISOString(),
    provider: CONFIG.provider_authority.provider,
    model: CONFIG.provider_authority.model,
    grid: CONFIG.provider_authority.grid,
    selected_cycle: {
      issued_at_utc: new Date(selected.cycleTime).toISOString(),
      cycle_age_at_tick_hours: selected.cycleAgeHours,
      lead_start: selected.leadStart,
      lead_end: selected.leadEnd,
      canonical_point_count: selected.results.length,
      valid_time_start_utc: new Date(selected.targetValidStart).toISOString(),
      valid_time_end_utc: new Date(selected.targetValidEnd).toISOString(),
      provider_object_last_modified_min_utc: new Date(selected.minLastModified).toISOString(),
      provider_object_last_modified_max_utc: new Date(selected.maxLastModified).toISOString(),
      all_required_objects_published_at_or_before_tick: selected.maxLastModified <= tickBoundary,
      index_metadata_chain_sha256: selected.indexChainSha256,
      grib_bodies_downloaded: false,
      index_bodies_persisted_or_uploaded: false,
    },
    chronology: {
      point_0_valid_time_utc: new Date(tickBoundary + HOUR_MS).toISOString(),
      point_71_valid_time_utc: new Date(tickBoundary + 72 * HOUR_MS).toISOString(),
      valid_time_identity_verified_for_all_points: true,
      mechanical_f001_through_f072_selection_used: false,
      future_file_waiting_used: false,
      valid_time_rewrite_used: false,
      newer_candidate_cycles_rejected_before_selection: newerCycleRejections,
    },
    required_field_inventory: fieldSemantics,
    temporal_statistics: {
      statistical_fields: statisticalSummary,
      apcp_direct_hourly_assumption_made: false,
      prate_direct_hourly_assumption_made: false,
      dswrf_direct_hourly_assumption_made: false,
      precipitation_canonical_source_selected: false,
      future_et0_solar_canonicalization_selected: false,
      canonical_statistical_record_selected: false,
      statistical_record_selection_required: statisticalRecordSelectionRequired,
      statistical_temporal_normalization_required: statisticalTemporalNormalizationRequired,
      any_multi_hour_or_unknown_statistical_window_requires_separate_normalization: statisticalFields.some((fieldId) => fieldSemantics[fieldId].multi_hour_record_count > 0 || fieldSemantics[fieldId].unparseable_or_other_record_count > 0),
    },
    future_et0_boundary: {
      same_exact_gfs_cycle_required_for_future_weather_and_future_et0: true,
      wind_10m_to_2m_factor_available_from_ea1i: CONFIG.future_et0_binding_boundary.wind_10m_to_2m_factor_from_ea1i,
      pressure_elevation_path_available_from_ea1i: true,
      solar_conversion_factor_available_from_ea1i_but_not_applied_by_this_probe: CONFIG.future_et0_binding_boundary.solar_w_m2_to_mj_m2_h_factor_from_ea1i,
      future_et0_values_generated: false,
    },
    qualification_findings: {
      exact_cycle_72h_source_authority_candidate: 'PASS',
      exact_72_valid_times_proven: true,
      exact_72_required_inventory_sets_proven: true,
      chronology_prior_availability_proven_by_http_last_modified: true,
      statistical_record_selection_still_required_if_multiple: statisticalRecordSelectionRequired,
      statistical_window_normalization_still_required_if_flagged: statisticalTemporalNormalizationRequired,
      forecast_spatial_extraction_implemented: false,
      formal_future_weather_source_authority_created: false,
      formal_future_et0_source_authority_created: false,
      formal_window_started: false,
    },
    raw_forecast_values_emitted: false,
    raw_grib_payload_persisted_or_uploaded: false,
    database_write_count: 0,
    formal_evidence_write_count: 0,
    runtime_product_source_delta: 0,
  };
  writeResult(result);
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  const result = {
    schema_version: 'geox_mcft_cap09_ea1k_gfs_exact_cycle_72h_authority_result_v1',
    status: 'FAIL',
    subject_sha: SUBJECT_SHA,
    error: safeError(error),
    observed_at: new Date().toISOString(),
    raw_forecast_values_emitted: false,
    raw_grib_payload_persisted_or_uploaded: false,
    database_write_count: 0,
    formal_evidence_write_count: 0,
    formal_window_started: false,
  };
  writeResult(result);
  console.error(JSON.stringify(result, null, 2));
  process.exitCode = 1;
}
