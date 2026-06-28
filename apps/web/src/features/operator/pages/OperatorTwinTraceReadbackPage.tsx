// apps/web/src/features/operator/pages/OperatorTwinTraceReadbackPage.tsx
// Purpose: render the read-only Twin Kernel trace readback surface from GET /api/v1/twin-kernel/traces/:decision_cycle_id.
// Boundary: this page does not submit POST requests, does not create downstream business objects, and does not rank, recommend, approve, dispatch, or update model state.

import React from "react";
import { Link, useParams } from "react-router-dom";
import {
  fetchTwinKernelTraceReadModel,
  type TwinTraceJsonRecord,
  type TwinTraceReadModelV1,
} from "../../../api/twinKernelTrace";

type RuntimeState = "loading" | "ready" | "error";

type SystemDerivedRow = {
  objectType: string;
  objectId: string;
  status: string;
  determinismHash: string;
};

type JsonBlockOptions = {
  maxHeight?: number;
  compact?: boolean;
};

const SYSTEM_DERIVED_OBJECTS = [
  "field_state_snapshot_v1",
  "forecast_run_v1",
  "scenario_set_v1",
  "calibration_replay_v1",
  "forecast_error_v1",
  "field_learning_candidate_v1",
  "decision_cycle_v1",
];

const MISSING_FORMALIZATION_TOKENS = [
  "ROI_FORMALIZATION_MISSING",
  "FORMAL_FIELD_MEMORY_MISSING",
  "H58_FORMAL_WRITE_NOT_CREATED_BY_TWIN_KERNEL",
];

const AUTO_WRITE_FLAG_KEYS = [
  "automatic_recommendation_created",
  "automatic_approval_created",
  "automatic_task_created",
  "automatic_receipt_created",
  "automatic_acceptance_created",
  "automatic_roi_created",
  "automatic_field_memory_created",
  "model_updated",
];

function record(value: unknown): TwinTraceJsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as TwinTraceJsonRecord : {};
}

