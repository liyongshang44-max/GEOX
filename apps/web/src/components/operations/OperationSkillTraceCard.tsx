import React from "react";
import type { OperationSkillTraceItemV2 } from "../../api/operations";
import { StatusPill } from "../../shared/ui";
import { mapSkillRunStatusLabel, mapSkillRunStatusTone } from "../../lib/operationLabels";

export default function OperationSkillTraceCard({ trace }: { trace?: OperationSkillTraceItemV2[] | null }): React.ReactElement {
  const items = (Array.isArray(trace) ? trace : [])
    .map((item, idx) => ({ ...item, _idx: idx }))
    .sort((a, b) => {
      const left = Number(a.started_ts_ms ?? a.finished_ts_ms ?? 0);
      const right = Number(b.started_ts_ms ?? b.finished_ts_ms ?? 0);
      if (left === right) return a._idx - b._idx;
      return left - right;
    });
  return (
    <section className="card operationSkillTraceCard" style={{ marginTop: 12 }}>
      <div className="sectionTitle">技能运行追踪</div>
      <div className="decisionItemMeta" style={{ marginTop: 8 }}>
        按执行诊断时间线展示阶段、状态与解释码。
      </div>
      {!items.length ? <div className="muted" style={{ marginTop: 8 }}>暂无执行诊断记录。</div> : null}
      <div className="operationSkillTraceList">
        {items.map((item, idx) => {
          const resultStatus = String(item?.status || "");
          const explanationCodes = Array.isArray(item?.explanation_codes) ? item.explanation_codes : [];
          return (
            <article key={`${item.run_id || item.stage || "stage"}-${idx}`} className={`operationSkillTraceItem ${!item?.skill_id ? "isWarning" : ""}`}>
              <div className="operationSkillTraceHeader">
                <strong>{item?.stage || "unknown_stage"}</strong>
                <StatusPill tone={mapSkillRunStatusTone(resultStatus)}>{mapSkillRunStatusLabel(resultStatus, "zh")}</StatusPill>
              </div>
              <div className="operationsSummaryGrid" style={{ marginTop: 8 }}>
                <div className="operationsSummaryMetric"><span className="operationsSummaryLabel">skill_id</span><strong>{item?.skill_id || "--"}</strong></div>
                <div className="operationsSummaryMetric">
                  <span className="operationsSummaryLabel">stage</span>
                  <strong>{item?.stage || "--"}</strong>
                </div>
                <div className="operationsSummaryMetric"><span className="operationsSummaryLabel">explanation_codes</span><strong>{explanationCodes.length > 0 ? explanationCodes.join(", ") : "--"}</strong></div>
                <div className="operationsSummaryMetric"><span className="operationsSummaryLabel">run_id</span><strong>{item?.run_id || "--"}</strong></div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
