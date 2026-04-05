import React from "react";

export default function SectionCard({
  title,
  subtitle,
  children,
  className = "",
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
}): React.ReactElement {
  return (
    <section className={`card uiSectionCard ${className}`.trim()}>
      <header className="uiSectionHeader">
        <h3 className="uiSectionTitle">{title}</h3>
        {subtitle ? <p className="uiSectionSubtitle">{subtitle}</p> : null}
      </header>
      {children}
    </section>
  );
}
