import type { FastifyInstance } from "fastify";
import { requireAoActScopeV0 } from "../auth/ao_act_authz_v0.js";

const OFFICIAL_LEARNING_VALIDATION_ROUTE = "/api/v1/operator/learning-validation";

type AnyRecord = Record<string, any>;

function isObject(value: unknown): value is AnyRecord {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function isOfficialLearningValidationPayload(value: AnyRecord): boolean {
  return value.source === "operator_learning_validation_v1" || isObject(value.learning_validation);
}

function looksLikeLegacyLearningClosure(value: AnyRecord): boolean {
  if (isOfficialLearningValidationPayload(value)) return false;
  return isObject(value.customer_summary)
    && (Array.isArray(value.skill_performance) || Array.isArray(value.skill_traces) || Array.isArray(value.field_memory_delta) || Array.isArray(value.roi_result))
    && ("learning_exclusion_reason" in value || "acceptance_gates" in value || "rule_performance" in value);
}

function downgradeLegacyLearningClosure(value: AnyRecord): AnyRecord {
  const customerSummary = isObject(value.customer_summary) ? value.customer_summary : {};
  return {
    ...value,
    diagnostic_only: true,
    learning_effective: false,
    learning_validation_status: "DIAGNOSTIC_ONLY_NOT_FORMAL",
    official_learning_validation_route: OFFICIAL_LEARNING_VALIDATION_ROUTE,
    learning_validation_warning: "Legacy operator diagnostics is diagnostic-only. Formal learning closure must be read from operator_learning_validation_v1.",
    customer_summary: {
      ...customerSummary,
      learned: "仅存在诊断/技术学习信号；正式学习结论请以 /api/v1/operator/learning-validation 为准。",
      no_learning_reason: customerSummary.no_learning_reason ?? "旧 operator diagnostics 不再生成正式学习闭合结论。",
      excluded_data: customerSummary.excluded_data ?? "技术/模拟/对象存在信号已降级为诊断线索。",
    },
  };
}

function sanitizeLegacyDiagnosticsLearningPayload(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => sanitizeLegacyDiagnosticsLearningPayload(item));
  if (!isObject(value)) return value;
  if (looksLikeLegacyLearningClosure(value)) return downgradeLegacyLearningClosure(value);
  let changed = false;
  const next: AnyRecord = { ...value };
  for (const [key, child] of Object.entries(value)) {
    const sanitized = sanitizeLegacyDiagnosticsLearningPayload(child);
    if (sanitized !== child) {
      next[key] = sanitized;
      changed = true;
    }
  }
  return changed ? next : value;
}

function maybeSanitizeLegacyDiagnosticsResponse(pathname: string, payload: unknown): unknown {
  if (!pathname.includes("operator") && !pathname.includes("diagnostic")) return payload;
  return sanitizeLegacyDiagnosticsLearningPayload(payload);
}

export function registerRouteReplyGuardV1(app: FastifyInstance): void {
  app.addHook("onRequest", async (req, reply) => {
    const pathname = String(req.url ?? "").split("?")[0];
    if (req.method !== "GET" || pathname !== "/api/v1/fields") return;

    const auth = requireAoActScopeV0(req, reply, "fields.read");
    if (!auth) return reply;
  });

  app.addHook("onSend", async (req, reply, payload) => {
    const contentType = String(reply.getHeader("content-type") ?? "");
    if (!contentType.includes("application/json")) return payload;
    if (typeof payload !== "string" || !payload.trim().startsWith("{")) return payload;
    const pathname = String(req.url ?? "").split("?")[0];
    if (!pathname.includes("operator") && !pathname.includes("diagnostic")) return payload;
    try {
      const parsed = JSON.parse(payload);
      const sanitized = maybeSanitizeLegacyDiagnosticsResponse(pathname, parsed);
      return sanitized === parsed ? payload : JSON.stringify(sanitized);
    } catch {
      return payload;
    }
  });
}
