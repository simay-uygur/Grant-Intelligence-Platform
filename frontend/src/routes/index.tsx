import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { App } from "@/components/App";
import { AuthScreen } from "@/components/AuthScreen";
import { AUTH_TOKEN_KEY, AUTH_UNAUTHORIZED_EVENT } from "@/services/apiClient";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Grant Navigator — European grant discovery, intelligently matched" },
      {
        name: "description",
        content:
          "AI-powered chat assistant that helps SMEs, startups, NGOs, universities and public bodies discover the best European grant opportunities and prepare applications.",
      },
      {
        property: "og:title",
        content: "Grant Navigator — European grant discovery",
      },
      {
        property: "og:description",
        content:
          "Chat with an AI grant consultant. Get the three best-matched European grants and draft your application in one place.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ProtectedApp,
});

function ProtectedApp() {
  const authRequired = import.meta.env.VITE_AUTH_REQUIRED !== "false";

  return authRequired ? <AuthenticatedApp /> : <App />;
}

function AuthenticatedApp() {
  const [hasToken, setHasToken] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setHasToken(
      typeof window !== "undefined" && Boolean(window.localStorage.getItem(AUTH_TOKEN_KEY)),
    );

    const handleAuthChange = () => {
      const tokenExists =
        typeof window !== "undefined" && Boolean(window.localStorage.getItem(AUTH_TOKEN_KEY));
      setHasToken(tokenExists);
    };

    window.addEventListener(AUTH_UNAUTHORIZED_EVENT, handleAuthChange);
    window.addEventListener("storage", handleAuthChange);
    return () => {
      window.removeEventListener(AUTH_UNAUTHORIZED_EVENT, handleAuthChange);
      window.removeEventListener("storage", handleAuthChange);
    };
  }, []);

  if (!mounted) {
    return <AuthScreen />;
  }

  return hasToken ? <App /> : <AuthScreen />;
}
