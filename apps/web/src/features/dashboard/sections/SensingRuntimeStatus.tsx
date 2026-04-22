import React from "react";
import { SectionCard } from "../../../shared/ui";
import { buildDashboardSensingRuntimeVm, type DashboardSensingRuntimeVm } from "../../../viewmodels/dashboardSensingRuntimeVm";

const EMPTY_VM: DashboardSensingRuntimeVm = {
  activeSensingDeviceSkillCount: 0,
  simulatorCarrierSkillCount: 0,
  physicalCarrierSkillCount: 0,
  latestTelemetryTsMs: null,
  hasFormalSensingInput: false,
};

function formatTime(value: number | null): string {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("zh-CN", { hour12: false });
}

export default function SensingRuntimeStatus(): React.ReactElement {
  const [vm, setVm] = React.useState<DashboardSensingRuntimeVm>(EMPTY_VM);

  React.useEffect(() => {
    let mounted = true;
    void buildDashboardSensingRuntimeVm().then((next) => {
      if (mounted) setVm(next);
    }).catch(() => {
      if (mounted) setVm(EMPTY_VM);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const items = [
    { key: "active-skill", label: "生效 sensing/device skill 数", value: `${vm.activeSensingDeviceSkillCount}` },
    { key: "sim-skill", label: "simulator 承载 skill 数", value: `${vm.simulatorCarrierSkillCount}` },
    { key: "physical-skill", label: "真实设备承载 skill 数", value: `${vm.physicalCarrierSkillCount}` },
    { key: "telemetry", label: "最近 telemetry 时间", value: formatTime(vm.latestTelemetryTsMs) },
    { key: "formal", label: "是否具备正式感知输入", value: vm.hasFormalSensingInput ? "是" : "否" },
  ];

  return (
    <SectionCard title="感知运行状态 / 当前 Skill 运行状态" subtitle="聚合 skill 绑定、simulator 与设备状态，统一输出感知运行态摘要。">
      <div className="decisionList" style={{ marginTop: 8 }}>
        {items.map((item) => (
          <div key={item.key} className="decisionItemStatic">
            <div className="decisionItemTitle">{item.label}</div>
            <div className="decisionItemMeta" style={{ marginTop: 4 }}>{item.value}</div>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}
