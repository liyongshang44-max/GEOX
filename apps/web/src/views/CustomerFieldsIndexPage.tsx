import React from "react";
import { Link } from "react-router-dom";
import { fetchCustomerFields } from "../api/customerFields";
import { CustomerEmptyState } from "../components/customer";
import { buildCustomerFieldsIndexVm, filterCustomerFields, type CustomerFieldRiskFilter, type CustomerFieldsIndexVm } from "../viewmodels/customerFieldsIndexVm";
import "../styles/customerFields.css";

export default function CustomerFieldsIndexPage(): React.ReactElement {
  const [vm, setVm] = React.useState<CustomerFieldsIndexVm | null>(null);
  const [selectedRisk, setSelectedRisk] = React.useState<CustomerFieldRiskFilter>("ALL");

  React.useEffect(() => {
    let alive = true;
    void fetchCustomerFields().then((response) => {
      if (!alive) return;
      setVm(buildCustomerFieldsIndexVm(response));
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
          <p className="customerSubtitle">{vm?.subtitle ?? "地块列表加载中。"}</p>
          <p className="customerMetricLabel">数据更新时间：{vm?.generatedAtText ?? "暂无更新时间"}</p>
          {vm?.dataScopeNote ? <p className="customerScopeWarning">{vm.dataScopeNote}</p> : null}
        </div>
        <Link className="customerButton" to="/customer/dashboard">返回总览</Link>
      </section>

      <section className="customerCard">
        <div className="customerCardHeaderRow">
          <div>
            <h3 className="customerCardTitle">地块风险列表</h3>
            <p className="customerMetricLabel">点击地块卡片进入地块病历。</p>
          </div>
          {vm ? <span className="customerPill">{vm.scopeBadgeText}</span> : null}
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
                <p>{field.summaryText || field.reasons.join("；") || "暂无风险原因"}</p>
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
      </section>
    </div>
  );
}
