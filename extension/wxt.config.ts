import { defineConfig } from "wxt";
import { config as loadDotenv } from "dotenv";

// Load .env.local with override:true so file values always win over any
// stale shell exports (dotenv's default is no-override, which causes the
// Vite define to receive "" when the var is exported-but-empty in the shell).
loadDotenv({ path: ".env.local", override: true });
loadDotenv({ path: ".env", override: false });

export default defineConfig({
  extensionApi: "chrome",
  // No leading dot: Finder hides dot-directories by default, and this is
  // the folder you actually browse to grab built zips.
  outDir: "output",
  modules: ["@wxt-dev/module-react"],
  manifest: {
    name: "Video Knowledge Panel",
    description:
      "Summarize any YouTube video and chat with it — key topics, timestamps, and a blog post, one click away.",
    permissions: ["sidePanel", "storage", "identity"],
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
      WXT_GOOGLE_OAUTH_CLIENT_ID: JSON.stringify(
        process.env.WXT_GOOGLE_OAUTH_CLIENT_ID ?? ""
      ),
    },
  }),
});
