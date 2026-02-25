import type { Meta, StoryObj } from "@storybook/react-vite";
import { ResultsTable } from "../../components/ResultsTable";
import type { QueryResponse } from "../../types";

const sampleResult: QueryResponse = {
  columns: ["fecha_doc", "num_factura", "cod_cliente", "importe_final"],
  rows: [
    ["2026-02-01", "0192670688", "00014567", 1540.55],
    ["2026-02-01", "0192670689", "00014567", null],
    ["2026-02-02", "0192670690", "00021987", 382.0],
  ],
  row_count: 3,
  execution_time_ms: 42.31,
  truncated: false,
};

const meta = {
  title: "02. Componentes/ResultsTable",
  component: ResultsTable,
  parameters: {
    layout: "fullscreen",
  },
  tags: ["autodocs"],
  args: {
    result: null,
    error: null,
  },
} satisfies Meta<typeof ResultsTable>;

export default meta;
type Story = StoryObj<typeof meta>;

export const EstadoVacio: Story = {};

export const EstadoError: Story = {
  args: {
    error: "Solo se permiten SELECT, WITH y EXPLAIN",
  },
};

export const ConResultados: Story = {
  args: {
    result: sampleResult,
  },
};

export const ResultadosTruncados: Story = {
  args: {
    result: {
      ...sampleResult,
      row_count: 1000,
      truncated: true,
    },
  },
};
