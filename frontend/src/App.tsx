import { useState, useCallback } from "react";
import { SqlEditor } from "./components/SqlEditor";
import { ResultsTable } from "./components/ResultsTable";
import { SchemaPanel } from "./components/SchemaPanel";
import { QueryPresets } from "./components/QueryPresets";
import { executeQuery } from "./api";
import type { QueryResponse } from "./types";
import "./App.css";

export default function App() {
  const [result, setResult] = useState<QueryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [editorSql, setEditorSql] = useState<string | null>(null);

  const handleExecute = useCallback(async (sql: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await executeQuery(sql);
      setResult(res);
    } catch (e: unknown) {
      setResult(null);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleTableClick = useCallback((tableName: string) => {
    setEditorSql(`SELECT * FROM ${tableName} LIMIT 50;`);
  }, []);

  const handlePresetSelect = useCallback((sql: string) => {
    setEditorSql(sql);
  }, []);

  return (
    <div className="app">
      <header>
        <h1>TEG SQL Explorer</h1>
        <span className="subtitle">Validacion ETL</span>
      </header>
      <div className="main-layout">
        <aside>
          <SchemaPanel onTableClick={handleTableClick} />
          <QueryPresets onSelect={handlePresetSelect} />
        </aside>
        <main>
          <SqlEditor
            onExecute={handleExecute}
            isLoading={isLoading}
            externalSql={editorSql}
            onExternalSqlConsumed={() => setEditorSql(null)}
          />
          <ResultsTable result={result} error={error} />
        </main>
      </div>
    </div>
  );
}
