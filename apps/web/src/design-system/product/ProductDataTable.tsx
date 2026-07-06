// apps/web/src/design-system/product/ProductDataTable.tsx
// Purpose: provide a simple semantic product table without adding a table dependency.
// Boundary: this component owns table semantics and empty-state semantics only.

import type { ReactNode } from "react";
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
  const classes = ["productDataTable", className].filter(Boolean).join(" ");
  const tableRegionLabel = typeof caption === "string" ? `${caption} table` : "Scrollable data table";
  const emptyRegionLabel = typeof caption === "string" ? `${caption} empty table state` : "Empty data table state";
  const emptyTitle = typeof caption === "string" ? `No rows for ${caption}.` : "No rows for this table.";

  if (rows.length === 0) {
    return (
      <section className="productDataTable__empty" role="status" aria-label={emptyRegionLabel}>
        {emptyState ?? <ProductEmptyState title={emptyTitle} description="There are no records to display for this scope." ariaLabel={emptyRegionLabel} />}
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
