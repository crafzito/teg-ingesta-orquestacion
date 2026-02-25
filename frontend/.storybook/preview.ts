import type { Preview } from "@storybook/react-vite";
import "../src/App.css";
import "../src/stories/storybook-overrides.css";

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    options: {
      storySort: {
        order: [
          "01. Documentacion",
          [
            "Introduccion",
            "Schema de BD",
            "Pipeline ETL",
            "API y Looker",
            "Setup y Puesta en Marcha",
            "DB Real y Lineage",
            "Metodo de Relaciones",
            "Recorrido Cliente",
          ],
          "02. Componentes",
          ["SqlEditor", "ResultsTable", "SchemaPanel", "QueryPresets"],
        ],
      },
    },
    docs: {
      toc: true,
    },
    a11y: {
      // 'todo' - show a11y violations in the test UI only
      // 'error' - fail CI on a11y violations
      // 'off' - skip a11y checks entirely
      test: "todo",
    },
  },
};

export default preview;
