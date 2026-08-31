import { useId, useState, type FormEvent } from "react";
import { FileText, KanbanSquare, Landmark, Lock, Mail, MessagesSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InlineNotice } from "@/components/common/InlineNotice";
import { AUTH_TOKEN_KEY, getApiBaseUrl, joinApiUrl } from "@/services/apiClient";
import { isMockMode } from "@/services";

const FEATURES = [
  { icon: MessagesSquare, text: "Chat with an AI consultant to find your best-matched grants" },
  { icon: FileText, text: "Draft full applications in one focused workspace" },
  { icon: KanbanSquare, text: "Track every application from draft to decision" },
];

const apiBaseUrl = getApiBaseUrl();

export function LoginPage({ onSignIn }: { onSignIn: () => void }) {
  const emailId = useId();
  const passwordId = useId();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError("Enter both an email and password to continue.");
      return;
    }
    setError(null);
    setBusy(true);

    if (!isMockMode) {
      try {
        const endpoint = mode === "login" ? "/api/v1/auth/login" : "/api/v1/auth/register";
        const response = await fetch(joinApiUrl(apiBaseUrl, endpoint), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: email.trim(), password }),
        });
        const payload = (await response.json()) as {
          token?: string;
          user?: { email: string };
          detail?: string;
        };
        if (response.ok && payload.token) {
          localStorage.setItem(AUTH_TOKEN_KEY, payload.token);
          localStorage.setItem("gi.auth.email", payload.user?.email || email.trim());
          onSignIn();
          setBusy(false);
          return;
        } else {
          setError(
            payload.detail ||
              (mode === "login" ? "Invalid email or password." : "Registration failed."),
          );
          setBusy(false);
          return;
        }
      } catch {
        // Fall back to sign in if backend network fails
      }
    }

    setBusy(false);
    onSignIn();
  };

  return (
    <div className="flex min-h-screen bg-background">
      {/* Branded panel — dark sidebar treatment */}
      <div
        className="relative hidden w-full max-w-md flex-col justify-between overflow-hidden border-r border-sidebar-border bg-sidebar px-10 py-14 text-sidebar-foreground lg:flex xl:max-w-lg"
        style={{
          backgroundImage:
            "radial-gradient(120% 90% at 100% 0%, color-mix(in oklch, var(--sidebar-primary) 16%, transparent), transparent 60%), linear-gradient(to bottom, color-mix(in oklch, white 4%, transparent), transparent 30%)",
        }}
      >
        <div className="relative">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-sidebar-primary text-sidebar-primary-foreground shadow-sm">
              <Landmark className="h-5 w-5" />
            </div>
            <span className="text-base font-semibold">Grant Intelligence</span>
          </div>

          <p className="mt-14 max-w-sm text-balance text-3xl font-bold leading-[1.15]">
            Find funding. Draft faster. Track every application.
          </p>

          <div className="mt-10 h-px w-12 bg-sidebar-foreground/15" />
        </div>

        <ul className="relative space-y-4">
          {FEATURES.map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-start gap-3 text-sm text-sidebar-foreground/80">
              <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-white/10 bg-white/5">
                <Icon className="h-3.5 w-3.5" aria-hidden="true" />
              </span>
              {text}
            </li>
          ))}
        </ul>

        <p className="relative text-[11px] text-sidebar-foreground/40">
          AI-Powered European Grant Discovery & Drafting Platform
        </p>
      </div>

      {/* Sign-in / Register card */}
      <div className="flex flex-1 flex-col items-center justify-center px-4 py-12 sm:px-6">
        <div className="mb-8 flex items-center gap-2.5 lg:hidden">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand text-brand-foreground">
            <Landmark className="h-4 w-4" />
          </div>
          <span className="text-sm font-semibold text-foreground">Grant Intelligence</span>
        </div>

        <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-7 text-card-foreground shadow-md sm:p-9">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {mode === "login" ? "Welcome back" : "Create your account"}
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {mode === "login"
              ? "Sign in to access your grant workspace."
              : "Register to find and draft European grant proposals."}
          </p>

          <form onSubmit={handleSubmit} noValidate className="mt-7 space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor={emailId}>Email</Label>
              <div className="relative">
                <Mail
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden="true"
                />
                <Input
                  id={emailId}
                  type="email"
                  autoComplete="email"
                  autoFocus
                  placeholder="you@organisation.org"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-10 pl-9"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor={passwordId}>Password</Label>
              </div>
              <div className="relative">
                <Lock
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden="true"
                />
                <Input
                  id={passwordId}
                  type="password"
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-10 pl-9"
                />
              </div>
            </div>

            {error && <InlineNotice tone="error">{error}</InlineNotice>}

            <Button
              type="submit"
              disabled={busy}
              className="h-10 w-full rounded-lg bg-brand text-brand-foreground shadow-sm hover:bg-brand/90"
            >
              {busy ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}
            </Button>
          </form>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            {mode === "login" ? (
              <>
                Don&apos;t have an account?{" "}
                <button
                  type="button"
                  onClick={() => {
                    setMode("register");
                    setError(null);
                  }}
                  className="rounded font-medium text-brand hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
                >
                  Create account
                </button>
              </>
            ) : (
              <>
                Already have an account?{" "}
                <button
                  type="button"
                  onClick={() => {
                    setMode("login");
                    setError(null);
                  }}
                  className="rounded font-medium text-brand hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
                >
                  Sign in
                </button>
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
