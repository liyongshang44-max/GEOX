import React from "react";

type Props = {
  polygonGeoJson: any;
  trajectoryGeoJson: any;
  heatGeoJson: any;
  markers: Array<{ device_id: string; lat: number; lon: number; ts_ms?: number | null }>;
};

type Pt = { lat: number; lon: number };

function collectPoints(polygonGeoJson: any, trajectoryGeoJson: any, heatGeoJson: any, markers: Props["markers"]): Pt[] {
  const out: Pt[] = [];
  const push = (lon: any, lat: any) => {
    const x = Number(lon);
    const y = Number(lat);
    if (Number.isFinite(x) && Number.isFinite(y)) out.push({ lon: x, lat: y });
  };

  if (polygonGeoJson?.type === "Polygon") {
    for (const ring of polygonGeoJson.coordinates || []) for (const pt of ring || []) push(pt?.[0], pt?.[1]);
  }
  if (polygonGeoJson?.type === "MultiPolygon") {
    for (const poly of polygonGeoJson.coordinates || []) for (const ring of poly || []) for (const pt of ring || []) push(pt?.[0], pt?.[1]);
  }
  for (const f of trajectoryGeoJson?.features || []) for (const pt of f?.geometry?.coordinates || []) push(pt?.[0], pt?.[1]);
  for (const f of heatGeoJson?.features || []) push(f?.geometry?.coordinates?.[0], f?.geometry?.coordinates?.[1]);
  for (const m of markers) push(m.lon, m.lat);
  return out;
}

export default function FieldGisMap({ polygonGeoJson, trajectoryGeoJson, heatGeoJson, markers }: Props): React.ReactElement {
  const points = collectPoints(polygonGeoJson, trajectoryGeoJson, heatGeoJson, markers);
  const bounds = points.length
    ? {
      minLon: Math.min(...points.map((p) => p.lon)),
      maxLon: Math.max(...points.map((p) => p.lon)),
      minLat: Math.min(...points.map((p) => p.lat)),
      maxLat: Math.max(...points.map((p) => p.lat)),
    }
    : { minLon: 120.9, maxLon: 121.1, minLat: 31.1, maxLat: 31.3 };

  const w = 820;
  const h = 420;
  const pad = 24;
  const proj = (lon: number, lat: number) => {
    const lonSpan = Math.max(0.000001, bounds.maxLon - bounds.minLon);
    const latSpan = Math.max(0.000001, bounds.maxLat - bounds.minLat);
    return {
      x: pad + ((lon - bounds.minLon) / lonSpan) * (w - pad * 2),
      y: pad + (1 - (lat - bounds.minLat) / latSpan) * (h - pad * 2),
    };
  };

  const polygonPath = (() => {
    if (polygonGeoJson?.type !== "Polygon" || !polygonGeoJson?.coordinates?.[0]?.length) return "";
    const ring = polygonGeoJson.coordinates[0];
    return ring.map((pt: any, i: number) => {
      const p = proj(Number(pt?.[0]), Number(pt?.[1]));
      return `${i === 0 ? "M" : "L"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
    }).join(" ") + " Z";
  })();

  return (
    <div style={{ width: "100%", borderRadius: 12, overflow: "hidden", border: "1px solid #e5e7eb", background: "#f8fafc" }}>
      <svg viewBox={`0 0 ${w} ${h}`} style={{ width: "100%", height: 420 }}>
        <rect x="0" y="0" width={w} height={h} fill="#f8fafc" />
        {polygonPath ? <path d={polygonPath} fill="rgba(14,165,233,0.12)" stroke="#0284c7" strokeWidth="2" /> : null}
        {(trajectoryGeoJson?.features || []).map((f: any, i: number) => {
          const coords = f?.geometry?.coordinates || [];
          const d = coords.map((pt: any, idx: number) => {
            const p = proj(Number(pt?.[0]), Number(pt?.[1]));
            return `${idx === 0 ? "M" : "L"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
          }).join(" ");
          return <path key={i} d={d} fill="none" stroke="#2563eb" strokeWidth="2.5" opacity="0.9" />;
        })}
        {(heatGeoJson?.features || []).map((f: any, i: number) => {
          const c = f?.geometry?.coordinates || [];
          const p = proj(Number(c[0]), Number(c[1]));
          const intensity = Number(f?.properties?.intensity ?? 1);
          const r = 8 + Math.min(24, intensity * 2);
          return <circle key={i} cx={p.x} cy={p.y} r={r} fill="rgba(239,68,68,0.22)" stroke="#dc2626" />;
        })}
        {markers.map((m) => {
          const p = proj(Number(m.lon), Number(m.lat));
          return <g key={`${m.device_id}_${m.ts_ms || 0}`}>
            <circle cx={p.x} cy={p.y} r="4.5" fill="#16a34a" />
            <text x={p.x + 6} y={p.y - 6} fontSize="11" fill="#14532d">{m.device_id}</text>
          </g>;
        })}
      </svg>
    </div>
  );
}
