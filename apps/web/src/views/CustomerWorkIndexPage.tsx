import React from "react";
import { Link } from "react-router-dom";
import { fetchCustomerDashboardAggregate } from "../api/customerReports";
import { CustomerEmptyState } from "../components/customer";
import { getCustomerEmptyState } from "../lib/customerEmptyStates";
import { buildCustomerDashboardVm, type CustomerDashboardPageVm } from "../viewmodels/customerDashboardVm";

export default function CustomerWorkIndexPage(): React.ReactElement {
  const [vm, setVm] = React.useState<CustomerDashboardPageVm | null>(null);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    void fetchCustomerDashboardAggregate()
      .then((aggregate) => {
        setVm(buildCustomerDashboardVm(aggregate));
        setError("");
      })
      .catch(() => {
        setVm(null);
        setError("暂未获取到可展示的作业数据，请稍后刷新。");
      });
  }, []);

  const items = vm?.recentOperations ?? [];
  const emptyState = vm?.emptyStates.NO_RECENT_OPERATIONS ?? getCustomerEmptyState("NO_RECENT_OPERATIONS");

  return (
    <div className="customerPageGapMd customerIndexPage">
      <section className="customerCard customerIndexHero">
        <div>
          <div className="customerEyebrow">GEOX / 作业列表</div>
          <h2 className="customerTitle">近期作业</h2>
          <p className="customerSubtitle">P0 轻量索引页，复用客户驾驶舱 aggregate，不新增后端接口。</p>
        </div>
        <Link className="customerButton" to="/customer/dashboard">返回总览</Link>
      </section>

      <section className="customerCard">
        <div className="customerCardHeaderRow">
          <div>
            <h3 className="customerCardTitle">作业摘要列表</h3>
            <p className="customerMetricLabel">点击任一作业进入八段闭环作业报告。</p>
          </div>
          <span className="customerPill">P0</span>
        </div>

        {items.length ? (
          <div className="customerIndexList customerSpacingTopMd">
            {items.map((item) => (
              <Link key={item.operationId || item.href} className="customerIndexRow" to={item.href}>
                <div>
                  <strong>{item.operationName}</strong>
                  <span>{item.fieldName}</span>
                </div>
                <div>
                  <small>状态</small>
                  <span>{item.stateText}</span>
                </div>
                <div>
                  <small>验收</small>
                  <span>{item.acceptanceText}</span>
                </div>
                <div>
                  <small>更新时间</small>
                  <span>{item.updatedAtText}</span>
                </div>
                <em>查看作业报告</em>
              </Link>
            ))}
          </div>
        ) : (
          <CustomerEmptyState vm={emptyState} />
        )}
        {error ? <p className="muted customerSpacingTopMd">{error}</p> : null}
      </section>
    </div>
  );
}
