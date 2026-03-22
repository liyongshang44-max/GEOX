import type React from "react";
import type { BadgeTone } from "../viewmodels/programDashboardViewModel";

export function badgeStyle(tone: BadgeTone): React.CSSProperties {
  if (tone === "success") return { background: "#ecfdf3", color: "#067647" };
  if (tone === "warning") return { background: "#fffaeb", color: "#b54708" };
  if (tone === "danger") return { background: "#fef3f2", color: "#b42318" };
  return { background: "#f2f4f7", color: "#344054" };
}
