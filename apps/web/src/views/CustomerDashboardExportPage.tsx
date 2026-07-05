// apps/web/src/views/CustomerDashboardExportPage.tsx
import React from "react";
import { fetchCustomerDashboardAggregate } from "../api/customerReports";
import { DashboardExportBlocks } from "../components/customer/CustomerExportBlocks";
import PrintReportScaffold from "../components/customer/PrintReportScaffold";
import { localizedText, useLocale } from "../lib/locale";
import { buildCustomerDashboardVm, type CustomerDashboardPageVm } from "../viewmodels/customerDashboardVm";

const COPY = {
  loading: { zh: "客户看板导出加载中...", en: "Dashboard export is loading..." },
  failed: { zh: "客户看板导出加载失败", en: "Dashboard export failed to load" },
  noData: { zh: "暂无数据", en: "No data" },
  title: { zh: "客户看板报告", en: "Dashboard Report" },
  subtitle: { zh: "客户经营总览打印版", en: "Dashboard print view" },
};

export default function CustomerDashboardExportPage(): React.ReactElement {
  const { locale } = useLocale();
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
      .catch((e: unknown) => {
        if (!alive) return;
        setVm(null);
        setError(String(e instanceof Error ? e.message : localizedText(COPY.failed, locale)));
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [locale]);

  if (loading) return <div className="customerCard" style={{ padding: 16 }}>{localizedText(COPY.loading, locale)}</div>;
  if (error || !vm) return <div className="customerCard" style={{ padding: 16 }}>{localizedText(COPY.failed, locale)}：{error || localizedText(COPY.noData, locale)}</div>;

  return (
    <PrintReportScaffold
      title={localizedText(COPY.title, locale)}
      subtitle={localizedText(COPY.subtitle, locale)}
      generatedAt={vm.generatedAtText}
      backTo="/customer/dashboard"
    >
      <DashboardExportBlocks vm={vm} />
    </PrintReportScaffold>
  );
}
