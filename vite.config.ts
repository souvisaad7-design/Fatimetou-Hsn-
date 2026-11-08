import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

// base: "./" يجعل الموقع يعمل من أي مسار (GitHub Pages أو أي استضافة أخرى)
export default defineConfig({
  plugins: [react()],
  base: "./",
  // بوابة المنتسبين (/)، لوحة الإدارة (/admin/)، والمساعد الذكي (/assistant/)
  build: {
    rollupOptions: {
      input: {
        home: resolve(__dirname, "index.html"),
        assistant: resolve(__dirname, "assistant/index.html"),
        admin: resolve(__dirname, "admin/index.html"),
      },
    },
  },
});
