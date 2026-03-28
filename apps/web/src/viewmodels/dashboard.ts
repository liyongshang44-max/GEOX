export type DashboardOverviewVm = {
  inProgressCount: number;
  completedTodayCount: number;
  pendingCount: number;
  riskDeviceCount: number;
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
};

export type DashboardEvidenceVm = any;

export type DashboardVm = {
  overview: DashboardOverviewVm;
  actions: DashboardActionVm[];
  evidences: DashboardEvidenceVm[];
  risks: string[];
};
