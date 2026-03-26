import React from "react";

export function CopyButton({ value, label = "复制 ID" }: { value: string; label?: string }): React.ReactElement {
  const [done, setDone] = React.useState(false);
  return (
    <button
      type="button"
      className="btn"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value || "");
          setDone(true);
          setTimeout(() => setDone(false), 1200);
        } catch {
          setDone(false);
        }
      }}
    >
      {done ? "已复制" : label}
    </button>
  );
}
