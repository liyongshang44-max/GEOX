// apps/web/src/features/operator/replayDemo/replayDemoLocaleCopy.ts
// Purpose: own bilingual product copy for the complete Replay Demo component tree.
// Boundary: technical snapshot identifiers remain locale-neutral data and are not translated.

import { localizedText, type LocaleCode, type LocalizedCopy } from "../../../lib/locale";

const c = (zh: string, en: string): LocalizedCopy => ({ zh, en });

export const REPLAY_DEMO_COPY = {
  hero: {
    identity: c("回放演示身份", "Replay Demo Identity"),
    mode: c("模式", "Mode"),
    source: c("来源", "Source"),
    route: c("路由", "Route"),
    readOnly: c("只读", "Read-only"),
    replayMode: c("回放支撑演示", "Replay-backed Demo"),
    snapshotSource: c("签入的网关查看器快照", "Checked-in Gateway Viewer Snapshot"),
  },
  common: {
    yes: c("是", "Yes"),
    no: c("否", "No"),
    available: c("可用", "Available"),
    unavailable: c("不可用", "Unavailable"),
    metadataOnly: c("仅元数据", "Metadata Only"),
    label: c("标签", "Label"),
    value: c("值", "Value"),
    metadata: c("元数据", "Metadata"),
    status: c("状态", "Status"),
  },
  sources: {
    viewerSnapshot: c("P51 网关查看器快照", "P51 Gateway Viewer Snapshot"),
    viewModel: c("回放演示视图模型", "Replay Demo View Model"),
    boundary: c("回放演示边界", "Replay Demo Boundary"),
  },
  narrative: {
    aria: c("回放演示说明", "Replay Demo Narrative"),
    eyebrow: c("演示说明", "Demo Narrative"),
    title: c("该演示证明什么", "What This Demo Proves"),
    step: c("步骤", "Step"),
    doesNotProve: c("不证明：", "Does Not Prove:"),
    steps: {
      "1": {
        title: c("稳定回放呈现", "Stable Replay Presentation"),
        explanation: c("签入的网关路径快照可以作为稳定产品演示呈现，并保留证据引用与哈希。", "A checked-in gateway-path snapshot can be rendered as a stable product demo with evidence references and hashes."),
        doesNotMean: [c("真实设备部署", "Live Device Deployment"), c("生产网关在线", "Production Gateway Online"), c("持续运行监控", "Continuous Runtime Monitoring")],
      },
      "2": {
        title: c("演示能力边界", "Demo Capability Boundary"),
        explanation: c("该页面是回放支撑演示界面，不是实时运行界面。", "The page is a replay-backed demonstration surface, not a live operational surface."),
        doesNotMean: [c("运行健康 v1", "Runtime Health v1"), c("田间试点执行", "Field Pilot Execution"), c("AO-ACT 派发", "AO-ACT Dispatch")],
      },
      "3": {
        title: c("可追溯性姿态", "Traceability Posture"),
        explanation: c("显示值保持可追溯到签入的快照引用和确定性哈希。", "Displayed values remain traceable to checked-in snapshot references and deterministic hashes."),
        doesNotMean: [c("创建追踪记录", "Trace Record Creation"), c("生产认证", "Production Certification"), c("运行事件检测", "Runtime Incident Detection")],
      },
    },
  },
  panels: {
    gatewayPathLead: c("网关路径值来自签入快照的回放元数据，不是实时设备数量或生产网关信号。", "Gateway-path values are replay metadata from a checked-in snapshot, not a live-device count or production-gateway signal."),
    standardsLead: c("标准映射是回放证据映射，不是外部认证。", "Standards mapping is replay-evidence mapping, not external certification."),
    deviceLead: c("设备证据包是快照元数据，不是运行健康 v1，也不是实时设备状态。", "The device-evidence package is snapshot metadata. It is not Runtime Health v1 or live-device status."),
    ingestionAria: c("采集窗口", "Ingestion Window"),
    ingestionEyebrow: c("重复数据与时钟偏差处理", "Duplicate and Clock-skew Handling"),
    ingestionTitle: c("采集窗口", "Ingestion Window"),
    ingestionLead: c("重复处理、时钟偏差和采集窗口值均为回放元数据，不表达生产风险等级。", "Duplicate handling, clock skew, and ingestion-window values are replay metadata without production-risk classification."),
    traceabilityLead: c("可追溯性是回查元数据，不创建追踪记录。", "Traceability is readback metadata and does not create trace records."),
    hashesAria: c("哈希", "Hashes"),
    hashesTitle: c("哈希", "Hashes"),
    hashesLead: c("哈希是可复现性元数据，不是生产认证。", "Hashes are reproducibility metadata, not production certification."),
    snapshotIdsAria: c("快照标识", "Snapshot IDs"),
    snapshotIdsTitle: c("快照标识", "Snapshot IDs"),
  },
  boundaryClaims: {
    aria: c("否定声明", "Nonclaims"),
    title: c("否定声明", "Nonclaims"),
    claim: c("声明", "Claim"),
    value: c("值", "Value"),
    meaning: c("含义", "Meaning"),
    labels: {
      real_live_device_proof: c("真实设备证明", "Live-device Proof"),
      production_gateway: c("生产网关", "Production Gateway"),
      field_pilot: c("田间试点", "Field Pilot"),
      runtime_health_v1: c("运行健康 v1", "Runtime Health v1"),
      read_only: c("只读", "Read-only"),
    },
    meanings: {
      real_live_device_proof: c("不声明真实设备已经部署。", "Live-device deployment is not claimed."),
      production_gateway: c("不声明生产网关已经上线。", "A production gateway is not claimed online."),
      field_pilot: c("不声明田间试点已经开始。", "A field pilot is not claimed started."),
      runtime_health_v1: c("不声明运行健康 v1 已经启用。", "Runtime Health v1 is not claimed enabled."),
      read_only: c("该演示保持只读。", "The demo remains read-only."),
    },
    additionalLabel: c("附加否定声明", "Additional Nonclaim"),
    additionalMeaning: c("该否定声明来自签入快照。", "This nonclaim is supplied by the checked-in snapshot."),
  },
} as const;

