import React from "react";
import { Link } from "react-router-dom";
import { PageHeader, SectionCard } from "../shared/ui";

type WorkflowStatus = "UNASSIGNED" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";
type Severity = "P0" | "P1" | "P2" | "P3";

type WorkItem = {
  id: string;
  title: string;
  assignee: string | null;
  workflow_status: WorkflowStatus;
  severity: Severity;
  category: "设备" | "灌溉" | "虫情" | "人工复核";
  field: string;
  related_object: string;
  sla_due_at: string;
  sla_breached: boolean;
  last_note: string;
};

const MOCK_ITEMS: WorkItem[] = [
  {
    id: "WB-2401",
    title: "泵站异常重启",
    assignee: null,
    workflow_status: "UNASSIGNED",
    severity: "P1",
    category: "设备",
    field: "北区 3 号田",
    related_object: "DEV-001 / OP-9281",
    sla_due_at: "2026-04-12T13:00:00Z",
    sla_breached: false,
    last_note: "告警触发，等待值班工程师确认。",
  },
  {
    id: "WB-2402",
    title: "灌溉阀门执行失败复核",
    assignee: "李工",
    workflow_status: "IN_PROGRESS",
    severity: "P0",
    category: "灌溉",
    field: "西南试验田 A",
    related_object: "ACT-482 / DEV-012",
    sla_due_at: "2026-04-12T09:30:00Z",
    sla_breached: true,
    last_note: "现场反馈阀门卡滞，已安排二次确认。",
  },
  {
    id: "WB-2403",
    title: "虫情识别结果人工复审",
    assignee: "王敏",
    workflow_status: "RESOLVED",
    severity: "P2",
    category: "虫情",
    field: "东区示范田",
    related_object: "EVI-9923 / IMG-771",
    sla_due_at: "2026-04-12T16:30:00Z",
    sla_breached: false,
    last_note: "复核完成，建议进入关闭流程。",
  },
  {
    id: "WB-2404",
    title: "异常施肥轨迹关闭确认",
    assignee: "赵峰",
    workflow_status: "CLOSED",
    severity: "P3",
    category: "人工复核",
    field: "南区 1 号田",
    related_object: "OP-9102 / REP-331",
    sla_due_at: "2026-04-12T08:00:00Z",
    sla_breached: false,
    last_note: "证据齐全，班组长已闭环。",
  },
];

type QuickActionType = "assign" | "start" | "note" | "resolve" | "close";

const STATUS_TEXT: Record<WorkflowStatus, string> = {
  UNASSIGNED: "未分配",
  IN_PROGRESS: "处理中",
  RESOLVED: "已解决",
  CLOSED: "已关闭",
};

function matchesQuery(item: WorkItem, q: string): boolean {
  if (!q) return true;
  const raw = `${item.id} ${item.title} ${item.assignee || ""} ${item.field} ${item.related_object} ${item.last_note}`.toLowerCase();
  return raw.includes(q.toLowerCase());
}

function formatDeadline(deadline: string): string {
  const date = new Date(deadline);
  return Number.isNaN(date.getTime()) ? "--" : date.toLocaleString("zh-CN", { hour12: false });
}

