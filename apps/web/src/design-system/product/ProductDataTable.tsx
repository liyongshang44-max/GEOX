// apps/web/src/design-system/product/ProductDataTable.tsx
// Purpose: provide a bilingual semantic product table without adding a table dependency.
// Boundary: this component owns table semantics and safe empty-state semantics only.

import type { ReactNode } from "react";
import { localizedText, useResolvedLocale } from "../../lib/locale";
import { PRODUCT_PRIMITIVE_COPY } from "../../lib/productCopy/localeContract";
import { ProductEmptyState } from "./ProductEmptyState";

export interface ProductDataTableColumn<Row> {
  key: string;
  header: ReactNode;
  render: (row: Row) => ReactNode;
  width?: string;
}

export interface ProductDataTableProps<Row> {
  caption: ReactNode;
  columns: ProductDataTableColumn<Row>[];
  rows: Row[];
  getRowKey: (row: Row, index: number) => string;
  emptyState?: ReactNode;
  mobileFallbackNote?: ReactNode;
  className?: string;
}

export function ProductDataTable<Row>({
  caption,
  columns,
  rows,
  getRowKey,
  emptyState,
  mobileFallbackNote,
  className,
}: ProductDataTableProps<Row>) {
  const locale = useResolvedLocale();
  const classes = ["productDataTable", className].filter(Boolean).join(" ");
  const tableRegionLabel = typeof caption === "string"
    ? locale === "en-US" ? `${caption} table` : `${caption}数据表`
    : localizedText(PRODUCT_PRIMITIVE_COPY.scrollableDataTable, locale);
  const emptyRegionLabel = typeof caption === "string"
    ? locale === "en-US" ? `${caption} empty table state` : `${caption}空表状态`
    : localizedText(PRODUCT_PRIMITIVE_COPY.emptyDataTableState, locale);
  const emptyTitle = typeof caption === "string"
    ? locale === "en-US" ? `No rows for ${caption}.` : `暂无${caption}记录。`
    : localizedText(PRODUCT_PRIMITIVE_COPY.noRowsFallback, locale);

  if (rows.length === 0) {
    return (
      <section className="productDataTable__empty" role="status" aria-label={emptyRegionLabel}>
        {emptyState ?? (
          <ProductEmptyState
            title={emptyTitle}
            description={localizedText(PRODUCT_PRIMITIVE_COPY.noRecordsDescription, locale)}
            ariaLabel={emptyRegionLabel}
          />
        )}
      </section>
    );
  }

  return (
    <div className={classes}>
      {mobileFallbackNote ? <p className="productDataTable__mobileNote">{mobileFallbackNote}</p> : null}
      <div className="productDataTable__overflow" role="region" aria-label={tableRegionLabel} tabIndex={0}>
        <table className="productDataTable__table">
          <caption>{caption}</caption>
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column.key} scope="col" style={column.width ? { width: column.width } : undefined}>
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={getRowKey(row, index)}>
                {columns.map((column) => (
                  <td key={column.key}>{column.render(row)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
