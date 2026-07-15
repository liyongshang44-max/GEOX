import React from "react";
import {
  evidenceRecords,
  fields,
  forecastSeries,
  moistureSeries,
  prototypeSections,
  scenarios,
  workflow,
  type FieldSnapshot,
  type PrototypeSection,
  type ScenarioOption,
} from "./prototypeData";
import "./controlledPilotPrototype.css";

function statusClass(status: FieldSnapshot["status"]): string {
  if (status === "stable") return "is-stable";
  if (status === "observe") return "is-observe";
  return "is-action";
}

function linePoints(values: number[], width: number, height: number, min: number, max: number): string {
  const range = Math.max(max - min, 1);
  return values
    .map((value, index) => {
      const x = (index / Math.max(values.length - 1, 1)) * width;
      const y = height - ((value - min) / range) * height;
      return `${x},${y}`;
    })
    .join(" ");
}

function LogoMark(): React.ReactElement {
  return (
    <div className="geox-prototype__logo-mark" aria-hidden="true">
      <span />
      <span />
      <span />
    </div>
  );
}

function StatusDot({ tone }: { tone: "live" | "pending" | "neutral" }): React.ReactElement {
  return <span className={`geox-prototype__status-dot is-${tone}`} aria-hidden="true" />;
}

function MetricCard({ label, value, meta, accent }: { label: string; value: string; meta: string; accent?: boolean }): React.ReactElement {
  return (
    <article className={`geox-prototype__metric-card${accent ? " is-accent" : ""}`}>
      <p>{label}</p>
      <strong>{value}</strong>
      <span>{meta}</span>
    </article>
  );
}

function FieldMap({ activeFieldId, onSelect }: { activeFieldId: string; onSelect: (fieldId: string) => void }): React.ReactElement {
  return (
    <div className="geox-prototype__map" aria-label="试点田块空间概览">
      <div className="geox-prototype__map-grid" />
      <button
        type="button"
        className={`geox-prototype__plot geox-prototype__plot--north${activeFieldId === "field-n17" ? " is-selected" : ""}`}
        onClick={() => onSelect("field-n17")}
      >
        <span>N17</span>
        <small>31% VWC</small>
      </button>
      <button
        type="button"
        className={`geox-prototype__plot geox-prototype__plot--east${activeFieldId === "field-e04" ? " is-selected" : ""}`}
        onClick={() => onSelect("field-e04")}
      >
        <span>E04</span>
        <small>46% VWC</small>
      </button>
      <button
        type="button"
        className={`geox-prototype__plot geox-prototype__plot--south${activeFieldId === "field-s09" ? " is-selected" : ""}`}
        onClick={() => onSelect("field-s09")}
      >
        <span>S09</span>
        <small>38% VWC</small>
      </button>
      <div className="geox-prototype__map-scale"><span /> 250 m</div>
      <div className="geox-prototype__map-coordinate">34.8217°N · 113.6684°E</div>
    </div>
  );
}

function EvidenceList({ compact = false }: { compact?: boolean }): React.ReactElement {
  const records = compact ? evidenceRecords.slice(0, 4) : evidenceRecords;
  return (
    <div className="geox-prototype__evidence-list">
      {records.map((record) => (
        <article key={record.id} className="geox-prototype__evidence-row">
          <StatusDot tone={record.status === "verified" ? "live" : "pending"} />
          <div>
            <strong>{record.source}</strong>
            <span>{record.kind} · {record.observedAt}</span>
          </div>
          <code>{record.id}</code>
        </article>
      ))}
    </div>
  );
}

function WorkflowRail(): React.ReactElement {
  return (
    <div className="geox-prototype__workflow-rail">
      {workflow.map((step, index) => (
        <React.Fragment key={step.id}>
          <article className={`geox-prototype__workflow-step is-${step.state}`}>
            <div>{step.state === "complete" ? "✓" : String(index + 1).padStart(2, "0")}</div>
            <strong>{step.label}</strong>
            <span>{step.detail}</span>
          </article>
          {index < workflow.length - 1 ? <div className={`geox-prototype__workflow-link is-${step.state}`} /> : null}
        </React.Fragment>
      ))}
    </div>
  );
}

