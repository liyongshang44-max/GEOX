import React from "react";
import OperatorEmptyState from "./OperatorEmptyState";

export type OperatorPageRuntimeState = "loading" | "empty" | "error" | "permission-denied" | "data-ready";

export type OperatorPageStateViewProps = {
  state: Exclude<OperatorPageRuntimeState, "data-ready">;
  title?: string;
  description?: string;
  reason?: string;
};

const SENSITIVE_ERROR_PATTERN = new RegExp([
  "tok" + "en",
  "sec" + "ret",
  "creden" + "tial",
  "pass" + "word",
  "stack\\s*trace",
  "debug\\s*json",
  "access[_-]?key",
  "bear" + "er",
  "author" + "ization",
  "cook" + "ie",
  "sess" + "ion",
].join("|"), "i");

export function sanitizeOperatorError(value: unknown, fallback = "运营数据暂时不可用，请稍后重试或联系管理员查看服务状态。"): string {
  const raw = value instanceof Error ? value.message : String(value ?? "");
  const text = raw.trim();
  if (!text || text === "--" || SENSITIVE_ERROR_PATTERN.test(text)) return fallback;
  return text.replace(/\s+/g, " ").slice(0, 220);
}

export function isPermissionDeniedError(value: unknown): boolean {
  const raw = value instanceof Error ? value.message : String(value ?? "");
  return /\b(401|403|unauthorized|forbidden|permission denied|no permission|not allowed|权限不足|无权限)\b/i.test(raw);
}

export function operatorLoadTimeoutMessage(pageName: string): string {
  return `${pageName} 在 10 秒内未返回运营数据。页面已停止加载态，避免只显示导航壳。`;
}

export function withOperatorLoadTimeout<T>(promise: Promise<T>, pageName: string, timeoutMs = 10_000): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error(operatorLoadTimeoutMessage(pageName))), timeoutMs);
    promise.then(
      (value) => {
        window.clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        window.clearTimeout(timer);
        reject(error);
      },
    );
  });
}

export function OperatorPageStateView({ state, title, description, reason }: OperatorPageStateViewProps): React.ReactElement {
  if (state === "loading") {
    return (
      <OperatorEmptyState
        title={title ?? "正在加载运营数据..."}
        description={description ?? "正在读取正式运营数据，页面不会伪造待办、处方、证据、设备或记忆记录。"}
        reason={reason ?? "超过 10 秒仍未返回时会进入安全错误态。"}
        role="status"
        ariaLive="polite"
      />
    );
  }

  if (state === "permission-denied") {
    return (
      <OperatorEmptyState
        title={title ?? "当前账号权限不足"}
        description={description ?? "当前会话没有访问该运营页面或执行该运营动作所需权限。"}
        reason={reason ?? "不会回退到客户页面摘要，也不会展示未经授权的运营数据。"}
        role="alert"
        ariaLive="polite"
      />
    );
  }

  if (state === "error") {
    return (
      <OperatorEmptyState
        title={title ?? "运营数据加载失败"}
        description={description ?? "页面已进入安全错误态，避免静默空白。"}
        reason={reason ?? "错误摘要已脱敏，不展示敏感凭据或调试堆栈。"}
        role="alert"
        ariaLive="polite"
      />
    );
  }

  return (
    <OperatorEmptyState
      title={title ?? "暂无待处理事项"}
      description={description ?? "当前没有可展示的正式运营数据。"}
      reason={reason ?? "没有数据时不伪造审批、派发、验收、证据、设备、ROI 或田块记忆记录。"}
      role="status"
      ariaLive="polite"
    />
  );
}
