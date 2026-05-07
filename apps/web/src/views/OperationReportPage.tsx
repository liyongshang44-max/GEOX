import React from "react";
import { Link, useParams } from "react-router-dom";
import { fetchOperationReport, type OperationReportV1 } from "../api/customerReports";
import SectionSkeleton from "../components/common/SectionSkeleton";
import ErrorState from "../components/common/ErrorState";
import { buildOperationReportVm } from "../viewmodels/operationReportVm";
import { customerTimelineStatusLabel } from "../lib/customerLabels";

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
  const canExport = Boolean(operationId.trim());
  const canBackToField = Boolean(vm.operation.fieldId && vm.operation.fieldId !== "--");
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
        <header className="customerHero">{/* OperationHeader */}
          <div className="customerHeroTop">
            <div>
              <div className="customerReportLogo">GEOX / 作业闭环</div>
              <h1 className="customerTitle">{vm.operation.title}</h1>
              <p className="customerSubtitle">地块：{vm.operation.fieldName}</p>
              <p className="customerSubtitle">最终状态：{vm.operation.finalStatusLabel} · 更新时间：{vm.operation.updatedAtText}</p>
            </div>
            <div className="customerActions">
              <Link className="customerButton" to="/customer/dashboard">返回总览</Link>
              {canBackToField ? (
                <Link className="customerButton" to={`/customer/fields/${encodeURIComponent(vm.operation.fieldId)}`}>返回地块</Link>
              ) : (
                <span className="muted">返回地块不可用：缺少地块标识</span>
              )}
              {canExport ? (
                <Link className="customerButton" to={vm.exportHref}>导出报告</Link>
              ) : (
                <span className="muted">导出不可用：缺少作业标识</span>
              )}
            </div>
          </div>
        </header>

        <section className="customerCard customerSpacingBottomSm">{/* OperationStatusSummary */}
          {vm.timeline.map((item) => <span key={item.key} className="customerPill customerSpacingRightXs">{item.label}：{customerTimelineStatusLabel(item.status)}</span>)}
        </section>

        <div className="customerTimeline">{/* ClosedLoopSectionList */}
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

        <details className="customerCard customerSpacingTopSm">{/* TechnicalFoldout */}
          <summary className="customerCardTitle">技术详情</summary>
          <div className="customerSpacingTopXs muted">内部 ID 默认隐藏，如需排障可在此查看。</div>
          <div className="customerGrid2 customerSpacingTopXs">
            {(vm.technicalFoldout?.rows ?? []).map((row) => (
              <div key={row.label}><strong>{row.label}：</strong>{row.value}</div>
            ))}
          </div>
        </details>

        <footer className="customerFooterNote">{/* ExportCTA */}
          <div className="customerSpacingTopXs">报告由 GEOX 生成，用于客户经营复盘与沟通。</div>
        </footer>
      </div>
    </div>
  );
}
