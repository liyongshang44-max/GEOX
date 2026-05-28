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

const errors = [];
function check(condition, message) {
  if (!condition) errors.push(message);
}

function resolveRefSchemaName(ref) {
  if (typeof ref !== 'string') return '';
  const prefix = '#/components/schemas/';
  if (!ref.startsWith(prefix)) return '';
  return ref.slice(prefix.length);
}

function mustSchemaRefExists(schema, context, schemas) {
  check(schema && typeof schema === 'object', `${context} missing schema`);
  if (!schema || typeof schema !== 'object') return;
  if (schema.$ref) {
    const schemaName = resolveRefSchemaName(schema.$ref);
    check(schemaName, `${context} has non-components schema ref ${String(schema.$ref)}`);
    if (schemaName) check(schemas[schemaName], `${context} references missing schema ${schemaName}`);
  }
}

(async () => {
  const url = `${BASE_URL}${OPENAPI_PATH}`;
  const response = await fetch(url, { method: 'GET' }).catch((error) => {
    console.error(`[runtime-openapi-sales-critical-v1] FAIL`);
    console.error(`- request failed for ${url}: ${error?.message || String(error)}`);
    process.exit(1);
  });

  check(response && response.ok, `GET ${url} returned ${response?.status ?? 'unknown'} ${response?.statusText ?? ''}`);
  if (!response || !response.ok) {
    console.error(`[runtime-openapi-sales-critical-v1] FAIL`);
    for (const error of errors) console.error(`- ${error}`);
    process.exit(1);
  }

  let spec;
  try {
    spec = await response.json();
  } catch (error) {
    console.error(`[runtime-openapi-sales-critical-v1] FAIL`);
    console.error(`- invalid JSON from ${url}: ${error?.message || String(error)}`);
    process.exit(1);
  }

  check(spec?.openapi === '3.0.3', `spec.openapi expected 3.0.3 got ${String(spec?.openapi)}`);
  check(spec?.paths && typeof spec.paths === 'object', 'spec.paths missing or invalid');
  check(spec?.components?.schemas && typeof spec.components.schemas === 'object', 'spec.components.schemas missing or invalid');
  if (!spec?.paths || !spec?.components?.schemas) {
    console.error(`[runtime-openapi-sales-critical-v1] FAIL`);
    for (const error of errors) console.error(`- ${error}`);
    process.exit(1);
  }

  for (const pathKey of SALES_CRITICAL_PATHS) {
    check(spec.paths[pathKey], `missing sales-critical path ${pathKey}`);
  }
  for (const schemaName of REQUIRED_GLOBAL_SCHEMAS) {
    check(spec.components.schemas[schemaName], `missing sales-critical schema ${schemaName}`);
  }

  const operationIds = new Set();
  for (const pathKey of SALES_CRITICAL_PATHS) {
    const pathItem = spec.paths[pathKey] || {};
    const operations = HTTP_METHODS.filter((method) => {
      const op = pathItem[method];
      return op && typeof op === 'object';
    });
    check(operations.length > 0, `${pathKey} has no OpenAPI operation`);
    for (const method of operations) {
      const operation = pathItem[method];
      const opLabel = `${method.toUpperCase()} ${pathKey}`;

      check(operation.operationId, `${opLabel} missing operationId`);
      if (operation.operationId) {
        check(!operationIds.has(operation.operationId), `${opLabel} duplicate operationId ${operation.operationId}`);
        operationIds.add(operation.operationId);
      }
      check(Array.isArray(operation.security) && operation.security.length > 0, `${opLabel} missing security`);
      if (WRITE_METHODS.has(method)) {
        const requestSchema = operation.requestBody?.content?.['application/json']?.schema;
        check(requestSchema, `${opLabel} missing JSON requestBody schema`);
        mustSchemaRefExists(
          requestSchema,
          `${opLabel} requestBody`,
          spec.components.schemas,
        );
      }
      const responseSchema = operation.responses?.['200']?.content?.['application/json']?.schema;
      check(responseSchema, `${opLabel} missing 200 JSON response schema`);
      mustSchemaRefExists(
        responseSchema,
        `${opLabel} response 200`,
        spec.components.schemas,
      );

      const governance = operation['x-geox-governance'];
      check(governance && typeof governance === 'object', `${opLabel} missing x-geox-governance`);
      for (const field of GOVERNANCE_FIELDS) {
        check(governance?.[field], `${opLabel} governance missing ${field}`);
      }
    }
  }
  if (errors.length > 0) {
    console.error(`[runtime-openapi-sales-critical-v1] FAIL`);
    for (const error of errors) console.error(`- ${error}`);
    process.exit(1);
  }

  console.log(`[runtime-openapi-sales-critical-v1] PASS ${url}`);
})();
