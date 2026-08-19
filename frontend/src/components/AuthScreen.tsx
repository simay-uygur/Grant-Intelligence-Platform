import { FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getApiBaseUrl, joinApiUrl } from "@/services/apiClient";

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
    setBusy(true);
    setError(undefined);
    try {
      const response = await fetch(joinApiUrl(apiBaseUrl, "/api/v1/auth/" + mode), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const payload = (await response.json()) as {
        token?: string;
        user?: { email: string };
        detail?: string;
      };
      if (!response.ok || !payload.token)
        throw new Error(payload.detail ?? "Unable to authenticate.");
      localStorage.setItem("gi.auth.token", payload.token);
      localStorage.setItem("gi.auth.email", payload.user?.email || email);
      window.location.reload();
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
            onChange={(event) => setEmail(event.target.value)}
            required
            autoComplete="email"
          />
        </label>
        <label className="block space-y-1.5 text-sm font-medium text-foreground">
          Password
          <Input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            minLength={8}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
          />
        </label>
        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? "Please wait…" : mode === "login" ? "Log in" : "Register"}
        </Button>
        <button
          type="button"
          className="w-full text-sm text-muted-foreground hover:text-foreground"
          onClick={() => setMode(mode === "login" ? "register" : "login")}
        >
          {mode === "login" ? "Need an account? Register" : "Already registered? Log in"}
        </button>
      </form>
    </main>
  );
}
