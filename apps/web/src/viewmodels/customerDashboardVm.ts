import type { CustomerDashboardAggregateV1 } from "../api/reports";

const numberFmt = new Intl.NumberFormat("zh-CN");
const currencyFmt = new Intl.NumberFormat("zh-CN", { style: "currency", currency: "CNY", maximumFractionDigits: 2 });

export type CustomerDashboardVm = {
  fieldStatus: {
    totalFieldsText: string;
    atRiskText: string;
    highRiskText: string;
    offlineFieldsText: string;
  };
  periodSummary: {
    estimatedCostText: string;
    actualCostText: string;
  };
};

export function buildCustomerDashboardVm(aggregate: CustomerDashboardAggregateV1): CustomerDashboardVm {
  const highRisk = (aggregate.top_risk_fields || []).filter(
    (x) => String(x.risk_level ?? "").toUpperCase() === "HIGH"
  ).length;

  return {
    fieldStatus: {
      totalFieldsText: numberFmt.format(Number(aggregate.fields?.total ?? 0)),
      atRiskText: numberFmt.format(Number(aggregate.fields?.at_risk ?? 0)),
      highRiskText: numberFmt.format(highRisk),
      offlineFieldsText: numberFmt.format(Number(aggregate.device_summary?.offline_fields ?? 0)),
    },
    periodSummary: {
      estimatedCostText: currencyFmt.format(Number(aggregate?.period_summary?.estimated_total_cost ?? 0)),
      actualCostText: currencyFmt.format(Number(aggregate?.period_summary?.actual_total_cost ?? 0)),
    },
  };
}
