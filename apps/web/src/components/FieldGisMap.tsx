import React from "react";

type Marker = { device_id: string; lat: number; lon: number; ts_ms?: number | null };

type ViewPoint = { lon: number; lat: number };
type Bounds = { minLon: number; maxLon: number; minLat: number; maxLat: number };

function collectCoordinatePairs(raw: any, out: Array<[number, number]>): void {
  if (!Array.isArray(raw)) return;
  if (raw.length >= 2 && Number.isFinite(Number(raw[0])) && Number.isFinite(Number(raw[1]))) {
    out.push([Number(raw[0]), Number(raw[1])]);
    return;
  }
  for (const item of raw) collectCoordinatePairs(item, out);
}

function extractGeoPoints(geo: any): ViewPoint[] {
  if (!geo || typeof geo !== "object") return [];
  const type = String(geo?.type ?? "");
  if (type === "Feature") return extractGeoPoints(geo?.geometry);
  if (type === "FeatureCollection") return Array.isArray(geo?.features) ? geo.features.flatMap((f: any) => extractGeoPoints(f)) : [];
  const pairs: Array<[number, number]> = [];
  if (type === "Point") {
    const coordinates = geo?.coordinates;
    if (Array.isArray(coordinates) && coordinates.length >= 2) pairs.push([Number(coordinates[0]), Number(coordinates[1])]);
  } else if (type === "Polygon" || type === "MultiPolygon" || type === "LineString" || type === "MultiLineString") {
    collectCoordinatePairs(geo?.coordinates, pairs);
  }
  return pairs
    .filter(([lon, lat]) => Number.isFinite(lon) && Number.isFinite(lat) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180)
    .map(([lon, lat]) => ({ lon, lat }));
}

function toBounds(points: ViewPoint[]): Bounds | null {
  if (!points.length) return null;
  return {
    minLon: Math.min(...points.map((p) => p.lon)),
    maxLon: Math.max(...points.map((p) => p.lon)),
    minLat: Math.min(...points.map((p) => p.lat)),
    maxLat: Math.max(...points.map((p) => p.lat)),
  };
}

function expandBounds(bounds: Bounds): Bounds {
  const lonSpan = Math.max(0.0005, bounds.maxLon - bounds.minLon);
  const latSpan = Math.max(0.0005, bounds.maxLat - bounds.minLat);
  const lonPad = lonSpan * 0.08;
  const latPad = latSpan * 0.08;
  return {
    minLon: bounds.minLon - lonPad,
    maxLon: bounds.maxLon + lonPad,
    minLat: bounds.minLat - latPad,
    maxLat: bounds.maxLat + latPad,
  };
}

function extractPolygonRings(geo: any): Array<Array<[number, number]>> {
  if (!geo || typeof geo !== "object") return [];
  const type = String(geo?.type ?? "");
  if (type === "Feature") return extractPolygonRings(geo?.geometry);
  if (type === "FeatureCollection") return Array.isArray(geo?.features) ? geo.features.flatMap((f: any) => extractPolygonRings(f)) : [];
  if (type === "Polygon") {
    return (Array.isArray(geo?.coordinates) ? geo.coordinates : []).flatMap((ring: any) => {
      const pairs: Array<[number, number]> = [];
      collectCoordinatePairs(ring, pairs);
      return pairs.length ? [pairs] : [];
    });
  }
  if (type === "MultiPolygon") {
    return (Array.isArray(geo?.coordinates) ? geo.coordinates : []).flatMap((polygon: any) => extractPolygonRings({ type: "Polygon", coordinates: polygon }));
  }
  return [];
}

