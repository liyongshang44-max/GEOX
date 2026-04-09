import React from "react";
import { Link } from "react-router-dom";
import { SectionCard, Stepper } from "../../../../shared/ui";
import {
  ONBOARDING_STEPS,
  ONBOARDING_TRACE_STORAGE_KEY,
  type OnboardingRecord,
  type OnboardingStepKey,
  type OnboardingStepRuntime,
} from "../mockFlow";

type Props = {
  deviceId: string;
  deviceMode?: "real" | "simulator";
  deviceTemplate?: string;
};

function makeTraceId(deviceId: string, stepKey: OnboardingStepKey): string {
  return `${deviceId || "unknown"}-${stepKey}-${Date.now()}`;
}

function initialRuntime(): Record<OnboardingStepKey, OnboardingStepRuntime> {
  return ONBOARDING_STEPS.reduce((acc, step) => {
    acc[step.key] = { state: "pending", lastMessage: "等待执行" };
    return acc;
  }, {} as Record<OnboardingStepKey, OnboardingStepRuntime>);
}

function loadRecords(): OnboardingRecord[] {
  try {
    const raw = localStorage.getItem(ONBOARDING_TRACE_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveRecords(records: OnboardingRecord[]): void {
  localStorage.setItem(ONBOARDING_TRACE_STORAGE_KEY, JSON.stringify(records));
}

export default function DeviceOnboardingFlow({ deviceId, deviceMode = "simulator", deviceTemplate = "soil_probe_v1" }: Props): React.ReactElement {
  const [stepState, setStepState] = React.useState<Record<OnboardingStepKey, OnboardingStepRuntime>>(initialRuntime);
  const [nextOutcome, setNextOutcome] = React.useState<Record<OnboardingStepKey, "success" | "failed">>(() => ONBOARDING_STEPS.reduce((acc, step) => {
    acc[step.key] = "success";
    return acc;
  }, {} as Record<OnboardingStepKey, "success" | "failed">));
  const [records, setRecords] = React.useState<OnboardingRecord[]>([]);

  React.useEffect(() => {
    const nextRecords = loadRecords().filter((item) => item.deviceId === deviceId.trim());
    setRecords(nextRecords);
  }, [deviceId]);

  const activeIndex = ONBOARDING_STEPS.findIndex((step) => stepState[step.key].state !== "success");
  const flowDone = activeIndex === -1;

  function pushRecord(stepKey: OnboardingStepKey, nextState: "success" | "failed", message: string): void {
    const trace: OnboardingRecord = {
      traceId: makeTraceId(deviceId.trim(), stepKey),
      deviceId: deviceId.trim(),
      stepKey,
      nextState,
      message,
      timestamp: Date.now(),
    };
    const persisted = [...loadRecords(), trace];
    saveRecords(persisted);
    setRecords((prev) => [...prev, trace]);
  }

  function runStep(stepKey: OnboardingStepKey): void {
    const idx = ONBOARDING_STEPS.findIndex((step) => step.key === stepKey);
    const previousStepsDone = idx === 0 || ONBOARDING_STEPS.slice(0, idx).every((step) => stepState[step.key].state === "success");
    if (!previousStepsDone) {
      setStepState((prev) => ({
        ...prev,
        [stepKey]: { state: "failed", lastMessage: "前置步骤未完成，无法继续。" },
      }));
      pushRecord(stepKey, "failed", "前置步骤未完成，流程被阻断。");
      return;
    }

    const outcome = nextOutcome[stepKey];
    const step = ONBOARDING_STEPS.find((item) => item.key === stepKey);
    if (!step) return;
    const message = outcome === "success" ? step.successFeedback : step.failureFeedback;
    setStepState((prev) => ({
      ...prev,
      [stepKey]: { state: outcome, lastMessage: message },
    }));
    pushRecord(stepKey, outcome, message);
  }

  return (
    <>
      <SectionCard title="接入步骤（Mock 闭环）">
        <div className="metaText" style={{ marginBottom: 8 }}>
          当前接入契约：<code>device_mode={deviceMode}</code> · <code>device_template={deviceTemplate}</code>
        </div>
        <Stepper
          items={ONBOARDING_STEPS.map((step, idx) => ({
            key: step.key,
            title: step.title,
            done: stepState[step.key].state === "success",
            active: !flowDone && idx === activeIndex,
          }))}
        />
      </SectionCard>

      {ONBOARDING_STEPS.map((step) => (
        <SectionCard key={step.key} title={step.title}>
          <div className="metaText">{step.description}</div>
          <div className="metaText" style={{ marginTop: 6 }}>当前状态：<strong>{stepState[step.key].state}</strong></div>
          <div className="metaText" style={{ marginTop: 6 }}>成功/失败反馈：{stepState[step.key].lastMessage}</div>
          <div className="toolbarFilters" style={{ marginTop: 10 }}>
            <select
              className="select"
              value={nextOutcome[step.key]}
              onChange={(event) => setNextOutcome((prev) => ({ ...prev, [step.key]: event.target.value as "success" | "failed" }))}
            >
              <option value="success">模拟 success</option>
              <option value="failed">模拟 failed</option>
            </select>
            <button className="btn primary" onClick={() => runStep(step.key)}>下一步按钮：执行本步骤</button>
          </div>
          <div className="metaText" style={{ marginTop: 8 }}>失败排查建议：{step.troubleshooting}</div>
        </SectionCard>
      ))}

      <SectionCard title="接入记录（Trace）">
        <div className="operationsSummaryActions" style={{ marginBottom: 8 }}>
          <Link className="btn secondary" to={`/devices/${encodeURIComponent(deviceId.trim())}`}>去设备详情查看关联记录</Link>
        </div>
        {!records.length ? <div className="metaText">暂无接入记录。执行上方步骤后将自动写入 trace。</div> : null}
        {records.slice().reverse().map((record) => (
          <div key={record.traceId} className="decisionItemStatic">
            <div className="decisionItemTitle">{record.stepKey} · {record.nextState}</div>
            <div className="decisionItemMeta">trace_id: {record.traceId}</div>
            <div className="decisionItemMeta">{new Date(record.timestamp).toLocaleString("zh-CN", { hour12: false })} · {record.message}</div>
          </div>
        ))}
      </SectionCard>
    </>
  );
}
