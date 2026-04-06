import React from "react";
import { NavLink } from "react-router-dom";

type MainNavItem = {
  to: string;
  label: string;
};

const MAIN_NAV_ITEMS: MainNavItem[] = [
  { to: "/dashboard", label: "平台控制台" },
  { to: "/fields", label: "田块" },
  { to: "/devices", label: "设备" },
  { to: "/operations", label: "作业" },
  { to: "/programs", label: "经营方案" },
  { to: "/audit-export", label: "证据中心" },
  { to: "/skills/registry", label: "技能" },
];

export default function SideNav(): React.ReactElement {
  return (
    <aside className="newSideNav card">
      <div className="newSideNavBrand">
        <div className="newSideNavMark">G</div>
        <div>
          <div className="newSideNavName">GEOX</div>
          <div className="newSideNavSub">平台控制台</div>
        </div>
      </div>
      <nav className="newSideNavLinks" aria-label="主导航">
        {MAIN_NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/dashboard"}
            className={({ isActive }) => `newSideNavLink ${isActive ? "active" : ""}`}
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
