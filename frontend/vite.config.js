import path from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
    base: "./",
    publicDir: path.resolve(__dirname, "../public"),
    plugins: [react()],
    server: {
        host: "0.0.0.0",
    },
    build: {
        outDir: path.resolve(__dirname, "../dist"),
        rollupOptions: {
            external: ["#minpath", "#minproc", "#minurl"],
        },
    },
});
