// apps/web/src/features/fields/pages/FieldReportExportPage.tsx
import React from "react";
import { useParams } from "react-router-dom";
import { fetchFieldReport, type FieldReportDetailV1 } from "../../../api/customerReports";
import { FieldExportBlocks } from "../../../components/customer/CustomerExportBlocks";
import PrintReportScaffold from "../../../components/customer/PrintReportScaffold";
import { ProductErrorState, ProductLoadingState } from "../../../design-system/product";
import { buildFieldReportVm, type FieldReportPageVm } from "../../../viewmodels/fieldReportVm";

export default function FieldReportExportPage(): React.ReactElement {
  const { fieldId = "" } = useParams();
  const [vm, setVm] = React.useState<FieldReportPageVm | null>(null);
  const [report, setReport] = React.useState<FieldReportDetailV1 | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    let alive = true;
    setLoading(true);
    void fetchFieldReport(fieldId)
      .then((nextReport) => {
        if (!alive) return;
        setReport(nextReport);
        setVm(buildFieldReportVm(nextReport));
        setError("");
      })
      .catch(() => {
        if (!alive) return;
        setReport(null);
        setVm(null);
        setError("Field report export is unavailable.");
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });
    return () => { alive = false; };
  }, [fieldId]);

  if (loading) return <div className="customerReportCanvas"><div className="customerReportSheet"><ProductLoadingState label="Loading field report export" description="Preparing the print-safe delivery surface." /></div></div>;
  if (error || !vm) return <div className="customerReportCanvas"><div className="customerReportSheet"><ProductErrorState title="Field export unavailable" message={error || "No field report data is available."} /></div></div>;

  return (
    <PrintReportScaffold
      title="Field report"
      subtitle={vm.field.fieldName || "Field name pending"}
      generatedAt={vm.generatedAtText}
      backTo={`/customer/fields/${encodeURIComponent(fieldId)}`}
    >
      <FieldExportBlocks vm={vm} report={report} />
      <footer className="customerMetricLabel customerSpacingTopMd">Print-safe customer delivery surface. Interactive controls are not part of this export.</footer>
    </PrintReportScaffold>
  );
}
