import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";

import { registerSimConfigRoutes } from "../../routes/sim_config.js";
import { registerDeviceSimulatorV1Routes } from "../../routes/device_simulator_v1.js";
import { registerFlightTableV1Routes } from "../../routes/dev/flight_table_v1.js";
import { registerFlightTableSkillRoutesV1 } from "../../routes/dev/flight_table_skills_v1.js";
import { registerFlightTableRunControlRoutesV1 } from "../../routes/dev/flight_table_run_control_v1.js";
import { registerFlightTableTelemetryRoutesV1 } from "../../routes/dev/flight_table_telemetry_v1.js";
import { registerFlightTableDecisionRoutesV1 } from "../../routes/dev/flight_table_decision_v1.js";
import { registerFlightTableOperationRoutesV1 } from "../../routes/dev/flight_table_operation_v1.js";
import { registerFlightTableEvidenceRoutesV1 } from "../../routes/dev/flight_table_evidence_v1.js";
import { registerFlightTableReportLearningRoutesV1 } from "../../routes/dev/flight_table_report_learning_v1.js";
import { isRuntimeDevtoolsEnabledV1 } from "../../runtime/runtime_security_v1.js";

export function isDevtoolsEnabledV1(): boolean {
  return isRuntimeDevtoolsEnabledV1();
}

export function registerDevtoolsModule(app: FastifyInstance, pool: Pool): void {
  if (!isDevtoolsEnabledV1()) {
    app.log.warn({ feature_flag: "GEOX_DEVTOOLS_ENABLED", enabled: false }, "devtools_module_disabled");
    return;
  }

  registerSimConfigRoutes(app);
  registerDeviceSimulatorV1Routes(app, pool);
  registerFlightTableV1Routes(app, pool);
  registerFlightTableSkillRoutesV1(app, pool);
  registerFlightTableRunControlRoutesV1(app);
  registerFlightTableTelemetryRoutesV1(app, pool);
  registerFlightTableDecisionRoutesV1(app, pool);
  registerFlightTableOperationRoutesV1(app, pool);
  registerFlightTableEvidenceRoutesV1(app, pool);
  registerFlightTableReportLearningRoutesV1(app, pool);
}
