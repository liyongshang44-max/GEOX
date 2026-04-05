import React from "react";
import { NavLink } from "react-router-dom";

export type AppBreadcrumbItem = {
  label: string;
  to?: string;
};

export default function AppBreadcrumb({ items }: { items: AppBreadcrumbItem[] }): React.ReactElement {
  return (
    <div className="breadcrumbBar">
      {items.map((crumb, index) => (
        <React.Fragment key={`${crumb.label}_${index}`}>
          {crumb.to ? <NavLink className="breadcrumbLink" to={crumb.to}>{crumb.label}</NavLink> : <span className="breadcrumbCurrent">{crumb.label}</span>}
          {index < items.length - 1 ? <span className="breadcrumbSep">/</span> : null}
        </React.Fragment>
      ))}
    </div>
  );
}
