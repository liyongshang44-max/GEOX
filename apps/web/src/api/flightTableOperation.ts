import { apiRequest } from "./client";
import type { FlightTableRunV1 } from "./flightTable";

export type FlightTableOperationRunRequestV1 = {
  operation_plan_id?: string;
  prescription_id?: string;
  approval_request_id?: string;
  device_id?: string;
  field_id?: string;
};

export type FlightTableOperationRunResultV1 = {
  ok: true;
  operation_plan_id: string;
  operation_id: string;
  act_task_id: string;
  dispatch_status: string;
  receipt_id: string;
  receipt_status: string;
  as_executed_status: "READY" | "PARTIAL" | "MISSING";
  as_applied_status: "READY" | "PARTIAL" | "MISSING";
  planned_vs_actual_summary: Record<string, unknown>;
  worklist_visible: boolean;
  customer_operation_url: string;
  operator_dispatch_url: string;
  receipt_is_acceptance: false;
  run: FlightTableRunV1;
};

export async function runFlightTableOperation(runId: string, body: FlightTableOperationRunRequestV1): Promise<FlightTableOperationRunResultV1> {
  return apiRequest<FlightTableOperationRunResultV1>(`/api/v1/dev/flight-table/runs/${encodeURIComponent(runId)}/operation/run`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}
