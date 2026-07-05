// apps/web/src/views/CustomerOperationsIndexPage.tsx
import React from "react";
import { Link } from "react-router-dom";
import { fetchCustomerOperations } from "../api/customerOperations";
import { CustomerEmptyState } from "../components/customer";
import { localizedText, useLocale } from "../lib/locale";
import { buildCustomerOperationsIndexVm, filterCustomerOperations, type CustomerOperationStatusFilter, type CustomerOperationsIndexVm } from "../viewmodels/customerOperationsIndexVm";
import "../styles/customerFields.css";

const COPY = {
  eyebrow: { zh: "GEOX / 作业", en: "GEOX / Operations" },
  title: { zh: "作业列表", en: "Operations" },
  loading: { zh: "作业列表加载中。", en: "Operations are loading." },
  updatedAt: { zh: "数据更新时间", en: "Data updated at" },
  noUpdatedAt: { zh: "暂无更新时间", en: "No update time" },
  back: { zh: "返回总览", en: "Back to Dashboard" },
  progress: { zh: "作业进展", en: "Operation Progress" },
  helper: { zh: "点击作业进入作业报告。列表与作业报告使用同一客户状态口径。", en: "Open an operation to review its Operation Report. The list and report use the same customer status basis." },
  filterAria: { zh: "作业状态筛选", en: "Operation status filter" },
  completedAt: { zh: "完成时间", en: "Completed at" },
  viewReport: { zh: "查看作业报告", en: "View Operation Report" },
};

export default function CustomerOperationsIndexPage(): React.ReactElement {
  const { locale } = useLocale();
  const [vm, setVm] = React.useState<CustomerOperationsIndexVm | null>(null);
  const [selectedStatus, setSelectedStatus] = React.useState<CustomerOperationStatusFilter>("ALL");

  React.useEffect(() => {
    let alive = true;
    void fetchCustomerOperations().then((response) => {
      if (!alive) return;
      setVm(buildCustomerOperationsIndexVm(response));
    });
    return () => {
      alive = false;
    };
  }, []);

  const filteredRows = vm ? filterCustomerOperations(vm.rows, selectedStatus) : [];

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
            <h3 className="customerCardTitle">{localizedText(COPY.progress, locale)}</h3>
            <p className="customerMetricLabel">{localizedText(COPY.helper, locale)}</p>
          </div>
          {vm ? <span className="customerPill">{vm.scopeBadgeText}</span> : null}
        </div>

        {vm ? (
          <div className="customerFilterRow customerSpacingTopMd" role="tablist" aria-label={localizedText(COPY.filterAria, locale)}>
            {vm.filters.map((filter) => (
              <button
                key={filter.key}
                type="button"
                className={`customerFilterButton ${selectedStatus === filter.key ? "isActive" : ""}`}
                onClick={() => setSelectedStatus(filter.key)}
              >
                {filter.label} <span>{filter.count}</span>
              </button>
            ))}
          </div>
        ) : null}

        {filteredRows.length ? (
          <div className="customerIndexList customerSpacingTopMd">
            {filteredRows.map((operation) => (
              <Link key={operation.operationId} className="customerIndexRow customerOperationRow" to={operation.href}>
                <div>
                  <strong>{operation.primaryLine}</strong>
                  <small>{operation.statusLine}</small>
                  {operation.summaryText ? <small>{operation.summaryText}</small> : null}
                  {operation.evidenceExplanation ? <small>{operation.evidenceExplanation}</small> : null}
                </div>
                <div>
                  <span>{localizedText(COPY.completedAt, locale)}：{operation.completedAtText}</span>
                  <small>{operation.operationTypeText}</small>
                </div>
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
