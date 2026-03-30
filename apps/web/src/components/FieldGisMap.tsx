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

export default function FieldGisMap({
  polygonGeoJson,
  heatGeoJson,
  markers,
  trajectorySegments,
  activeSegmentId,
  acceptancePoints = [],
  labels,
  onSelectObject,
}: {
  polygonGeoJson: any;
  heatGeoJson: any;
  markers: Marker[];
  trajectorySegments: TrajectorySegment[];
  activeSegmentId?: string;
  acceptancePoints?: AcceptancePoint[];
  labels?: any;
  onSelectObject?: (obj: any) => void;
}): React.ReactElement {
  const markerPoints = markers.map((m) => ({ lon: Number(m.lon), lat: Number(m.lat) })).filter((p) => Number.isFinite(p.lon) && Number.isFinite(p.lat));
  const segmentPoints = trajectorySegments.flatMap((s) => s.coordinates.map(([lon, lat]) => ({ lon, lat })));
  const heatPoints = (heatGeoJson?.features || []).map((f: any) => ({ lon: Number(f?.geometry?.coordinates?.[0]), lat: Number(f?.geometry?.coordinates?.[1]) })).filter((p: any) => Number.isFinite(p.lon) && Number.isFinite(p.lat));
  const polygonPoints = extractPolygonRings(polygonGeoJson).flat().map(([lon, lat]) => ({ lon: Number(lon), lat: Number(lat) }));
  const acceptanceGeoPoints = acceptancePoints.map((p) => ({ lon: Number(p.lon), lat: Number(p.lat) })).filter((p) => Number.isFinite(p.lon) && Number.isFinite(p.lat));
  const computedBounds = toBounds([...polygonPoints, ...markerPoints, ...segmentPoints, ...heatPoints, ...acceptanceGeoPoints]);
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

  const primarySegment = useMemo(() => {
    if (!trajectorySegments.length) return null;
    return trajectorySegments.find((s) => s.id === activeSegmentId) || trajectorySegments[0];
  }, [trajectorySegments, activeSegmentId]);

  const [cursorIndex, setCursorIndex] = useState(0);

  useEffect(() => {
    setCursorIndex(0);
  }, [primarySegment?.id]);

  useEffect(() => {
    if (!primarySegment || primarySegment.coordinates.length < 2) return;
    const timer = window.setInterval(() => {
      setCursorIndex((prev) => {
        if (prev >= primarySegment.coordinates.length - 1) return prev;
        return prev + 1;
      });
    }, 320);
    return () => window.clearInterval(timer);
  }, [primarySegment]);

  const visiblePrimaryCoordinates = primarySegment
    ? primarySegment.coordinates.slice(0, Math.max(2, cursorIndex + 1))
    : [];

  const currentPoint = primarySegment ? pointAt(primarySegment.coordinates, cursorIndex) : null;
  const currentMarkerPoint = currentPoint ? proj(Number(currentPoint[0]), Number(currentPoint[1])) : null;

  return (
    <div style={{ width: "100%", borderRadius: 12, overflow: "hidden", border: "1px solid #e5e7eb", background: "#f8fafc" }}>
      <svg viewBox={`0 0 ${w} ${h}`} style={{ width: "100%", height: 420 }}>
        <rect x="0" y="0" width={w} height={h} fill="#f8fafc" />

        {polygonPaths.map((path, i) => (
          <path
            key={`poly_${i}`}
            d={path}
            fill="rgba(14,165,233,0.12)"
            stroke="#0284c7"
            strokeWidth="2"
            onClick={() => onSelectObject?.({ kind: labels?.fieldBoundary || "Field Boundary", name: `#${i + 1}`, status: "-" })}
          />
        ))}

        {trajectorySegments.map((segment) => {
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
        })}

        {(heatGeoJson?.features || []).map((f: any, i: number) => {
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
        })}

        {markers.map((m) => {
          const p = proj(Number(m.lon), Number(m.lat));
          return (
            <g key={`${m.device_id}_${m.ts_ms || 0}`} onClick={() => onSelectObject?.({ kind: labels?.devicePosition || "Device Position", name: m.device_id, time: m.ts_ms ? new Date(m.ts_ms).toLocaleString() : "-", status: "-" })}>
              <circle cx={p.x} cy={p.y} r="4.5" fill="#16a34a" opacity="0.45" />
              <text x={p.x + 6} y={p.y - 6} fontSize="11" fill="#14532d">{m.device_id}</text>
            </g>
          );
        })}

        {acceptancePoints.map((a) => {
          const p = proj(Number(a.lon), Number(a.lat));
          const fill = String(a.status).toUpperCase().includes("FAIL") ? "#dc2626" : "#7c3aed";
          return (
            <g key={`acc_${a.id}`} onClick={() => onSelectObject?.({ kind: labels?.layerAcceptance || "Acceptance Layer", name: a.id, status: a.status })}>
              <rect x={p.x - 4} y={p.y - 4} width={8} height={8} fill={fill} />
            </g>
          );
        })}

        {currentMarkerPoint && (
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
