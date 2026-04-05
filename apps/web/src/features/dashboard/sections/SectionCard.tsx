import React from "react";

export default function SectionCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <section className="card dashboardSectionCard">
      <header className="dashboardSectionHeader">
        <h2 className="dashboardSectionTitle">{title}</h2>
        {subtitle ? <p className="dashboardSectionSubtitle">{subtitle}</p> : null}
      </header>
      {children}
    </section>
  );
}
