import React from "react";
import { Link } from "react-router-dom";
import { fetchCustomerOperations } from "../api/customerOperations";
import { CustomerEmptyState } from "../components/customer";
import { buildCustomerOperationsIndexVm, filterCustomerOperations, type CustomerOperationStatusFilter, type CustomerOperationsIndexVm } from "../viewmodels/customerOperationsIndexVm";
import "../styles/customerFields.css";

export default function CustomerOperationsIndexPage(): React.ReactElement {
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
          <div className="customerEyebrow">GEOX / 作业列表</div>
          <h2 className="customerTitle">作业列表</h2>
          <p className="customerSubtitle">{vm?.subtitle ?? "作业列表加载中。"}</p>
          <p className="customerMetricLabel">数据更新时间：{vm?.generatedAtText ?? "暂无更新时间"}</p>
          {vm?.dataScopeNote ? <p className="customerScopeWarning">{vm.dataScopeNote}</p> : null}
        </div>
        <Link className="customerButton" to="/customer/dashboard">返回总览</Link>
      </section>

      <section className="customerCard">
        <div className="customerCardHeaderRow">
          <div>
            <h3 className="customerCardTitle">作业进展</h3>
            <p className="customerMetricLabel">点击作业进入作业闭环报告。</p>
          </div>
          {vm ? <span className="customerPill">{vm.scopeBadgeText}</span> : null}
        </div>

        {vm ? (
          <div className="customerFilterRow customerSpacingTopMd" role="tablist" aria-label="作业状态筛选">
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
                  <strong>{operation.title}</strong>
                  <small>{operation.fieldName}</small>
                </div>
                <div>
                  <span>{operation.statusText}</span>
                  <small>{operation.operationTypeText}</small>
                </div>
                <div>
                  <span>{operation.acceptanceText}</span>
                  <small>验收状态</small>
                </div>
                <div>
                  <span>{operation.evidenceText}</span>
                  <small>证据状态</small>
                </div>
                <div>
                  <span>{operation.updatedAtText}</span>
                  <small>更新时间</small>
                </div>
                <em>查看作业报告</em>
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
