import { useState, useCallback, useEffect } from "react";

interface Props {
  onExecute: (sql: string) => void;
  isLoading: boolean;
  externalSql: string | null;
  onExternalSqlConsumed: () => void;
}

const DEFAULT_QUERY = "SELECT * FROM core.vw_ventas_filtros LIMIT 50;";

export function SqlEditor({
  onExecute,
  isLoading,
  externalSql,
  onExternalSqlConsumed,
}: Props) {
  const [sql, setSql] = useState(DEFAULT_QUERY);

  useEffect(() => {
    if (externalSql != null) {
      setSql(externalSql);
      onExternalSqlConsumed();
    }
  }, [externalSql, onExternalSqlConsumed]);

  const handleExecute = useCallback(() => {
    const trimmed = sql.trim();
    if (trimmed) onExecute(trimmed);
  }, [sql, onExecute]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        handleExecute();
      }
    },
    [handleExecute]
  );

  return (
    <div className="sql-editor">
      <textarea
        value={sql}
        onChange={(e) => setSql(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Escribe tu consulta SQL..."
        rows={8}
        spellCheck={false}
      />
      <div className="editor-toolbar">
        <button onClick={handleExecute} disabled={isLoading || !sql.trim()}>
          {isLoading ? "Ejecutando..." : "Ejecutar (Ctrl+Enter)"}
        </button>
        <span className="hint">Solo lectura: SELECT, WITH, EXPLAIN</span>
      </div>
    </div>
  );
}