export function replayText(locale: LocaleCode, copy: LocalizedCopy): string {
  return localizedText(copy, locale);
}

export function replayBoolean(locale: LocaleCode, value: boolean): string {
  return replayText(locale, value ? REPLAY_DEMO_COPY.common.yes : REPLAY_DEMO_COPY.common.no);
}

export function replayMetadataStatus(locale: LocaleCode, status?: string): string {
  if (status === "available") return replayText(locale, REPLAY_DEMO_COPY.common.available);
  if (status === "not_available") return replayText(locale, REPLAY_DEMO_COPY.common.unavailable);
  return replayText(locale, REPLAY_DEMO_COPY.common.metadataOnly);
}

export function replayNarrativeStep(locale: LocaleCode, step: string) {
  const configured = REPLAY_DEMO_COPY.narrative.steps[step as keyof typeof REPLAY_DEMO_COPY.narrative.steps];
  return configured ?? REPLAY_DEMO_COPY.narrative.steps["1"];
}

export function replayClaimLabel(locale: LocaleCode, label: string): string {
  const configured = REPLAY_DEMO_COPY.boundaryClaims.labels[label as keyof typeof REPLAY_DEMO_COPY.boundaryClaims.labels];
  return replayText(locale, configured ?? REPLAY_DEMO_COPY.boundaryClaims.additionalLabel);
}

export function replayClaimMeaning(locale: LocaleCode, label: string): string {
  const configured = REPLAY_DEMO_COPY.boundaryClaims.meanings[label as keyof typeof REPLAY_DEMO_COPY.boundaryClaims.meanings];
  return replayText(locale, configured ?? REPLAY_DEMO_COPY.boundaryClaims.additionalMeaning);
}
