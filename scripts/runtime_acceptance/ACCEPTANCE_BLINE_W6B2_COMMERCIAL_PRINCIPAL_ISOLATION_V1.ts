import fs from "node:fs";
import { Pool } from "pg";
import mqtt, { type MqttClient } from "mqtt";

const host = String(process.env.W6B2_DB_HOST ?? "127.0.0.1").trim();
const port = Number.parseInt(String(process.env.W6B2_DB_PORT ?? "5433"), 10);
const database = String(process.env.POSTGRES_DB ?? "landos").trim();
const telemetryDbPassword = secret("GEOX_TELEMETRY_DATABASE_PASSWORD", "/run/geox/telemetry/db_password");
const jobsDbPassword = secret("GEOX_JOBS_DATABASE_PASSWORD", "/run/geox/jobs/db_password");
const executorDbPassword = secret("GEOX_EXECUTOR_DATABASE_PASSWORD", "/run/geox/executor/db_password");

const telemetryMqttUsername = String(process.env.GEOX_TELEMETRY_MQTT_USERNAME ?? "geox_telemetry_ingest_v1").trim();
const telemetryMqttPassword = secret("GEOX_TELEMETRY_MQTT_PASSWORD", "/run/geox/telemetry/mqtt_password");
const executorMqttUsername = String(process.env.GEOX_EXECUTOR_MQTT_USERNAME ?? "geox_executor_v1").trim();
const executorMqttPassword = secret("GEOX_EXECUTOR_MQTT_PASSWORD", "/run/geox/executor/mqtt_password");
const mqttUrl = String(process.env.W6B2_MQTT_URL ?? "mqtt://127.0.0.1:1883").trim();

function secret(envName: string, filePath: string): string {
  const fromEnv = String(process.env[envName] ?? "");
  if (fromEnv) return fromEnv;
  try {
    const fromFile = fs.readFileSync(filePath, "utf8").trim();
    if (fromFile) return fromFile;
  } catch {}
  throw new Error(`W6B2_RUNTIME_PROOF_MISSING_SECRET:${envName}:${filePath}`);
}

function assert(condition: unknown, message: string, detail?: unknown): asserts condition {
  if (!condition) throw new Error(`${message}${detail === undefined ? "" : `:${JSON.stringify(detail)}`}`);
}

const principals = [
  { kind: "telemetry", user: "geox_telemetry_ingest_v1", password: telemetryDbPassword },
  { kind: "jobs", user: "geox_jobs_v1", password: jobsDbPassword },
  { kind: "executor", user: "geox_executor_runtime_v1", password: executorDbPassword },
] as const;

function dbUrl(user: string, password: string): string {
  return `postgres://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${encodeURIComponent(database)}`;
}

