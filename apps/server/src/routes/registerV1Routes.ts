import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";

import { registerDevtoolsModule } from "../modules/devtools/registerDevtoolsModule.js";
import { registerSensingModule } from "../modules/sensing/registerSensingModule.js";
import { registerFieldModule } from "../modules/field/registerFieldModule.js";
import { registerDecisionModule } from "../modules/decision/registerDecisionModule.js";
import { registerExecutionModule } from "../modules/execution/registerExecutionModule.js";
import { registerEvidenceModule } from "../modules/evidence/registerEvidenceModule.js";
import { registerAcceptanceModule } from "../modules/acceptance/registerAcceptanceModule.js";
import { registerReportingModule } from "../modules/reporting/registerReportingModule.js";
import { registerCommercialModule } from "../modules/commercial/registerCommercialModule.js";
import { registerAgronomyModule } from "../modules/agronomy/registerAgronomyModule.js";

type RegisterV1RoutesOptions = {
  mediaDir: string;
};

export function registerV1Routes(app: FastifyInstance, pool: Pool, options: RegisterV1RoutesOptions): void {
  registerDevtoolsModule(app, pool);
  registerSensingModule(app, pool);
  registerFieldModule(app, pool);
  registerDecisionModule(app, pool);
  registerExecutionModule(app, pool);
  registerEvidenceModule(app, pool);
  registerAcceptanceModule(app, pool);
  registerReportingModule(app, pool);
  registerCommercialModule(app, pool);
  registerAgronomyModule(app, pool, { mediaDir: options.mediaDir });
}
