import React from "react";

export default function AppShell({
  nav,
  header,
  children,
}: {
  nav: React.ReactNode;
  header: React.ReactNode;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <div className="consoleShell">
      {nav}
      <main className="consoleMain">
        {header}
        <div className="consoleContent">
          {children}
        </div>
      </main>
    </div>
  );
}
