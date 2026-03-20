import type { FieldProgramStatusV1 } from "./field_program_v1";

export type FieldProgramTransitionV1 = {
  type: "field_program_transition_v1";
  payload: {
    tenant_id: string;
    project_id: string;
    group_id: string;
    program_id: string;
    from_status?: FieldProgramStatusV1 | null;
    status: FieldProgramStatusV1;
    trigger: string;
    reason?: string | null;
    actor_id?: string | null;
    created_ts: number;
  };
};
