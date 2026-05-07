import React from "react";
import { Link } from "react-router-dom";
import { fetchCustomerDashboardAggregate } from "../api/customerReports";
import { CustomerEmptyState } from "../components/customer";
import { getCustomerEmptyState } from "../lib/customerEmptyStates";
import { buildCustomerDashboardVm, type CustomerDashboardPageVm } from "../viewmodels/customerDashboardVm";

export default function CustomerFieldsIndexPage(): React.ReactElement {
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
        setError("暂未获取到可展示的地块数据，请稍后刷新。");
      });
  }, []);

  const fields = vm?.topRiskFields ?? [];
  const emptyState = vm?.emptyStates.NO_RISK_FIELDS ?? getCustomerEmptyState("NO_RISK_FIELDS");

  return (
    <div className="customerPageGapMd customerIndexPage">
      <section className="customerCard customerIndexHero">
        <div>
          <div className="customerEyebrow">GEOX / 地块列表</div>
          <h2 className="customerTitle">授权地块</h2>
          <p className="customerSubtitle">P0 轻量索引页，复用客户驾驶舱 aggregate，不新增后端接口。</p>
        </div>
        <Link className="customerButton" to="/customer/dashboard">返回总览</Link>
      </section>

      <section className="customerCard">
        <div className="customerCardHeaderRow">
          <div>
            <h3 className="customerCardTitle">地块风险列表</h3>
            <p className="customerMetricLabel">点击任一地块进入地块报告；无 geometry 时不显示地图。</p>
          </div>
          <span className="customerPill">P0</span>
        </div>

        {fields.length ? (
          <div className="customerIndexGrid customerSpacingTopMd">
            {fields.map((field) => (
              <Link key={field.fieldId || field.fieldName} className={"customerIndexTile " + field.riskTone} to={field.href}>
                <div>
                  <strong>{field.fieldName}</strong>
                  <span>{field.riskLabel}</span>
                </div>
                <p>{field.reasons.join("；") || "暂无风险原因"}</p>
                <em>查看地块报告</em>
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
