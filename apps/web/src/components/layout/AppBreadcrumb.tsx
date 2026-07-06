// apps/web/src/components/layout/AppBreadcrumb.tsx
import React from "react";
import { NavLink } from "react-router-dom";

export type AppBreadcrumbItem = {
  label: string;
  to?: string;
};

export default function AppBreadcrumb({ items }: { items: AppBreadcrumbItem[] }): React.ReactElement {
  return (
    <nav className="breadcrumbBar" aria-label="Breadcrumb">
      <ol className="breadcrumbList">
        {items.map((crumb, index) => {
          const isCurrent = index === items.length - 1;
          return (
            <li className="breadcrumbItem" key={`${crumb.label}_${index}`}>
              {crumb.to && !isCurrent ? (
                <NavLink className="breadcrumbLink" to={crumb.to}>{crumb.label}</NavLink>
              ) : (
                <span className="breadcrumbCurrent" aria-current="page">{crumb.label}</span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
