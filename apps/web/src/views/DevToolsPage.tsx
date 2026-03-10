import React from "react";
import { Link } from "react-router-dom";

const TOOLS: Array<{ title: string; desc: string; to: string }> = [
  { title: "Groups", desc: "旧的观测分组首页。", to: "/legacy/groups" },
  { title: "Judge", desc: "Judge 运行页。", to: "/legacy/judge/run" },
  { title: "Judge Records", desc: "Judge 记录页。", to: "/legacy/judge/records" },
  { title: "Judge Config", desc: "Judge 配置页。", to: "/legacy/judge/config" },
  { title: "监测器配置", desc: "模拟配置页。", to: "/legacy/sim/config" },
  { title: "Healthz", desc: "服务健康检查。", to: "/legacy/admin/healthz" },
  { title: "Import", desc: "导入页。", to: "/legacy/admin/import" },
  { title: "Acceptance", desc: "验收触发页。", to: "/legacy/admin/acceptance" },
  { title: "Approvals", desc: "审批请求页。", to: "/legacy/control/approvals" },
];

export default function DevToolsPage(): React.ReactElement {
  return (
    <div className="consolePage">
      <section className="hero card">
        <div>
          <div className="eyebrow">仅研发模式可见</div>
          <h2 className="heroTitle">研发工具</h2>
          <p className="heroText">
            旧页面暂时不删除，集中收纳到这里，作为前端重构期间的 fallback 与调试入口。
          </p>
        </div>
      </section>

      <section className="moduleGrid devGrid">
        {TOOLS.map((tool) => (
          <Link key={tool.to} className="moduleCard" to={tool.to}>
            <div className="moduleTitle">{tool.title}</div>
            <div className="moduleDesc">{tool.desc}</div>
          </Link>
        ))}
      </section>
    </div>
  );
}