async function verifyDatabasePrincipal(principal: (typeof principals)[number]) {
  const pool = new Pool({ connectionString: dbUrl(principal.user, principal.password), max: 1, connectionTimeoutMillis: 5000 });
  try {
    const identity = await pool.query<{
      session_user: string;
      current_user: string;
      rolcanlogin: boolean;
      rolinherit: boolean;
      rolsuper: boolean;
      rolcreatedb: boolean;
      rolcreaterole: boolean;
      rolreplication: boolean;
      rolbypassrls: boolean;
      can_set_runtime: boolean;
      can_create_public: boolean;
    }>(`
      SELECT
        session_user::text AS session_user,
        current_user::text AS current_user,
        r.rolcanlogin,
        r.rolinherit,
        r.rolsuper,
        r.rolcreatedb,
        r.rolcreaterole,
        r.rolreplication,
        r.rolbypassrls,
        pg_catalog.pg_has_role(current_user, 'geox_runtime_v1', 'SET') AS can_set_runtime,
        pg_catalog.has_schema_privilege(current_user, 'public', 'CREATE') AS can_create_public
      FROM pg_catalog.pg_roles AS r
      WHERE r.rolname = current_user
    `);
    const row = identity.rows[0];
    assert(row, "W6B2_DB_IDENTITY_MISSING", principal.kind);
    assert(row.session_user === principal.user && row.current_user === principal.user, "W6B2_DB_IDENTITY_COLLAPSED", { principal: principal.kind, row });
    assert(row.rolcanlogin, "W6B2_DB_LOGIN_DISABLED", principal.kind);
    assert(!row.rolinherit && !row.rolsuper && !row.rolcreatedb && !row.rolcreaterole && !row.rolreplication && !row.rolbypassrls, "W6B2_DB_ROLE_FLAGS_INVALID", { principal: principal.kind, row });
    assert(!row.can_set_runtime, "W6B2_DB_CAN_SET_MCFT_RUNTIME_ROLE", principal.kind);
    assert(!row.can_create_public, "W6B2_DB_CAN_CREATE_PUBLIC", principal.kind);

    await pool.query("SELECT fact_id FROM public.facts LIMIT 1");
    await pool.query("SELECT 1 FROM pg_catalog.pg_class LIMIT 1");

    let createDenied = false;
    try {
      await pool.query(`CREATE TABLE public.w6b2_forbidden_${principal.kind}_v1(id integer)`);
    } catch {
      createDenied = true;
    }
    assert(createDenied, "W6B2_DB_PUBLIC_CREATE_NOT_DENIED", principal.kind);

    let setRuntimeDenied = false;
    try {
      await pool.query("SET ROLE geox_runtime_v1");
    } catch {
      setRuntimeDenied = true;
    }
    assert(setRuntimeDenied, "W6B2_DB_SET_RUNTIME_NOT_DENIED", principal.kind);

    return {
      kind: principal.kind,
      session_user: row.session_user,
      current_user: row.current_user,
      public_create_denied: true,
      mcft_runtime_set_role_denied: true,
    };
  } finally {
    await pool.end();
  }
}

async function expectDbAuthFailure(user: string, wrongPassword: string, label: string): Promise<void> {
  const pool = new Pool({ connectionString: dbUrl(user, wrongPassword), max: 1, connectionTimeoutMillis: 3000 });
  let denied = false;
  try {
    await pool.query("SELECT 1");
  } catch {
    denied = true;
  } finally {
    await pool.end().catch(() => undefined);
  }
  assert(denied, "W6B2_DB_CROSS_CREDENTIAL_ACCEPTED", label);
}

function connectMqtt(username: string, password: string, clientId: string): Promise<MqttClient> {
  return new Promise((resolve, reject) => {
    const client = mqtt.connect(mqttUrl, {
      username,
      password,
      clientId,
      protocolVersion: 4,
      reconnectPeriod: 0,
      connectTimeout: 3000,
      clean: true,
    });
    const timer = setTimeout(() => {
      client.end(true);
      reject(new Error(`MQTT_CONNECT_TIMEOUT:${clientId}`));
    }, 4000);
    client.once("connect", () => {
      clearTimeout(timer);
      resolve(client);
    });
    client.once("error", (error) => {
      clearTimeout(timer);
      client.end(true);
      reject(error);
    });
  });
}

function subscribe(client: MqttClient, topic: string): Promise<number> {
  return new Promise((resolve, reject) => {
    client.subscribe(topic, { qos: 0 }, (error, granted) => {
      if (error) return reject(error);
      resolve(Number((granted?.[0] as any)?.qos ?? -1));
    });
  });
}

function publish(client: MqttClient, topic: string, payload: string): Promise<void> {
  return new Promise((resolve, reject) => {
    client.publish(topic, payload, { qos: 0, retain: false }, (error) => error ? reject(error) : resolve());
  });
}

