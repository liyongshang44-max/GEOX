import React from "react";
import { useLocation } from "react-router-dom";
import SideNav from "./SideNav";
import TopBar, { type TopBarProps } from "./TopBar";

type AppShellProps = {
  topBar: TopBarProps;
  children: React.ReactNode;
};

export default function AppShell({ topBar, children }: AppShellProps): React.ReactElement {
  const location = useLocation();
  if (location.pathname.startsWith("/operator")) {
    return <>{children}</>;
  }

  return (
    <div className="newAppShell">
      <SideNav />
      <main className="newAppMain">
        <TopBar {...topBar} />
        <div className="newAppContent">{children}</div>
      </main>
    </div>
  );
}
