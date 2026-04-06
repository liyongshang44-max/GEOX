export type MockStepState = "pending" | "success" | "failed";

export type OnboardingStepKey =
  | "register_device"
  | "credential_ready"
  | "connectivity_verified"
  | "bind_field"
  | "first_telemetry"
  | "onboarding_completed";

export type OnboardingStepConfig = {
  key: OnboardingStepKey;
  title: string;
  description: string;
  troubleshooting: string;
  successFeedback: string;
  failureFeedback: string;
};

export type OnboardingStepRuntime = {
  state: MockStepState;
  lastMessage: string;
};

export type OnboardingRecord = {
  traceId: string;
  deviceId: string;
  stepKey: OnboardingStepKey;
  nextState: Exclude<MockStepState, "pending">;
  message: string;
  timestamp: number;
};

export const ONBOARDING_STEPS: OnboardingStepConfig[] = [
  {
    key: "register_device",
    title: "步骤 1：创建设备",
    description: "先完成设备注册，生成后续接入流程的唯一主体。",
    troubleshooting: "检查 device_id 唯一性、格式与租户写入权限。",
    successFeedback: "设备注册成功，可继续执行凭据确认。",
    failureFeedback: "设备注册失败，请核对 device_id 与权限后重试。",
  },
  {
    key: "credential_ready",
    title: "步骤 2：凭据就绪确认",
    description: "确认设备凭据已签发且处于可用状态。",
    troubleshooting: "核对 credential_id、凭据状态（ACTIVE）及下发流程。",
    successFeedback: "凭据状态正常，可继续验证连通性。",
    failureFeedback: "凭据不可用，请重新签发或检查设备端密钥。",
  },
  {
    key: "connectivity_verified",
    title: "步骤 3：连通性验证",
    description: "校验设备能稳定连接并有心跳/链路可达。",
    troubleshooting: "检查 MQTT 地址、Client ID、TLS、防火墙与网络质量。",
    successFeedback: "连通性验证通过，可继续绑定田块。",
    failureFeedback: "连通性未通过，请排查网络或 Broker 配置。",
  },
  {
    key: "bind_field",
    title: "步骤 4：绑定田块（独立步骤）",
    description: "仅负责把设备绑定到目标田块，不与创建设备混合。",
    troubleshooting: "确认 field_id 存在、归属当前租户且绑定接口可用。",
    successFeedback: "田块绑定成功，可继续首条 telemetry 校验。",
    failureFeedback: "田块绑定失败，请检查 field_id 和接口返回。",
  },
  {
    key: "first_telemetry",
    title: "步骤 5：首条 telemetry 校验（独立步骤）",
    description: "单独校验首条 telemetry 已上报，不与绑定步骤混合。",
    troubleshooting: "确认 telemetry topic、payload JSON 与设备时间戳。",
    successFeedback: "首条 telemetry 校验通过。",
    failureFeedback: "未检测到有效 telemetry，请检查上报通道与数据格式。",
  },
  {
    key: "onboarding_completed",
    title: "步骤 6：接入完成确认",
    description: "确认前 5 步均完成，形成可追溯的接入闭环。",
    troubleshooting: "回看前 5 步状态，补齐失败步骤后再次确认。",
    successFeedback: "6 步流程全部完成，接入闭环已达成。",
    failureFeedback: "仍有未通过步骤，暂不能标记为接入完成。",
  },
];

export const ONBOARDING_TRACE_STORAGE_KEY = "geox_device_onboarding_records";
