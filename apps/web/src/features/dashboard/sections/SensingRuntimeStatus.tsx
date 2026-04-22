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

  const sensingSourceSummary = (() => {
    if (vm.simulatorCarrierSkillCount > 0 && vm.physicalCarrierSkillCount > 0) return "当前真实设备与模拟承载同时提供输入";
    if (vm.simulatorCarrierSkillCount > 0) return "当前主要由模拟承载提供感知输入";
    if (vm.physicalCarrierSkillCount > 0) return "当前主要由真实设备提供感知输入";
    return "当前尚未识别稳定感知来源";
  })();

  const items = [
    { key: "active-skill", label: "生效感知技能数", value: `${vm.activeSensingDeviceSkillCount}` },
    { key: "sim-skill", label: "模拟承载技能数", value: `${vm.simulatorCarrierSkillCount}` },
    { key: "physical-skill", label: "真实设备承载技能数", value: `${vm.physicalCarrierSkillCount}` },
    { key: "telemetry", label: "最近遥测时间", value: formatTime(vm.latestTelemetryTsMs) },
    { key: "formal", label: "是否具备有效感知输入", value: vm.hasFormalSensingInput ? "是" : "否" },
    { key: "source-summary", label: "感知来源摘要", value: sensingSourceSummary },
  ];

  return (
    <SectionCard title="感知运行状态" subtitle="聚合技能绑定、模拟承载与设备状态，统一展示当前有效感知输入情况。">
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
