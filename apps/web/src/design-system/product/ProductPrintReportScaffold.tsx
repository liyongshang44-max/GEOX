// apps/web/src/design-system/product/ProductPrintReportScaffold.tsx
// Purpose: render the existing print-report structure with locale-owned titles, controls, metadata, and ARIA copy.
// Boundary: this component does not change print layout, responsive behavior, report data, or export execution.

import React from "react";
import { Link } from "react-router-dom";
import { localizedText, useResolvedLocale, type LocalizedCopy } from "../../lib/locale";

type ProductPrintReportScaffoldProps = {
  title: React.ReactNode;
  subtitle: React.ReactNode;
  generatedAt: React.ReactNode;
  backTo: string;
  children: React.ReactNode;
  ariaLabel?: string;
};

const COPY = {
  eyebrow: { zh: "GEOX 报告", en: "GEOX Report" },
  print: { zh: "打印导出", en: "Print Export" },
  back: { zh: "返回页面", en: "Back to Page" },
  generatedAt: { zh: "生成时间", en: "Generated At" },
  reportAria: { zh: "客户报告打印视图", en: "Customer report print view" },
  actionAria: { zh: "打印与返回操作", en: "Print and return actions" },
} as const satisfies Record<string, LocalizedCopy>;

export function ProductPrintReportScaffold({ title, subtitle, generatedAt, backTo, children, ariaLabel }: ProductPrintReportScaffoldProps): React.ReactElement {
  const locale = useResolvedLocale();
  const t = (copy: LocalizedCopy) => localizedText(copy, locale);

  return (
    <div className="customerReportCanvas" data-pfa2-export-locale={locale}>
      <div className="customerReportSheet printPage unifiedPrintReport" role="document" aria-label={ariaLabel ?? t(COPY.reportAria)}>
        <header className="printReportHeader">
          <div>
            <div className="customerEyebrow">{t(COPY.eyebrow)}</div>
            <h1 className="customerTitle">{title}</h1>
            <p className="customerSubtitle">{subtitle}</p>
          </div>
          <div className="printReportActions noPrint" aria-label={t(COPY.actionAria)}>
            <button type="button" className="customerButton" onClick={() => window.print()}>{t(COPY.print)}</button>
            <Link className="customerButton" to={backTo}>{t(COPY.back)}</Link>
          </div>
        </header>
        <section className="customerCard"><strong>{t(COPY.generatedAt)}：</strong>{generatedAt || "--"}</section>
        <section className="printSectionCards">{children}</section>
      </div>
    </div>
  );
}
