// apps/web/src/views/OperationReportExportPage.tsx
import React from "react";
import CustomerReportExportPage from "./CustomerReportExportPage";
import { localizedText, useLocale } from "../lib/locale";

const COPY = {
  exportPrint: { zh: "作业报告打印版", en: "Operation Report print view" }
};

export default function OperationReportExportPage(): React.ReactElement {
  const { locale } = useLocale();
  localizedText(COPY.exportPrint, locale);
  return <CustomerReportExportPage />;
}
