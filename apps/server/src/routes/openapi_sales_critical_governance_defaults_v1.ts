const SALES_CRITICAL_OPERATION_GOVERNANCE_V1 = {
  "/api/v1/customer/reports": {
    get: {
      operationId: "listCustomerReportsV1",
      owner: "reporting-service",
      audience: "customer",
      boundary: "official",
      auth_scope: "customer.report.read or customer.*",
      error_model: "GEOX_STANDARD_ERROR_ENVELOPE_V2",
      contract_ref: "docs/contracts/v2/REPORTING_AND_CUSTOMER_API_CONTRACT_V2.md",
      gate_maturity: "release_gate_candidate",
    },
  },
  "/api/v1/customer/fields": {
    get: {
      operationId: "listCustomerFieldsV1",
      owner: "reporting-service",
      audience: "customer",
      boundary: "official",
      auth_scope: "customer.field.read or customer.*",
      error_model: "GEOX_STANDARD_ERROR_ENVELOPE_V2",
      contract_ref: "docs/contracts/v2/REPORTING_AND_CUSTOMER_API_CONTRACT_V2.md",
      gate_maturity: "release_gate_candidate",
    },
  },
  "/api/v1/customer/operations": {
    get: {
      operationId: "listCustomerOperationsV1",
      owner: "reporting-service",
      audience: "customer",
      boundary: "official",
      auth_scope: "customer.operation.read or customer.*",
      error_model: "GEOX_STANDARD_ERROR_ENVELOPE_V2",
      contract_ref: "docs/contracts/v2/REPORTING_AND_CUSTOMER_API_CONTRACT_V2.md",
      gate_maturity: "release_gate_candidate",
    },
  },
  "/api/v1/reports/operation/{operation_id}": {
    get: {
      operationId: "getOperationReportV1",
      owner: "reporting-service",
      audience: "customer",
      boundary: "official",
      auth_scope: "customer.report.read or customer.*",
      error_model: "GEOX_STANDARD_ERROR_ENVELOPE_V2",
      contract_ref: "docs/contracts/v2/REPORTING_AND_CUSTOMER_API_CONTRACT_V2.md",
      gate_maturity: "release_gate_candidate",
    },
  },
  "/api/v1/reports/field/{field_id}": {
    get: {
      operationId: "getFieldReportV1",
      owner: "reporting-service",
      audience: "customer",
      boundary: "official",
      auth_scope: "customer.report.read or customer.*",
      error_model: "GEOX_STANDARD_ERROR_ENVELOPE_V2",
      contract_ref: "docs/contracts/v2/REPORTING_AND_CUSTOMER_API_CONTRACT_V2.md",
      gate_maturity: "release_gate_candidate",
    },
  },
  "/api/v1/actions/task": { post: { operationId: "createActionTaskV1", owner: "act-service", audience: "operator", boundary: "official", auth_scope: "action.write or ao_act.task.write", error_model: "GEOX_STANDARD_ERROR_ENVELOPE_V2", contract_ref: "docs/contracts/v2/AO_ACT_AO_SENSE_BOUNDARY_V1.md", gate_maturity: "release_gate_candidate" } },
  "/api/v1/actions/receipt": { post: { operationId: "createActionReceiptV1", owner: "act-service", audience: "operator", boundary: "official", auth_scope: "action.write or ao_act.receipt.write", error_model: "GEOX_STANDARD_ERROR_ENVELOPE_V2", contract_ref: "docs/contracts/v2/AO_ACT_AO_SENSE_BOUNDARY_V1.md", gate_maturity: "release_gate_candidate" } },
  "/api/v1/actions/execute": { post: { operationId: "executeActionV1", owner: "act-service", audience: "operator", boundary: "official", auth_scope: "action.write or ao_act.task.write", error_model: "GEOX_STANDARD_ERROR_ENVELOPE_V2", contract_ref: "docs/contracts/v2/AO_ACT_AO_SENSE_BOUNDARY_V1.md", gate_maturity: "release_gate_candidate" } },
  "/api/v1/sense/task": { post: { operationId: "createSenseTaskV1", owner: "facts-service", audience: "operator", boundary: "official", auth_scope: "sense.write or ao_sense.task.write", error_model: "GEOX_STANDARD_ERROR_ENVELOPE_V2", contract_ref: "docs/contracts/v2/AO_ACT_AO_SENSE_BOUNDARY_V1.md", gate_maturity: "release_gate_candidate" } },
  "/api/v1/sense/receipt": { post: { operationId: "createSenseReceiptV1", owner: "facts-service", audience: "operator", boundary: "official", auth_scope: "sense.write or ao_sense.receipt.write", error_model: "GEOX_STANDARD_ERROR_ENVELOPE_V2", contract_ref: "docs/contracts/v2/AO_ACT_AO_SENSE_BOUNDARY_V1.md", gate_maturity: "release_gate_candidate" } },
  "/api/v1/acceptance/evaluate": { post: { operationId: "evaluateAcceptanceV1", owner: "acceptance-service", audience: "operator", boundary: "official", auth_scope: "acceptance.write or acceptance.*", error_model: "GEOX_STANDARD_ERROR_ENVELOPE_V2", contract_ref: "docs/contracts/v2/EVIDENCE_AND_ACCEPTANCE_CONTRACT_V2.md", gate_maturity: "release_gate_candidate" } },
  "/api/v1/evidence-export/jobs": {
    get: { operationId: "listEvidenceExportJobsV1", owner: "facts-service", audience: "operator", boundary: "official", auth_scope: "evidence_export.read or evidence_export.*", error_model: "GEOX_STANDARD_ERROR_ENVELOPE_V2", contract_ref: "docs/contracts/v2/EVIDENCE_EXPORT_S3_V1.md", gate_maturity: "release_gate_candidate" },
    post: { operationId: "createEvidenceExportJobV1", owner: "facts-service", audience: "operator", boundary: "official", auth_scope: "evidence_export.write or evidence_export.*", error_model: "GEOX_STANDARD_ERROR_ENVELOPE_V2", contract_ref: "docs/contracts/v2/EVIDENCE_EXPORT_S3_V1.md", gate_maturity: "release_gate_candidate" }
  },
  "/api/v1/inspection/pest-disease/{inspection_id}": { get: { operationId: "getPestDiseaseInspectionV1", owner: "decision-service", audience: "operator", boundary: "official", auth_scope: "inspection.read or inspection.*", error_model: "GEOX_STANDARD_ERROR_ENVELOPE_V2", contract_ref: "docs/contracts/v2/EVIDENCE_AND_ACCEPTANCE_CONTRACT_V2.md", gate_maturity: "release_gate_candidate" } },
  "/api/v1/devices/{device_id}/status": { get: { operationId: "getDeviceStatusV1", owner: "executor-service", audience: "operator", boundary: "official", auth_scope: "devices.read or devices.*", error_model: "GEOX_STANDARD_ERROR_ENVELOPE_V2", contract_ref: "docs/contracts/v2/API_GOVERNANCE_AND_OPENAPI_V2.md", gate_maturity: "release_gate_candidate" } },
  "/api/v1/fail-safe/events": { get: { operationId: "listFailSafeEventsV1", owner: "admin-service", audience: "admin", boundary: "internal", auth_scope: "security.admin", error_model: "GEOX_STANDARD_ERROR_ENVELOPE_V2", contract_ref: "docs/contracts/v2/API_GOVERNANCE_AND_OPENAPI_V2.md", gate_maturity: "release_gate_candidate" } },
  "/api/v1/manual-takeovers": { get: { operationId: "listManualTakeoversV1", owner: "admin-service", audience: "admin", boundary: "internal", auth_scope: "security.admin", error_model: "GEOX_STANDARD_ERROR_ENVELOPE_V2", contract_ref: "docs/contracts/v2/API_GOVERNANCE_AND_OPENAPI_V2.md", gate_maturity: "release_gate_candidate" } },
} as const;

