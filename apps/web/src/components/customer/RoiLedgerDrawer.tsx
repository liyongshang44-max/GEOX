import React from "react";
import { fetchCustomerRoiLedger } from "../../api/customerRoiLedger";
import { buildCustomerRoiLedgerVm, type CustomerRoiLedgerVm } from "../../viewmodels/customerRoiLedgerVm";
import "../../styles/customerDrawer.css";

type RoiLedgerDrawerProps = {
  open: boolean;
  fieldId?: unknown;
  operationId?: unknown;
  embeddedRoi?: unknown;
  onClose: () => void;
};

export default function RoiLedgerDrawer({ open, fieldId, operationId, embeddedRoi, onClose }: RoiLedgerDrawerProps): React.ReactElement | null {
  const [loading, setLoading] = React.useState(false);
  const [vm, setVm] = React.useState<CustomerRoiLedgerVm | null>(null);

  React.useEffect(() => {
    if (!open) return;
    let alive = true;
    setLoading(true);
    void fetchCustomerRoiLedger({ fieldId, operationId, embeddedRoi })
      .then((response) => {
        if (!alive) return;
        setVm(buildCustomerRoiLedgerVm(response));
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [open, fieldId, operationId, embeddedRoi]);

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
      <aside className="customerDrawer" role="dialog" aria-modal="true" aria-labelledby="roi-ledger-drawer-title" onClick={(event) => event.stopPropagation()}>
        <header className="customerDrawerHeader">
          <div>
            <div className="customerEyebrow">GEOX / 只读价值记录</div>
            <h2 id="roi-ledger-drawer-title">{vm?.title ?? "价值记录明细"}</h2>
            <p>{loading ? "正在加载价值记录。" : (vm?.subtitle ?? "价值记录状态待确认")}</p>
          </div>
          <button type="button" className="customerDrawerClose" aria-label="关闭价值记录明细" onClick={onClose}>×</button>
        </header>

        <div className="customerDrawerBody">
          {loading ? <div className="customerCard">价值记录加载中...</div> : null}
          {!loading && vm ? (
            <>
              <div className="customerDrawerMeta">
                <span>{vm.statusText}</span>
                <span>更新时间：{vm.generatedAtText}</span>
              </div>
              {vm.rows.length ? (
                <div className="customerRoiRows">
                  {vm.rows.map((row) => (
                    <article key={`${row.title}-${row.valueText}-${row.generatedAtText}`} className="customerRoiRow">
                      <div className="customerRoiRowHead">
                        <strong>{row.title}</strong>
                        <span>{row.natureText}</span>
                      </div>
                      <div className="customerRoiValue">{row.valueText}</div>
                      <div className="customerDrawerRows customerSpacingTopXs">
                        <div className="customerDrawerRow"><span>计算方法</span><strong>{row.methodText}</strong></div>
                        <div className="customerDrawerRow"><span>证据说明</span><strong>{row.evidenceText}</strong></div>
                        <div className="customerDrawerRow"><span>可信度</span><strong>{row.confidenceText}</strong></div>
                        <div className="customerDrawerRow"><span>生成时间</span><strong>{row.generatedAtText}</strong></div>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="customerDrawerEmpty">
                  <strong>{vm.emptyTitle}</strong>
                  <p>{vm.emptyDescription}</p>
                  <small>缺少 baseline、证据说明或可信度时，不展示“实测收益”。</small>
                </div>
              )}
            </>
          ) : null}
        </div>
      </aside>
    </div>
  );
}
