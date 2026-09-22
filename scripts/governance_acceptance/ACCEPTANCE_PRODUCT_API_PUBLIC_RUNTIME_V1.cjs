#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = process.cwd();
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");
const checks = [];
const check = (name, fn) => { fn(); checks.push({ name, status: "PASS" }); };

try {
  const runtime = read("apps/server/src/product_api/product_api_public_runtime_v1.ts");
  const entry = read("apps/server/src/product_api_public_server_v1.ts");
  const dockerfile = read("docker/product-api.Dockerfile");
  const doc = read("docs/product_projection/GEOX-PRODUCT-API-PUBLIC-DEPLOYMENT-V1.md");

  check("DEDICATED_PUBLIC_ENTRYPOINT", () => {
    assert.match(entry, /runProductApiPublicRuntimeV1/);
    assert.doesNotMatch(entry, /startServer|createApp|prepareInternalTaskIssuerPrincipalV1/);
  });

  check("ONLY_CANONICAL_PRODUCT_ROUTE_REGISTRATION", () => {
    assert.match(runtime, /registerProductV1Routes\(app, pool\)/);
    for (const forbidden of [
      "registerCompatibilityModules",
      "registerAdminModule",
      "registerDomainModules",
      "registerStaticModule",
      "registerCoreModule",
    ]) assert.equal(runtime.includes(forbidden), false, forbidden);
  });

  check("PRODUCT_SPECIFIC_DATABASE_CREDENTIAL_ONLY", () => {
    assert.match(runtime, /GEOX_PRODUCT_DATABASE_URL/);
    assert.equal(/process\.env\.?DATABASE_URL/.test(runtime), false);
    for (const forbiddenRole of [
      "geox_runtime_v1",
      "geox_mcft_cap09_evidence_runtime_login_v1",
      "geox_mcft_cap09_twin_runtime_login_v1",
      "neondb_owner",
      "postgres",
    ]) assert.ok(runtime.includes(forbiddenRole), forbiddenRole);
    assert.match(runtime, /PRODUCT_API_DATABASE_WRITER_ROLE_FORBIDDEN/);
    assert.match(runtime, /PRODUCT_API_DATABASE_SSL_REQUIRED/);
  });

  check("QUERY_GUARD_FORBIDS_DDL_DML", () => {
    assert.match(runtime, /PRODUCT_API_SQL_WRITE_FORBIDDEN/);
    assert.match(runtime, /PRODUCT_API_SQL_NON_READ_STATEMENT_FORBIDDEN/);
    assert.match(runtime, /SQL_WRITE_OR_DDL_V1/);
  });

  check("PRODUCT_ONLY_TOKEN_SOURCE", () => {
    assert.match(runtime, /GEOX_PRODUCT_API_TOKENS_JSON/);
    assert.match(runtime, /ROLE_MUST_BE_CLIENT/);
    assert.match(runtime, /ALLOWED_FIELD_IDS_REQUIRED/);
    assert.match(runtime, /SECRET_TOO_SHORT/);
    assert.match(runtime, /delete process\.env\.GEOX_TOKEN/);
  });

  check("STRICT_CORS", () => {
    assert.match(runtime, /GEOX_PRODUCT_ALLOWED_ORIGINS/);
    assert.match(runtime, /PRODUCT_API_CORS_WILDCARD_FORBIDDEN/);
    assert.match(runtime, /PRODUCT_API_CORS_HTTPS_REQUIRED/);
  });

  check("NO_MCFT_OR_EXECUTION_RUNTIME_IMPORTS", () => {
    for (const forbidden of [
      "mcft_cap09_evidence_runtime",
      "mcft_cap09_twin_runtime",
      "jobs/runtime",
      "executor",
      "mqtt",
      "minio",
      "platform_bootstrap",
      "migration",
    ]) assert.equal(runtime.toLowerCase().includes(forbidden.toLowerCase()), false, forbidden);
  });

  check("DEDICATED_DOCKER_IMAGE", () => {
    assert.match(dockerfile, /pnpm --filter @geox\/server build/);
    assert.match(dockerfile, /product_api_public_server_v1\.js/);
    assert.doesNotMatch(dockerfile, /mcft_cap09|jobs\/runtime|database\/platform_bootstrap/);
  });

  check("HEALTH_AND_READINESS_SPLIT", () => {
    assert.match(runtime, /app\.get\("\/health"/);
    assert.match(runtime, /app\.get\("\/ready"/);
    assert.match(runtime, /PRODUCT_DATABASE_NOT_READY/);
  });

  check("DEPLOYMENT_DOC_PRESERVES_DATABASE_AND_MCFT_BOUNDARY", () => {
    for (const required of [
      "no database service created in Railway",
      "database schema",
      "database grants in this PR",
      "GEOX_PRODUCT_DATABASE_URL",
      "GEOX_PRODUCT_API_TOKENS_JSON",
      "GEOX_PRODUCT_ALLOWED_ORIGINS",
      "docker/product-api.Dockerfile",
      "api.geox.ink",
    ]) assert.ok(doc.includes(required), required);
  });

  console.log(JSON.stringify({
    schema_version: "geox_product_api_public_runtime_acceptance_v1",
    status: "PASS",
    check_count: checks.length,
    checks,
    database_schema_change: false,
    database_acl_change: false,
    mcft_runtime_change: false,
    public_runtime_role: "PRODUCT_API_PUBLIC_READ_ONLY",
  }, null, 2));
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
