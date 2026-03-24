import React from "react";
import { fetchFields, type FieldListItem } from "../api/fields";

export function useFields(): {
  fields: FieldListItem[];
  status: string;
  busy: boolean;
  refresh: () => Promise<void>;
} {
  const [fields, setFields] = React.useState<FieldListItem[]>([]);
  const [status, setStatus] = React.useState<string>("");
  const [busy, setBusy] = React.useState<boolean>(false);

  const refresh = React.useCallback(async () => {
    setBusy(true);
    setStatus("正在同步田块列表...");
    try {
      const nextFields = await fetchFields();
      setFields(nextFields);
      setStatus(`已加载 ${nextFields.length} 个田块。`);
    } catch (e: any) {
      setStatus(`读取失败：${e?.message || String(e)}`);
    } finally {
      setBusy(false);
    }
  }, []);

  React.useEffect(() => { void refresh(); }, [refresh]);

  return { fields, status, busy, refresh };
}
