import type { ReactNode } from "react";

export interface ProductTechnicalDisclosureItem {
  label: ReactNode;
  value: ReactNode;
  monospace?: boolean;
}

export interface ProductTechnicalDisclosureProps {
  summary: ReactNode;
  description?: ReactNode;
  items: ProductTechnicalDisclosureItem[];
  actions?: ReactNode;
  defaultOpen?: boolean;
  className?: string;
}

// Purpose: keep technical identifiers available without making them the primary product hierarchy.
export function ProductTechnicalDisclosure({
  summary,
  description,
  items,
  actions,
  defaultOpen = false,
  className,
}: ProductTechnicalDisclosureProps) {
  const classes = ["productTechnicalDisclosure", className].filter(Boolean).join(" ");

  return (
    <details className={classes} open={defaultOpen || undefined}>
      <summary className="productTechnicalDisclosure__summary">{summary}</summary>
      <div className="productTechnicalDisclosure__body">
        {description ? <p className="productTechnicalDisclosure__description">{description}</p> : null}
        <dl className="productTechnicalDisclosure__list">
          {items.map((item, index) => (
            <div className="productTechnicalDisclosure__item" key={index}>
              <dt>{item.label}</dt>
              <dd data-monospace={item.monospace ? "true" : "false"}>{item.value}</dd>
            </div>
          ))}
        </dl>
        {actions ? <div className="productTechnicalDisclosure__actions">{actions}</div> : null}
      </div>
    </details>
  );
}
