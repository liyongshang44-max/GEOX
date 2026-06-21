// GEOX sales-critical OpenAPI governance overlay v1.
//
// Runtime overlay: merged into /api/v1/openapi.json by openapi_v1.ts.

const standardErrorResponseRef = { $ref: "#/components/responses/StandardErrorResponseV2" } as const;

const governance = (owner: string, audience: string, auth_scope: string, contract_ref: string) => ({
  owner,
  audience,
  boundary: "official",
  auth_scope,
  error_model: "GEOX_STANDARD_ERROR_ENVELOPE_V2",
  contract_ref,
  gate_maturity: "release_gate_candidate",
});

const writeJsonBody = (schemaName: string) => ({
  required: true,
  content: {
    "application/json": {
      schema: { $ref: `#/components/schemas/${schemaName}` },
    },
  },
});

const jsonResponse = (schemaName: string, description: string) => ({
  description,
  content: {
    "application/json": {
      schema: { $ref: `#/components/schemas/${schemaName}` },
    },
  },
});

export const SALES_CRITICAL_OPENAPI_PATHS_V1 = {
  "/api/v1/acceptance/results": {
    get: {
      tags: ["acceptance"], summary: "List acceptance results", operationId: "listAcceptanceResultsV1", security: [{ bearerAuth: [] }],
      responses: { "200": jsonResponse("AcceptanceResultsListResponseV1", "Acceptance results list"), "400": standardErrorResponseRef, "401": standardErrorResponseRef, "403": standardErrorResponseRef, "500": standardErrorResponseRef },
      "x-geox-governance": governance("acceptance-service", "operator", "acceptance.read or acceptance.*", "docs/contracts/v2/EVIDENCE_AND_ACCEPTANCE_CONTRACT_V2.md"),
    },
  },
  "/api/v1/reports/customer-dashboard/field-portfolio-summary": {
    get: {
      tags: ["dashboard", "customer"], summary: "Read customer field portfolio summary", operationId: "getCustomerFieldPortfolioSummaryV1", security: [{ bearerAuth: [] }],
      responses: { "200": jsonResponse("CustomerDashboardFieldPortfolioSummaryResponseV1", "Customer field portfolio summary"), "400": standardErrorResponseRef, "401": standardErrorResponseRef, "403": standardErrorResponseRef, "500": standardErrorResponseRef },
      "x-geox-governance": governance("reporting-service", "customer", "summary", "docs/contracts/v2/REPORTING_AND_CUSTOMER_API_CONTRACT_V2.md"),
    },
  },
  "/api/v1/customer/fields/{fieldId}/memory": {
    get: {
      tags: ["customer"], summary: "Read customer-visible field memory", operationId: "getCustomerFieldMemoryV1", security: [{ bearerAuth: [] }],
      parameters: [{ name: "fieldId", in: "path", required: true, schema: { type: "string" } }],
      responses: { "200": jsonResponse("CustomerFieldMemoryResponseV1", "Customer field memory"), "400": standardErrorResponseRef, "401": standardErrorResponseRef, "403": standardErrorResponseRef, "404": standardErrorResponseRef, "500": standardErrorResponseRef },
      "x-geox-governance": governance("reporting-service", "customer", "summary", "docs/contracts/v2/ROI_AND_FIELD_MEMORY_TRUST_LANE_CONTRACT_V2.md"),
    },
  },
  "/api/v1/actions/task/from-operation-plan": {
    post: {
      tags: ["operations"],
      summary: "Create AO-ACT task from READY operation plan",
      operationId: "createTaskFromOperationPlanV1",
      security: [{ bearerAuth: [] }],
      requestBody: writeJsonBody("TaskFromOperationPlanRequestV1"),
      responses: {
        "200": jsonResponse("TaskFromOperationPlanResponseV1", "Operation plan task projection result"),
        "400": standardErrorResponseRef,
        "401": standardErrorResponseRef,
        "403": standardErrorResponseRef,
        "404": standardErrorResponseRef,
        "409": standardErrorResponseRef,
        "500": standardErrorResponseRef,
      },
      "x-geox-governance": {
        ...governance("act-service / executor-service", "operator", "action.task.create", "docs/contracts/v2/AO_ACT_AND_AO_SENSE_BOUNDARY_CONTRACT_V2.md"),
      },
    },
  },

  "/api/v1/inspection/pest-disease/request": { post: { tags: ["operations"], summary: "Create pest-disease inspection request", operationId: "createPestDiseaseInspectionRequestV1", security: [{ bearerAuth: [] }], requestBody: writeJsonBody("PestDiseaseInspectionRequestV1"), responses: { "200": jsonResponse("PestDiseaseInspectionWriteResponseV1", "Inspection request accepted"), "400": standardErrorResponseRef, "401": standardErrorResponseRef, "403": standardErrorResponseRef, "500": standardErrorResponseRef }, "x-geox-governance": governance("decision-service", "operator", "inspection.write or inspection.*", "docs/contracts/v2/EVIDENCE_AND_ACCEPTANCE_CONTRACT_V2.md") } },
  "/api/v1/inspection/pest-disease/observation": { post: { tags: ["operations"], summary: "Submit pest-disease observation", operationId: "submitPestDiseaseObservationV1", security: [{ bearerAuth: [] }], requestBody: writeJsonBody("PestDiseaseObservationRequestV1"), responses: { "200": jsonResponse("PestDiseaseInspectionWriteResponseV1", "Observation accepted"), "400": standardErrorResponseRef, "401": standardErrorResponseRef, "403": standardErrorResponseRef, "500": standardErrorResponseRef }, "x-geox-governance": governance("decision-service", "operator", "inspection.write or inspection.*", "docs/contracts/v2/EVIDENCE_AND_ACCEPTANCE_CONTRACT_V2.md") } },
  "/api/v1/inspection/pest-disease/signal": { post: { tags: ["operations"], summary: "Submit pest-disease signal", operationId: "submitPestDiseaseSignalV1", security: [{ bearerAuth: [] }], requestBody: writeJsonBody("PestDiseaseSignalRequestV1"), responses: { "200": jsonResponse("PestDiseaseInspectionWriteResponseV1", "Signal accepted"), "400": standardErrorResponseRef, "401": standardErrorResponseRef, "403": standardErrorResponseRef, "500": standardErrorResponseRef }, "x-geox-governance": governance("decision-service", "operator", "inspection.write or inspection.*", "docs/contracts/v2/EVIDENCE_AND_ACCEPTANCE_CONTRACT_V2.md") } },
  "/api/v1/inspection/pest-disease/assessment": { post: { tags: ["operations"], summary: "Submit pest-disease assessment", operationId: "submitPestDiseaseAssessmentV1", security: [{ bearerAuth: [] }], requestBody: writeJsonBody("PestDiseaseAssessmentRequestV1"), responses: { "200": jsonResponse("PestDiseaseInspectionWriteResponseV1", "Assessment accepted"), "400": standardErrorResponseRef, "401": standardErrorResponseRef, "403": standardErrorResponseRef, "500": standardErrorResponseRef }, "x-geox-governance": governance("decision-service", "operator", "inspection.write or inspection.*", "docs/contracts/v2/EVIDENCE_AND_ACCEPTANCE_CONTRACT_V2.md") } },
  "/api/v1/inspection/pest-disease/review": { post: { tags: ["operations"], summary: "Submit pest-disease review", operationId: "submitPestDiseaseReviewV1", security: [{ bearerAuth: [] }], requestBody: writeJsonBody("PestDiseaseReviewRequestV1"), responses: { "200": jsonResponse("PestDiseaseInspectionWriteResponseV1", "Review accepted"), "400": standardErrorResponseRef, "401": standardErrorResponseRef, "403": standardErrorResponseRef, "500": standardErrorResponseRef }, "x-geox-governance": governance("decision-service", "operator", "inspection.review or inspection.*", "docs/contracts/v2/EVIDENCE_AND_ACCEPTANCE_CONTRACT_V2.md") } },
  "/api/v1/inspection/pest-disease/acceptance/evaluate": { post: { tags: ["acceptance"], summary: "Evaluate pest-disease acceptance", operationId: "evaluatePestDiseaseAcceptanceV1", security: [{ bearerAuth: [] }], requestBody: writeJsonBody("PestDiseaseAcceptanceEvaluateRequestV1"), responses: { "200": jsonResponse("PestDiseaseAcceptanceEvaluateResponseV1", "Acceptance evaluation result"), "400": standardErrorResponseRef, "401": standardErrorResponseRef, "403": standardErrorResponseRef, "500": standardErrorResponseRef }, "x-geox-governance": governance("acceptance-service", "operator", "acceptance.write or inspection.*", "docs/contracts/v2/EVIDENCE_AND_ACCEPTANCE_CONTRACT_V2.md") } },
  "/api/v1/inspection/pest-disease/{inspection_id}": { get: { tags: ["operations"], summary: "Read pest-disease inspection detail", operationId: "getPestDiseaseInspectionV1", security: [{ bearerAuth: [] }], parameters: [{ name: "inspection_id", in: "path", required: true, schema: { type: "string" } }], responses: { "200": jsonResponse("PestDiseaseInspectionDetailResponseV1", "Inspection detail"), "400": standardErrorResponseRef, "401": standardErrorResponseRef, "403": standardErrorResponseRef, "500": standardErrorResponseRef }, "x-geox-governance": governance("decision-service", "operator", "inspection.read or inspection.*", "docs/contracts/v2/EVIDENCE_AND_ACCEPTANCE_CONTRACT_V2.md") } },

  "/api/v1/devices/{device_id}/positions": { get: { tags: ["devices"], summary: "List device positions", operationId: "listDevicePositionsV1", security: [{ bearerAuth: [] }], parameters: [{ name: "device_id", in: "path", required: true, schema: { type: "string" } }], responses: { "200": jsonResponse("DevicePositionsResponseV1", "Device positions"), "400": standardErrorResponseRef, "401": standardErrorResponseRef, "403": standardErrorResponseRef, "500": standardErrorResponseRef }, "x-geox-governance": governance("executor-service", "operator", "devices.read or devices.*", "docs/contracts/v2/API_GOVERNANCE_AND_OPENAPI_V2.md") } },
  "/api/v1/devices/{device_id}/bind-field": { post: { tags: ["devices"], summary: "Bind device to field", operationId: "bindDeviceFieldV1", security: [{ bearerAuth: [] }], parameters: [{ name: "device_id", in: "path", required: true, schema: { type: "string" } }], requestBody: writeJsonBody("DeviceBindFieldRequestV1"), responses: { "200": jsonResponse("DeviceBindFieldResponseV1", "Device field binding updated"), "400": standardErrorResponseRef, "401": standardErrorResponseRef, "403": standardErrorResponseRef, "500": standardErrorResponseRef }, "x-geox-governance": governance("executor-service", "operator", "devices.write or devices.*", "docs/contracts/v2/API_GOVERNANCE_AND_OPENAPI_V2.md") } },
  "/api/v1/devices/{device_id}/conflicts": { get: { tags: ["devices"], summary: "Read device scheduling conflicts", operationId: "getDeviceConflictsV1", security: [{ bearerAuth: [] }], parameters: [{ name: "device_id", in: "path", required: true, schema: { type: "string" } }], responses: { "200": jsonResponse("DeviceConflictsResponseV1", "Device conflicts"), "400": standardErrorResponseRef, "401": standardErrorResponseRef, "403": standardErrorResponseRef, "500": standardErrorResponseRef }, "x-geox-governance": governance("executor-service", "operator", "devices.read or devices.*", "docs/contracts/v2/API_GOVERNANCE_AND_OPENAPI_V2.md") } },
  "/api/v1/devices/{device_id}/status": { get: { tags: ["devices"], summary: "Get device runtime status", operationId: "getDeviceStatusV1", security: [{ bearerAuth: [] }], parameters: [{ name: "device_id", in: "path", required: true, schema: { type: "string" } }], responses: { "200": jsonResponse("DeviceStatusResponseV1", "Device status"), "400": standardErrorResponseRef, "401": standardErrorResponseRef, "403": standardErrorResponseRef, "500": standardErrorResponseRef }, "x-geox-governance": governance("executor-service", "operator", "devices.read or devices.*", "docs/contracts/v2/API_GOVERNANCE_AND_OPENAPI_V2.md") } },
} as const;

