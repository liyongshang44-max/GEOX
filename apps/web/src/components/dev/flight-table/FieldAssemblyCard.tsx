import React from "react";

type Props = {
  fieldId?: string | null;
  seasonId?: string | null;
  crop?: string | null;
  cropStage?: string | null;
};

export default function FieldAssemblyCard({ fieldId, seasonId, crop, cropStage }: Props): React.ReactElement {
  return (
    <section className="flight-card flight-mini-card">
      <h3>田块创建</h3>
      <p className="flight-muted">FT-A0 只建立 run 与 manifest 空壳；田块创建在 FT-A 实现。</p>
      <dl>
        <dt>Field</dt><dd>{fieldId ?? "未创建"}</dd>
        <dt>Season</dt><dd>{seasonId ?? "未创建"}</dd>
        <dt>Crop</dt><dd>{crop ?? "未设置"}</dd>
        <dt>Stage</dt><dd>{cropStage ?? "未设置"}</dd>
      </dl>
    </section>
  );
}
