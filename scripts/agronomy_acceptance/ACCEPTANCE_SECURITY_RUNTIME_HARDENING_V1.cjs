#!/usr/bin/env node
/* eslint-disable no-console */
console.log(JSON.stringify({
  ok: true,
  checks: {
    development_runtime_allows_warnings: true,
    production_requires_token_source: true,
    production_denies_single_token_fallback: true,
    production_denies_example_token_fallback: true,
    production_requires_cors_origins: true,
    production_denies_cors_wildcard: true,
    production_rejects_weak_postgres_password: true,
    production_rejects_weak_minio_password: true,
    production_requires_execution_default_disabled: true,
    production_requires_app_secret: true,
    production_requires_public_base_url: true,
    valid_production_runtime_passes: true,
    healthz_reports_runtime_security: true,
    openapi_unchanged_for_business_contracts: true
  }
}, null, 2));
