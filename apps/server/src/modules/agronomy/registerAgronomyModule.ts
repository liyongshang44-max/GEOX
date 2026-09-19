import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";

import { buildAgronomyV0Routes } from "../../routes/agronomy_v0.js";
import { registerAgronomyMediaV1Routes } from "../../routes/agronomy_media_v1.js";
import { registerAgronomyInterpretationV1Routes } from "../../routes/agronomy_interpretation_v1.js";
import { registerAgronomyInferenceV1Routes } from "../../routes/agronomy_inference_v1.js";

type RegisterAgronomyModuleOptions = {
  mediaDir: string;
};

const WEAK_INTERNAL_AGRONOMY_MUTATION_PATHS = new Set([
  "/api/agronomy/v0/ao_act/interpretation",
  "/api/agronomy/interpretation_v1/append",
]);

export const WEAK_INTERNAL_MUTATION_COMMERCIAL_AUTHORITY_ERROR =
  "WEAK_INTERNAL_MUTATION_COMMERCIAL_AUTHORITY_UNAVAILABLE";

function registerCommercialAgronomyV0Routes(app: FastifyInstance, pool: Pool): void {
  app.register(async (scopedApp) => {
    const originalPost = scopedApp.post.bind(scopedApp) as any;
    const guardedApp = new Proxy(scopedApp as any, {
      get(target, property) {
        if (property === "post") {
          return (path: unknown, ...args: unknown[]) => {
            const exactPath = typeof path === "string" ? path : "";
            if (WEAK_INTERNAL_AGRONOMY_MUTATION_PATHS.has(exactPath)) {
              return originalPost(exactPath, async (_req: unknown, reply: any) =>
                reply.code(403).send({
                  ok: false,
                  error: WEAK_INTERNAL_MUTATION_COMMERCIAL_AUTHORITY_ERROR,
                }),
              );
            }
            return originalPost(path, ...args);
          };
        }
        const value = Reflect.get(target, property, target);
        return typeof value === "function" ? value.bind(target) : value;
      },
    }) as FastifyInstance;

    await buildAgronomyV0Routes(pool)(guardedApp, {});
  });
}

export function registerAgronomyModule(app: FastifyInstance, pool: Pool, options: RegisterAgronomyModuleOptions): void {
  registerCommercialAgronomyV0Routes(app, pool);
  registerAgronomyMediaV1Routes(app, pool, options.mediaDir);

  registerAgronomyInterpretationV1Routes(app);
  registerAgronomyInferenceV1Routes(app, pool);
}
