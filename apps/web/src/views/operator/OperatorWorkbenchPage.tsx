import React from "react";
import OperatorLayout from "../../layouts/OperatorLayout";
import OperatorEmptyState from "../../components/operator/OperatorEmptyState";
import { OPERATOR_PAGE_META } from "./operatorPageMeta";

export default function OperatorWorkbenchPage(): React.ReactElement {
  const meta = OPERATOR_PAGE_META.workbench;
  return (
    <OperatorLayout title={meta.title} lead={meta.lead}>
      <OperatorEmptyState title={meta.emptyTitle} description={meta.emptyDescription} reason="无权限或接口未接入时，运营页只显示正式空态，不回退到客户层。" />
    </OperatorLayout>
  );
}
