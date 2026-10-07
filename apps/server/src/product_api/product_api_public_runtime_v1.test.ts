import test from "node:test";
import assert from "node:assert/strict";

import {
  createProductApiPublicAppV1,
  resolveProductApiPublicRuntimeConfigV1,
} from "./product_api_public_runtime_v1.js";

const KEYS = [
  "GEOX_PRODUCT_DATABASE_URL",
  "GEOX_PRODUCT_MCFT_DATABASE_URL",
  "GEOX_PRODUCT_API_TOKENS_JSON",
  "GEOX_PRODUCT_ALLOWED_ORIGINS",
  "GEOX_RUNTIME_ENV",
  "GEOX_TOKENS_JSON",
  "GEOX_TOKENS_FILE",
  "GEOX_TOKEN_SSOT_PATH",
  "GEOX_TOKEN",
  "GEOX_AO_ACT_TOKEN",
  "AO_ACT_TOKEN",
  "PORT",
] as const;

function withEnv<T>(values: Record<string, string | undefined>, fn: () => Promise<T> | T): Promise<T> {
  const before = Object.fromEntries(KEYS.map((key) => [key, process.env[key]]));
  for (const key of KEYS) delete process.env[key];
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined) process.env[key] = value;
  }
  return Promise.resolve(fn()).finally(() => {
    for (const key of KEYS) {
      const value = before[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
}

function tokenSource(role = "client", token = "product-test-token-0123456789abcdef0123456789abcdef") {
  return JSON.stringify({
    version: "ao_act_tokens_v0",
    tokens: [{
      token,
      token_id: "tok-product-public-v1",
      actor_id: "sites-product-consumer-v1",
      tenant_id: "tenantA",
      project_id: "projectA",
      group_id: "groupA",
      scopes: [],
      revoked: false,
      role,
      allowed_field_ids: ["field-a"],
    }],
  });
}

const BASE_ENV = {
  GEOX_PRODUCT_DATABASE_URL:
    "postgresql://geox_product_readonly_v1:strong-product-db-password@db.example.invalid/geox?sslmode=require",
  GEOX_PRODUCT_API_TOKENS_JSON: tokenSource(),
  GEOX_PRODUCT_ALLOWED_ORIGINS: "https://geox-customer-portal-test.example.invalid",
  PORT: "3000",
};

test("public Product runtime accepts only product-specific scoped configuration", async () => {
  await withEnv(BASE_ENV, () => {
    const config = resolveProductApiPublicRuntimeConfigV1();
    assert.equal(config.port, 3000);
    assert.equal(config.allowedOrigins.length, 1);
    assert.match(config.databaseUrl, /geox_product_readonly_v1/);
    assert.match(config.tokenSourceJson, /"role":"client"/);
  });
});

test("public Product runtime rejects known MCFT/runtime writer database roles", async () => {
  await withEnv({
    ...BASE_ENV,
    GEOX_PRODUCT_DATABASE_URL:
      "postgresql://geox_mcft_cap09_twin_runtime_login_v1:strong-product-db-password@db.example.invalid/geox?sslmode=require",
  }, () => {
    assert.throws(
      () => resolveProductApiPublicRuntimeConfigV1(),
      /PRODUCT_API_DATABASE_WRITER_ROLE_FORBIDDEN/,
    );
  });
});

test("public Product runtime rejects broad non-client token roles", async () => {
  await withEnv({
    ...BASE_ENV,
    GEOX_PRODUCT_API_TOKENS_JSON: tokenSource("admin"),
  }, () => {
    assert.throws(
      () => resolveProductApiPublicRuntimeConfigV1(),
      /ROLE_MUST_BE_CLIENT/,
    );
  });
});

test("public Product runtime rejects wildcard or non-HTTPS browser origins", async () => {
  await withEnv({
    ...BASE_ENV,
    GEOX_PRODUCT_ALLOWED_ORIGINS: "*",
  }, () => {
    assert.throws(
      () => resolveProductApiPublicRuntimeConfigV1(),
      /PRODUCT_API_CORS_WILDCARD_FORBIDDEN/,
    );
  });

  await withEnv({
    ...BASE_ENV,
    GEOX_PRODUCT_ALLOWED_ORIGINS: "http://example.invalid",
  }, () => {
    assert.throws(
      () => resolveProductApiPublicRuntimeConfigV1(),
      /PRODUCT_API_CORS_HTTPS_REQUIRED/,
    );
  });
});

test("isolated public Product app exposes health but no legacy/admin surface", async () => {
  await withEnv(BASE_ENV, async () => {
    const config = resolveProductApiPublicRuntimeConfigV1();
    const { app, pool } = createProductApiPublicAppV1(config);
    try {
      await app.ready();

      const health = await app.inject({ method: "GET", url: "/health" });
      assert.equal(health.statusCode, 200);
      const body = health.json();
      assert.equal(body.service, "GEOX_PRODUCT_API_PUBLIC");
      assert.equal(body.authority_ceiling, "NON_AUTHORITATIVE_PRODUCT_PROJECTION_ONLY");

      for (const path of [
        "/api/v1/customer/fields",
        "/api/v1/reports/customer-dashboard/aggregate",
        "/api/admin/healthz",
        "/api/operator/twin/runtime",
      ]) {
        const response = await app.inject({ method: "GET", url: path });
        assert.equal(response.statusCode, 404, path);
      }

      const unauthenticated = await app.inject({ method: "GET", url: "/api/product/v1/fields" });
      assert.equal(unauthenticated.statusCode, 401);
    } finally {
      await app.close();
    }
  });
});

const MCFT_URL = "postgresql://geox_product_readonly_v1:test-password@db.example.invalid/geox_mcft_cap09_s6_formal_t4r1_24h_v5?sslmode=require";

test("optional MCFT connection is validated separately without replacing identity connection", async () => {
  await withEnv({...BASE_ENV, GEOX_PRODUCT_MCFT_DATABASE_URL: MCFT_URL}, () => {
    const config = resolveProductApiPublicRuntimeConfigV1();
    assert.equal(config.databaseUrl, BASE_ENV.GEOX_PRODUCT_DATABASE_URL);
    assert.equal(config.mcftDatabaseUrl, MCFT_URL);
  });
  await withEnv({...BASE_ENV, GEOX_PRODUCT_MCFT_DATABASE_URL: MCFT_URL.replace("geox_product_readonly_v1", "geox_mcft_cap09_twin_runtime_login_v1")}, () => {
    assert.throws(() => resolveProductApiPublicRuntimeConfigV1(), /WRITER_ROLE_FORBIDDEN/);
  });
});

test("readiness checks both stores and fails when the configured MCFT store cannot connect", async () => {
  await withEnv({...BASE_ENV, GEOX_PRODUCT_MCFT_DATABASE_URL: MCFT_URL}, async () => {
    const {app, pool, mcftPool} = createProductApiPublicAppV1(resolveProductApiPublicRuntimeConfigV1());
    assert.notEqual(pool, mcftPool);
    (pool as any).query = async () => ({rows: [{transaction_read_only: "on"}]});
    (mcftPool as any).query = async () => {throw new Error("TEST_MCFT_OFFLINE");};
    try {
      assert.equal((await app.inject({method: "GET", url: "/ready"})).statusCode, 503);
      (mcftPool as any).query = async (sql: string, params: any[]) => sql.includes("to_regclass")
        ? {rows: params[0].map((name: string) => ({name, present: true, can_select: true}))}
        : {rows: [{transaction_read_only: "on"}]};
      const ready = await app.inject({method: "GET", url: "/ready"});
      assert.equal(ready.statusCode, 200);
      assert.equal(ready.json().mcft_database_connectivity, "READY");
      assert.equal(ready.json().mcft_session_default_read_only, true);
      (mcftPool as any).query = async (sql: string, params: any[]) => sql.includes("to_regclass")
        ? {rows: params[0].map((name: string) => ({name, present: !name.includes("visibility"), can_select: true}))}
        : {rows: [{transaction_read_only: "on"}]};
      const incompatible = await app.inject({method: "GET", url: "/ready"});
      assert.equal(incompatible.statusCode, 503);
      assert.equal(incompatible.json().error, "MCFT_READ_STORE_NOT_READY");
    } finally {await app.close();}
  });
});
