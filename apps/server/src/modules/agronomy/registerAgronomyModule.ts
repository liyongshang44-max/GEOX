import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";

import { registerAgronomyV0Routes } from "../../routes/agronomy_v0.js";
import { registerAgronomyMediaV1Routes } from "../../routes/agronomy_media_v1.js";
import { registerAgronomyInterpretationV1Routes } from "../../routes/agronomy_interpretation_v1.js";
import { registerAgronomyInferenceV1Routes } from "../../routes/agronomy_inference_v1.js";

type RegisterAgronomyModuleOptions = {
  mediaDir: string;
};

export function registerAgronomyModule(app: FastifyInstance, pool: Pool, options: RegisterAgronomyModuleOptions): void {
  registerAgronomyV0Routes(app, pool);
  registerAgronomyMediaV1Routes(app, pool, options.mediaDir);

  registerAgronomyInterpretationV1Routes(app);
  registerAgronomyInferenceV1Routes(app, pool);
}
