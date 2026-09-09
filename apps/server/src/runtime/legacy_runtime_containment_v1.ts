import type { FastifyInstance } from "fastify";
import { getRuntimeEnvV1 } from "./runtime_security_v1.js";

export const W5_LEGACY_RUNTIME_CONTAINMENT_ERROR = "LEGACY_RUNTIME_CONTAINED";

export type W5LegacyRuntimeContainmentRuleV1 = {
  surface_id: string;
  method: "POST" | "DELETE";
  route_template: string;
  pathname_pattern: RegExp;
};

export const W5_LEGACY_RUNTIME_CONTAINMENT_RULES_V1: readonly W5LegacyRuntimeContainmentRuleV1[] = Object.freeze([
  { surface_id: "BSEC-005", method: "POST", route_template: "/api/v1/twin-kernel/field-state-snapshots", pathname_pattern: /^\/api\/v1\/twin-kernel\/field-state-snapshots$/ },
  { surface_id: "BSEC-006", method: "POST", route_template: "/api/v1/twin-kernel/forecast-runs", pathname_pattern: /^\/api\/v1\/twin-kernel\/forecast-runs$/ },
  { surface_id: "BSEC-007", method: "POST", route_template: "/api/v1/twin-kernel/scenario-sets", pathname_pattern: /^\/api\/v1\/twin-kernel\/scenario-sets$/ },
  { surface_id: "BSEC-008", method: "POST", route_template: "/api/v1/twin-kernel/calibration-replays", pathname_pattern: /^\/api\/v1\/twin-kernel\/calibration-replays$/ },
  { surface_id: "BSEC-009", method: "POST", route_template: "/api/v1/twin-kernel/field-learning-candidates", pathname_pattern: /^\/api\/v1\/twin-kernel\/field-learning-candidates$/ },
  { surface_id: "BSEC-010", method: "POST", route_template: "/api/v1/twin-kernel/decision-cycles", pathname_pattern: /^\/api\/v1\/twin-kernel\/decision-cycles$/ },
  { surface_id: "BSEC-011", method: "POST", route_template: "/api/v1/twin-kernel/production-ingestion/source-refs", pathname_pattern: /^\/api\/v1\/twin-kernel\/production-ingestion\/source-refs$/ },
  { surface_id: "BSEC-012", method: "POST", route_template: "/api/v1/twin-kernel/operator-workflow/sessions", pathname_pattern: /^\/api\/v1\/twin-kernel\/operator-workflow\/sessions$/ },
  { surface_id: "BSEC-013", method: "POST", route_template: "/api/v1/twin-kernel/operator-workflow/reviews", pathname_pattern: /^\/api\/v1\/twin-kernel\/operator-workflow\/reviews$/ },
  { surface_id: "BSEC-014", method: "POST", route_template: "/api/v1/twin-kernel/operator-workflow/formalization-actions/roi", pathname_pattern: /^\/api\/v1\/twin-kernel\/operator-workflow\/formalization-actions\/roi$/ },
  { surface_id: "BSEC-015", method: "POST", route_template: "/api/v1/twin-kernel/operator-workflow/formalization-actions/field-memory", pathname_pattern: /^\/api\/v1\/twin-kernel\/operator-workflow\/formalization-actions\/field-memory$/ },
  { surface_id: "BSEC-016", method: "POST", route_template: "/api/v1/twin-kernel/formalizations/roi", pathname_pattern: /^\/api\/v1\/twin-kernel\/formalizations\/roi$/ },
  { surface_id: "BSEC-017", method: "POST", route_template: "/api/v1/twin-kernel/formalizations/field-memory", pathname_pattern: /^\/api\/v1\/twin-kernel\/formalizations\/field-memory$/ },
  { surface_id: "BSEC-022", method: "POST", route_template: "/api/admin/import/caf_hourly", pathname_pattern: /^\/api\/admin\/import\/caf_hourly$/ },
  { surface_id: "BSEC-023", method: "POST", route_template: "/api/admin/acceptance/caf009_1h/run", pathname_pattern: /^\/api\/admin\/acceptance\/caf009_1h\/run$/ },
  { surface_id: "BSEC-027", method: "POST", route_template: "/api/derive/overlays", pathname_pattern: /^\/api\/derive\/overlays$/ },
  { surface_id: "BSEC-028", method: "POST", route_template: "/api/marker", pathname_pattern: /^\/api\/marker$/ },
  { surface_id: "BSEC-029", method: "POST", route_template: "/api/canopy/frame", pathname_pattern: /^\/api\/canopy\/frame$/ },
  { surface_id: "BSEC-031", method: "POST", route_template: "/api/admin/groups", pathname_pattern: /^\/api\/admin\/groups$/ },
  { surface_id: "BSEC-032", method: "POST", route_template: "/api/admin/groups/:groupId/members", pathname_pattern: /^\/api\/admin\/groups\/[^/]+\/members$/ },
  { surface_id: "BSEC-033", method: "DELETE", route_template: "/api/admin/groups/:groupId/members/:sensorId", pathname_pattern: /^\/api\/admin\/groups\/[^/]+\/members\/[^/]+$/ },
  { surface_id: "BSEC-034", method: "DELETE", route_template: "/api/admin/groups/:groupId", pathname_pattern: /^\/api\/admin\/groups\/[^/]+$/ },
]);

export function isW5LegacyContainmentStrictRuntimeV1(): boolean {
  const runtime = getRuntimeEnvV1();
  return runtime === "pilot" || runtime === "staging" || runtime === "production";
}

export function matchW5LegacyRuntimeContainmentV1(method: string, pathname: string): W5LegacyRuntimeContainmentRuleV1 | null {
  const normalizedMethod = String(method ?? "").trim().toUpperCase();
  const normalizedPath = String(pathname ?? "").split("?", 1)[0] || "/";
  return W5_LEGACY_RUNTIME_CONTAINMENT_RULES_V1.find(
    (rule) => rule.method === normalizedMethod && rule.pathname_pattern.test(normalizedPath),
  ) ?? null;
}

export function registerW5LegacyRuntimeContainmentV1(app: FastifyInstance): void {
  app.addHook("onRequest", async (req, reply) => {
    if (!isW5LegacyContainmentStrictRuntimeV1()) return;
    const pathname = String(req.raw?.url ?? req.url ?? "").split("?", 1)[0] || "/";
    const rule = matchW5LegacyRuntimeContainmentV1(req.method, pathname);
    if (!rule) return;
    reply.header("Deprecation", "true");
    reply.header("Sunset", "legacy");
    return reply.code(410).send({
      ok: false,
      error: W5_LEGACY_RUNTIME_CONTAINMENT_ERROR,
      surface_id: rule.surface_id,
      route: rule.route_template,
      disposition: "STRICT_RUNTIME_LEGACY_MUTATION_CONTAINED",
    });
  });
}
