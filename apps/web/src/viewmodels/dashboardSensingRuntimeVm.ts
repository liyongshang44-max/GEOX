import { apiRequestOptional, withQuery } from "../api/client";
import { getDeviceSimulatorStatus, type DeviceSimulatorStatus } from "../api/deviceSimulator";
import { listSkillBindings, listSkillRegistry, resolveSkillClassification, type SkillBindingItem, type SkillRegistryItem } from "../api/skills";

type DeviceRecord = Record<string, unknown>;

type DeviceFieldBindingRecord = {
  device_id?: string | null;
  field_id?: string | null;
};

export type DashboardSensingRuntimeVm = {
  activeSensingDeviceSkillCount: number;
  simulatorCarrierSkillCount: number;
  physicalCarrierSkillCount: number;
  latestTelemetryTsMs: number | null;
  hasFormalSensingInput: boolean;
};
const REQUIRED_SENSING_PROFILE_KEYS = ["air_temperature", "air_humidity", "soil_moisture"] as const;

function normalizeList<T>(res: unknown): T[] {
  const obj = asRecord(res);
  if (Array.isArray(res)) return res as T[];
  if (Array.isArray(obj?.items)) return obj.items as T[];
  if (Array.isArray(obj?.data)) return obj.data as T[];
  if (Array.isArray(obj?.devices)) return obj.devices as T[];
  return [];
}

