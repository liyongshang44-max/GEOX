import React from "react";
import { useOperations } from "../hooks/useOperations";

function toneStyle(tone: "success" | "inProgress" | "warning" | "danger"): React.CSSProperties {
  if (tone === "success") return { background: "#ecfdf3", color: "#027a48" };
  if (tone === "inProgress") return { background: "#eff8ff", color: "#175cd3" };
  if (tone === "warning") return { background: "#fffaeb", color: "#b54708" };
  return { background: "#fef3f2", color: "#b42318" };
}

function OperationsSummary({ data }: { data: { ready: number; inProgress: number; completed: number; failed: number } }): React.ReactElement {
  const cards = [
    { label: "待执行", value: data.ready, hint: "已生成但尚未派发至设备" },
    { label: "执行中", value: data.inProgress, hint: "已派发或已收到设备回执" },
    { label: "已完成", value: data.completed, hint: "作业执行已结束" },
    { label: "需复核", value: data.failed, hint: "执行未达标，建议检查或重做" },
  ];

  return (
    <section style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 12 }}>
      {cards.map((card) => (
        <article key={card.label} className="card" style={{ padding: 12, display: "grid", gap: 6 }}>
          <div className="muted">{card.label}</div>
          <div style={{ fontSize: 24, fontWeight: 700 }}>{card.value}</div>
          <div className="muted">{card.hint}</div>
        </article>
      ))}
    </section>
  );
}

function QueueGroup({
  title,
  items,
  onSelect,
  selectedId,
}: {
  title: string;
  items: any[];
  onSelect: (id: string) => void;
  selectedId: string;
}): React.ReactElement {
  return (
    <div className="card" style={{ padding: 10, display: "grid", gap: 8 }}>
      <strong>{title}（{items.length}）</strong>
      {items.map((item) => (
        <button
          key={item.operationId}
          className="btn"
          type="button"
          onClick={() => onSelect(item.operationId)}
          style={{ textAlign: "left", borderColor: selectedId === item.operationId ? "#101828" : undefined }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
            <strong>{item.operationType}</strong>
            <span className="pill" style={toneStyle(item.statusTone)}>{item.status}</span>
          </div>
          <div className="muted">Program：{item.programId}</div>
          <div className="muted">设备 / 地块：{item.deviceField}</div>
          <div className="muted">最近更新时间：{item.updatedAt}</div>
          <div>验收状态：{item.acceptance}</div>
        </button>
      ))}
      {items.length === 0 ? <div className="muted">暂无作业</div> : null}
    </div>
  );
}

function OperationGroups({ groups, onSelect, selectedId }: { groups: any; onSelect: (id: string) => void; selectedId: string }): React.ReactElement {
  return (
    <section style={{ display: "grid", gap: 10 }}>
      <h3 style={{ margin: 0 }}>作业队列（分组）</h3>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
        <QueueGroup title="待执行（READY）" items={groups.ready} onSelect={onSelect} selectedId={selectedId} />
        <QueueGroup title="执行中（DISPATCHED / ACKED）" items={groups.inProgress} onSelect={onSelect} selectedId={selectedId} />
        <QueueGroup title="已完成（SUCCEEDED）" items={groups.completed} onSelect={onSelect} selectedId={selectedId} />
        <QueueGroup title="需复核（FAILED）" items={groups.failed} onSelect={onSelect} selectedId={selectedId} />
      </div>
    </section>
  );
}

function OperationDetail({ item }: { item: any | null }): React.ReactElement {
  if (!item) return <section className="card" style={{ padding: 12 }}>请选择作业查看详情。</section>;

  return (
    <section className="card" style={{ padding: 12, display: "grid", gap: 10 }}>
      <h3 style={{ margin: 0 }}>作业详情</h3>

      <div className="card" style={{ padding: 10, display: "grid", gap: 4 }}>
        <strong>1. 基本信息</strong>
        <div>作业类型：{item.operationType}</div>
        <div>Program：{item.programId}</div>
        <div>设备 / 地块：{item.deviceField}</div>
      </div>

      <div className="card" style={{ padding: 10, display: "grid", gap: 4 }}>
        <strong>2. 执行状态</strong>
        <div>当前状态：{item.status}</div>
        <div className="muted">{item.status === "已回执" ? "系统已收到设备回执，正在等待验收。" : item.status === "已派发" ? "系统正在等待设备回执。" : "状态已更新。"}</div>
      </div>

      <div className="card" style={{ padding: 10, display: "grid", gap: 4 }}>
        <strong>3. 回执信息（Receipt）</strong>
        <div>状态：{item.receipt.status}</div>
        <div>时间：{item.receipt.time}</div>
        <div>设备返回信息：{item.receipt.message}</div>
      </div>

      <div className="card" style={{ padding: 10, display: "grid", gap: 4 }}>
        <strong>4. 验收结果（核心）</strong>
        <div>执行状态：{item.status}</div>
        <div>验收状态：{item.acceptance}</div>
        <div>{item.acceptanceReason}</div>
        <div className="muted">{item.nextSuggestion}</div>
      </div>

      <div className="card" style={{ padding: 10, display: "grid", gap: 4 }}>
        <strong>5. 轨迹 / 证据引用</strong>
        <div>轨迹点数：{item.trajectoryPoints}</div>
        <div>覆盖率：{item.coverage}</div>
        <div>evidence id：{item.evidenceId}</div>
      </div>

      <div className="card" style={{ padding: 10, display: "grid", gap: 4 }}>
        <strong>执行链路</strong>
        <div>Operation Plan → Task({item.taskId}) → Dispatch({item.dispatchCommandId}) → Published(已下行) → Receipt({item.receipt.status}) → Acceptance({item.acceptance})</div>
      </div>
    </section>
  );
}

function OperationEvidence({ item }: { item: any | null }): React.ReactElement {
  return (
    <section className="card" style={{ padding: 12, display: "grid", gap: 8 }}>
      <h3 style={{ margin: 0 }}>证据与导出</h3>
      <div>本作业证据：{item?.evidenceId ?? "-"}</div>
      <button type="button">导出证据包</button>
      <p className="muted" style={{ margin: 0 }}>说明：用于客户交付 / 审计 / 溯源</p>
    </section>
  );
}

export default function OperationsPage(): React.ReactElement {
  const { loading, error, vm, setSelectedOperationId } = useOperations();

  if (loading) return <div>加载中...</div>;
  if (error) return <div>加载失败</div>;

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <OperationsSummary data={vm.summary} />

      <OperationGroups
        groups={vm.groups}
        onSelect={setSelectedOperationId}
        selectedId={vm.selectedOperation?.operationId ?? ""}
      />

      <OperationDetail item={vm.selectedOperation} />

      <OperationEvidence item={vm.selectedOperation} />
    </div>
  );
}
