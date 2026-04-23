import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

// المتغيرات المطلوبة فقط في وضع التطوير
const isDev = process.env.NODE_ENV === "development";

// PORT: مطلوب في dev فقط، وإلا نعطيه قيمة افتراضية للبناء
const rawPort = process.env.PORT;
let port: number;
if (isDev) {
  if (!rawPort) throw new Error("PORT environment variable is required in development.");
  port = Number(rawPort);
  if (Number.isNaN(port) || port <= 0) throw new Error(`Invalid PORT value: "${rawPort}"`);
} else {
  port = 5173; // قيمة افتراضية للبناء، لن تُستخدم فعلياً
}

// BASE_PATH: مطلوب في dev فقط، وإلا نعطيه "/"
const basePath = process.env.BASE_PATH;
let base: string;
if (isDev) {
  if (!basePath) throw new Error("BASE_PATH environment variable is required in development.");
  base = basePath;
} else {
  base = "/"; // في Vercel يكون المسار الجذر
}

export default defineConfig({
  base,
  plugins: [
    react(),
    tailwindcss(),
    runtimeErrorOverlay(),
    ...(isDev && process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer({
              root: path.resolve(import.meta.dirname, ".."),
            }),
          ),
          await import("@replit/vite-plugin-dev-banner").then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@assets": path.resolve(import.meta.dirname, "..", "..", "attached_assets"),
    },
    dedupe: ["react", "react-dom"],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    port,
    strictPort: true,
    host: "0.0.0.0",
    allowedHosts: true,
    fs: {
      strict: true,
    },
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
  },
});