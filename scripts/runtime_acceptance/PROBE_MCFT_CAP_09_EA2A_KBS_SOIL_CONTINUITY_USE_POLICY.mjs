#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const AUTHORITY_PATH = path.join(ROOT, 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA2A-KBS-SOIL-CONTINUITY-USE-POLICY-V1.json');
const OUT = path.join(ROOT, 'acceptance-output/MCFT_CAP_09_EA2A_KBS_SOIL_CONTINUITY_USE_POLICY_RESULT.json');
const AUTH = JSON.parse(fs.readFileSync(AUTHORITY_PATH, 'utf8'));
const SUBJECT_SHA = process.env.MCFT_SUBJECT_SHA || '';
const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const REQUEST_TIMEOUT_MS = 45_000;
const MAX_ATTEMPTS = 4;

function sha256(input) {
  return `sha256:${crypto.createHash('sha256').update(input).digest('hex')}`;
}
function require(condition, code) {
  if (!condition) throw new Error(code);
}
function writeResult(value) {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}
function safeError(error) {
  const text = error instanceof Error ? `${error.name}:${error.message}` : String(error);
  return text.replace(/https?:\/\/\S+/g, '[URL_REDACTED]').slice(0, 800);
}
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
async function fetchBytes(url, code, accept) {
  let lastError;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(url, {
        method: 'GET',
        redirect: 'follow',
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        headers: {
          'user-agent': 'GEOX-MCFT-CAP09-EA2A-KBS-CONTINUITY/1.0',
          accept,
          'cache-control': 'no-cache',
        },
      });
      if (!response.ok) throw new Error(`${code}_HTTP_${response.status}`);
      const finalUrl = new URL(response.url);
      require(finalUrl.protocol === 'https:' && finalUrl.hostname === 'lter.kbs.msu.edu', `${code}_FINAL_ORIGIN_DRIFT`);
      const bytes = new Uint8Array(await response.arrayBuffer());
      return { bytes, status: response.status, finalUrl: response.url, contentType: String(response.headers.get('content-type') || '') };
    } catch (error) {
      lastError = error;
      if (attempt === MAX_ATTEMPTS) break;
      await sleep(500 * attempt);
    }
  }
  throw lastError;
}
function normalizePoint(item) {
  if (!item || typeof item !== 'object') return null;
  const time = Date.parse(String(item.time ?? ''));
  const value = Number(item.value);
  if (!Number.isFinite(time) || !Number.isFinite(value)) return null;
  return { time, value };
}
function iso(ms) {
  return new Date(ms).toISOString();
}
function hourBucket(ms) {
  return Math.floor(ms / HOUR_MS);
}
function semanticTermsMatch(text) {
  const normalized = String(text)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .toLowerCase();
  const publication = normalized.includes('may not be published') || normalized.includes('cannot be published');
  const writtenPermission = normalized.includes('written permission');
  const authority = normalized.includes('lead investigator') && normalized.includes('project director');
  return { publication, writtenPermission, authority, pass: publication && writtenPermission && authority };
}
function termsSemanticDigest(termsMatch) {
  const canonical = {
    required_terms_semantics: AUTH.use_policy.required_terms_semantics,
    publication_restriction_phrase_present: termsMatch.publication,
    written_permission_phrase_present: termsMatch.writtenPermission,
    lead_investigator_and_project_director_phrase_present: termsMatch.authority,
    public_raw_data_redistribution_authorized: false,
    public_reconstructable_raw_data_artifact_authorized: false,
    publication_without_written_permission_authorized: false,
    commercial_reuse_rights_established: false,
  };
  return sha256(Buffer.from(JSON.stringify(canonical)));
}

const baseResult = {
  schema_version: 'geox_mcft_cap09_ea2a_kbs_soil_continuity_use_policy_result_v1',
  status: 'FAIL',
  subject_sha: SUBJECT_SHA || null,
  database_write_count: 0,
  formal_evidence_write_count: 0,
  formal_site_authority_created: false,
  formal_external_evidence_package_created: false,
  ea3_authorized: false,
  formal_window_started: false,
  raw_soil_values_emitted: false,
  raw_json_body_emitted: false,
  raw_terms_body_emitted: false,
};

