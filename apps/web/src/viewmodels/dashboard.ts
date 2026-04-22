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
  operation_state_v1?: {
    final_status?: string | null;
  };
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
  metricUnits: Record<string, string>;
  diagnosticMetrics: Array<{
    metric: string;
    label: string;
    valueLabel: string;
    sourceLabel?: string;
  }>;
  todayActions: Array<{
    type: "INVALID_EXECUTION" | "PENDING_ACCEPTANCE" | "APPROVAL_REQUIRED" | "GENERAL_REMINDER";
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
  cropStageDistribution: Array<{
    cropLabel: string;
    cropStageLabel: string;
    fieldCount: number;
  }>;
  effectSummary: {
    effectiveCount: number;
    partialCount: number;
    ineffectiveCount: number;
    noDataCount: number;
  };
  agronomyValue: {
    weeklyRecommendationCount: number;
    verdictCounts: {
      SUCCESS: number;
      PARTIAL: number;
      FAILED: number;
      NO_DATA: number;
    };
    successRate: number;
    topRules: Array<{
      ruleId: string;
      successRate: number;
      triggerCount: number;
    }>;
    riskRules: Array<{
      ruleId: string;
      successRate: number;
      triggerCount: number;
    }>;
  };
};
