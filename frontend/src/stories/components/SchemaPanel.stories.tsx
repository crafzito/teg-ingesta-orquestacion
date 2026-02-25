import { useEffect, useMemo, useRef } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { SchemaPanel } from "../../components/SchemaPanel";
import type { SchemaTable } from "../../types";

const sampleSchema: SchemaTable[] = [
  { schema_name: "cat", table_name: "canal", table_type: "table" },
  { schema_name: "dim", table_name: "cliente", table_type: "table" },
  { schema_name: "dim", table_name: "producto", table_type: "table" },
  { schema_name: "fact", table_name: "ventas", table_type: "table" },
  { schema_name: "fact", table_name: "v_ventas_full", table_type: "view" },
  { schema_name: "etl", table_name: "estado", table_type: "view" },
];

type MockMode = "ok" | "empty" | "error" | "slow";

function buildMockFetch(mode: MockMode): typeof fetch {
  return (async (_input: RequestInfo | URL, _init?: RequestInit) => {
    if (mode === "slow") {
      await new Promise((resolve) => setTimeout(resolve, 700));
    }

    if (mode === "error") {
      return new Response(JSON.stringify({ detail: "Schema no disponible" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    const responseData = mode === "empty" ? [] : sampleSchema;
    return new Response(JSON.stringify(responseData), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;
}

function SchemaPanelHarness({
  mode,
  onTableClick,
}: {
  mode: MockMode;
  onTableClick: (fullName: string) => void;
}) {
  const mockFetch = useMemo(() => buildMockFetch(mode), [mode]);
  const originalFetchRef = useRef<typeof fetch | null>(null);

  // Instala el mock antes de que el child dispare useEffect.
  if (originalFetchRef.current === null) {
    originalFetchRef.current = globalThis.fetch;
    globalThis.fetch = mockFetch;
  } else {
    globalThis.fetch = mockFetch;
  }

  useEffect(() => {
    return () => {
      if (originalFetchRef.current) {
        globalThis.fetch = originalFetchRef.current;
      }
    };
  }, []);

  return <SchemaPanel onTableClick={onTableClick} />;
}

const meta = {
  title: "02. Componentes/SchemaPanel",
  component: SchemaPanel,
  parameters: {
    layout: "padded",
  },
  tags: ["autodocs"],
  args: {
    onTableClick: fn(),
  },
} satisfies Meta<typeof SchemaPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Cargado: Story = {
  render: (args) => <SchemaPanelHarness mode="ok" onTableClick={args.onTableClick} />,
};

export const SinTablas: Story = {
  render: (args) => <SchemaPanelHarness mode="empty" onTableClick={args.onTableClick} />,
};

export const Cargando: Story = {
  render: (args) => <SchemaPanelHarness mode="slow" onTableClick={args.onTableClick} />,
};

export const ErrorApi: Story = {
  render: (args) => <SchemaPanelHarness mode="error" onTableClick={args.onTableClick} />,
};
