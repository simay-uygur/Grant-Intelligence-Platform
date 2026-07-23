import { ExternalLink, MessageSquare, Sparkles } from "lucide-react";
import type { Grant } from "@/types";

interface Props {
  grants: Grant[];
  onAsk: (grant: Grant) => void;
  onStart: (grant: Grant) => void;
}

export function GrantResults({ grants, onAsk, onStart }: Props) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground">
            Top 3 matched grants
          </h3>
          <p className="text-xs text-muted-foreground">
            Ranked by fit with your organisation profile.
          </p>
        </div>
        <span className="rounded-full border border-amber-300/50 bg-amber-100/60 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-amber-800">
          Demo data
        </span>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {grants.map((g) => (
          <GrantCard key={g.id} grant={g} onAsk={onAsk} onStart={onStart} />
        ))}
      </div>
    </div>
  );
}

function GrantCard({
  grant,
  onAsk,
  onStart,
}: {
  grant: Grant;
  onAsk: (g: Grant) => void;
  onStart: (g: Grant) => void;
}) {
  return (
    <article className="rounded-2xl border border-border bg-card p-5 shadow-sm transition-shadow hover:shadow-md">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="break-words text-[11px] font-medium uppercase tracking-wider text-brand [overflow-wrap:anywhere]">
            {grant.programme}
          </div>
          <h4 className="mt-1 break-words text-base font-semibold text-foreground [overflow-wrap:anywhere]">
            {grant.title}
          </h4>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <div className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
            {grant.matchPercentage}% match
          </div>
        </div>
      </header>

      <p className="mt-3 break-words text-sm text-muted-foreground [overflow-wrap:anywhere]">
        {grant.description}
      </p>

      <dl className="mt-4 grid grid-cols-2 gap-3 text-xs lg:grid-cols-4">
        <Item label="Funding" value={grant.fundingAmount} />
        <Item label="Deadline" value={grant.deadline} />
        <Item label="Type" value={grant.fundingType} />
        <Item
          label="Eligible"
          value={grant.eligibleCountries.slice(0, 2).join(", ")}
        />
      </dl>

      <div className="mt-4 rounded-lg bg-brand/5 p-3">
        <div className="flex items-center gap-1.5 text-xs font-medium text-brand">
          <Sparkles className="h-3.5 w-3.5" />
          Why it matches
        </div>
        <p className="mt-1 break-words text-xs text-foreground/80 [overflow-wrap:anywhere]">
          {grant.whyItMatches}
        </p>
        <ul className="mt-2 space-y-1">
          {grant.matchReasons.map((r, i) => (
            <li
              key={i}
              className="flex items-start gap-2 text-xs text-foreground/80"
            >
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-brand" />
              <span className="min-w-0 break-words [overflow-wrap:anywhere]">
                {r}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {grant.tags.map((t) => (
          <span
            key={t}
            className="break-words rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground [overflow-wrap:anywhere]"
          >
            {t}
          </span>
        ))}
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <a
          href={grant.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Open source
        </a>
        <button
          type="button"
          onClick={() => onAsk(grant)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
        >
          <MessageSquare className="h-3.5 w-3.5" />
          Ask about this grant
        </button>
        <button
          type="button"
          onClick={() => onStart(grant)}
          className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-xs font-medium text-white shadow-sm transition-colors hover:bg-brand/90"
        >
          Start application
        </button>
      </div>
    </article>
  );
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-0.5 break-words text-xs font-medium text-foreground [overflow-wrap:anywhere]">
        {value}
      </dd>
    </div>
  );
}
