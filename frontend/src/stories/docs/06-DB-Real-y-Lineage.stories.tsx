import { useEffect, useMemo, useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  fetchInputFiles,
  fetchLineageSources,
  fetchLogicalRelations,
  fetchSchemaColumns,
  fetchSchemaRelations,
} from "../../api";
import type {
  InputFilesResponse,
  LineageSource,
  LogicalRelation,
  SchemaColumn,
  SchemaRelation,
} from "../../types";

interface LivePanelProps {
  apiBaseUrl: string;
  maxColumns: number;
}

function DbRealLineagePanel({ apiBaseUrl, maxColumns }: LivePanelProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [columns, setColumns] = useState<SchemaColumn[]>([]);
  const [relations, setRelations] = useState<SchemaRelation[]>([]);
  const [sources, setSources] = useState<LineageSource[]>([]);
  const [logicalRelations, setLogicalRelations] = useState<LogicalRelation[]>([]);
  const [inputFiles, setInputFiles] = useState<InputFilesResponse>({
    total_files: 0,
    all_files: [],
    csv_count: 0,
    csv_files: [],
    non_csv_count: 0,
    non_csv_files: [],
  });

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([
      fetchSchemaColumns("cat,dim,fact,raw,etl", undefined, apiBaseUrl),
      fetchSchemaRelations("cat,dim,fact,raw,etl", apiBaseUrl),
      fetchLineageSources(apiBaseUrl),
      fetchLogicalRelations(apiBaseUrl),
      fetchInputFiles(apiBaseUrl),
    ])
      .then(([dbColumns, dbRelations, sourceRows, relationRows, input]) => {
        if (cancelled) return;
        setColumns(dbColumns);
        setRelations(dbRelations);
        setSources(sourceRows);
        setLogicalRelations(relationRows);
        setInputFiles(input);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [apiBaseUrl]);

  const topColumns = useMemo(() => columns.slice(0, maxColumns), [columns, maxColumns]);

  const sourcesByRole = useMemo(() => {
    const counter = new Map<string, number>();
    for (const row of sources) {
      counter.set(row.role, (counter.get(row.role) ?? 0) + 1);
    }
    return Array.from(counter.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [sources]);

  if (loading) {
    return <div className="schema-panel">Consultando metadata real de DB y lineage...</div>;
  }

  if (error) {
    return (
      <div className="error-panel">
        No se pudo conectar al backend en <strong>{apiBaseUrl}</strong>: {error}
      </div>
    );
  }

  return (
    <div className="lineage-live" style={{ padding: 16 }}>
      <h2 style={{ marginBottom: 10 }}>DB real y trazabilidad de relaciones</h2>
      <p style={{ marginBottom: 16, color: "var(--text-muted)" }}>
        Esta vista se alimenta con endpoints reales del backend. Si cambian tablas/columnas en
        PostgreSQL, esta página lo refleja.
      </p>

      <div className="lineage-kpis">
        <div className="results-meta">Columnas DB: {columns.length}</div>
        <div className="results-meta">FK físicas: {relations.length}</div>
        <div className="results-meta">Fuentes ETL: {sources.length}</div>
        <div className="results-meta">Relaciones lógicas: {logicalRelations.length}</div>
        <div className="results-meta">
          Archivos totales input (incluye .gitkeep): {inputFiles.total_files}
        </div>
        <div className="results-meta">
          CSV procesables (.csv/.CSV): {inputFiles.csv_count}
        </div>
        <div className="results-meta">No CSV (.gitkeep, etc): {inputFiles.non_csv_count}</div>
      </div>

      <h3 style={{ marginTop: 18, marginBottom: 8 }}>A) Qué archivos entran al ETL y a dónde van</h3>
      <div className="table-wrapper" style={{ maxHeight: 280 }}>
        <table>
          <thead>
            <tr>
              <th>source_key</th>
              <th>archivo</th>
              <th>destino</th>
              <th>rol</th>
              <th>pk_cols</th>
              <th>upsert_mode</th>
            </tr>
          </thead>
          <tbody>
            {sources.map((s) => (
              <tr key={s.source_key}>
                <td>{s.source_key}</td>
                <td>{s.file_name}</td>
                <td>
                  {s.target_schema}.{s.target_table}
                </td>
                <td>{s.role}</td>
                <td title={s.pk_cols.join(", ")}>{s.pk_cols.join(", ") || "-"}</td>
                <td>{s.upsert_mode}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3 style={{ marginTop: 18, marginBottom: 8 }}>
        A.1) Inventario real de carpeta <code>data/input</code>
      </h3>
      <div className="table-wrapper" style={{ maxHeight: 220 }}>
        <table>
          <thead>
            <tr>
              <th>archivo</th>
              <th>tipo</th>
            </tr>
          </thead>
          <tbody>
            {inputFiles.all_files.map((fileName) => {
              const suffix = fileName.split(".").pop()?.toLowerCase();
              const kind = suffix === "csv" ? "csv" : "non-csv";
              return (
                <tr key={fileName}>
                  <td>{fileName}</td>
                  <td>{kind}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <h3 style={{ marginTop: 18, marginBottom: 8 }}>B) Relaciones lógicas (derivadas por ETL + SQL)</h3>
      <div className="table-wrapper" style={{ maxHeight: 260 }}>
        <table>
          <thead>
            <tr>
              <th>origen (archivo.columna)</th>
              <th>destino (tabla.columna)</th>
              <th>confianza</th>
              <th>evidencia</th>
            </tr>
          </thead>
          <tbody>
            {logicalRelations.map((r, i) => (
              <tr key={`${r.source_key}-${i}`}>
                <td>
                  {r.source_key}.{r.source_column}
                </td>
                <td>
                  {r.target_table}.{r.target_column}
                </td>
                <td>{r.confidence}</td>
                <td title={r.evidence}>{r.evidence}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3 style={{ marginTop: 18, marginBottom: 8 }}>C) Columnas reales (information_schema)</h3>
      <div className="table-wrapper" style={{ maxHeight: 340 }}>
        <table>
          <thead>
            <tr>
              <th>schema</th>
              <th>table</th>
              <th>#</th>
              <th>column</th>
              <th>type</th>
              <th>null</th>
              <th>pk</th>
            </tr>
          </thead>
          <tbody>
            {topColumns.map((c) => (
              <tr key={`${c.schema_name}.${c.table_name}.${c.column_name}`}>
                <td>{c.schema_name}</td>
                <td>{c.table_name}</td>
                <td>{c.ordinal_position}</td>
                <td>{c.column_name}</td>
                <td>{c.data_type}</td>
                <td>{c.is_nullable ? "YES" : "NO"}</td>
                <td>{c.is_primary_key ? "PK" : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p style={{ marginTop: 8, color: "var(--text-muted)" }}>
        Mostrando {topColumns.length} de {columns.length} columnas.
      </p>

      <h3 style={{ marginTop: 18, marginBottom: 8 }}>D) Relaciones físicas (FK reales de PostgreSQL)</h3>
      {relations.length === 0 ? (
        <div className="empty-panel">
          No se detectaron FK físicas en los schemas seleccionados.
          <br />
          Esto suele pasar cuando las relaciones se manejan como \"lógica ETL\" en lugar de
          constraints SQL.
        </div>
      ) : (
        <div className="table-wrapper" style={{ maxHeight: 220 }}>
          <table>
            <thead>
              <tr>
                <th>constraint</th>
                <th>source</th>
                <th>target</th>
              </tr>
            </thead>
            <tbody>
              {relations.map((r) => (
                <tr
                  key={`${r.constraint_name}:${r.source_schema}.${r.source_table}.${r.source_column}`}
                >
                  <td>{r.constraint_name}</td>
                  <td>
                    {r.source_schema}.{r.source_table}.{r.source_column}
                  </td>
                  <td>
                    {r.target_schema}.{r.target_table}.{r.target_column}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h3 style={{ marginTop: 18, marginBottom: 8 }}>E) Distribución por rol</h3>
      <ul style={{ paddingLeft: 18 }}>
        {sourcesByRole.map(([role, count]) => (
          <li key={role}>
            {role}: {count}
          </li>
        ))}
      </ul>
    </div>
  );
}

const meta = {
  title: "01. Documentacion/DB Real y Lineage",
  component: DbRealLineagePanel,
  parameters: {
    layout: "fullscreen",
  },
  args: {
    apiBaseUrl: "http://127.0.0.1:8000",
    maxColumns: 200,
  },
} satisfies Meta<typeof DbRealLineagePanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Live: Story = {};

export const BackendNoDisponible: Story = {
  args: {
    apiBaseUrl: "http://127.0.0.1:65535",
  },
};
