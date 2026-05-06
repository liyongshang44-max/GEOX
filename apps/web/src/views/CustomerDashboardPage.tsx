import React from "react";
import { Link } from "react-router-dom";
import { fetchCustomerDashboardAggregate } from "../api/customerReports";
import { buildCustomerDashboardVm, type CustomerDashboardPageVm } from "../viewmodels/customerDashboardVm";

export default function CustomerDashboardPage(): React.ReactElement {
  const [vm, setVm] = React.useState<CustomerDashboardPageVm | null>(null);
  const [error, setError] = React.useState<string>("");

  React.useEffect(() => {
    void fetchCustomerDashboardAggregate()
      .then((aggregate) => {
        setVm(buildCustomerDashboardVm(aggregate));
        setError("");
      })
      .catch(() => {
        setVm(null);
        setError("暂未获取到可展示的经营数据，请稍后刷新。");
      });
  }, []);


  const generatedAt = React.useMemo(() => {
    const now = new Date();
    const pad = (value: number): string => String(value).padStart(2, "0");
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
  }, []);

  const fixedKpiOrder = ["pendingApproval", "highRiskFields", "earlyWarnings", "pendingAcceptance", "weeklyWaterSaved", "managedFields"] as const;

  const fixedKpis = fixedKpiOrder.map((key) => {
    const found = vm?.kpis.find((kpi) => kpi.key === key);
    if (found) return found;
    const fallbackLabel: Record<(typeof fixedKpiOrder)[number], string> = {
      pendingApproval: "待审批处方",
      highRiskFields: "高风险地块",
      earlyWarnings: "异常发现",
      pendingAcceptance: "待验收作业",
      weeklyWaterSaved: "本周节水",
      managedFields: "管理地块",
    };
    return { key, label: fallbackLabel[key], valueText: "--", detailText: "数据更新中" };
  });

  const cleanText = (text: string): string => String(text ?? "").trim();

  const parseRow = (text: string): string[] => text.split(" · ").map((x) => x.trim());

  return (
    <div className="customerPage customerPageGapMd">
      <header className="customerHero">
        <div className="customerHeroTop">
          <div>
            <div className="customerLabel">GEOX / 客户看板 / 经营结果、风险与行动摘要</div>
            <h1 className="customerTitle">经营结果、风险与行动摘要</h1>
          </div>
          <div className="customerActions">
            <div className="muted">生成时间：{generatedAt}</div>
            <Link className="customerButton customerButtonPrimary noPrint" to={vm?.header.exportAction.href ?? "/customer/export"}>
              打印导出
            </Link>
          </div>
        </div>
      </header>

      <section className="customerCard">
        <h3 className="customerReportSectionTitle">经营总览</h3>
        <div className="customerMetrics">
          {fixedKpis.map((kpi) => (
            <article key={kpi.key} className="customerMetricCard">
              <div className="customerMetricLabel">{kpi.label}</div>
              <div className="customerMetricValue">{kpi.valueText}</div>
              <div className="muted">{kpi.detailText}</div>
            </article>
          ))}
        </div>
      </section>

      <section className="customerGrid3">
        <article className="customerCard">
          <h3 className="customerReportSectionTitle">高风险地块 Top 5</h3>
          <ul className="customerList">
            {(vm?.topRiskFields ?? []).map((item) => (
              <li key={item.id} className="customerListItem">
                <div className="customerItemMain">
                  {(() => {
                    const [fieldName = "地块", riskTag = "风险关注", reason = "待复核"] = parseRow(cleanText(item.rowText));
                    return (
                      <>
                        <Link to={item.href}>{fieldName || "地块"}</Link>
                        <span className="customerPill customerPillHigh">{riskTag}</span>
                        <div className="customerItemReason">{reason || "原因待确认"}</div>
                      </>
                    );
                  })()}
                </div>
              </li>
            ))}
            {!(vm?.topRiskFields.length) ? (
              <li className="customerListItem customerItemReason">暂无风险地块数据</li>
            ) : null}
          </ul>
        </article>

        <article className="customerCard">
          <h3 className="customerReportSectionTitle">待处理事项 Top 5</h3>
          <ul className="customerList">
            {(vm?.pendingItems ?? []).map((item) => (
              <li key={item.id} className="customerListItem">
                {(() => {
                  const [name = "事项", status = "待处理", desc = "说明待确认"] = parseRow(cleanText(item.sentence));
                  return (
                    <>
                      <div className="customerItemMain">
                        <Link className="customerItemTitle" to={item.href}>{name}</Link>
                        <span className="customerPill customerPillMedium">{status}</span>
                      </div>
                      <div className="customerItemReason">{desc}</div>
                    </>
                  );
                })()}
              </li>
            ))}
            {!(vm?.pendingItems.length) ? (
              <li className="customerListItem customerItemReason">暂无待处理事项</li>
            ) : null}
          </ul>
        </article>

        <article className="customerCard">
          <h3 className="customerReportSectionTitle">近期作业 Top 5</h3>
          <ul className="customerList">
            {(vm?.recentOperations ?? []).map((item) => (
              <li key={item.operationId} className="customerListItem">
                {(() => {
                  const [operationType = "作业", fieldName = "地块", timeTextRaw = "", statusText = "待确认"] = parseRow(cleanText(item.rowText));
                  const timeText = timeTextRaw || "时间待确认";
                  return (
                    <>
                      <div className="customerItemMain">
                        <Link className="customerItemTitle" to={item.href}>{operationType}</Link>
                        <span className="customerPill">{statusText}</span>
                      </div>
                      <div className="customerItemReason">{fieldName} · {timeText === "时间未知" ? "时间待确认" : timeText}</div>
                    </>
                  );
                })()}
              </li>
            ))}
            {!(vm?.recentOperations.length) ? (
              <li className="customerListItem customerItemReason">暂无近期作业</li>
            ) : null}
          </ul>
        </article>
      </section>

      <section className="customerCard">
        <h3 className="customerCardTitle">下一步建议</h3>
        <div className="customerActionCards customerRecommendationGrid">
          {(vm?.nextActions ?? []).map((item) => (
            <article key={item.id} className="customerRecommendationCard">
              <div className="customerItemTitle">{item.title}</div>
              <div className="customerItemReason customerSpacingTopXs">{item.summary}</div>
              <Link className="customerButton customerSpacingTopSm" to={item.href}>立即处理</Link>
            </article>
          ))}
        </div>
      </section>

      <section className="customerCard">
        <h3 className="customerReportSectionTitle">收益摘要</h3>
        <div className="customerMetrics">
          <article className="customerMetricCard">
            <div className="customerMetricLabel">ROI 条目</div>
            <div className="customerMetricValue">{vm?.roiSummary.totalRoiItems ?? 0}</div>
          </article>
          <article className="customerMetricCard">
            <div className="customerMetricLabel">节水条目</div>
            <div className="customerMetricValue">{vm?.roiSummary.waterSavedItems ?? 0}</div>
          </article>
          <article className="customerMetricCard">
            <div className="customerMetricLabel">客户价值</div>
            <div className="muted">{vm?.roiSummary.customerValueText ?? "--"}</div>
          </article>
        </div>
      </section>

      {!vm && error ? <div className="muted customerSpacingTopMd">{error}</div> : null}

      <footer className="customerCard muted">
        说明：本页用于呈现客户经营结果、风险与行动建议，数据可能受采集与回传时效影响，请以最新审核结论为准。
      </footer>
    </div>
  );
}
