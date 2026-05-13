import { apiRequest } from "./client";
import type { FlightTableRunV1 } from "./flightTable";

export type FlightTableDecisionRunRequestV1 = {
  field_id?: string;
  season_id?: string;
  device_id?: string;
  crop_code?: string;
  prescription_mode?: "standard" | "variable";
  approval_action?: "approve" | "reject" | "return";
};

export type FlightTableDecisionRunResultV1 = {
  ok: true;
  recommendation_id: string;
  prescription_id: string;
  approval_request_id: string;
  approval_status: string;
  operation_plan_id: string | null;
  recommendation_explain: Record<string, unknown> | null;
  prescription_summary: Record<string, unknown>;
  approval_audit: Record<string, unknown>;
  approval_processed_by: string | null;
  contract_answers: {
    what: string;
    where: string;
    when: string;
    how_much: string;
    who_approves: string;
    how_to_accept: string;
  };
  run: FlightTableRunV1;
};

export async function runFlightTableDecision(runId: string, body: FlightTableDecisionRunRequestV1): Promise<FlightTableDecisionRunResultV1> {
  return apiRequest<FlightTableDecisionRunResultV1>(`/api/v1/dev/flight-table/runs/${encodeURIComponent(runId)}/decision/run`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}
