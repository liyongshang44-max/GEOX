// apps/web/src/design-system/product/ProductMetricTile.tsx
import type { ReactNode } from "react";

export interface ProductMetricTileProps {
  label: ReactNode;
  value: ReactNode;
  unit?: ReactNode;
  description?: ReactNode;
  status?: ReactNode;
  source?: ReactNode;
  className?: string;
}

// Purpose: render a metric with source context while avoiding default interpretation or action wording.
export function ProductMetricTile({ label, value, unit, description, status, source, className }: ProductMetricTileProps) {
  const classes = ["productMetricTile", className].filter(Boolean).join(" ");

  return (
    <article className={classes}>
      <div className="productMetricTile__header">
        <span className="productMetricTile__label">{label}</span>
        {status ? <span className="productMetricTile__status">{status}</span> : null}
      </div>
      <div className="productMetricTile__valueLine">
        <strong className="productMetricTile__value">{value}</strong>
        {unit ? <span className="productMetricTile__unit">{unit}</span> : null}
      </div>
      {description ? <p className="productMetricTile__description">{description}</p> : null}
      {source ? <div className="productMetricTile__source">{source}</div> : null}
    </article>
  );
}
