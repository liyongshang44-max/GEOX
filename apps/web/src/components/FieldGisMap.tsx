import React from "react"; // React component and hooks.

type Marker = { device_id: string; lat: number; lon: number; ts_ms?: number | null }; // Device marker payload.
type ViewPoint = { lon: number; lat: number }; // Flat geographic point.
type Bounds = { minLon: number; maxLon: number; minLat: number; maxLat: number }; // Map bounds.
type PopupState = { kind: "marker" | "heat"; title: string; lines: string[]; x: number; y: number } | null; // Minimal click popup state.

type HeatFeature = { // Normalized heat point.
  lon: number; // Longitude.
  lat: number; // Latitude.
  weight: number; // Heat weight.
  metric: string; // Metric label.
  objectType: string; // FIELD / DEVICE / MIXED.
  lastRaisedTsMs: number | null; // Latest event timestamp.
};

function fmtTs(ms: number | null | undefined): string { // Format timestamps for map popup display.
  if (!ms || !Number.isFinite(ms)) return "-"; // Missing => dash.
  return new Date(ms).toLocaleString(); // Browser-local formatted datetime.
} // End helper.

function collectCoordinatePairs(raw: any, out: Array<[number, number]>): void { // Recursively flatten GeoJSON coordinate arrays.
  if (!Array.isArray(raw)) return; // Ignore non-array values.
  if (raw.length >= 2 && Number.isFinite(Number(raw[0])) && Number.isFinite(Number(raw[1]))) { // Direct lon/lat pair.
    out.push([Number(raw[0]), Number(raw[1])]); // Store the coordinate.
    return; // Stop descending.
  }
  for (const item of raw) collectCoordinatePairs(item, out); // Recurse into nested arrays.
} // End helper.

function extractGeoPoints(geo: any): ViewPoint[] { // Flatten supported GeoJSON into plain lon/lat points.
  if (!geo || typeof geo !== "object") return []; // Missing => empty.
  const type = String(geo?.type ?? ""); // GeoJSON discriminator.
  if (type === "Feature") return extractGeoPoints(geo?.geometry); // Unwrap feature.
  if (type === "FeatureCollection") return Array.isArray(geo?.features) ? geo.features.flatMap((f: any) => extractGeoPoints(f)) : []; // Flatten collection.
  const pairs: Array<[number, number]> = []; // Coordinate accumulator.
  if (type === "Point") { // Direct point.
    const coordinates = geo?.coordinates; // Raw coordinates.
    if (Array.isArray(coordinates) && coordinates.length >= 2) pairs.push([Number(coordinates[0]), Number(coordinates[1])]); // Store point.
  } else if (type === "Polygon" || type === "MultiPolygon" || type === "LineString" || type === "MultiLineString") {
    collectCoordinatePairs(geo?.coordinates, pairs); // Flatten path/area coordinates.
  }
  return pairs.filter(([lon, lat]) => Number.isFinite(lon) && Number.isFinite(lat) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180).map(([lon, lat]) => ({ lon, lat })); // Keep valid points only.
} // End helper.

function toBounds(points: ViewPoint[]): Bounds | null { // Calculate tight lon/lat bounds.
  if (!points.length) return null; // Empty => no bounds.
  return { minLon: Math.min(...points.map((p) => p.lon)), maxLon: Math.max(...points.map((p) => p.lon)), minLat: Math.min(...points.map((p) => p.lat)), maxLat: Math.max(...points.map((p) => p.lat)) }; // Tight bounds.
} // End helper.

function expandBounds(bounds: Bounds): Bounds { // Add visual padding around map content.
  const lonSpan = Math.max(0.0005, bounds.maxLon - bounds.minLon); // Minimum width.
  const latSpan = Math.max(0.0005, bounds.maxLat - bounds.minLat); // Minimum height.
  const lonPad = lonSpan * 0.08; // Horizontal padding.
  const latPad = latSpan * 0.08; // Vertical padding.
  return { minLon: bounds.minLon - lonPad, maxLon: bounds.maxLon + lonPad, minLat: bounds.minLat - latPad, maxLat: bounds.maxLat + latPad }; // Expanded bounds.
} // End helper.

