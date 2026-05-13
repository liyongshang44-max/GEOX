import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import { requireAoActScopeV0, type AoActAuthContextV0 } from "../../auth/ao_act_authz_v0.js";
import { normalizeFlightTableRunIdV1, readFlightTableRunV1 } from "../../services/flight_table/flight_table_orchestrator_v1.js";
import type { FlightTableRunV1 } from "../../services/flight_table/flight_table_manifest_v1.js";

function flightTableEnabled(): boolean {
  return String(process.env.ENABLE_FLIGHT_TABLE_API ?? "").trim().toLowerCase() === "true";
}

function disabled(reply: FastifyReply) {
  return reply.status(503).send({ ok: false, error: "FLIGHT_TABLE_DISABLED" });
}

function badRequest(reply: FastifyReply, error: string) {
  return reply.status(400).send({ ok: false, error });
}

function notFound(reply: FastifyReply) {
  return reply.status(404).send({ ok: false, error: "FLIGHT_TABLE_RUN_NOT_FOUND" });
}

function requireFlightTableAdmin(req: FastifyRequest, reply: FastifyReply): AoActAuthContextV0 | null {
  if (!flightTableEnabled()) {
    disabled(reply);
    return null;
  }
  return requireAoActScopeV0(req, reply, "security.admin");
}

function assertRunScope(run: { tenant_id: string; project_id: string; group_id: string }, auth: AoActAuthContextV0): boolean {
  return run.tenant_id === auth.tenant_id && run.project_id === auth.project_id && run.group_id === auth.group_id;
}

function routeError(reply: FastifyReply, err: unknown) {
  const message = String((err as any)?.message ?? err ?? "UNKNOWN_ERROR");
  if (message === "FLIGHT_TABLE_SCOPE_MISMATCH") return reply.status(403).send({ ok: false, error: message });
  if (message === "FLIGHT_TABLE_INVALID_RUN_ID") return badRequest(reply, message);
  if (message === "FLIGHT_TABLE_RUN_PHASE_FAILED") return reply.status(409).send({ ok: false, error: message, detail: (err as any)?.detail ?? null });
  return reply.status(500).send({ ok: false, error: "FLIGHT_TABLE_FULL_RUN_INTERNAL_ERROR", message });
}

type FullRunPhase = {
  key: string;
  label: string;
  status: "RUN" | "SKIPPED";
  ok: boolean;
  status_code?: number;
  reason?: string;
  response?: unknown;
};

type FullRunBody = {
  lane?: string;
  field_id?: string;
  field_name?: string;
  season_id?: string;
  crop?: string;
  crop_stage?: string;
};

function safeSuffix(runId: string): string {
  return runId.replace(/[^A-Za-z0-9_.:-]/g, "_").slice(0, 80);
}

function count(value: unknown): number {
  return Array.isArray(value) ? value.length : 0;
}

function hasExecutionDevice(run: FlightTableRunV1): boolean {
  return run.manifest.device_ids.some((id) => id.includes("irrigation_controller"));
}

function executionDeviceId(run: FlightTableRunV1): string | null {
  return run.manifest.device_ids.find((id) => id.includes("irrigation_controller")) ?? run.manifest.device_ids.at(-1) ?? null;
}

function sensingDeviceId(run: FlightTableRunV1): string | null {
  return run.manifest.device_ids.find((id) => !id.includes("irrigation_controller")) ?? run.manifest.device_ids[0] ?? null;
}

function defaultGeometry(): Record<string, unknown> {
  return {
    type: "Polygon",
    coordinates: [[
      [121.5670, 31.2340],
      [121.5682, 31.2340],
      [121.5682, 31.2350],
      [121.5670, 31.2350],
      [121.5670, 31.2340],
    ]],
  };
}

function parseJsonPayload(text: string): unknown {
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return { raw: text };
  }
}

