// GEOX sales-critical OpenAPI governance overlay v1.
//
// This file is consumed by the OpenAPI alignment selfcheck for sales-critical
// paths that must be governed before the large generated OpenAPI document is
// fully normalized. It is not a runtime router.

export const SALES_CRITICAL_OPENAPI_OVERLAY_V1 = {
  "/api/v1/inspection/pest-disease/{inspection_id}": {
    get: {
      owner: "decision-service",
      audience: "operator",
      boundary: "official",
      auth_scope: "inspection.read or inspection.*",
      error_model: "GEOX_STANDARD_ERROR_ENVELOPE_V2",
      contract_ref: "docs/contracts/v2/EVIDENCE_AND_ACCEPTANCE_CONTRACT_V2.md",
      gate_maturity: "release_gate_candidate",
      request_schema: null,
      response_schema: "PestDiseaseInspectionDetailResponseV1",
    },
  },

  "/api/v1/devices/{device_id}/status": {
    get: {
      owner: "executor-service",
      audience: "operator",
      boundary: "official",
      auth_scope: "devices.read or devices.*",
      error_model: "GEOX_STANDARD_ERROR_ENVELOPE_V2",
      contract_ref: "docs/contracts/v2/API_GOVERNANCE_AND_OPENAPI_V2.md",
      gate_maturity: "release_gate_candidate",
      request_schema: null,
      response_schema: "DeviceStatusResponseV1",
    },
  },
} as const;