export function applySalesCriticalOpenApiGovernanceDefaultsV1(spec: any): void {
  const paths = spec?.paths;
  if (!paths || typeof paths !== "object") return;
  for (const [pathKey, methods] of Object.entries(SALES_CRITICAL_OPERATION_GOVERNANCE_V1)) {
    const pathItem = (paths as Record<string, any>)[pathKey];
    if (!pathItem || typeof pathItem !== "object") continue;
    for (const [method, governance] of Object.entries(methods as Record<string, any>)) {
      const operation = pathItem[method];
      if (!operation || typeof operation !== "object") continue;
      if (!operation.operationId) operation.operationId = governance.operationId;
      if (!Array.isArray(operation.security) || operation.security.length === 0) operation.security = [{ bearerAuth: [] }];
      operation["x-geox-governance"] = {
        ...(operation["x-geox-governance"] || {}),
        owner: operation["x-geox-governance"]?.owner || governance.owner,
        audience: operation["x-geox-governance"]?.audience || governance.audience,
        boundary: operation["x-geox-governance"]?.boundary || governance.boundary,
        auth_scope: operation["x-geox-governance"]?.auth_scope || governance.auth_scope,
        error_model: operation["x-geox-governance"]?.error_model || governance.error_model,
        contract_ref: operation["x-geox-governance"]?.contract_ref || governance.contract_ref,
        gate_maturity: operation["x-geox-governance"]?.gate_maturity || governance.gate_maturity,
      };
    }
  }
}
