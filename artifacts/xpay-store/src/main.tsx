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

async function registerTelegramSession() {
  const webApp = (globalThis as any)?.Telegram?.WebApp;
  const user = webApp?.initDataUnsafe?.user;
  if (!user?.id) return;

  const apiBase = String(import.meta.env.VITE_API_URL || "").replace(/\/+$/, "");
  if (!apiBase) return;

  await fetch(`${apiBase}/api/telegram/store/session`, {
    method: "POST",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      ...(webApp?.initData ? { "x-telegram-init-data": encodeURIComponent(String(webApp.initData)) } : {}),
      "x-telegram-id": String(user.id),
    },
    body: JSON.stringify({ user }),
  }).catch((error) => {
    console.error("Telegram session registration failed:", error);
  });
}

async function bootstrap() {
  try {
    const webApp = (globalThis as any)?.Telegram?.WebApp;
    webApp?.ready?.();
    webApp?.expand?.();
    await waitForTelegramIdentity();
    await registerTelegramSession();
  } catch {
    // The store must still render outside Telegram for diagnostics.
  }

  createRoot(document.getElementById("root")!).render(<App />);
}

void bootstrap();
