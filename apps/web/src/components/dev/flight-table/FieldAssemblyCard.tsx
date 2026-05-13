import React from "react";

export type FieldAssemblyDraftV1 = {
  tenant_id: string;
  project_id: string;
  group_id: string;
  field_id: string;
  field_name: string;
  crop: string;
  season_id: string;
  crop_stage: string;
};

type Props = {
  draft: FieldAssemblyDraftV1;
  fieldId?: string | null;
  seasonId?: string | null;
  crop?: string | null;
  cropStage?: string | null;
  customerVisible?: boolean;
  reportVisible?: boolean;
  loading: boolean;
  error: string | null;
  onDraftChange: (patch: Partial<FieldAssemblyDraftV1>) => void;
  onCreateField: () => void;
  onVerifyField: () => void;
};

function statusLabel(props: Pick<Props, "fieldId" | "customerVisible" | "reportVisible" | "loading" | "error">): string {
  if (props.loading) return "创建中";
  if (props.error) return "失败";
  if (props.fieldId && props.customerVisible && props.reportVisible) return "field report 可见";
  if (props.fieldId && props.customerVisible) return "customer/fields 可见";
  if (props.fieldId) return "已创建";
  return "未创建";
}

export default function FieldAssemblyCard(props: Props): React.ReactElement {
  const { draft, fieldId, seasonId, crop, cropStage, loading, error } = props;
  const reportHref = fieldId ? `/customer/fields/${encodeURIComponent(fieldId)}` : "";
  return (
    <section className="flight-card flight-field-card">
      <div className="flight-card-head">
        <h3>田块创建</h3>
        <span>{statusLabel(props)}</span>
      </div>
      <div className="flight-form-grid">
        <label><span>tenant_id</span><input value={draft.tenant_id} onChange={(event) => props.onDraftChange({ tenant_id: event.target.value })} /></label>
        <label><span>project_id</span><input value={draft.project_id} onChange={(event) => props.onDraftChange({ project_id: event.target.value })} /></label>
        <label><span>group_id</span><input value={draft.group_id} onChange={(event) => props.onDraftChange({ group_id: event.target.value })} /></label>
        <label><span>field_id</span><input value={draft.field_id} onChange={(event) => props.onDraftChange({ field_id: event.target.value })} /></label>
        <label><span>field_name</span><input value={draft.field_name} onChange={(event) => props.onDraftChange({ field_name: event.target.value })} /></label>
        <label><span>crop</span><input value={draft.crop} onChange={(event) => props.onDraftChange({ crop: event.target.value })} /></label>
        <label><span>season_id</span><input value={draft.season_id} onChange={(event) => props.onDraftChange({ season_id: event.target.value })} /></label>
        <label><span>crop_stage</span><input value={draft.crop_stage} onChange={(event) => props.onDraftChange({ crop_stage: event.target.value })} /></label>
      </div>
      <div className="flight-actions flight-card-actions">
        <button type="button" onClick={props.onCreateField} disabled={loading}>创建田块</button>
        <button type="button" onClick={props.onVerifyField} disabled={loading || !fieldId}>验证 customer/fields</button>
        {fieldId ? <a className="flight-link-button" href={reportHref}>打开地块病历</a> : <span className="flight-muted">创建后可打开地块病历</span>}
      </div>
      <dl className="flight-field-state">
        <dt>manifest.field_id</dt><dd>{fieldId ?? "未创建"}</dd>
        <dt>manifest.season_id</dt><dd>{seasonId ?? "未创建"}</dd>
        <dt>manifest.crop</dt><dd>{crop ?? "未设置"}</dd>
        <dt>manifest.crop_stage</dt><dd>{cropStage ?? "未设置"}</dd>
        <dt>customer/fields</dt><dd>{props.customerVisible ? "可见" : "待验证"}</dd>
        <dt>field report</dt><dd>{props.reportVisible ? "可见" : "待验证"}</dd>
      </dl>
      {error ? <p className="flight-error-text">{error}</p> : null}
    </section>
  );
}
