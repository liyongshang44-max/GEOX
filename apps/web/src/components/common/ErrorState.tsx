import React from "react";

export default function ErrorState({ title = "加载失败", message, onRetry }: { title?: string; message?: string; onRetry?: () => void }): React.ReactElement {
  return (
    <div className="card" style={{ padding: 14, borderColor: "#fecdca", background: "#fff6f5" }}>
      <div style={{ fontWeight: 700 }}>{title}</div>
      <div className="muted" style={{ marginTop: 6 }}>{message || "数据暂不可读，请稍后重试"}</div>
      {onRetry ? <button className="btn" style={{ marginTop: 10 }} onClick={onRetry}>重试</button> : null}
    </div>
  );
}
