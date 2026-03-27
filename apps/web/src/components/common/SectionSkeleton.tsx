import React from "react";

export default function SectionSkeleton({ kind = "list" }: { kind?: "metric" | "list" | "detail" }): React.ReactElement {
  const text = kind === "metric" ? "指标加载中…" : kind === "detail" ? "详情加载中…" : "列表加载中…";
  return <div className="card" style={{ padding: 16 }}><div className="muted">{text}</div></div>;
}
