import React from "react";
import { Link, useSearchParams } from "react-router-dom";
import { fetchOperatorFieldMemory } from "../../api/operatorFieldMemory";
import { fetchOperatorRoiLedger } from "../../api/operatorRoiLedger";
import { fetchOperatorSkillPerformance, fetchOperatorSkillTraces, type OperatorSkillPerformanceResponse, type OperatorSkillTraceResponse } from "../../api/operatorSkillTrace";
import LearningClosurePanel from "../../components/operator/LearningClosurePanel";
import OperatorEmptyState from "../../components/operator/OperatorEmptyState";
import OperatorLayout from "../../layouts/OperatorLayout";
import "../../styles/operatorRoiLedger.css";
import { buildOperatorFieldMemoryVm, type OperatorFieldMemoryVm } from "../../viewmodels/operatorFieldMemoryVm";
import { buildOperatorLearningClosureVm } from "../../viewmodels/operatorLearningClosureVm";
import { buildOperatorRoiLedgerVm, type OperatorRoiLedgerRowVm, type OperatorRoiLedgerVm } from "../../viewmodels/operatorRoiLedgerVm";

function RoiRow({ row }: { row: OperatorRoiLedgerRowVm }): React.ReactElement {
  return (
    <article className="operatorRoiRow">
      <header className="operatorRoiRowHead">
        <div>
          <h3>{row.metricText}</h3>
          <p>{row.valueText}</p>
        </div>
        <span className={`operatorRoiKind ${row.valueKindTone}`}>{row.valueKindText}</span>
      </header>

      <div className="operatorRoiMeta">
        <div><span>roi_id</span><strong>{row.roiId}</strong></div>
        <div><span>operation_id</span><strong>{row.operationIdText}</strong></div>
        <div><span>prescription_id</span><strong>{row.prescriptionIdText}</strong></div>
        <div><span>evidence_ref</span><strong>{row.evidenceRefText}</strong></div>
        <div><span>calculation method</span><strong>{row.calculationMethodText}</strong></div>
        <div><span>confidence</span><strong>{row.confidenceText}</strong></div>
        <div><span>assumption</span><strong>{row.assumptionText}</strong></div>
        <div><span>created_at</span><strong>{row.createdAtText}</strong></div>
        <div><span>来源</span><strong>{row.sourceText}</strong></div>
      </div>

      <div className="operatorRoiNotice">{row.measuredAllowedText}</div>
      <div className="operatorRoiActions">
        {row.operationHref ? <Link to={row.operationHref}>查看作业</Link> : null}
      </div>
    </article>
  );
}

function RoiSection({ title, description, rows }: { title: string; description: string; rows: OperatorRoiLedgerRowVm[] }): React.ReactElement {
  return (
    <section className="operatorRoiSection">
      <header className="operatorRoiSectionHead">
        <div>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
        <span>{rows.length}</span>
      </header>
      {rows.length ? (
        <div className="operatorRoiList">
          {rows.map((row) => <RoiRow key={`${title}-${row.roiId}-${row.operationIdText}`} row={row} />)}
        </div>
      ) : <div className="operatorQueueEmpty">暂无该类 ROI 明细。</div>}
    </section>
  );
}