function OverviewSection({ field, onFieldSelect, onOpenScenarios }: { field: FieldSnapshot; onFieldSelect: (fieldId: string) => void; onOpenScenarios: () => void }): React.ReactElement {
  return (
    <div className="geox-prototype__section-stack">
      <section className="geox-prototype__hero-panel">
        <div>
          <p className="geox-prototype__eyebrow">CONTROLLED PILOT · LIVE SNAPSHOT</p>
          <h1>从农田事实到受控执行</h1>
          <p className="geox-prototype__hero-copy">GEOX 将现实证据、状态估计、情景推演、人工授权和执行回执组织为一条可回放的数字孪生工作链。</p>
          <div className="geox-prototype__hero-actions">
            <button type="button" className="geox-prototype__button is-primary" onClick={onOpenScenarios}>查看当前决策周期</button>
            <button type="button" className="geox-prototype__button is-secondary" onClick={() => onFieldSelect("field-n17")}>打开田块孪生</button>
          </div>
        </div>
        <div className="geox-prototype__hero-status">
          <span className="geox-prototype__hero-pulse" />
          <div>
            <strong>运行链已同步</strong>
            <span>最近事实：20:19:31</span>
          </div>
        </div>
      </section>

      <section className="geox-prototype__metrics-grid">
        <MetricCard label="受控田块" value="3" meta="106.6 ha 试点范围" />
        <MetricCard label="在线证据源" value="11 / 12" meta="1 个设备降级运行" />
        <MetricCard label="当前决策周期" value="1" meta="等待人工复核" accent />
        <MetricCard label="事实链" value="298" meta="过去 24 小时新增" />
      </section>

      <section className="geox-prototype__two-column">
        <article className="geox-prototype__panel geox-prototype__panel--map">
          <header className="geox-prototype__panel-header">
            <div><p>SPATIAL STATE</p><h2>田块运行态势</h2></div>
            <span>实时快照</span>
          </header>
          <FieldMap activeFieldId={field.id} onSelect={onFieldSelect} />
          <div className="geox-prototype__field-summary">
            <div>
              <span className={`geox-prototype__field-status ${statusClass(field.status)}`}>{field.statusLabel}</span>
              <h3>{field.name}</h3>
              <p>{field.crop} · {field.area} · 最近观测 {field.lastObserved}</p>
            </div>
            <div className="geox-prototype__moisture-gauge">
              <span style={{ "--gauge-value": `${field.moisture}%` } as React.CSSProperties} />
              <strong>{field.moisture}%</strong>
              <small>根区含水率</small>
            </div>
          </div>
        </article>

        <article className="geox-prototype__panel">
          <header className="geox-prototype__panel-header">
            <div><p>DECISION CYCLE</p><h2>当前闭环状态</h2></div>
            <span className="is-attention">需人工确认</span>
          </header>
          <WorkflowRail />
        </article>
      </section>

      <section className="geox-prototype__two-column geox-prototype__two-column--balanced">
        <article className="geox-prototype__panel">
          <header className="geox-prototype__panel-header">
            <div><p>EVIDENCE LEDGER</p><h2>最近证据</h2></div>
            <button type="button">查看完整链</button>
          </header>
          <EvidenceList compact />
        </article>
        <article className="geox-prototype__panel geox-prototype__panel--decision">
          <p className="geox-prototype__eyebrow">SYSTEM POSITION</p>
          <h2>系统没有自动下达灌溉任务</h2>
          <p>当前只形成了可比较的情景集合。时间窗、设备可用性与最终参数仍需操作员授权，授权前不会生成 AO-ACT 任务。</p>
          <div className="geox-prototype__boundary-strip">
            <span>状态估计</span><b>已形成</b>
            <span>方案比较</span><b>已形成</b>
            <span>执行授权</span><b className="is-pending">未发生</b>
          </div>
        </article>
      </section>
    </div>
  );
}

