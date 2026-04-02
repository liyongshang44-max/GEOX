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
  finalStatus: "pending" | "running" | "succeeded" | "failed" | "invalid";
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

export type DashboardRiskVm = {
  id: string;
  title: string;
  level: "HIGH" | "MEDIUM" | "LOW";
  source: "干旱" | "病害" | "执行缺失";
  fieldId?: string;
};

export type DashboardDecisionVm = {
  pendingApprovalCount: number;
  pendingRecommendationCount: number;
  potentialBenefitEstimate: string;
  nonExecutionRiskEstimate: string;
};

export type DashboardExecutionVm = {
  runningTaskCount: number;
  humanExecutionCount: number;
  deviceExecutionCount: number;
  delayedTaskCount: number;
  invalidExecutionCount: number;
};

export type DashboardVm = {
  overview: DashboardOverviewVm;
  actions: DashboardActionVm[];
  evidences: DashboardEvidenceVm[];
  risks: string[];
  riskItems: DashboardRiskVm[];
  decisions: DashboardDecisionVm;
  execution: DashboardExecutionVm;
  operationEffect: {
    validCount: number;
    deviationCount: number;
    invalidCount: number;
  };
  metricUnits: {
    soil_moisture: "%";
    temperature: "°C";
    humidity: "%";
  };
  todayActions: Array<{
    type: "INVALID_EXECUTION" | "PENDING_ACCEPTANCE" | "APPROVAL_REQUIRED";
    count: number;
  }>;
  agronomyRecommendations: Array<{
    fieldLabel: string;
    cropLabel: string;
    cropStageLabel: string;
    actionLabel: string;
    priorityLabel: string;
    summary: string;
  }>;
};
