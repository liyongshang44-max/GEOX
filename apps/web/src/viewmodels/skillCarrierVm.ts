import { listSkillBindings, listSkillRegistry, resolveSkillClassification } from "../api/skills";
import {
  fetchDeviceDetail,
  fetchDeviceStatusOptional,
  fetchSimulatorRunnerStatus,
  type SimulatorRunnerStatusResponseV1,
} from "../lib/api";
import { extractBootstrapContext } from "../lib/bootstrapContext";

export type CarrierSourceType = "simulator" | "physical";
type SimulatorStatusLike = {
  running?: boolean | null;
  interval_ms?: number | null;
  last_tick_ts_ms?: number | null;
  last_error?: string | null;
};

export type SkillCarrierVm = {
  copy: {
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
  display: {
    carrierModeText: string;
    skillCategoryText: string;
    bindTargetText: string;
    inputStatusText: string;
    latestInputText: string;
    latestHeartbeatText: string;
    simulatorStateText: string;
    simulatorLastTickText: string;
    simulatorIntervalText: string;
    simulatorErrorText: string;
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

function formatTime(ts: number | null): string {
  if (!ts) return "-";
  return new Date(ts).toLocaleString("zh-CN", { hour12: false });
}

function getCarrierModeText(sourceType: CarrierSourceType): string {
  return sourceType === "simulator" ? "模拟承载" : "真实设备承载";
}

function getSimulatorStateText(input: {
  running: boolean | null | undefined;
  lastError: string | null | undefined;
}): string {
  if (toText(input.lastError, "") !== "") return "异常";
  if (input.running === true) return "运行中";
  if (input.running === false) return "已停止";
  return "未启动";
}

function buildCopy(sourceType: CarrierSourceType): SkillCarrierVm["copy"] {
  const carrierModeText = getCarrierModeText(sourceType);
  return {
    pageTitle: "感知技能载体接入",
    pageDescription:
      "当前页面用于为地块接入承载感知技能的载体。可选择真实设备承载或模拟承载模式。可查看承载状态、控制模拟感知并验证技能输入链路。",
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
    carrierSummary: `已识别候选技能，当前为${carrierModeText}。`,
    simulatorControlSummary: "该载体正在为感知技能提供演示输入，用于验证技能行为与绑定策略。",
    simulatorStatusLabel: "当前状态",
    simulatorLastTickLabel: "最近一次模拟输入时间",
    simulatorIntervalLabel: "当前模拟输入周期",
    simulatorErrorLabel: "最近错误",
  };
}

export function buildSimulatorDisplay(input: {
  status: SimulatorStatusLike | null | undefined;
  skillCategories: string[];
  fallbackState?: string;
  simulatorError?: string;
}): Pick<
  SkillCarrierVm["display"],
  "simulatorStateText" | "simulatorLastTickText" | "simulatorIntervalText" | "simulatorErrorText"
> & { simulatorControlSummary: string } {
  const running = typeof input.status?.running === "boolean" ? input.status.running : null;
  const lastError = toText(input.status?.last_error, "");
  const simulatorStateText = input.fallbackState || getSimulatorStateText({ running, lastError });
  const categoriesText = input.skillCategories.join(" / ") || "相关技能";
  return {
    simulatorStateText,
    simulatorLastTickText: formatTime(toTs(input.status?.last_tick_ts_ms)),
    simulatorIntervalText: input.status?.interval_ms ? `${input.status.interval_ms} ms` : "-",
    simulatorErrorText: toText(input.simulatorError, toText(input.status?.last_error, "-")),
    simulatorControlSummary: `正在为 ${categoriesText} 提供模拟输入`,
  };
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
  const copy = buildCopy(preferredSourceType);
  const skillCategoryText = categories.join(" / ") || "未识别";
  const bindTargetText = bindingTargets.join(" / ") || "未绑定";
  const carrierModeText = getCarrierModeText(preferredSourceType);
  const inputStatusText = toText(status?.status ?? device?.status, "unknown");
  const simulatorDisplay = buildSimulatorDisplay({
    status: simulatorRaw as SimulatorStatusLike | null,
    skillCategories: categories,
    fallbackState:
      inputStatusText === "unknown" && preferredSourceType === "simulator"
        ? getSimulatorStateText({
            running: typeof simulatorRaw?.running === "boolean" ? simulatorRaw.running : null,
            lastError: toText((simulatorRaw as SimulatorStatusLike | null)?.last_error, ""),
          })
        : undefined,
  });

  return {
    copy: {
      ...copy,
      carrierSummary: `已识别 ${skills.length} 个候选技能，当前为${carrierModeText}。`,
    },
    display: {
      carrierModeText,
      skillCategoryText,
      bindTargetText,
      inputStatusText: inputStatusText === "unknown" ? simulatorDisplay.simulatorStateText : inputStatusText,
      latestInputText: formatTime(toTs(device?.last_telemetry_ts_ms ?? status?.last_telemetry_ts_ms)),
      latestHeartbeatText: formatTime(toTs(device?.last_heartbeat_ts_ms ?? status?.last_heartbeat_ts_ms)),
      simulatorStateText: simulatorDisplay.simulatorStateText,
      simulatorLastTickText: simulatorDisplay.simulatorLastTickText,
      simulatorIntervalText: simulatorDisplay.simulatorIntervalText,
      simulatorErrorText: simulatorDisplay.simulatorErrorText,
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
      status: inputStatusText,
    },
    simulator: {
      checked: preferredSourceType === "simulator",
      running: preferredSourceType === "simulator" ? (typeof simulatorRaw?.running === "boolean" ? simulatorRaw.running : bootstrap.simulator_started) : null,
      status: preferredSourceType === "simulator" ? simulatorRaw : null,
    },
  };
}
