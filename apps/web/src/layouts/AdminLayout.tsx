import React from "react";
import AppShell from "../app/AppShell";
import { type TopBarProps } from "../app/TopBar";

type AdminLayoutProps = {
  topBar: TopBarProps;
  children: React.ReactNode;
};

export default function AdminLayout({ topBar, children }: AdminLayoutProps): React.ReactElement {
  return <AppShell topBar={topBar}>{children}</AppShell>;
}
