import { useQuery } from "@tanstack/react-query";
import { fetchFields, type FieldListItem } from "../api/fields";
import { toUserErrorMessage } from "../shared/query/errors";
import { queryKeys } from "../shared/query/keys";

export function useFields(): {
  fields: FieldListItem[];
  status: string;
  busy: boolean;
  refresh: () => Promise<void>;
} {
  const query = useQuery<FieldListItem[]>({
    queryKey: queryKeys.fields.list(),
    queryFn: fetchFields,
  });

  const fields = query.data ?? [];
  const busy = query.isLoading || query.isFetching;

  const status = query.isLoading
    ? "正在同步田块列表..."
    : query.isError
      ? `读取失败：${toUserErrorMessage(query.error, "田块列表加载失败，请稍后重试。")}`
      : `已加载 ${fields.length} 个田块。`;

  const refresh = async (): Promise<void> => {
    await query.refetch();
  };

  return { fields, status, busy, refresh };
}
