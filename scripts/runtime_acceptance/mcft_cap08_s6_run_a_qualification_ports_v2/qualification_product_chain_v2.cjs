'use strict';

const assert = require('node:assert/strict');

const S4_AUTHORITY_SCHEMA =
  'geox_mcft_cap08_s4_append_forward_authority_v1';
const S4_AUTHORITY_KIND = 'REALITY_BINDING';

function jsonObject(value, code) {
  const parsed = typeof value === 'string' ? JSON.parse(value) : value;
  assert.ok(parsed && typeof parsed === 'object' && !Array.isArray(parsed), code);
  return parsed;
}

function exactScope(actual, expected, code) {
  for (const field of [
    'tenant_id',
    'project_id',
    'group_id',
    'field_id',
    'season_id',
    'zone_id',
  ]) {
    assert.equal(actual[field], expected[field], `${code}:${field}`);
  }
}

function isFinalEvidenceForecastQuery(text, values) {
  return typeof text === 'string'
    && text.includes("record_json->>'type'='twin_forecast_run_v1'")
    && text.includes("record_json->'payload'->'payload'->>'issued_at'=$7")
    && Array.isArray(values)
    && values.length === 7;
}

async function selectAuthorityBoundForecastV2({
  pool,
  result,
  values,
  formalRunId,
  scope,
}) {
  if (result.rows.length === 1) return result;
  const issuedAt = values[6];
  assert.equal(
    result.rows.length,
    2,
    `QUALIFICATION_V2_FORECAST_APPEND_FORWARD_CARDINALITY:${issuedAt}`,
  );

  const authorityResult = await pool.query(
    `SELECT determinism_hash,semantic_payload
       FROM twin_runtime_authority_snapshot_v1
      WHERE authority_kind=$1
        AND semantic_payload->>'schema_version'=$2
        AND semantic_payload->>'formal_run_id'=$3
        AND semantic_payload->'scope'->>'tenant_id'=$4
        AND semantic_payload->'scope'->>'project_id'=$5
        AND semantic_payload->'scope'->>'group_id'=$6
        AND semantic_payload->'scope'->>'field_id'=$7
        AND semantic_payload->'scope'->>'season_id'=$8
        AND semantic_payload->'scope'->>'zone_id'=$9
        AND semantic_payload->>'correction_logical_time'=$10`,
    [
      S4_AUTHORITY_KIND,
      S4_AUTHORITY_SCHEMA,
      formalRunId,
      scope.tenant_id,
      scope.project_id,
      scope.group_id,
      scope.field_id,
      scope.season_id,
      scope.zone_id,
      issuedAt,
    ],
  );
  assert.equal(
    authorityResult.rows.length,
    1,
    `QUALIFICATION_V2_S4_AUTHORITY_CARDINALITY:${issuedAt}`,
  );

  const authority = jsonObject(
    authorityResult.rows[0].semantic_payload,
    'QUALIFICATION_V2_S4_AUTHORITY_INVALID',
  );
  assert.equal(authority.determinism_hash, authorityResult.rows[0].determinism_hash);
  assert.equal(authority.schema_version, S4_AUTHORITY_SCHEMA);
  assert.equal(authority.authority_kind, S4_AUTHORITY_KIND);
  assert.equal(authority.formal_run_id, formalRunId);
  assert.equal(authority.correction_logical_time, issuedAt);
  exactScope(authority.scope, scope, 'QUALIFICATION_V2_S4_AUTHORITY_SCOPE');

  const corrected = jsonObject(
    authority.corrected_objects?.forecast,
    'QUALIFICATION_V2_CORRECTED_FORECAST_BINDING_REQUIRED',
  );
  const base = jsonObject(
    authority.identity_input?.base_t16_forecast,
    'QUALIFICATION_V2_BASE_FORECAST_BINDING_REQUIRED',
  );
  assert.equal(
    authority.t17_predecessor?.previous_forecast_result_ref,
    corrected.ref,
    'QUALIFICATION_V2_T17_CORRECTED_FORECAST_REF',
  );
  assert.equal(
    authority.t17_predecessor?.previous_forecast_result_hash,
    corrected.hash,
    'QUALIFICATION_V2_T17_CORRECTED_FORECAST_HASH',
  );

  const correctedRows = result.rows.filter(
    (row) => row.object?.object_id === corrected.ref
      && row.object?.determinism_hash === corrected.hash,
  );
  const baseRows = result.rows.filter(
    (row) => row.object?.object_id === base.ref
      && row.object?.determinism_hash === base.hash,
  );
  assert.equal(
    correctedRows.length,
    1,
    `QUALIFICATION_V2_CORRECTED_FORECAST_BINDING_MISMATCH:${issuedAt}`,
  );
  assert.equal(
    baseRows.length,
    1,
    `QUALIFICATION_V2_BASE_FORECAST_BINDING_MISMATCH:${issuedAt}`,
  );
  assert.notEqual(
    corrected.ref,
    base.ref,
    'QUALIFICATION_V2_APPEND_FORWARD_FORECAST_REF_MUST_ADVANCE',
  );

  return {
    ...result,
    rows: correctedRows,
    rowCount: 1,
  };
}

