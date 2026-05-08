import React from "react";
import OperatorLayout from "../../layouts/OperatorLayout";
import OperatorEmptyState from "../../components/operator/OperatorEmptyState";
import { OPERATOR_PAGE_META } from "./operatorPageMeta";

export default function OperatorEvidencePage(): React.ReactElement {
  const meta = OPERATOR_PAGE_META.evidence;
  return (
    <OperatorLayout title={meta.title} lead={meta.lead}>
      <OperatorEmptyState title={meta.emptyTitle} description={meta.emptyDescription} reason="证据复核将在后续任务接入，当前页面不调用客户层接口。" />
    </OperatorLayout>
  );
}
