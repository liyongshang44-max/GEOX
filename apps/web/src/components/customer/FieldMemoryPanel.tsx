import React from "react";
import { fetchCustomerFieldMemory } from "../../api/customerFieldMemory";
import { buildCustomerFieldMemoryVm, type CustomerFieldMemoryVm } from "../../viewmodels/customerFieldMemoryVm";
import "../../styles/customerFieldMemory.css";

type FieldMemoryPanelProps = {
  fieldId?: unknown;
  operationId?: unknown;
  embeddedMemory?: unknown;
  compact?: boolean;
};

export default function FieldMemoryPanel({ fieldId, operationId, embeddedMemory, compact = false }: FieldMemoryPanelProps): React.ReactElement {
  const [loading, setLoading] = React.useState(true);
  const [vm, setVm] = React.useState<CustomerFieldMemoryVm | null>(null);

  React.useEffect(() => {
    let alive = true;
    setLoading(true);
    void fetchCustomerFieldMemory({ fieldId, operationId, embeddedMemory })
      .then((response) => {
        if (!alive) return;
        setVm(buildCustomerFieldMemoryVm(response));
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [fieldId, operationId, embeddedMemory]);

  if (loading) {
    return <div className="customerFieldMemoryLoading">田块记忆加载中...</div>;
  }

  if (!vm || vm.entries.length === 0) {
    return (
      <div className="customerFieldMemoryEmpty">
        <strong>{vm?.emptyTitle ?? "暂无正式田块记忆"}</strong>
        <p>{vm?.emptyDescription ?? "系统只会在正式验收通过后形成客户可见的田块学习结论；技术调试、模拟或内部记忆不会进入客户页。"}</p>
      </div>
    );
  }

  return (
    <div className={`customerFieldMemoryPanel ${compact ? "isCompact" : ""}`}>
      <div className="customerFieldMemoryHeader">
        <div>
          <p className="customerFieldMemorySubtitle">{vm.subtitle}</p>
          <small>更新时间：{vm.generatedAtText}</small>
        </div>
        <span>{vm.statusText}</span>
      </div>

      <div className="customerFieldMemoryEntries">
        {vm.entries.map((entry, index) => (
          <article key={`${entry.title}-${index}`} className="customerFieldMemoryEntry">
            <div className="customerFieldMemoryEntryHead">
              <strong>{entry.title}</strong>
              <span>{entry.confidenceText}</span>
            </div>
            <div className="customerFieldMemoryLearned">
              <span>系统学到了什么</span>
              <p>{entry.learnedText}</p>
            </div>
            {!compact ? <p className="customerFieldMemorySummary">{entry.summaryText}</p> : null}
            <small>记忆更新时间：{entry.updatedAtText}</small>
            {entry.technicalRefs.length ? (
              <details className="customerFieldMemoryTech">
                <summary>技术引用</summary>
                <div>
                  {entry.technicalRefs.map((ref) => <p key={ref.label}><strong>{ref.label}：</strong>{ref.value}</p>)}
                </div>
              </details>
            ) : null}
          </article>
        ))}
      </div>
    </div>
  );
}
