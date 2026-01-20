import type { FastifyInstance } from "fastify";
import type { JudgeRuntime } from "./runtime";
import { assertInt, assertString } from "./util";
import type { JudgeConfigPatchV1 } from "./config/patch";
import { JudgeConfigPatchRejected } from "./config/patch";

export function registerJudgeRoutes(app: FastifyInstance, runtime: JudgeRuntime): void {

  app.post("/api/judge/run", async (req, reply) => {
    const body = (req.body ?? {}) as any;
    const subjectRef = body.subjectRef ?? {};
    const scale = assertString(body.scale, "scale");
    const window = body.window ?? {};
    const startTs = assertInt(window.startTs, "window.startTs");
    const endTs = assertInt(window.endTs, "window.endTs");
    const options = body.options ?? {};

    // Optional inline patch (replace-only). Must be statically validated by backend.
    const config_patch: JudgeConfigPatchV1 | undefined = options.config_patch;

    try {
      const out = await runtime.run({
        subjectRef,
        scale,
        window: { startTs, endTs },
        options: {
          persist: typeof options.persist === "boolean" ? options.persist : false,
          include_reference_views: typeof options.include_reference_views === "boolean" ? options.include_reference_views : false,
          include_lb_candidates: typeof options.include_lb_candidates === "boolean" ? options.include_lb_candidates : false,
          config_profile: typeof options.config_profile === "string" ? options.config_profile : "default",
          config_patch,
        },
      });
      return reply.send(out);
    } catch (e: any) {
      if (e instanceof JudgeConfigPatchRejected) {
        return reply.code(e.status).send({ ok: false, errors: e.errors });
      }
      throw e;
    }
  });

  app.get("/api/judge/problem_states", async (req, reply) => {
    const q = (req.query ?? {}) as any;
    const limit = typeof q.limit !== "undefined" ? assertInt(q.limit, "limit") : 100;
    return reply.send({ problem_states: runtime.listProblemStates(Math.max(1, Math.min(limit, 500))) });
  });

  app.get("/api/judge/reference_views", async (req, reply) => {
    const q = (req.query ?? {}) as any;
    const limit = typeof q.limit !== "undefined" ? assertInt(q.limit, "limit") : 100;
    return reply.send({ reference_views: runtime.listReferenceViews(Math.max(1, Math.min(limit, 500))) });
  });

  app.get("/api/judge/ao_sense", async (req, reply) => {
    const q = (req.query ?? {}) as any;
    const limit = typeof q.limit !== "undefined" ? assertInt(q.limit, "limit") : 100;
    return reply.send({ ao_sense: runtime.listAoSense(Math.max(1, Math.min(limit, 500))) });
  });
}
