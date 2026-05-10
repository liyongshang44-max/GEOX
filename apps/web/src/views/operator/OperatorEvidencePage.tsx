import React from "react";
import { Link, useSearchParams } from "react-router-dom";
import { createOperatorEvidenceExportJob, fetchOperatorEvidence, fetchOperatorEvidenceJobDetail, type OperatorEvidenceItem } from "../../api/operatorEvidence";
import { fetchSessionMe, type SessionMe } from "../../api/session";
import OperatorEmptyState from "../../components/operator/OperatorEmptyState";
import PermissionGate from "../../components/operator/PermissionGate";
import OperatorLayout from "../../layouts/OperatorLayout";
import { hasOperatorPermission } from "../../lib/permissions";
import "../../styles/operatorEvidence.css";
import { buildOperatorEvidenceVm, type OperatorEvidenceRowVm, type OperatorEvidenceVm } from "../../viewmodels/operatorEvidenceVm";
import { OPERATOR_PAGE_META } from "./operatorPageMeta";

type CreateState = {
  pending: boolean;
  lastJobId: string;
  message: string | null;
  error: string | null;
};

type JobRefreshState = Record<string, {
  pending: boolean;
  message: string | null;
  error: string | null;
  lastRefreshedAt: string | null;
}>;

function safeMessage(value: unknown, fallback = "操作失败，请稍后重试。") {
  const text = String(value ?? "").trim();
  if (!text || text === "--") return fallback;
  if (/token|secret|credential|private\s*key|password|stack\s*trace|debug\s*json|access[_-]?key/i.test(text)) return fallback;
  return text;
}

function buildDefaultExportWindow(): { from_ts_ms: number; to_ts_ms: number; label: string } {
  const to = Date.now();
  const from = to - 30 * 24 * 60 * 60 * 1000;
  return { from_ts_ms: from, to_ts_ms: to, label: "最近 30 天" };
}

function buildRowFromItem(item: OperatorEvidenceItem): OperatorEvidenceRowVm | null {
  const vm = buildOperatorEvidenceVm({
    source: "operator_evidence_api",
    dataScope: "OFFICIAL_OPERATOR_API",
    generated_at: new Date().toISOString(),
    items: [item],
    exportReady: true,
  });
  return vm.rows[0] ?? null;
}

function replaceVmRow(vm: OperatorEvidenceVm, item: OperatorEvidenceItem): OperatorEvidenceVm {
  const row = buildRowFromItem(item);
  if (!row) return vm;
  const exists = vm.rows.some((candidate) => candidate.jobId === row.jobId);
  const rows = exists
    ? vm.rows.map((candidate) => candidate.jobId === row.jobId ? row : candidate)
    : [row, ...vm.rows];
  return {
    ...vm,
    totalCount: rows.length,
    rows,
    failedRows: rows.filter((candidate) => candidate.statusText === "导出失败"),
    missingChecksumRows: rows.filter((candidate) => candidate.checksumText === "暂无 sha256 checksum"),
  };
}

function isPollingStatus(row: OperatorEvidenceRowVm): boolean {
  return row.statusText === "等待导出" || row.statusText === "导出中";
}

