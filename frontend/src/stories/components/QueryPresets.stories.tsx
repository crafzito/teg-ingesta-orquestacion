import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { QueryPresets } from "../../components/QueryPresets";

const meta = {
  title: "02. Componentes/QueryPresets",
  component: QueryPresets,
  parameters: {
    layout: "padded",
  },
  tags: ["autodocs"],
  args: {
    onSelect: fn(),
  },
} satisfies Meta<typeof QueryPresets>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const InteraccionBasica: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: /Conteos Generales/i }));
    await userEvent.click(canvas.getByText("Total filas por tabla"));
    await expect(args.onSelect).toHaveBeenCalledTimes(1);
  },
};
