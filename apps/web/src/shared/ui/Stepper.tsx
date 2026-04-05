import React from "react";

export type StepItem = {
  key: string;
  title: string;
  done: boolean;
  active?: boolean;
};

export default function Stepper({ items }: { items: StepItem[] }): React.ReactElement {
  return (
    <ol className="uiStepper">
      {items.map((item) => (
        <li key={item.key} className={`uiStep ${item.done ? "done" : ""} ${item.active ? "active" : ""}`.trim()}>
          <span className="uiStepIndex" />
          <span className="uiStepTitle">{item.title}</span>
        </li>
      ))}
    </ol>
  );
}
