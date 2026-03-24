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

          const normalizedId = id.replace(/\\/g, "/");

          if (normalizedId.includes("/node_modules/firebase/")) return "firebase";
          if (normalizedId.includes("/node_modules/@tanstack/")) return "tanstack";
          if (normalizedId.includes("/node_modules/recharts/")) return "charts";
          if (
            normalizedId.includes("/node_modules/@radix-ui/")
            || normalizedId.includes("/node_modules/lucide-react/")
            || normalizedId.includes("/node_modules/vaul/")
          ) {
            return "ui-vendor";
          }
          if (
            normalizedId.includes("/node_modules/react/")
            || normalizedId.includes("/node_modules/react-dom/")
            || normalizedId.includes("/node_modules/scheduler/")
          ) {
            return "react-vendor";
          }

          return "vendor";
        },
      },
    },
  },
}));
