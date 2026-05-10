import type { FlightTableLaneV1, FlightTableStepV1 } from "./flight_table_manifest_v1.js";

export const FLIGHT_TABLE_LANES_V1: FlightTableLaneV1[] = [
  "success",
  "evidence_insufficient",
  "weather_interference",
  "skill_failure",
  "all",
];

export const FLIGHT_TABLE_A0_STEPS_V1: Array<{ step_key: string; label: string }> = [
  { step_key: "A", label: "Field / Customer Scope / Season" },
  { step_key: "A1", label: "Field Spatial / GIS / As-applied" },
  { step_key: "B", label: "Device / Credential / Binding / Capability" },
  { step_key: "C0", label: "Skill Registry / Binding / Trace / Performance" },
  { step_key: "C", label: "Telemetry / Heartbeat / Observation" },
  { step_key: "D", label: "Sensing / Field Read Model" },
  { step_key: "E", label: "Recommendation / Prescription / Approval" },
  { step_key: "F", label: "Operation Plan / AO-ACT / Dispatch / Receipt" },
  { step_key: "G", label: "Evidence / Acceptance / Operation State" },
  { step_key: "H", label: "Report / Weather / ROI / Field Memory" },
  { step_key: "I", label: "Full UI / Export / Release Gate" },
];

export function isFlightTableLaneV1(input: unknown): input is FlightTableLaneV1 {
  return FLIGHT_TABLE_LANES_V1.includes(input as FlightTableLaneV1);
}

export function buildInitialFlightTableStepsV1(nowIso: string): FlightTableStepV1[] {
  return FLIGHT_TABLE_A0_STEPS_V1.map((step) => ({
    ...step,
    status: "PENDING",
    verify_result: "PENDING",
    message: "FT-A0 foundation only. This step is not executed yet.",
    updated_at: nowIso,
  }));
}
