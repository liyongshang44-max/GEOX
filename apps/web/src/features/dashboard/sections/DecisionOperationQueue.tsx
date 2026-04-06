import React from "react";
import { Link } from "react-router-dom";
import type { DashboardTopActionItem } from "../../../api/dashboard";
import { buildOperationSummary, mapOperationActionLabel } from "../../../lib/operationLabels";
import { SectionCard } from "../../../shared/ui";
import EmptyState from "../../../components/common/EmptyState";


export default function DecisionOperationQueue({
  topActions,
  runTopAction,
  executingActionId,
  executeFeedback,
  runningActions,
}: {
  topActions: DashboardTopActionItem[];
  runTopAction: (item: DashboardTopActionItem) => Promise<void>;
  executingActionId: string | null;
  executeFeedback: { tone: "success" | "warning" | "neutral"; text: string; operationId?: string } | null;
  runningActions: Array<{ id: string; href?: string; actionLabel: string; statusLabel?: string; finalStatus: string; occurredAtLabel: string }>;
}): React.ReactElement {
  return (
    <SectionCard title="DecisionOperationQueue" subtitle="短链路：决策 → 执行。">
      {executeFeedback ? (
        <div className={`muted ${executeFeedback.tone === "success" ? "traceChipLive" : executeFeedback.tone === "warning" ? "traceChipWarn" : ""}`} style={{ marginTop: 8, padding: 8 }}>
          {executeFeedback.text}
          {executeFeedback.operationId ? (
            <span style={{ marginLeft: 8 }}>
              <Link to={`/operations?operation_plan_id=${encodeURIComponent(executeFeedback.operationId)}`}>查看作业详情</Link>
            </span>
          ) : null}
        </div>
      ) : null}
      <div className="decisionList" style={{ marginTop: 8 }}>
        {topActions.map((item) => (
          <div key={item.operation_id} className="decisionItemStatic">
            <Link to={`/operations?operation_plan_id=${encodeURIComponent(item.operation_id)}`} className="decisionItemLink">
              <div className="decisionItemTitle">{item.action_type} · score {item.global_priority_score ?? item.priority_score}</div>
              <div className="decisionItemMeta">{item.reason}</div>
              <div className="decisionItemMeta">点击进入作业详情或执行页</div>
            </Link>
            <button className="btn" type="button" disabled={!item.execution_ready || executingActionId === item.operation_id} onClick={() => { void runTopAction(item); }}>
              {executingActionId === item.operation_id ? "执行中..." : "一键执行"}
            </button>
          </div>
        ))}
        {!topActions.length ? (
          <EmptyState
            title="下一步：创建首个可执行动作"
            description="请先进入作业列表筛选待处理项，再发起执行。"
          />
        ) : null}
      </div>
      <details style={{ marginTop: 10 }}>
        <summary>历史执行摘要（折叠）</summary>
        <div className="decisionList" style={{ marginTop: 8 }}>
          {runningActions.slice(0, 4).map((a) => (
            <Link key={a.id} to={a.href || "/operations"} className="decisionItemLink">
              <div className="decisionItemTitle">{mapOperationActionLabel(a.actionLabel)}</div>
              <div className="decisionItemMeta">{buildOperationSummary(a.statusLabel || a.finalStatus, a.actionLabel)}</div>
              <div className="muted" style={{ fontSize: 12 }}>更新于 {a.occurredAtLabel}</div>
            </Link>
          ))}
          {!runningActions.length ? (
            <EmptyState
              title="下一步：补齐执行样本"
              description="可先在作业页触发一次执行，系统将自动生成历史摘要。"
            />
          ) : null}
        </div>
      </details>
      <div style={{ marginTop: 8 }}>
        <Link className="btn primary" to="/operations">查看全部作业</Link>
      </div>
    </SectionCard>
  );
}
