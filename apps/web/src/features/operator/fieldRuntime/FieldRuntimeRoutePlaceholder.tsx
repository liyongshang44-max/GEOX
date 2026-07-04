// apps/web/src/features/operator/fieldRuntime/FieldRuntimeRoutePlaceholder.tsx
// Purpose: render H60-B read-only placeholders for canonical Field Runtime routes.
// Boundary: this component loads no API data and owns no state-changing actions.

import React from "react";
import { useParams } from "react-router-dom";

export type FieldRuntimeRouteTab =
  | "fields"
  | "overview"
  | "evidence"
  | "state"
  | "forecast"
  | "scenario"
  | "residual"
  | "calibration"
  | "health"
  | "audit";

type FieldRuntimeRoutePlaceholderProps = {
  tab: FieldRuntimeRouteTab;
};

type FieldRuntimePlaceholderCopy = {
  title: string;
  route: string;
  phase: string;
  lines: string[];
};

const RUNTIME_NONCLAIMS = [
  "Runtime Mode: Replay-backed Demo",
  "Live Device: Not connected",
  "Production Gateway: Not online",
  "Field Pilot: Not started",
  "AO-ACT Dispatch: Disabled",
];

const ROUTE_OWNERSHIP_LINES = [
  "Read-only Field Runtime",
  "Canonical route family: /operator/fields/*",
  "Legacy route family preserved: /operator/twin/fields/*",
];

const PLACEHOLDER_COPY: Record<FieldRuntimeRouteTab, FieldRuntimePlaceholderCopy> = {
  fields: {
    title: "Field Runtime",
    route: "/operator/fields",
    phase: "H60-B Field Runtime Route Ownership",
    lines: [
      "Field Runtime list route is reserved for H60.",
      "No field list data is loaded in H60-B.",
    ],
  },
  overview: {
    title: "Field Runtime Overview",
    route: "/operator/fields/:fieldId",
    phase: "H60-C/H60-D planned surface",
    lines: [
      "Overview route is reserved for H60-C/H60-D.",
      "This placeholder does not load workspace data.",
    ],
  },
  evidence: {
    title: "Field Runtime Evidence",
    route: "/operator/fields/:fieldId/evidence",
    phase: "H60-E planned surface",
    lines: [
      "Evidence route is reserved for H60-E.",
      "This placeholder does not write facts.",
    ],
  },
  state: {
    title: "Field Runtime State",
    route: "/operator/fields/:fieldId/state",
    phase: "H60-D planned surface",
    lines: [
      "State route is reserved for H60-D.",
      "This placeholder does not generate state estimates.",
    ],
  },
  forecast: {
    title: "Field Runtime Forecast",
    route: "/operator/fields/:fieldId/forecast",
    phase: "H60-F planned surface",
    lines: [
      "Forecast route is reserved for H60-F.",
      "Forecast is not a recommendation.",
      "Forecast does not create task.",
      "Forecast does not imply action.",
    ],
  },
  scenario: {
    title: "Field Runtime Scenario",
    route: "/operator/fields/:fieldId/scenario",
    phase: "H60-G planned surface",
    lines: [
      "Scenario route is reserved for H60-G.",
      "Scenario is a projection, not a task.",
      "Scenario is not a recommendation.",
      "No approval / dispatch / AO-ACT.",
    ],
  },
  residual: {
    title: "Field Runtime Residual",
    route: "/operator/fields/:fieldId/residual",
    phase: "H60-H planned surface",
    lines: [
      "Residual route is reserved for H60-H.",
      "Residual is an accuracy / response review.",
      "Residual is not causal proof.",
      "Residual does not write ROI.",
      "Residual does not write Field Memory.",
    ],
  },
  calibration: {
    title: "Field Runtime Calibration",
    route: "/operator/fields/:fieldId/calibration",
    phase: "H60-I planned surface",
    lines: [
      "Calibration route is reserved for H60-I.",
      "Calibration Review is read-only.",
      "No model update.",
      "No Field Memory write.",
    ],
  },
  health: {
    title: "Field Runtime Health",
    route: "/operator/fields/:fieldId/health",
    phase: "H60-J placeholder before H62",
    lines: [
      "Health route is reserved for H62.",
      "Runtime Health product surface is planned for H62.",
      "This tab does not claim production monitoring.",
    ],
  },
  audit: {
    title: "Field Runtime Audit",
    route: "/operator/fields/:fieldId/audit",
    phase: "H60-K planned surface",
    lines: [
      "Audit route is reserved for H60-K.",
      "Audit can show refs and contracts later, but does not create product conclusions.",
    ],
  },
};

const CARD_STYLE: React.CSSProperties = {
  display: "grid",
  gap: 16,
  padding: 20,
};

const PANEL_STYLE: React.CSSProperties = {
  border: "1px solid #d8e4d1",
  borderRadius: 18,
  background: "#ffffff",
  padding: 18,
};

const CHIP_ROW_STYLE: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
};

const CHIP_STYLE: React.CSSProperties = {
  border: "1px solid #e2e8d8",
  borderRadius: 999,
  padding: "6px 10px",
  background: "#f8faf5",
  fontSize: 12,
  fontWeight: 800,
};

export default function FieldRuntimeRoutePlaceholder({ tab }: FieldRuntimeRoutePlaceholderProps): React.ReactElement {
  const params = useParams();
  const copy = PLACEHOLDER_COPY[tab];
  const fieldId = params.fieldId || "not-selected";

  return (
    <main style={CARD_STYLE} data-h60b="field-runtime-route-placeholder" data-field-runtime-tab={tab}>
      <section style={PANEL_STYLE} aria-label="Field Runtime route ownership">
        <p style={{ margin: 0, fontSize: 12, fontWeight: 900, letterSpacing: 0.08, textTransform: "uppercase" }}>{copy.phase}</p>
        <h1 style={{ margin: "8px 0" }}>Field Runtime</h1>
        <h2 style={{ margin: "0 0 10px" }}>{copy.title}</h2>
        <p style={{ margin: 0 }}>Route: {copy.route}</p>
        <p style={{ margin: "6px 0 0" }}>Field ID: {fieldId}</p>
      </section>

      <section style={PANEL_STYLE} aria-label="Runtime nonclaims">
        <div style={CHIP_ROW_STYLE}>
          {RUNTIME_NONCLAIMS.map((line) => (
            <span key={line} style={CHIP_STYLE}>{line}</span>
          ))}
        </div>
      </section>

      <section style={PANEL_STYLE} aria-label="Read-only boundary">
        <div style={CHIP_ROW_STYLE}>
          {ROUTE_OWNERSHIP_LINES.map((line) => (
            <span key={line} style={CHIP_STYLE}>{line}</span>
          ))}
        </div>
      </section>

      <section style={PANEL_STYLE} aria-label="Planned tab status">
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          {copy.lines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </section>
    </main>
  );
}
