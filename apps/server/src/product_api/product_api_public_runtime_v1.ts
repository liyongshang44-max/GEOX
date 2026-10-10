// GEOX Product API Public Runtime V1
//
// Purpose: host only the canonical read-only /api/product/v1/* surface for external Product UI consumers.
// Boundary: no legacy routes, no admin routes, no command routes, no scheduler, no evidence runtime,
// no twin runtime ownership, no migrations, no DDL/DML, no MQTT, and no object-storage credentials.

import cors from "@fastify/cors";
import Fastify, { type FastifyInstance } from "fastify";
import { Pool } from "pg";

import { registerProductV1Routes } from "../routes/product_v1.js";

export const PRODUCT_API_PUBLIC_RUNTIME_SCHEMA_V1 =
  "geox.product-api.public-runtime.v1" as const;

const FORBIDDEN_DATABASE_ROLES_V1 = new Set([
  "postgres",
  "neondb_owner",
  "geox_runtime_v1",
  "geox_mcft_cap09_evidence_runtime_login_v1",
  "geox_mcft_cap09_twin_runtime_login_v1",
  "geox_mcft_cap09_evidence_runtime_v1",
  "geox_mcft_cap09_twin_runtime_v1",
]);

const SQL_WRITE_OR_DDL_V1 =
  /\b(?:INSERT|UPDATE|DELETE|MERGE|UPSERT|CREATE|ALTER|DROP|TRUNCATE|GRANT|REVOKE|COMMENT|COPY|VACUUM|ANALYZE|CLUSTER|REINDEX|REFRESH|CALL|DO|EXECUTE)\b/i;

function nonEmptyEnvV1(name: string): string {
  const value = String(process.env[name] ?? "").trim();
  if (!value) throw new Error(`PRODUCT_API_CONFIG_REQUIRED:${name}`);
  return value;
}

function parseAllowedOriginsV1(raw: string): string[] {
  return Array.from(new Set(
    raw.split(",").map((value) => value.trim()).filter(Boolean),
  ));
}

function parseProductTokenSourceV1(raw: string): string {
  let parsed: any;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("PRODUCT_API_TOKEN_SOURCE_INVALID_JSON");
  }

  if (parsed?.version !== "ao_act_tokens_v0" || !Array.isArray(parsed.tokens) || parsed.tokens.length < 1) {
    throw new Error("PRODUCT_API_TOKEN_SOURCE_INVALID");
  }

  for (const [index, token] of parsed.tokens.entries()) {
    const prefix = `PRODUCT_API_TOKEN_${index}`;
    if (String(token?.role ?? "") !== "client") {
      throw new Error(`${prefix}_ROLE_MUST_BE_CLIENT`);
    }
    if (token?.revoked === true) {
      throw new Error(`${prefix}_REVOKED_ENTRY_FORBIDDEN`);
    }
    if (String(token?.token ?? "").trim().length < 32) {
      throw new Error(`${prefix}_SECRET_TOO_SHORT`);
    }
    for (const key of ["token_id", "actor_id", "tenant_id", "project_id", "group_id"]) {
      if (!String(token?.[key] ?? "").trim()) {
        throw new Error(`${prefix}_${key.toUpperCase()}_REQUIRED`);
      }
    }
    if (!Array.isArray(token?.allowed_field_ids) || token.allowed_field_ids.length < 1) {
      throw new Error(`${prefix}_ALLOWED_FIELD_IDS_REQUIRED`);
    }
  }

  return raw;
}

function parseProductDatabaseUrlV1(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("PRODUCT_API_DATABASE_URL_INVALID");
  }

  if (!["postgres:", "postgresql:"].includes(url.protocol)) {
    throw new Error("PRODUCT_API_DATABASE_PROTOCOL_INVALID");
  }
  const username = decodeURIComponent(url.username || "").trim();
  if (!username) throw new Error("PRODUCT_API_DATABASE_USERNAME_REQUIRED");
  if (FORBIDDEN_DATABASE_ROLES_V1.has(username)) {
    throw new Error(`PRODUCT_API_DATABASE_WRITER_ROLE_FORBIDDEN:${username}`);
  }
  if (!url.password) throw new Error("PRODUCT_API_DATABASE_PASSWORD_REQUIRED");

  const sslMode = url.searchParams.get("sslmode");
  if (sslMode !== "require" && sslMode !== "verify-full") {
    throw new Error("PRODUCT_API_DATABASE_SSL_REQUIRED");
  }

  return url;
}

function queryTextV1(value: unknown): string {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && typeof (value as { text?: unknown }).text === "string") {
    return String((value as { text: string }).text);
  }
  return "";
}

function assertTopLevelReadQueryV1(sql: string): void {
  const normalized = sql
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/--[^\r\n]*/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized) throw new Error("PRODUCT_API_SQL_EMPTY");
  if (SQL_WRITE_OR_DDL_V1.test(normalized)) {
    throw new Error("PRODUCT_API_SQL_WRITE_FORBIDDEN");
  }
  if (!/^(SELECT|WITH|SHOW)\b/i.test(normalized)) {
    throw new Error("PRODUCT_API_SQL_NON_READ_STATEMENT_FORBIDDEN");
  }
}

