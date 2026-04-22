import { listSkillBindings, listSkillRegistry, resolveSkillClassification } from "../api/skills";
import {
  fetchDeviceDetail,
  fetchDeviceStatusOptional,
  fetchSimulatorRunnerStatus,
  type SimulatorRunnerStatusResponseV1,
} from "../lib/api";
import { extractBootstrapContext } from "../lib/bootstrapContext";

export type CarrierSourceType = "simulator" | "physical";

export type SkillCarrierVm = {
  carrier: {
    deviceId: string;
    displayName: string;
    sourceType: CarrierSourceType;
    deviceType: string;
    fieldId: string;
    deviceMode: string;
    simulatorStarted: boolean | null;
    simulatorStatus: string;
    skillRelatedNote: string;
  };
  skill: {
    total: number;
    categories: string[];
    bindingTargets: string[];
  };
  telemetry: {
    lastTelemetryAt: number | null;
    lastHeartbeatAt: number | null;
    status: string;
  };
  simulator: {
    checked: boolean;
    running: boolean | null;
    status: SimulatorRunnerStatusResponseV1 | null;
  };
  presentation: {
    carrierModeLabel: string;
    simulatorStatusLabel: string;
    carrierSummary: string;
    latestInputLabel: string;
    latestHeartbeatLabel: string;
    simulatorControlSummary: string;
  };
};

function toText(value: unknown, fallback = "-"): string {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function toTs(value: unknown): number | null {
  const n = Number(value ?? NaN);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function uniqueText(values: unknown[]): string[] {
  const seen = new Set<string>();
  for (const value of values) {
    const text = String(value ?? "").trim();
    if (text) seen.add(text);
  }
  return Array.from(seen.values());
}

function formatTimeLabel(ts: number | null): string {
  if (!ts) return "-";
  return new Date(ts).toLocaleString("zh-CN", { hour12: false });
}

function mapStatusLabel(input: unknown): string {
  const text = String(input ?? "").trim().toLowerCase();
  if (!text) return "未启动";
  if (text.includes("error") || text.includes("fail") || text.includes("异常")) return "异常";
  if (text.includes("running") || text.includes("start") || text.includes("在线") || text.includes("active")) return "运行中";
  if (text.includes("stop") || text.includes("idle") || text.includes("离线") || text.includes("inactive")) return "已停止";
  return "未启动";
}

export async function buildSkillCarrierVm(input: {
  token: string;
  deviceId: string;
  sourceType: CarrierSourceType;
}): Promise<SkillCarrierVm> {
  const deviceId = String(input.deviceId ?? "").trim();
  const [skillsResult, bindingsResult, detailResult, statusResult, simulatorResult] = await Promise.allSettled([
    listSkillRegistry({ limit: 200 }),
    listSkillBindings({ limit: 200 }),
    fetchDeviceDetail(input.token, deviceId),
    fetchDeviceStatusOptional(input.token, deviceId),
    input.sourceType === "simulator"
      ? fetchSimulatorRunnerStatus(input.token, deviceId)
      : Promise.resolve(null),
  ]);

  const skills = skillsResult.status === "fulfilled" ? skillsResult.value : [];
  const bindings = bindingsResult.status === "fulfilled" ? bindingsResult.value : [];
  const detailRaw = detailResult.status === "fulfilled" ? detailResult.value : null;
  const statusRaw = statusResult.status === "fulfilled" ? statusResult.value : null;
  const simulatorRaw = simulatorResult.status === "fulfilled" ? simulatorResult.value : null;

  const device = (detailRaw as any)?.device ?? detailRaw ?? {};
  const status = statusRaw ?? {};
  const bootstrap = extractBootstrapContext(device, status, simulatorRaw);
  const preferredSourceType: CarrierSourceType = bootstrap.device_mode === "simulator"
    ? "simulator"
    : bootstrap.device_mode === "real"
      ? "physical"
      : input.sourceType;

  const categories = uniqueText(skills.map((item) => resolveSkillClassification(item)));
  const bindingTargets = uniqueText(bindings.map((item: any) => item?.target_id ?? item?.crop_code ?? item?.bind_target));
  const lastTelemetryAt = toTs(device?.last_telemetry_ts_ms ?? status?.last_telemetry_ts_ms);
  const lastHeartbeatAt = toTs(device?.last_heartbeat_ts_ms ?? status?.last_heartbeat_ts_ms);
  const carrierModeLabel = preferredSourceType === "simulator" ? "模拟承载" : "真实设备承载";
  const simulatorStatusLabel = mapStatusLabel(
    bootstrap.simulator_status
      ?? (typeof simulatorRaw?.running === "boolean" ? (simulatorRaw.running ? "running" : "stopped") : null)
      ?? status?.status
      ?? device?.status,
  );
  const carrierSummary = `正在为 ${categories.join(" / ") || "相关感知技能"} 提供输入`;
  const latestInputLabel = formatTimeLabel(lastTelemetryAt);
  const latestHeartbeatLabel = formatTimeLabel(lastHeartbeatAt);
  const simulatorControlSummary = preferredSourceType === "simulator"
    ? `当前为${carrierModeLabel}，输入状态${simulatorStatusLabel}`
    : `当前为${carrierModeLabel}，建议优先核对现场感知链路`;

  return {
    carrier: {
      deviceId: toText(device?.device_id ?? deviceId, deviceId || "unknown_device"),
      displayName: toText(device?.display_name ?? device?.name, "未命名设备"),
      sourceType: preferredSourceType,
      deviceType: toText(device?.device_template ?? device?.template_code ?? device?.device_type, "unknown_template"),
      fieldId: toText(device?.field_id ?? status?.field_id, "未绑定"),
      deviceMode: toText(bootstrap.device_mode, preferredSourceType === "simulator" ? "simulator" : "real"),
      simulatorStarted: bootstrap.simulator_started,
      simulatorStatus: toText(
        bootstrap.simulator_status
          ?? (typeof simulatorRaw?.running === "boolean" ? (simulatorRaw.running ? "running" : "stopped") : null),
        "unknown"
      ),
      skillRelatedNote: toText(bootstrap.skill_related_note, "该载体用于技能输入链路。"),
    },
    skill: {
      total: skills.length,
      categories,
      bindingTargets,
    },
    telemetry: {
      lastTelemetryAt,
      lastHeartbeatAt,
      status: toText(status?.status ?? device?.status, "unknown"),
    },
    simulator: {
      checked: preferredSourceType === "simulator",
      running: preferredSourceType === "simulator" ? (typeof simulatorRaw?.running === "boolean" ? simulatorRaw.running : bootstrap.simulator_started) : null,
      status: preferredSourceType === "simulator" ? simulatorRaw : null,
    },
    presentation: {
      carrierModeLabel,
      simulatorStatusLabel,
      carrierSummary,
      latestInputLabel,
      latestHeartbeatLabel,
      simulatorControlSummary,
    },
  };
}
