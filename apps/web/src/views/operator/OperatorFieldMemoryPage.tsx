import React from "react";
import { Link, useSearchParams } from "react-router-dom";
import { fetchOperatorFieldMemory } from "../../api/operatorFieldMemory";
import OperatorEmptyState from "../../components/operator/OperatorEmptyState";
import SkillTracePanel from "../../components/operator/SkillTracePanel";
import OperatorLayout from "../../layouts/OperatorLayout";
import "../../styles/operatorFieldMemory.css";
import { buildOperatorFieldMemoryVm, type OperatorFieldMemoryGroupVm, type OperatorFieldMemoryRowVm, type OperatorFieldMemoryVm } from "../../viewmodels/operatorFieldMemoryVm";

function buildTraceInput(row: OperatorFieldMemoryRowVm) {
  const refs = row.skillRefsText === "无引用" ? [] : row.skillRefsText.split("、").map((item) => item.trim()).filter(Boolean);
  return refs.map((skillId) => ({
    skill_id: skillId,
    skill_version: "版本待确认",
    classification: row.memoryTypeText,
    binding_scope: row.objectText,
    last_run_status: /失败|超时|异常/.test(row.confidenceText) ? "FAILED" : "SUCCESS",
    failure_reason: /失败|超时|异常/.test(row.confidenceText) ? row.confidenceText : "",
    input_summary: row.beforeText,
    output_summary: row.afterText,
    trace_ref: `${row.memoryId}:${skillId}`,
  }));
}

function FieldMemoryRow({ row }: { row: OperatorFieldMemoryRowVm }): React.ReactElement {
  return (
    <article className="operatorFieldMemoryRow">
      <header className="operatorFieldMemoryRowHead">
        <div>
          <h3>{row.memoryTypeText}</h3>
          <p>{row.objectText}</p>
        </div>
        <span>明细</span>
      </header>

      <div className="operatorFieldMemoryMeta">
        <div><span>memory_type</span><strong>{row.memoryTypeText}</strong></div>
        <div><span>before</span><strong>{row.beforeText}</strong></div>
        <div><span>after</span><strong>{row.afterText}</strong></div>
        <div><span>delta</span><strong>{row.deltaText}</strong></div>
        <div><span>confidence</span><strong>{row.confidenceText}</strong></div>
        <div><span>skill_refs</span><strong>{row.skillRefsText}</strong></div>
        <div><span>evidence_refs</span><strong>{row.evidenceRefsText}</strong></div>
        <div><span>recommendation_id</span><strong>{row.recommendationIdText}</strong></div>
        <div><span>task_id</span><strong>{row.taskIdText}</strong></div>
        <div><span>acceptance_id</span><strong>{row.acceptanceIdText}</strong></div>
        <div><span>roi_id</span><strong>{row.roiIdText}</strong></div>
        <div><span>created_at</span><strong>{row.createdAtText}</strong></div>
        <div><span>updated_at</span><strong>{row.updatedAtText}</strong></div>
        <div><span>source</span><strong>{row.sourceText}</strong></div>
      </div>

      <SkillTracePanel trace={buildTraceInput(row)} />

      <div className="operatorFieldMemoryNotice">客户层只展示摘要；运营层展示可追溯明细。敏感信息和本地路径已在 adapter 层清洗。</div>
      <div className="operatorFieldMemoryActions">
        {row.fieldHref ? <Link to={row.fieldHref}>查看地块</Link> : null}
        {row.operationHref ? <Link to={row.operationHref}>查看作业</Link> : null}
      </div>
    </article>
  );
}

function FieldMemoryGroup({ group }: { group: OperatorFieldMemoryGroupVm }): React.ReactElement {
  return (
    <section className="operatorFieldMemoryGroup">
      <header className="operatorFieldMemoryGroupHead">
        <div>
          <h2>{group.memoryType}</h2>
          <p>该 memory_type 下的运营田块记忆明细。</p>
        </div>
        <span>{group.count}</span>
      </header>
      {group.rows.length ? (
        <div className="operatorFieldMemoryList">
          {group.rows.map((row) => <FieldMemoryRow key={`${group.memoryType}-${row.memoryId}`} row={row} />)}
        </div>
      ) : <div className="operatorQueueEmpty">暂无该类田块记忆。</div>}
    </section>
  );
}

