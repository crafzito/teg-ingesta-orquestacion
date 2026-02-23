import type { QueryResponse } from "../types";

interface Props {
  result: QueryResponse | null;
  error: string | null;
}

export function ResultsTable({ result, error }: Props) {
  if (error) {
    return <div className="error-panel">{error}</div>;
  }

  if (!result) {
    return <div className="empty-panel">Ejecuta una consulta para ver resultados.</div>;
  }

  return (
    <div className="results-panel">
      <div className="results-meta">
        {result.row_count} fila{result.row_count !== 1 ? "s" : ""}
        {result.truncated ? " (truncado)" : ""} en {result.execution_time_ms}ms
      </div>
      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th className="row-num">#</th>
              {result.columns.map((col, i) => (
                <th key={i}>{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {result.rows.map((row, ri) => (
              <tr key={ri}>
                <td className="row-num">{ri + 1}</td>
                {row.map((cell, ci) => (
                  <td key={ci} title={cell != null ? String(cell) : ""}>
                    {cell != null ? String(cell) : <span className="null-val">NULL</span>}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