function extractPolygonRings(geo: any): Array<Array<[number, number]>> { // Extract polygon rings for SVG paths.
  if (!geo || typeof geo !== "object") return []; // Missing => empty.
  const type = String(geo?.type ?? ""); // GeoJSON discriminator.
  if (type === "Feature") return extractPolygonRings(geo?.geometry); // Unwrap feature.
  if (type === "FeatureCollection") return Array.isArray(geo?.features) ? geo.features.flatMap((f: any) => extractPolygonRings(f)) : []; // Flatten collection.
  if (type === "Polygon") { // Polygon rings.
    return (Array.isArray(geo?.coordinates) ? geo.coordinates : []).flatMap((ring: any) => { // Iterate rings.
      const pairs: Array<[number, number]> = []; // Coordinate accumulator.
      collectCoordinatePairs(ring, pairs); // Flatten the ring.
      return pairs.length ? [pairs] : []; // Keep non-empty rings.
    });
  }
  if (type === "MultiPolygon") return (Array.isArray(geo?.coordinates) ? geo.coordinates : []).flatMap((polygon: any) => extractPolygonRings({ type: "Polygon", coordinates: polygon })); // Reuse polygon handling.
  return []; // Unsupported => empty.
} // End helper.

function normalizeHeatFeatures(geo: any): HeatFeature[] { // Convert heat GeoJSON features into render-friendly data.
  const features = Array.isArray(geo?.features) ? geo.features : []; // Source features.
  return features.map((feature: any) => { // Normalize each feature.
    const coordinates = Array.isArray(feature?.geometry?.coordinates) ? feature.geometry.coordinates : []; // Raw point coordinates.
    const lon = Number(coordinates?.[0]); // Longitude.
    const lat = Number(coordinates?.[1]); // Latitude.
    const weight = Number(feature?.properties?.weight ?? feature?.properties?.intensity ?? 0) || 0; // Heat weight.
    if (!Number.isFinite(lon) || !Number.isFinite(lat) || weight <= 0) return null; // Skip malformed rows.
    return { lon, lat, weight, metric: String(feature?.properties?.metric ?? ""), objectType: String(feature?.properties?.object_type ?? ""), lastRaisedTsMs: Number(feature?.properties?.last_raised_ts_ms ?? 0) || null };
  }).filter(Boolean) as HeatFeature[]; // Drop nulls.
} // End helper.

function heatAlpha(weight: number, maxWeight: number, minAlpha: number, maxAlpha: number): number { // Map weight into opacity.
  if (!(maxWeight > 0)) return minAlpha; // Empty range fallback.
  const ratio = Math.max(0, Math.min(1, weight / maxWeight)); // Clamp ratio.
  return minAlpha + ratio * (maxAlpha - minAlpha); // Linear interpolation.
} // End helper.

function tailCoords(coords: any[], count: number): any[] { // Keep only the last N coordinates for the tail overlay.
  if (!Array.isArray(coords) || coords.length <= count) return Array.isArray(coords) ? coords : []; // No slicing needed.
  return coords.slice(Math.max(0, coords.length - count)); // Last N coordinates.
} // End helper.

