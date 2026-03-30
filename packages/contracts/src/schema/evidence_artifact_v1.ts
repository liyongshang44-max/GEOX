export type EvidenceArtifactV1 = {
  type: "evidence_artifact_v1";
  payload: {
    artifact_id: string;
    act_task_id: string;
    receipt_fact_id?: string;
    kind: "image" | "note";
    url?: string;
    text?: string;
    created_at: string;
    created_by: string;
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
