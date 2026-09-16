import Fastify from "fastify";
import {
  registerW5LegacyRuntimeContainmentV1,
  W5_LEGACY_RUNTIME_CONTAINMENT_ERROR,
  W5_LEGACY_RUNTIME_CONTAINMENT_RULES_V1,
} from "../../apps/server/src/runtime/legacy_runtime_containment_v1.js";

function expect(condition: unknown, message: string, detail?: unknown): asserts condition {
  if (!condition) throw new Error(message + (detail === undefined ? "" : `: ${JSON.stringify(detail)}`));
}

function concretePath(template: string): string {
  return template.replace(":groupId", "group_w5").replace(":sensorId", "sensor_w5");
}

function registerStubMutationRoutes(app: ReturnType<typeof Fastify>, calls: Map<string, number>): void {
  for (const rule of W5_LEGACY_RUNTIME_CONTAINMENT_RULES_V1) {
    app.route({
      method: rule.method,
      url: rule.route_template,
      handler: async (_req, reply) => {
        calls.set(rule.surface_id, (calls.get(rule.surface_id) ?? 0) + 1);
        return reply.send({ ok: true, handler_reached: true, surface_id: rule.surface_id });
      },
    });
  }
}

async function strictRuntimeProof(): Promise<Record<string, number>> {
  process.env.GEOX_RUNTIME_ENV = "pilot";
  const app = Fastify({ logger: false });
  const calls = new Map<string, number>();
  registerW5LegacyRuntimeContainmentV1(app);
  registerStubMutationRoutes(app, calls);

  app.post("/api/canopy/upload", async (_req, reply) => {
    calls.set("BSEC-030", (calls.get("BSEC-030") ?? 0) + 1);
    return reply.code(403).send({ ok: false, error: "LEGACY_CANOPY_UPLOAD_COMMERCIAL_AUTHORITY_UNAVAILABLE" });
  });
  app.get("/api/admin/groups", async (_req, reply) => {
    calls.set("READ_ADMIN_GROUPS", (calls.get("READ_ADMIN_GROUPS") ?? 0) + 1);
    return reply.send({ ok: true, groups: [] });
  });
  await app.ready();

  const statuses: Record<string, number> = {};
  for (const rule of W5_LEGACY_RUNTIME_CONTAINMENT_RULES_V1) {
    const response = await app.inject({
      method: rule.method,
      url: concretePath(rule.route_template),
      headers: { "content-type": "application/json" },
      payload: rule.method === "POST" ? {} : undefined,
    });
    const json = response.json();
    expect(response.statusCode === 410, "strict runtime legacy mutation was not contained", { rule, status: response.statusCode, json });
    expect(json?.error === W5_LEGACY_RUNTIME_CONTAINMENT_ERROR, "strict runtime containment error drift", { rule, json });
    expect(json?.surface_id === rule.surface_id, "strict runtime containment surface identity drift", { rule, json });
    expect((calls.get(rule.surface_id) ?? 0) === 0, "contained legacy handler executed", { rule, calls: calls.get(rule.surface_id) });
    statuses[rule.surface_id] = response.statusCode;
  }

  const baseline = await app.inject({ method: "POST", url: "/api/canopy/upload", payload: {} });
  expect(baseline.statusCode === 403 && baseline.json()?.error === "LEGACY_CANOPY_UPLOAD_COMMERCIAL_AUTHORITY_UNAVAILABLE",
    "BSEC-030 prior containment baseline was intercepted or weakened", { status: baseline.statusCode, json: baseline.json() });
  expect((calls.get("BSEC-030") ?? 0) === 1, "BSEC-030 baseline handler was not reached through W5 hook");

  const read = await app.inject({ method: "GET", url: "/api/admin/groups" });
  expect(read.statusCode === 200, "legacy read route was incorrectly contained", { status: read.statusCode, body: read.body });
  expect((calls.get("READ_ADMIN_GROUPS") ?? 0) === 1, "legacy read handler was not reached");

  await app.close();
  return statuses;
}

async function compatibilityProof(): Promise<void> {
  process.env.GEOX_RUNTIME_ENV = "test";
  const app = Fastify({ logger: false });
  let handlerCalls = 0;
  registerW5LegacyRuntimeContainmentV1(app);
  app.post("/api/v1/twin-kernel/field-state-snapshots", async (_req, reply) => {
    handlerCalls += 1;
    return reply.send({ ok: true, compatibility_handler_reached: true });
  });
  await app.ready();
  const response = await app.inject({ method: "POST", url: "/api/v1/twin-kernel/field-state-snapshots", payload: {} });
  expect(response.statusCode === 200 && response.json()?.compatibility_handler_reached === true,
    "development/test compatibility behavior was incorrectly contained", { status: response.statusCode, body: response.body });
  expect(handlerCalls === 1, "development/test compatibility handler was not executed", { handlerCalls });
  await app.close();
}

async function main(): Promise<void> {
  const saved = process.env.GEOX_RUNTIME_ENV;
  try {
    expect(W5_LEGACY_RUNTIME_CONTAINMENT_RULES_V1.length === 22, "W5 runtime rule count drift", W5_LEGACY_RUNTIME_CONTAINMENT_RULES_V1.length);
    expect(!W5_LEGACY_RUNTIME_CONTAINMENT_RULES_V1.some((rule) => rule.surface_id === "BSEC-030"), "BSEC-030 incorrectly entered W5 repair rules");
    const statuses = await strictRuntimeProof();
    await compatibilityProof();
    console.log(JSON.stringify({
      result: "PASS",
      workstream: "W5_LEGACY_RUNTIME_CONTAINMENT",
      bounded_repair_count: 22,
      strict_runtime_contained: statuses,
      handler_execution_delta: 0,
      bsec_030_baseline_preserved: true,
      legacy_read_preserved: true,
      test_compatibility_preserved: true,
    }, null, 2));
  } finally {
    if (saved === undefined) delete process.env.GEOX_RUNTIME_ENV;
    else process.env.GEOX_RUNTIME_ENV = saved;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
