import { useEffect, useState } from "react";
import type { SchemaTable } from "../types";
import { fetchSchema } from "../api";

interface Props {
  onTableClick: (fullName: string) => void;
}

export function SchemaPanel({ onTableClick }: Props) {
  const [tables, setTables] = useState<SchemaTable[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSchema()
      .then(setTables)
      .catch(() => setTables([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="schema-panel">Cargando schema...</div>;

  const grouped = tables.reduce<Record<string, SchemaTable[]>>((acc, t) => {
    (acc[t.schema_name] ??= []).push(t);
    return acc;
  }, {});

  return (
    <div className="schema-panel">
      <h3>Tablas</h3>
      {Object.entries(grouped).map(([schema, items]) => (
        <div key={schema} className="schema-group">
          <h4>{schema}</h4>
          <ul>
            {items.map((t) => (
              <li
                key={`${t.schema_name}.${t.table_name}`}
                onClick={() => onTableClick(`${t.schema_name}.${t.table_name}`)}
                className={t.table_type === "view" ? "is-view" : ""}
              >
                <span className="table-icon">{t.table_type === "view" ? "V" : "T"}</span>
                {t.table_name}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
