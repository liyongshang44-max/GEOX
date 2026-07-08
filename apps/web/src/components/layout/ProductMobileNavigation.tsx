// apps/web/src/components/layout/ProductMobileNavigation.tsx
// Purpose: provide one accessible compact-navigation disclosure for Customer, Operator, and Admin shells.
// Boundary: route models, permissions, active-state logic, and desktop navigation remain owned by each role layout.

import React from "react";

export interface ProductMobileNavigationProps {
  pathname: string;
  navigationLabel: string;
  openLabel: string;
  closeLabel: string;
  panelLabel: string;
  children: React.ReactNode;
  surface: "customer" | "operator" | "admin";
  className?: string;
}

export default function ProductMobileNavigation({
  pathname,
  navigationLabel,
  openLabel,
  closeLabel,
  panelLabel,
  children,
  surface,
  className,
}: ProductMobileNavigationProps): React.ReactElement {
  const [open, setOpen] = React.useState(false);
  const triggerRef = React.useRef<HTMLButtonElement | null>(null);
  const panelId = React.useId().replace(/:/g, "-") + "-mobile-navigation";
  const previousPathnameRef = React.useRef(pathname);

  const closeAndReturnFocus = React.useCallback(() => {
    setOpen(false);
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  }, []);

  React.useEffect(() => {
    if (previousPathnameRef.current !== pathname) {
      previousPathnameRef.current = pathname;
      if (open) closeAndReturnFocus();
    }
  }, [closeAndReturnFocus, open, pathname]);

  React.useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeAndReturnFocus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [closeAndReturnFocus, open]);

  const classes = ["productMobileNavigation", className].filter(Boolean).join(" ");

  return (
    <section
      className={classes}
      data-mobile-navigation="true"
      data-surface={surface}
      aria-label={navigationLabel}
    >
      <button
        ref={triggerRef}
        type="button"
        className="productMobileNavigation__trigger"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
      >
        <span>{open ? closeLabel : openLabel}</span>
        <span aria-hidden="true">{open ? "−" : "+"}</span>
      </button>
      <div
        id={panelId}
        className="productMobileNavigation__panel"
        aria-label={panelLabel}
        hidden={!open}
        data-mobile-navigation-panel="true"
      >
        {children}
      </div>
    </section>
  );
}
