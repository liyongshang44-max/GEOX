import React from "react";

type CustomerLayoutProps = {
  children: React.ReactNode;
};

export default function CustomerLayout({ children }: CustomerLayoutProps): React.ReactElement {
  return (
    <div className="customerLayout" data-layout="customer">
      <main className="customerLayoutMain">{children}</main>
    </div>
  );
}
