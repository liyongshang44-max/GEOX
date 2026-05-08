import React from "react";
import { Link } from "react-router-dom";
import { fetchCustomerFields } from "../api/customerFields";
import { CustomerEmptyState } from "../components/customer";
import { buildCustomerFieldsIndexVm, filterCustomerFields, type CustomerFieldRiskFilter, type CustomerFieldsIndexVm } from "../viewmodels/customerFieldsIndexVm";
import "../styles/customerFields.css";

export default function CustomerFieldsIndexPage(): React.ReactElement {
  const [vm, setVm] = React.useState<CustomerFieldsIndexVm | null>(null);
  const [error, setError] = React.useState("");
  const [selectedRisk, setSelectedRisk] = React.useState<CustomerFieldRiskFilter>("ALL");

  React.useEffect(() => {
    let alive = true;
    void fetchCustomerFields()
      .then((response) => {
        if (!alive) return;
        setVm(buildCustomerFieldsIndexVm(response));
        setError("");
      })
      .catch(() => {
        if (!alive) return;
        setVm(null);
        setError("暂未获取到可展示的地块数据，请稍后刷新。");
      });
    return () => {
      alive = false;
    };
  }, []);

  const filteredCards = vm ? filterCustomerFields(vm.cards, selectedRisk) : [];

  return (
    <div className="customerPageGapMd customerIndexPage">
      <section className="customerCard customerIndexHero">
        <div>
          <div className="customerEyebrow">GEOX / 地块列表</div>
          <h2 className="customerTitle">授权地块</h2>
          <p className="customerSubtitle">{vm?.subtitle ?? "查看授权地块、风险状态与地块报告入口。"}</p>
          <p className="customerMetricLabel">数据更新时间：{vm?.generatedAtText ?? "暂无更新时间"}</p>
          {vm?.isFallback ? <p className="customerScopeWarning">{vm.dataScopeNote || "当前展示近期/可见地块，非完整授权列表"}</p> : null}
        </div>
        <Link className="customerButton" to="/customer/dashboard">返回总览</Link>
      </section>

      <section className="customerCard">
        <div className="customerCardHeaderRow">
          <div>
            <h3 className="customerCardTitle">地块风险列表</h3>
            <p className="customerMetricLabel">点击地块卡片进入地块病历。</p>
          </div>
          {vm?.isFallback ? <span className="customerPill">P1-A Preview</span> : <span className="customerPill">正式列表</span>}
        </div>

        {vm ? (
          <div className="customerFilterRow customerSpacingTopMd" role="tablist" aria-label="地块风险筛选">
            {vm.filters.map((filter) => (
              <button
                key={filter.key}
                type="button"
                className={`customerFilterButton ${selectedRisk === filter.key ? "isActive" : ""}`}
                onClick={() => setSelectedRisk(filter.key)}
              >
                {filter.label} <span>{filter.count}</span>
              </button>
            ))}
          </div>
        ) : null}

        {filteredCards.length ? (
          <div className="customerIndexGrid customerSpacingTopMd">
            {filteredCards.map((field) => (
              <Link key={field.fieldId} className={"customerIndexTile " + field.riskTone} to={field.href}>
                <div>
                  <strong>{field.fieldName}</strong>
                  <span>{field.riskLabel}</span>
                </div>
                <p>{field.reasons.join("；") || "暂无风险原因"}</p>
                <p>{field.cropStageText}</p>
                <p>最近作业：{field.recentOperationText}</p>
                <p>更新时间：{field.updatedAtText}</p>
                <em>查看地块病历</em>
              </Link>
            ))}
          </div>
        ) : vm ? (
          <CustomerEmptyState vm={vm.emptyState} />
        ) : null}
        {error ? <p className="muted customerSpacingTopMd">{error}</p> : null}
      </section>
    </div>
  );
}