export function registerFlightTableFullRunRoutesV1(app: FastifyInstance): void {
  app.post("/api/v1/dev/flight-table/runs/:runId/full-run", async (req, reply) => {
    const auth = requireFlightTableAdmin(req, reply);
    if (!auth) return;
    const runId = normalizeFlightTableRunIdV1((req.params as any)?.runId);
    if (!runId) return badRequest(reply, "FLIGHT_TABLE_INVALID_RUN_ID");

    const authHeader = typeof req.headers.authorization === "string" ? req.headers.authorization : "";
    const body = (req.body ?? {}) as FullRunBody;
    const lane = ["success", "evidence_insufficient", "weather_interference", "skill_failure", "all"].includes(String(body.lane)) ? String(body.lane) : "success";
    const phases: FullRunPhase[] = [];

    const callJson = async (method: "GET" | "POST", url: string, payload: unknown, key: string, label: string): Promise<any> => {
      const res = await app.inject({
        method,
        url,
        headers: {
          authorization: authHeader,
          "content-type": "application/json",
        },
        payload: method === "POST" ? JSON.stringify(payload ?? {}) : undefined,
      });
      const parsed = parseJsonPayload(res.payload) as any;
      const ok = res.statusCode >= 200 && res.statusCode < 300 && parsed?.ok !== false;
      phases.push({ key, label, status: "RUN", ok, status_code: res.statusCode, response: parsed });
      if (!ok) {
        const err = new Error("FLIGHT_TABLE_RUN_PHASE_FAILED") as Error & { detail?: unknown };
        err.detail = { key, label, status_code: res.statusCode, response: parsed };
        throw err;
      }
      return parsed;
    };

    const skip = (key: string, label: string, reason: string) => {
      phases.push({ key, label, status: "SKIPPED", ok: true, reason });
    };

    const readRun = async (): Promise<FlightTableRunV1> => {
      const run = await readFlightTableRunV1(runId);
      if (!run) throw new Error("FLIGHT_TABLE_RUN_NOT_FOUND");
      if (!assertRunScope(run, auth)) throw new Error("FLIGHT_TABLE_SCOPE_MISMATCH");
      return run;
    };

    try {
      let run = await readFlightTableRunV1(runId);
      if (!run) {
        await callJson("POST", "/api/v1/dev/flight-table/runs", {
          run_id: runId,
          tenant_id: auth.tenant_id,
          project_id: auth.project_id,
          group_id: auth.group_id,
          lane,
        }, "RUN", "create run");
        run = await readRun();
      }
      if (!assertRunScope(run, auth)) return notFound(reply);

      const suffix = safeSuffix(runId);
      if (!run.manifest.field_id || !run.manifest.season_id || !run.manifest.crop || !run.manifest.crop_stage) {
        await callJson("POST", `/api/v1/dev/flight-table/runs/${encodeURIComponent(runId)}/field`, {
          field_id: body.field_id ?? run.manifest.field_id ?? `ft_field_${suffix}`,
          field_name: body.field_name ?? `飞行台试验田 ${suffix}`,
          season_id: body.season_id ?? run.manifest.season_id ?? `ft_season_${suffix}`,
          crop: body.crop ?? run.manifest.crop ?? "corn",
          crop_stage: body.crop_stage ?? run.manifest.crop_stage ?? "vegetative",
        }, "A", "field assembly");
        run = await readRun();
      } else {
        skip("A", "field assembly", "manifest already has field, season, crop, and crop_stage");
      }

      if (!run.manifest.geometry_id) {
        await callJson("POST", `/api/v1/dev/flight-table/runs/${encodeURIComponent(runId)}/field-geometry`, {
          field_id: run.manifest.field_id,
          geometry_format: "GEOJSON",
          geometry: defaultGeometry(),
          weather_location: { lat: 31.234567, lng: 121.567890 },
        }, "A1", "field geometry");
        run = await readRun();
      } else {
        skip("A1", "field geometry", "manifest already has geometry_id");
      }

      if (count(run.manifest.device_ids) < 1) {
        await callJson("POST", `/api/v1/dev/flight-table/runs/${encodeURIComponent(runId)}/devices`, {
          field_id: run.manifest.field_id,
          template_code: "soil_probe",
          device_id: `ft_soil_probe_${suffix}_obs`,
          mode: "simulator",
          telemetry_mode: "fast",
        }, "B1", "sensing device onboarding");
        run = await readRun();
      } else {
        skip("B1", "sensing device onboarding", "manifest already has at least one device");
      }

      if (!hasExecutionDevice(run)) {
        await callJson("POST", `/api/v1/dev/flight-table/runs/${encodeURIComponent(runId)}/devices`, {
          field_id: run.manifest.field_id,
          template_code: "irrigation_controller",
          device_id: `ft_irrigation_controller_${suffix}_exec`,
          mode: "simulator",
          telemetry_mode: "fast",
        }, "B2", "execution device onboarding");
        run = await readRun();
      } else {
        skip("B2", "execution device onboarding", "manifest already has an irrigation_controller execution device");
      }

      if (count(run.manifest.recommendation_ids) < 1) {
        await callJson("POST", `/api/v1/dev/flight-table/runs/${encodeURIComponent(runId)}/telemetry/publish`, {
          scenarios: ["before_irrigation_low_moisture", "during_irrigation_flow", "after_irrigation_success"],
          mode: "fast",
          device_id: sensingDeviceId(run) ?? executionDeviceId(run),
          field_id: run.manifest.field_id,
        }, "C", "telemetry publish");
        run = await readRun();
      } else {
        skip("C", "telemetry publish", "decision already exists; telemetry is not replayed to avoid duplicate samples");
      }

      if (count(run.manifest.skill_binding_ids) < 4 || count(run.manifest.skill_run_ids) < 4) {
        await callJson("POST", `/api/v1/dev/flight-table/runs/${encodeURIComponent(runId)}/skills/bind`, {}, "C0", "skill binding");
        run = await readRun();
      } else {
        skip("C0", "skill binding", "manifest already has required skill bindings and runs");
      }

      if (count(run.manifest.recommendation_ids) < 1 || count(run.manifest.prescription_ids) < 1 || count(run.manifest.approval_request_ids) < 1) {
        await callJson("POST", `/api/v1/dev/flight-table/runs/${encodeURIComponent(runId)}/decision/run`, {
          field_id: run.manifest.field_id,
          season_id: run.manifest.season_id,
          device_id: sensingDeviceId(run) ?? executionDeviceId(run),
          crop_code: run.manifest.crop ?? "corn",
          prescription_mode: "standard",
          approval_action: "approve",
        }, "E", "decision prescription approval");
        run = await readRun();
      } else {
        skip("E", "decision prescription approval", "manifest already has recommendation, prescription, and approval request");
      }

      if (count(run.manifest.operation_plan_ids) < 1 || count(run.manifest.act_task_ids) < 1 || count(run.manifest.receipt_ids) < 1) {
        await callJson("POST", `/api/v1/dev/flight-table/runs/${encodeURIComponent(runId)}/operation/run`, {
          prescription_id: run.manifest.prescription_ids.at(-1),
          approval_request_id: run.manifest.approval_request_ids.at(-1),
          field_id: run.manifest.field_id,
          device_id: executionDeviceId(run),
        }, "F", "operation dispatch receipt");
        run = await readRun();
      } else {
        skip("F", "operation dispatch receipt", "manifest already has operation, task, and receipt");
      }

      if (count(run.manifest.evidence_ids) < 1 || count(run.manifest.acceptance_ids) < 1 || count(run.manifest.evidence_export_job_ids) < 1) {
        await callJson("POST", `/api/v1/dev/flight-table/runs/${encodeURIComponent(runId)}/evidence/run`, {
          lane: lane === "success" ? "success" : lane,
          operation_id: run.manifest.operation_plan_ids.at(-1),
          operation_plan_id: run.manifest.operation_plan_ids.at(-1),
          act_task_id: run.manifest.act_task_ids.at(-1),
          receipt_id: run.manifest.receipt_ids.at(-1),
          field_id: run.manifest.field_id,
        }, "G", "evidence acceptance export");
        run = await readRun();
      } else {
        skip("G", "evidence acceptance export", "manifest already has evidence, acceptance, and export job");
      }

      if (count(run.manifest.field_memory_ids) < 1) {
        await callJson("POST", `/api/v1/dev/flight-table/runs/${encodeURIComponent(runId)}/report-learning/run`, {
          operation_id: run.manifest.operation_plan_ids.at(-1),
          field_id: run.manifest.field_id,
          acceptance_id: run.manifest.acceptance_ids.at(-1),
          evidence_id: run.manifest.evidence_ids.at(-1),
        }, "H", "report learning closure");
        run = await readRun();
      } else {
        skip("H", "report learning closure", "manifest already has field memory closure");
      }

      await callJson("POST", `/api/v1/dev/flight-table/runs/${encodeURIComponent(runId)}/start`, {
        lane,
        field_id: run.manifest.field_id,
        device_set: run.manifest.device_ids.join(","),
        skill_policy: "require_all_bound",
        weather_policy: lane === "weather_interference" || lane === "all" ? "simulate_weather_interference" : "observe_only",
        evidence_policy: lane === "evidence_insufficient" || lane === "all" ? "insufficient" : "complete",
      }, "I", "manifest gate verification");
      run = await readRun();

      const pollution = {
        operation_count: count(run.manifest.operation_plan_ids),
        task_count: count(run.manifest.act_task_ids),
        receipt_count: count(run.manifest.receipt_ids),
        polluted: count(run.manifest.operation_plan_ids) > 1 || count(run.manifest.act_task_ids) > 1 || count(run.manifest.receipt_ids) > 1,
      };

      return reply.send({ ok: true, run, phases, pollution });
    } catch (err) {
      return routeError(reply, err);
    }
  });
}
