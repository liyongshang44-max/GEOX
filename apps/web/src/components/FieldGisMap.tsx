import React, { useEffect, useMemo, useState } from "react";

type Marker = { device_id: string; lat: number; lon: number; ts_ms?: number | null };
type TrajectorySegment = {
  id: string;
  status: "READY" | "DISPATCHED" | "SUCCEEDED" | "FAILED";
  color: string;
  coordinates: Array<[number, number]>;
  label?: string;
};
type AcceptancePoint = { id: string; status: string; lat: number; lon: number };

type ViewPoint = { lon: number; lat: number };
type Bounds = { minLon: number; maxLon: number; minLat: number; maxLat: number };
type LayerKey = "boundary" | "planned" | "coverage" | "trajectory" | "acceptance" | "heat" | "device";

type LayerOption = {
  key: LayerKey;
  label: string;
  swatch: string;
  hasData: boolean;
};

function collectCoordinatePairs(raw: any, out: Array<[number, number]>): void {
  if (!Array.isArray(raw)) return;
  if (raw.length >= 2 && Number.isFinite(Number(raw[0])) && Number.isFinite(Number(raw[1]))) {
    out.push([Number(raw[0]), Number(raw[1])]);
    return;
  }
  for (const item of raw) collectCoordinatePairs(item, out);
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

function buildPath(points: Array<[number, number]>, proj: (lon: number, lat: number) => { x: number; y: number }): string {
  return points.map((pt, idx) => {
    const p = proj(Number(pt[0]), Number(pt[1]));
    return `${idx === 0 ? "M" : "L"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
  }).join(" ");
}

function pointAt(points: Array<[number, number]>, idx: number): [number, number] | null {
  if (!points.length) return null;
  const safe = Math.max(0, Math.min(points.length - 1, idx));
  return points[safe] ?? null;
}

function layerButtonStyle(active: boolean): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    border: "1px solid #d1d5db",
    borderRadius: 999,
    padding: "5px 9px",
    background: active ? "#ffffff" : "#f3f4f6",
    color: active ? "#111827" : "#6b7280",
    fontSize: 12,
    fontWeight: 800,
    cursor: "pointer",
    whiteSpace: "nowrap",
  };
}

function swatchStyle(color: string, active: boolean): React.CSSProperties {
  return {
    width: 10,
    height: 10,
    borderRadius: 999,
    background: color,
    opacity: active ? 1 : 0.35,
    boxShadow: "0 0 0 2px rgba(255,255,255,.9)",
  };
}

function mapShellStyle(): React.CSSProperties {
  return {
    width: "100%",
    maxWidth: "100%",
    minWidth: 0,
    borderRadius: 12,
    overflow: "hidden",
    border: "1px solid #e5e7eb",
    background: "#f8fafc",
    boxSizing: "border-box",
  };
}

export default function FieldGisMap({
  polygonGeoJson,
  plannedGeoJson,
  coverageGeoJson,
  heatGeoJson,
  markers,
  trajectorySegments,
  activeSegmentId,
  acceptancePoints = [],
  labels,
  onSelectObject,
}: {
  polygonGeoJson: any;
  plannedGeoJson?: any;
  coverageGeoJson?: any;
  heatGeoJson: any;
  markers: Marker[];
  trajectorySegments: TrajectorySegment[];
  activeSegmentId?: string;
  acceptancePoints?: AcceptancePoint[];
  labels?: any;
  onSelectObject?: (obj: any) => void;
}): React.ReactElement {
  const markerPoints = markers.map((m) => ({ lon: Number(m.lon), lat: Number(m.lat) })).filter((p) => Number.isFinite(p.lon) && Number.isFinite(p.lat));
  const validMarkers = markers.filter((m) => Number.isFinite(Number(m.lon)) && Number.isFinite(Number(m.lat)));
  const validTrajectorySegments = trajectorySegments.filter((segment) => segment.coordinates.some(([lon, lat]) => Number.isFinite(Number(lon)) && Number.isFinite(Number(lat))));
  const segmentPoints = validTrajectorySegments.flatMap((s) => s.coordinates.map(([lon, lat]) => ({ lon: Number(lon), lat: Number(lat) })).filter((p) => Number.isFinite(p.lon) && Number.isFinite(p.lat)));
  const heatFeatures = Array.isArray(heatGeoJson?.features) ? heatGeoJson.features : [];
  const validHeatFeatures = heatFeatures.filter((f: any) => Number.isFinite(Number(f?.geometry?.coordinates?.[0])) && Number.isFinite(Number(f?.geometry?.coordinates?.[1])));
  const heatPoints = validHeatFeatures.map((f: any) => ({ lon: Number(f?.geometry?.coordinates?.[0]), lat: Number(f?.geometry?.coordinates?.[1]) }));
  const polygonPoints = extractPolygonRings(polygonGeoJson).flat().map(([lon, lat]) => ({ lon: Number(lon), lat: Number(lat) })).filter((p) => Number.isFinite(p.lon) && Number.isFinite(p.lat));
  const plannedPoints = extractPolygonRings(plannedGeoJson).flat().map(([lon, lat]) => ({ lon: Number(lon), lat: Number(lat) })).filter((p) => Number.isFinite(p.lon) && Number.isFinite(p.lat));
  const coveragePoints = extractPolygonRings(coverageGeoJson).flat().map(([lon, lat]) => ({ lon: Number(lon), lat: Number(lat) })).filter((p) => Number.isFinite(p.lon) && Number.isFinite(p.lat));
  const validAcceptancePoints = acceptancePoints.filter((p) => Number.isFinite(Number(p.lon)) && Number.isFinite(Number(p.lat)));
  const acceptanceGeoPoints = validAcceptancePoints.map((p) => ({ lon: Number(p.lon), lat: Number(p.lat) }));
  const computedBounds = toBounds([...polygonPoints, ...plannedPoints, ...coveragePoints, ...markerPoints, ...segmentPoints, ...heatPoints, ...acceptanceGeoPoints]);
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

  // 防伪造规则：没有真实 geometry / coverage / trajectory / acceptance points 时，不生成对应图形。
  const polygonPaths = extractPolygonRings(polygonGeoJson).map((ring) => {
    return ring.map((pt, i) => {
      const p = proj(Number(pt[0]), Number(pt[1]));
      return `${i === 0 ? "M" : "L"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
    }).join(" ") + " Z";
  }).filter(Boolean);

  const plannedPaths = extractPolygonRings(plannedGeoJson).map((ring) => {
    return ring.map((pt, i) => {
      const p = proj(Number(pt[0]), Number(pt[1]));
      return `${i === 0 ? "M" : "L"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
    }).join(" ") + " Z";
  }).filter(Boolean);

  const coveragePaths = extractPolygonRings(coverageGeoJson).map((ring) => {
    return ring.map((pt, i) => {
      const p = proj(Number(pt[0]), Number(pt[1]));
      return `${i === 0 ? "M" : "L"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
    }).join(" ") + " Z";
  }).filter(Boolean);

  const [visibleLayers, setVisibleLayers] = useState<Record<LayerKey, boolean>>({
    boundary: true,
    planned: true,
    coverage: true,
    trajectory: true,
    acceptance: true,
    heat: true,
    device: true,
  });
  const isLayerVisible = (key: LayerKey) => visibleLayers[key] !== false;

  const allLayerOptions: LayerOption[] = [
    { key: "boundary", label: labels?.fieldBoundary || "地块边界", swatch: "#0284c7", hasData: polygonPaths.length > 0 },
    { key: "planned", label: labels?.plannedLayer || "计划区域", swatch: "#d97706", hasData: plannedPaths.length > 0 },
    { key: "coverage", label: labels?.coverageLayer || "实际覆盖", swatch: "#16a34a", hasData: coveragePaths.length > 0 },
    { key: "trajectory", label: labels?.operationTrack || "设备轨迹", swatch: "#2563eb", hasData: validTrajectorySegments.length > 0 && segmentPoints.length > 0 },
    { key: "device", label: labels?.devicePosition || "设备位置", swatch: "#16a34a", hasData: validMarkers.length > 0 && markerPoints.length > 0 },
    { key: "acceptance", label: labels?.layerAcceptance || "验收点", swatch: "#7c3aed", hasData: validAcceptancePoints.length > 0 && acceptanceGeoPoints.length > 0 },
    { key: "heat", label: labels?.alertLocation || "告警/热区", swatch: "#dc2626", hasData: validHeatFeatures.length > 0 && heatPoints.length > 0 },
  ];
  const layerOptions = allLayerOptions.filter((item) => item.hasData);

  const primarySegment = useMemo(() => {
    if (!validTrajectorySegments.length) return null;
    return validTrajectorySegments.find((s) => s.id === activeSegmentId) || validTrajectorySegments[0];
  }, [validTrajectorySegments, activeSegmentId]);

  const [cursorIndex, setCursorIndex] = useState(0);

  useEffect(() => {
    setCursorIndex(0);
  }, [primarySegment?.id]);

  useEffect(() => {
    if (!primarySegment || primarySegment.coordinates.length < 2 || !isLayerVisible("trajectory")) return;
    // UI-only cursor animation over server-provided trajectory; this never fabricates telemetry data.
    const timer = window.setInterval(() => {
      setCursorIndex((prev) => {
        if (prev >= primarySegment.coordinates.length - 1) return prev;
        return prev + 1;
      });
    }, 320);
    return () => window.clearInterval(timer);
  }, [primarySegment, visibleLayers.trajectory]);

  const visiblePrimaryCoordinates = primarySegment
    ? primarySegment.coordinates.slice(0, Math.max(2, cursorIndex + 1))
    : [];

  const currentPoint = primarySegment ? pointAt(primarySegment.coordinates, cursorIndex) : null;
  const currentMarkerPoint = currentPoint ? proj(Number(currentPoint[0]), Number(currentPoint[1])) : null;

  if (layerOptions.length === 0) {
    return (
      <div style={mapShellStyle()}>
        <div style={{ padding: 16, minHeight: 120, display: "grid", alignContent: "center", gap: 6 }}>
          <strong style={{ color: "#111827", fontSize: 14 }}>暂无可渲染空间图层。</strong>
          <span style={{ color: "#64748b", fontSize: 13, lineHeight: 1.5 }}>未收到地块边界、计划区域、实际覆盖、设备轨迹、验收点或告警/热区数据；系统不会绘制示意地图或伪造空间对象。</span>
        </div>
      </div>
    );
  }

  return (
    <div style={mapShellStyle()}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", padding: "10px 12px", borderBottom: "1px solid #e5e7eb", background: "#ffffff" }} aria-label="GIS 图层开关">
        <span style={{ color: "#4b5563", fontSize: 12, fontWeight: 900 }}>图层</span>
        {layerOptions.map((layer) => {
          const active = isLayerVisible(layer.key);
          return (
            <button
              key={layer.key}
              type="button"
              aria-pressed={active}
              onClick={() => setVisibleLayers((prev) => ({ ...prev, [layer.key]: !active }))}
              style={layerButtonStyle(active)}
            >
              <span style={swatchStyle(layer.swatch, active)} />
              {layer.label}
            </button>
          );
        })}
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} style={{ width: "100%", maxWidth: "100%", height: 420, display: "block" }}>
        <rect x="0" y="0" width={w} height={h} fill="#f8fafc" />

        {isLayerVisible("boundary") ? polygonPaths.map((path, i) => (
          <path
            key={`poly_${i}`}
            d={path}
            fill="rgba(14,165,233,0.12)"
            stroke="#0284c7"
            strokeWidth="2"
            onClick={() => onSelectObject?.({ kind: labels?.fieldBoundary || "Field Boundary", name: `#${i + 1}`, status: "-" })}
          />
        )) : null}

        {isLayerVisible("planned") ? plannedPaths.map((path, i) => (
          <path
            key={`planned_${i}`}
            d={path}
            fill="rgba(245,158,11,0.12)"
            stroke="#d97706"
            strokeWidth="2"
            strokeDasharray="8 5"
            onClick={() => onSelectObject?.({ kind: labels?.plannedLayer || "Planned Layer", name: `#${i + 1}`, status: "planned" })}
          />
        )) : null}

        {isLayerVisible("coverage") ? coveragePaths.map((path, i) => (
          <path
            key={`coverage_${i}`}
            d={path}
            fill="rgba(34,197,94,0.18)"
            stroke="#16a34a"
            strokeWidth="2"
            strokeDasharray="5 4"
            onClick={() => onSelectObject?.({ kind: labels?.coverageLayer || "Coverage Layer", name: `#${i + 1}`, status: "actual" })}
          />
        )) : null}

        {isLayerVisible("trajectory") ? validTrajectorySegments.map((segment) => {
          const isPrimary = primarySegment?.id === segment.id;
          const basePath = buildPath(segment.coordinates, proj);
          if (!basePath) return null;

          const visiblePath = isPrimary ? buildPath(visiblePrimaryCoordinates, proj) : basePath;
          const isActive = activeSegmentId && activeSegmentId === segment.id;

          return (
            <g key={segment.id} onClick={() => onSelectObject?.({ kind: labels?.operationTrack || "Device / Operation Track", name: segment.label || segment.id, status: segment.status, id: segment.id })}>
              {!isPrimary && (
                <path
                  d={basePath}
                  fill="none"
                  stroke={segment.color}
                  strokeWidth={isActive ? 4 : 2.5}
                  opacity={0.28}
                />
              )}
              {isPrimary && (
                <>
                  <path d={basePath} fill="none" stroke={segment.color} strokeWidth={2.5} opacity={0.2} />
                  <path d={visiblePath} fill="none" stroke={segment.color} strokeWidth={isActive ? 4.8 : 4} opacity={1} strokeLinecap="round" strokeLinejoin="round" />
                </>
              )}
            </g>
          );
        }) : null}

        {isLayerVisible("heat") ? validHeatFeatures.map((f: any, i: number) => {
          const c = f?.geometry?.coordinates || [];
          const p = proj(Number(c[0]), Number(c[1]));
          const intensity = Number(f?.properties?.intensity ?? 1);
          const r = 8 + Math.min(24, intensity * 2);
          return (
            <circle
              key={i}
              cx={p.x}
              cy={p.y}
              r={r}
              fill="rgba(239,68,68,0.22)"
              stroke="#dc2626"
              onClick={() => onSelectObject?.({ kind: labels?.alertLocation || "Alert Location", name: f?.properties?.event_id || `alert_${i + 1}`, time: f?.properties?.time || "-", related: f?.properties?.metric || "-", status: f?.properties?.status || "-" })}
            />
          );
        }) : null}

        {isLayerVisible("device") ? validMarkers.map((m) => {
          const p = proj(Number(m.lon), Number(m.lat));
          return (
            <g key={`${m.device_id}_${m.ts_ms || 0}`} onClick={() => onSelectObject?.({ kind: labels?.devicePosition || "Device Position", name: m.device_id, time: m.ts_ms ? new Date(m.ts_ms).toLocaleString() : "-", status: "-" })}>
              <circle cx={p.x} cy={p.y} r="4.5" fill="#16a34a" opacity="0.45" />
              <text x={p.x + 6} y={p.y - 6} fontSize="11" fill="#14532d">{m.device_id}</text>
            </g>
          );
        }) : null}

        {isLayerVisible("acceptance") ? validAcceptancePoints.map((a) => {
          const p = proj(Number(a.lon), Number(a.lat));
          const fill = String(a.status).toUpperCase().includes("FAIL") ? "#dc2626" : "#7c3aed";
          return (
            <g key={`acc_${a.id}`} onClick={() => onSelectObject?.({ kind: labels?.layerAcceptance || "Acceptance Layer", name: a.id, status: a.status })}>
              <rect x={p.x - 4} y={p.y - 4} width={8} height={8} fill={fill} />
            </g>
          );
        }) : null}

        {isLayerVisible("trajectory") && currentMarkerPoint && (
          <g onClick={() => onSelectObject?.({ kind: labels?.devicePosition || "Device Position", name: primarySegment?.label || primarySegment?.id || "current", status: primarySegment?.status || "-" })}>
            <circle cx={currentMarkerPoint.x} cy={currentMarkerPoint.y} r="8" fill="rgba(37,99,235,0.18)">
              <animate attributeName="r" values="8;16;8" dur="1.4s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.55;0.12;0.55" dur="1.4s" repeatCount="indefinite" />
            </circle>
            <circle cx={currentMarkerPoint.x} cy={currentMarkerPoint.y} r="5.5" fill="#2563eb" stroke="#ffffff" strokeWidth="2" />
            <text x={currentMarkerPoint.x + 10} y={currentMarkerPoint.y - 10} fontSize="11" fill="#1d4ed8">
              {primarySegment?.label || "当前位置"}
            </text>
          </g>
        )}
      </svg>
    </div>
  );
}
