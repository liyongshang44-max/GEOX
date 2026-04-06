import React from "react";

type ZoneKey = "A" | "B" | "C" | "D" | "E" | "F" | "G" | "H";

function DashboardZone({
  zone,
  title,
  description,
  children,
}: {
  zone: ZoneKey;
  title: string;
  description: string;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <section className="dashboardZoneBlock" data-zone={zone}>
      <div className="dashboardZoneHeader">
        <span className="dashboardZoneBadge">{zone} 区</span>
        <div>
          <strong>{title}</strong>
          <div className="muted" style={{ marginTop: 4 }}>{description}</div>
        </div>
      </div>
      {children}
    </section>
  );
}

export default function DashboardPageContainer({
  blocks,
}: {
  blocks: Array<{ zone: ZoneKey; title: string; description: string; content: React.ReactNode }>;
}): React.ReactElement {
  return (
    <div className="dashboardPageContainer">
      {blocks.map((block) => (
        <DashboardZone
          key={block.zone}
          zone={block.zone}
          title={block.title}
          description={block.description}
        >
          {block.content}
        </DashboardZone>
      ))}
    </div>
  );
}
