import { apiRequest } from "./client";
import type { FlightTableRunV1 } from "./flightTable";

export type FlightTableReportLearningRunRequestV1 = {
  operation_id?: string;
  field_id?: string;
  acceptance_id?: string;
  evidence_id?: string;
};

export type FlightTableReportLearningRunResultV1 = {
  ok: true;
  operation_id: string;
  field_id: string;
  operation_report_ready: boolean;
  field_report_ready: boolean;
  customer_reports_ready: boolean;
  weather_status: "ok" | "unavailable" | "stub" | "error" | "unknown";
  weather_source: string | null;
  weather_learning_excluded_reason: string | null;
  roi_status: "READY" | "ESTIMATED" | "EMPTY" | "ERROR";
  roi_ids: string[];
  roi_reason: string | null;
  field_memory_status: "READY" | "EMPTY" | "ERROR";
  field_memory_ids: string[];
  field_memory_reason: string | null;
  skill_trace_status: "READY" | "EMPTY" | "ERROR";
  skill_performance_status: "READY" | "EMPTY" | "ERROR";
  learning_closure: "CLOSED" | "EXCLUDED_WEATHER" | "BLOCKED_SKILL_FAILURE" | "PARTIAL" | "OPEN";
  learning_excluded_reason: string | null;
  diagnostic_suggestions: string[];
  ui_urls: string[];
  run: FlightTableRunV1;
};

export async function runFlightTableReportLearning(runId: string, body: FlightTableReportLearningRunRequestV1): Promise<FlightTableReportLearningRunResultV1> {
  return apiRequest<FlightTableReportLearningRunResultV1>(`/api/v1/dev/flight-table/runs/${encodeURIComponent(runId)}/report-learning/run`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}
