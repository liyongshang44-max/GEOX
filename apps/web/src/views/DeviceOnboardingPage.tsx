import React from "react";
import { Link } from "react-router-dom";
import { useSession } from "../auth/useSession";
import { bindDeviceToField, fetchDeviceOnboardingStatus, registerDeviceOnboarding } from "../lib/api";
import { PageHeader, SectionCard, Stepper } from "../shared/ui";

function fmtTs(v: number | null | undefined): string {
  return typeof v === "number" && Number.isFinite(v) && v > 0 ? new Date(v).toLocaleString("zh-CN", { hour12: false }) : "-";
}

type StepKey = "register_device" | "credential_ready" | "connectivity_verified" | "bind_field" | "first_telemetry" | "onboarding_completed";
type StepFeedback = { success: string; failure: string };

const STEP_STATUS_FIELD_MAP: Record<StepKey, string> = {
  register_device: "registration_completed",
  credential_ready: "credential_ready",
  connectivity_verified: "last_heartbeat_ts_ms / connection_alive（推导）",
  bind_field: "bound_field_id / field_id（后端字段）",
  first_telemetry: "first_telemetry_uploaded",
  onboarding_completed: "registration_completed && credential_ready && bind_field && first_telemetry（推导）",
};

const STEP_TITLES: Record<StepKey, string> = {
  register_device: "步骤 1：注册设备",
  credential_ready: "步骤 2：确认凭据可用",
  connectivity_verified: "步骤 3：连通性验证",
  bind_field: "步骤 4：绑定田块",
  first_telemetry: "步骤 5：首条 telemetry 校验",
  onboarding_completed: "步骤 6：接入完成",
};

const STEP_TROUBLESHOOTING: Record<StepKey, string> = {
  register_device: "检查 token 权限是否包含设备写入；确认 device_id 唯一且格式合法。",
  credential_ready: "若状态长期未就绪，请刷新后核对设备凭据状态是否 ACTIVE。",
  connectivity_verified: "确认设备网络、Broker 地址、Client ID 与密钥；若持续离线，检查防火墙和 TLS 配置。",
  bind_field: "确认 field_id 存在且属于当前租户；若返回 404/501，表示绑定接口尚未上线。",
  first_telemetry: "确认设备已使用最新凭据连接 MQTT，并向 telemetry topic 发布 JSON 数据。",
  onboarding_completed: "若仍未完成，请按顺序检查前 5 步是否全部通过，并刷新一次总状态。",
};

function readBindFieldId(onboarding: any): string {
  return String(onboarding?.bound_field_id || onboarding?.field_id || onboarding?.device?.field_id || "").trim();
}

function isStepDone(step: StepKey, onboarding: any, localBoundFieldId: string): boolean {
  if (step === "connectivity_verified") {
    const heartbeatTs = Number(onboarding?.last_heartbeat_ts_ms ?? onboarding?.last_telemetry_ts_ms ?? 0);
    if (!Number.isFinite(heartbeatTs) || heartbeatTs <= 0) return false;
    return Date.now() - heartbeatTs <= 6 * 60 * 60 * 1000;
  }
  if (step === "bind_field") {
    return Boolean(readBindFieldId(onboarding) || localBoundFieldId);
  }
  if (step === "onboarding_completed") {
    return (
      isStepDone("register_device", onboarding, localBoundFieldId)
      && isStepDone("credential_ready", onboarding, localBoundFieldId)
      && isStepDone("connectivity_verified", onboarding, localBoundFieldId)
      && isStepDone("bind_field", onboarding, localBoundFieldId)
      && isStepDone("first_telemetry", onboarding, localBoundFieldId)
    );
  }
  return Boolean(onboarding?.[STEP_STATUS_FIELD_MAP[step]]);
}

