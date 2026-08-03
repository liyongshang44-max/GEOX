'use strict';

const {
  digest,
  product,
  validateCap07RequestEnvelopeV1,
} = require('./shared_v1.cjs');

function contentHash(body) {
  return body.root_graph_content_hash
    ?? body.timeline_page_content_hash
    ?? body.trace_graph_content_hash
    ?? body.collection_page_content_hash
    ?? body.health_content_hash
    ?? digest(body);
}

function syncReadModel(shared, surface, item, nextCursor) {
  shared.readModel.set(surface, item);
  if (!shared.selector) return;
  shared.selector.read_model.surfaces = [...shared.readModel.values()].sort((a, b) => a.name.localeCompare(b.name));
  if (surface === 'timeline' && nextCursor === null) {
    shared.selector.read_model.timeline_pagination_until_cursor_null = true;
    shared.selector.read_model.timeline_complete = true;
  }
  if (surface === 'trace') shared.selector.read_model.trace_complete = true;
  shared.selector.read_model.product_read_write_delta = 0;
  shared.selector.read_model.canonical_fact_write_delta = 0;
  shared.selector.read_model.projection_write_delta = 0;
}

async function createCap07ReaderV1({ root, pool, shared }) {
  const mod = await product(root, 'apps/server/src/services/mcft_field_twin_read_api_v1.ts');
  const api = new mod.PostgresMcftFieldTwinReadApiV1(pool);
  const methods = {
    runtime: 'readRuntime',
    timeline: 'readTimeline',
    trace: 'readTrace',
    states: 'readStates',
    forecasts: 'readForecasts',
    scenarios: 'readScenarios',
    residuals: 'readResiduals',
    'action-lifecycle': 'readActionLifecycle',
    'model-governance': 'readModelGovernance',
    health: 'readHealth',
  };
  process.env.MCFT_CURSOR_SIGNING_KEYS_JSON = process.env.MCFT_CURSOR_SIGNING_KEYS_JSON
    || JSON.stringify({ 's6-final': '0123456789abcdef0123456789abcdef' });
  process.env.MCFT_CURSOR_PRIMARY_KEY_ID = process.env.MCFT_CURSOR_PRIMARY_KEY_ID || 's6-final';

  return {
    async request(envelope) {
      const request = validateCap07RequestEnvelopeV1(envelope);
      const method = methods[request.surface];
      if (!method) throw new Error(`CAP07_SURFACE:${request.surface}`);
      const before = Number((await pool.query('SELECT count(*)::int AS n FROM facts')).rows[0].n);
      const apiRequest = {
        scope: request.scope,
        cursor: request.cursor,
        limit: request.limit,
      };
      if (request.surface === 'model-governance') {
        apiRequest.collection_kind = request.collection_kind;
      }
      const body = await api[method].call(api, apiRequest);
      const after = Number((await pool.query('SELECT count(*)::int AS n FROM facts')).rows[0].n);
      if (before !== after) throw new Error(`CAP07_WRITE_DELTA:${request.surface}`);
      const item = {
        name: request.surface,
        status: 200,
        content_hash: contentHash(body),
        response_instance_hash: body.response_instance_hash ?? digest(body),
      };
      syncReadModel(shared, request.surface, item, body.next_cursor ?? null);
      return {
        status: 200,
        cache_control: 'private, no-store',
        content_hash: item.content_hash,
        response_hash: item.response_instance_hash,
        next_cursor: body.next_cursor ?? null,
        body,
      };
    },
  };
}

module.exports = { createCap07ReaderV1 };