export const SALES_CRITICAL_OPENAPI_SCHEMAS_V1 = {
  TaskFromOperationPlanRequestV1: {
    type: "object",
    required: ["tenant_id", "project_id", "group_id", "field_id", "operation_plan_id", "operator_id", "idempotency_key", "projection_reason"],
    properties: {
      tenant_id: { type: "string" },
      project_id: { type: "string" },
      group_id: { type: "string" },
      field_id: { type: "string" },
      zone_id: { type: "string", nullable: true },
      operation_plan_id: { type: "string" },
      operator_id: { type: "string" },
      idempotency_key: { type: "string" },
      projection_reason: { type: "string" },
    },
    additionalProperties: true,
  },
  TaskFromOperationPlanResponseV1: {
    type: "object",
    required: ["surface", "status", "task_created", "dispatch_created", "receipt_created", "acceptance_created", "roi_created", "field_memory_created"],
    properties: {
      ok: { type: "boolean" },
      surface: { type: "string", enum: ["OPERATOR"], nullable: true },
      status: { type: "string" },
      duplicate: { type: "boolean", nullable: true },
      task_created: { type: "boolean" },
      dispatch_created: { type: "boolean", enum: [false] },
      receipt_created: { type: "boolean", enum: [false] },
      acceptance_created: { type: "boolean", enum: [false] },
      roi_created: { type: "boolean", enum: [false] },
      field_memory_created: { type: "boolean", enum: [false] },
      no_direct_dispatch: { type: "boolean", enum: [true], nullable: true },
      no_receipt_created: { type: "boolean", enum: [true], nullable: true },
      act_task_id: { type: "string", nullable: true },
      ao_act_task_fact_id: { type: "string", nullable: true },
    },
    additionalProperties: true,
  },
  AcceptanceResultsListResponseV1: { type: "object", required: ["ok", "items"], properties: { ok: { type: "boolean" }, items: { type: "array", items: { type: "object", required: ["result_id", "status"], properties: { result_id: { type: "string" }, status: { type: "string" }, inspected_at: { type: "string", format: "date-time", nullable: true } }, additionalProperties: true } } }, additionalProperties: true },
  CustomerDashboardFieldPortfolioSummaryResponseV1: { type: "object", required: ["ok", "portfolio"], properties: { ok: { type: "boolean" }, portfolio: { type: "object", required: ["field_count"], properties: { field_count: { type: "integer", minimum: 0 }, active_operation_count: { type: "integer", minimum: 0 }, risk_level: { type: "string", nullable: true } }, additionalProperties: true } }, additionalProperties: true },
  CustomerFieldMemoryResponseV1: { type: "object", required: ["ok", "field_id", "items"], properties: { ok: { type: "boolean" }, field_id: { type: "string" }, projection_source: { type: "string", nullable: true }, fallback_limited: { type: "boolean", nullable: true }, customer_visible_eligible: { type: "boolean", nullable: true }, data_trust_status: { type: "string", nullable: true }, data_trust_text: { type: "string", nullable: true }, blocking_reasons: { type: "array", items: { type: "string" }, nullable: true }, memory_count: { type: "integer", minimum: 0, nullable: true }, items: { type: "array", items: { type: "object", properties: { memory_id: { type: "string" }, operation_id: { type: "string", nullable: true }, title: { type: "string", nullable: true }, summary_text: { type: "string", nullable: true }, metric_text: { type: "string", nullable: true }, confidence_text: { type: "string", nullable: true }, updated_at: { type: "string", nullable: true }, data_trust_status: { type: "string", nullable: true }, data_trust_text: { type: "string", nullable: true } }, additionalProperties: true } }, memories: { type: "array", items: { type: "object", additionalProperties: true }, nullable: true } }, additionalProperties: true },
  PestDiseaseInspectionRequestV1: { type: "object", required: ["inspection_id", "field_id"], properties: { inspection_id: { type: "string" }, field_id: { type: "string" }, notes: { type: "string", nullable: true } }, additionalProperties: true },
  PestDiseaseObservationRequestV1: { type: "object", required: ["inspection_id", "observation"], properties: { inspection_id: { type: "string" }, observation: { type: "string" }, evidence_refs: { type: "array", items: { type: "string" } } }, additionalProperties: true },
  PestDiseaseSignalRequestV1: { type: "object", required: ["inspection_id", "signal_type"], properties: { inspection_id: { type: "string" }, signal_type: { type: "string" }, score: { type: "number", nullable: true } }, additionalProperties: true },
  PestDiseaseAssessmentRequestV1: { type: "object", required: ["inspection_id", "assessment"], properties: { inspection_id: { type: "string" }, assessment: { type: "string" }, confidence: { type: "number", nullable: true } }, additionalProperties: true },
  PestDiseaseReviewRequestV1: { type: "object", required: ["inspection_id", "decision"], properties: { inspection_id: { type: "string" }, decision: { type: "string" }, reviewer_note: { type: "string", nullable: true } }, additionalProperties: true },
  PestDiseaseAcceptanceEvaluateRequestV1: { type: "object", required: ["inspection_id", "acceptance_rule_id"], properties: { inspection_id: { type: "string" }, acceptance_rule_id: { type: "string" }, expected_outcome: { type: "string", nullable: true } }, additionalProperties: true },
  PestDiseaseInspectionWriteResponseV1: { type: "object", required: ["ok", "inspection_id", "status"], properties: { ok: { type: "boolean" }, inspection_id: { type: "string" }, status: { type: "string" } }, additionalProperties: true },
  PestDiseaseAcceptanceEvaluateResponseV1: { type: "object", required: ["ok", "inspection_id", "acceptance_result"], properties: { ok: { type: "boolean" }, inspection_id: { type: "string" }, acceptance_result: { type: "string" }, reason: { type: "string", nullable: true } }, additionalProperties: true },
  PestDiseaseInspectionDetailResponseV1: { type: "object", required: ["ok", "inspection"], properties: { ok: { type: "boolean" }, inspection: { type: "object", required: ["inspection_id", "status"], properties: { inspection_id: { type: "string" }, status: { type: "string" }, field_id: { type: "string", nullable: true } }, additionalProperties: true } }, additionalProperties: true },
  DevicePositionsResponseV1: { type: "object", required: ["ok", "positions"], properties: { ok: { type: "boolean" }, positions: { type: "array", items: { type: "object", properties: { ts: { type: "string", nullable: true }, lat: { type: "number", nullable: true }, lon: { type: "number", nullable: true } }, additionalProperties: true } } }, additionalProperties: true },
  DeviceBindFieldRequestV1: { type: "object", required: ["field_id"], properties: { field_id: { type: "string" } }, additionalProperties: true },
  DeviceBindFieldResponseV1: { type: "object", required: ["ok", "device_id", "field_id"], properties: { ok: { type: "boolean" }, device_id: { type: "string" }, field_id: { type: "string" } }, additionalProperties: true },
  DeviceConflictsResponseV1: { type: "object", required: ["ok", "conflicts"], properties: { ok: { type: "boolean" }, conflicts: { type: "array", items: { type: "object", properties: { conflict_id: { type: "string" }, reason: { type: "string", nullable: true } }, additionalProperties: true } } }, additionalProperties: true },
  DeviceStatusResponseV1: { type: "object", required: ["ok", "device_id", "status"], properties: { ok: { type: "boolean" }, device_id: { type: "string" }, status: { type: "string" }, last_seen_at: { type: "string", nullable: true }, source: { type: "string", nullable: true } }, additionalProperties: true },
  StandardErrorEnvelopeV2: { type: "object", required: ["ok", "error"], properties: { ok: { type: "boolean", enum: [false] }, error: { type: "object", required: ["code", "message", "category", "retryable"], properties: { code: { type: "string" }, message: { type: "string" }, category: { type: "string" }, retryable: { type: "boolean" } }, additionalProperties: true } }, additionalProperties: true },
} as const;
