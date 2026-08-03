'use strict';

const assert = require('node:assert/strict');
const { validateExactPathAuthorityV1 } = require('../mcft_cap08_s6_single_run_workflow/execution_authority_gate_v1.cjs');
const {
  buildCap07RequestEnvelopeV1,
} = require('../mcft_cap08_s6_single_run_ports/shared_v1.cjs');

const SURFACES = [
  { name: 'runtime', paginated: false },
  { name: 'timeline', paginated: true },
  { name: 'trace', paginated: false },
  { name: 'states', paginated: true },
  { name: 'forecasts', paginated: true },
  { name: 'scenarios', paginated: true },
  { name: 'residuals', paginated: true },
  { name: 'action-lifecycle', paginated: true },
  { name: 'model-governance', paginated: true, variants: ['CALIBRATION_CANDIDATE', 'SHADOW_EVALUATION'] },
  { name: 'health', paginated: false },
];

async function fetchVariantV1(request, spec, surface, variant = null) {
  const pages = [];
  let cursor = null;
  do {
    const envelope = buildCap07RequestEnvelopeV1({
      scope: spec.scope,
      surface: surface.name,
      collectionKind: variant,
      cursor,
      limit: 10,
    });
    const response = await request(envelope);
    assert.equal(response.status, 200, `CAP07_STATUS:${surface.name}`);
    assert.equal(response.cache_control, 'private, no-store');
    assert.match(response.content_hash, /^sha256:[0-9a-f]{64}$/);
    assert.match(response.response_hash, /^sha256:[0-9a-f]{64}$/);
    pages.push(response);
    cursor = surface.paginated ? (response.next_cursor ?? null) : null;
    assert.ok(pages.length <= 1000, 'CAP07_PAGINATION_LOOP');
  } while (cursor !== null);
  return pages;
}

async function executeCompleteCap07ReadbackV1(port, spec, authority) {
  validateExactPathAuthorityV1(authority, {
    exactSubjectSha: spec.exact_subject_sha,
    runLabel: spec.run_label,
    operationalRunInstanceId: spec.operational_run_instance_id,
  });
  const surfaces = [];
  for (const surface of SURFACES) {
    const variants = surface.variants ?? [null];
    for (const variant of variants) {
      surfaces.push({
        name: surface.name,
        variant,
        pages: await fetchVariantV1(port.request.bind(port), spec, surface, variant),
      });
    }
  }
  return {
    schema_version: 'geox_mcft_cap08_s6_cap07_complete_readback_result_v1',
    surface_definition_count: 10,
    request_variant_count: 11,
    surfaces,
    pagination_until_cursor_null: true,
    product_read_write_delta: 0,
    canonical_fact_write_delta: 0,
    projection_write_delta: 0,
  };
}

module.exports = { SURFACES, fetchVariantV1, executeCompleteCap07ReadbackV1 };
