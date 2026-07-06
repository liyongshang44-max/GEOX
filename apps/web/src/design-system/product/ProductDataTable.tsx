// apps/web/src/design-system/product/ProductDataTable.tsx
import type { ReactNode } from "react";

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

// Purpose: provide a simple semantic product table without adding a table dependency.
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

  if (rows.length === 0) {
    return <div className="productDataTable__empty">{emptyState ?? "No rows available."}</div>;
  }

  return (
    <div className={classes}>
      {mobileFallbackNote ? <p className="productDataTable__mobileNote">{mobileFallbackNote}</p> : null}
      <div className="productDataTable__overflow" role="region" aria-label="Scrollable data table" tabIndex={0}>
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
