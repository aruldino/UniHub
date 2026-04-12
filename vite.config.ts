import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Separate chart library into its own chunk
          recharts: ['recharts'],
          // Group UI components
          ui: ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu', '@radix-ui/react-tabs', '@radix-ui/react-toast'],
          // Group Supabase and other large libraries
          vendor: ['@supabase/supabase-js', '@tanstack/react-query'],
        },
      },
    },
    // Increase chunk size warning limit since we've optimized
    chunkSizeWarningLimit: 600,
  },
}));