function normalizeText(value: unknown): string {
  return String(value ?? "").trim();
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value != null && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function toTs(input: unknown): number | null {
  const n = Number(input ?? NaN);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function isActiveStatus(status: unknown): boolean {
  return normalizeText(status).toUpperCase() === "ACTIVE";
}

function isSensingOrDeviceSkill(item: SkillRegistryItem): boolean {
  const classification = resolveSkillClassification(item);
  return classification === "sensing" || classification === "device";
}

function inferIsSimulator(device: DeviceRecord, simulatorStatus: DeviceSimulatorStatus | null): boolean {
  const deviceObj = asRecord(device);
  const modeText = [
    deviceObj?.device_mode,
    deviceObj?.source_type,
    deviceObj?.carrier,
    deviceObj?.template_code,
    deviceObj?.device_template,
    deviceObj?.device_type,
    deviceObj?.name,
    deviceObj?.display_name,
  ].map((v) => normalizeText(v).toLowerCase()).join(" ");
  if (modeText.includes("simulator") || modeText.includes("sim") || modeText.includes("virtual")) return true;
  if (simulatorStatus?.running === true) return true;
  return false;
}

function normalizeMetricKey(value: unknown): string {
  return normalizeText(value).toLowerCase().replace(/[\s.-]+/g, "_");
}

function collectMetricKeys(source: unknown, output: Set<string>, depth = 0): void {
  if (source == null || depth > 4) return;
  if (Array.isArray(source)) {
    for (const item of source) collectMetricKeys(item, output, depth + 1);
    return;
  }
  if (typeof source !== "object") return;
  const obj = source as Record<string, unknown>;
  for (const [rawKey, rawValue] of Object.entries(obj)) {
    const key = normalizeMetricKey(rawKey);
    if (REQUIRED_SENSING_PROFILE_KEYS.includes(key as (typeof REQUIRED_SENSING_PROFILE_KEYS)[number])) {
      output.add(key);
    }
    if (rawValue && typeof rawValue === "object") {
      collectMetricKeys(rawValue, output, depth + 1);
      continue;
    }
    const metricName = normalizeMetricKey(rawValue);
    if (REQUIRED_SENSING_PROFILE_KEYS.includes(metricName as (typeof REQUIRED_SENSING_PROFILE_KEYS)[number])) {
      output.add(metricName);
    }
  }
  const candidateMetricName = normalizeMetricKey(
    obj.metric ?? obj.metric_key ?? obj.name ?? obj.key,
  );
  if (REQUIRED_SENSING_PROFILE_KEYS.includes(candidateMetricName as (typeof REQUIRED_SENSING_PROFILE_KEYS)[number])) {
    output.add(candidateMetricName);
  }
}

function hasMinimalSensingProfile(device: DeviceRecord, simulatorStatus: DeviceSimulatorStatus | null): boolean {
  const found = new Set<string>();
  collectMetricKeys(device, found);
  collectMetricKeys(simulatorStatus, found);
  return REQUIRED_SENSING_PROFILE_KEYS.every((key) => found.has(key));
}

async function fetchDevices(): Promise<DeviceRecord[]> {
  const res = await apiRequestOptional<unknown>(withQuery("/api/v1/devices", { limit: 500 }), undefined, {
    timeoutMs: 5000,
    dedupe: true,
    silent: true,
  });
  return normalizeList<DeviceRecord>(res);
}

async function fetchDeviceFieldBindings(): Promise<DeviceFieldBindingRecord[]> {
  const candidates = [
    "/api/v1/devices/field-bindings",
    "/api/v1/devices/bindings/fields",
    "/api/v1/fields/device-bindings",
  ];
  for (const path of candidates) {
    try {
      const res = await apiRequestOptional<unknown>(path, undefined, { timeoutMs: 5000, dedupe: true, silent: true });
      const list = normalizeList<DeviceFieldBindingRecord>(res);
      if (list.length > 0) return list;
    } catch {
      // try next candidate endpoint
    }
  }
  return [];
}

async function fetchSimulatorStatusMap(deviceIds: string[]): Promise<Map<string, DeviceSimulatorStatus>> {
  const map = new Map<string, DeviceSimulatorStatus>();
  const candidates = [
    "/api/v1/devices/simulator/statuses",
    "/api/v1/devices/simulator/status",
  ];

  for (const path of candidates) {
    try {
      const res = await apiRequestOptional<unknown>(withQuery(path, { limit: 500 }), undefined, { timeoutMs: 5000, dedupe: true, silent: true });
      const items = normalizeList<Record<string, unknown>>(res);
      if (items.length) {
        for (const item of items) {
          const deviceId = normalizeText(item.device_id ?? item.id);
          if (deviceId) map.set(deviceId, item as DeviceSimulatorStatus);
        }
        return map;
      }
    } catch {
      // fallback below
    }
  }

  await Promise.all(deviceIds.map(async (deviceId) => {
    try {
      const status = await getDeviceSimulatorStatus(deviceId);
      map.set(deviceId, status);
    } catch {
      // optional per-device status
    }
  }));
  return map;
}

export async function buildDashboardSensingRuntimeVm(): Promise<DashboardSensingRuntimeVm> {
  const [skillsResult, bindingsResult, devicesResult, bindingsByFieldResult] = await Promise.allSettled([
    listSkillRegistry({ limit: 300 }),
    listSkillBindings({ limit: 500 }),
    fetchDevices(),
    fetchDeviceFieldBindings(),
  ]);

  const skills = skillsResult.status === "fulfilled" ? skillsResult.value : [];
  const rawBindings = bindingsResult.status === "fulfilled" ? bindingsResult.value : [];
  const devices = devicesResult.status === "fulfilled" ? devicesResult.value : [];
  const deviceFieldBindings = bindingsByFieldResult.status === "fulfilled" ? bindingsByFieldResult.value : [];

  const activeSensingOrDeviceSkills = new Set(
    skills
      .filter((item) => isActiveStatus(item.status) && isSensingOrDeviceSkill(item))
      .map((item) => normalizeText(item.skill_id))
      .filter(Boolean),
  );

  const filteredBindings = rawBindings.filter((binding: SkillBindingItem) => {
    if (!isActiveStatus(binding.status)) return false;
    const skillId = normalizeText(binding.skill_id);
    return activeSensingOrDeviceSkills.has(skillId);
  });

  const deviceById = new Map<string, DeviceRecord>();
  for (const item of devices) {
    const id = normalizeText(item.device_id ?? item.id);
    if (id) deviceById.set(id, item);
  }

  const simulatorStatusMap = await fetchSimulatorStatusMap(Array.from(deviceById.keys()));

  const simulatorSkillIds = new Set<string>();
  const physicalSkillIds = new Set<string>();

  for (const binding of filteredBindings) {
    const scope = normalizeText(binding.scope).toUpperCase();
    if (scope !== "DEVICE") continue;
    const skillId = normalizeText(binding.skill_id);
    if (!skillId) continue;
    const targetId = normalizeText(binding.target_id);
    if (!targetId) continue;
    const device = deviceById.get(targetId) ?? null;
    const simStatus = simulatorStatusMap.get(targetId) ?? null;
    if (inferIsSimulator(device ?? {}, simStatus)) simulatorSkillIds.add(skillId);
    else physicalSkillIds.add(skillId);
  }

  const fieldBoundDeviceIds = new Set<string>();
  for (const binding of deviceFieldBindings) {
    const deviceId = normalizeText(binding.device_id);
    const fieldId = normalizeText(binding.field_id);
    if (deviceId && fieldId) fieldBoundDeviceIds.add(deviceId);
  }
  for (const device of devices) {
    const deviceId = normalizeText(device.device_id ?? device.id);
    const fieldId = normalizeText(device.field_id);
    if (deviceId && fieldId) fieldBoundDeviceIds.add(deviceId);
  }

  const telemetryCandidates: number[] = [];
  for (const device of devices) {
    const deviceId = normalizeText(device.device_id ?? device.id);
    const telemetry = asRecord(device.telemetry);
    const simStatus = simulatorStatusMap.get(deviceId) ?? null;
    const telemetryTs = toTs(
      device.last_telemetry_ts_ms
      ?? device.lastTelemetryTsMs
      ?? telemetry?.last_ts_ms
      ?? telemetry?.lastTelemetryTsMs,
    );
    const simTickTs = toTs(simStatus?.last_tick_ts_ms);
    if (telemetryTs != null) telemetryCandidates.push(telemetryTs);
    if (simTickTs != null) telemetryCandidates.push(simTickTs);
  }
  const latestTelemetryTsMs = telemetryCandidates.length ? Math.max(...telemetryCandidates) : null;

  const hasPhysicalTelemetry = devices.some((device) => {
    const deviceId = normalizeText(device.device_id ?? device.id);
    if (!deviceId || !fieldBoundDeviceIds.has(deviceId)) return false;
    const simStatus = simulatorStatusMap.get(deviceId) ?? null;
    if (inferIsSimulator(device ?? {}, simStatus)) return false;
    return toTs(device.last_telemetry_ts_ms ?? device.lastTelemetryTsMs) != null;
  });
  const hasSimulatorFormalInput = devices.some((device) => {
    const deviceId = normalizeText(device.device_id ?? device.id);
    if (!deviceId || !fieldBoundDeviceIds.has(deviceId)) return false;
    const simStatus = simulatorStatusMap.get(deviceId) ?? null;
    if (!inferIsSimulator(device ?? {}, simStatus)) return false;
    if (simStatus?.running !== true) return false;
    return hasMinimalSensingProfile(device ?? {}, simStatus);
  });

  return {
    activeSensingDeviceSkillCount: activeSensingOrDeviceSkills.size,
    simulatorCarrierSkillCount: simulatorSkillIds.size,
    physicalCarrierSkillCount: physicalSkillIds.size,
    latestTelemetryTsMs,
    hasFormalSensingInput: hasPhysicalTelemetry || hasSimulatorFormalInput,
  };
}
