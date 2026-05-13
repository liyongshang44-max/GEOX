import React from "react";
import type { FlightTableRunV1 } from "../../../api/flightTable";
import { apiRequest, ApiError } from "../../../api/client";
import { flightTableLaneLabel, flightTableStatusLabel } from "../../../viewmodels/flightTableVm";

type Props = {
  run: FlightTableRunV1 | null;
  runIdDraft: string;
  laneDraft: string;
  onRunIdDraftChange: (next: string) => void;
  onLaneDraftChange: (next: string) => void;
  onCreateRun: () => void;
  onStartRun: () => void;
  onVerify: () => void;
  onRetryFailedStep: () => void;
  onClean: () => void;
  onExportAcceptancePackage: () => void;
  loading: boolean;
};

function errorToText(error: unknown): string {
  if (error instanceof ApiError) return error.bodyText || error.message;
  return String((error as any)?.message ?? error ?? "一键生成完整链路失败");
}

function count(value: unknown): number {
  return Array.isArray(value) ? value.length : 0;
}

export default function FlightRunHeader(props: Props): React.ReactElement {
  const { run, runIdDraft, laneDraft, loading } = props;
  const [fullRunLoading, setFullRunLoading] = React.useState(false);
  const [fullRunError, setFullRunError] = React.useState<string | null>(null);
  const failedStep = run?.steps.find((step) => step.status === "FAIL") ?? null;
  const operationCount = count(run?.manifest.operation_plan_ids);
  const taskCount = count(run?.manifest.act_task_ids);
  const receiptCount = count(run?.manifest.receipt_ids);
  const polluted = operationCount > 1 || taskCount > 1 || receiptCount > 1;

  const handleFullRun = React.useCallback(async () => {
    if (!run) return;
    setFullRunLoading(true);
    setFullRunError(null);
    try {
      await apiRequest(`/api/v1/dev/flight-table/runs/${encodeURIComponent(run.run_id)}/full-run`, {
        method: "POST",
        body: JSON.stringify({ lane: laneDraft }),
      });
      window.location.reload();
    } catch (err) {
      setFullRunError(errorToText(err));
    } finally {
      setFullRunLoading(false);
    }
  }, [laneDraft, run]);

  return (
    <header className="flight-run-header flight-console-header">
      <div className="flight-console-title-block">
        <p className="flight-kicker">GEOX 飞行台</p>
        <h1>对象装配 · 真实设备接入 · 全链路验收</h1>
        <p className="flight-muted">内部开发与交付验收控制台；不进入客户/运营正式导航。</p>
        <dl className="flight-console-scope">
          <dt>Tenant</dt><dd>{run?.tenant_id ?? "-"}</dd>
          <dt>Project</dt><dd>{run?.project_id ?? "-"}</dd>
          <dt>Group</dt><dd>{run?.group_id ?? "-"}</dd>
          <dt>Status</dt><dd>{flightTableStatusLabel(run?.status)}</dd>
        </dl>
      </div>
      <div className="flight-run-controls flight-console-controls">
        <div className="flight-console-control-grid">
          <label>
            <span>Current Run</span>
            <input value={runIdDraft} onChange={(event) => props.onRunIdDraftChange(event.target.value)} placeholder="ft_20260510_001" />
          </label>
          <label>
            <span>Lane</span>
            <select value={laneDraft} onChange={(event) => props.onLaneDraftChange(event.target.value)}>
              <option value="success">成功航线</option>
              <option value="evidence_insufficient">证据不足航线</option>
              <option value="weather_interference">天气干扰航线</option>
              <option value="skill_failure">技能失败航线</option>
              <option value="all">全异常抽样</option>
            </select>
          </label>
        </div>
        <div className="flight-actions flight-console-primary-actions">
          <button type="button" onClick={props.onCreateRun} disabled={loading || fullRunLoading}>保存装配</button>
          <button type="button" onClick={props.onExportAcceptancePackage} disabled={loading || fullRunLoading || !run}>导出验收包</button>
          <button type="button" className="flight-action-primary" onClick={handleFullRun} disabled={loading || fullRunLoading || !run}>一键生成完整链路</button>
        </div>
        <div className="flight-actions flight-console-secondary-actions">
          <button type="button" onClick={props.onStartRun} disabled={loading || fullRunLoading || !run}>只运行校验</button>
          <button type="button" onClick={props.onVerify} disabled={loading || fullRunLoading || !run}>刷新校验报告</button>
          <button type="button" onClick={props.onRetryFailedStep} disabled={loading || fullRunLoading || !run || !failedStep}>重新运行失败步骤</button>
          <button type="button" onClick={props.onClean} disabled={loading || fullRunLoading || !run}>清理运行态</button>
          <button type="button" onClick={() => window.alert("演示数据清理涉及 facts / projection / device / operation 等正式表，当前不做自动硬删除；请先使用新的 run_id 生成干净样本。")}>清理演示数据</button>
        </div>
        {fullRunError ? <p className="flight-error-text">一键生成失败：{fullRunError}</p> : null}
        {polluted ? <p className="flight-error-text">当前 run 已重复执行：operation={operationCount}，task={taskCount}，receipt={receiptCount}。该 run 不适合作为干净验收样本。</p> : null}
        {failedStep ? <p className="flight-error-text">失败定位：{failedStep.step_key} · {failedStep.message ?? "无错误说明"}</p> : null}
        {run ? (
          <div className="flight-current-run">
            <strong>{run.run_id}</strong>
            <span>{flightTableStatusLabel(run.status)} · {flightTableLaneLabel(run.lane)}</span>
          </div>
        ) : null}
      </div>
    </header>
  );
}
