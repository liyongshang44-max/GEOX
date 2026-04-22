import { apiRequestOptional, withQuery } from "../api/client";
import { getDeviceSimulatorStatus, listDeviceSimulatorStatuses, type DeviceSimulatorStatus } from "../api/deviceSimulator";
import { listSkillBindings, listSkillRegistry, resolveSkillClassification, type SkillBindingItem, type SkillRegistryItem } from "../api/skills";

type DeviceRecord = Record<string, unknown>;

export type DashboardSensingRuntimeVm = {
  activeSensingDeviceSkillCount: number;
  simulatorCarrierSkillCount: number;
  physicalCarrierSkillCount: number;
  latestTelemetryTsMs: number | null;
  hasFormalSensingInput: boolean;
  effectiveSensingSkillsLabel: string;
  simulatorBackedSkillsLabel: string;
  physicalBackedSkillsLabel: string;
  latestSensingTimeLabel: string;
  formalSensingInputLabel: string;
  sourceSummaryLabel: string;
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
  const normalized = normalizeText(value)
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .toLowerCase()
    .replace(/[\s.-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
  if (normalized === "airtemperature" || normalized === "air_temp") return "air_temperature";
  if (normalized === "airhumidity" || normalized === "air_hum") return "air_humidity";
  if (normalized === "soilmoisture" || normalized === "soil_moist") return "soil_moisture";
  return normalized;
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

function formatSensingTime(value: number | null): string {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("zh-CN", { hour12: false });
}

async function fetchDevices(): Promise<DeviceRecord[]> {
  const res = await apiRequestOptional<unknown>(withQuery("/api/v1/devices", { limit: 500 }), undefined, {
    timeoutMs: 5000,
    dedupe: true,
    silent: true,
  });
  return normalizeList<DeviceRecord>(res);
}

async function fetchSimulatorStatusMap(deviceIds: string[]): Promise<Map<string, DeviceSimulatorStatus>> {
  const map = new Map<string, DeviceSimulatorStatus>();
  const targetIds = Array.from(new Set(deviceIds.map((id) => normalizeText(id)).filter(Boolean)));
  try {
    const res = await listDeviceSimulatorStatuses(500);
    const items = normalizeList<Record<string, unknown>>(res);
    const targetSet = new Set(targetIds);
    for (const item of items) {
      const deviceId = normalizeText(item.device_id ?? item.id);
      if (!deviceId) continue;
      if (targetSet.size > 0 && !targetSet.has(deviceId)) continue;
      map.set(deviceId, item as DeviceSimulatorStatus);
    }
    return map;
  } catch {
    // compatibility fallback: only used when aggregate endpoint request fails.
    await Promise.all(targetIds.map(async (deviceId) => {
      try {
        const status = await getDeviceSimulatorStatus(deviceId);
        map.set(deviceId, status);
      } catch {
        // optional per-device status fallback
      }
    }));
  }
  return map;
}

export async function buildDashboardSensingRuntimeVm(): Promise<DashboardSensingRuntimeVm> {
  const [skillsResult, bindingsResult, devicesResult] = await Promise.allSettled([
    listSkillRegistry({ limit: 300 }),
    listSkillBindings({ limit: 500 }),
    fetchDevices(),
  ]);

  const skills = skillsResult.status === "fulfilled" ? skillsResult.value : [];
  const rawBindings = bindingsResult.status === "fulfilled" ? bindingsResult.value : [];
  const devices = devicesResult.status === "fulfilled" ? devicesResult.value : [];

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
    if (!deviceId) return false;
    const simStatus = simulatorStatusMap.get(deviceId) ?? null;
    if (inferIsSimulator(device ?? {}, simStatus)) return false;
    const telemetry = asRecord(device.telemetry);
    return toTs(
      device.last_telemetry_ts_ms
      ?? device.lastTelemetryTsMs
      ?? telemetry?.last_ts_ms
      ?? telemetry?.lastTelemetryTsMs,
    ) != null;
  });
  const hasSimulatorFormalInput = devices.some((device) => {
    const deviceId = normalizeText(device.device_id ?? device.id);
    if (!deviceId) return false;
    const simStatus = simulatorStatusMap.get(deviceId) ?? null;
    if (!inferIsSimulator(device ?? {}, simStatus)) return false;
    if (simStatus?.running !== true) return false;
    return hasMinimalSensingProfile(device ?? {}, simStatus);
  });
  const hasFormalSensingInput = hasPhysicalTelemetry || hasSimulatorFormalInput;
  const sourceSummaryLabel = (() => {
    if (simulatorSkillIds.size > 0 && physicalSkillIds.size > 0) return "当前真实设备与模拟承载同时提供输入";
    if (simulatorSkillIds.size > 0) return "当前主要由模拟承载提供感知输入";
    if (physicalSkillIds.size > 0) return "当前主要由真实设备提供感知输入";
    return "当前尚未识别稳定感知来源";
  })();

  return {
    activeSensingDeviceSkillCount: activeSensingOrDeviceSkills.size,
    simulatorCarrierSkillCount: simulatorSkillIds.size,
    physicalCarrierSkillCount: physicalSkillIds.size,
    latestTelemetryTsMs,
    hasFormalSensingInput,
    effectiveSensingSkillsLabel: String(activeSensingOrDeviceSkills.size),
    simulatorBackedSkillsLabel: String(simulatorSkillIds.size),
    physicalBackedSkillsLabel: String(physicalSkillIds.size),
    latestSensingTimeLabel: formatSensingTime(latestTelemetryTsMs),
    formalSensingInputLabel: hasFormalSensingInput ? "是" : "否",
    sourceSummaryLabel,
  };
}