export default function OperatorRoiLedgerPage(): React.ReactElement {
  const [searchParams, setSearchParams] = useSearchParams();
  const fieldId = searchParams.get("field_id") ?? "";
  const operationId = searchParams.get("operation_id") ?? "";
  const [fieldInput, setFieldInput] = React.useState(fieldId);
  const [operationInput, setOperationInput] = React.useState(operationId);
  const [loading, setLoading] = React.useState(true);
  const [vm, setVm] = React.useState<OperatorRoiLedgerVm | null>(null);
  const [fieldMemoryVm, setFieldMemoryVm] = React.useState<OperatorFieldMemoryVm | null>(null);
  const [skillTrace, setSkillTrace] = React.useState<OperatorSkillTraceResponse | null>(null);
  const [skillPerformance, setSkillPerformance] = React.useState<OperatorSkillPerformanceResponse | null>(null);

  React.useEffect(() => {
    setFieldInput(fieldId);
    setOperationInput(operationId);
  }, [fieldId, operationId]);

  React.useEffect(() => {
    let alive = true;
    setLoading(true);
    void fetchOperatorRoiLedger({ fieldId, operationId })
      .then((response) => {
        if (!alive) return;
        setVm(buildOperatorRoiLedgerVm(response));
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [fieldId, operationId]);

  React.useEffect(() => {
    let alive = true;
    const op = operationId.trim();
    setFieldMemoryVm(null);
    setSkillTrace(null);
    setSkillPerformance(null);
    if (!op) {
      return () => {
        alive = false;
      };
    }
    void Promise.all([
      fetchOperatorFieldMemory({ fieldId, operationId: op }).then(buildOperatorFieldMemoryVm).catch(() => null),
      fetchOperatorSkillTraces({ operationId: op }).catch(() => null),
      fetchOperatorSkillPerformance({ fieldId, operationId: op }).catch(() => null),
    ]).then(([nextFieldMemoryVm, nextSkillTrace, nextSkillPerformance]) => {
      if (!alive) return;
      setFieldMemoryVm(nextFieldMemoryVm);
      setSkillTrace(nextSkillTrace);
      setSkillPerformance(nextSkillPerformance);
    });
    return () => {
      alive = false;
    };
  }, [fieldId, operationId]);

  function applyFilters(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next: Record<string, string> = {};
    const f = fieldInput.trim();
    const o = operationInput.trim();
    if (f) next.field_id = f;
    if (o) next.operation_id = o;
    setSearchParams(next);
  }

  function clearFilters() {
    setFieldInput("");
    setOperationInput("");
    setSearchParams({});
  }

  const closureVm = buildOperatorLearningClosureVm({
    operationId,
    roiRows: vm?.rows ?? [],
    fieldMemoryRows: fieldMemoryVm?.rows ?? [],
    skillTrace,
    performance: skillPerformance,
  });

  return (
    <OperatorLayout title="ROI 明细账" lead="按 field / operation 追溯 ROI 明细，区分估算、实测、假设与证据不足。">
      <div className="operatorRoiLedgerPage">
        <form className="operatorRoiFilters" onSubmit={applyFilters}>
          <label>
            <span>field_id</span>
            <input value={fieldInput} onChange={(event) => setFieldInput(event.target.value)} placeholder="按 field 过滤" />
          </label>
          <label>
            <span>operation_id</span>
            <input value={operationInput} onChange={(event) => setOperationInput(event.target.value)} placeholder="按 operation 过滤" />
          </label>
          <div className="operatorRoiFilterActions">
            <button type="submit">应用过滤</button>
            <button type="button" onClick={clearFilters}>清空</button>
          </div>
        </form>

        <LearningClosurePanel vm={closureVm} />

        {loading ? <div className="operatorEmptyState">ROI 明细加载中...</div> : null}
        {!loading && vm ? (
          <>
            <section className="operatorWorkbenchSummary">
              <div><span>数据范围</span><strong>{vm.dataScopeText}</strong></div>
              <div><span>ROI 明细总数</span><strong>{vm.totalCount}</strong></div>
              <div><span>当前过滤</span><strong>{vm.filterText}</strong></div>
              <div><span>更新时间</span><strong>{vm.generatedAtText}</strong></div>
            </section>

            {vm.dataScopeWarning ? <div className="operatorScopeWarning">{vm.dataScopeWarning}</div> : null}

            {vm.totalCount === 0 ? <OperatorEmptyState title={vm.emptyTitle} description={vm.emptyDescription} reason="没有 ROI 明细时不伪造 roi_id、evidence_ref 或实测收益。" /> : null}

            <section className="operatorRoiGrid" aria-label="ROI 明细分组">
              <RoiSection title="实测记录" description="只有 baseline 与 actual 同时存在时，才按实测口径展示。" rows={vm.measuredRows} />
              <RoiSection title="估算记录" description="估算值必须按估算口径解读，不等同于实测收益。" rows={vm.estimatedRows} />
              <RoiSection title="假设记录" description="基于假设或缺少完整证据链的 ROI 记录。" rows={vm.assumptionRows} />
              <RoiSection title="证据不足 / 实测条件不足" description="无 baseline、缺 actual 或证据不足的 ROI 项。" rows={vm.insufficientRows} />
            </section>
          </>
        ) : null}
      </div>
    </OperatorLayout>
  );
}
