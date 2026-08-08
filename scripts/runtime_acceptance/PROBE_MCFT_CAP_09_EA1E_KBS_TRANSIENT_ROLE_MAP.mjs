#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const CONFIG_PATH = path.join(ROOT, 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA1E-KBS-TRANSIENT-ROLE-MAP-PROBE-V1.json');
const OUT = path.join(ROOT, 'acceptance-output/MCFT_CAP_09_EA1E_KBS_TRANSIENT_ROLE_MAP_PROBE_RESULT.json');
const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
const SUBJECT_SHA = process.env.MCFT_SUBJECT_SHA || null;
const MINUTE_MS = 60_000;

function sha256(input) {
  return `sha256:${crypto.createHash('sha256').update(input).digest('hex')}`;
}
function writeResult(value) {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}
function safeError(error) {
  return error instanceof Error ? error.message : String(error);
}
function endpointIdFromUrl(rawUrl) {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.hostname !== config.official_host) return null;
    const match = parsed.pathname.match(/^\/weather\/variates\/(\d+)\/?$/);
    return match ? Number(match[1]) : null;
  } catch {
    return null;
  }
}
function latestFinitePoint(json) {
  if (!Array.isArray(json)) return null;
  let best = null;
  for (const item of json) {
    if (!item || typeof item !== 'object') continue;
    const time = Date.parse(String(item.time ?? ''));
    const value = Number(item.value);
    if (!Number.isFinite(time) || !Number.isFinite(value)) continue;
    if (!best || time > best.time) best = { time, value };
  }
  return best;
}
function transformValue(transformId, value) {
  switch (transformId) {
    case 'DIRECT_V1': return value;
    case 'CELSIUS_TO_FAHRENHEIT_V1': return value * 9 / 5 + 32;
    case 'MPS_TO_MPH_V1': return value * 2.2369362920544;
    case 'FRACTION_TO_PERCENT_V1': return value * 100;
    default: throw new Error(`EA1E_UNKNOWN_TRANSFORM:${transformId}`);
  }
}
function decimalsIn(raw) {
  const match = String(raw).match(/\.([0-9]+)/);
  return match ? match[1].length : 0;
}
function displayTolerance(decimals) {
  return 0.5 * (10 ** (-decimals)) + 1e-6;
}
function countRole(text, role) {
  return [...String(text).matchAll(new RegExp(role.pattern, 'gim'))].length;
}
function extractRole(text, role) {
  const matches = [...String(text).matchAll(new RegExp(role.pattern, 'gim'))];
  if (matches.length !== 1) throw new Error(`EA1E_RENDERED_ROLE_CARDINALITY:${role.role_id}:${matches.length}`);
  const raw = matches[0][1];
  const value = Number(raw);
  if (!Number.isFinite(value)) throw new Error(`EA1E_RENDERED_ROLE_NUMERIC_REQUIRED:${role.role_id}`);
  return { value, decimals: decimalsIn(raw) };
}
function endpointSafeEvidence(entry, nowMs) {
  const ageMinutes = (nowMs - entry.latest.time) / MINUTE_MS;
  return {
    endpoint_id: entry.endpoint_id,
    endpoint_url: entry.endpoint_url,
    response_status: entry.response_status,
    response_body_sha256: entry.response_body_sha256,
    response_bytes: entry.response_bytes,
    latest_timestamp: new Date(entry.latest.time).toISOString(),
    age_minutes: Number(ageMinutes.toFixed(3)),
    raw_numeric_value_emitted: false,
  };
}
function safeCandidates(candidates) {
  const output = {};
  for (const [roleId, items] of Object.entries(candidates)) {
    output[roleId] = items.map((item) => ({ endpoint_id: item.endpoint_id, transform_id: item.transform_id }));
  }
  return output;
}
function enumerateAssignments(roleIds, candidates) {
  const assignments = [];
  function visit(index, usedEndpoints, current) {
    if (assignments.length > 2) return;
    if (index >= roleIds.length) {
      assignments.push({ ...current });
      return;
    }
    const roleId = roleIds[index];
    for (const candidate of candidates[roleId] || []) {
      if (usedEndpoints.has(candidate.endpoint_id)) continue;
      usedEndpoints.add(candidate.endpoint_id);
      current[roleId] = candidate;
      visit(index + 1, usedEndpoints, current);
      delete current[roleId];
      usedEndpoints.delete(candidate.endpoint_id);
    }
  }
  visit(0, new Set(), {});
  return assignments;
}

