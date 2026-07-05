// apps/web/src/views/CustomerFieldsIndexPage.tsx
import React from "react";
import { Link } from "react-router-dom";
import { fetchCustomerFields } from "../api/customerFields";
import { CustomerEmptyState } from "../components/customer";
import { localizedText, useLocale } from "../lib/locale";
import { CUSTOMER_SHELL_LABELS } from "../lib/productSurfaceLabels";
import { buildCustomerFieldsIndexVm, filterCustomerFields, type CustomerFieldRiskFilter, type CustomerFieldsIndexVm } from "../viewmodels/customerFieldsIndexVm";
import "../styles/customerFields.css";

const COPY = {
  eyebrow: { zh: "GEOX / 地块", en: "GEOX / Fields" },
  title: { zh: "授权地块", en: "Authorized Fields" },
  loading: { zh: "地块列表加载中。", en: "Field list is loading." },
  updatedAt: { zh: "数据更新时间", en: "Data updated at" },
  noUpdatedAt: { zh: "暂无更新时间", en: "No update time" },
  back: { zh: "返回总览", en: "Back to Dashboard" },
  listTitle: { zh: "地块风险列表", en: "Field Risk List" },
  helper: { zh: "点击地块卡片进入地块报告。", en: "Open a field card to review the Field Report." },
  filterAria: { zh: "地块风险筛选", en: "Field risk filter" },
  noReason: { zh: "暂无风险原因", en: "No risk reason" },
  recentOperation: { zh: "最近作业", en: "Recent operation" },
  viewReport: { zh: "查看地块报告", en: "View Field Report" },
};

export default function CustomerFieldsIndexPage(): React.ReactElement {
  const { locale } = useLocale();
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
          <div className="customerEyebrow">{localizedText(COPY.eyebrow, locale)}</div>
          <h2 className="customerTitle">{localizedText(COPY.title, locale)}</h2>
          <p className="customerSubtitle">{vm?.subtitle ?? localizedText(COPY.loading, locale)}</p>
          <p className="customerMetricLabel">{localizedText(COPY.updatedAt, locale)}：{vm?.generatedAtText ?? localizedText(COPY.noUpdatedAt, locale)}</p>
          {vm?.dataScopeNote ? <p className="customerScopeWarning">{vm.dataScopeNote}</p> : null}
        </div>
        <Link className="customerButton" to="/customer/dashboard">{localizedText(COPY.back, locale)}</Link>
      </section>

      <section className="customerCard">
        <div className="customerCardHeaderRow">
          <div>
            <h3 className="customerCardTitle">{localizedText(COPY.listTitle, locale)}</h3>
            <p className="customerMetricLabel">{localizedText(COPY.helper, locale)}</p>
          </div>
          {vm ? <span className="customerPill">{vm.scopeBadgeText || localizedText(CUSTOMER_SHELL_LABELS.account.authorizedScopeConfirmed, locale)}</span> : null}
        </div>

        {vm ? (
          <div className="customerFilterRow customerSpacingTopMd" role="tablist" aria-label={localizedText(COPY.filterAria, locale)}>
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
                <p>{field.summaryText || field.reasons.join("；") || localizedText(COPY.noReason, locale)}</p>
                <p>{field.cropStageText}</p>
                <p>{localizedText(COPY.recentOperation, locale)}：{field.recentOperationText}</p>
                <p>{localizedText(COPY.updatedAt, locale)}：{field.updatedAtText}</p>
                <em>{localizedText(COPY.viewReport, locale)}</em>
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
