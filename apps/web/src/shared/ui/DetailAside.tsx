import React from "react";

export default function DetailAside({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <aside className="card uiDetailAside">
      <div className="uiDetailAsideTitle">{title}</div>
      <div className="uiDetailAsideBody">{children}</div>
    </aside>
  );
}
