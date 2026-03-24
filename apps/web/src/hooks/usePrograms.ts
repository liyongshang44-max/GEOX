import React from "react";
import { fetchPrograms } from "../api";

export function usePrograms(params?: Record<string, unknown>): { items: any[]; loading: boolean } {
  const [items, setItems] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState<boolean>(true);

  React.useEffect(() => {
    let alive = true;
    setLoading(true);
    fetchPrograms(params).then((next) => {
      if (!alive) return;
      setItems(next);
    }).finally(() => {
      if (alive) setLoading(false);
    });
    return () => { alive = false; };
  }, [JSON.stringify(params ?? {})]);

  return { items, loading };
}