async function verifyMqttBoundary() {
  assert(telemetryMqttUsername !== executorMqttUsername, "W6B2_MQTT_USERNAME_COLLAPSED");
  assert(telemetryMqttPassword !== executorMqttPassword, "W6B2_MQTT_PASSWORD_COLLAPSED");

  const nonce = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
  const topic = `telemetry/w6b2_${nonce}/device`;
  const telemetry = await connectMqtt(telemetryMqttUsername, telemetryMqttPassword, `w6b2_telemetry_${nonce}`);
  const executor = await connectMqtt(executorMqttUsername, executorMqttPassword, `w6b2_executor_${nonce}`);
  try {
    const telemetryGrant = await subscribe(telemetry, topic);
    assert(telemetryGrant !== 128, "W6B2_MQTT_TELEMETRY_READ_DENIED", telemetryGrant);

    const executorGrant = await subscribe(executor, topic).catch(() => 128);
    assert(executorGrant === 128, "W6B2_MQTT_EXECUTOR_SUBSCRIBE_NOT_DENIED", executorGrant);

    let telemetryReceivedOwnPublish = false;
    const ownPayload = `telemetry-forbidden-${nonce}`;
    const ownHandler = (incomingTopic: string, payload: Buffer) => {
      if (incomingTopic === topic && payload.toString("utf8") === ownPayload) telemetryReceivedOwnPublish = true;
    };
    telemetry.on("message", ownHandler);
    await publish(telemetry, topic, ownPayload).catch(() => undefined);
    await new Promise((resolve) => setTimeout(resolve, 500));
    telemetry.removeListener("message", ownHandler);
    assert(!telemetryReceivedOwnPublish, "W6B2_MQTT_TELEMETRY_PUBLISH_NOT_DENIED");

    const executorPayload = `executor-allowed-${nonce}`;
    const delivered = new Promise<boolean>((resolve) => {
      const handler = (incomingTopic: string, payload: Buffer) => {
        if (incomingTopic === topic && payload.toString("utf8") === executorPayload) {
          clearTimeout(timer);
          telemetry.removeListener("message", handler);
          resolve(true);
        }
      };
      const timer = setTimeout(() => {
        telemetry.removeListener("message", handler);
        resolve(false);
      }, 2500);
      telemetry.on("message", handler);
    });
    await publish(executor, topic, executorPayload);
    assert(await delivered, "W6B2_MQTT_EXECUTOR_PUBLISH_NOT_DELIVERED");
  } finally {
    telemetry.end(true);
    executor.end(true);
  }

  let crossCredentialDenied = false;
  try {
    const wrong = await connectMqtt(telemetryMqttUsername, executorMqttPassword, `w6b2_wrong_${nonce}`);
    wrong.end(true);
  } catch {
    crossCredentialDenied = true;
  }
  assert(crossCredentialDenied, "W6B2_MQTT_CROSS_CREDENTIAL_ACCEPTED");

  return {
    telemetry_principal: telemetryMqttUsername,
    executor_principal: executorMqttUsername,
    telemetry_read_allowed: true,
    telemetry_publish_denied: true,
    executor_publish_allowed: true,
    executor_subscribe_denied: true,
    cross_credential_denied: true,
  };
}

async function main() {
  assert(new Set(principals.map((p) => p.user)).size === principals.length, "W6B2_DB_USERNAME_COLLAPSED");
  assert(new Set(principals.map((p) => p.password)).size === principals.length, "W6B2_DB_PASSWORD_COLLAPSED");

  const dbResults = [];
  for (const principal of principals) dbResults.push(await verifyDatabasePrincipal(principal));
  await expectDbAuthFailure("geox_telemetry_ingest_v1", jobsDbPassword, "telemetry_user_with_jobs_password");
  await expectDbAuthFailure("geox_jobs_v1", executorDbPassword, "jobs_user_with_executor_password");
  await expectDbAuthFailure("geox_executor_runtime_v1", telemetryDbPassword, "executor_user_with_telemetry_password");

  const mqttResult = await verifyMqttBoundary();
  console.log(JSON.stringify({
    result: "PASS",
    workstream: "W6_B2_COMMERCIAL_PRINCIPAL_ISOLATION",
    database: {
      principals: dbResults,
      distinct_credentials: true,
      cross_credentials_denied: true,
    },
    mqtt: mqttResult,
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exit(1);
});
