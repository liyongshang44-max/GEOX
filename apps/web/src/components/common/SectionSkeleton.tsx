import React from "react";

export default function SectionSkeleton(): React.ReactElement {
  return <div className="card" style={{ padding: 16 }}><div className="muted">加载中…</div></div>;
}
