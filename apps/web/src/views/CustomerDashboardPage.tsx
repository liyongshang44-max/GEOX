import React from "react";
import { Link, useLocation } from "react-router-dom";
import { fetchCustomerDashboardAggregate } from "../api/reports";
import { buildCustomerDashboardViewModel, type CustomerDashboardViewModel } from "../viewmodels/customerDashboardViewModel";
import { PageHeader, SectionCard } from "../shared/ui";

export default function CustomerDashboardPage(): React.ReactElement {
  const location = useLocation();
  const [vm, setVm] = React.useState<CustomerDashboardViewModel | null>(null);
  const [error, setError] = React.useState<string>("");

  React.useEffect(() => {
    const params = new URLSearchParams(location.search);
    const fieldId = params.get("field_id") || "";

    void fetchCustomerDashboardAggregate({ fieldId, limit: 5 })
      .then((aggregate) => {
        setVm(buildCustomerDashboardViewModel(aggregate));
        setError("");
      })
      .catch(() => {
        setVm(null);
        setError("暂未获取到可展示的经营数据，请稍后刷新。");
      });
  }, [location.search]);

  return (
    <div className="demoDashboardPage">
      <PageHeader
        eyebrow="GEOX / 客户看板"
        title="客户看板"
        description="围绕经营结果、风险、成本与行动建议展示"
        actions={<Link className="btn" to="/dashboard">切换平台控制台</Link>}
      />

      <SectionCard title={vm?.result.title || "结果（完成/未完成）"}>
        <div>{vm?.result.summary || "本周期暂无结果数据"}</div>
        <div className="muted">{vm?.result.detail || ""}</div>
        <div className="list" style={{ marginTop: 8 }}>
          {(vm?.result.recent || []).map((item, idx) => (
            <div key={`${item.title}-${idx}`} className="item">
              {item.title} · {item.statusText} · {item.whenText}
            </div>
          ))}
          {!vm?.result.recent?.length ? <div className="muted">暂无最近执行记录</div> : null}
        </div>
      </SectionCard>

      <SectionCard title={vm?.riskImpact.title || "风险影响"}>
        <div>{vm?.riskImpact.summary || "暂无风险数据"}</div>
        <div className="muted">{vm?.riskImpact.detail || ""}</div>
        <div className="list" style={{ marginTop: 8 }}>
          {(vm?.riskImpact.signals || []).map((signal, idx) => (
            <div key={`${signal}-${idx}`} className="item">{signal}</div>
          ))}
        </div>
      </SectionCard>

      <SectionCard title={vm?.costTrend.title || "成本趋势"}>
        <div>{vm?.costTrend.summary || "暂无成本数据"}</div>
        <div className="muted">{vm?.costTrend.detail || ""}</div>
      </SectionCard>

      <SectionCard title={vm?.actionAdvice.title || "本周期行动建议"}>
        <div>{vm?.actionAdvice.summary || "暂无行动建议"}</div>
        <div className="list" style={{ marginTop: 8 }}>
          {(vm?.actionAdvice.items || []).map((item, idx) => (
            <div key={`${item}-${idx}`} className="item">{idx + 1}. {item}</div>
          ))}
        </div>
      </SectionCard>

      {error ? <div className="muted" style={{ marginTop: 12 }}>{error}</div> : null}
    </div>
  );
}
