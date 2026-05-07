import React from "react";

export type CustomerSectionCardVm = {
  title: string;
  subtitle?: string;
  tone?: "default" | "alert" | "success";
};

export default function CustomerSectionCard({ vm, children }: { vm: CustomerSectionCardVm; children: React.ReactNode }): React.ReactElement {
  const toneClass = vm.tone === "alert" ? " customerCardAlert" : vm.tone === "success" ? " customerCardSuccess" : "";

  return (
    <section className={`customerCard${toneClass}`}>
      <h3 className="customerCardTitle">{vm.title}</h3>
      {vm.subtitle ? <p className="customerMetricLabel">{vm.subtitle}</p> : null}
      <div className="customerSpacingTopSm">{children}</div>
    </section>
  );
}
