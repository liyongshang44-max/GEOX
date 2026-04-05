import React from "react";

export default function ErrorState({
  title = "加载失败",
  message,
  onRetry,
  technical,
  secondaryText,
  onSecondary,
}: {
  title?: string;
  message?: string;
  onRetry?: () => void;
  technical?: string;
  secondaryText?: string;
  onSecondary?: () => void;
}): React.ReactElement {
  const isDev = Boolean((import.meta as any).env?.DEV);
  return (
    <div className="card" style={{ padding: 14, borderColor: "#fecdca", background: "#fff6f5" }}>
      <div style={{ fontWeight: 700 }}>{title}</div>
      <div className="muted" style={{ marginTop: 6 }}>{message || "数据暂不可读，请稍后重试"}</div>
      {onRetry || (secondaryText && onSecondary) ? (
        <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
          {onRetry ? <button className="btn" onClick={onRetry}>重试</button> : null}
          {secondaryText && onSecondary ? <button className="btn" onClick={onSecondary}>{secondaryText}</button> : null}
        </div>
      ) : null}
      {isDev && technical ? <details style={{ marginTop: 10 }}><summary className="muted">技术详情</summary><pre className="mono" style={{ whiteSpace: "pre-wrap" }}>{technical}</pre></details> : null}
    </div>
  );
}
