import React from "react";
import { Link, useSearchParams } from "react-router-dom";
import { fetchOperatorFieldMemory } from "../../api/operatorFieldMemory";
import { fetchOperatorRoiLedger } from "../../api/operatorRoiLedger";
import { fetchOperatorSkillPerformance, fetchOperatorSkillTraces, type OperatorSkillPerformanceResponse, type OperatorSkillTraceResponse } from "../../api/operatorSkillTrace";
import LearningClosurePanel from "../../components/operator/LearningClosurePanel";
import OperatorEmptyState from "../../components/operator/OperatorEmptyState";
import { isPermissionDeniedError, OperatorPageStateView, sanitizeOperatorError, withOperatorLoadTimeout, type OperatorPageRuntimeState } from "../../components/operator/OperatorPageState";
import OperatorLayout from "../../layouts/OperatorLayout";
import "../../styles/operatorRoiLedger.css";
import { buildOperatorFieldMemoryVm, type OperatorFieldMemoryVm } from "../../viewmodels/operatorFieldMemoryVm";
import { buildOperatorLearningClosureVm } from "../../viewmodels/operatorLearningClosureVm";
import { buildOperatorRoiLedgerVm, type OperatorRoiLedgerRowVm, type OperatorRoiLedgerVm } from "../../viewmodels/operatorRoiLedgerVm";
import { OPERATOR_PAGE_META } from "./operatorPageMeta";

const PAGE_NAME = "ROI 明细账";

function decodeLastPathSegment(href?: string | null): string {
  if (!href) return "";
  const segment = href.split("/").filter(Boolean).pop() ?? "";
  try { return decodeURIComponent(segment); } catch { return segment; }
}

function roiOperatorQuery(row: OperatorRoiLedgerRowVm): string {
  const params = new URLSearchParams();
  const operationId = decodeLastPathSegment(row.operationHref) || (/待确认|暂无|未提供/.test(row.operationIdText) ? "" : row.operationIdText);
  if (operationId) params.set("operation_id", operationId);
  return params.toString();
}

function RoiRow({ row }: { row: OperatorRoiLedgerRowVm }): React.ReactElement {
  const operatorQuery = roiOperatorQuery(row);
  return <article className="operatorRoiRow"><header className="operatorRoiRowHead"><div><h3>{row.metricText}</h3><p>{row.valueText}</p></div><span className={`operatorRoiKind ${row.valueKindTone}`}>{row.valueKindText}</span></header><div className="operatorRoiMeta"><div><span>价值类型</span><strong>{row.valueKindText}</strong></div><div><span>置信度</span><strong>{row.confidenceText}</strong></div><div><span>假设条件</span><strong>{row.assumptionText}</strong></div><div><span>记录时间</span><strong>{row.createdAtText}</strong></div><div><span>来源</span><strong>{row.sourceText}</strong></div></div><details className="operationTechDetailsMuted"><summary className="operationTechDetailsSummary">技术引用</summary><div className="operatorRoiMeta customerSpacingTopSm"><div><span>ROI 记录</span><strong>{row.technicalRefs.roiIdText}</strong></div><div><span>作业编号</span><strong>{row.technicalRefs.operationIdText}</strong></div><div><span>处方编号</span><strong>{row.technicalRefs.prescriptionIdText}</strong></div><div><span>证据引用</span><strong>{row.technicalRefs.evidenceRefText}</strong></div><div><span>计算方法</span><strong>{row.technicalRefs.calculationMethodText}</strong></div><div><span>数据来源</span><strong>{row.technicalRefs.sourceText}</strong></div></div></details><div className="operatorRoiNotice">{row.measuredAllowedText}</div><div className="operatorRoiActions">{row.operationHref ? <Link to={row.operationHref}>查看作业</Link> : null}{operatorQuery ? <Link to={`/operator/field-memory?${operatorQuery}`}>查看田块记忆</Link> : null}{operatorQuery ? <Link to={`/operator/evidence?${operatorQuery}`}>查看作业证据摘要入口</Link> : null}</div></article>;
}

