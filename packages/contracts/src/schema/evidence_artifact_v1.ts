export type EvidenceArtifactSourceLaneV1 =
  | "FORMAL_OPERATION"
  | "SIMULATED_DEV_ONLY"
  | "DEBUG_ONLY"
  | "MANUAL_IMPORT"
  | "UNKNOWN";

export type EvidenceArtifactLevelV1 = "DEBUG" | "FORMAL" | "STRONG";

export type EvidenceArtifactKindV1 =
  | "image"
  | "note"
  | "metric"
  | "trajectory"
  | "water_delivery_receipt"
  | "media"
  | "log"
  | "artifact"
  | string;

export type EvidenceArtifactV1 = {
  type: "evidence_artifact_v1";
  payload: {
    artifact_id: string;
    act_task_id?: string;
    operation_id?: string;
    operation_plan_id?: string;
    receipt_id?: string;
    receipt_fact_id?: string;
    evidence_id?: string;
    field_id?: string;
    kind: EvidenceArtifactKindV1;
    url?: string;
    text?: string;
    artifact_ref?: string;
    sha256?: string;
    summary?: Record<string, unknown>;
    source?: string;

    /** Base-contract trust lane. Dev/flight-table evidence must remain SIMULATED_DEV_ONLY. */
    source_lane?: EvidenceArtifactSourceLaneV1;
    is_simulated?: boolean;
    formal_eligible?: boolean;
    evidence_level?: EvidenceArtifactLevelV1;
    level?: EvidenceArtifactLevelV1;
    run_id?: string;
    dev_source?: string;

    created_at: string;
    created_by?: string;
    execution_time?: {
      start_ts?: number | null;
      end_ts?: number | null;
    };
    location?: Record<string, unknown> | null;
    tenant_id?: string;
    project_id?: string;
    group_id?: string;
  };
};
