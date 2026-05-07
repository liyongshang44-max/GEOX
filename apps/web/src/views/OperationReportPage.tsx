import React from "react";
import { Link, useParams } from "react-router-dom";
import { fetchOperationReport, type OperationReportV1 } from "../api/customerReports";
import SectionSkeleton from "../components/common/SectionSkeleton";
import ErrorState from "../components/common/ErrorState";
import { buildOperationReportVm } from "../viewmodels/operationReportVm";

export default function OperationReportPage(): React.ReactElement {
  const { operationId = "" } = useParams();
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string>("");
  const [report, setReport] = React.useState<OperationReportV1 | null>(null);

  React.useEffect(() => {
    let alive = true;
    setLoading(true);
    setError("");
    void fetchOperationReport(operationId)
      .then((res) => {
        if (!alive) return;
        setReport(res);
      })
      .catch((e: unknown) => {
        if (!alive) return;
        setError(String(e instanceof Error ? e.message : "加载失败"));
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [operationId]);

  if (loading) return <SectionSkeleton kind="detail" />;
  if (error || !report) return <ErrorState title="作业报告加载失败" message={error || "暂无报告"} onRetry={() => window.location.reload()} />;

  const vm = buildOperationReportVm(report);
  const steps = vm.sections.map((section, index) => ({
    n: index + 1,
    title: section.title,
    body: (
      <>
        <div className="customerMetricLabel">{section.summary}</div>
        {section.items.length > 0 ? (
          <div className="customerGrid2 customerSpacingTopXs">
            {section.items.map((item) => <div key={`${section.key}-${item.label}`}><strong>{item.label}：</strong>{item.value}</div>)}
          </div>
        ) : null}
        {section.emptyState ? <div className="customerSpacingTopXs muted">{section.emptyState.title}：{section.emptyState.description}</div> : null}
      </>
    ),
  }));

  return (
    <div className="customerReportCanvas">
      <div className="customerReportSheet">
      <header className="customerHero">
        <div className="customerHeroTop">
          <div>
            <div className="customerReportLogo">GEOX / 作业闭环</div>
            <h1 className="customerTitle">{vm.header.title}</h1>
            <p className="customerSubtitle">{vm.header.subtitle}</p>
          </div>
          <div className="customerActions">
            <Link className="customerButton" to="/customer/dashboard">返回客户看板</Link>
            <Link className="customerButton" to={`/customer/operations/${encodeURIComponent(operationId)}/export`}>导出报告</Link>
          </div>
        </div>
      </header>

      <div className="customerTimeline">
        {steps.map((step) => (
          <section key={step.n} className="customerTimelineStep">
            <div className="customerTimelineDot">{step.n}</div>
            <div className="customerCard">
              <h3 className="customerCardTitle">{step.title}</h3>
              {step.body}
            </div>
          </section>
        ))}
      </div>
      <footer className="customerFooterNote">报告由 GEOX 生成，用于客户经营复盘与沟通。</footer>
      </div>
    </div>
  );
}
