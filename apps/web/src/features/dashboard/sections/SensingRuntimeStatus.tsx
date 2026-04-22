import React from "react";
import { SectionCard } from "../../../shared/ui";
import { buildDashboardSensingRuntimeVm, type DashboardSensingRuntimeVm } from "../../../viewmodels/dashboardSensingRuntimeVm";

const EMPTY_VM: DashboardSensingRuntimeVm = {
  activeSensingDeviceSkillCount: 0,
  simulatorCarrierSkillCount: 0,
  physicalCarrierSkillCount: 0,
  latestTelemetryTsMs: null,
  hasFormalSensingInput: false,
  effectiveSensingSkillsLabel: "0",
  simulatorBackedSkillsLabel: "0",
  physicalBackedSkillsLabel: "0",
  latestSensingTimeLabel: "-",
  formalSensingInputLabel: "否",
  sourceSummaryLabel: "当前尚未识别稳定感知来源",
};

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
    { key: "active-skill", label: "生效感知技能数", value: vm.effectiveSensingSkillsLabel },
    { key: "sim-skill", label: "模拟承载技能数", value: vm.simulatorBackedSkillsLabel },
    { key: "physical-skill", label: "真实设备承载技能数", value: vm.physicalBackedSkillsLabel },
    { key: "telemetry", label: "最近感知时间", value: vm.latestSensingTimeLabel },
    { key: "formal", label: "是否具备有效感知输入", value: vm.formalSensingInputLabel },
  ];

  return (
    <SectionCard title="感知运行状态" subtitle="面向产品展示当前感知能力与输入有效性。">
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