export default function OperationsWorkboardPage(): React.ReactElement {
  const [filters, setFilters] = React.useState({
    assignee: "",
    workflow_status: "",
    severity: "",
    category: "",
    sla_breached: "",
    field: "",
    query: "",
  });
  const [items, setItems] = React.useState<WorkItem[]>(MOCK_ITEMS);
  const [quickAction, setQuickAction] = React.useState<{ itemId: string; type: QuickActionType } | null>(null);
  const [quickInput, setQuickInput] = React.useState("");

  const filteredItems = React.useMemo(() => items.filter((item) => {
    if (filters.assignee && (item.assignee || "") !== filters.assignee) return false;
    if (filters.workflow_status && item.workflow_status !== filters.workflow_status) return false;
    if (filters.severity && item.severity !== filters.severity) return false;
    if (filters.category && item.category !== filters.category) return false;
    if (filters.sla_breached === "true" && !item.sla_breached) return false;
    if (filters.sla_breached === "false" && item.sla_breached) return false;
    if (filters.field && !item.field.includes(filters.field)) return false;
    if (!matchesQuery(item, filters.query)) return false;
    return true;
  }), [items, filters]);

  const summary = React.useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return {
      unassigned: filteredItems.filter((x) => x.workflow_status === "UNASSIGNED").length,
      inProgress: filteredItems.filter((x) => x.workflow_status === "IN_PROGRESS").length,
      breached: filteredItems.filter((x) => x.sla_breached).length,
      closedToday: filteredItems.filter((x) => x.workflow_status === "CLOSED" && x.sla_due_at.slice(0, 10) === today).length,
    };
  }, [filteredItems]);

  const submitQuickAction = React.useCallback(() => {
    if (!quickAction) return;
    setItems((prev) => prev.map((item) => {
      if (item.id !== quickAction.itemId) return item;
      if (quickAction.type === "assign") return { ...item, assignee: quickInput || item.assignee, last_note: `指派给 ${quickInput || item.assignee || "--"}` };
      if (quickAction.type === "start") return { ...item, workflow_status: "IN_PROGRESS", last_note: "任务已开始处理。" };
      if (quickAction.type === "note") return { ...item, last_note: quickInput || item.last_note };
      if (quickAction.type === "resolve") return { ...item, workflow_status: "RESOLVED", last_note: quickInput || "已解决，待关闭。" };
      return { ...item, workflow_status: "CLOSED", last_note: quickInput || "任务已关闭。" };
    }));
    setQuickAction(null);
    setQuickInput("");
  }, [quickAction, quickInput]);

  const activeItem = quickAction ? items.find((x) => x.id === quickAction.itemId) : null;

  return (
    <div className="demoDashboardPage">
      <PageHeader
        eyebrow="GEOX / 运营作业台"
        title="Operations Workboard"
        description="统一处理人工作业项：筛选、追 SLA、快速动作闭环。"
        actions={<Link className="btn" to="/operations">返回作业页</Link>}
      />

      <SectionCard title="顶部摘要">
        <div className="kvGrid2">
          <div><strong>未分配：</strong>{summary.unassigned}</div>
          <div><strong>处理中：</strong>{summary.inProgress}</div>
          <div><strong>已超时：</strong>{summary.breached}</div>
          <div><strong>今日关闭：</strong>{summary.closedToday}</div>
        </div>
      </SectionCard>

      <SectionCard title="筛选栏" subtitle="assignee / workflow_status / severity / category / sla_breached / field / query">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 12 }}>
          <input className="input" placeholder="assignee" value={filters.assignee} onChange={(e) => setFilters((x) => ({ ...x, assignee: e.target.value }))} />
          <select className="input" value={filters.workflow_status} onChange={(e) => setFilters((x) => ({ ...x, workflow_status: e.target.value }))}>
            <option value="">workflow_status（全部）</option>
            {Object.entries(STATUS_TEXT).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <select className="input" value={filters.severity} onChange={(e) => setFilters((x) => ({ ...x, severity: e.target.value }))}>
            <option value="">severity（全部）</option>
            {["P0", "P1", "P2", "P3"].map((x) => <option key={x} value={x}>{x}</option>)}
          </select>
          <input className="input" placeholder="category" value={filters.category} onChange={(e) => setFilters((x) => ({ ...x, category: e.target.value }))} />
          <select className="input" value={filters.sla_breached} onChange={(e) => setFilters((x) => ({ ...x, sla_breached: e.target.value }))}>
            <option value="">sla_breached（全部）</option>
            <option value="true">已超时</option>
            <option value="false">未超时</option>
          </select>
          <input className="input" placeholder="field" value={filters.field} onChange={(e) => setFilters((x) => ({ ...x, field: e.target.value }))} />
          <input className="input" placeholder="query" value={filters.query} onChange={(e) => setFilters((x) => ({ ...x, query: e.target.value }))} />
        </div>
      </SectionCard>

      <SectionCard title={`工作项列表（${filteredItems.length}）`}>
        <div className="list">
          {filteredItems.map((item) => (
            <article key={item.id} className="item">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                <div>
                  <strong>{item.id} · {item.title}</strong>
                  <div className="muted">{item.field} · {STATUS_TEXT[item.workflow_status]} · {item.severity}</div>
                </div>
                <span className={`statusTag ${item.sla_breached ? "tone-warning" : "tone-neutral"}`}>{item.sla_breached ? "已超时" : "SLA 正常"}</span>
              </div>
              <div className="kvGrid2" style={{ marginTop: 8 }}>
                <div><strong>assignee：</strong>{item.assignee || "--"}</div>
                <div><strong>SLA：</strong>{formatDeadline(item.sla_due_at)}</div>
                <div><strong>最后备注：</strong>{item.last_note}</div>
                <div><strong>关联对象：</strong>{item.related_object}</div>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
                <button className="btn" type="button" onClick={() => setQuickAction({ itemId: item.id, type: "assign" })}>指派</button>
                <button className="btn" type="button" onClick={() => setQuickAction({ itemId: item.id, type: "start" })}>开始</button>
                <button className="btn" type="button" onClick={() => setQuickAction({ itemId: item.id, type: "note" })}>备注</button>
                <button className="btn warning" type="button" onClick={() => setQuickAction({ itemId: item.id, type: "resolve" })}>解决</button>
                <button className="btn pending" type="button" onClick={() => setQuickAction({ itemId: item.id, type: "close" })}>关闭</button>
              </div>
            </article>
          ))}
        </div>
      </SectionCard>

      {quickAction && activeItem ? (
        <div className="card" style={{ position: "fixed", right: 24, top: 88, width: 360, zIndex: 40 }}>
          <h3 style={{ marginTop: 0 }}>轻操作：{activeItem.id}</h3>
          <p className="muted">动作：{quickAction.type}</p>
          {(quickAction.type === "assign" || quickAction.type === "note" || quickAction.type === "resolve" || quickAction.type === "close") ? (
            <textarea
              className="input"
              rows={4}
              placeholder={quickAction.type === "assign" ? "输入 assignee 名称" : "输入备注"}
              value={quickInput}
              onChange={(e) => setQuickInput(e.target.value)}
            />
          ) : null}
          <div style={{ marginTop: 12, display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <button className="btn" type="button" onClick={() => setQuickAction(null)}>取消</button>
            <button className="btn primary" type="button" onClick={submitQuickAction}>确认</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
