import React from "react";

type Props = {
  geometryId?: string | null;
};

export default function FieldSpatialCard({ geometryId }: Props): React.ReactElement {
  return (
    <section className="flight-card flight-mini-card">
      <h3>田块空间 / GIS</h3>
      <p className="flight-muted">FT-B 才上传 GeoJSON。A0 不伪造地图；无 geometry 时保持空态。</p>
      <div className="flight-empty-map">{geometryId ? "Geometry 已记录" : "No geometry"}</div>
    </section>
  );
}