try {
  require(/^[0-9a-f]{40}$/.test(SUBJECT_SHA), 'EA2A_EXACT_SUBJECT_SHA_REQUIRED');
  require(AUTH.record_status === 'EA2A_LIVE_QUALIFICATION_CANDIDATE_NOT_EFFECTIVE' || AUTH.record_status === 'EA2A_LIVE_QUALIFICATION_PASS_CANDIDATE_NOT_EFFECTIVE', 'EA2A_AUTHORITY_STATUS_DRIFT');

  const retrievedAtMs = Date.now();
  const [soilResponse, termsResponse] = await Promise.all([
    fetchBytes(AUTH.soil_source_candidate.endpoint_url, 'EA2A_SOIL_ENDPOINT', 'application/json,*/*;q=0.5'),
    fetchBytes(AUTH.use_policy.terms_url, 'EA2A_TERMS', 'text/html,text/plain;q=0.9,*/*;q=0.5'),
  ]);

  let json;
  try {
    json = JSON.parse(new TextDecoder().decode(soilResponse.bytes));
  } catch {
    throw new Error('EA2A_SOIL_ENDPOINT_JSON_REQUIRED');
  }
  require(Array.isArray(json), 'EA2A_SOIL_ENDPOINT_ARRAY_REQUIRED');

  const rawPoints = json.map(normalizePoint).filter(Boolean).sort((a, b) => a.time - b.time);
  require(rawPoints.length > 0, 'EA2A_SOIL_FINITE_POINTS_REQUIRED');
  const latestObserved = rawPoints.at(-1).time;
  const frozen = AUTH.frozen_discovery_observation || null;
  const windowEnd = frozen ? Date.parse(frozen.window_end_utc) : latestObserved;
  require(Number.isFinite(windowEnd), 'EA2A_WINDOW_END_REQUIRED');
  require(rawPoints.some(point => point.time === windowEnd), 'EA2A_FROZEN_WINDOW_END_POINT_REQUIRED');

  const maxAgeMs = AUTH.continuity_policy.latest_source_max_age_minutes * MINUTE_MS;
  const futureToleranceMs = AUTH.continuity_policy.future_timestamp_tolerance_minutes * MINUTE_MS;
  const latestAgeMinutes = (retrievedAtMs - latestObserved) / MINUTE_MS;
  require(latestObserved <= retrievedAtMs + futureToleranceMs, 'EA2A_SOIL_LATEST_TIMESTAMP_IN_FUTURE');
  require(retrievedAtMs - latestObserved <= maxAgeMs, `EA2A_SOIL_LATEST_TOO_OLD_${Math.floor(latestAgeMinutes)}`);

  const windowStart = windowEnd - AUTH.continuity_policy.qualification_window_hours * HOUR_MS;
  const windowPoints = rawPoints.filter(point => point.time >= windowStart && point.time <= windowEnd);
  require(windowPoints.length >= 2, 'EA2A_SOIL_WINDOW_POINTS_REQUIRED');

  const byTimestamp = new Map();
  let conflictingDuplicateCount = 0;
  for (const point of windowPoints) {
    if (byTimestamp.has(point.time) && byTimestamp.get(point.time) !== point.value) conflictingDuplicateCount += 1;
    else byTimestamp.set(point.time, point.value);
  }
  require(conflictingDuplicateCount === 0, `EA2A_SOIL_CONFLICTING_DUPLICATE_TIMESTAMPS_${conflictingDuplicateCount}`);
  const distinct = [...byTimestamp.entries()].map(([time, value]) => ({ time, value })).sort((a, b) => a.time - b.time);

  let invalidRangeCount = 0;
  for (const point of distinct) {
    if (!Number.isFinite(point.value) || point.value < 0 || point.value > 1) invalidRangeCount += 1;
  }
  require(invalidRangeCount === 0, `EA2A_SOIL_VWC_RANGE_INVALID_COUNT_${invalidRangeCount}`);

  let maxGapMinutes = 0;
  for (let index = 1; index < distinct.length; index += 1) {
    const gap = (distinct[index].time - distinct[index - 1].time) / MINUTE_MS;
    if (gap > maxGapMinutes) maxGapMinutes = gap;
  }
  const spanMinutes = (distinct.at(-1).time - distinct[0].time) / MINUTE_MS;
  const distinctHourBuckets = new Set(distinct.map(point => hourBucket(point.time))).size;
  const continuityQualified = (
    spanMinutes >= AUTH.continuity_policy.minimum_window_span_minutes
    && maxGapMinutes <= AUTH.continuity_policy.maximum_allowed_gap_minutes
    && distinctHourBuckets >= AUTH.continuity_policy.minimum_distinct_hour_buckets
    && invalidRangeCount === 0
    && conflictingDuplicateCount === 0
  );

  const termsText = new TextDecoder().decode(termsResponse.bytes);
  const termsMatch = semanticTermsMatch(termsText);
  const usePolicyQualified = termsMatch.pass;
  const semanticDigest = termsSemanticDigest(termsMatch);

  let decision;
  if (!continuityQualified) decision = AUTH.qualification_effect.continuity_rejection_decision;
  else if (!usePolicyQualified) decision = AUTH.qualification_effect.use_policy_rejection_decision;
  else decision = AUTH.qualification_effect.success_decision;

  const timestampChain = sha256(Buffer.from(distinct.map(point => iso(point.time)).join('\n')));
  const result = {
    ...baseResult,
    status: 'PASS',
    probe_observed_at_utc: new Date(retrievedAtMs).toISOString(),
    soil_source: {
      endpoint_id: AUTH.soil_source_candidate.endpoint_id,
      role_id: AUTH.soil_source_candidate.role_id,
      response_status: soilResponse.status,
      response_sha256: sha256(soilResponse.bytes),
      response_bytes: soilResponse.bytes.byteLength,
      latest_timestamp_utc: iso(latestObserved),
      latest_age_minutes: Number(latestAgeMinutes.toFixed(3)),
      source_payload_array_length: json.length,
      numeric_values_emitted: false,
      raw_body_emitted: false,
    },
    continuity_qualification: {
      window_start_utc: iso(windowStart),
      window_end_utc: iso(windowEnd),
      window_is_frozen_from_authority: Boolean(frozen),
      distinct_point_count: distinct.length,
      distinct_hour_bucket_count: distinctHourBuckets,
      span_minutes: Number(spanMinutes.toFixed(3)),
      maximum_gap_minutes: Number(maxGapMinutes.toFixed(3)),
      conflicting_duplicate_timestamp_count: conflictingDuplicateCount,
      invalid_vwc_fraction_count: invalidRangeCount,
      timestamp_chain_sha256: timestampChain,
      silent_imputation_performed: false,
      gap_fill_performed: false,
      continuity_qualified: continuityQualified,
    },
    use_policy_qualification: {
      terms_response_status: termsResponse.status,
      terms_page_sha256: sha256(termsResponse.bytes),
      terms_page_bytes: termsResponse.bytes.byteLength,
      terms_raw_hash_role: 'DISCOVERY_AND_LIVE_PROVENANCE_ONLY_NOT_SEMANTIC_AUTHORITY_IDENTITY',
      terms_semantic_digest_sha256: semanticDigest,
      publication_restriction_phrase_present: termsMatch.publication,
      written_permission_phrase_present: termsMatch.writtenPermission,
      lead_investigator_and_project_director_phrase_present: termsMatch.authority,
      required_terms_semantics_matched: usePolicyQualified,
      public_raw_data_redistribution_authorized: false,
      public_reconstructable_raw_data_artifact_authorized: false,
      publication_without_written_permission_authorized: false,
      commercial_reuse_rights_established: false,
      private_stage1b_technical_processing_is_a_legal_opinion: false,
      raw_terms_body_emitted: false,
      use_policy_qualified: usePolicyQualified,
    },
    raw_provenance_boundary: {
      exact_raw_payload_private_retention_required_before_canonicalization: true,
      public_probe_publishes_hash_and_metadata_only: true,
      public_raw_or_reconstructable_sensor_sequence_published: false,
    },
    adjudication: {
      decision,
      continuity_qualified: continuityQualified,
      use_policy_qualified: usePolicyQualified,
      ea2_formal_package_freeze_consideration_qualified: continuityQualified && usePolicyQualified,
    },
  };
  writeResult(result);
  console.log(JSON.stringify(result));
} catch (error) {
  const failure = { ...baseResult, error: safeError(error) };
  writeResult(failure);
  console.error(JSON.stringify(failure));
  process.exitCode = 1;
}
