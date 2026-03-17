import React from "react";
import type { OperationLabels } from "../../lib/operationViewModel";

export default function OperationQuickCreate(props: {
  labels: OperationLabels;
  issuer: string;
  actionType: string;
  targetText: string;
  requestDeviceId: string;
  parametersText: string;
  roleText: string;
  disabled: boolean;
  onIssuer: (v: string) => void;
  onActionType: (v: string) => void;
  onTargetText: (v: string) => void;
  onDevice: (v: string) => void;
  onParameters: (v: string) => void;
  onCreate: () => void;
}): React.ReactElement {
  return (
    <details className="card" style={{ padding: 14 }}>
      <summary style={{ cursor: "pointer", fontWeight: 700 }}>{props.labels.createOperation}</summary>
      <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
          <label className="field"><span>{props.labels.initiator}</span><input value={props.issuer} onChange={(e) => props.onIssuer(e.target.value)} /></label>
          <label className="field"><span>{props.labels.operationTemplate}</span><select value={props.actionType} onChange={(e) => props.onActionType(e.target.value)}><option value="IRRIGATE">IRRIGATE</option><option value="SPRAY">SPRAY</option><option value="PLOW">PLOW</option><option value="HARROW">HARROW</option><option value="HARVEST">HARVEST</option></select></label>
          <label className="field"><span>{props.labels.targetField}</span><input value={props.targetText} onChange={(e) => props.onTargetText(e.target.value)} placeholder="field_demo" /></label>
          <label className="field"><span>{props.labels.targetDevice}</span><input value={props.requestDeviceId} onChange={(e) => props.onDevice(e.target.value)} placeholder="dev_demo" /></label>
          <label className="field" style={{ gridColumn: "1 / -1" }}><span>{props.labels.executionParameters}</span><textarea rows={6} value={props.parametersText} onChange={(e) => props.onParameters(e.target.value)} /></label>
        </div>
        <div className="metaText">{props.roleText}</div>
        <div><button className="btn primary" disabled={props.disabled} onClick={props.onCreate}>{props.labels.createOperation}</button></div>
      </div>
    </details>
  );
}
