// apps/web/src/features/customer/pages/CustomerDashboardExportPage.tsx
import React from "react";
import { fetchCustomerDashboardAggregate } from "../../../api/customerReports";
import { DashboardExportBlocks } from "../../../components/customer/CustomerExportBlocks";
import PrintReportScaffold from "../../../components/customer/PrintReportScaffold";
import { ProductErrorState, ProductLoadingState } from "../../../design-system/product";
import { buildCustomerDashboardVm, type CustomerDashboardPageVm } from "../../../viewmodels/customerDashboardVm";

export default function CustomerDashboardExportPage(): React.ReactElement {
  const [vm, setVm] = React.useState<CustomerDashboardPageVm | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    let alive = true;
    setLoading(true);
    void fetchCustomerDashboardAggregate()
      .then((aggregate) => {
        if (!alive) return;
        setVm(buildCustomerDashboardVm(aggregate));
        setError("");
      })
      .catch(() => {
        if (!alive) return;
        setVm(null);
        setError("Dashboard report export is unavailable.");
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });
    return () => { alive = false; };
  }, []);

  if (loading) {
    return <div className="customerReportCanvas"><div className="customerReportSheet"><ProductLoadingState label="Loading dashboard report" description="Preparing the print-safe delivery surface." /></div></div>;
  }

  if (error || !vm) {
    return <div className="customerReportCanvas"><div className="customerReportSheet"><ProductErrorState title="Dashboard export unavailable" message={error || "No dashboard report data is available."} /></div></div>;
  }

  return (
    <PrintReportScaffold
      title="Customer dashboard report"
      subtitle="Print-safe customer delivery surface"
      generatedAt={vm.generatedAtText}
      backTo="/customer/dashboard"
    >
      <DashboardExportBlocks vm={vm} />
      <footer className="customerMetricLabel customerSpacingTopMd">Delivery surface only. This export does not include internal controls or diagnostic tooling.</footer>
    </PrintReportScaffold>
  );
}
