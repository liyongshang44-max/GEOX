// GEOX/apps/web/src/lib/field_live.ts
//
// Stage 1 GIS live telemetry + replay helpers.

import type { FieldTrajectoryReplayDevice, FieldTrajectoryReplayPoint, FieldTrajectorySeriesResponse } from "./api"; // Reuse API response types for replay state.

export type FieldLiveGeoPoint = { // Shared normalized geo point for live and replay flows.
  lat: number; // Latitude.
  lon: number; // Longitude.
};

export type FieldLiveEventV1 = { // Stage 1 wire event pushed by the server WebSocket channel.
  type: "device_geo_update_v1"; // Event discriminator.
  field_id: string; // Field id.
  device_id: string; // Device id.
  ts_ms: number; // Point timestamp.
  geo: FieldLiveGeoPoint; // Device location.
  metric?: string | null; // Optional metric label.
  value?: string | null; // Optional status/value label.
};

export type FieldLiveMarker = { // Map marker state used by FieldGisMap.
  device_id: string; // Device id.
  lat: number; // Latitude.
  lon: number; // Longitude.
  ts_ms: number | null; // Last point timestamp.
};

export type FieldReplayState = { // Replay controller state kept in the page component.
  status: "idle" | "loading" | "ready" | "error"; // Replay data loading state.
  devices: FieldTrajectoryReplayDevice[]; // Ordered replay points grouped by device.
  from_ts_ms: number | null; // Active replay lower bound.
  to_ts_ms: number | null; // Active replay upper bound.
  current_ts_ms: number | null; // Current playback cursor.
  playing: boolean; // Whether the local timer is advancing.
  speed: number; // Playback speed multiplier.
  selected_device_id: string; // Empty string means all devices.
  error_text: string; // Latest replay loading error.
};

function normalizePoint(raw: any): FieldTrajectoryReplayPoint | null { // Accept both replay API points and live event payloads.
  const ts_ms = Number(raw?.ts_ms ?? 0); // Normalize timestamp.
  const lat = Number(raw?.lat ?? raw?.geo?.lat ?? 0); // Normalize latitude.
  const lon = Number(raw?.lon ?? raw?.geo?.lon ?? 0); // Normalize longitude.
  if (!Number.isFinite(ts_ms) || ts_ms <= 0) return null; // Require a valid timestamp.
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null; // Require numeric coordinates.
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null; // Reject invalid coordinates.
  return { ts_ms, lat, lon }; // Return the normalized point.
} // End helper.

function uniqueSortedPoints(points: FieldTrajectoryReplayPoint[]): FieldTrajectoryReplayPoint[] { // Keep replay points deterministic and free of exact duplicates.
  const sorted = points.slice().sort((a, b) => a.ts_ms - b.ts_ms || a.lat - b.lat || a.lon - b.lon); // Stable timestamp-first order.
  const out: FieldTrajectoryReplayPoint[] = []; // Deduplicated result.
  for (const point of sorted) { // Scan in sorted order.
    const prev = out.length > 0 ? out[out.length - 1] : null; // Compare against the last emitted point only.
    if (prev && prev.ts_ms === point.ts_ms && prev.lat === point.lat && prev.lon === point.lon) continue; // Skip exact duplicates.
    out.push(point); // Keep unique points.
  }
  return out; // Return the cleaned series.
} // End helper.

export function buildFieldLiveUrl(fieldId: string, token: string): string { // Build the browser WebSocket URL for one field live channel.
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:"; // Match the current origin security context.
  const host = window.location.host; // Reuse the current host/port.
  return `${protocol}//${host}/ws/fields/${encodeURIComponent(fieldId)}/live?token=${encodeURIComponent(token)}`; // Final live URL.
} // End helper.

export function createInitialReplayState(): FieldReplayState { // Create the default replay controller state.
  return { status: "idle", devices: [], from_ts_ms: null, to_ts_ms: null, current_ts_ms: null, playing: false, speed: 1, selected_device_id: "", error_text: "" }; // Default idle replay state.
} // End helper.

