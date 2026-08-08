#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = path.join(ROOT, 'acceptance-output/MCFT_CAP_09_EA1_KBS_CURRENT_WEATHER_MACHINE_PROBE_RESULT.json');
const SOURCE_URL = 'https://lter.kbs.msu.edu/current-weather/';
const OFFICIAL_HOST = 'lter.kbs.msu.edu';
const VALUE_RE = /Soil\s+Moisture\s*\(10\s*cm\s*\/\s*3\.9\s*in\)\s*:\s*([+-]?\d+(?:\.\d+)?)\s*%/i;
const UPDATED_RE = /Last\s+updated\s*:\s*([^\n\r]+)/i;

function sha256(input) {
  return `sha256:${crypto.createHash('sha256').update(input).digest('hex')}`;
}

function writeResult(value) {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function safeUrl(raw) {
  try {
    const parsed = new URL(raw);
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return 'INVALID_URL';
  }
}

const retrievedAt = new Date().toISOString();
const responsePromises = [];
const networkEvidence = [];
let browser;

try {
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    locale: 'en-US',
    timezoneId: 'UTC',
  });
  const page = await context.newPage();

  page.on('response', (response) => {
    const task = (async () => {
      let parsed;
      try {
        parsed = new URL(response.url());
      } catch {
        return;
      }
      if (parsed.hostname !== OFFICIAL_HOST) return;
      const resourceType = response.request().resourceType();
      if (!['document', 'xhr', 'fetch'].includes(resourceType)) return;
      const status = response.status();
      const headers = await response.allHeaders();
      let bodyHash = null;
      let bodyBytes = null;
      if (status >= 200 && status < 400) {
        try {
          const body = await response.body();
          bodyBytes = body.byteLength;
          bodyHash = sha256(body);
        } catch {
          bodyHash = null;
        }
      }
      networkEvidence.push({
        url_without_query: safeUrl(response.url()),
        resource_type: resourceType,
        status,
        content_type: headers['content-type'] ?? null,
        body_bytes: bodyBytes,
        body_sha256: bodyHash,
      });
    })();
    responsePromises.push(task);
  });

  const mainResponse = await page.goto(SOURCE_URL, {
    waitUntil: 'domcontentloaded',
    timeout: 45_000,
  });
  if (!mainResponse || mainResponse.status() < 200 || mainResponse.status() >= 400) {
    throw new Error(`KBS_CURRENT_WEATHER_DOCUMENT_FAILED:${mainResponse?.status() ?? 'NO_RESPONSE'}`);
  }

  await page.waitForFunction(
    () => /Soil\s+Moisture\s*\(10\s*cm\s*\/\s*3\.9\s*in\)\s*:\s*[+-]?\d+(?:\.\d+)?\s*%/i.test(document.body?.innerText ?? ''),
    undefined,
    { timeout: 45_000 },
  );
  await page.waitForFunction(
    () => /Last\s+updated\s*:\s*[^\n\r]+/i.test(document.body?.innerText ?? ''),
    undefined,
    { timeout: 20_000 },
  );

  const renderedText = await page.locator('body').innerText();
  const renderedDom = await page.content();
  const valueMatch = renderedText.match(VALUE_RE);
  const updatedMatch = renderedText.match(UPDATED_RE);
  if (!valueMatch) throw new Error('KBS_SOIL_MOISTURE_RENDERED_VALUE_NOT_FOUND');
  if (!updatedMatch || !updatedMatch[1]?.trim()) throw new Error('KBS_LAST_UPDATED_RENDERED_VALUE_NOT_FOUND');

  const soilMoisturePercent = Number(valueMatch[1]);
  if (!Number.isFinite(soilMoisturePercent) || soilMoisturePercent < 0 || soilMoisturePercent > 100) {
    throw new Error('KBS_SOIL_MOISTURE_PERCENT_OUT_OF_RANGE');
  }
  const lastUpdatedText = updatedMatch[1].trim();
  const normalizedObservation = JSON.stringify({
    source_url: SOURCE_URL,
    metric: 'soil_moisture',
    depth_mm: 100,
    source_unit: 'percent_vwc',
    value: soilMoisturePercent,
    source_last_updated_text: lastUpdatedText,
  });

  await Promise.allSettled(responsePromises);
  networkEvidence.sort((a, b) => `${a.resource_type}:${a.url_without_query}`.localeCompare(`${b.resource_type}:${b.url_without_query}`));
  const documentHashes = networkEvidence.filter((item) => item.resource_type === 'document' && item.body_sha256);
  if (documentHashes.length < 1) throw new Error('KBS_DOCUMENT_RESPONSE_HASH_REQUIRED');

  const result = {
    schema_version: 'geox_mcft_cap09_ea1_kbs_current_weather_machine_probe_result_v1',
    status: 'PASS',
    subject_sha: process.env.GITHUB_SHA || null,
    source_url: SOURCE_URL,
    retrieved_at: retrievedAt,
    probe_method: 'OFFICIAL_WEB_UI_BROWSER_RENDER_V1',
    rendered_soil_moisture_value_present: true,
    source_unit: 'percent_vwc',
    depth_mm: 100,
    numeric_range_check_passed: true,
    source_last_updated_value_present: true,
    source_last_updated_sha256: sha256(lastUpdatedText),
    normalized_observation_sha256: sha256(normalizedObservation),
    rendered_document_sha256: sha256(renderedDom),
    official_host_response_hash_count: networkEvidence.filter((item) => item.body_sha256).length,
    official_host_response_hashes: networkEvidence,
    raw_response_body_persisted: false,
    rendered_dom_persisted: false,
    raw_sensor_value_published_in_result: false,
    database_connection_opened: false,
    database_write_count: 0,
    formal_evidence_write_count: 0,
    formal_eligible: false,
    qualified_formal_site: false,
    formal_window_started: false,
  };
  writeResult(result);
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  const result = {
    schema_version: 'geox_mcft_cap09_ea1_kbs_current_weather_machine_probe_result_v1',
    status: 'FAIL',
    subject_sha: process.env.GITHUB_SHA || null,
    source_url: SOURCE_URL,
    retrieved_at: retrievedAt,
    probe_method: 'OFFICIAL_WEB_UI_BROWSER_RENDER_V1',
    error: error instanceof Error ? error.message : String(error),
    raw_response_body_persisted: false,
    rendered_dom_persisted: false,
    raw_sensor_value_published_in_result: false,
    database_connection_opened: false,
    database_write_count: 0,
    formal_evidence_write_count: 0,
    formal_eligible: false,
    qualified_formal_site: false,
    formal_window_started: false,
  };
  writeResult(result);
  console.error(JSON.stringify(result, null, 2));
  process.exitCode = 1;
} finally {
  await browser?.close();
}
