export type DashboardOverviewVm = {
  fieldCount: number;
  normalFieldCount: number;
  riskFieldCount: number;
  todayExecutionCount: number;
  pendingAcceptanceCount: number;
};

export type DashboardActionVm = {
  id: string;
  title: string;
  subjectName: string;
  actionLabel: string;
  occurredAtLabel: string;
  statusLabel: string;
  finalStatus: "pending" | "running" | "succeeded" | "failed";
  hasEvidence: boolean;
  href?: string;
};

export type DashboardEvidenceVm = {
  id: string;
  href?: string;
  fieldName?: string;
  operationName?: string;
  hasReceipt: boolean;
  acceptanceVerdict: string;
  isPendingAcceptance: boolean;
  card: any;
};

export type DashboardVm = {
  overview: DashboardOverviewVm;
  actions: DashboardActionVm[];
  evidences: DashboardEvidenceVm[];
  risks: string[];
};
