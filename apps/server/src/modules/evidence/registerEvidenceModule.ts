import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";

import { registerEvidenceBundleV1Routes } from "../../routes/evidence_bundle_v1.js";
import { registerEvidenceReportV1Routes } from "../../routes/evidence_report_v1.js";
import { registerEvidenceExportJobsV1Routes } from "../../routes/evidence_export_jobs_v1.js";
import { registerDeliveryEvidenceExportV1Routes } from "../../routes/delivery_evidence_export_v1.js";
import { registerAuditExportV1Routes } from "../../routes/audit_export_v1.js";

export function registerEvidenceModule(app: FastifyInstance, pool: Pool): void {
  registerEvidenceBundleV1Routes(app, pool);
  registerEvidenceReportV1Routes(app, pool);
  registerEvidenceExportJobsV1Routes(app, pool);
  registerDeliveryEvidenceExportV1Routes(app, pool);
  registerAuditExportV1Routes(app, pool);
}
