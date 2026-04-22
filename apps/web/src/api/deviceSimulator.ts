import { apiRequest } from "./client";

export type DeviceSimulatorStatus = {
  ok?: boolean;
  tenant_id?: string;
  device_id?: string;
  key?: string;
  running?: boolean;
  already_running?: boolean;
  stopped?: boolean;
  started_ts_ms?: number | null;
  stopped_ts_ms?: number | null;
  interval_ms?: number | null;
  last_tick_ts_ms?: number | null;
  status?: string | null;
  last_error?: string | null;
  seq?: number;
  reason?: string;
};

export type DeviceSimulatorStatusListResponse = {
  ok?: boolean;
  items?: DeviceSimulatorStatus[];
};

function toOptionalInterval(value: number | undefined): number | undefined {
  if (value == null) return undefined;
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return Math.floor(n);
}

export async function startDeviceSimulator(deviceId: string, intervalMs?: number): Promise<DeviceSimulatorStatus> {
  const trimmedId = String(deviceId ?? "").trim();
  return apiRequest<DeviceSimulatorStatus>(`/api/v1/devices/${encodeURIComponent(trimmedId)}/simulator/start`, {
    method: "POST",
    body: JSON.stringify({ interval_ms: toOptionalInterval(intervalMs) }),
  });
}

export async function stopDeviceSimulator(deviceId: string): Promise<DeviceSimulatorStatus> {
  const trimmedId = String(deviceId ?? "").trim();
  return apiRequest<DeviceSimulatorStatus>(`/api/v1/devices/${encodeURIComponent(trimmedId)}/simulator/stop`, {
    method: "POST",
  });
}

export async function getDeviceSimulatorStatus(deviceId: string): Promise<DeviceSimulatorStatus> {
  const trimmedId = String(deviceId ?? "").trim();
  return apiRequest<DeviceSimulatorStatus>(`/api/v1/devices/${encodeURIComponent(trimmedId)}/simulator/status`);
}

export async function listDeviceSimulatorStatuses(limit = 500): Promise<DeviceSimulatorStatusListResponse> {
  const normalizedLimit = Math.max(1, Math.min(Math.floor(Number(limit) || 500), 500));
  return apiRequest<DeviceSimulatorStatusListResponse>(`/api/v1/devices/simulator/statuses?limit=${normalizedLimit}`);
}
