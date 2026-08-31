import { useId, useState, type FormEvent } from "react";
import { FileText, KanbanSquare, Landmark, Lock, Mail, MessagesSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InlineNotice } from "@/components/common/InlineNotice";
import { DemoBadge } from "@/components/common/DemoBadge";
import { AUTH_TOKEN_KEY, getApiBaseUrl, joinApiUrl } from "@/services/apiClient";
import { isMockMode } from "@/services";

const FEATURES = [
  { icon: MessagesSquare, text: "Chat with an AI consultant to find your best-matched grants" },
  { icon: FileText, text: "Draft full applications in one focused workspace" },
  { icon: KanbanSquare, text: "Track every application from draft to decision" },
];

const apiBaseUrl = getApiBaseUrl();

/**
 * The app's entry point when not "signed in" (see useAuth). Frontend-only
 * mock gate: Sign in accepts any non-empty email + password — there is no
 * backend, no real credential check, and no distinction between accounts.
 * Google / Forgot password / Sign up are visual-only (no OAuth, no email
 * flow, no account system exists to route them to) — clicking any of them
 * surfaces an honest inline note rather than doing nothing or pretending to
 * work, the same "never fake it" pattern DemoBadge/InlineNotice use
 * elsewhere in the app.
 */

export function LoginPage({ onSignIn }: { onSignIn: () => void }) {
  const emailId = useId();
  const passwordId = useId();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [demoNotice, setDemoNotice] = useState(false);
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
        const response = await fetch(joinApiUrl(apiBaseUrl, "/api/v1/auth/login"), {
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
        } else if (response.status === 401 || response.status === 400) {
          // If login failed, attempt register for frictionless onboarding or show error
          const regRes = await fetch(joinApiUrl(apiBaseUrl, "/api/v1/auth/register"), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: email.trim(), password }),
          });
          const regPayload = (await regRes.json()) as {
            token?: string;
            user?: { email: string };
            detail?: string;
          };
          if (regRes.ok && regPayload.token) {
            localStorage.setItem(AUTH_TOKEN_KEY, regPayload.token);
            localStorage.setItem("gi.auth.email", regPayload.user?.email || email.trim());
            onSignIn();
            setBusy(false);
            return;
          }
        }
      } catch {
        // Fall back to local demo sign in
      }
    }

    setBusy(false);
    onSignIn();
  };

  const showDemoNotice = () => setDemoNotice(true);

  return (
    <div className="flex min-h-screen bg-background">
      {/* Branded panel — the app's dark sidebar treatment, desktop only. A
          soft radial glow (color-mixed from the existing slate accent, not a
          new literal) and a top inner highlight give it some depth without
          it turning into a graphic. */}
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
          Demo mode — a frontend-only preview with mock data.
        </p>
      </div>

      {/* Sign-in card */}
      <div className="flex flex-1 flex-col items-center justify-center px-4 py-12 sm:px-6">
        {/* Compact brand mark, mobile only (the panel above covers desktop). */}
        <div className="mb-8 flex items-center gap-2.5 lg:hidden">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand text-brand-foreground">
            <Landmark className="h-4 w-4" />
          </div>
          <span className="text-sm font-semibold text-foreground">Grant Intelligence</span>
        </div>

        <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-7 text-card-foreground shadow-md sm:p-9">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Welcome back</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Sign in to continue to your workspace.
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
                <button
                  type="button"
                  onClick={showDemoNotice}
                  className="rounded text-xs font-medium text-brand hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <Lock
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden="true"
                />
                <Input
                  id={passwordId}
                  type="password"
                  autoComplete="current-password"
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
              {busy ? "Signing in…" : "Sign in"}
            </Button>
          </form>

          {demoNotice && (
            <InlineNotice tone="empty" className="mt-4">
              Not available in this demo — there&apos;s no real account system. Use the email and
              password form above; any non-empty values sign you in.
            </InlineNotice>
          )}

          <p className="mt-6 text-center text-xs text-muted-foreground">
            Don&apos;t have an account?{" "}
            <button
              type="button"
              onClick={showDemoNotice}
              className="rounded font-medium text-brand hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
            >
              Sign up
            </button>
          </p>
        </div>

        <DemoBadge marker="demo-data" compact className="mt-6" />
      </div>
    </div>
  );
}
