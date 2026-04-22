import { listSkillBindings, listSkillRegistry, resolveSkillClassification } from "../api/skills";
import {
  fetchDeviceDetail,
  fetchDeviceStatusOptional,
  fetchSimulatorRunnerStatus,
  type SimulatorRunnerStatusResponseV1,
} from "../lib/api";

export type CarrierSourceType = "simulator" | "physical";

export type SkillCarrierVm = {
  carrier: {
    deviceId: string;
    displayName: string;
    sourceType: CarrierSourceType;
    deviceType: string;
    fieldId: string;
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

  const categories = uniqueText(skills.map((item) => resolveSkillClassification(item)));
  const bindingTargets = uniqueText(bindings.map((item: any) => item?.target_id ?? item?.crop_code ?? item?.bind_target));

  return {
    carrier: {
      deviceId: toText(device?.device_id ?? deviceId, deviceId || "unknown_device"),
      displayName: toText(device?.display_name ?? device?.name, "未命名设备"),
      sourceType: input.sourceType,
      deviceType: toText(device?.device_template ?? device?.template_code ?? device?.device_type, "unknown_template"),
      fieldId: toText(device?.field_id ?? status?.field_id, "未绑定"),
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
      checked: input.sourceType === "simulator",
      running: input.sourceType === "simulator" ? (typeof simulatorRaw?.running === "boolean" ? simulatorRaw.running : null) : null,
      status: input.sourceType === "simulator" ? simulatorRaw : null,
    },
  };
}
