import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  base: "/",
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;

          if (id.includes("firebase")) return "firebase";
          if (id.includes("@tanstack")) return "tanstack";
          if (id.includes("recharts")) return "charts";
          if (id.includes("@radix-ui") || id.includes("lucide-react") || id.includes("vaul")) {
            return "ui-vendor";
          }
          if (
            id.includes("react") ||
            id.includes("scheduler") ||
            id.includes("react-router") ||
            id.includes("react-dom")
          ) {
            return "react-vendor";
          }

          return "vendor";
        },
      },
    },
  },
}));