export function createProductApiReadOnlyPoolV1(databaseUrl: string): Pool {
  parseProductDatabaseUrlV1(databaseUrl);
  const pool = new Pool({
    connectionString: databaseUrl,
    application_name: "geox-product-api-public-v1",
    max: Number(process.env.GEOX_PRODUCT_DB_POOL_MAX ?? "8"),
    idleTimeoutMillis: Number(process.env.GEOX_PRODUCT_DB_IDLE_TIMEOUT_MS ?? "30000"),
    connectionTimeoutMillis: Number(process.env.GEOX_PRODUCT_DB_CONNECT_TIMEOUT_MS ?? "10000"),
  });

  const rawQuery = pool.query.bind(pool) as (...args: any[]) => any;
  (pool as any).query = (...args: any[]) => {
    const sql = queryTextV1(args[0]);
    assertTopLevelReadQueryV1(sql);
    return rawQuery(...args);
  };

  return pool;
}

export type ProductApiPublicRuntimeConfigV1 = {
  host: string;
  port: number;
  databaseUrl: string;
  allowedOrigins: string[];
  tokenSourceJson: string;
};

export function resolveProductApiPublicRuntimeConfigV1(): ProductApiPublicRuntimeConfigV1 {
  const databaseUrl = nonEmptyEnvV1("GEOX_PRODUCT_DATABASE_URL");
  parseProductDatabaseUrlV1(databaseUrl);

  const tokenSourceJson = parseProductTokenSourceV1(
    nonEmptyEnvV1("GEOX_PRODUCT_API_TOKENS_JSON"),
  );

  const allowedOrigins = parseAllowedOriginsV1(
    nonEmptyEnvV1("GEOX_PRODUCT_ALLOWED_ORIGINS"),
  );
  if (allowedOrigins.includes("*")) {
    throw new Error("PRODUCT_API_CORS_WILDCARD_FORBIDDEN");
  }
  if (allowedOrigins.some((origin) => !/^https:\/\//i.test(origin))) {
    throw new Error("PRODUCT_API_CORS_HTTPS_REQUIRED");
  }

  const port = Number(process.env.PORT ?? "3000");
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error("PRODUCT_API_PORT_INVALID");
  }

  return {
    host: String(process.env.HOST ?? "0.0.0.0"),
    port,
    databaseUrl,
    allowedOrigins,
    tokenSourceJson,
  };
}

export function createProductApiPublicAppV1(
  config: ProductApiPublicRuntimeConfigV1,
): { app: FastifyInstance; pool: Pool } {
  // The existing auth module consumes GEOX_TOKENS_JSON. Public Product Runtime accepts only
  // the narrower GEOX_PRODUCT_API_TOKENS_JSON source and mirrors it in-process after validation.
  process.env.GEOX_RUNTIME_ENV = "production";
  process.env.GEOX_TOKENS_JSON = config.tokenSourceJson;
  delete process.env.GEOX_TOKENS_FILE;
  delete process.env.GEOX_TOKEN_SSOT_PATH;
  delete process.env.GEOX_TOKEN;
  delete process.env.GEOX_AO_ACT_TOKEN;
  delete process.env.AO_ACT_TOKEN;

  const app = Fastify({
    logger: true,
    bodyLimit: 1024 * 1024,
    trustProxy: true,
  });

  void app.register(cors, {
    credentials: false,
    origin(origin, callback) {
      // Server-to-server Sites calls normally have no browser Origin header.
      if (!origin) return callback(null, true);
      return callback(null, config.allowedOrigins.includes(origin) ? origin : false);
    },
  });

  const pool = createProductApiReadOnlyPoolV1(config.databaseUrl);

  app.get("/health", async () => ({
    ok: true,
    schema_version: PRODUCT_API_PUBLIC_RUNTIME_SCHEMA_V1,
    service: "GEOX_PRODUCT_API_PUBLIC",
    authority_ceiling: "NON_AUTHORITATIVE_PRODUCT_PROJECTION_ONLY",
  }));

  app.get("/ready", async (_request, reply) => {
    try {
      const result = await pool.query<{ transaction_read_only: string }>(
        "SELECT pg_catalog.current_setting('transaction_read_only') AS transaction_read_only",
      );
      return reply.code(200).send({
        ok: true,
        schema_version: PRODUCT_API_PUBLIC_RUNTIME_SCHEMA_V1,
        database_connectivity: "READY",
        session_default_read_only: result.rows[0]?.transaction_read_only === "on",
        authority_ceiling: "NON_AUTHORITATIVE_PRODUCT_PROJECTION_ONLY",
      });
    } catch (error) {
      app.log.error({ err: error }, "Product API database readiness failed");
      return reply.code(503).send({
        ok: false,
        schema_version: PRODUCT_API_PUBLIC_RUNTIME_SCHEMA_V1,
        error: "PRODUCT_DATABASE_NOT_READY",
      });
    }
  });

  registerProductV1Routes(app, pool);

  app.setNotFoundHandler((_request, reply) => {
    reply.code(404).send({
      schema_version: "geox.product-api.error.v1",
      error: "NOT_FOUND",
    });
  });

  return { app, pool };
}

export async function runProductApiPublicRuntimeV1(): Promise<void> {
  const config = resolveProductApiPublicRuntimeConfigV1();
  const { app, pool } = createProductApiPublicAppV1(config);

  let closing = false;
  const shutdown = async (signal: string) => {
    if (closing) return;
    closing = true;
    app.log.info({ signal }, "Product API public runtime shutting down");
    await app.close().catch(() => undefined);
    await pool.end().catch(() => undefined);
  };

  process.once("SIGTERM", () => void shutdown("SIGTERM"));
  process.once("SIGINT", () => void shutdown("SIGINT"));

  await app.listen({ host: config.host, port: config.port });
}