let browser;
let diagnosticCandidates = null;
let diagnosticEndpointEvidence = null;
let diagnosticAnchor = null;
try {
  if (!SUBJECT_SHA || !/^[0-9a-f]{40}$/.test(SUBJECT_SHA)) throw new Error('EA1E_EXACT_SUBJECT_SHA_REQUIRED');
  browser = await chromium.launch({ headless: true });

  async function causalAnchorCount(allow55) {
    const context = await browser.newContext({ locale: 'en-US', timezoneId: 'UTC' });
    const page = await context.newPage();
    await page.route(`https://${config.official_host}${config.endpoint_path_prefix}**`, async (route) => {
      const endpointId = endpointIdFromUrl(route.request().url());
      if (allow55 && endpointId === config.causal_anchor.endpoint_id) {
        await route.continue();
      } else {
        await route.fulfill({ status: 200, contentType: 'application/json; charset=utf-8', body: '[]' });
      }
    });
    const response = await page.goto(config.source_url, { waitUntil: 'domcontentloaded', timeout: 45_000 });
    if (!response || response.status() < 200 || response.status() >= 400) throw new Error('EA1E_CAUSAL_ANCHOR_DOCUMENT_FAILED');
    await page.waitForTimeout(3_500);
    const text = await page.locator('body').innerText();
    const role = config.roles.find((item) => item.role_id === config.causal_anchor.role_id);
    const count = countRole(text, role);
    await context.close();
    return count;
  }

  const anchorBaseline = await causalAnchorCount(false);
  const anchor55 = await causalAnchorCount(true);
  const anchorDelta = Math.max(0, anchor55 - anchorBaseline);
  diagnosticAnchor = {
    endpoint_id: config.causal_anchor.endpoint_id,
    role_id: config.causal_anchor.role_id,
    baseline_match_count: anchorBaseline,
    endpoint_55_match_count: anchor55,
    role_delta_count: anchorDelta,
  };
  if (anchorDelta !== config.causal_anchor.required_role_delta) {
    throw new Error(`EA1E_CAUSAL_AIR_TEMPERATURE_ANCHOR_FAILED:${anchorDelta}`);
  }

  const context = await browser.newContext({ locale: 'en-US', timezoneId: 'UTC' });
  const page = await context.newPage();
  const responseTasks = [];
  const endpointMemory = new Map();

  page.on('response', (response) => {
    const endpointId = endpointIdFromUrl(response.url());
    if (endpointId === null || !config.high_frequency_endpoint_ids.includes(endpointId)) return;
    const task = (async () => {
      const status = response.status();
      if (status < 200 || status >= 300) throw new Error(`EA1E_ENDPOINT_HTTP_STATUS:${endpointId}:${status}`);
      const body = await response.body();
      let json;
      try { json = JSON.parse(body.toString('utf8')); }
      catch { throw new Error(`EA1E_ENDPOINT_JSON_REQUIRED:${endpointId}`); }
      const latest = latestFinitePoint(json);
      if (!latest) throw new Error(`EA1E_ENDPOINT_LATEST_FINITE_POINT_REQUIRED:${endpointId}`);
      endpointMemory.set(endpointId, {
        endpoint_id: endpointId,
        endpoint_url: `https://${config.official_host}${config.endpoint_path_prefix}${endpointId}`,
        response_status: status,
        response_body_sha256: sha256(body),
        response_bytes: body.byteLength,
        latest,
      });
    })();
    responseTasks.push(task);
  });

  const mainResponse = await page.goto(config.source_url, { waitUntil: 'domcontentloaded', timeout: 45_000 });
  if (!mainResponse || mainResponse.status() < 200 || mainResponse.status() >= 400) throw new Error('EA1E_SOURCE_DOCUMENT_FAILED');
  await page.waitForFunction(
    () => /Soil\s+Moisture\s*\(10\s*cm\s*\/\s*3\.9\s*in\)\s*:\s*[+-]?\d+(?:\.\d+)?\s*%/i.test(document.body?.innerText ?? ''),
    undefined,
    { timeout: 45_000 },
  );
  await page.waitForTimeout(2_000);
  await Promise.all(responseTasks);
  const renderedText = await page.locator('body').innerText();
  await context.close();

  for (const endpointId of config.high_frequency_endpoint_ids) {
    if (!endpointMemory.has(endpointId)) throw new Error(`EA1E_HIGH_FREQUENCY_ENDPOINT_MISSING:${endpointId}`);
  }

  const nowMs = Date.now();
  const endpointSafe = [];
  for (const endpointId of config.high_frequency_endpoint_ids) {
    const entry = endpointMemory.get(endpointId);
    const ageMinutes = (nowMs - entry.latest.time) / MINUTE_MS;
    if (entry.latest.time > nowMs + config.freshness.future_timestamp_tolerance_minutes * MINUTE_MS) {
      throw new Error(`EA1E_ENDPOINT_FUTURE_TIMESTAMP:${endpointId}`);
    }
    if (ageMinutes > config.freshness.mapped_endpoint_max_age_minutes) {
      throw new Error(`EA1E_ENDPOINT_TOO_OLD:${endpointId}:${Math.floor(ageMinutes)}`);
    }
    endpointSafe.push(endpointSafeEvidence(entry, nowMs));
  }
  diagnosticEndpointEvidence = endpointSafe;

  const displayed = {};
  for (const role of config.roles) displayed[role.role_id] = extractRole(renderedText, role);

  const candidates = {};
  for (const role of config.roles) {
    const roleCandidates = [];
    const allowedEndpointIds = role.role_id === config.causal_anchor.role_id
      ? [config.causal_anchor.endpoint_id]
      : config.high_frequency_endpoint_ids.filter((id) => id !== config.causal_anchor.endpoint_id);
    const shown = displayed[role.role_id];
    const tolerance = displayTolerance(shown.decimals);
    for (const endpointId of allowedEndpointIds) {
      const endpoint = endpointMemory.get(endpointId);
      for (const transformId of role.allowed_transforms) {
        const transformed = transformValue(transformId, endpoint.latest.value);
        if (!Number.isFinite(transformed)) continue;
        if (Math.abs(transformed - shown.value) <= tolerance) {
          roleCandidates.push({ endpoint_id: endpointId, transform_id: transformId, display_precision_decimals: shown.decimals });
        }
      }
    }
    if (roleCandidates.length < 1) throw new Error(`EA1E_ROLE_HAS_NO_MATCH:${role.role_id}`);
    candidates[role.role_id] = roleCandidates;
  }
  diagnosticCandidates = safeCandidates(candidates);

  const roleIds = config.roles.map((role) => role.role_id);
  const assignments = enumerateAssignments(roleIds, candidates);
  if (assignments.length !== 1) {
    throw new Error(`EA1E_GLOBAL_UNIQUE_ASSIGNMENT_REQUIRED:${assignments.length > 1 ? 'MULTIPLE' : 'NONE'}`);
  }
  const assignment = assignments[0];

  const mappings = roleIds.map((roleId) => {
    const role = config.roles.find((item) => item.role_id === roleId);
    const selected = assignment[roleId];
    const endpoint = endpointMemory.get(selected.endpoint_id);
    const safe = endpointSafeEvidence(endpoint, nowMs);
    return {
      role_id: roleId,
      label: role.label,
      display_unit: role.display_unit,
      endpoint_id: selected.endpoint_id,
      endpoint_url: endpoint.endpoint_url,
      transform_id: selected.transform_id,
      display_precision_decimals: selected.display_precision_decimals,
      response_body_sha256: safe.response_body_sha256,
      response_bytes: safe.response_bytes,
      latest_timestamp: safe.latest_timestamp,
      age_minutes: safe.age_minutes,
      raw_numeric_sensor_value_emitted: false,
    };
  });

  const soilMapping = mappings.find((entry) => entry.role_id === 'SOIL_MOISTURE_10CM');
  if (!soilMapping) throw new Error('EA1E_SOIL_MOISTURE_MAPPING_REQUIRED');

  const result = {
    schema_version: 'geox_mcft_cap09_ea1e_kbs_transient_role_map_probe_result_v1',
    status: 'PASS',
    subject_sha: SUBJECT_SHA,
    source_url: config.source_url,
    probe_method: config.probe_method,
    retrieved_at: new Date().toISOString(),
    causal_anchor: diagnosticAnchor,
    high_frequency_endpoint_evidence: endpointSafe,
    candidate_sets: safeCandidates(candidates),
    unique_global_assignment_count: 1,
    mappings,
    soil_moisture_semantics: {
      endpoint_id: soilMapping.endpoint_id,
      transform_id: soilMapping.transform_id,
      epistemic_class: config.soil_moisture_semantics.epistemic_class,
      quantity_kind: config.soil_moisture_semantics.quantity_kind,
      source_display_unit: config.soil_moisture_semantics.source_display_unit,
      canonical_unit: config.soil_moisture_semantics.canonical_unit,
      spatial_support: config.soil_moisture_semantics.spatial_support,
      measurement_depth_mm: config.soil_moisture_semantics.measurement_depth_mm,
      direct_field_equivalence: false,
      direct_root_zone_equivalence: false,
      root_zone_representativeness: 'PARTIAL',
    },
    mapping_is_formal_source_authority: false,
    qualified_formal_site: false,
    raw_numeric_sensor_values_emitted: false,
    in_memory_numeric_values_discarded: true,
    raw_json_body_persisted: false,
    rendered_dom_persisted: false,
    unfiltered_rendered_text_persisted: false,
    database_connection_opened: false,
    database_write_count: 0,
    formal_evidence_write_count: 0,
    formal_window_started: false,
  };
  writeResult(result);
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  const result = {
    schema_version: 'geox_mcft_cap09_ea1e_kbs_transient_role_map_probe_result_v1',
    status: 'FAIL',
    subject_sha: SUBJECT_SHA,
    source_url: config.source_url,
    probe_method: config.probe_method,
    error: safeError(error),
    causal_anchor: diagnosticAnchor,
    high_frequency_endpoint_evidence: diagnosticEndpointEvidence,
    candidate_sets: diagnosticCandidates,
    raw_numeric_sensor_values_emitted: false,
    in_memory_numeric_values_discarded: true,
    raw_json_body_persisted: false,
    rendered_dom_persisted: false,
    unfiltered_rendered_text_persisted: false,
    database_connection_opened: false,
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
