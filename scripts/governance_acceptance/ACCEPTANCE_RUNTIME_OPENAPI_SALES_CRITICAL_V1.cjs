#!/usr/bin/env node
'use strict';

// This gate requires a running GEOX server.
// It is intended to run inside the acceptance runtime after /api/health is ready.
const BASE_URL = process.env.BASE_URL || process.env.API_BASE_URL || 'http://127.0.0.1:3001';
const OPENAPI_PATH = '/api/v1/openapi.json';

const SALES_CRITICAL_PATHS = [
  '/api/v1/customer/reports',
  '/api/v1/customer/fields',
  '/api/v1/customer/operations',
  '/api/v1/reports/operation/{operation_id}',
  '/api/v1/reports/field/{field_id}',
  '/api/v1/actions/task',
  '/api/v1/actions/receipt',
  '/api/v1/actions/execute',
  '/api/v1/sense/task',
  '/api/v1/sense/receipt',
  '/api/v1/acceptance/evaluate',
  '/api/v1/evidence-export/jobs',
  '/api/v1/inspection/pest-disease/{inspection_id}',
  '/api/v1/devices/{device_id}/status',
  '/api/v1/fail-safe/events',
  '/api/v1/manual-takeovers',
];

const REQUIRED_GLOBAL_SCHEMAS = [
  'OperationReportV1',
  'ActionTaskRequest',
  'ActionTaskResponse',
  'SenseTaskRequest',
  'SenseReceiptResponse',
  'DeviceStatusResponseV1',
  'PestDiseaseInspectionDetailResponseV1',
];

const WRITE_METHODS = new Set(['post', 'put', 'patch']);
const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options', 'trace'];
const GOVERNANCE_FIELDS = ['owner', 'audience', 'boundary', 'auth_scope', 'error_model', 'contract_ref', 'gate_maturity'];

function fail(message) {
  console.error(`[runtime-openapi-sales-critical-v1] FAIL: ${message}`);
  process.exit(1);
}

function must(condition, message) {
  if (!condition) fail(message);
}

function resolveRefSchemaName(ref) {
  if (typeof ref !== 'string') return '';
  const prefix = '#/components/schemas/';
  if (!ref.startsWith(prefix)) return '';
  return ref.slice(prefix.length);
}

function mustSchemaRefExists(schema, context, schemas) {
  must(schema && typeof schema === 'object', `${context} missing schema`);
  if (schema.$ref) {
    const schemaName = resolveRefSchemaName(schema.$ref);
    must(schemaName, `${context} has non-components schema ref ${String(schema.$ref)}`);
    must(schemas[schemaName], `${context} references missing schema ${schemaName}`);
  }
}

(async () => {
  const url = `${BASE_URL}${OPENAPI_PATH}`;
  const response = await fetch(url, { method: 'GET' }).catch((error) => {
    fail(`request failed for ${url}: ${error?.message || String(error)}`);
  });

  must(response && response.ok, `GET ${url} returned ${response?.status ?? 'unknown'} ${response?.statusText ?? ''}`);

  let spec;
  try {
    spec = await response.json();
  } catch (error) {
    fail(`invalid JSON from ${url}: ${error?.message || String(error)}`);
  }

  must(spec?.openapi === '3.0.3', `spec.openapi expected 3.0.3 got ${String(spec?.openapi)}`);
  must(spec?.paths && typeof spec.paths === 'object', 'spec.paths missing or invalid');
  must(spec?.components?.schemas && typeof spec.components.schemas === 'object', 'spec.components.schemas missing or invalid');

  for (const pathKey of SALES_CRITICAL_PATHS) {
    must(spec.paths[pathKey], `missing sales-critical path ${pathKey}`);
  }
  for (const schemaName of REQUIRED_GLOBAL_SCHEMAS) {
    must(spec.components.schemas[schemaName], `missing sales-critical schema ${schemaName}`);
  }

  for (const pathKey of SALES_CRITICAL_PATHS) {
    const pathItem = spec.paths[pathKey] || {};
    const operations = HTTP_METHODS.filter((method) => {
      const op = pathItem[method];
      return op && typeof op === 'object';
    });
    must(operations.length > 0, `${pathKey} has no OpenAPI operation`);
    for (const method of operations) {
      const operation = pathItem[method];

      must(operation.operationId, `${method.toUpperCase()} ${pathKey} missing operationId`);
      must(Array.isArray(operation.security) && operation.security.length > 0, `${method.toUpperCase()} ${pathKey} missing security`);
      if (WRITE_METHODS.has(method)) {
        const requestSchema = operation.requestBody?.content?.['application/json']?.schema;
        must(requestSchema, `${method.toUpperCase()} ${pathKey} missing JSON requestBody schema`);
        mustSchemaRefExists(
          requestSchema,
          `${method.toUpperCase()} ${pathKey} requestBody`,
          spec.components.schemas,
        );
      }
      const responseSchema = operation.responses?.['200']?.content?.['application/json']?.schema;
      must(responseSchema, `${method.toUpperCase()} ${pathKey} missing 200 JSON response schema`);
      mustSchemaRefExists(
        responseSchema,
        `${method.toUpperCase()} ${pathKey} response 200`,
        spec.components.schemas,
      );

      const governance = operation['x-geox-governance'];
      must(governance && typeof governance === 'object', `${method.toUpperCase()} ${pathKey} missing x-geox-governance`);
      for (const field of GOVERNANCE_FIELDS) {
        must(governance[field], `${method.toUpperCase()} ${pathKey} governance missing ${field}`);
      }
    }
  }

  console.log(`[runtime-openapi-sales-critical-v1] PASS ${url}`);
})();