function EvidenceRow({
  row,
  refreshState,
  onRefreshJob,
}: {
  row: OperatorEvidenceRowVm;
  refreshState?: JobRefreshState[string];
  onRefreshJob: (row: OperatorEvidenceRowVm) => void;
}): React.ReactElement {
  const isDone = row.statusText === "已完成";
  const isFailed = row.statusText === "导出失败";
  return (
    <article className="operatorEvidenceRow">
      <header className="operatorEvidenceRowHead">
        <div>
          <h3>{row.title}</h3>
          <p>{row.objectText}</p>
        </div>
        <span className={`operatorEvidenceStatus ${row.statusTone}`}>{row.statusText}</span>
      </header>

      <div className="operatorEvidenceMeta">
        <div><span>manifest</span><strong>{row.manifestText}</strong></div>
        <div><span>sha256</span><strong>{row.checksumText}</strong></div>
        <div><span>artifact / 对象标识</span><strong>{row.artifactText}</strong></div>
        <div><span>format</span><strong>{row.formatText}</strong></div>
        <div><span>scope</span><strong>{row.scopeText}</strong></div>
        <div><span>存储模式</span><strong>{row.storageText}</strong></div>
        <div><span>下载状态</span><strong>{row.downloadText}</strong></div>
        <div><span>创建时间</span><strong>{row.createdAtText}</strong></div>
        <div><span>完成时间</span><strong>{row.completedAtText}</strong></div>
        <div><span>失败原因</span><strong>{row.failureReasonText}</strong></div>
        <div><span>数据来源</span><strong>{row.sourceText}</strong></div>
      </div>

      {isDone ? (
        <div className="operatorEvidenceJobDetail success">
          <strong>导出已完成</strong>
          <span>sha256：{row.checksumText}</span>
          <span>completed_at：{row.completedAtText}</span>
          <span>manifest：{row.manifestText}</span>
          {row.downloadUrl ? <a href={row.downloadUrl} target="_blank" rel="noreferrer">打开下载链接</a> : <span>download_url：暂无</span>}
        </div>
      ) : null}

      {isFailed ? (
        <div className="operatorEvidenceJobDetail danger">
          <strong>导出失败</strong>
          <span>{row.failureReasonText}</span>
        </div>
      ) : null}

      <div className="operatorEvidenceNotice">证据中心不展示本地绝对路径、bucket secret、access key 或内部 runtime path。operation scope 未 ready 时显示未接入。</div>

      <div className="operatorEvidenceActions">
        {row.operationHref ? <Link to={row.operationHref}>查看作业</Link> : null}
        <button type="button" disabled={Boolean(refreshState?.pending)} onClick={() => onRefreshJob(row)}>{refreshState?.pending ? "刷新中..." : "刷新 job 状态"}</button>
        {row.downloadUrl && isDone ? <a href={row.downloadUrl} target="_blank" rel="noreferrer">下载证据包</a> : null}
      </div>
      {refreshState?.message ? <div className="operatorEvidenceJobCreated">{refreshState.message}</div> : null}
      {refreshState?.error ? <div className="operatorScopeWarning">{refreshState.error}</div> : null}
    </article>
  );
}

function evidenceExportPermissionReason(sessionLoading: boolean, sessionUnavailable: boolean, session: SessionMe | null): string | null {
  if (sessionLoading) return "会话权限加载中...";
  if (sessionUnavailable || !session) return "会话不可用";
  if (!hasOperatorPermission(session, "export_evidence")) return "缺少会话权限：operator_evidence_export";
  return null;
}

function createDisabledReason(args: {
  permissionBlockReason: string | null;
  operationId: string;
  session: SessionMe | null;
  fieldId: string;
  pending: boolean;
}): string | null {
  if (args.permissionBlockReason) return args.permissionBlockReason;
  if (!args.operationId) return "需要 operation_id 后才能创建作业证据包。";
  if (!args.fieldId && !args.session?.tenant_id) return "会话缺少 tenant_id，无法生成 TENANT scope。";
  if (args.pending) return "证据包创建中...";
  return null;
}

