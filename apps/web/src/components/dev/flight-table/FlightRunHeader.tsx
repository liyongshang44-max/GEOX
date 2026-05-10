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
  onVerify: () => void;
  onClean: () => void;
  loading: boolean;
};

export default function FlightRunHeader(props: Props): React.ReactElement {
  const { run, runIdDraft, laneDraft, loading } = props;
  return (
    <header className="flight-run-header">
      <div>
        <p className="flight-kicker">GEOX 飞行台</p>
        <h1>对象装配 · 真实设备接入 · 全链路验收</h1>
        <p className="flight-muted">内部开发与交付验收控制台；不进入客户/运营正式导航。</p>
      </div>
      <div className="flight-run-controls">
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
        <div className="flight-actions">
          <button type="button" onClick={props.onCreateRun} disabled={loading}>保存装配</button>
          <button type="button" onClick={props.onVerify} disabled={loading || !run}>只运行校验</button>
          <button type="button" onClick={props.onClean} disabled={loading || !run}>清理本次数据</button>
        </div>
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
