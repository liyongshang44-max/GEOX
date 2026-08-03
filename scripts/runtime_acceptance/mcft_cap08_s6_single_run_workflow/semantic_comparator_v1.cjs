#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const VOLATILE_KEYS = new Set([
  'run_label',
  'rehearsal_run_label',
  'operational_run_instance_id',
  'database_instance_digest',
  'database_name',
  'expected_database_name',
  'logical_database_identity',
  'artifact_ref',
  'artifact_digest',
  'transport_file',
  'transport_digest',
  'issued_at',
  'expires_at',
  'response_started_at',
  'response_instance_hash',
  'response_hash',
]);

const CURSOR_PRESENT_V1 = 'CURSOR_PRESENT';
const RECOVERY_EVENT_PRESENT_V1 = 'RECOVERY_EVENT_PRESENT';

function normalizeV1(value) {
  if (Array.isArray(value)) return value.map(normalizeV1);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value)
      .filter(([key]) => !VOLATILE_KEYS.has(key))
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => [
        key,
        key === 'next_cursor'
          ? (child === null ? null : CURSOR_PRESENT_V1)
          : normalizeV1(child),
      ]));
  }
  return value;
}

function normalizeRecoveryV1(recovery) {
  const normalized = normalizeV1(recovery);
  if (!Array.isArray(normalized?.results)) return normalized;
  return {
    ...normalized,
    results: normalized.results.map(result => ({
      ...result,
      ...(Object.prototype.hasOwnProperty.call(result, 'event_ref')
        ? { event_ref: result.event_ref ? RECOVERY_EVENT_PRESENT_V1 : null }
        : {}),
    })),
  };
}