export default function FieldGisMap({ polygonGeoJson, trajectoryGeoJson, heatGeoJson, markers }: { polygonGeoJson: any; trajectoryGeoJson: any; heatGeoJson: any; markers: Marker[]; }): React.ReactElement { // Render the GIS map with popup and live tail overlays.
  const [popup, setPopup] = React.useState<PopupState>(null); // Click popup state.
  const polygonPoints = extractGeoPoints(polygonGeoJson); // Polygon bounds input.
  const trajectoryPoints = extractGeoPoints(trajectoryGeoJson); // Trajectory bounds input.
  const heatFeatures = normalizeHeatFeatures(heatGeoJson); // Normalized heat features.
  const heatPoints = heatFeatures.map((point) => ({ lon: point.lon, lat: point.lat })); // Heat bounds input.
  const markerPoints = markers.map((marker) => ({ lon: Number(marker.lon), lat: Number(marker.lat) })).filter((point) => Number.isFinite(point.lon) && Number.isFinite(point.lat)); // Marker bounds input.
  const computedBounds = toBounds([...polygonPoints, ...trajectoryPoints, ...heatPoints, ...markerPoints]); // Tight content bounds.
  const bounds = computedBounds ? expandBounds(computedBounds) : { minLon: 120.9, maxLon: 121.1, minLat: 31.1, maxLat: 31.3 }; // Stable fallback viewport.

  const w = 820; // SVG width.
  const h = 420; // SVG height.
  const pad = 24; // Outer padding.
  const proj = (lon: number, lat: number) => { // Project lon/lat into SVG coordinates.
    const lonSpan = Math.max(0.000001, bounds.maxLon - bounds.minLon); // Avoid zero-width projections.
    const latSpan = Math.max(0.000001, bounds.maxLat - bounds.minLat); // Avoid zero-height projections.
    return { x: pad + ((lon - bounds.minLon) / lonSpan) * (w - pad * 2), y: pad + (1 - (lat - bounds.minLat) / latSpan) * (h - pad * 2) }; // Linear projection.
  }; // End projector.

  const polygonPaths = extractPolygonRings(polygonGeoJson).map((ring) => ring.map((pt, i) => { const p = proj(Number(pt[0]), Number(pt[1])); return `${i === 0 ? "M" : "L"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`; }).join(" ") + " Z").filter(Boolean); // Polygon path strings.
  const maxHeatWeight = heatFeatures.reduce((max, point) => Math.max(max, point.weight), 0); // Maximum heat weight.

  return (
    <div style={{ width: "100%", borderRadius: 12, overflow: "hidden", border: "1px solid #e5e7eb", background: "#f8fafc", position: "relative" }} onClick={() => setPopup(null)}> {/* Map shell. */}
      <svg viewBox={`0 0 ${w} ${h}`} style={{ width: "100%", height: 420, display: "block" }}> {/* Main map viewport. */}
        <defs> {/* Blur for heat halos. */}
          <filter id="geoxHeatBlur"><feGaussianBlur stdDeviation="12" /></filter>
        </defs>
        <rect x="0" y="0" width={w} height={h} fill="#f8fafc" /> {/* Background. */}

        {heatFeatures.map((feature, index) => { // Heat overlay first.
          const p = proj(feature.lon, feature.lat); // Project heat point.
          const ratio = maxHeatWeight > 0 ? feature.weight / maxHeatWeight : 0; // Relative weight.
          const outerRadius = 24 + ratio * 44; // Big outer glow.
          const midRadius = 12 + ratio * 22; // Mid glow.
          const innerRadius = 5 + ratio * 9; // Core radius.
          return (
            <g key={`heat_${index}`} onClick={(evt) => { evt.stopPropagation(); setPopup({ kind: "heat", title: feature.metric || "告警热力", x: p.x, y: p.y, lines: [`对象: ${feature.objectType || "-"}`, `热力权重: ${feature.weight}`, `最近触发: ${fmtTs(feature.lastRaisedTsMs)}`] }); }} style={{ cursor: "pointer" }}> {/* Heat point group. */}
              <circle cx={p.x} cy={p.y} r={outerRadius} fill={`rgba(239,68,68,${heatAlpha(feature.weight, maxHeatWeight, 0.08, 0.28).toFixed(3)})`} filter="url(#geoxHeatBlur)" />
              <circle cx={p.x} cy={p.y} r={midRadius} fill={`rgba(249,115,22,${heatAlpha(feature.weight, maxHeatWeight, 0.12, 0.26).toFixed(3)})`} />
              <circle cx={p.x} cy={p.y} r={innerRadius} fill={`rgba(220,38,38,${heatAlpha(feature.weight, maxHeatWeight, 0.28, 0.58).toFixed(3)})`} stroke="rgba(153,27,27,0.55)" strokeWidth="1" />
            </g>
          );
        })}

        {polygonPaths.map((path, i) => <path key={`poly_${i}`} d={path} fill="rgba(14,165,233,0.10)" stroke="#0284c7" strokeWidth="2" />)} {/* Field polygon. */}

        {(trajectoryGeoJson?.features || []).map((feature: any, index: number) => { // Full trajectory lines.
          const coords = Array.isArray(feature?.geometry?.coordinates) ? feature.geometry.coordinates : []; // All coordinates.
          const d = coords.map((pt: any, idx: number) => { const p = proj(Number(pt?.[0]), Number(pt?.[1])); return `${idx === 0 ? "M" : "L"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`; }).join(" "); // Main path.
          const tail = tailCoords(coords, 8); // Last 8 points as tail.
          const tailD = tail.map((pt: any, idx: number) => { const p = proj(Number(pt?.[0]), Number(pt?.[1])); return `${idx === 0 ? "M" : "L"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`; }).join(" "); // Tail path.
          return (
            <g key={`traj_${index}`}> {/* Trajectory group. */}
              {d ? <path d={d} fill="none" stroke="#2563eb" strokeWidth="2.5" opacity="0.55" /> : null} {/* History line. */}
              {tailD ? <path d={tailD} fill="none" stroke="#1d4ed8" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" opacity="0.95" /> : null} {/* Highlighted recent tail. */}
              {tail.slice(-5).map((pt: any, dotIndex: number) => { const p = proj(Number(pt?.[0]), Number(pt?.[1])); return <circle key={`tail_dot_${index}_${dotIndex}`} cx={p.x} cy={p.y} r={2.2 + dotIndex * 0.35} fill="#1d4ed8" opacity={0.35 + dotIndex * 0.12} />; })} {/* Tail breadcrumb dots. */}
            </g>
          );
        })}

        {markers.map((marker) => { // Device markers last so they stay crisp.
          const p = proj(Number(marker.lon), Number(marker.lat)); // Project marker.
          return (
            <g key={`${marker.device_id}_${marker.ts_ms || 0}`} onClick={(evt) => { evt.stopPropagation(); setPopup({ kind: "marker", title: marker.device_id, x: p.x, y: p.y, lines: [`定位时间: ${fmtTs(marker.ts_ms ?? null)}`, `坐标: ${Number(marker.lat).toFixed(5)}, ${Number(marker.lon).toFixed(5)}`] }); }} style={{ cursor: "pointer" }}> {/* Marker group. */}
              <circle cx={p.x} cy={p.y} r="5.5" fill="#16a34a" stroke="#14532d" strokeWidth="1" />
              <text x={p.x + 8} y={p.y - 8} fontSize="11" fill="#14532d">{marker.device_id}</text>
            </g>
          );
        })}

        <g transform={`translate(${w - 188}, 16)`}> {/* Map legend. */}
          <rect x="0" y="0" width="172" height="86" rx="10" fill="rgba(255,255,255,0.92)" stroke="#e5e7eb" />
          <text x="12" y="20" fontSize="12" fill="#111827">图层</text>
          <text x="12" y="38" fontSize="11" fill="#0284c7">地块边界</text>
          <text x="70" y="38" fontSize="11" fill="#2563eb">轨迹</text>
          <text x="112" y="38" fontSize="11" fill="#16a34a">设备</text>
          <text x="12" y="58" fontSize="11" fill="#dc2626">告警热力</text>
          <text x="12" y="72" fontSize="10" fill="#6b7280">点击设备或热力点查看详情</text>
        </g>
      </svg>

      {popup && ( // Lightweight map popup.
        <div style={{ position: "absolute", left: Math.min(Math.max(12, popup.x + 16), w - 220), top: Math.min(Math.max(12, popup.y + 16), h - 120), width: 204, background: "rgba(255,255,255,0.96)", border: "1px solid #e5e7eb", borderRadius: 10, boxShadow: "0 10px 30px rgba(15,23,42,0.12)", padding: 10, pointerEvents: "none" }}> {/* Popup card. */}
          <div style={{ fontSize: 12, fontWeight: 700, color: popup.kind === "heat" ? "#b91c1c" : "#14532d", marginBottom: 6 }}>{popup.title}</div>
          {popup.lines.map((line, index) => <div key={index} style={{ fontSize: 11, color: "#374151", lineHeight: 1.5 }}>{line}</div>)}
        </div>
      )}
    </div>
  ); // End render.
} // End component.
