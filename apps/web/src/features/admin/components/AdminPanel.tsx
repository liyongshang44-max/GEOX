import type { ReactNode } from "react";

export default function AdminPanel({ title, children }: { title: string; children: ReactNode }): React.ReactElement {
  return <section className="adminPanel"><h2>{title}</h2>{children}</section>;
}
