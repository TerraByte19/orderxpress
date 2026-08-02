import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const hier = dirname(fileURLToPath(import.meta.url));

/** Jede Seite ist ein eigener Einstiegspunkt (Multi-Page-Betrieb). */
const seiten = [
  "index", "guest", "admin", "kitchen", "service",
  "waiter", "stats", "platform", "device"
];

export default defineConfig({
  build: {
    // Spring liefert alles aus diesem Ordner aus
    outDir: resolve(hier, "../src/main/resources/static"),
    emptyOutDir: true,
    rollupOptions: {
      input: Object.fromEntries(
        seiten.map((name) => [name, resolve(hier, `${name}.html`)])
      )
    }
  },
  server: {
    port: 5173,
    // Im Entwicklungsbetrieb laeuft Spring parallel auf 8080
    proxy: {
      "/api": "http://localhost:8080"
    }
  },
  test: {
    environment: "jsdom"
  }
});