export default function OperatorFieldMemoryPage(): React.ReactElement {
  const [searchParams, setSearchParams] = useSearchParams();
  const fieldId = searchParams.get("field_id") ?? "";
  const operationId = searchParams.get("operation_id") ?? "";
  const memoryType = searchParams.get("memory_type") ?? "";
  const [fieldInput, setFieldInput] = React.useState(fieldId);
  const [operationInput, setOperationInput] = React.useState(operationId);
  const [memoryTypeInput, setMemoryTypeInput] = React.useState(memoryType);
  const [loading, setLoading] = React.useState(true);
  const [vm, setVm] = React.useState<OperatorFieldMemoryVm | null>(null);

  React.useEffect(() => {
    setFieldInput(fieldId);
    setOperationInput(operationId);
    setMemoryTypeInput(memoryType);
  }, [fieldId, operationId, memoryType]);

  React.useEffect(() => {
    let alive = true;
    setLoading(true);
    void fetchOperatorFieldMemory({ fieldId, operationId, memoryType })
      .then((response) => {
        if (!alive) return;
        setVm(buildOperatorFieldMemoryVm(response));
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [fieldId, operationId, memoryType]);

  function applyFilters(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next: Record<string, string> = {};
    const f = fieldInput.trim();
    const o = operationInput.trim();
    const m = memoryTypeInput.trim();
    if (f) next.field_id = f;
    if (o) next.operation_id = o;
    if (m) next.memory_type = m;
    setSearchParams(next);
  }

  function clearFilters() {
    setFieldInput("");
    setOperationInput("");
    setMemoryTypeInput("");
    setSearchParams({});
  }

  return (
    <OperatorLayout title="田块记忆中心" lead="按 field / operation / memory_type 查看田块记忆详情，和客户层摘要保持分离。">
      <div className="operatorFieldMemoryPage">
        <form className="operatorFieldMemoryFilters" onSubmit={applyFilters}>
          <label>
            <span>field_id</span>
            <input value={fieldInput} onChange={(event) => setFieldInput(event.target.value)} placeholder="按 field 过滤" />
          </label>
          <label>
            <span>operation_id</span>
            <input value={operationInput} onChange={(event) => setOperationInput(event.target.value)} placeholder="按 operation 过滤" />
          </label>
          <label>
            <span>memory_type</span>
            <input value={memoryTypeInput} onChange={(event) => setMemoryTypeInput(event.target.value)} placeholder="按 memory_type 过滤" />
          </label>
          <div className="operatorFieldMemoryFilterActions">
            <button type="submit">应用过滤</button>
            <button type="button" onClick={clearFilters}>清空</button>
          </div>
        </form>

        {loading ? <div className="operatorEmptyState">田块记忆加载中...</div> : null}
        {!loading && vm ? (
          <>
            <section className="operatorWorkbenchSummary">
              <div><span>数据范围</span><strong>{vm.dataScopeText}</strong></div>
              <div><span>记忆明细总数</span><strong>{vm.totalCount}</strong></div>
              <div><span>当前过滤</span><strong>{vm.filterText}</strong></div>
              <div><span>更新时间</span><strong>{vm.generatedAtText}</strong></div>
            </section>

            {vm.dataScopeWarning ? <div className={vm.permissionDenied ? "operatorFieldMemoryError" : "operatorScopeWarning"}>{vm.dataScopeWarning}</div> : null}

            {vm.totalCount === 0 ? <OperatorEmptyState title={vm.emptyTitle} description={vm.emptyDescription} reason={vm.permissionDenied ? "权限不足时不回退到客户摘要。" : "无田块记忆时不伪造 before / after / delta。"} /> : null}

            <section className="operatorFieldMemoryGrid" aria-label="田块记忆明细分组">
              {vm.groups.map((group) => <FieldMemoryGroup key={group.memoryType} group={group} />)}
            </section>
          </>
        ) : null}
      </div>
    </OperatorLayout>
  );
}
