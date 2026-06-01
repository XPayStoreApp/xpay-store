import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { setBaseUrl } from "@workspace/api-client-react";

// تعيين عنوان API الأساسي من متغير البيئة
setBaseUrl(import.meta.env.VITE_API_URL || "");

async function waitForTelegramIdentity(timeoutMs = 1500) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const webApp = (globalThis as any)?.Telegram?.WebApp;
    const initData = String(webApp?.initData || "").trim();
    const userId = webApp?.initDataUnsafe?.user?.id;
    if (initData || userId) return;
    await new Promise((resolve) => setTimeout(resolve, 75));
  }
}

async function bootstrap() {
  try {
    const webApp = (globalThis as any)?.Telegram?.WebApp;
    webApp?.ready?.();
    webApp?.expand?.();
    await waitForTelegramIdentity();
  } catch {
    // The store must still render outside Telegram for diagnostics.
  }

  createRoot(document.getElementById("root")!).render(<App />);
}

void bootstrap();