export default function FieldGisMap({
  polygonGeoJson,
  trajectoryGeoJson,
  heatGeoJson,
  markers,
  labels,
  onSelectObject,
}: {
  polygonGeoJson: any;
  trajectoryGeoJson: any;
  heatGeoJson: any;
  markers: Marker[];
  labels?: any;
  onSelectObject?: (obj: any) => void;
}): React.ReactElement {
  const polygonPoints = extractGeoPoints(polygonGeoJson);
  const trajectoryPoints = extractGeoPoints(trajectoryGeoJson);
  const heatPoints = extractGeoPoints(heatGeoJson);
  const markerPoints = markers.map((m) => ({ lon: Number(m.lon), lat: Number(m.lat) })).filter((p) => Number.isFinite(p.lon) && Number.isFinite(p.lat));
  const allBoundsPoints = [...polygonPoints, ...trajectoryPoints, ...heatPoints, ...markerPoints];
  const computedBounds = toBounds(allBoundsPoints);
  const bounds = computedBounds ? expandBounds(computedBounds) : { minLon: 120.9, maxLon: 121.1, minLat: 31.1, maxLat: 31.3 };

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

  const polygonPaths = extractPolygonRings(polygonGeoJson).map((ring) => {
    return ring.map((pt, i) => {
      const p = proj(Number(pt[0]), Number(pt[1]));
      return `${i === 0 ? "M" : "L"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
    }).join(" ") + " Z";
  }).filter(Boolean);

  return (
    <div style={{ width: "100%", borderRadius: 12, overflow: "hidden", border: "1px solid #e5e7eb", background: "#f8fafc" }}>
      <svg viewBox={`0 0 ${w} ${h}`} style={{ width: "100%", height: 420 }}>
        <rect x="0" y="0" width={w} height={h} fill="#f8fafc" />
        {polygonPaths.map((path, i) => <path key={`poly_${i}`} d={path} fill="rgba(14,165,233,0.12)" stroke="#0284c7" strokeWidth="2" onClick={() => onSelectObject?.({ kind: labels?.fieldBoundary || "Field Boundary", name: `#${i + 1}` })} />)}
        {(trajectoryGeoJson?.features || []).map((f: any, i: number) => {
          const coords = Array.isArray(f?.geometry?.coordinates) ? f.geometry.coordinates : [];
          const d = coords.map((pt: any, idx: number) => {
            const p = proj(Number(pt?.[0]), Number(pt?.[1]));
            return `${idx === 0 ? "M" : "L"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
          }).join(" ");
          return d ? <path key={i} d={d} fill="none" stroke="#2563eb" strokeWidth="2.5" opacity="0.9" onClick={() => onSelectObject?.({ kind: labels?.operationTrack || "Device / Operation Track", name: `track_${i + 1}`, related: f?.properties?.task_id || f?.properties?.operation_id || "-" })} /> : null;
        })}
        {(heatGeoJson?.features || []).map((f: any, i: number) => {
          const c = f?.geometry?.coordinates || [];
          const p = proj(Number(c[0]), Number(c[1]));
          const intensity = Number(f?.properties?.intensity ?? 1);
          const r = 8 + Math.min(24, intensity * 2);
          return <circle key={i} cx={p.x} cy={p.y} r={r} fill="rgba(239,68,68,0.22)" stroke="#dc2626" onClick={() => onSelectObject?.({ kind: labels?.alertLocation || "Alert Location", name: f?.properties?.event_id || `alert_${i + 1}`, time: f?.properties?.time || "-", related: f?.properties?.metric || "-" })} />;
        })}
        {markers.map((m) => {
          const p = proj(Number(m.lon), Number(m.lat));
          return <g key={`${m.device_id}_${m.ts_ms || 0}`} onClick={() => onSelectObject?.({ kind: labels?.devicePosition || "Device Position", name: m.device_id, time: m.ts_ms ? new Date(m.ts_ms).toLocaleString() : "-" })}>
            <circle cx={p.x} cy={p.y} r="4.5" fill="#16a34a" />
            <text x={p.x + 6} y={p.y - 6} fontSize="11" fill="#14532d">{m.device_id}</text>
          </g>;
        })}
      </svg>
    </div>
  );
}