function TwinSection({ field }: { field: FieldSnapshot }): React.ReactElement {
  const observedPoints = linePoints(moistureSeries, 640, 180, 20, 50);
  const forecastPoints = linePoints(forecastSeries, 420, 180, 20, 50);

  return (
    <div className="geox-prototype__section-stack">
      <section className="geox-prototype__section-heading">
        <div><p className="geox-prototype__eyebrow">FIELD TWIN · {field.id.toUpperCase()}</p><h1>{field.name}</h1><span>{field.crop} · {field.area} · 状态估计版本 estimate_2d41</span></div>
        <div className="geox-prototype__version-chip">Snapshot 20:19:31</div>
      </section>

      <section className="geox-prototype__twin-grid">
        <article className="geox-prototype__panel geox-prototype__panel--chart">
          <header className="geox-prototype__panel-header"><div><p>ROOT-ZONE WATER STATE</p><h2>观测与短期预测</h2></div><span>置信度 86%</span></header>
          <div className="geox-prototype__chart-legend"><span className="is-observed">观测值</span><span className="is-forecast">预测值</span><span className="is-threshold">管理阈值</span></div>
          <div className="geox-prototype__line-chart">
            <div className="geox-prototype__chart-y"><span>50%</span><span>40%</span><span>30%</span><span>20%</span></div>
            <svg viewBox="0 0 1060 210" role="img" aria-label="根区含水率观测和预测曲线">
              <line x1="0" y1="147" x2="1060" y2="147" className="geox-prototype__threshold-line" />
              <polyline points={observedPoints} className="geox-prototype__observed-line" transform="translate(0 15)" />
              <polyline points={forecastPoints} className="geox-prototype__forecast-line" transform="translate(640 15)" />
              <line x1="640" y1="0" x2="640" y2="210" className="geox-prototype__now-line" />
              <circle cx="640" cy="129" r="6" className="geox-prototype__now-dot" />
            </svg>
            <div className="geox-prototype__chart-x"><span>过去 24h</span><span>现在</span><span>未来 36h</span></div>
          </div>
          <div className="geox-prototype__chart-callout"><strong>当前判断</strong><p>若未来 24 小时无有效降雨或补水，根区含水率预计进入当前管理阈值以下。</p></div>
        </article>

        <aside className="geox-prototype__twin-side">
          <article className="geox-prototype__panel">
            <header className="geox-prototype__panel-header"><div><p>STATE VECTOR</p><h2>状态向量</h2></div></header>
            <div className="geox-prototype__state-vector">
              <div><span>0–20 cm</span><strong>27%</strong><small>下降</small></div>
              <div><span>20–40 cm</span><strong>31%</strong><small>下降</small></div>
              <div><span>40–60 cm</span><strong>38%</strong><small>稳定</small></div>
              <div><span>24h 降雨</span><strong>0.0 mm</strong><small>已核验</small></div>
              <div><span>蒸散需求</span><strong>5.7 mm</strong><small>预测</small></div>
            </div>
          </article>
          <article className="geox-prototype__panel">
            <header className="geox-prototype__panel-header"><div><p>PROVENANCE</p><h2>估计来源</h2></div></header>
            <div className="geox-prototype__provenance-stack">
              <div><span>01</span><p><strong>原始事实</strong> VWC、降雨、设备状态</p></div>
              <div><span>02</span><p><strong>版本化输入</strong> Forecast v17、Field profile v4</p></div>
              <div><span>03</span><p><strong>派生对象</strong> Water State Estimate v1</p></div>
            </div>
          </article>
        </aside>
      </section>

      <section className="geox-prototype__panel">
        <header className="geox-prototype__panel-header"><div><p>DATA SUFFICIENCY</p><h2>证据覆盖</h2></div><span>满足当前估计门槛</span></header>
        <div className="geox-prototype__coverage-grid">
          <div><span>时间覆盖率</span><strong>96%</strong><i style={{ width: "96%" }} /></div>
          <div><span>必需指标覆盖</span><strong>5 / 5</strong><i style={{ width: "100%" }} /></div>
          <div><span>最大连续缺口</span><strong>8 min</strong><i style={{ width: "72%" }} /></div>
          <div><span>设备时钟偏移</span><strong>1.8 s</strong><i style={{ width: "89%" }} /></div>
        </div>
      </section>
    </div>
  );
}

function ScenarioCard({ scenario, selected, onSelect }: { scenario: ScenarioOption; selected: boolean; onSelect: () => void }): React.ReactElement {
  return (
    <button type="button" className={`geox-prototype__scenario-card${selected ? " is-selected" : ""}`} onClick={onSelect}>
      <div className="geox-prototype__scenario-card-head">
        <span>{scenario.recommended ? "同源比较优选" : "备选方案"}</span>
        <i>{selected ? "已选中" : "查看"}</i>
      </div>
      <h3>{scenario.label}</h3>
      <p>{scenario.subtitle}</p>
      <div className="geox-prototype__scenario-stats">
        <div><span>用水量</span><strong>{scenario.waterMm} mm</strong></div>
        <div><span>预测含水率</span><strong>{scenario.projectedMoisture}%</strong></div>
        <div><span>置信度</span><strong>{scenario.confidence}%</strong></div>
      </div>
    </button>
  );
}

