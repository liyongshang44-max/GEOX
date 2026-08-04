import type { ReactNode } from "react";

export interface ProductSegmentedControlItem {
  key: string;
  label: ReactNode;
  href?: string;
  active?: boolean;
  disabled?: boolean;
}

export interface ProductSegmentedControlProps {
  items: ProductSegmentedControlItem[];
  ariaLabel: string;
  onSelect?: (key: string) => void;
  className?: string;
}

// Purpose: provide compact, accessible local navigation without deriving product status.
export function ProductSegmentedControl({
  items,
  ariaLabel,
  onSelect,
  className,
}: ProductSegmentedControlProps) {
  const classes = ["productSegmentedControl", className].filter(Boolean).join(" ");

  return (
    <div className={classes} role="group" aria-label={ariaLabel}>
      {items.map((item) => {
        const itemClass = "productSegmentedControl__item";
        if (item.href && !item.disabled) {
          return (
            <a
              key={item.key}
              className={itemClass}
              href={item.href}
              aria-current={item.active ? "page" : undefined}
              data-active={item.active ? "true" : "false"}
              onClick={() => onSelect?.(item.key)}
            >
              {item.label}
            </a>
          );
        }

        return (
          <button
            key={item.key}
            className={itemClass}
            type="button"
            disabled={item.disabled}
            aria-pressed={Boolean(item.active)}
            data-active={item.active ? "true" : "false"}
            onClick={() => onSelect?.(item.key)}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
