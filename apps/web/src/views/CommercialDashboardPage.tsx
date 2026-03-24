import React from "react";
import { Link } from "react-router-dom";
import { useDashboard } from "../hooks/useDashboard";

type DashboardProps = { expert?: boolean };

function DashboardSummaryCards({
  data,
}: {
  data: { activePrograms: number; priorityPrograms: number; pendingActions: number; dataIssues: number };
}): React.ReactElement {
  const cards = [
    { label: "运行中 Program", value: data.activePrograms, hint: "当前可持续跟进的 Program 数量" },
    { label: "需优先处理", value: data.priorityPrograms, hint: "存在动作/审批/阻断的 Program" },
    { label: "待执行动作", value: data.pendingActions, hint: "已生成且未执行/未审批的动作" },
    { label: "数据缺口 / 低效率", value: data.dataIssues, hint: "当前缺少关键采集数据，影响决策判断" },
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

function PriorityProgramList({ items }: { items: any[] }): React.ReactElement {
  return (
    <section className="card" style={{ padding: 12, display: "grid", gap: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h3 style={{ margin: 0 }}>优先 Program</h3>
        <Link className="btn" to="/programs">查看全部</Link>
      </div>
      {items.map((item) => (
        <article key={item.id} className="card" style={{ padding: 10, display: "grid", gap: 6 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
            <strong>{item.name}</strong>
            <div style={{ display: "flex", gap: 6 }}>
              <span className="pill" style={{ background: item.status === "BLOCKED" ? "#fef3f2" : "#ecfdf3", color: item.status === "BLOCKED" ? "#b42318" : "#027a48" }}>{item.status}</span>
              <span className="pill" style={{ background: "#f2f4f7", color: "#344054" }}>{item.actionStatus}</span>
            </div>
          </div>
          <div className="muted">{item.fieldCrop}</div>
          <div><strong>下一步：</strong>{item.nextStep}</div>
          <div><strong>风险原因：</strong>{item.riskReason}</div>
          <div className="muted">最近更新时间：{item.updatedAt}</div>
        </article>
      ))}
      {items.length === 0 ? <div className="muted">当前无需新增操作，系统将在下一轮数据更新后重新评估。</div> : null}
    </section>
  );
}

function ActionQueue({ items }: { items: any[] }): React.ReactElement {
  return (
    <section className="card" style={{ padding: 12, display: "grid", gap: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h3 style={{ margin: 0 }}>待处理动作</h3>
        <Link className="btn" to="/operations">进入动作中心</Link>
      </div>
      {items.map((action) => (
        <article key={action.id} className="card" style={{ padding: 10, display: "grid", gap: 6 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
            <strong>{action.actionType}</strong>
            <span className="pill" style={{ background: "#f2f4f7", color: "#344054" }}>{action.mode}</span>
          </div>
          <div className="muted">所属 Program：{action.programName}</div>
          <div>原因：{action.reason}</div>
          <div>
            <button type="button" disabled={action.disabled}>{action.buttonText}</button>
          </div>
        </article>
      ))}
      {items.length === 0 ? <div className="muted">当前无需新增操作，系统将在下一轮数据更新后重新评估。</div> : null}
    </section>
  );
}

function RiskPanel({ risks }: { risks: any }): React.ReactElement {
  return (
    <section className="card" style={{ padding: 12, display: "grid", gap: 10 }}>
      <h3 style={{ margin: 0 }}>异常与风险</h3>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
        <div className="card" style={{ padding: 10, display: "grid", gap: 8 }}>
          <strong>验收失败 / 待复核</strong>
          {risks.acceptance.map((item: any, idx: number) => (
            <div key={`${item.programName}-${idx}`} style={{ borderTop: "1px solid #eaecf0", paddingTop: 6 }}>
              <div>{item.title}</div>
              <div className="muted">所属 Program：{item.programName}</div>
              <div>失败原因：{item.reason}</div>
              <div className="muted">{item.suggestion}</div>
            </div>
          ))}
          {risks.acceptance.length === 0 ? <div className="muted">暂无待复核项。</div> : null}
        </div>

        <div className="card" style={{ padding: 10, display: "grid", gap: 8 }}>
          <strong>数据缺口</strong>
          {risks.dataGaps.map((item: any, idx: number) => (
            <div key={`${item.title}-${idx}`} style={{ borderTop: "1px solid #eaecf0", paddingTop: 6 }}>
              <div>{item.title}</div>
              <div>{item.impact}</div>
              <div className="muted">下一步：{item.nextStep}</div>
            </div>
          ))}
          {risks.dataGaps.length === 0 ? <div className="muted">暂无数据缺口。</div> : null}
        </div>
      </div>
    </section>
  );
}

function EvidencePanel({ data }: { data: any }): React.ReactElement {
  return (
    <section className="card" style={{ padding: 12, display: "grid", gap: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h3 style={{ margin: 0 }}>证据与交付</h3>
        <button type="button">导出生产证据包</button>
      </div>
      <p className="muted" style={{ margin: 0 }}>用于客户交付 / 审计 / 溯源证明</p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10 }}>
        <div className="card" style={{ padding: 10 }}>
          <strong>最近证据包</strong>
          {data.recentPackages.map((e: any) => <div key={e.id}>{e.id} / {e.status} / {e.updatedAt}</div>)}
        </div>
        <div className="card" style={{ padding: 10 }}>
          <strong>最近通过验收的作业</strong>
          {data.recentPassed.map((e: any, idx: number) => <div key={`${e.programName}-${idx}`}>{e.programName} / {e.operation}</div>)}
        </div>
        <div className="card" style={{ padding: 10 }}>
          <strong>最近失败的作业</strong>
          {data.recentFailed.map((e: any, idx: number) => <div key={`${e.programName}-${idx}`}>{e.programName} / {e.operation}</div>)}
        </div>
      </div>
    </section>
  );
}

export default function CommercialDashboardPage(_: DashboardProps): React.ReactElement {
  const { loading, error, vm } = useDashboard();

  if (loading) return <div>加载中...</div>;
  if (error) return <div>加载失败</div>;

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <DashboardSummaryCards data={vm.summary} />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
        <PriorityProgramList items={vm.priorityPrograms} />
        <ActionQueue items={vm.pendingActions} />
      </div>

      <RiskPanel risks={vm.risks} />

      <EvidencePanel data={vm.evidence} />
    </div>
  );
}
