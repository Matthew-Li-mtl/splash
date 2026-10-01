import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "@fontsource-variable/fraunces";
import "@fontsource-variable/nunito";
import "@fontsource-variable/caveat";
import "@fontsource/courier-prime/400.css";
import "./styles.css";
import { App } from "./App";
import { ApiError } from "./lib/api";
import { AuthProvider } from "./lib/auth";
import { ToastProvider } from "./lib/toast";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      // Don't hammer the server on 4xx; do retry network blips (e.g. a free server waking up).
      retry: (count, err) => !(err instanceof ApiError && err.status >= 400 && err.status < 500) && count < 3,
      refetchOnWindowFocus: true,
    },
  },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ToastProvider>
          <AuthProvider>
            <App />
          </AuthProvider>
        </ToastProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