function ScenariosSection({ selectedScenarioId, onScenarioSelect, reviewSubmitted, onSubmitReview }: { selectedScenarioId: string; onScenarioSelect: (scenarioId: string) => void; reviewSubmitted: boolean; onSubmitReview: () => void }): React.ReactElement {
  const selected = scenarios.find((scenario) => scenario.id === selectedScenarioId) ?? scenarios[1];

  return (
    <div className="geox-prototype__section-stack">
      <section className="geox-prototype__section-heading">
        <div><p className="geox-prototype__eyebrow">SCENARIO SET · scenario_set_07</p><h1>同一现实状态下的三种未来</h1><span>所有方案共享同一组事实、状态估计和天气预测版本。</span></div>
        <div className="geox-prototype__version-chip">不可直接执行</div>
      </section>

      <section className="geox-prototype__scenario-grid">
        {scenarios.map((scenario) => <ScenarioCard key={scenario.id} scenario={scenario} selected={scenario.id === selected.id} onSelect={() => onScenarioSelect(scenario.id)} />)}
      </section>

      <section className="geox-prototype__scenario-detail-grid">
        <article className="geox-prototype__panel geox-prototype__panel--scenario-detail">
          <header className="geox-prototype__panel-header"><div><p>SELECTED SCENARIO</p><h2>{selected.label}</h2></div><span>{selected.startWindow}</span></header>
          <p className="geox-prototype__scenario-note">{selected.note}</p>
          <div className="geox-prototype__comparison-bars">
            <div><span>预计状态恢复</span><i><b style={{ width: `${selected.projectedMoisture * 1.7}%` }} /></i><strong>{selected.projectedMoisture}%</strong></div>
            <div><span>模型置信度</span><i><b style={{ width: `${selected.confidence}%` }} /></i><strong>{selected.confidence}%</strong></div>
            <div><span>资源效率</span><i><b style={{ width: `${selected.resourceIndex}%` }} /></i><strong>{selected.resourceIndex}</strong></div>
          </div>
          <div className="geox-prototype__assumption-box">
            <strong>必须由人确认的条件</strong>
            <ul>
              <li>北区泵站在计划时间窗内可用；</li>
              <li>分区阀组 V-17A / V-17B 已完成现场检查；</li>
              <li>计划用水量未超出当日人工授权额度。</li>
            </ul>
          </div>
        </article>

        <aside className="geox-prototype__panel geox-prototype__review-panel">
          <p className="geox-prototype__eyebrow">HUMAN AUTHORIZATION</p>
          <h2>{reviewSubmitted ? "已提交人工复核" : "下一步不是自动执行"}</h2>
          <p>{reviewSubmitted ? "该方案已进入操作员复核队列。系统仍未创建 AO-ACT 任务。" : "系统只提交方案、证据和约束。操作员确认后，执行层才能接收正式任务对象。"}</p>
          <div className="geox-prototype__review-facts">
            <div><span>建议参数</span><strong>{selected.waterMm} mm</strong></div>
            <div><span>建议时间窗</span><strong>{selected.startWindow}</strong></div>
            <div><span>执行对象</span><strong>尚未绑定</strong></div>
          </div>
          <button type="button" className="geox-prototype__button is-primary is-wide" onClick={onSubmitReview} disabled={reviewSubmitted}>{reviewSubmitted ? "等待操作员处理" : "提交人工复核"}</button>
          <small>此操作仅改变原型中的本地展示状态，不调用正式 API。</small>
        </aside>
      </section>
    </div>
  );
}

