import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "react-router-dom";
import { router } from "./app/router";
import "./styles/globals.css";

const root = createRoot(document.getElementById("root")!);
const client = new QueryClient({
  defaultOptions: { queries: { retry: false, staleTime: 30_000 } },
});

async function boot() {
  const { worker } = await import("./mocks/browser");
  await worker.start({
    quiet: true,
    serviceWorker: { url: `${import.meta.env.BASE_URL}mockServiceWorker.js` },
    onUnhandledRequest(request, print) {
      const url = new URL(request.url);
      if (url.origin === location.origin && url.pathname.startsWith("/api/"))
        print.error();
    },
  });
  root.render(
    <StrictMode>
      <QueryClientProvider client={client}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </StrictMode>,
  );
}

void boot().catch(() => {
  root.render(
    <main className="page-content" role="alert">
      <h1>演示数据未启动</h1>
      <p>请使用本地 HTTP 地址访问，并确认浏览器允许 Service Worker。</p>
    </main>,
  );
});
