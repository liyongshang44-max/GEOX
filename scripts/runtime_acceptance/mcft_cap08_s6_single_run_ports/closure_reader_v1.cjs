'use strict';

const assert = require('node:assert/strict');
const { isDeepStrictEqual } = require('node:util');

const FVO10_ID_V1 = 'FVO-10';
const FINAL_FORMAL_EVIDENCE_SOURCE_V1 = 'mcft_cap08_s6_final_formal_evidence_v1';
const S3_COMPLETION_EVIDENCE_SOURCE_V1 = 'mcft_cap08_s3_completion_evidence_v1';
const FVO10_CANONICAL_ALIAS_SOURCES_V1 = Object.freeze([
  FINAL_FORMAL_EVIDENCE_SOURCE_V1,
  S3_COMPLETION_EVIDENCE_SOURCE_V1,
]);

function normalizePayload(recordJson) {
  const payload = recordJson?.payload;
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
  const scope = payload.scope && typeof payload.scope === 'object' && !Array.isArray(payload.scope)
    ? payload.scope
    : {};
  if (payload.object_id) return { ...scope, ...payload };
  if (!payload.source_record_id) return null;
  return {
    ...scope,
    ...payload,
    object_id: payload.source_record_id,
    object_type: recordJson.type,
    determinism_hash: payload.source_record_hash,
    logical_time: payload.available_to_runtime_at ?? payload.logical_time,
    as_of: payload.available_to_runtime_at ?? payload.logical_time,
  };
}

function fvo10AliasComparableV1(object) {
  const comparable = structuredClone(object);
  delete comparable.closure_evidence_class;
  return comparable;
}

function canCoalesceFvo10CanonicalAliasV1(existing, row, object) {
  if (object.object_id !== FVO10_ID_V1 || existing.object.object_id !== FVO10_ID_V1) {
    return false;
  }
  if (!FVO10_CANONICAL_ALIAS_SOURCES_V1.includes(existing.source)
    || !FVO10_CANONICAL_ALIAS_SOURCES_V1.includes(row.source)
    || existing.source === row.source
    || existing.sources.has(row.source)) {
    return false;
  }
  const sources = new Set([...existing.sources, row.source]);
  if (sources.size !== 2
    || !FVO10_CANONICAL_ALIAS_SOURCES_V1.every(source => sources.has(source))) {
    return false;
  }
  return isDeepStrictEqual(
    fvo10AliasComparableV1(existing.object),
    fvo10AliasComparableV1(object),
  );
}

function createClosureReaderV1({ pool }) {
  return {
    async query(_sql, params) {
      const refs = params?.[0];
      assert.ok(Array.isArray(refs), 'EXACT_REF_ARRAY_REQUIRED');
      const result = await pool.query(
        `SELECT fact_id,source,record_json FROM facts
          WHERE (record_json->'payload'->>'object_id'=ANY($1::text[])
             OR record_json->'payload'->>'source_record_id'=ANY($1::text[]))
          ORDER BY fact_id`,
        [refs],
      );
      const byRef = new Map();
      for (const row of result.rows) {
        const object = normalizePayload(row.record_json);
        if (!object || !refs.includes(object.object_id)) continue;
        const existing = byRef.get(object.object_id);
        if (!existing) {
          byRef.set(object.object_id, {
            fact_id: row.fact_id,
            source: row.source,
            object,
            sources: new Set([row.source]),
          });
          continue;
        }
        if (!canCoalesceFvo10CanonicalAliasV1(existing, row, object)) {
          throw new Error(`CLOSURE_REF_DUPLICATE:${object.object_id}`);
        }
        existing.sources.add(row.source);
        if (row.source === S3_COMPLETION_EVIDENCE_SOURCE_V1) {
          existing.fact_id = row.fact_id;
          existing.source = row.source;
          existing.object = object;
        }
      }
      return {
        rows: refs.map(ref => {
          const value = byRef.get(ref);
          return value
            ? { fact_id: value.fact_id, source: value.source, object: value.object }
            : undefined;
        }).filter(Boolean),
      };
    },
  };
}

module.exports = {
  FVO10_ID_V1,
  FINAL_FORMAL_EVIDENCE_SOURCE_V1,
  S3_COMPLETION_EVIDENCE_SOURCE_V1,
  FVO10_CANONICAL_ALIAS_SOURCES_V1,
  fvo10AliasComparableV1,
  canCoalesceFvo10CanonicalAliasV1,
  createClosureReaderV1,
};
