// apps/web/src/features/operator/fieldRuntime/FieldRuntimeHealthNonclaimsPanel.tsx
import React from "react";
import { useLocale } from "../../../lib/locale";
import { fieldRuntimeText, type FieldRuntimeCopyKey } from "./fieldRuntimeLocaleCopy";
import { operatorSafeDisplay, OPERATOR_COMMON_COPY } from "../../../lib/productCopy/operatorLocale";
import { type FieldRuntimeHealthViewModel } from "./fieldRuntimeHealthAdapter";

export default function FieldRuntimeHealthNonclaimsPanel({ health }: { health: FieldRuntimeHealthViewModel }): React.ReactElement {
  const { locale } = useLocale();
  const t = (key: FieldRuntimeCopyKey) => fieldRuntimeText(locale, key);
  return <article className="operatorFieldRuntime__panel operatorFieldRuntime__healthNonclaims" data-h62-panel="nonclaims">
    <div className="operatorFieldRuntime__panelHeader"><div><p className="operatorFieldRuntime__eyebrow">{t("healthNonclaims")}</p><h2 className="operatorFieldRuntime__panelTitle">{t("healthNonclaims")}</h2></div><span className="operatorFieldRuntime__panelMeta">claimAllowed=false</span></div>
    <ul className="operatorFieldRuntime__boundaryList">{health.runtimeNonclaims.map((row) => <li key={row.label}>{operatorSafeDisplay(row.label, locale, OPERATOR_COMMON_COPY.reviewOnly)}</li>)}</ul>
  </article>;
}
