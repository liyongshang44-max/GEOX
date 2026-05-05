import React from "react";
import { Link, useParams } from "react-router-dom";
import { fetchFieldReport, type FieldReportDetailV1 } from "../api/customerReports";
import ErrorState from "../components/common/ErrorState";
import SectionSkeleton from "../components/common/SectionSkeleton";
import { PageHeader, SectionCard } from "../shared/ui";
import { buildFieldReportVm } from "../viewmodels/fieldReportVm";

export default function FieldReportPage(): React.ReactElement {
  const { fieldId = "" } = useParams();
  const [loading, setLoading] = React.useState(true);
  const [report, setReport] = React.useState<FieldReportDetailV1 | null>(null);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    let alive = true;
    setLoading(true);
    void fetchFieldReport(fieldId)
      .then((res) => {
        if (!alive) return;
        setReport(res);
        setError("");
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
  }, [fieldId]);

  if (loading) return <SectionSkeleton kind="detail" />;
  if (error || !report) return <ErrorState title="地块报告加载失败" message={error || "暂无地块报告"} onRetry={() => window.location.reload()} />;

  const vm = buildFieldReportVm(report);

  return (
    <div className="demoDashboardPage">
      <PageHeader
        eyebrow="GEOX"
        title="C8-03 地块报告"
        description={vm.hero.subtitle}
        actions={(<><Link className="btn" to="/customer/dashboard">返回客户总览</Link><Link className="btn" to={`/customer/fields/${encodeURIComponent(fieldId)}/export`}>打印导出</Link></>)}
      />

      <SectionCard title="地块概况">
        <div className="kvGrid2">
          {vm.landOverview.map((item) => (
            <div key={item.label}><strong>{item.label}：</strong>{item.value}</div>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="诊断依据">
        <div className="list">
          {vm.diagnosticCards.map((item) => (
            <article key={item.title} className="item">
              <div><strong>{item.title}</strong>：{item.value}</div>
              <div className="muted">{item.detail}</div>
            </article>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="当前状态说明">
        <div>{vm.currentStatus.summary}</div>
        <ul style={{ marginTop: 8 }}>
          {vm.currentStatus.reasons.map((item, idx) => (<li key={`${item}-${idx}`}>{item}</li>))}
        </ul>
      </SectionCard>

      <SectionCard title="近期作业 Top 5">
        <div className="list">
          {vm.recentOperationsTop5.map((item) => (
            <article key={item.id} className="item">
              <div><Link to={item.href}>{item.title}</Link></div>
              <div className="muted">状态：{item.statusText}</div>
              <div className="muted">验收：{item.acceptanceText}</div>
              <div className="muted">生成时间：{item.generatedAtText}</div>
            </article>
          ))}
          {!vm.recentOperationsTop5.length ? <div className="muted">暂无作业报告</div> : null}
        </div>
      </SectionCard>

      <SectionCard title="处方与下一步建议">
        <div className="list">
          {vm.prescriptionCards.map((item) => (
            <article key={item.title} className="item" style={item.title === "审批要求" ? { background: "#fff3e8", border: "1px solid #ffd8b2" } : undefined}>
              <div><strong>{item.title}</strong>：{item.value}</div>
              <div className="muted">{item.detail}</div>
            </article>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="设备与监测">
        <div className="kvGrid2">
          {vm.deviceMonitoring.map((item) => (
            <div key={item.label}><strong>{item.label}：</strong>{item.value}</div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}