function array(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function text(value: unknown): string {
  return String(value ?? "").trim();
}

function shortHash(value: unknown): string {
  const raw = text(value);
  if (!raw || raw === "无") return "无";
  if (raw.length <= 18) return raw;
  return raw.slice(0, 10) + "…" + raw.slice(-6);
}

function objectIdForType(objectType: string, value: TwinTraceJsonRecord): string {
  const idFields: Record<string, string> = {
    field_state_snapshot_v1: "snapshot_id",
    forecast_run_v1: "forecast_run_id",
    scenario_set_v1: "scenario_set_id",
    calibration_replay_v1: "calibration_replay_id",
    forecast_error_v1: "forecast_error_id",
    field_learning_candidate_v1: "field_learning_candidate_id",
    decision_cycle_v1: "decision_cycle_id",
  };

  return text(value[idFields[objectType]]) || "无";
}

function statusForType(objectType: string, value: TwinTraceJsonRecord): string {
  const statusFields: Record<string, string> = {
    field_state_snapshot_v1: "status",
    forecast_run_v1: "status",
    scenario_set_v1: "status",
    calibration_replay_v1: "status",
    forecast_error_v1: "error_direction",
    field_learning_candidate_v1: "candidate_status",
    decision_cycle_v1: "cycle_status",
  };

  return text(value[statusFields[objectType]]) || "无";
}

function systemDerivedRows(trace: TwinTraceReadModelV1): SystemDerivedRow[] {
  const systemDerived = record(trace.system_derived);

  return SYSTEM_DERIVED_OBJECTS.map((objectType) => {
    const value = record(systemDerived[objectType]);
    return {
      objectType,
      objectId: objectIdForType(objectType, value),
      status: statusForType(objectType, value),
      determinismHash: text(value.determinism_hash) || "无",
    };
  });
}

function jsonBlock(value: unknown, options: JsonBlockOptions = {}): React.ReactElement {
  return (
    <pre
      className="operatorJsonBlock"
      data-polish="bounded-json-block"
      style={{
        maxHeight: options.maxHeight ?? 280,
        overflow: "auto",
        fontSize: options.compact ? 11 : 12,
        lineHeight: 1.45,
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
      }}
    >
      {JSON.stringify(value ?? null, null, 2)}
    </pre>
  );
}

function CollapsibleJsonCard({
  title,
  eyebrow,
  dataCard,
  children,
  value,
  defaultOpen = false,
  maxHeight = 280,
}: {
  title: string;
  eyebrow: string;
  dataCard: string;
  children?: React.ReactNode;
  value: unknown;
  defaultOpen?: boolean;
  maxHeight?: number;
}): React.ReactElement {
  return (
    <article className="operatorPanel" data-card={dataCard} data-polish="collapsible-json-card">
      <p className="operatorEyebrow">{eyebrow}</p>
      <h3>{title}</h3>
      {children}
      <details open={defaultOpen} data-polish="json-details">
        <summary>查看 JSON</summary>
        {jsonBlock(value, { maxHeight, compact: true })}
      </details>
    </article>
  );
}

function ListCard({ title, items, dataCard }: { title: string; items: unknown[]; dataCard: string }): React.ReactElement {
  return (
    <article className="operatorPanel" data-card={dataCard}>
      <h3>{title}</h3>
      {items.length === 0 ? <p>无</p> : null}
      <ul className="operatorList">
        {items.map((item, index) => <li key={String(index)}>{text(item)}</li>)}
      </ul>
    </article>
  );
}

function ProvenanceCard({ trace }: { trace: TwinTraceReadModelV1 }): React.ReactElement {
  return (
    <CollapsibleJsonCard
      title="来源分层"
      eyebrow="Provenance"
      dataCard="provenance-classes"
      value={trace.provenance_classes}
      maxHeight={220}
    >
      <ul className="operatorList">
        <li>entered_collected：录入 / 采集 / source index 输入</li>
        <li>system_derived：Twin Kernel 生成对象</li>
        <li>human_confirmed：人工确认与正式门控引用</li>
        <li>pointer_refs：外部链路引用，不在本页创建</li>
      </ul>
    </CollapsibleJsonCard>
  );
}

function SystemDerivedCard({ trace }: { trace: TwinTraceReadModelV1 }): React.ReactElement {
  const rows = systemDerivedRows(trace);

  return (
    <article className="operatorPanel" data-card="system-derived-objects" data-polish="short-hash-table">
      <p className="operatorEyebrow">System Derived</p>
      <h3>系统推导对象</h3>
      <div className="operatorTableWrap">
        <table className="operatorTable" data-table="twin-trace-system-derived">
          <thead><tr><th>对象</th><th>ID</th><th>状态</th><th>hash</th></tr></thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.objectType} data-object-type={row.objectType}>
                <td>{row.objectType}</td>
                <td title={row.objectId}>{shortHash(row.objectId)}</td>
                <td>{row.status}</td>
                <td title={row.determinismHash}>{shortHash(row.determinismHash)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </article>
  );
}

function BoundaryFlagsSummary({ boundaryFlags }: { boundaryFlags: TwinTraceJsonRecord }): React.ReactElement {
  return (
    <ul className="operatorList" data-polish="boundary-flag-summary">
      {AUTO_WRITE_FLAG_KEYS.map((key) => (
        <li key={key}>{key}：{boundaryFlags[key] === true ? "true" : "false"}</li>
      ))}
    </ul>
  );
}

function DecisionAnswerCard({ trace }: { trace: TwinTraceReadModelV1 }): React.ReactElement {
  const systemDecision = record(record(trace.system_derived).decision_cycle_v1);
  const decisionAnswer = record(record(trace.answers).decision_cycle);
  const missingFormalization = array(decisionAnswer.missing_formalization);
  const boundaryFlags = record(decisionAnswer.boundary_flags);

  return (
    <article className="operatorPanel" data-card="decision-cycle-readback">
      <p className="operatorEyebrow">Decision Cycle</p>
      <h3>决策循环回读</h3>
      <ul className="operatorList">
        <li>current_stage：{text(systemDecision.current_stage) || text(decisionAnswer.current_stage) || "无"}</li>
        <li>read_only：{trace.read_only ? "true" : "false"}</li>
        <li>write_ready：{trace.write_ready ? "true" : "false"}</li>
        <li>downstream_write_ready：{trace.downstream_write_ready ? "true" : "false"}</li>
        <li>forbidden_auto_writes_absent：{decisionAnswer.forbidden_auto_writes_absent === true ? "true" : "false"}</li>
      </ul>
      <h4>missing_formalization</h4>
      <ul className="operatorList">
        {MISSING_FORMALIZATION_TOKENS.map((token) => (
          <li key={token} data-missing-formalization={token}>{missingFormalization.includes(token) ? token : token + "：未返回"}</li>
        ))}
      </ul>
      <h4>automatic write flags</h4>
      <BoundaryFlagsSummary boundaryFlags={boundaryFlags} />
      <details data-polish="boundary-json-details">
        <summary>查看 boundary_flags JSON</summary>
        {jsonBlock(boundaryFlags, { maxHeight: 220, compact: true })}
      </details>
    </article>
  );
}

function PointerRefsCard({ trace }: { trace: TwinTraceReadModelV1 }): React.ReactElement {
  return (
    <CollapsibleJsonCard
      title="外部引用"
      eyebrow="Pointer Refs"
      dataCard="pointer-refs"
      value={trace.pointer_refs}
      maxHeight={220}
    >
      <p>本页只显示 pointer_refs，不创建 recommendation、approval、operation_plan、AO-ACT task、receipt、acceptance、ROI 或 Field Memory。</p>
    </CollapsibleJsonCard>
  );
}

function TraceRawCard({ trace }: { trace: TwinTraceReadModelV1 }): React.ReactElement {
  return (
    <CollapsibleJsonCard
      title="原始回读"
      eyebrow="Raw Readback"
      dataCard="trace-raw-readback"
      value={{
        entered_collected: trace.entered_collected,
        human_confirmed: trace.human_confirmed,
        answers: trace.answers,
      }}
      maxHeight={360}
    >
      <p>默认折叠长 JSON；用于审计追溯，不作为操作建议。</p>
    </CollapsibleJsonCard>
  );
}

export default function OperatorTwinTraceReadbackPage(): React.ReactElement {
  const params = useParams();
  const decisionCycleId = text(params.decisionCycleId);
  const [state, setState] = React.useState<RuntimeState>("loading");
  const [trace, setTrace] = React.useState<TwinTraceReadModelV1 | null>(null);
  const [errorText, setErrorText] = React.useState("");

  React.useEffect(() => {
    let alive = true;
    setState("loading");
    setTrace(null);
    setErrorText("");

    if (!decisionCycleId) {
      setState("error");
      setErrorText("DECISION_CYCLE_ID_REQUIRED");
      return () => { alive = false; };
    }

    void fetchTwinKernelTraceReadModel(decisionCycleId)
      .then((response) => {
        if (!alive) return;
        setTrace(response.twin_trace);
        setState("ready");
      })
      .catch((error: unknown) => {
        if (!alive) return;
        setTrace(null);
        setErrorText(error instanceof Error ? error.message : "TWIN_TRACE_READBACK_LOAD_FAILED");
        setState("error");
      });

    return () => { alive = false; };
  }, [decisionCycleId]);

  return (
    <section
      className="operatorWorkbenchPage"
      data-page="operator-twin-trace-readback"
      data-contract="twin_trace_v1_read_model"
      data-boundary="read-only-no-post"
      data-api-path="/api/v1/twin-kernel/traces/:decision_cycle_id"
      data-polish="tk12-usability-v1"
    >
      <div className="operatorWorkbenchHero">
        <div>
          <p className="operatorEyebrow">Twin Trace Readback</p>
          <h2>Twin Trace 回读</h2>
          <p>decision_cycle_id：<strong>{decisionCycleId || "未指定"}</strong>。本页只调用 GET readback，不创建对象、不审批、不派单、不写 ROI、不写 Field Memory。</p>
        </div>
        <div className="operatorWorkbenchHeroActions">
          <Link className="operatorActionLink" to="/operator/twin">返回 Twin 总览</Link>
        </div>
      </div>

      {state === "loading" ? <div className="operatorPanel">Twin Trace 加载中...</div> : null}
      {state === "error" ? <div className="operatorPanel">Twin Trace 加载失败：{errorText}</div> : null}

      {trace ? (
        <div className="operatorPanelGrid">
          <article className="operatorPanel" data-card="trace-summary">
            <p className="operatorEyebrow">Trace Summary</p>
            <h3>Trace 摘要</h3>
            <ul className="operatorList">
              <li>object_type：{trace.object_type}</li>
              <li>decision_cycle_id：{trace.decision_cycle_id}</li>
              <li>as_of_ts：{trace.as_of_ts}</li>
              <li>read_only：{trace.read_only ? "true" : "false"}</li>
              <li>write_ready：{trace.write_ready ? "true" : "false"}</li>
              <li>downstream_write_ready：{trace.downstream_write_ready ? "true" : "false"}</li>
            </ul>
          </article>
          <SystemDerivedCard trace={trace} />
          <DecisionAnswerCard trace={trace} />
          <ProvenanceCard trace={trace} />
          <PointerRefsCard trace={trace} />
          <ListCard title="系统推导对象清单" dataCard="system-derived-token-list" items={SYSTEM_DERIVED_OBJECTS} />
          <TraceRawCard trace={trace} />
        </div>
      ) : null}
    </section>
  );
}
