import type { Pool } from "pg";

import { startAssignmentExpiryWorker } from "../routes/human_executors_v1.js";
import { startAlertNotificationWorker, startOfflineAlertWorker } from "../routes/alerts_v1.js";
import { startHumanOpsKpiRefreshWorker } from "../routes/human_ops_v1.js";

export function startBackgroundWorkers(pool: Pool): void {
  startOfflineAlertWorker(pool);
  startAlertNotificationWorker(pool);
  startAssignmentExpiryWorker(pool);
  startHumanOpsKpiRefreshWorker(pool);
}