export function trajectorySeriesToReplayState(series: FieldTrajectorySeriesResponse, prev?: FieldReplayState | null): FieldReplayState { // Convert the API response into a normalized replay state.
  const devices = (Array.isArray(series?.devices) ? series.devices : []).map((device) => ({ // Normalize every device payload.
    device_id: String(device?.device_id ?? ""),
    points: uniqueSortedPoints((Array.isArray(device?.points) ? device.points : []).map((point) => normalizePoint(point)).filter(Boolean) as FieldTrajectoryReplayPoint[]),
    point_count: Number(device?.point_count ?? (Array.isArray(device?.points) ? device.points.length : 0)),
    trajectory_geojson: device?.trajectory_geojson ?? null,
  })).filter((device) => !!device.device_id); // Remove malformed devices.
  const selected_device_id = prev?.selected_device_id && devices.some((device) => device.device_id === prev.selected_device_id) ? prev.selected_device_id : ""; // Preserve selected device only when still present.
  return { // Final replay controller state.
    status: "ready",
    devices,
    from_ts_ms: Number(series?.from_ts_ms ?? 0) || null,
    to_ts_ms: Number(series?.to_ts_ms ?? 0) || null,
    current_ts_ms: Number(series?.from_ts_ms ?? 0) || null,
    playing: false,
    speed: prev?.speed && Number.isFinite(prev.speed) ? prev.speed : 1,
    selected_device_id,
    error_text: "",
  };
} // End helper.

export function applyLiveEventToReplayState(prev: FieldReplayState, event: FieldLiveEventV1): FieldReplayState { // Append new live points so replay can include fresh telemetry after a reload window refresh.
  const nextPoint = normalizePoint({ ts_ms: event.ts_ms, lat: event.geo.lat, lon: event.geo.lon }); // Normalize the pushed point.
  if (!nextPoint) return prev; // Ignore malformed live events.
  let found = false; // Track whether the device already exists in replay state.
  const devices = prev.devices.map((device) => { // Update the matching device if it already exists.
    if (device.device_id !== event.device_id) return device; // Unrelated device => unchanged.
    found = true; // Device exists.
    return { ...device, points: uniqueSortedPoints([...device.points, nextPoint]), point_count: (device.point_count ?? device.points.length) + 1 }; // Append the new point.
  });
  if (!found) devices.push({ device_id: event.device_id, points: [nextPoint], point_count: 1, trajectory_geojson: null }); // Add a new device stream on first sighting.
  const to_ts_ms = Math.max(prev.to_ts_ms ?? 0, nextPoint.ts_ms); // Extend the replay upper bound when new live data arrives.
  return { ...prev, devices, to_ts_ms, current_ts_ms: prev.playing ? prev.current_ts_ms : prev.current_ts_ms ?? nextPoint.ts_ms }; // Preserve current cursor unless it was still empty.
} // End helper.

export function applyLiveEventToMarkers(prev: FieldLiveMarker[], event: FieldLiveEventV1): FieldLiveMarker[] { // Update or insert the latest marker for one device.
  const point = normalizePoint({ ts_ms: event.ts_ms, lat: event.geo.lat, lon: event.geo.lon }); // Normalize the live event into a point.
  if (!point) return prev; // Ignore malformed live payloads.
  let replaced = false; // Track whether the device marker already existed.
  const next = prev.map((marker) => { // Replace the matching marker only when the new point is newer.
    if (marker.device_id !== event.device_id) return marker; // Other markers remain unchanged.
    replaced = true; // Marker exists.
    const prevTs = Number(marker.ts_ms ?? 0); // Previous timestamp.
    if (prevTs > point.ts_ms) return marker; // Do not move markers backwards in time.
    return { device_id: event.device_id, lat: point.lat, lon: point.lon, ts_ms: point.ts_ms }; // New latest marker.
  });
  if (!replaced) next.push({ device_id: event.device_id, lat: point.lat, lon: point.lon, ts_ms: point.ts_ms }); // Insert a brand-new marker when the device appears for the first time.
  return next; // Return the updated marker array.
} // End helper.

