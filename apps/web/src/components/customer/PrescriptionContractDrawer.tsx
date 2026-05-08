import React from "react";
import { fetchCustomerPrescriptionContract } from "../../api/customerPrescriptions";
import { buildPrescriptionContractVm, type PrescriptionContractVm } from "../../viewmodels/prescriptionContractVm";

type PrescriptionContractDrawerProps = {
  open: boolean;
  prescriptionId?: unknown;
  recommendationId?: unknown;
  onClose: () => void;
};

export default function PrescriptionContractDrawer({ open, prescriptionId, recommendationId, onClose }: PrescriptionContractDrawerProps): React.ReactElement | null {
  const [loading, setLoading] = React.useState(false);
  const [vm, setVm] = React.useState<PrescriptionContractVm | null>(null);

  React.useEffect(() => {
    if (!open) return;
    let alive = true;
    setLoading(true);
    void fetchCustomerPrescriptionContract({ prescriptionId, recommendationId })
      .then((response) => {
        if (!alive) return;
        setVm(buildPrescriptionContractVm(response));
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [open, prescriptionId, recommendationId]);

  React.useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="customerDrawerOverlay" role="presentation" onClick={onClose}>
      <aside className="customerDrawer" role="dialog" aria-modal="true" aria-labelledby="prescription-drawer-title" onClick={(event) => event.stopPropagation()}>
        <header className="customerDrawerHeader">
          <div>
            <div className="customerEyebrow">GEOX / 只读处方</div>
            <h2 id="prescription-drawer-title">{vm?.title ?? "处方详情"}</h2>
            <p>{loading ? "正在加载正式处方。" : (vm?.statusText ?? "处方状态待确认")}</p>
          </div>
          <button type="button" className="customerDrawerClose" aria-label="关闭处方详情" onClick={onClose}>×</button>
        </header>

        <div className="customerDrawerBody">
          {loading ? <div className="customerCard">处方详情加载中...</div> : null}
          {!loading && vm && !vm.isAvailable ? (
            <div className="customerDrawerEmpty">
              <strong>{vm.statusText}</strong>
              <p>{vm.message || "未形成正式处方。"}</p>
              <small>客户层不会从建议记录伪造处方，也不会触发提交审批。</small>
            </div>
          ) : null}
          {!loading && vm?.isAvailable ? (
            <>
              <div className="customerDrawerMeta">
                <span>{vm.statusText}</span>
                <span>更新时间：{vm.generatedAtText}</span>
              </div>
              <div className="customerDrawerRows">
                {vm.rows.map((row) => (
                  <div key={row.label} className="customerDrawerRow">
                    <span>{row.label}</span>
                    <strong>{row.value}</strong>
                  </div>
                ))}
              </div>
            </>
          ) : null}
        </div>
      </aside>
    </div>
  );
}