function RoiSection({ title, description, rows }: { title: string; description: string; rows: OperatorRoiLedgerRowVm[] }): React.ReactElement {
  return <section className="operatorRoiSection"><header className="operatorRoiSectionHead"><div><h2>{title}</h2><p>{description}</p></div><span>{rows.length}</span></header>{rows.length ? <div className="operatorRoiList">{rows.map((row) => <RoiRow key={`${title}-${row.roiId}-${row.operationIdText}`} row={row} />)}</div> : <div className="operatorQueueEmpty">暂无该类价值明细。</div>}</section>;
}

export default function OperatorRoiLedgerPage(): React.ReactElement {
  const meta = OPERATOR_PAGE_META.roiLedger;
  const [searchParams, setSearchParams] = useSearchParams();
  const fieldId = searchParams.get("field_id") ?? "";
  const operationId = searchParams.get("operation_id") ?? "";
  const [fieldInput, setFieldInput] = React.useState(fieldId);
  const [operationInput, setOperationInput] = React.useState(operationId);
  const [pageState, setPageState] = React.useState<OperatorPageRuntimeState>("loading");
  const [errorReason, setErrorReason] = React.useState("");
  const [auxWarning, setAuxWarning] = React.useState("");
  const [vm, setVm] = React.useState<OperatorRoiLedgerVm | null>(null);
  const [fieldMemoryVm, setFieldMemoryVm] = React.useState<OperatorFieldMemoryVm | null>(null);
  const [skillTrace, setSkillTrace] = React.useState<OperatorSkillTraceResponse | null>(null);
  const [skillPerformance, setSkillPerformance] = React.useState<OperatorSkillPerformanceResponse | null>(null);

  React.useEffect(() => { setFieldInput(fieldId); setOperationInput(operationId); }, [fieldId, operationId]);

  React.useEffect(() => {
    let alive = true;
    setPageState("loading");
    setErrorReason("");
    setVm(null);
    void withOperatorLoadTimeout(fetchOperatorRoiLedger({ fieldId, operationId }), PAGE_NAME)
      .then((response) => { if (!alive) return; const nextVm = buildOperatorRoiLedgerVm(response); setVm(nextVm); setPageState(nextVm.totalCount === 0 ? "empty" : "data-ready"); })
      .catch((error: unknown) => { if (!alive) return; setVm(null); setErrorReason(sanitizeOperatorError(error)); setPageState(isPermissionDeniedError(error) ? "permission-denied" : "error"); });
    return () => { alive = false; };
  }, [fieldId, operationId]);

  React.useEffect(() => {
    let alive = true;
    const op = operationId.trim();
    setAuxWarning("");
    setFieldMemoryVm(null);
    setSkillTrace(null);
    setSkillPerformance(null);
    if (!op) return () => { alive = false; };
    void Promise.all([
      withOperatorLoadTimeout(fetchOperatorFieldMemory({ fieldId, operationId: op }).then(buildOperatorFieldMemoryVm), "ROI 关联田块记忆", 10_000).catch((error) => { if (alive) setAuxWarning(sanitizeOperatorError(error, "关联田块记忆暂时不可用，ROI 主表仍可查看。")); return null; }),
      withOperatorLoadTimeout(fetchOperatorSkillTraces({ operationId: op }), "ROI 关联技能轨迹", 10_000).catch((error) => { if (alive) setAuxWarning(sanitizeOperatorError(error, "关联技能轨迹暂时不可用，ROI 主表仍可查看。")); return null; }),
      withOperatorLoadTimeout(fetchOperatorSkillPerformance({ fieldId, operationId: op }), "ROI 关联技能表现", 10_000).catch((error) => { if (alive) setAuxWarning(sanitizeOperatorError(error, "关联技能表现暂时不可用，ROI 主表仍可查看。")); return null; }),
    ]).then(([nextFieldMemoryVm, nextSkillTrace, nextSkillPerformance]) => { if (!alive) return; setFieldMemoryVm(nextFieldMemoryVm); setSkillTrace(nextSkillTrace); setSkillPerformance(nextSkillPerformance); });
    return () => { alive = false; };
  }, [fieldId, operationId]);

  function applyFilters(event: React.FormEvent<HTMLFormElement>) { event.preventDefault(); const next: Record<string, string> = {}; const f = fieldInput.trim(); const o = operationInput.trim(); if (f) next.field_id = f; if (o) next.operation_id = o; setSearchParams(next); }
  function clearFilters() { setFieldInput(""); setOperationInput(""); setSearchParams({}); }

  const closureVm = buildOperatorLearningClosureVm({ operationId, fieldId, roiRows: vm?.rows ?? [], fieldMemoryRows: fieldMemoryVm?.rows ?? [], skillTrace, performance: skillPerformance });

  return (
    <OperatorLayout title={meta.title} lead={meta.lead}>
      <div className="operatorRoiLedgerPage">
        <form className="operatorRoiFilters" onSubmit={applyFilters}><label><span>地块编号</span><input value={fieldInput} onChange={(event) => setFieldInput(event.target.value)} placeholder="按地块编号筛选" /></label><label><span>作业编号</span><input value={operationInput} onChange={(event) => setOperationInput(event.target.value)} placeholder="按作业编号筛选" /></label><div className="operatorRoiFilterActions"><button type="submit">应用筛选</button><button type="button" onClick={clearFilters}>清空</button></div></form>
        {pageState === "loading" ? <OperatorPageStateView state="loading" /> : null}
        {pageState === "error" ? <OperatorPageStateView state="error" reason={errorReason} /> : null}
        {pageState === "permission-denied" ? <OperatorPageStateView state="permission-denied" reason={errorReason} /> : null}
        {vm ? <>{vm.needsOperationSelection ? <section className="operatorEmptyState"><h2>{vm.operationSelectionTitle}</h2><p>{vm.operationSelectionDescription}</p><ul className="customerList customerSpacingTopXs">{vm.operationSelectionItems.map((item) => <li key={item} className="customerListItem">{item}</li>)}</ul></section> : null}<LearningClosurePanel vm={closureVm} />{auxWarning ? <div className="operatorScopeWarning">{auxWarning}</div> : null}<section className="operatorWorkbenchSummary"><div><span>数据范围</span><strong>{vm.dataScopeText}</strong></div><div><span>价值明细总数</span><strong>{vm.totalCount}</strong></div><div><span>当前筛选</span><strong>{vm.filterText}</strong></div><div><span>更新时间</span><strong>{vm.generatedAtText}</strong></div></section>{vm.dataScopeWarning ? <div className="operatorScopeWarning">{vm.dataScopeWarning}</div> : null}{vm.totalCount === 0 ? <OperatorEmptyState title={vm.emptyTitle || "暂无待处理事项"} description={vm.emptyDescription || "当前没有价值明细。"} reason="没有价值明细时不伪造记录、证据引用或实测收益。" /> : null}<section className="operatorRoiGrid" aria-label="价值明细分组"><RoiSection title="实测记录" description="只有基线与实际结果同时存在时，才按实测口径展示。" rows={vm.measuredRows} /><RoiSection title="估算记录" description="估算值必须按估算口径解读，不等同于实测收益。" rows={vm.estimatedRows} /><RoiSection title="假设记录" description="基于假设或缺少完整证据链的价值记录。" rows={vm.assumptionRows} /><RoiSection title="证据不足 / 实测条件不足" description="无基线、缺实际结果或证据不足的价值项。" rows={vm.insufficientRows} /></section></> : null}
      </div>
    </OperatorLayout>
  );
}
