import React from "react";
import { Link, useSearchParams } from "react-router-dom";
import { fetchOperatorFieldMemory } from "../../api/operatorFieldMemory";
import { fetchOperatorRoiLedger } from "../../api/operatorRoiLedger";
import { fetchOperatorSkillPerformance, fetchOperatorSkillTraces, type OperatorSkillPerformanceResponse, type OperatorSkillTraceResponse } from "../../api/operatorSkillTrace";
import LearningClosurePanel from "../../components/operator/LearningClosurePanel";
import OperatorEmptyState from "../../components/operator/OperatorEmptyState";
import { isPermissionDeniedError, OperatorPageStateView, sanitizeOperatorError, withOperatorLoadTimeout, type OperatorPageRuntimeState } from "../../components/operator/OperatorPageState";
import SkillTracePanel from "../../components/operator/SkillTracePanel";
import OperatorLayout from "../../layouts/OperatorLayout";
import "../../styles/operatorFieldMemory.css";
import { buildOperatorFieldMemoryVm, type OperatorFieldMemoryGroupVm, type OperatorFieldMemoryRowVm, type OperatorFieldMemoryVm } from "../../viewmodels/operatorFieldMemoryVm";
import { buildOperatorLearningClosureVm } from "../../viewmodels/operatorLearningClosureVm";
import { buildOperatorRoiLedgerVm, type OperatorRoiLedgerVm } from "../../viewmodels/operatorRoiLedgerVm";
import { OPERATOR_PAGE_META } from "./operatorPageMeta";

const PAGE_NAME = "田块记忆";

function buildTraceInput(row: OperatorFieldMemoryRowVm) {
  const refs = row.skillRefsText === "无引用" ? [] : row.skillRefsText.split("、").map((item) => item.trim()).filter(Boolean);
  return refs.map((skillId) => ({ skill_id: skillId, skill_version: "版本待确认", classification: row.memoryTypeText, binding_scope: row.objectText, last_run_status: /失败|超时|异常/.test(row.confidenceText) ? "FAILED" : "SUCCESS", failure_reason: /失败|超时|异常/.test(row.confidenceText) ? row.confidenceText : "", input_summary: row.beforeText, output_summary: row.afterText, trace_ref: `${row.memoryId}:${skillId}` }));
}

function decodeLastPathSegment(href?: string | null): string {
  if (!href) return "";
  const segment = href.split("/").filter(Boolean).pop() ?? "";
  try { return decodeURIComponent(segment); } catch { return segment; }
}

function fieldMemoryOperatorQuery(row: OperatorFieldMemoryRowVm): string {
  const params = new URLSearchParams();
  const operationId = decodeLastPathSegment(row.operationHref);
  const fieldId = decodeLastPathSegment(row.fieldHref);
  if (fieldId) params.set("field_id", fieldId);
  if (operationId) params.set("operation_id", operationId);
  return params.toString();
}

function FieldMemoryRow({ row }: { row: OperatorFieldMemoryRowVm }): React.ReactElement {
  const operatorQuery = fieldMemoryOperatorQuery(row);
  return <article className="operatorFieldMemoryRow"><header className="operatorFieldMemoryRowHead"><div><h3>{row.memoryTypeText}</h3><p>{row.objectText}</p></div><span>明细</span></header><div className="operatorFieldMemoryMeta"><div><span>记忆类型</span><strong>{row.memoryTypeText}</strong></div><div><span>变化前</span><strong>{row.beforeText}</strong></div><div><span>变化后</span><strong>{row.afterText}</strong></div><div><span>变化量</span><strong>{row.deltaText}</strong></div><div><span>置信度</span><strong>{row.confidenceText}</strong></div><div><span>学习结果</span><strong>{row.learnedText}</strong></div><div><span>创建时间</span><strong>{row.createdAtText}</strong></div><div><span>更新时间</span><strong>{row.updatedAtText}</strong></div></div><details className="operationTechDetailsMuted"><summary className="operationTechDetailsSummary">技术引用</summary><div className="operatorFieldMemoryMeta customerSpacingTopSm"><div><span>记忆记录</span><strong>{row.technicalRefs.memoryIdText}</strong></div><div><span>建议记录</span><strong>{row.technicalRefs.recommendationIdText}</strong></div><div><span>执行任务</span><strong>{row.technicalRefs.taskIdText}</strong></div><div><span>验收记录</span><strong>{row.technicalRefs.acceptanceIdText}</strong></div><div><span>价值记录</span><strong>{row.technicalRefs.roiIdText}</strong></div><div><span>证据引用</span><strong>{row.technicalRefs.evidenceRefsText}</strong></div><div><span>技能引用</span><strong>{row.technicalRefs.skillRefsText}</strong></div><div><span>数据来源</span><strong>{row.technicalRefs.sourceText}</strong></div></div></details><SkillTracePanel trace={buildTraceInput(row)} /><div className="operatorFieldMemoryNotice">田块记忆用于复盘作业前后变化和学习结果；客户层只展示摘要，运营层保留默认折叠的技术引用。</div><div className="operatorFieldMemoryActions">{row.fieldHref ? <Link to={row.fieldHref}>查看地块</Link> : null}{row.operationHref ? <Link to={row.operationHref}>查看作业</Link> : null}{operatorQuery ? <Link to={`/operator/roi-ledger?${operatorQuery}`}>查看关联价值记录</Link> : null}{operatorQuery ? <Link to={`/operator/evidence?${operatorQuery}`}>查看证据摘要入口</Link> : null}</div></article>;
}

