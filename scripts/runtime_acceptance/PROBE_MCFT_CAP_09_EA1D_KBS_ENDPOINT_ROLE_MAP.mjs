#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const CONFIG_PATH = path.join(ROOT, 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA1D-KBS-ENDPOINT-ROLE-MAP-PROBE-V1.json');
const OUT = path.join(ROOT, 'acceptance-output/MCFT_CAP_09_EA1D_KBS_ENDPOINT_ROLE_MAP_PROBE_RESULT.json');
const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
const SUBJECT_SHA = process.env.MCFT_SUBJECT_SHA || null;

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
function countRoles(text) {
  const counts = {};
  for (const role of config.roles) {
    const regex = new RegExp(role.pattern, 'gim');
    counts[role.role_id] = [...String(text).matchAll(regex)].length;
  }
  return counts;
}
function latestTimestampFromJson(json) {
  if (!Array.isArray(json)) return null;
  let latest = null;
  for (const item of json) {
    if (!item || typeof item !== 'object') continue;
    const raw = item.time;
    const millis = typeof raw === 'string' ? Date.parse(raw) : Number.NaN;
    if (Number.isFinite(millis) && (latest === null || millis > latest)) latest = millis;
  }
  return latest === null ? null : new Date(latest).toISOString();
}

let browser;
let diagnosticBaselineRoleCounts = null;
let diagnosticEndpoints = [];
try {
  if (!SUBJECT_SHA || !/^[0-9a-f]{40}$/.test(SUBJECT_SHA)) throw new Error('EA1D_EXACT_SUBJECT_SHA_REQUIRED');
  browser = await chromium.launch({ headless: true });

  async function runIsolation(allowedEndpointId) {
    const context = await browser.newContext({ locale: 'en-US', timezoneId: 'UTC' });
    const page = await context.newPage();
    let selectedResponse = null;

    await page.route(`https://${config.official_host}${config.endpoint_path_prefix}**`, async (route) => {
      const endpointId = endpointIdFromUrl(route.request().url());
      if (allowedEndpointId !== null && endpointId === allowedEndpointId) {
        await route.continue();
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json; charset=utf-8',
        body: '[]',
      });
    });

    page.on('response', (response) => {
      const endpointId = endpointIdFromUrl(response.url());
      if (allowedEndpointId === null || endpointId !== allowedEndpointId) return;
      selectedResponse = (async () => {
        const status = response.status();
        if (status < 200 || status >= 300) return { status, parse_status: 'HTTP_NON_2XX' };
        const body = await response.body();
        let json;
        try { json = JSON.parse(body.toString('utf8')); }
        catch {
          return {
            status,
            parse_status: 'NON_JSON_BODY',
            response_body_sha256: sha256(body),
            response_bytes: body.byteLength,
          };
        }
        return {
          status,
          parse_status: 'JSON_PARSED',
          response_body_sha256: sha256(body),
          response_bytes: body.byteLength,
          latest_timestamp: latestTimestampFromJson(json),
          raw_numeric_values_emitted: false,
          raw_json_body_persisted: false,
        };
      })();
    });

    const mainResponse = await page.goto(config.source_url, { waitUntil: 'domcontentloaded', timeout: 45_000 });
    if (!mainResponse || mainResponse.status() < 200 || mainResponse.status() >= 400) {
      throw new Error(`EA1D_SOURCE_DOCUMENT_FAILED:${mainResponse?.status() ?? 'NO_RESPONSE'}`);
    }
    await page.waitForTimeout(3_500);
    const renderedText = await page.locator('body').innerText();
    const roleCounts = countRoles(renderedText);
    const responseEvidence = selectedResponse ? await selectedResponse : null;
    await context.close();
    return { roleCounts, responseEvidence };
  }

  const baseline = await runIsolation(null);
  diagnosticBaselineRoleCounts = baseline.roleCounts;
  const endpoints = [];
  diagnosticEndpoints = endpoints;
  for (const endpointId of config.endpoint_ids) {
    const isolated = await runIsolation(endpointId);
    const roleDeltas = {};
    const populatedRoles = [];
    for (const role of config.roles) {
      const baseCount = baseline.roleCounts[role.role_id] ?? 0;
      const isolatedCount = isolated.roleCounts[role.role_id] ?? 0;
      const delta = Math.max(0, isolatedCount - baseCount);
      roleDeltas[role.role_id] = {
        baseline_match_count: baseCount,
        isolated_match_count: isolatedCount,
        role_delta_count: delta,
      };
      if (delta > 0) populatedRoles.push(role.role_id);
    }
    if (!isolated.responseEvidence) throw new Error(`EA1D_SELECTED_ENDPOINT_RESPONSE_MISSING:${endpointId}`);
    if (isolated.responseEvidence.parse_status !== 'JSON_PARSED') {
      throw new Error(`EA1D_SELECTED_ENDPOINT_NOT_JSON:${endpointId}:${isolated.responseEvidence.parse_status}`);
    }
    endpoints.push({
      endpoint_id: endpointId,
      endpoint_url: `https://${config.official_host}${config.endpoint_path_prefix}${endpointId}`,
      populated_roles_above_baseline: populatedRoles,
      role_deltas: roleDeltas,
      response_status: isolated.responseEvidence.status,
      response_body_sha256: isolated.responseEvidence.response_body_sha256,
      response_bytes: isolated.responseEvidence.response_bytes,
      latest_timestamp: isolated.responseEvidence.latest_timestamp,
      raw_numeric_sensor_values_emitted: false,
      raw_json_body_persisted: false,
      rendered_dom_persisted: false,
    });
  }

  const bindings = {};
  for (const roleId of config.required_unique_bindings) {
    const matches = endpoints.filter((entry) => entry.populated_roles_above_baseline.includes(roleId));
    if (matches.length !== 1) throw new Error(`EA1D_REQUIRED_UNIQUE_ROLE_BINDING_FAILED:${roleId}:${matches.map((entry) => entry.endpoint_id).join(',') || 'NONE'}`);
    bindings[roleId] = matches[0].endpoint_id;
  }

  const soilEndpoint = bindings.SOIL_MOISTURE_10CM;
  if (!Number.isInteger(soilEndpoint)) throw new Error('EA1D_SOIL_MOISTURE_ENDPOINT_REQUIRED');

  const result = {
    schema_version: 'geox_mcft_cap09_ea1d_kbs_endpoint_role_map_probe_result_v1',
    status: 'PASS',
    subject_sha: SUBJECT_SHA,
    source_url: config.source_url,
    probe_method: config.probe_method,
    retrieved_at: new Date().toISOString(),
    baseline_role_match_counts: baseline.roleCounts,
    endpoints,
    required_unique_role_bindings: bindings,
    soil_moisture_binding: {
      endpoint_id: soilEndpoint,
      role_id: 'SOIL_MOISTURE_10CM',
      source_unit: 'percent_vwc',
      measurement_depth_mm: config.soil_moisture_semantics.measurement_depth_mm,
      canonical_unit_after_conversion: config.soil_moisture_semantics.canonical_unit_after_conversion,
      epistemic_class: config.soil_moisture_semantics.epistemic_class,
      spatial_support: config.soil_moisture_semantics.spatial_support,
      direct_field_equivalence: false,
      direct_root_zone_equivalence: false,
      root_zone_representativeness: 'PARTIAL',
    },
    mapping_is_formal_source_authority: false,
    qualified_formal_site: false,
    raw_numeric_sensor_values_emitted: false,
    raw_json_body_persisted: false,
    rendered_dom_persisted: false,
    database_connection_opened: false,
    database_write_count: 0,
    formal_evidence_write_count: 0,
    formal_window_started: false,
  };
  writeResult(result);
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  const result = {
    schema_version: 'geox_mcft_cap09_ea1d_kbs_endpoint_role_map_probe_result_v1',
    status: 'FAIL',
    subject_sha: SUBJECT_SHA,
    source_url: config.source_url,
    probe_method: config.probe_method,
    error: safeError(error),
    baseline_role_match_counts: diagnosticBaselineRoleCounts,
    diagnostic_endpoints: diagnosticEndpoints,
    raw_numeric_sensor_values_emitted: false,
    raw_json_body_persisted: false,
    rendered_dom_persisted: false,
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