export default function OperatorEvidencePage(): React.ReactElement {
  const [searchParams] = useSearchParams();
  const operationId = searchParams.get("operation_id") ?? "";
  const fieldId = searchParams.get("field_id") ?? "";
  const meta = OPERATOR_PAGE_META.evidence;
  const [loading, setLoading] = React.useState(true);
  const [vm, setVm] = React.useState<OperatorEvidenceVm | null>(null);
  const [session, setSession] = React.useState<SessionMe | null>(null);
  const [sessionLoading, setSessionLoading] = React.useState(true);
  const [sessionUnavailable, setSessionUnavailable] = React.useState(false);
  const [createState, setCreateState] = React.useState<CreateState>({ pending: false, lastJobId: "", message: null, error: null });
  const [jobRefreshState, setJobRefreshState] = React.useState<JobRefreshState>({});
  const pollingJobsKey = React.useMemo(() => (vm?.rows ?? []).filter(isPollingStatus).map((row) => row.jobId).sort().join("|"), [vm?.rows]);

  const loadEvidence = React.useCallback(() => {
    setLoading(true);
    return fetchOperatorEvidence(operationId)
      .then((response) => {
        setVm(buildOperatorEvidenceVm(response));
      })
      .finally(() => {
        setLoading(false);
      });
  }, [operationId]);

  React.useEffect(() => {
    let alive = true;
    setSessionLoading(true);
    setSessionUnavailable(false);
    void fetchSessionMe()
      .then((resp) => {
        if (!alive) return;
        setSession(resp);
        setSessionUnavailable(false);
      })
      .catch(() => {
        if (!alive) return;
        setSession(null);
        setSessionUnavailable(true);
      })
      .finally(() => {
        if (!alive) return;
        setSessionLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  React.useEffect(() => {
    let alive = true;
    setLoading(true);
    void fetchOperatorEvidence(operationId)
      .then((response) => {
        if (!alive) return;
        setVm(buildOperatorEvidenceVm(response));
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [operationId]);

  const refreshJob = React.useCallback((row: OperatorEvidenceRowVm, silent = false) => {
    const jobId = row.jobId;
    if (!jobId) return;
    if (!silent) {
      setJobRefreshState((prev) => ({ ...prev, [jobId]: { pending: true, message: null, error: null, lastRefreshedAt: prev[jobId]?.lastRefreshedAt ?? null } }));
    }
    void fetchOperatorEvidenceJobDetail(jobId, operationId)
      .then((result) => {
        if (result.ok && result.item) {
          setVm((current) => current ? replaceVmRow(current, result.item!) : current);
          setJobRefreshState((prev) => ({
            ...prev,
            [jobId]: {
              pending: false,
              message: silent ? null : `job 状态已刷新：${result.item?.status ?? "UNKNOWN"}`,
              error: null,
              lastRefreshedAt: new Date().toISOString(),
            },
          }));
          return;
        }
        setJobRefreshState((prev) => ({
          ...prev,
          [jobId]: {
            pending: false,
            message: null,
            error: safeMessage(result.message, "刷新 job 状态失败。"),
            lastRefreshedAt: prev[jobId]?.lastRefreshedAt ?? null,
          },
        }));
      })
      .catch((error: unknown) => {
        setJobRefreshState((prev) => ({
          ...prev,
          [jobId]: {
            pending: false,
            message: null,
            error: safeMessage(error instanceof Error ? error.message : error, "刷新 job 状态失败。"),
            lastRefreshedAt: prev[jobId]?.lastRefreshedAt ?? null,
          },
        }));
      });
  }, [operationId]);

  React.useEffect(() => {
    const rows = (vm?.rows ?? []).filter(isPollingStatus);
    if (!rows.length) return;
    const timer = window.setInterval(() => {
      for (const row of rows.slice(0, 5)) refreshJob(row, true);
    }, 6000);
    return () => window.clearInterval(timer);
  }, [pollingJobsKey, refreshJob, vm?.rows]);

  const permissionBlockReason = evidenceExportPermissionReason(sessionLoading, sessionUnavailable, session);
  const disabledReason = createDisabledReason({ permissionBlockReason, operationId, session, fieldId, pending: createState.pending });
  const scopeType = fieldId ? "FIELD" : "TENANT";
  const scopeId = fieldId || session?.tenant_id || "";
  const defaultWindow = buildDefaultExportWindow();

  const onRefresh = React.useCallback(() => {
    void loadEvidence();
  }, [loadEvidence]);

  const onCreateEvidencePackage = React.useCallback(() => {
    const reason = createDisabledReason({ permissionBlockReason, operationId, session, fieldId, pending: createState.pending });
    if (reason) {
      setCreateState((prev) => ({ ...prev, message: null, error: reason }));
      return;
    }

    const windowMs = buildDefaultExportWindow();
    const nextScopeType = fieldId ? "FIELD" : "TENANT";
    const nextScopeId = fieldId || session?.tenant_id || "";
    setCreateState({ pending: true, lastJobId: "", message: null, error: null });

    void createOperatorEvidenceExportJob({
      operation_id: operationId,
      scope_type: nextScopeType,
      scope_id: nextScopeId,
      field_id: fieldId || undefined,
      from_ts_ms: windowMs.from_ts_ms,
      to_ts_ms: windowMs.to_ts_ms,
      export_format: "ZIP",
      export_language: "zh-CN",
    })
      .then((result) => {
        if (!result.ok) {
          setCreateState({
            pending: false,
            lastJobId: "",
            message: null,
            error: safeMessage(result.message, "创建证据包失败。"),
          });
          return;
        }
        if (result.item) {
          setVm((current) => current ? replaceVmRow(current, result.item!) : current);
        }
        setCreateState({
          pending: false,
          lastJobId: result.jobId || "job_id 待后端返回",
          message: `证据包创建成功，job_id：${result.jobId || "job_id 待后端返回"}`,
          error: null,
        });
        return loadEvidence();
      })
      .catch((error: unknown) => {
        setCreateState({
          pending: false,
          lastJobId: "",
          message: null,
          error: safeMessage(error instanceof Error ? error.message : error, "创建证据包失败。"),
        });
      });
  }, [createState.pending, fieldId, loadEvidence, operationId, permissionBlockReason, session]);

  return (
    <OperatorLayout title={meta.title} lead={meta.lead}>
      {loading ? <div className="operatorEmptyState">证据中心加载中...</div> : null}
      {!loading && vm ? (
        <div className="operatorEvidencePage">
          <section className="operatorWorkbenchSummary">
            <div><span>数据范围</span><strong>{vm.dataScopeText}</strong></div>
            <div><span>证据任务总数</span><strong>{vm.totalCount}</strong></div>
            <div><span>更新时间</span><strong>{vm.generatedAtText}</strong></div>
          </section>

          {operationId ? (
            <section className="operatorEvidenceOperationPanel" aria-label="作业证据包导出">
              <div>
                <span>当前作业</span>
                <strong>{operationId}</strong>
                <small>scope：{scopeType} · {scopeId || "scope_id 待会话生成"} · 时间窗：{defaultWindow.label}</small>
              </div>
              <div className="operatorEvidenceOperationActions">
                <PermissionGate
                  permissionKey="export_evidence"
                  allowed={!permissionBlockReason}
                  loading={sessionLoading}
                  disabledReason={permissionBlockReason}
                  fallback={() => <button type="button" disabled>{createState.pending ? "创建中..." : "创建证据包"}</button>}
                >
                  {() => <button type="button" disabled={Boolean(disabledReason)} onClick={onCreateEvidencePackage}>{createState.pending ? "创建中..." : "创建证据包"}</button>}
                </PermissionGate>
                <button type="button" onClick={onRefresh} disabled={loading || createState.pending}>{loading ? "刷新中..." : "刷新状态"}</button>
              </div>
              {disabledReason ? <div className="operatorScopeWarning">{disabledReason}</div> : null}
              {createState.lastJobId ? <div className="operatorEvidenceJobCreated">job_id：{createState.lastJobId}</div> : null}
              {createState.message ? <div className="operatorEvidenceJobCreated">{createState.message}</div> : null}
              {createState.error ? <div className="operatorScopeWarning">{createState.error}</div> : null}
            </section>
          ) : null}

          {vm.dataScopeWarning ? <div className="operatorScopeWarning">{vm.dataScopeWarning}</div> : null}
          {!operationId && permissionBlockReason ? <div className="operatorScopeWarning">{permissionBlockReason}</div> : null}
          {!operationId && !permissionBlockReason && !vm.exportReady ? <div className="operatorScopeWarning">证据导出写操作未 ready：后端权限、审计和错误码未完成前，当前页面只读。</div> : null}

          {vm.totalCount === 0 ? <OperatorEmptyState title={vm.emptyTitle} description={vm.emptyDescription} reason="没有证据任务时不伪造 manifest、sha256 或下载入口。" /> : null}

          {vm.missingChecksumRows.length ? <div className="operatorEvidenceChecksumEmpty">{vm.missingChecksumRows.length} 个任务暂无 sha256 checksum，checksum 有则显示，无则保留正式空态。</div> : null}

          <section className="operatorEvidenceGrid" aria-label="证据导出任务">
            {vm.rows.map((row) => <EvidenceRow key={row.jobId} row={row} refreshState={jobRefreshState[row.jobId]} onRefreshJob={refreshJob} />)}
          </section>
        </div>
      ) : null}
    </OperatorLayout>
  );
}