function ExecutionSection(): React.ReactElement {
  return (
    <div className="geox-prototype__section-stack">
      <section className="geox-prototype__section-heading">
        <div><p className="geox-prototype__eyebrow">AO-ACT · CONTROLLED EXECUTION</p><h1>任务、执行与回执必须分开</h1><span>“已发送”不等于“已执行”，“已执行”也不等于“效果已验证”。</span></div>
        <div className="geox-prototype__version-chip">示例历史闭环</div>
      </section>

      <section className="geox-prototype__execution-board">
        <article className="geox-prototype__panel geox-prototype__task-card">
          <div className="geox-prototype__task-card-top"><span>AO-ACT TASK</span><code>act_20260714_0042</code></div>
          <h2>北区 12 号田块 · 分区灌溉</h2>
          <p>由操作员 Li Q. 于 2026-07-14 21:42 授权</p>
          <div className="geox-prototype__task-grid">
            <div><span>动作类型</span><strong>IRRIGATE</strong></div>
            <div><span>目标范围</span><strong>zone_N12_B</strong></div>
            <div><span>时间窗口</span><strong>22:00–00:30</strong></div>
            <div><span>目标水量</span><strong>16 mm</strong></div>
            <div><span>执行器</span><strong>gateway_pump_03</strong></div>
            <div><span>约束</span><strong>pressure ≤ 0.42 MPa</strong></div>
          </div>
        </article>

        <div className="geox-prototype__execution-arrow"><span>任务下发</span><b>→</b></div>

        <article className="geox-prototype__panel geox-prototype__receipt-card">
          <div className="geox-prototype__task-card-top"><span>EXECUTION RECEIPT</span><code>receipt_a81d</code></div>
          <h2>设备回执已接收</h2>
          <p>回执描述发生了什么，不评价是否“成功改善作物”。</p>
          <div className="geox-prototype__receipt-timeline">
            <div><time>22:01</time><span /><p><strong>任务确认</strong> gateway_pump_03 接收任务</p></div>
            <div><time>22:06</time><span /><p><strong>阀组开启</strong> V-12B 状态回读正常</p></div>
            <div><time>23:48</time><span /><p><strong>执行结束</strong> 累计流量 6,814 m³</p></div>
            <div><time>23:49</time><span /><p><strong>日志封存</strong> log_ref_7c19 已写入</p></div>
          </div>
        </article>
      </section>

      <section className="geox-prototype__three-column">
        <article className="geox-prototype__panel geox-prototype__boundary-card"><span>01</span><h3>任务事实</h3><p>谁授权、做什么、作用于哪里、在哪个时间窗、使用哪些参数。</p></article>
        <article className="geox-prototype__panel geox-prototype__boundary-card"><span>02</span><h3>执行事实</h3><p>设备或人员实际执行了什么，何时开始、何时结束、使用多少资源。</p></article>
        <article className="geox-prototype__panel geox-prototype__boundary-card"><span>03</span><h3>效果验证</h3><p>后续观测是否支持状态变化。它属于新的证据周期，不由回执自行声明。</p></article>
      </section>
    </div>
  );
}

function AuditSection(): React.ReactElement {
  return (
    <div className="geox-prototype__section-stack">
      <section className="geox-prototype__section-heading">
        <div><p className="geox-prototype__eyebrow">TRACEABILITY · READBACK</p><h1>任何结论都能回到原始事实</h1><span>演示周期 decision_cycle_20260715_n17 · 哈希 9c4e…2a11</span></div>
        <button type="button" className="geox-prototype__button is-secondary">导出审计包</button>
      </section>

      <section className="geox-prototype__audit-grid">
        <article className="geox-prototype__panel">
          <header className="geox-prototype__panel-header"><div><p>CHAIN OF CUSTODY</p><h2>证据链</h2></div><span>5 已核验 · 1 待发生</span></header>
          <EvidenceList />
        </article>
        <aside className="geox-prototype__panel geox-prototype__integrity-panel">
          <p className="geox-prototype__eyebrow">INTEGRITY CHECK</p>
          <div className="geox-prototype__integrity-score"><strong>98</strong><span>/ 100</span></div>
          <h2>链路完整</h2>
          <p>原始事实、派生对象和版本化输入均可读回。扣分来自人工授权尚未发生，而不是数据缺失。</p>
          <div className="geox-prototype__integrity-items">
            <div><span>事实可读回</span><b>PASS</b></div>
            <div><span>版本一致性</span><b>PASS</b></div>
            <div><span>执行边界</span><b>PASS</b></div>
            <div><span>人工授权</span><b className="is-waiting">WAIT</b></div>
          </div>
        </aside>
      </section>

      <section className="geox-prototype__panel geox-prototype__report-preview">
        <header className="geox-prototype__panel-header"><div><p>CUSTOMER REPORT PREVIEW</p><h2>可交付报告摘要</h2></div><span>只读 · 同源导出</span></header>
        <div className="geox-prototype__report-layout">
          <div><span>田块</span><strong>北区 17 号田块</strong><p>42.6 ha · 夏玉米 V8</p></div>
          <div><span>当前状态</span><strong>根区水分下降</strong><p>状态估计置信度 86%</p></div>
          <div><span>已完成工作</span><strong>事实采集与情景比较</strong><p>尚未执行灌溉任务</p></div>
          <div><span>待确认事项</span><strong>设备与时间窗</strong><p>等待操作员授权</p></div>
        </div>
      </section>
    </div>
  );
}

