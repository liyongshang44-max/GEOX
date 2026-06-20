export default function AdminTable({ headers, rows }: { headers: string[]; rows: string[][] }): React.ReactElement {
  return <table className="adminTable"><thead><tr>{headers.map((h) => <th key={h}>{h}</th>)}</tr></thead><tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={`${i}-${j}`}>{c}</td>)}</tr>)}</tbody></table>;
}
