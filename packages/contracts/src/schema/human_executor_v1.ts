export type HumanExecutorStatusV1 = "ACTIVE" | "DISABLED";

export type HumanExecutorV1 = {
  executor_id: string;
  executor_type: "human";
  display_name: string;
  phone?: string;
  team_id?: string | null;
  status: HumanExecutorStatusV1;
  capabilities?: string[];
};

export type ServiceTeamV1 = {
  team_id: string;
  display_name: string;
  status: HumanExecutorStatusV1;
};

export type WorkAssignmentStatusV1 = "ASSIGNED" | "ACCEPTED" | "ARRIVED" | "SUBMITTED" | "CANCELLED";

export type WorkAssignmentV1 = {
  assignment_id: string;
  act_task_id: string;
  executor_id: string;
  assigned_at: string;
  status: WorkAssignmentStatusV1;
};
