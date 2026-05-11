import React from "react";
import type { FlightTableRunV1 } from "../../../api/flightTable";
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

export default function FlightRunHeader(props: Props): React.ReactElement {
  const { run, runIdDraft, laneDraft, loading } = props;
  const failedStep = run?.steps.find((step) => step.status === "FAIL") ?? null;
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
              <option value="all">全航线</option>
            </select>
          </label>
        </div>
        <div className="flight-actions flight-console-primary-actions">
          <button type="button" onClick={props.onCreateRun} disabled={loading}>保存装配</button>
          <button type="button" onClick={props.onExportAcceptancePackage} disabled={loading || !run}>导出验收包</button>
          <button type="button" className="flight-action-primary" onClick={props.onStartRun} disabled={loading || !run}>启动飞行</button>
        </div>
        <div className="flight-actions flight-console-secondary-actions">
          <button type="button" onClick={props.onVerify} disabled={loading || !run}>只运行校验</button>
          <button type="button" onClick={props.onRetryFailedStep} disabled={loading || !run || !failedStep}>重新运行失败步骤</button>
          <button type="button" onClick={props.onClean} disabled={loading || !run}>清理本次数据</button>
        </div>
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
