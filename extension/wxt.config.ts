import { defineConfig } from "wxt";

export default defineConfig({
  extensionApi: "chrome",
  modules: ["@wxt-dev/module-react"],
  manifest: {
    name: "Video Knowledge Panel",
    description:
      "Displays a structured knowledge panel alongside YouTube videos",
    permissions: ["sidePanel", "storage", "scripting", "activeTab"],
    side_panel: {
      default_path: "sidepanel.html",
    },
    action: {},
  },
  vite: () => ({
    define: {
      WXT_AZURE_FUNCTION_URL: JSON.stringify(
        process.env.WXT_AZURE_FUNCTION_URL ?? ""
      ),
      WXT_AZURE_FUNCTION_KEY: JSON.stringify(
        process.env.WXT_AZURE_FUNCTION_KEY ?? ""
      ),
    },
  }),
});