export default function DeviceOnboardingPage(): React.ReactElement {
  const { token, setToken } = useSession();
  const [deviceId, setDeviceId] = React.useState<string>("demo_device_001");
  const [displayName, setDisplayName] = React.useState<string>("演示设备 001");
  const [credentialId, setCredentialId] = React.useState<string>("");
  const [fieldId, setFieldId] = React.useState<string>("");
  const [busyStep, setBusyStep] = React.useState<StepKey | null>(null);
  const [registerResult, setRegisterResult] = React.useState<any>(null);
  const [onboarding, setOnboarding] = React.useState<any>(null);
  const [localBoundFieldId, setLocalBoundFieldId] = React.useState<string>("");
  const [stepFeedback, setStepFeedback] = React.useState<Record<StepKey, StepFeedback>>({
    register_device: { success: "", failure: "" },
    credential_ready: { success: "", failure: "" },
    connectivity_verified: { success: "", failure: "" },
    bind_field: { success: "", failure: "" },
    first_telemetry: { success: "", failure: "" },
    onboarding_completed: { success: "", failure: "" },
  });

  const stepFlow: StepKey[] = ["register_device", "credential_ready", "connectivity_verified", "bind_field", "first_telemetry", "onboarding_completed"];

  const markStepSuccess = React.useCallback((step: StepKey, message: string): void => {
    setStepFeedback((prev) => ({ ...prev, [step]: { success: message, failure: "" } }));
  }, []);

  const markStepFailure = React.useCallback((step: StepKey, message: string): void => {
    setStepFeedback((prev) => ({ ...prev, [step]: { success: "", failure: message } }));
  }, []);

  const refreshOnboardingStatus = React.useCallback(async (step: StepKey, successMessage: string): Promise<any> => {
    const next = await fetchDeviceOnboardingStatus(token, deviceId.trim());
    setOnboarding(next);
    const boundField = readBindFieldId(next);
    if (boundField) setLocalBoundFieldId(boundField);
    markStepSuccess(step, successMessage);
    return next;
  }, [deviceId, markStepSuccess, token]);

  async function handleRegisterStep(): Promise<void> {
    setBusyStep("register_device");
    try {
      const res = await registerDeviceOnboarding(token, {
        device_id: deviceId.trim(),
        display_name: displayName.trim(),
        credential_id: credentialId.trim() || undefined,
      });
      setRegisterResult(res);
      markStepSuccess("register_device", `设备 ${res?.device_id || deviceId} 注册成功。`);
      if (res?.credential_id) {
        markStepSuccess("credential_ready", `凭据 ${res.credential_id} 已签发。`);
      }
      await refreshOnboardingStatus("register_device", `已同步注册状态（映射字段：${STEP_STATUS_FIELD_MAP.register_device}）。`);
    } catch (e: any) {
      markStepFailure("register_device", `注册失败：${e?.bodyText || e?.message || String(e)}`);
    } finally {
      setBusyStep(null);
    }
  }

  async function handleRefreshCredentialStep(): Promise<void> {
    setBusyStep("credential_ready");
    try {
      await refreshOnboardingStatus("credential_ready", `凭据状态已刷新（映射字段：${STEP_STATUS_FIELD_MAP.credential_ready}）。`);
    } catch (e: any) {
      markStepFailure("credential_ready", `凭据状态刷新失败：${e?.bodyText || e?.message || String(e)}`);
    } finally {
      setBusyStep(null);
    }
  }

  async function handleBindFieldStep(): Promise<void> {
    setBusyStep("bind_field");
    const payloadFieldId = fieldId.trim();
    if (!payloadFieldId) {
      markStepFailure("bind_field", "请先填写 field_id 后再执行绑定。协议：BIND_FIELD_INPUT_REQUIRED");
      setBusyStep(null);
      return;
    }

    try {
      await bindDeviceToField(token, deviceId.trim(), { field_id: payloadFieldId });
      setLocalBoundFieldId(payloadFieldId);
      markStepSuccess("bind_field", `设备已绑定到田块 ${payloadFieldId}。`);
      await refreshOnboardingStatus("bind_field", "绑定结果已刷新。若后端暂未返回 bound_field_id，将使用本地绑定结果占位。");
    } catch (e: any) {
      const bodyText = String(e?.bodyText || "");
      const status = Number(e?.status || 0);
      if (status === 404 || status === 501 || /not found|not implemented/i.test(bodyText)) {
        markStepFailure("bind_field", "绑定接口暂未开通。协议：BIND_FIELD_API_UNAVAILABLE（请联系后端补齐 /api/v1/devices/{id}/bind-field）。");
      } else {
        markStepFailure("bind_field", `绑定失败：${bodyText || e?.message || String(e)}。协议：BIND_FIELD_ACTION_FAILED`);
      }
    } finally {
      setBusyStep(null);
    }
  }

  async function handleRefreshTelemetryStep(): Promise<void> {
    setBusyStep("first_telemetry");
    try {
      const next = await refreshOnboardingStatus("first_telemetry", `telemetry 状态已刷新（映射字段：${STEP_STATUS_FIELD_MAP.first_telemetry}）。`);
      if (next?.first_telemetry_uploaded) {
        markStepSuccess("first_telemetry", "首条 telemetry 校验通过，接入流程已完成。");
      }
    } catch (e: any) {
      markStepFailure("first_telemetry", `telemetry 校验失败：${e?.bodyText || e?.message || String(e)}`);
    } finally {
      setBusyStep(null);
    }
  }

  async function handleConnectivityStep(): Promise<void> {
    setBusyStep("connectivity_verified");
    try {
      const next = await refreshOnboardingStatus("connectivity_verified", "连通性状态已刷新。");
      const heartbeatTs = Number(next?.last_heartbeat_ts_ms ?? next?.last_telemetry_ts_ms ?? 0);
      if (Number.isFinite(heartbeatTs) && heartbeatTs > 0 && Date.now() - heartbeatTs <= 6 * 60 * 60 * 1000) {
        markStepSuccess("connectivity_verified", "检测到最近心跳/遥测，连通性验证通过。");
      } else {
        markStepFailure("connectivity_verified", "未检测到最近心跳，请检查设备连接后重试。");
      }
    } catch (e: any) {
      markStepFailure("connectivity_verified", `连通性校验失败：${e?.bodyText || e?.message || String(e)}`);
    } finally {
      setBusyStep(null);
    }
  }

  async function handleCompletionStep(): Promise<void> {
    setBusyStep("onboarding_completed");
    try {
      const next = await refreshOnboardingStatus("onboarding_completed", "已刷新完成态。");
      if (isStepDone("onboarding_completed", next, localBoundFieldId)) {
        markStepSuccess("onboarding_completed", "6 步流程已全部完成。");
      } else {
        markStepFailure("onboarding_completed", "仍有未完成步骤，请先补齐前置步骤。");
      }
    } catch (e: any) {
      markStepFailure("onboarding_completed", `完成态校验失败：${e?.bodyText || e?.message || String(e)}`);
    } finally {
      setBusyStep(null);
    }
  }

  const completed = isStepDone("onboarding_completed", onboarding, localBoundFieldId);
  const activeStep = stepFlow.find((step) => !isStepDone(step, onboarding, localBoundFieldId));

  return (
    <div className="consolePage">
      <PageHeader
        title="设备接入向导"
        description="按步骤执行“注册设备 → 凭据确认 → 绑定田块 → telemetry 校验”，每步独立操作与刷新，避免一次性批量提交。"
      />

      <SectionCard title="基础信息">
        <div className="sectionHeader"><div><div className="sectionTitle">基础信息</div></div></div>
        <div className="contentGridTwo alignStart">
          <label className="field">访问令牌<input className="input" value={token} onChange={(e) => setToken(e.target.value)} /></label>
          <label className="field">设备 ID<input className="input" value={deviceId} onChange={(e) => setDeviceId(e.target.value)} /></label>
          <label className="field">设备名称<input className="input" value={displayName} onChange={(e) => setDisplayName(e.target.value)} /></label>
          <label className="field">凭据 ID（可选）<input className="input" value={credentialId} onChange={(e) => setCredentialId(e.target.value)} placeholder="留空自动生成" /></label>
          <label className="field">绑定田块 field_id<input className="input" value={fieldId} onChange={(e) => setFieldId(e.target.value)} placeholder="例如 field_demo_001" /></label>
        </div>
      </SectionCard>

      <SectionCard title="接入步骤">
        <Stepper
          items={stepFlow.map((step) => ({
            key: step,
            title: `${STEP_TITLES[step]}（${STEP_STATUS_FIELD_MAP[step]}）`,
            done: isStepDone(step, onboarding, localBoundFieldId),
            active: step === activeStep,
          }))}
        />
      </SectionCard>

      {stepFlow.map((step, index) => {
        const done = isStepDone(step, onboarding, localBoundFieldId);
        const previousDone = index === 0 ? true : isStepDone(stepFlow[index - 1], onboarding, localBoundFieldId);
        const feedback = stepFeedback[step];

        let stepAction: { label: string; onClick: () => void };
        if (step === "register_device") stepAction = { label: "下一步：执行注册动作", onClick: () => void handleRegisterStep() };
        else if (step === "credential_ready") stepAction = { label: "下一步：刷新凭据状态", onClick: () => void handleRefreshCredentialStep() };
        else if (step === "connectivity_verified") stepAction = { label: "下一步：验证连通性", onClick: () => void handleConnectivityStep() };
        else if (step === "bind_field") stepAction = { label: "下一步：绑定田块", onClick: () => void handleBindFieldStep() };
        else if (step === "first_telemetry") stepAction = { label: "下一步：刷新 telemetry 校验", onClick: () => void handleRefreshTelemetryStep() };
        else stepAction = { label: "下一步：确认接入完成", onClick: () => void handleCompletionStep() };

        return (
          <SectionCard key={step} title={STEP_TITLES[step]}>
            <div className="metaText">当前状态：{done ? "已完成" : "未完成"}</div>
            <div className="metaText">状态映射：<code>{step}</code> → <code>{STEP_STATUS_FIELD_MAP[step]}</code></div>
            <div className="metaText" style={{ marginTop: 8 }}>成功信息：{feedback.success || "-"}</div>
            <div className="metaText">失败信息：{feedback.failure || "-"}</div>
            <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button className="btn primary" disabled={!previousDone || busyStep !== null} onClick={stepAction.onClick}>{stepAction.label}</button>
              <button className="btn" disabled={busyStep !== null} onClick={() => void refreshOnboardingStatus(step, `${STEP_TITLES[step]}：状态已刷新。`).catch((e: any) => markStepFailure(step, `状态刷新失败：${e?.bodyText || e?.message || String(e)}`))}>仅刷新本步骤状态</button>
            </div>
            <div className="metaText" style={{ marginTop: 8 }}>失败排查指引：{STEP_TROUBLESHOOTING[step]}</div>
          </SectionCard>
        );
      })}

      {registerResult ? (
        <SectionCard title="一次性凭据（请立即保存）">
          <div className="meta wrapMeta">
            <span>设备：{registerResult.device_id}</span>
            <span>凭据：{registerResult.credential_id}</span>
            <span>Topic：{registerResult?.access_info?.telemetry_topic || "-"}</span>
          </div>
          <pre className="jsonPreview">{registerResult.credential_secret}</pre>
        </SectionCard>
      ) : null}

      <SectionCard title="设备端配置指南">
        <ol className="metaText" style={{ lineHeight: 1.8 }}>
          <li>设置 MQTT Client ID：<code>{onboarding?.access_info?.mqtt_client_id || `geox-&lt;tenant&gt;-${deviceId}`}</code></li>
          <li>认证用户名建议使用设备 ID，密码使用上方一次性 credential secret。</li>
          <li>发布 telemetry 到 Topic：<code>{onboarding?.access_info?.telemetry_topic || `telemetry/&lt;tenant&gt;/${deviceId}`}</code></li>
          <li>建议同时上报 heartbeat 到 Topic：<code>{onboarding?.access_info?.heartbeat_topic || `heartbeat/&lt;tenant&gt;/${deviceId}`}</code></li>
          <li>首条 telemetry 建议 JSON 示例：<code>{`{"metric":"battery_percent","value":87,"ts_ms":${Date.now()}}`}</code></li>
        </ol>
      </SectionCard>

      <SectionCard title="接入进度">
        <div className="summaryGrid">
          <div className="metricCard card"><div className="metricLabel">设备已注册</div><div className="metricValue">{onboarding?.registration_completed ? "是" : "否"}</div></div>
          <div className="metricCard card"><div className="metricLabel">凭据可用</div><div className="metricValue">{onboarding?.credential_ready ? "是" : "否"}</div></div>
          <div className="metricCard card"><div className="metricLabel">田块绑定</div><div className="metricValue">{readBindFieldId(onboarding) || localBoundFieldId || "未绑定"}</div></div>
          <div className="metricCard card"><div className="metricLabel">首条遥测</div><div className="metricValue">{onboarding?.first_telemetry_uploaded ? "已上传" : "未上传"}</div></div>
          <div className="metricCard card"><div className="metricLabel">最近遥测时间</div><div className="metricValue" style={{ fontSize: 14 }}>{fmtTs(onboarding?.last_telemetry_ts_ms)}</div></div>
        </div>
      </SectionCard>

      {completed ? (
        <SectionCard title="✅ 接入完成">
          <div className="metaText">首条 telemetry 校验完成。你可以继续查看设备详情或返回监控台。</div>
          <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Link className="btn primary" to={`/devices/${encodeURIComponent(deviceId.trim())}`}>跳转：设备详情</Link>
            <Link className="btn" to="/dashboard">跳转：监控台</Link>
          </div>
        </SectionCard>
      ) : null}
    </div>
  );
}