export default function ControlledPilotPrototype(): React.ReactElement {
  const [activeSection, setActiveSection] = React.useState<PrototypeSection>("overview");
  const [activeFieldId, setActiveFieldId] = React.useState("field-n17");
  const [selectedScenarioId, setSelectedScenarioId] = React.useState("targeted");
  const [reviewSubmitted, setReviewSubmitted] = React.useState(false);
  const [sidebarOpen, setSidebarOpen] = React.useState(false);

  const activeField = React.useMemo(() => fields.find((field) => field.id === activeFieldId) ?? fields[0], [activeFieldId]);
  const activeSectionMeta = prototypeSections.find((section) => section.id === activeSection) ?? prototypeSections[0];

  const openSection = (section: PrototypeSection): void => {
    setActiveSection(section);
    setSidebarOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="geox-prototype">
      <aside className={`geox-prototype__sidebar${sidebarOpen ? " is-open" : ""}`}>
        <div className="geox-prototype__brand"><LogoMark /><div><strong>GEOX</strong><span>CONTROLLED PILOT</span></div></div>
        <div className="geox-prototype__pilot-chip"><StatusDot tone="live" /><div><strong>河南试点 · A 组</strong><span>运行快照已连接</span></div></div>
        <nav aria-label="原型主导航">
          {prototypeSections.map((section, index) => (
            <button key={section.id} type="button" className={activeSection === section.id ? "is-active" : ""} onClick={() => openSection(section.id)}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <div><small>{section.eyebrow}</small><strong>{section.label}</strong></div>
            </button>
          ))}
        </nav>
        <div className="geox-prototype__sidebar-boundary">
          <span>PROTOTYPE BOUNDARY</span>
          <p>独立路由 · 独立数据 · 无正式 API 写入</p>
        </div>
      </aside>

      <div className="geox-prototype__workspace">
        <header className="geox-prototype__topbar">
          <button type="button" className="geox-prototype__menu-button" onClick={() => setSidebarOpen((open) => !open)} aria-label="打开导航">☰</button>
          <div className="geox-prototype__context">
            <span>{activeSectionMeta.eyebrow}</span>
            <strong>{activeSectionMeta.label}</strong>
          </div>
          <div className="geox-prototype__topbar-actions">
            <button type="button" className="geox-prototype__farm-selector"><span>当前空间</span><strong>河南示范农场 / 2026 夏季</strong><b>⌄</b></button>
            <div className="geox-prototype__sync-state"><StatusDot tone="live" /><span>证据同步正常</span></div>
            <button type="button" className="geox-prototype__avatar" aria-label="当前用户">G</button>
          </div>
        </header>

        <main className="geox-prototype__main">
          {activeSection === "overview" ? <OverviewSection field={activeField} onFieldSelect={(fieldId) => { setActiveFieldId(fieldId); setActiveSection("twin"); }} onOpenScenarios={() => setActiveSection("scenarios")} /> : null}
          {activeSection === "twin" ? <TwinSection field={activeField} /> : null}
          {activeSection === "scenarios" ? <ScenariosSection selectedScenarioId={selectedScenarioId} onScenarioSelect={setSelectedScenarioId} reviewSubmitted={reviewSubmitted} onSubmitReview={() => setReviewSubmitted(true)} /> : null}
          {activeSection === "execution" ? <ExecutionSection /> : null}
          {activeSection === "audit" ? <AuditSection /> : null}
        </main>
      </div>
      {sidebarOpen ? <button type="button" className="geox-prototype__backdrop" onClick={() => setSidebarOpen(false)} aria-label="关闭导航" /> : null}
    </div>
  );
}
