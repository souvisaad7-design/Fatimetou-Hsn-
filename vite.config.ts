import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base: "./" يجعل الموقع يعمل من أي مسار (GitHub Pages أو أي استضافة أخرى)
export default defineConfig({
  plugins: [react()],
  base: "./",
});
