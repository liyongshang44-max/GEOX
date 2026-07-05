// apps/web/src/views/CustomerReportExportPage.tsx
import React from "react";
import { useLocation, useParams } from "react-router-dom";
import { fetchCustomerDashboardAggregate, fetchFieldReport, fetchOperationReport } from "../api/customerReports";
import { buildCustomerDashboardVm } from "../viewmodels/customerDashboardVm";
import { buildFieldReportVm } from "../viewmodels/fieldReportVm";
import { buildOperationReportVm } from "../viewmodels/operationReportVm";
import { DashboardExportBlocks, FieldExportBlocks, OperationExportBlocks } from "../components/customer/CustomerExportBlocks";
import PrintReportScaffold from "../components/customer/PrintReportScaffold";
import { localizedText, useLocale } from "../lib/locale";

const COPY = {
  customerReport: { zh: "客户报告", en: "Customer Report" },
  printView: { zh: "客户报告打印版", en: "Customer report print view" },
  fieldPrint: { zh: "地块报告打印版", en: "Field Report print view" },
  operationPrint: { zh: "作业报告打印版", en: "Operation Report print view" },
  dashboardTitle: { zh: "客户看板报告", en: "Dashboard Report" },
  dashboardPrint: { zh: "客户经营总览打印版", en: "Dashboard print view" },
  loading: { zh: "导出页加载中...", en: "Export page is loading..." },
  failed: { zh: "导出页加载失败", en: "Export page failed to load" },
  noData: { zh: "暂无数据", en: "No data" },
  reportSuffix: { zh: "报告", en: " Report" },
};

function withReportSuffix(title: string, suffix: string): string {
  if (!title) return "";
  if (title.endsWith("报告") || title.toLowerCase().endsWith(" report")) return title;
  return `${title}${suffix}`;
}

export default function CustomerReportExportPage(): React.ReactElement {
  const { locale } = useLocale();
  const { fieldId = "", operationId = "" } = useParams();
  const location = useLocation();
  const mode = location.pathname.includes("/customer/fields/") ? "field" : location.pathname.includes("/customer/operations/") ? "operation" : "dashboard";

  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [content, setContent] = React.useState<React.ReactElement | null>(null);
  const [reportTitle, setReportTitle] = React.useState(localizedText(COPY.customerReport, locale));
  const [generatedAtText, setGeneratedAtText] = React.useState("");
  const [backTo, setBackTo] = React.useState("/customer/dashboard");
  const [subtitle, setSubtitle] = React.useState(localizedText(COPY.printView, locale));

  React.useEffect(() => {
    let alive = true;
    setLoading(true);
    setError("");
    setReportTitle(localizedText(COPY.customerReport, locale));
    setGeneratedAtText("");
    setBackTo("/customer/dashboard");
    setSubtitle(localizedText(COPY.printView, locale));

    const load = async (): Promise<void> => {
      if (mode === "field") {
        const report = await fetchFieldReport(fieldId);
        const vm = buildFieldReportVm(report);
        if (!alive) return;
        setReportTitle(vm.field.fieldName || localizedText(COPY.customerReport, locale));
        setGeneratedAtText(vm.generatedAtText);
        setBackTo(`/customer/fields/${encodeURIComponent(fieldId)}`);
        setSubtitle(localizedText(COPY.fieldPrint, locale));
        setContent(<FieldExportBlocks vm={vm} report={report} />);
        return;
      }
      if (mode === "operation") {
        const report = await fetchOperationReport(operationId);
        const vm = buildOperationReportVm(report);
        if (!alive) return;
        const title = String(vm.operation.title || "").trim();
        setReportTitle(withReportSuffix(title, localizedText(COPY.reportSuffix, locale)) || localizedText(COPY.customerReport, locale));
        setGeneratedAtText(vm.generatedAtText);
        setBackTo(`/customer/operations/${encodeURIComponent(operationId)}`);
        setSubtitle(localizedText(COPY.operationPrint, locale));
        setContent(<OperationExportBlocks vm={vm} report={report} />);
        return;
      }
      const aggregate = await fetchCustomerDashboardAggregate();
      const vm = buildCustomerDashboardVm(aggregate);
      if (!alive) return;
      setReportTitle(localizedText(COPY.dashboardTitle, locale));
      setGeneratedAtText(vm.generatedAtText);
      setBackTo("/customer/dashboard");
      setSubtitle(localizedText(COPY.dashboardPrint, locale));
      setContent(<DashboardExportBlocks vm={vm} />);
    };

    void load().catch((e: unknown) => {
      if (!alive) return;
      setContent(null);
      setError(String(e instanceof Error ? e.message : localizedText(COPY.failed, locale)));
    }).finally(() => {
      if (!alive) return;
      setLoading(false);
    });

    return () => { alive = false; };
  }, [fieldId, operationId, mode, locale]);

  if (loading) return <div className="customerReportCanvas"><div className="customerReportSheet">{localizedText(COPY.loading, locale)}</div></div>;
  if (error || !content) return <div className="customerReportCanvas"><div className="customerReportSheet">{localizedText(COPY.failed, locale)}：{error || localizedText(COPY.noData, locale)}</div></div>;

  return <PrintReportScaffold title={reportTitle || localizedText(COPY.customerReport, locale)} subtitle={subtitle} generatedAt={generatedAtText || "--"} backTo={backTo}>{content}</PrintReportScaffold>;
}
