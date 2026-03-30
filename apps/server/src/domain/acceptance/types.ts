export type AcceptanceVerdict = "PASS" | "FAIL" | "PENDING";

export interface AcceptanceResultV1 {
  acceptance_id: string;
  operation_plan_id: string;
  verdict: AcceptanceVerdict;
  coverage_ratio?: number;
  confidence?: number;
  summary?: string;
  missing_evidence?: string[];
  generated_at: string;
}
