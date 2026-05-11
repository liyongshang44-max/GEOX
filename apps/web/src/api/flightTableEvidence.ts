import { apiRequest } from "./client";
import type { FlightTableRunV1 } from "./flightTable";

export type FlightTableEvidenceLaneV1 = "success" | "evidence_insufficient" | "weather_interference" | "skill_failure";

export type FlightTableEvidenceRunRequestV1 = {
  lane?: FlightTableEvidenceLaneV1;
  operation_id?: string;
  operation_plan_id?: string;
  act_task_id?: string;
  receipt_id?: string;
  field_id?: string;
};

export type FlightTableEvidenceRunResultV1 = {
  ok: true;
  lane: FlightTableEvidenceLaneV1;
  operation_id: string;
  evidence_status: "COMPLETE" | "INSUFFICIENT" | "WEATHER_EXCLUDED" | "UNTRUSTED";
  acceptance_status: string;
  final_status: string;
  evidence_export_job_id: string | null;
  evidence_export_job_status: "PENDING" | "RUNNING" | "DONE" | "FAILED" | "UNKNOWN";
  raw_export_status: string | null;
  sha256: string | null;
  learning_excluded: boolean;
  evidence_by_operation_match: boolean;
  operation_report_evidence_pack_summary: Record<string, unknown>;
  ui_urls: string[];
  run: FlightTableRunV1;
};

export async function runFlightTableEvidence(runId: string, body: FlightTableEvidenceRunRequestV1): Promise<FlightTableEvidenceRunResultV1> {
  return apiRequest<FlightTableEvidenceRunResultV1>(`/api/v1/dev/flight-table/runs/${encodeURIComponent(runId)}/evidence/run`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}