function createAuthorityAwarePoolV2(pool, formalRunId, scope) {
  assert.ok(pool && typeof pool.query === 'function', 'QUALIFICATION_V2_POOL_REQUIRED');
  return new Proxy(pool, {
    get(target, property, receiver) {
      if (property !== 'query') {
        const value = Reflect.get(target, property, receiver);
        return typeof value === 'function' ? value.bind(target) : value;
      }
      return (...args) => {
        const query = args[0];
        const text = typeof query === 'string' ? query : query?.text;
        const values = typeof query === 'string' ? args[1] : query?.values;
        if (!isFinalEvidenceForecastQuery(text, values)) {
          return target.query(...args);
        }
        assert.notEqual(
          typeof args.at(-1),
          'function',
          'QUALIFICATION_V2_CALLBACK_FORECAST_QUERY_FORBIDDEN',
        );
        return target.query(...args).then((result) =>
          selectAuthorityBoundForecastV2({
            pool: target,
            result,
            values,
            formalRunId,
            scope,
          }));
      };
    },
  });
}

function bindResolverRepositorySeamV2(product) {
  const ProductService = product.Cap08S4AppendForwardServiceV1;
  assert.equal(
    typeof ProductService,
    'function',
    'QUALIFICATION_V2_S4_SERVICE_REQUIRED',
  );
  product.Cap08S4AppendForwardServiceV1 =
    class QualificationV2Cap08S4AppendForwardServiceV1 extends ProductService {
      constructor(pool, evidenceSource) {
        super(pool, evidenceSource);
        assert.ok(
          Object.prototype.hasOwnProperty.call(this, 'repository'),
          'QUALIFICATION_V2_S4_REPOSITORY_SEAM_REQUIRED',
        );
        assert.ok(
          Object.prototype.hasOwnProperty.call(this, 'resolver'),
          'QUALIFICATION_V2_S4_RESOLVER_SEAM_REQUIRED',
        );
        assert.ok(
          this.resolver && typeof this.resolver === 'object',
          'QUALIFICATION_V2_S4_RESOLVER_OBJECT_REQUIRED',
        );
        assert.ok(
          Object.prototype.hasOwnProperty.call(this.resolver, 'repository'),
          'QUALIFICATION_V2_S4_RESOLVER_REPOSITORY_SEAM_REQUIRED',
        );
        this.resolver.repository = this.repository;
      }
    };
  return product;
}

let capturedRunProductChainV1 = null;

function resolveRunProductChainV2() {
  if (capturedRunProductChainV1) return capturedRunProductChainV1;
  const loaderPath = require.resolve(
    '../mcft_cap08_s6_single_run_ports/product_loader_v1.cjs',
  );
  const chainPath = require.resolve(
    '../mcft_cap08_s6_single_run_ports/product_chain_v1.cjs',
  );
  const loaderModule = require(loaderPath);
  const originalLoadProduct = loaderModule.loadProduct;
  assert.equal(
    typeof originalLoadProduct,
    'function',
    'QUALIFICATION_V2_ORIGINAL_PRODUCT_LOADER_REQUIRED',
  );
  let chainModule;
  try {
    loaderModule.loadProduct = async (root) =>
      bindResolverRepositorySeamV2(await originalLoadProduct(root));
    delete require.cache[chainPath];
    chainModule = require(chainPath);
  } finally {
    loaderModule.loadProduct = originalLoadProduct;
  }
  assert.equal(
    typeof chainModule?.runProductChainV1,
    'function',
    'QUALIFICATION_V2_PRODUCT_CHAIN_REQUIRED',
  );
  capturedRunProductChainV1 = chainModule.runProductChainV1;
  return capturedRunProductChainV1;
}

async function runProductChainV2(input) {
  const pool = createAuthorityAwarePoolV2(
    input.pool,
    input.spec.formal_run_id,
    input.spec.scope,
  );
  return resolveRunProductChainV2()({ ...input, pool });
}

module.exports = {
  bindResolverRepositorySeamV2,
  createAuthorityAwarePoolV2,
  selectAuthorityBoundForecastV2,
  resolveRunProductChainV2,
  runProductChainV2,
};
