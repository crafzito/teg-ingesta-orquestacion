import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { SqlEditor } from "../../components/SqlEditor";

const meta = {
  title: "02. Componentes/SqlEditor",
  component: SqlEditor,
  parameters: {
    layout: "padded",
  },
  tags: ["autodocs"],
  args: {
    onExecute: fn(),
    isLoading: false,
    externalSql: null,
    onExternalSqlConsumed: fn(),
  },
} satisfies Meta<typeof SqlEditor>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Loading: Story = {
  args: {
    isLoading: true,
  },
};

export const ConConsultaExterna: Story = {
  args: {
    externalSql: "SELECT * FROM fact.ventas LIMIT 20;",
  },
};
