// vite.config.ts
import { defineConfig } from "file:///C:/Users/PerushanShalomiyalAr/OneDrive%20-%20Magick%20Woods%20Exports%20Pvt%20Ltd/Desktop/Aruldino/node_modules/vite/dist/node/index.js";
import react from "file:///C:/Users/PerushanShalomiyalAr/OneDrive%20-%20Magick%20Woods%20Exports%20Pvt%20Ltd/Desktop/Aruldino/node_modules/@vitejs/plugin-react-swc/index.js";
import path from "path";
var __vite_injected_original_dirname = "C:\\Users\\PerushanShalomiyalAr\\OneDrive - Magick Woods Exports Pvt Ltd\\Desktop\\Aruldino";
var vite_config_default = defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false
    }
  },
  plugins: [react()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__vite_injected_original_dirname, "./src")
    }
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Separate chart library into its own chunk
          recharts: ["recharts"],
          // Group UI components
          ui: ["@radix-ui/react-dialog", "@radix-ui/react-dropdown-menu", "@radix-ui/react-tabs", "@radix-ui/react-toast"],
          // Group Supabase and other large libraries
          vendor: ["@supabase/supabase-js", "@tanstack/react-query"]
        }
      }
    },
    // Increase chunk size warning limit since we've optimized
    chunkSizeWarningLimit: 600
  }
}));
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFxQZXJ1c2hhblNoYWxvbWl5YWxBclxcXFxPbmVEcml2ZSAtIE1hZ2ljayBXb29kcyBFeHBvcnRzIFB2dCBMdGRcXFxcRGVza3RvcFxcXFxBcnVsZGlub1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiQzpcXFxcVXNlcnNcXFxcUGVydXNoYW5TaGFsb21peWFsQXJcXFxcT25lRHJpdmUgLSBNYWdpY2sgV29vZHMgRXhwb3J0cyBQdnQgTHRkXFxcXERlc2t0b3BcXFxcQXJ1bGRpbm9cXFxcdml0ZS5jb25maWcudHNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL0M6L1VzZXJzL1BlcnVzaGFuU2hhbG9taXlhbEFyL09uZURyaXZlJTIwLSUyME1hZ2ljayUyMFdvb2RzJTIwRXhwb3J0cyUyMFB2dCUyMEx0ZC9EZXNrdG9wL0FydWxkaW5vL3ZpdGUuY29uZmlnLnRzXCI7aW1wb3J0IHsgZGVmaW5lQ29uZmlnIH0gZnJvbSBcInZpdGVcIjtcbmltcG9ydCByZWFjdCBmcm9tIFwiQHZpdGVqcy9wbHVnaW4tcmVhY3Qtc3djXCI7XG5pbXBvcnQgcGF0aCBmcm9tIFwicGF0aFwiO1xuXG4vLyBodHRwczovL3ZpdGVqcy5kZXYvY29uZmlnL1xuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29uZmlnKCh7IG1vZGUgfSkgPT4gKHtcbiAgc2VydmVyOiB7XG4gICAgaG9zdDogXCI6OlwiLFxuICAgIHBvcnQ6IDgwODAsXG4gICAgaG1yOiB7XG4gICAgICBvdmVybGF5OiBmYWxzZSxcbiAgICB9LFxuICB9LFxuICBwbHVnaW5zOiBbcmVhY3QoKV0uZmlsdGVyKEJvb2xlYW4pLFxuICByZXNvbHZlOiB7XG4gICAgYWxpYXM6IHtcbiAgICAgIFwiQFwiOiBwYXRoLnJlc29sdmUoX19kaXJuYW1lLCBcIi4vc3JjXCIpLFxuICAgIH0sXG4gIH0sXG4gIGJ1aWxkOiB7XG4gICAgcm9sbHVwT3B0aW9uczoge1xuICAgICAgb3V0cHV0OiB7XG4gICAgICAgIG1hbnVhbENodW5rczoge1xuICAgICAgICAgIC8vIFNlcGFyYXRlIGNoYXJ0IGxpYnJhcnkgaW50byBpdHMgb3duIGNodW5rXG4gICAgICAgICAgcmVjaGFydHM6IFsncmVjaGFydHMnXSxcbiAgICAgICAgICAvLyBHcm91cCBVSSBjb21wb25lbnRzXG4gICAgICAgICAgdWk6IFsnQHJhZGl4LXVpL3JlYWN0LWRpYWxvZycsICdAcmFkaXgtdWkvcmVhY3QtZHJvcGRvd24tbWVudScsICdAcmFkaXgtdWkvcmVhY3QtdGFicycsICdAcmFkaXgtdWkvcmVhY3QtdG9hc3QnXSxcbiAgICAgICAgICAvLyBHcm91cCBTdXBhYmFzZSBhbmQgb3RoZXIgbGFyZ2UgbGlicmFyaWVzXG4gICAgICAgICAgdmVuZG9yOiBbJ0BzdXBhYmFzZS9zdXBhYmFzZS1qcycsICdAdGFuc3RhY2svcmVhY3QtcXVlcnknXSxcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgfSxcbiAgICAvLyBJbmNyZWFzZSBjaHVuayBzaXplIHdhcm5pbmcgbGltaXQgc2luY2Ugd2UndmUgb3B0aW1pemVkXG4gICAgY2h1bmtTaXplV2FybmluZ0xpbWl0OiA2MDAsXG4gIH0sXG59KSk7XG4iXSwKICAibWFwcGluZ3MiOiAiO0FBQTRjLFNBQVMsb0JBQW9CO0FBQ3plLE9BQU8sV0FBVztBQUNsQixPQUFPLFVBQVU7QUFGakIsSUFBTSxtQ0FBbUM7QUFLekMsSUFBTyxzQkFBUSxhQUFhLENBQUMsRUFBRSxLQUFLLE9BQU87QUFBQSxFQUN6QyxRQUFRO0FBQUEsSUFDTixNQUFNO0FBQUEsSUFDTixNQUFNO0FBQUEsSUFDTixLQUFLO0FBQUEsTUFDSCxTQUFTO0FBQUEsSUFDWDtBQUFBLEVBQ0Y7QUFBQSxFQUNBLFNBQVMsQ0FBQyxNQUFNLENBQUMsRUFBRSxPQUFPLE9BQU87QUFBQSxFQUNqQyxTQUFTO0FBQUEsSUFDUCxPQUFPO0FBQUEsTUFDTCxLQUFLLEtBQUssUUFBUSxrQ0FBVyxPQUFPO0FBQUEsSUFDdEM7QUFBQSxFQUNGO0FBQUEsRUFDQSxPQUFPO0FBQUEsSUFDTCxlQUFlO0FBQUEsTUFDYixRQUFRO0FBQUEsUUFDTixjQUFjO0FBQUE7QUFBQSxVQUVaLFVBQVUsQ0FBQyxVQUFVO0FBQUE7QUFBQSxVQUVyQixJQUFJLENBQUMsMEJBQTBCLGlDQUFpQyx3QkFBd0IsdUJBQXVCO0FBQUE7QUFBQSxVQUUvRyxRQUFRLENBQUMseUJBQXlCLHVCQUF1QjtBQUFBLFFBQzNEO0FBQUEsTUFDRjtBQUFBLElBQ0Y7QUFBQTtBQUFBLElBRUEsdUJBQXVCO0FBQUEsRUFDekI7QUFDRixFQUFFOyIsCiAgIm5hbWVzIjogW10KfQo=
