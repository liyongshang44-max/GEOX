import React from "react";
import { Link } from "react-router-dom";

type Props = {
  title: string;
  subtitle: string;
  generatedAt: string;
  backTo: string;
  children: React.ReactNode;
};

export default function PrintReportScaffold({ title, subtitle, generatedAt, backTo, children }: Props): React.ReactElement {
  return (
    <div className="customerReportCanvas">
      <div className="customerReportSheet printPage unifiedPrintReport">
        <header className="printReportHeader">
          <div>
            <div className="customerEyebrow">GEOX Report</div>
            <h1 className="customerTitle">{title}</h1>
            <p className="customerSubtitle">{subtitle}</p>
          </div>
          <div className="printReportActions noPrint">
            <button type="button" className="customerButton" onClick={() => window.print()}>打印导出</button>
            <Link className="customerButton" to={backTo}>返回页面</Link>
          </div>
        </header>
        <section className="customerCard"><strong>生成时间：</strong>{generatedAt || "--"}</section>
        <section className="printSectionCards">{children}</section>
      </div>
    </div>
  );
}
