'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const CAP07_SCOPE_KEYS_V1 = Object.freeze([
  'tenant_id',
  'project_id',
  'group_id',
  'field_id',
  'season_id',
  'zone_id',
]);

const CAP07_MODEL_GOVERNANCE_KINDS_V1 = Object.freeze([
  'CALIBRATION_CANDIDATE',
  'SHADOW_EVALUATION',
]);

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function sha(value) {
  return crypto.createHash('sha256').update(typeof value === 'string' ? value : canonical(value)).digest('hex');
}

function digest(value) {
  return `sha256:${sha(value)}`;
}

function required(value, code) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(code);
  return value;
}

function exactScope(actual, expected, code = 'SCOPE_MISMATCH') {
  for (const key of CAP07_SCOPE_KEYS_V1) {
    if (String(actual?.[key]) !== String(expected[key])) throw new Error(`${code}:${key}`);
  }
}

function validateCap07ScopeV1(scope) {
  if (!scope || typeof scope !== 'object' || Array.isArray(scope)) {
    throw new Error('CAP07_REQUEST_SCOPE_REQUIRED');
  }
  const actualKeys = Object.keys(scope).sort();
  const expectedKeys = [...CAP07_SCOPE_KEYS_V1].sort();
  if (actualKeys.length !== expectedKeys.length || actualKeys.some((key, index) => key !== expectedKeys[index])) {
    throw new Error('CAP07_REQUEST_SCOPE_KEYS');
  }
  const normalized = {};
  for (const key of CAP07_SCOPE_KEYS_V1) {
    normalized[key] = required(scope[key], `CAP07_REQUEST_SCOPE_VALUE:${key}`);
  }
  return normalized;
}

function validateCap07RequestEnvelopeV1(envelope) {
  if (!envelope || typeof envelope !== 'object' || Array.isArray(envelope)) {
    throw new Error('CAP07_REQUEST_ENVELOPE_REQUIRED');
  }
  const expectedKeys = ['collection_kind', 'cursor', 'limit', 'scope', 'surface'];
  const actualKeys = Object.keys(envelope).sort();
  if (actualKeys.length !== expectedKeys.length || actualKeys.some((key, index) => key !== expectedKeys[index])) {
    throw new Error('CAP07_REQUEST_ENVELOPE_KEYS');
  }
  const scope = validateCap07ScopeV1(envelope.scope);
  const surface = required(envelope.surface, 'CAP07_REQUEST_SURFACE_REQUIRED');
  const cursor = envelope.cursor === null ? null : required(envelope.cursor, 'CAP07_REQUEST_CURSOR_INVALID');
  if (!Number.isInteger(envelope.limit) || envelope.limit < 1 || envelope.limit > 200) {
    throw new Error('CAP07_REQUEST_LIMIT_INVALID');
  }
  const collectionKind = envelope.collection_kind;
  if (surface === 'model-governance') {
    if (!CAP07_MODEL_GOVERNANCE_KINDS_V1.includes(collectionKind)) {
      throw new Error('CAP07_REQUEST_MODEL_GOVERNANCE_KIND_INVALID');
    }
  } else if (collectionKind !== null) {
    throw new Error('CAP07_REQUEST_COLLECTION_KIND_UNEXPECTED');
  }
  return {
    scope,
    surface,
    collection_kind: collectionKind,
    cursor,
    limit: envelope.limit,
  };
}

function buildCap07RequestEnvelopeV1({ scope, surface, collectionKind = null, cursor = null, limit = 10 }) {
  return validateCap07RequestEnvelopeV1({
    scope,
    surface,
    collection_kind: collectionKind,
    cursor,
    limit,
  });
}

function phaseForOrder(order) {
  if (order === 1 || order === 16) return 'T16';
  if (order === 24) return 'G00';
  return `T${String(order).padStart(2, '0')}`;
}

function phaseForLogicalTime(logical) {
  const hour = new Date(logical).getUTCHours();
  return `T${String(hour).padStart(2, '0')}`;
}

function member(recordSet, type) {
  const values = recordSet.members.filter(value => value.object_type === type);
  if (values.length !== 1) throw new Error(`MEMBER_CARDINALITY:${type}:${values.length}`);
  return values[0];
}

async function product(root, relative) {
  // Load the TypeScript runtime only when the real product path executes.
  // Static contract validation intentionally runs without workspace dependencies.
  const { tsImport } = require('tsx/esm/api');
  return tsImport(path.join(root, relative), __filename);
}

function readJson(root, relative) {
  return JSON.parse(fs.readFileSync(path.join(root, relative), 'utf8'));
}

function factId(prefix, identity) {
  return `fact_${prefix}_${sha(identity).slice(0, 32)}`;
}

function receipt(spec, role, objectType, objectRef, objectHash, phaseId, logicalTime) {
  return {
    formal_run_id: spec.formal_run_id,
    ...spec.scope,
    lineage_id: spec.lineage_id,
    revision_id: spec.revision_id,
    member_role: role,
    object_type: objectType,
    object_ref: objectRef,
    object_hash: objectHash,
    phase_id: phaseId,
    logical_time: logicalTime,
  };
}

module.exports = {
  CAP07_SCOPE_KEYS_V1,
  CAP07_MODEL_GOVERNANCE_KINDS_V1,
  canonical,
  sha,
  digest,
  required,
  exactScope,
  validateCap07ScopeV1,
  validateCap07RequestEnvelopeV1,
  buildCap07RequestEnvelopeV1,
  phaseForOrder,
  phaseForLogicalTime,
  member,
  product,
  readJson,
  factId,
  receipt,
};
