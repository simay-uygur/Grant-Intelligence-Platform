import { FormEvent, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AUTH_TOKEN_KEY, getApiBaseUrl, joinApiUrl } from "@/services/apiClient";

type Mode = "login" | "register";
const apiBaseUrl = getApiBaseUrl();

export function AuthScreen() {
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    setBusy(true);
    setError(undefined);
    try {
      const response = await fetch(joinApiUrl(apiBaseUrl, "/api/v1/auth/" + mode), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: cleanEmail, password }),
      });
      const payload = (await response.json()) as {
        token?: string;
        user?: { email: string };
        detail?: string;
      };
      if (!response.ok || !payload.token)
        throw new Error(payload.detail ?? "Unable to authenticate.");
      localStorage.setItem(AUTH_TOKEN_KEY, payload.token);
      localStorage.setItem("gi.auth.email", payload.user?.email || cleanEmail);
      // Notify other tabs and the ProtectedApp listener via the storage event.
      window.dispatchEvent(new StorageEvent("storage", { key: AUTH_TOKEN_KEY }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to authenticate.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <form
        onSubmit={submit}
        className="w-full max-w-sm space-y-5 rounded-2xl border border-border bg-card p-7 shadow-sm"
      >
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">
            Grant Navigator
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-foreground">
            {mode === "login" ? "Welcome back" : "Create your account"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {mode === "login"
              ? "Log in to access your grant workspace."
              : "Your saved work belongs to your account."}
          </p>
        </div>
        <label className="block space-y-1.5 text-sm font-medium text-foreground">
          Email
          <Input
            type="email"
            value={email}
            disabled={busy}
            onChange={(event) => {
              setEmail(event.target.value);
              if (error) setError(undefined);
            }}
            required
            autoComplete="email"
            className="disabled:opacity-60"
          />
        </label>
        <label className="block space-y-1.5 text-sm font-medium text-foreground">
          Password
          <Input
            type="password"
            value={password}
            disabled={busy}
            onChange={(event) => {
              setPassword(event.target.value);
              if (error) setError(undefined);
            }}
            required
            minLength={8}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            className="disabled:opacity-60"
          />
        </label>
        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              {mode === "login" ? "Logging in…" : "Creating account…"}
            </span>
          ) : mode === "login" ? (
            "Log in"
          ) : (
            "Register"
          )}
        </Button>
        <button
          type="button"
          disabled={busy}
          className="w-full text-sm text-muted-foreground hover:text-foreground disabled:opacity-50"
          onClick={() => {
            setMode(mode === "login" ? "register" : "login");
            setError(undefined);
          }}
        >
          {mode === "login" ? "Need an account? Register" : "Already registered? Log in"}
        </button>
      </form>
    </main>
  );
}