export function buildVisibleReplayDevices(replay: FieldReplayState): FieldTrajectoryReplayDevice[] { // Slice each device trajectory at the current playback cursor.
  const current_ts_ms = replay.current_ts_ms; // Local alias for readability.
  if (current_ts_ms == null) return []; // No cursor => nothing visible yet.
  const selected = replay.selected_device_id.trim(); // Optional device filter.
  return replay.devices.flatMap((device) => { // Build the visible subset for each device.
    if (selected && device.device_id !== selected) return []; // Apply the device filter first.
    const points = device.points.filter((point) => point.ts_ms <= current_ts_ms); // Keep points up to the playback cursor.
    if (!points.length) return []; // Hidden until the first point enters the cursor window.
    return [{ ...device, points }]; // Return the truncated visible series.
  });
} // End helper.


export function applyLiveEventToTrajectoryGeoJson(prev: any, event: FieldLiveEventV1): any { // Append one live point to the existing per-device trajectory GeoJSON.
  const point = normalizePoint({ ts_ms: event.ts_ms, lat: event.geo.lat, lon: event.geo.lon }); // Normalize the pushed point first.
  if (!point) return prev; // Ignore malformed events.
  const source = prev && typeof prev === "object" && Array.isArray(prev.features) ? prev : { type: "FeatureCollection", features: [] as any[] }; // Guarantee a FeatureCollection shape.
  let found = false; // Track whether the target device feature already exists.
  const features = source.features.map((feature: any) => { // Update the matching device feature only.
    const device_id = String(feature?.properties?.device_id ?? ""); // Read the current device id.
    if (device_id !== event.device_id) return feature; // Unrelated features remain unchanged.
    found = true; // Device feature exists.
    const coords = Array.isArray(feature?.geometry?.coordinates) ? feature.geometry.coordinates.slice() : []; // Copy existing coordinates defensively.
    const prevCoord = coords.length > 0 ? coords[coords.length - 1] : null; // Last drawn coordinate.
    if (!prevCoord || Number(prevCoord[0]) !== point.lon || Number(prevCoord[1]) !== point.lat) coords.push([point.lon, point.lat]); // Append only when the point is not an exact duplicate.
    return { // Updated feature.
      ...feature,
      properties: { ...(feature?.properties ?? {}), device_id: event.device_id, point_count: coords.length, last_ts_ms: point.ts_ms },
      geometry: { type: "LineString", coordinates: coords },
    };
  });
  if (!found) { // First live point for a device => create a brand-new trajectory feature.
    features.push({
      type: "Feature",
      properties: { device_id: event.device_id, point_count: 1, last_ts_ms: point.ts_ms },
      geometry: { type: "LineString", coordinates: [[point.lon, point.lat]] },
    });
  }
  return { type: "FeatureCollection", features }; // Return the next trajectory GeoJSON.
} // End helper.
export function buildReplayTrajectoryGeoJson(devices: FieldTrajectoryReplayDevice[]): any { // Convert visible replay devices into the existing FieldGisMap trajectory GeoJSON shape.
  return { // Stable FeatureCollection wrapper.
    type: "FeatureCollection",
    features: devices.filter((device) => device.points.length > 1).map((device) => ({ // Only draw a line when at least two points are visible.
      type: "Feature",
      properties: { device_id: device.device_id, point_count: device.points.length },
      geometry: { type: "LineString", coordinates: device.points.map((point) => [point.lon, point.lat]) },
    })),
  };
} // End helper.

export function buildReplayMarkers(devices: FieldTrajectoryReplayDevice[]): FieldLiveMarker[] { // Convert visible replay devices into current-position markers.
  return devices.map((device) => { // Use the last visible point as the replay marker.
    const point = device.points[device.points.length - 1]; // Safe because callers only pass non-empty device point arrays.
    return { device_id: device.device_id, lat: point.lat, lon: point.lon, ts_ms: point.ts_ms }; // Replay marker payload.
  });
} // End helper.

export function getReplayTimelineBounds(replay: FieldReplayState): { min: number; max: number } | null { // Derive slider bounds from the replay payload.
  if (replay.from_ts_ms == null || replay.to_ts_ms == null) return null; // Require both ends.
  return { min: replay.from_ts_ms, max: Math.max(replay.from_ts_ms, replay.to_ts_ms) }; // Clamp max >= min.
} // End helper.
