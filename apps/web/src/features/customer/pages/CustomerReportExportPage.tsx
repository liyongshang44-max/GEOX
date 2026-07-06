// apps/web/src/features/customer/pages/CustomerReportExportPage.tsx
import React from "react";
import { useLocation, useParams } from "react-router-dom";
import { fetchCustomerDashboardAggregate, fetchFieldReport, fetchOperationReport } from "../../../api/customerReports";
import { DashboardExportBlocks, FieldExportBlocks, OperationExportBlocks } from "../../../components/customer/CustomerExportBlocks";
import PrintReportScaffold from "../../../components/customer/PrintReportScaffold";
import { ProductErrorState, ProductLoadingState } from "../../../design-system/product";
import { buildCustomerDashboardVm } from "../../../viewmodels/customerDashboardVm";
import { buildFieldReportVm } from "../../../viewmodels/fieldReportVm";
import { buildOperationReportVm } from "../../../viewmodels/operationReportVm";

export const F1D_CUSTOMER_EXPORT_COPY = [
  "Dashboard", "Fields", "Field Report", "Operations", "Operation Report", "Reports", "Export", "Report", "Download", "Unavailable", "No authorized fields", "Authorized scope",
  "经营总览", "地块", "地块报告", "作业", "作业报告", "报告", "导出", "下载", "不可用", "暂无授权地块", "授权范围",
] as const;

type ExportState = {
  title: string;
  subtitle: string;
  generatedAt: string;
  backTo: string;
  content: React.ReactElement;
};

export default function CustomerReportExportPage(): React.ReactElement {
  const { fieldId = "", operationId = "" } = useParams();
  const location = useLocation();
  const mode = location.pathname.includes("/customer/fields/") ? "field" : location.pathname.includes("/customer/operations/") ? "operation" : "dashboard";
  const [state, setState] = React.useState<ExportState | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    let alive = true;
    setLoading(true);
    setError("");
    setState(null);

    const load = async (): Promise<void> => {
      if (mode === "field") {
        const report = await fetchFieldReport(fieldId);
        const vm = buildFieldReportVm(report);
        if (!alive) return;
        setState({
          title: "Field report",
          subtitle: vm.field.fieldName || "Field name pending",
          generatedAt: vm.generatedAtText,
          backTo: `/customer/fields/${encodeURIComponent(fieldId)}`,
          content: <FieldExportBlocks vm={vm} report={report} />,
        });
        return;
      }

      if (mode === "operation") {
        const report = await fetchOperationReport(operationId);
        const vm = buildOperationReportVm(report);
        if (!alive) return;
        setState({
          title: vm.operation.title || "Operation report",
          subtitle: "Print-safe customer delivery surface",
          generatedAt: vm.generatedAtText,
          backTo: `/customer/operations/${encodeURIComponent(operationId)}`,
          content: <OperationExportBlocks vm={vm} report={report} />,
        });
        return;
      }

      const aggregate = await fetchCustomerDashboardAggregate();
      const vm = buildCustomerDashboardVm(aggregate);
      if (!alive) return;
      setState({
        title: "Customer dashboard report",
        subtitle: "Print-safe customer delivery surface",
        generatedAt: vm.generatedAtText,
        backTo: "/customer/dashboard",
        content: <DashboardExportBlocks vm={vm} />,
      });
    };

    void load()
      .catch(() => {
        if (!alive) return;
        setError("Customer report export is unavailable.");
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });

    return () => { alive = false; };
  }, [fieldId, operationId, mode]);

  if (loading) return <div className="customerReportCanvas"><div className="customerReportSheet"><ProductLoadingState label="Loading customer export" description="Preparing the print-safe delivery surface." /></div></div>;
  if (error || !state) return <div className="customerReportCanvas"><div className="customerReportSheet"><ProductErrorState title="Export unavailable" message={error || "No customer report data is available."} /></div></div>;

  return (
    <PrintReportScaffold title={state.title} subtitle={state.subtitle} generatedAt={state.generatedAt || "--"} backTo={state.backTo}>
      {state.content}
      <footer className="customerMetricLabel customerSpacingTopMd">Print-safe customer delivery surface. Interactive controls are not part of this export.</footer>
    </PrintReportScaffold>
  );
}
