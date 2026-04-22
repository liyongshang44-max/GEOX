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
  ui: {
    pageTitle: string;
    pageDescription: string;
    carrierIdLabel: string;
    carrierNameLabel: string;
    carrierModeLabel: string;
    skillCategoryLabel: string;
    bindTargetLabel: string;
    deviceTypeLabel: string;
    fieldLabel: string;
    inputStatusLabel: string;
    latestInputLabel: string;
    latestHeartbeatLabel: string;
    carrierSummary: string;
    simulatorControlSummary: string;
    simulatorStatusLabel: string;
    simulatorLastTickLabel: string;
    simulatorIntervalLabel: string;
    simulatorErrorLabel: string;
  };
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
  const carrierModeText = preferredSourceType === "simulator" ? "模拟承载" : "真实设备承载";
  const skillCategoriesText = categories.join(" / ") || "未识别";
  const bindingTargetsText = bindingTargets.join(" / ") || "未绑定";
  const inputStatusText = toText(status?.status ?? device?.status, "未知");
  const simulatorControlSummary = preferredSourceType === "simulator"
    ? `当前为模拟承载，可直接控制模拟感知并验证技能输入链路。`
    : "当前为真实设备承载，请重点确认现场输入与心跳连续性。";

  return {
    ui: {
      pageTitle: "感知载体接入",
      pageDescription: "当前页面用于为地块接入承载感知技能与设备技能的载体，支持真实设备承载与模拟承载两种模式。可查看承载状态、控制模拟感知并验证技能输入链路。",
      carrierIdLabel: "载体编号",
      carrierNameLabel: "载体名称",
      carrierModeLabel: "承载模式",
      skillCategoryLabel: "当前技能类别",
      bindTargetLabel: "当前绑定目标",
      deviceTypeLabel: "当前设备类型",
      fieldLabel: "当前绑定地块",
      inputStatusLabel: "当前输入状态",
      latestInputLabel: "最近感知时间",
      latestHeartbeatLabel: "最近心跳时间",
      carrierSummary: `已识别 ${skills.length} 个候选技能，当前为 ${carrierModeText}。技能类别：${skillCategoriesText}；绑定目标：${bindingTargetsText}；输入状态：${inputStatusText}。`,
      simulatorControlSummary,
      simulatorStatusLabel: "当前状态",
      simulatorLastTickLabel: "最近一次模拟输入时间",
      simulatorIntervalLabel: "当前模拟输入周期",
      simulatorErrorLabel: "最近错误",
    },
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
      lastTelemetryAt: toTs(device?.last_telemetry_ts_ms ?? status?.last_telemetry_ts_ms),
      lastHeartbeatAt: toTs(device?.last_heartbeat_ts_ms ?? status?.last_heartbeat_ts_ms),
      status: toText(status?.status ?? device?.status, "unknown"),
    },
    simulator: {
      checked: preferredSourceType === "simulator",
      running: preferredSourceType === "simulator" ? (typeof simulatorRaw?.running === "boolean" ? simulatorRaw.running : bootstrap.simulator_started) : null,
      status: preferredSourceType === "simulator" ? simulatorRaw : null,
    },
  };
}