function canonicalV1(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalV1).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonicalV1(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function digestV1(value) {
  return `sha256:${crypto.createHash('sha256').update(canonicalV1(value)).digest('hex')}`;
}

function semanticProjectionV1(bundle) {
  return normalizeV1({
    exact_subject_sha: bundle.spec.exact_subject_sha,
    formal_run_id: bundle.spec.formal_run_id,
    identity_basis: bundle.spec.identity_basis,
    lineage_id: bundle.spec.lineage_id,
    revision_id: bundle.spec.revision_id,
    phase_order: bundle.spec.phases.map(phase => ({
      phase_id: phase.phase_id,
      phase_order: phase.phase_order,
      providers_enabled: phase.providers_enabled,
    })),
    canonical_receipts: bundle.receipt_manifest.receipts,
    canonical_objects: bundle.readback.objects,
    phase_results: bundle.materialization.phase_results,
    selector_snapshot: bundle.materialization.selector_snapshot,
    operational_events: bundle.materialization.operational_events,
    recovery: normalizeRecoveryV1(bundle.recovery),
    cap07: bundle.cap07,
  });
}

function previewV1(value) {
  const encoded = JSON.stringify(value);
  if (encoded === undefined) return String(value);
  return encoded.length <= 256 ? encoded : `${encoded.slice(0, 256)}…`;
}

function semanticDifferencesV1(left, right, sampleLimit = 100) {
  let differenceCount = 0;
  const samples = [];
  function record(pathValue, kind, leftValue, rightValue) {
    differenceCount += 1;
    if (samples.length >= sampleLimit) return;
    samples.push({
      path: pathValue,
      kind,
      left: previewV1(leftValue),
      right: previewV1(rightValue),
    });
  }
  function walk(leftValue, rightValue, pathValue) {
    if (Array.isArray(leftValue) || Array.isArray(rightValue)) {
      if (!Array.isArray(leftValue) || !Array.isArray(rightValue)) {
        record(pathValue, 'TYPE', leftValue, rightValue);
        return;
      }
      if (leftValue.length !== rightValue.length) {
        record(`${pathValue}.length`, 'ARRAY_LENGTH', leftValue.length, rightValue.length);
      }
      const sharedLength = Math.min(leftValue.length, rightValue.length);
      for (let index = 0; index < sharedLength; index += 1) {
        walk(leftValue[index], rightValue[index], `${pathValue}[${index}]`);
      }
      return;
    }
    const leftObject = leftValue && typeof leftValue === 'object';
    const rightObject = rightValue && typeof rightValue === 'object';
    if (leftObject || rightObject) {
      if (!leftObject || !rightObject) {
        record(pathValue, 'TYPE', leftValue, rightValue);
        return;
      }
      const leftKeys = Object.keys(leftValue).sort();
      const rightKeys = Object.keys(rightValue).sort();
      const keys = [...new Set([...leftKeys, ...rightKeys])].sort();
      for (const key of keys) {
        if (!Object.prototype.hasOwnProperty.call(leftValue, key)) {
          record(`${pathValue}.${key}`, 'MISSING_LEFT', undefined, rightValue[key]);
        } else if (!Object.prototype.hasOwnProperty.call(rightValue, key)) {
          record(`${pathValue}.${key}`, 'MISSING_RIGHT', leftValue[key], undefined);
        } else {
          walk(leftValue[key], rightValue[key], `${pathValue}.${key}`);
        }
      }
      return;
    }
    if (!Object.is(leftValue, rightValue)) {
      record(pathValue, 'VALUE', leftValue, rightValue);
    }
  }
  walk(left, right, '$');
  return { difference_count: differenceCount, samples };
}

function writeResultV1(outputPath, result) {
  fs.mkdirSync(path.dirname(path.resolve(outputPath)), { recursive: true });
  fs.writeFileSync(path.resolve(outputPath), `${JSON.stringify(result, null, 2)}\n`);
}

function main() {
  const aPath = String(process.env.MCFT_CAP08_RUN_DEV_A_BUNDLE || '').trim();
  const bPath = String(process.env.MCFT_CAP08_RUN_DEV_B_BUNDLE || '').trim();
  const outputPath = String(process.env.MCFT_CAP08_COMPARATOR_OUTPUT || '').trim();
  assert.ok(aPath && bPath && outputPath, 'COMPARATOR_PATHS_REQUIRED');
  const a = JSON.parse(fs.readFileSync(path.resolve(aPath), 'utf8'));
  const b = JSON.parse(fs.readFileSync(path.resolve(bPath), 'utf8'));
  assert.equal(a.classification, 'DEVELOPMENT_REHEARSAL');
  assert.equal(b.classification, 'DEVELOPMENT_REHEARSAL');
  assert.equal(a.evidence_class, 'NON_FORMAL');
  assert.equal(b.evidence_class, 'NON_FORMAL');
  assert.notEqual(a.fresh_database.database_name, b.fresh_database.database_name, 'INDEPENDENT_DATABASE_NAMES_REQUIRED');
  assert.notEqual(a.spec.operational_run_instance_id, b.spec.operational_run_instance_id, 'INDEPENDENT_OPERATIONAL_IDENTITIES_REQUIRED');
  assert.notEqual(a.materialization.database_instance_digest, b.materialization.database_instance_digest, 'INDEPENDENT_DATABASE_INSTANCE_DIGESTS_REQUIRED');
  assert.equal(a.receipt_manifest.receipt_count, 153);
  assert.equal(b.receipt_manifest.receipt_count, 153);
  assert.equal(a.materialization.operational_events.length, 224);
  assert.equal(b.materialization.operational_events.length, 224);

  const projectionA = semanticProjectionV1(a);
  const projectionB = semanticProjectionV1(b);
  const digestA = digestV1(projectionA);
  const digestB = digestV1(projectionB);
  const differences = semanticDifferencesV1(projectionA, projectionB);
  const common = {
    schema_version: 'geox_mcft_cap08_s6_development_rehearsal_semantic_comparator_v1',
    evidence_class: 'NON_FORMAL',
    exact_subject_sha: a.spec.exact_subject_sha,
    run_dev_a_operational_identity: a.spec.operational_run_instance_id,
    run_dev_b_operational_identity: b.spec.operational_run_instance_id,
    run_dev_a_database: a.fresh_database.database_name,
    run_dev_b_database: b.fresh_database.database_name,
    semantic_digest_a: digestA,
    semantic_digest_b: digestB,
    independent_database_instances: true,
    normalization_contract: {
      signed_cursor_token: 'PRESENCE_ONLY',
      response_transport_timestamp_and_hash: 'EXCLUDED',
      recovery_event_ref: 'PRESENCE_ONLY',
      canonical_objects: 'FULL_VALUE',
      canonical_receipts: 'FULL_VALUE',
      operational_events: 'FULL_VALUE',
    },
  };
  if (digestA !== digestB || differences.difference_count !== 0) {
    const failure = {
      ...common,
      status: 'FAIL',
      semantic_equivalence: false,
      difference_count: differences.difference_count,
      difference_samples: differences.samples,
      formal_comparator_authorized: false,
    };
    writeResultV1(outputPath, failure);
    console.error(JSON.stringify(failure, null, 2));
    assert.equal(digestA, digestB, 'DEVELOPMENT_REHEARSAL_SEMANTIC_DRIFT');
    assert.equal(differences.difference_count, 0, 'DEVELOPMENT_REHEARSAL_SEMANTIC_DIFFERENCE');
  }
  const result = {
    ...common,
    status: 'PASS',
    semantic_equivalence: true,
    difference_count: 0,
    formal_comparator_authorized: false,
  };
  writeResultV1(outputPath, result);
  console.log(JSON.stringify(result, null, 2));
}

if (require.main === module) main();

module.exports = {
  normalizeV1,
  normalizeRecoveryV1,
  semanticProjectionV1,
  semanticDifferencesV1,
  digestV1,
};
