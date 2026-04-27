import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";

import { registerCoreV1Routes } from "../../routes/registerCoreV1Routes.js";
import { registerDevtoolsModule } from "../devtools/registerDevtoolsModule.js";
import { registerSensingModule } from "../sensing/registerSensingModule.js";
import { registerFieldModule } from "../field/registerFieldModule.js";
import { registerDecisionModule } from "../decision/registerDecisionModule.js";
import { registerExecutionModule } from "../execution/registerExecutionModule.js";
import { registerEvidenceModule } from "../evidence/registerEvidenceModule.js";
import { registerAcceptanceModule } from "../acceptance/registerAcceptanceModule.js";
import { registerReportingModule } from "../reporting/registerReportingModule.js";
import { registerCommercialModule } from "../commercial/registerCommercialModule.js";
import { registerAgronomyModule } from "../agronomy/registerAgronomyModule.js";
import { registerPrescriptionModule } from "../prescription/registerPrescriptionModule.js";
import { registerAsExecutedModule } from "../as_executed/registerAsExecutedModule.js";
import { registerRoiLedgerModule } from "../roi/registerRoiLedgerModule.js";
import { registerJudgeModule } from "../judge/registerJudgeModule.js";
import { registerFieldMemoryModule } from "../field_memory/registerFieldMemoryModule.js";

type RegisterDomainModulesOptions = {
  mediaDir: string;
};

export function registerDomainModules(app: FastifyInstance, pool: Pool, options: RegisterDomainModulesOptions): void {
  registerCoreV1Routes(app, pool);
  registerDevtoolsModule(app, pool);
  registerSensingModule(app, pool);
  registerFieldModule(app, pool);
  registerFieldMemoryModule(app, pool);
  registerDecisionModule(app, pool);
  registerExecutionModule(app, pool);
  registerEvidenceModule(app, pool);
  registerJudgeModule(app, pool);
  registerAcceptanceModule(app, pool);
  registerReportingModule(app, pool);
  registerCommercialModule(app, pool);
  registerAgronomyModule(app, pool, { mediaDir: options.mediaDir });
  registerPrescriptionModule(app, pool);
  registerAsExecutedModule(app, pool);
  registerRoiLedgerModule(app, pool);
}