function FieldMemoryGroup({ group }: { group: OperatorFieldMemoryGroupVm }): React.ReactElement {
  return <section className="operatorFieldMemoryGroup"><header className="operatorFieldMemoryGroupHead"><div><h2>{group.memoryType}</h2><p>该记忆类型下的运营田块记忆明细。</p></div><span>{group.count}</span></header>{group.rows.length ? <div className="operatorFieldMemoryList">{group.rows.map((row) => <FieldMemoryRow key={`${group.memoryType}-${row.memoryId}`} row={row} />)}</div> : <div className="operatorQueueEmpty">暂无该类田块记忆。</div>}</section>;
}

export default function OperatorFieldMemoryPage(): React.ReactElement {
  const meta = OPERATOR_PAGE_META.fieldMemory;
  const [searchParams, setSearchParams] = useSearchParams();
  const fieldId = searchParams.get("field_id") ?? "";
  const operationId = searchParams.get("operation_id") ?? "";
  const memoryType = searchParams.get("memory_type") ?? "";
  const [fieldInput, setFieldInput] = React.useState(fieldId);
  const [operationInput, setOperationInput] = React.useState(operationId);
  const [memoryTypeInput, setMemoryTypeInput] = React.useState(memoryType);
  const [pageState, setPageState] = React.useState<OperatorPageRuntimeState>("loading");
  const [errorReason, setErrorReason] = React.useState("");
  const [auxWarning, setAuxWarning] = React.useState("");
  const [vm, setVm] = React.useState<OperatorFieldMemoryVm | null>(null);
  const [roiVm, setRoiVm] = React.useState<OperatorRoiLedgerVm | null>(null);
  const [skillTrace, setSkillTrace] = React.useState<OperatorSkillTraceResponse | null>(null);
  const [skillPerformance, setSkillPerformance] = React.useState<OperatorSkillPerformanceResponse | null>(null);

  React.useEffect(() => { setFieldInput(fieldId); setOperationInput(operationId); setMemoryTypeInput(memoryType); }, [fieldId, operationId, memoryType]);

  React.useEffect(() => {
    let alive = true;
    setPageState("loading");
    setErrorReason("");
    setVm(null);
    void withOperatorLoadTimeout(fetchOperatorFieldMemory({ fieldId, operationId, memoryType }), PAGE_NAME)
      .then((response) => { if (!alive) return; const nextVm = buildOperatorFieldMemoryVm(response); setVm(nextVm); setPageState(nextVm.permissionDenied ? "permission-denied" : (nextVm.totalCount === 0 ? "empty" : "data-ready")); if (nextVm.permissionDenied) setErrorReason(nextVm.dataScopeWarning || "当前账号权限不足"); })
      .catch((error: unknown) => { if (!alive) return; setVm(null); setErrorReason(sanitizeOperatorError(error)); setPageState(isPermissionDeniedError(error) ? "permission-denied" : "error"); });
    return () => { alive = false; };
  }, [fieldId, operationId, memoryType]);

  React.useEffect(() => {
    let alive = true;
    const op = operationId.trim();
    setAuxWarning("");
    setRoiVm(null);
    setSkillTrace(null);
    setSkillPerformance(null);
    if (!op) return () => { alive = false; };
    void Promise.all([
      withOperatorLoadTimeout(fetchOperatorRoiLedger({ fieldId, operationId: op }).then(buildOperatorRoiLedgerVm), "田块记忆关联价值记录", 10_000).catch((error) => { if (alive) setAuxWarning(sanitizeOperatorError(error, "关联价值记录暂时不可用，田块记忆主表仍可查看。")); return null; }),
      withOperatorLoadTimeout(fetchOperatorSkillTraces({ operationId: op }), "田块记忆关联技能轨迹", 10_000).catch((error) => { if (alive) setAuxWarning(sanitizeOperatorError(error, "关联技能轨迹暂时不可用，田块记忆主表仍可查看。")); return null; }),
      withOperatorLoadTimeout(fetchOperatorSkillPerformance({ fieldId, operationId: op }), "田块记忆关联技能表现", 10_000).catch((error) => { if (alive) setAuxWarning(sanitizeOperatorError(error, "关联技能表现暂时不可用，田块记忆主表仍可查看。")); return null; }),
    ]).then(([nextRoiVm, nextSkillTrace, nextSkillPerformance]) => { if (!alive) return; setRoiVm(nextRoiVm); setSkillTrace(nextSkillTrace); setSkillPerformance(nextSkillPerformance); });
    return () => { alive = false; };
  }, [fieldId, operationId]);

  function applyFilters(event: React.FormEvent<HTMLFormElement>) { event.preventDefault(); const next: Record<string, string> = {}; const f = fieldInput.trim(); const o = operationInput.trim(); const m = memoryTypeInput.trim(); if (f) next.field_id = f; if (o) next.operation_id = o; if (m) next.memory_type = m; setSearchParams(next); }
  function clearFilters() { setFieldInput(""); setOperationInput(""); setMemoryTypeInput(""); setSearchParams({}); }

  const closureVm = buildOperatorLearningClosureVm({ operationId, fieldId, fieldMemoryRows: vm?.rows ?? [], roiRows: roiVm?.rows ?? [], skillTrace, performance: skillPerformance });

  return (
    <OperatorLayout title={meta.title} lead={meta.lead}>
      <div className="operatorFieldMemoryPage">
        <form className="operatorFieldMemoryFilters" onSubmit={applyFilters}><label><span>地块编号</span><input value={fieldInput} onChange={(event) => setFieldInput(event.target.value)} placeholder="按地块编号筛选" /></label><label><span>作业编号</span><input value={operationInput} onChange={(event) => setOperationInput(event.target.value)} placeholder="按作业编号筛选" /></label><label><span>记忆类型</span><input value={memoryTypeInput} onChange={(event) => setMemoryTypeInput(event.target.value)} placeholder="按记忆类型筛选" /></label><div className="operatorFieldMemoryFilterActions"><button type="submit">应用筛选</button><button type="button" onClick={clearFilters}>清空</button></div></form>
        {pageState === "loading" ? <OperatorPageStateView state="loading" /> : null}
        {pageState === "error" ? <OperatorPageStateView state="error" reason={errorReason} /> : null}
        {pageState === "permission-denied" && !vm ? <OperatorPageStateView state="permission-denied" reason={errorReason} /> : null}
        {vm ? <>{vm.needsOperationSelection ? <section className="operatorEmptyState"><h2>{vm.operationSelectionTitle}</h2><p>{vm.operationSelectionDescription}</p><ul className="customerList customerSpacingTopXs">{vm.operationSelectionItems.map((item) => <li key={item} className="customerListItem">{item}</li>)}</ul></section> : null}<LearningClosurePanel vm={closureVm} />{auxWarning ? <div className="operatorScopeWarning">{auxWarning}</div> : null}<section className="operatorWorkbenchSummary"><div><span>数据范围</span><strong>{vm.dataScopeText}</strong></div><div><span>记忆明细总数</span><strong>{vm.totalCount}</strong></div><div><span>当前筛选</span><strong>{vm.filterText}</strong></div><div><span>更新时间</span><strong>{vm.generatedAtText}</strong></div></section>{vm.dataScopeWarning ? <div className={vm.permissionDenied ? "operatorFieldMemoryError" : "operatorScopeWarning"}>{vm.dataScopeWarning}</div> : null}{vm.totalCount === 0 ? <OperatorEmptyState title={vm.emptyTitle || "暂无待处理事项"} description={vm.emptyDescription || "当前没有田块记忆明细。"} reason={vm.permissionDenied ? "权限不足时不回退到客户摘要。" : "无田块记忆时不伪造变化前、变化后或变化量。"} /> : null}<section className="operatorFieldMemoryGrid" aria-label="田块记忆明细分组">{vm.groups.map((group) => <FieldMemoryGroup key={group.memoryType} group={group} />)}</section></> : null}
      </div>
    </OperatorLayout>
  );
}
