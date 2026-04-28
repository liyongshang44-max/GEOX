import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";

import { registerFieldsV1Routes } from "../../routes/fields_v1.js";
import { registerFieldTagsV1Routes } from "../../routes/field_tags_v1.js";
import { registerFieldTimelineV1Routes } from "../../routes/field_timeline_v1.js";
import { registerFieldProgramStateV1Routes } from "../../routes/field_program_state_v1.js";
import { registerFieldPortfolioV1Routes } from "../../routes/field_portfolio_v1.js";
import { registerProgramsV1Routes } from "../../routes/programs_v1.js";
import { registerFieldMemoryV1Routes } from "../../routes/field_memory_v1.js";
import { registerManagementZonesV1Routes } from "../../routes/management_zones_v1.js";

export function registerFieldModule(app: FastifyInstance, pool: Pool): void {
  registerFieldsV1Routes(app, pool);
  registerFieldTagsV1Routes(app, pool);
  registerFieldTimelineV1Routes(app, pool);
  registerFieldProgramStateV1Routes(app, pool);
  registerFieldPortfolioV1Routes(app, pool);
  registerProgramsV1Routes(app, pool);
  registerFieldMemoryV1Routes(app, pool);
  registerManagementZonesV1Routes(app, pool);
}
