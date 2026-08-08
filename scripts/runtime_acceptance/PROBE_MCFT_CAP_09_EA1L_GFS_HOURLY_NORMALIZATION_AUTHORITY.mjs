#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const CONFIG_PATH = path.join(ROOT, 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA1L-GFS-HOURLY-NORMALIZATION-AUTHORITY-V1.json');
const OUT = path.join(ROOT, 'acceptance-output/MCFT_CAP_09_EA1L_GFS_HOURLY_NORMALIZATION_AUTHORITY_RESULT.json');
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
  const base = `${CONFIG.provider.production_root}/gfs.${stamp.ymd}/${stamp.hour}/atmos/${file}`;
  return { grib: base, index: `${base}.idx` };
}
function parseHttpTime(raw, code) {
  if (!raw) throw new Error(`${code}_LAST_MODIFIED_REQUIRED`);
  const parsed = Date.parse(raw);
  if (!Number.isFinite(parsed)) throw new Error(`${code}_LAST_MODIFIED_INVALID`);
  return parsed;
}
function expectedBlockStart(lead) {
  return CONFIG.rolling_window_family.block_hours * Math.floor((lead - 1) / CONFIG.rolling_window_family.block_hours);
}
function parseDescriptor(descriptor) {
  const normalized = descriptor.toLowerCase().replace(/\s+/g, ' ').trim();
  const match = normalized.match(/(?:^|:)(\d+)-(\d+) hour (ave|acc) fcst(?:$|:)/)
    || normalized.match(/^(\d+)-(\d+) hour (ave|acc) fcst$/);
  if (!match) return { class: 'OTHER_OR_UNPARSEABLE' };
  const start = Number(match[1]);
  const end = Number(match[2]);
  return {
    class: match[3] === 'ave' ? 'AVERAGE_WINDOW' : 'ACCUMULATION_WINDOW',
    startLeadHours: start,
    endLeadHours: end,
    windowLengthHours: end - start,
  };
}
function matchingLines(indexText, gribVar, level) {
  const markerVar = `:${gribVar}:`;
  const markerLevel = `:${level}:`;
  return indexText.split(/\r?\n/).filter((line) => line.includes(markerVar) && line.includes(markerLevel));
}
function temporalRecords(indexText, gribVar, level, code) {
  const markerLevel = `:${level}:`;
  const lines = matchingLines(indexText, gribVar, level);
  if (!lines.length) throw new Error(`${code}_${gribVar}_MATCH_COUNT_0`);
  return lines.map((line) => {
    const levelIndex = line.indexOf(markerLevel);
    const descriptor = levelIndex >= 0 ? line.slice(levelIndex + markerLevel.length).replace(/:+$/, '').trim() : '';
    if (!descriptor) throw new Error(`${code}_${gribVar}_TEMPORAL_DESCRIPTOR_REQUIRED`);
    return { ...parseDescriptor(descriptor), lineSha256: sha256(line) };
  });
}
function selectRollingAverage(records, lead, code, fieldName) {
  const start = expectedBlockStart(lead);
  const matches = records.filter((record) => record.class === 'AVERAGE_WINDOW'
    && record.startLeadHours === start
    && record.endLeadHours === lead
    && CONFIG.rolling_window_family.allowed_window_length_hours.includes(record.windowLengthHours));
  if (matches.length !== 1) throw new Error(`${code}_${fieldName}_ROLLING_AVERAGE_MATCH_COUNT_${matches.length}`);
  return matches[0];
}
async function fetchIndex(url, code) {
  const response = await fetch(url, {
    method: 'GET',
    redirect: 'follow',
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    headers: {
      'user-agent': 'GEOX-MCFT-CAP09-EA1L-METADATA-ONLY-PROBE/1.0',
      accept: 'text/plain,*/*;q=0.5',
    },
  });
  if (!response.ok) throw new Error(`${code}_INDEX_HTTP_${response.status}`);
  const lastModified = parseHttpTime(response.headers.get('last-modified'), `${code}_INDEX`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength > 2_000_000) throw new Error(`${code}_INDEX_TOO_LARGE_${bytes.byteLength}`);
  const text = new TextDecoder().decode(bytes);
  if (/^\s*<!doctype html|^\s*<html/i.test(text)) throw new Error(`${code}_INDEX_HTML_FORBIDDEN`);
  return { text, lastModified, sha256: sha256(bytes), bytes: bytes.byteLength };
}
async function headGrib(url, code) {
  const response = await fetch(url, {
    method: 'HEAD',
    redirect: 'follow',
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    headers: { 'user-agent': 'GEOX-MCFT-CAP09-EA1L-METADATA-ONLY-PROBE/1.0' },
  });
  if (!response.ok) throw new Error(`${code}_GRIB_HEAD_HTTP_${response.status}`);
  const lastModified = parseHttpTime(response.headers.get('last-modified'), `${code}_GRIB`);
  return { lastModified };
}
async function fetchUnitAuthority(url, requiredMarkers, code) {
  const response = await fetch(url, {
    method: 'GET',
    redirect: 'follow',
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    headers: { 'user-agent': 'GEOX-MCFT-CAP09-EA1L-UNIT-AUTHORITY-PROBE/1.0', accept: 'text/html,*/*;q=0.5' },
  });
  if (!response.ok) throw new Error(`${code}_HTTP_${response.status}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  const text = new TextDecoder().decode(bytes).replace(/<[^>]+>/g, ' ').replace(/&nbsp;|&#160;/gi, ' ').replace(/\s+/g, ' ').toLowerCase();
  for (const marker of requiredMarkers) {
    if (!text.includes(marker.toLowerCase())) throw new Error(`${code}_MARKER_MISSING_${marker.replace(/[^a-z0-9]+/gi, '_')}`);
  }
  return { responseSha256: sha256(bytes), responseBytes: bytes.byteLength };
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
  const first = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), cycleHour, 0, 0, 0);
  return Array.from({ length: 9 }, (_, index) => first - index * 6 * HOUR_MS);
}
async function probeLead(cycleTime, lead, tickBoundary) {
  const code = `EA1L_F${pad(lead, 3)}`;
  const urls = objectUrls(cycleTime, lead);
  const [index, grib] = await Promise.all([fetchIndex(urls.index, code), headGrib(urls.grib, code)]);
  if (index.lastModified > tickBoundary) throw new Error(`${code}_INDEX_PUBLISHED_AFTER_TICK`);
  if (grib.lastModified > tickBoundary) throw new Error(`${code}_GRIB_PUBLISHED_AFTER_TICK`);
  const dswrfRecords = temporalRecords(index.text, 'DSWRF', 'surface', code);
  const prateRecords = temporalRecords(index.text, 'PRATE', 'surface', code);
  const dswrf = selectRollingAverage(dswrfRecords, lead, code, 'DSWRF');
  const prate = selectRollingAverage(prateRecords, lead, code, 'PRATE');
  return {
    lead,
    validTime: cycleTime + lead * HOUR_MS,
    indexLastModified: index.lastModified,
    gribLastModified: grib.lastModified,
    indexSha256: index.sha256,
    dswrf,
    prate,
    prateTotalRecordCount: prateRecords.length,
    prateInstantaneousRecordCount: prateRecords.filter((record) => record.class === 'OTHER_OR_UNPARSEABLE').length,
  };
}
function proveReconstructionGraph(recordsByLead, targetLeads, fieldName) {
  let directCount = 0;
  let differenceCount = 0;
  const descriptorHashes = [];
  const windowLengths = new Set();
  let minimumSupportLead = Infinity;
  for (const lead of targetLeads) {
    const current = recordsByLead.get(lead);
    if (!current) throw new Error(`EA1L_${fieldName}_CURRENT_RECORD_REQUIRED_F${pad(lead, 3)}`);
    const record = current[fieldName];
    descriptorHashes.push(record.lineSha256);
    windowLengths.add(record.windowLengthHours);
    if (record.windowLengthHours === 1) {
      directCount += 1;
      continue;
    }
    const previous = recordsByLead.get(lead - 1);
    if (!previous) throw new Error(`EA1L_${fieldName}_PREDECESSOR_REQUIRED_F${pad(lead - 1, 3)}`);
    const previousRecord = previous[fieldName];
    if (previousRecord.startLeadHours !== record.startLeadHours
      || previousRecord.endLeadHours !== lead - 1
      || previousRecord.windowLengthHours !== record.windowLengthHours - 1) {
      throw new Error(`EA1L_${fieldName}_SAME_START_PREDECESSOR_MISMATCH_F${pad(lead, 3)}`);
    }
    minimumSupportLead = Math.min(minimumSupportLead, lead - 1);
    descriptorHashes.push(previousRecord.lineSha256);
    differenceCount += 1;
  }
  return {
    reconstructiblePointCount: directCount + differenceCount,
    directOneHourPointCount: directCount,
    weightedDifferencePointCount: differenceCount,
    windowLengthHoursSet: [...windowLengths].sort((a, b) => a - b),
    minimumDerivationSupportLead: Number.isFinite(minimumSupportLead) ? minimumSupportLead : null,
    descriptorGraphSha256: sha256(descriptorHashes.join('\n')),
  };
}
async function probeCandidate(cycleTime, tickBoundary) {
  const cycleAgeHours = (tickBoundary - cycleTime) / HOUR_MS;
  if (!Number.isInteger(cycleAgeHours) || cycleAgeHours < 0) return { pass: false, reason: 'CYCLE_AGE_INVALID', cycleTime };
  const leadStart = cycleAgeHours + 1;
  const leadEnd = cycleAgeHours + 72;
  const supportLead = leadStart - 1;
  if (leadEnd > CONFIG.exact_cycle_policy.hourly_horizon_max_lead) return { pass: false, reason: 'LEAD_END_EXCEEDS_120H', cycleTime, leadStart, leadEnd, supportLead };
  if (supportLead < 1) return { pass: false, reason: 'SUPPORT_LEAD_BELOW_F001', cycleTime, leadStart, leadEnd, supportLead };
  try {
    const terminal = await probeLead(cycleTime, leadEnd, tickBoundary);
    const leads = Array.from({ length: 73 }, (_, index) => supportLead + index);
    const results = await mapLimit(leads, CONCURRENCY, async (lead) => {
      if (lead === leadEnd) return terminal;
      return probeLead(cycleTime, lead, tickBoundary);
    });
    const byLead = new Map(results.map((entry) => [entry.lead, entry]));
    const targets = Array.from({ length: 72 }, (_, index) => leadStart + index);
    const dswrfGraph = proveReconstructionGraph(byLead, targets, 'dswrf');
    const prateGraph = proveReconstructionGraph(byLead, targets, 'prate');
    if (dswrfGraph.reconstructiblePointCount !== 72) throw new Error('EA1L_DSWRF_RECONSTRUCTIBLE_POINT_COUNT_REQUIRED_72');
    if (prateGraph.reconstructiblePointCount !== 72) throw new Error('EA1L_PRATE_RECONSTRUCTIBLE_POINT_COUNT_REQUIRED_72');
    const maxLastModified = Math.max(...results.flatMap((entry) => [entry.indexLastModified, entry.gribLastModified]));
    const minLastModified = Math.min(...results.flatMap((entry) => [entry.indexLastModified, entry.gribLastModified]));
    return {
      pass: true,
      cycleTime,
      cycleAgeHours,
      leadStart,
      leadEnd,
      supportLead,
      minLastModified,
      maxLastModified,
      dswrfGraph,
      prateGraph,
      sourceChainSha256: sha256(results.map((entry) => `${entry.lead}|${entry.indexSha256}|${new Date(entry.indexLastModified).toISOString()}|${new Date(entry.gribLastModified).toISOString()}`).join('\n')),
    };
  } catch (error) {
    return { pass: false, reason: safeError(error), cycleTime, leadStart, leadEnd, supportLead };
  }
}

try {
  if (!SUBJECT_SHA || !/^[0-9a-f]{40}$/.test(SUBJECT_SHA)) throw new Error('EA1L_EXACT_SUBJECT_SHA_REQUIRED');
  const probeStartedAt = Date.now();
  const tickBoundary = floorUtcHour(probeStartedAt);
  const [dswrfUnitAuthority, moistureUnitAuthority] = await Promise.all([
    fetchUnitAuthority(CONFIG.provider.dswrf_unit_authority_url, ['Downward Shortwave Radiation Flux', 'DSWRF'], 'EA1L_DSWRF_UNIT_AUTHORITY'),
    fetchUnitAuthority(CONFIG.provider.moisture_unit_authority_url, ['Precipitation Rate', 'PRATE', 'Total Precipitation', 'APCP'], 'EA1L_MOISTURE_UNIT_AUTHORITY'),
  ]);

  const rejections = [];
  let selected = null;
  for (const cycleTime of candidateCycles(tickBoundary)) {
    const result = await probeCandidate(cycleTime, tickBoundary);
    if (result.pass) { selected = result; break; }
    rejections.push({
      cycle_time_utc: new Date(cycleTime).toISOString(),
      lead_start: result.leadStart ?? null,
      lead_end: result.leadEnd ?? null,
      support_lead: result.supportLead ?? null,
      rejection_reason: result.reason,
    });
  }
  if (!selected) throw new Error(`EA1L_NO_RECONSTRUCTIBLE_COMPLETE_CYCLE:${rejections.map((entry) => `${entry.cycle_time_utc}:${entry.rejection_reason}`).join('|')}`);

  const result = {
    schema_version: 'geox_mcft_cap09_ea1l_gfs_hourly_normalization_authority_result_v1',
    status: 'PASS',
    subject_sha: SUBJECT_SHA,
    probe_started_at_utc: new Date(probeStartedAt).toISOString(),
    qualification_tick_boundary_utc: new Date(tickBoundary).toISOString(),
    unit_authority: {
      dswrf_ncep_table_sha256: dswrfUnitAuthority.responseSha256,
      moisture_ncep_table_sha256: moistureUnitAuthority.responseSha256,
      dswrf_unit: 'W_per_m2',
      prate_unit: 'kg_per_m2_per_s',
      apcp_unit: 'kg_per_m2',
    },
    selected_cycle: {
      issued_at_utc: new Date(selected.cycleTime).toISOString(),
      cycle_age_at_tick_hours: selected.cycleAgeHours,
      support_lead: selected.supportLead,
      canonical_lead_start: selected.leadStart,
      canonical_lead_end: selected.leadEnd,
      support_lead_is_canonical_point: false,
      canonical_point_count: 72,
      valid_time_start_utc: new Date(selected.cycleTime + selected.leadStart * HOUR_MS).toISOString(),
      valid_time_end_utc: new Date(selected.cycleTime + selected.leadEnd * HOUR_MS).toISOString(),
      provider_object_last_modified_min_utc: new Date(selected.minLastModified).toISOString(),
      provider_object_last_modified_max_utc: new Date(selected.maxLastModified).toISOString(),
      all_support_and_target_objects_published_at_or_before_tick: selected.maxLastModified <= tickBoundary,
      source_metadata_chain_sha256: selected.sourceChainSha256,
      newer_candidate_cycles_rejected_before_selection: rejections.filter((entry) => Date.parse(entry.cycle_time_utc) > selected.cycleTime),
    },
    dswrf_normalization_graph: {
      status: 'PASS_RECONSTRUCTIBLE_72_OF_72',
      ...selected.dswrfGraph,
      direct_formula: CONFIG.dswrf_normalization.direct_rule_when_L_eq_1,
      weighted_difference_formula: CONFIG.dswrf_normalization.difference_rule_when_L_gt_1,
      output_unit_before_et0_conversion: 'W_per_m2',
      et0_conversion_factor_to_mj_m2_h: 0.0036,
      normalized_values_generated: false,
    },
    precipitation_normalization_graph: {
      status: 'PASS_RECONSTRUCTIBLE_72_OF_72',
      selected_source_variable: 'PRATE_AVERAGE_WINDOW',
      ...selected.prateGraph,
      direct_formula: CONFIG.precipitation_normalization.direct_rule_when_L_eq_1,
      weighted_difference_formula: CONFIG.precipitation_normalization.difference_rule_when_L_gt_1,
      rate_to_hourly_depth_seconds: 3600,
      output_canonical_unit: 'mm',
      apcp_selected: false,
      prate_instantaneous_selected: false,
      normalized_values_generated: false,
    },
    qualification_findings: {
      exact_1h_dswrf_normalization_authority_candidate: 'PASS',
      exact_1h_precipitation_normalization_authority_candidate: 'PASS_PRATE_AVERAGE_WINDOW',
      support_lead_dependency_proven: true,
      canonical_future_weather_values_generated: false,
      future_et0_values_generated: false,
      spatial_extraction_implemented: false,
      formal_future_weather_source_authority_created: false,
      formal_future_et0_source_authority_created: false,
      formal_window_started: false,
    },
    forecast_values_emitted: false,
    grib_bodies_downloaded: false,
    index_bodies_persisted_or_uploaded: false,
    database_write_count: 0,
    formal_evidence_write_count: 0,
    runtime_product_source_delta: 0,
  };
  writeResult(result);
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  const result = {
    schema_version: 'geox_mcft_cap09_ea1l_gfs_hourly_normalization_authority_result_v1',
    status: 'FAIL',
    subject_sha: SUBJECT_SHA,
    error: safeError(error),
    observed_at: new Date().toISOString(),
    forecast_values_emitted: false,
    grib_bodies_downloaded: false,
    index_bodies_persisted_or_uploaded: false,
    database_write_count: 0,
    formal_evidence_write_count: 0,
    formal_window_started: false,
  };
  writeResult(result);
  console.error(JSON.stringify(result, null, 2));
  process.exitCode = 1;
}
