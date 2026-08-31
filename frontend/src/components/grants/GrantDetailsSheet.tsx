import type { ReactNode } from "react";
import { ExternalLink, MessageSquare } from "lucide-react";
import type { Grant } from "@/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { InlineNotice } from "@/components/common/InlineNotice";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { DeadlineBadge } from "./DeadlineBadge";
import { MATCH_TIER_CLASSES, matchTierFor } from "./grantPresentation";
import { formatDeadline } from "@/utils/deadline";

interface Props {
  grant: Grant | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAsk: (grant: Grant) => void;
  onStart: (grant: Grant) => void;
}

export function GrantDetailsSheet({ grant, open, onOpenChange, onAsk, onStart }: Props) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-lg"
      >
        {!grant && (
          <>
            <SheetHeader className="shrink-0 border-b border-border px-5 py-4 text-left">
              <SheetTitle>Grant details unavailable</SheetTitle>
              <SheetDescription>This grant&apos;s details couldn&apos;t be found.</SheetDescription>
            </SheetHeader>
            <div className="flex-1 px-5 py-4">
              <InlineNotice tone="empty">
                This grant&apos;s details aren&apos;t available right now. Close this panel and try
                opening it again from the grant&apos;s card.
              </InlineNotice>
            </div>
            <SheetFooter className="shrink-0 border-t border-border px-5 py-4">
              <SheetClose asChild>
                <Button type="button" variant="outline" className="rounded-lg hover:bg-muted">
                  Close
                </Button>
              </SheetClose>
            </SheetFooter>
          </>
        )}

        {grant && (
          <>
            <SheetHeader className="shrink-0 border-b border-border px-5 py-4 text-left">
              <div className="text-[11px] font-medium uppercase tracking-wider text-brand">
                {grant.programme}
              </div>
              <SheetTitle className="text-base leading-snug">{grant.title}</SheetTitle>
              <SheetDescription>
                Full details, eligibility criteria, and funding specifications.
              </SheetDescription>
            </SheetHeader>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
              <div className="space-y-5 text-sm">
                <Section title="Overview">
                  {typeof grant.matchPercentage === "number" && grant.matchPercentage > 0 && (
                    <MatchScoreRow percentage={grant.matchPercentage} />
                  )}
                  <Field
                    label="Description"
                    value={grant.description}
                    fallback="Refer to official EU Funding & Tenders documentation for complete topic scope and objectives."
                  />
                </Section>

                <Section title="Funding">
                  <Field
                    label="Amount"
                    value={grant.fundingAmount}
                    fallback="Horizon Europe standard funding rates apply."
                  />
                  <Field label="Type" value={grant.fundingType} fallback="Grant" />
                </Section>

                <Section title="Deadline">
                  <DeadlineRow deadline={grant.deadline} />
                </Section>

                <Section title="Eligibility">
                  <ListField
                    label="Organisation eligibility"
                    items={grant.organisationEligibility}
                    fallback="Open to all legal entities established in eligible countries (SMEs, research bodies, large enterprises)."
                  />
                  <ListField
                    label="Requirements"
                    items={grant.requirements}
                    fallback="Standard Horizon Europe eligibility and consortium participation requirements apply."
                  />
                </Section>

                <Section title="Geographic scope">
                  <ListField
                    label="Eligible countries / regions"
                    items={grant.eligibleCountries}
                    fallback="EU Member States, Horizon Europe Associated Countries, and eligible third countries."
                  />
                </Section>

                {(grant.whyItMatches || (grant.matchReasons && grant.matchReasons.length > 0)) && (
                  <Section title="Why it matches">
                    {grant.whyItMatches && <Field label="Summary" value={grant.whyItMatches} />}
                    {grant.matchReasons && grant.matchReasons.length > 0 && (
                      <ListField label="Match reasons" items={grant.matchReasons} />
                    )}
                  </Section>
                )}

                <Section title="Source">
                  {grant.sourceUrl?.trim() ? (
                    <a
                      href={grant.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-sm font-medium text-brand hover:underline"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      Open official source
                    </a>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Available via EU Funding & Tenders Portal.
                    </p>
                  )}
                </Section>

                {Boolean(grant.tags && grant.tags.length > 0) && (
                  <div className="flex flex-wrap gap-1.5 border-t border-border pt-4">
                    {grant.tags?.map((t) => (
                      <Badge key={t} variant="secondary" className="font-normal">
                        {t}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <SheetFooter className="shrink-0 flex-col gap-2 border-t border-border px-5 py-4 sm:flex-row sm:flex-wrap sm:justify-start sm:space-x-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  onAsk(grant);
                  onOpenChange(false);
                }}
                className="w-full rounded-lg hover:bg-muted sm:w-auto"
              >
                <MessageSquare className="h-3.5 w-3.5" />
                Ask about this grant
              </Button>
              <Button
                type="button"
                onClick={() => {
                  onStart(grant);
                  onOpenChange(false);
                }}
                className="w-full rounded-lg bg-brand text-brand-foreground shadow-sm hover:bg-brand/90 sm:w-auto"
              >
                Start application
              </Button>
              <SheetClose asChild>
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full rounded-lg hover:bg-muted sm:ml-auto sm:w-auto"
                >
                  Close
                </Button>
              </SheetClose>
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </h3>
      <div className="mt-2 space-y-3">{children}</div>
    </section>
  );
}

function Field({ label, value, fallback }: { label: string; value?: string; fallback?: string }) {
  const available = Boolean(value && value.trim().length > 0);
  return (
    <div>
      <div className="text-[11px] font-medium text-muted-foreground">{label}</div>
      {available ? (
        <p className="mt-0.5 whitespace-pre-wrap break-words text-sm text-foreground [overflow-wrap:anywhere]">
          {value}
        </p>
      ) : fallback ? (
        <p className="mt-0.5 text-xs text-muted-foreground">{fallback}</p>
      ) : null}
    </div>
  );
}

function ListField({
  label,
  items,
  fallback,
}: {
  label: string;
  items?: string[];
  fallback?: string;
}) {
  const list = items ?? [];
  return (
    <div>
      <div className="text-[11px] font-medium text-muted-foreground">{label}</div>
      {list.length > 0 ? (
        <ul className="mt-1 space-y-1">
          {list.map((item, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-foreground">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-brand" />
              <span className="min-w-0 break-words [overflow-wrap:anywhere]">{item}</span>
            </li>
          ))}
        </ul>
      ) : fallback ? (
        <p className="mt-0.5 text-xs text-muted-foreground">{fallback}</p>
      ) : null}
    </div>
  );
}

/** Same ring meter as the grant card (see GrantResults.tsx's MatchRing), so the
 * match score reads identically whether it's seen on the card or in here. */
function MatchScoreRow({ percentage = 0 }: { percentage?: number }) {
  const tier = matchTierFor(percentage);
  const cls = MATCH_TIER_CLASSES[tier];
  const clamped = Math.min(100, Math.max(0, percentage));
  const size = 52;
  const stroke = 4;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - clamped / 100);

  return (
    <div className="flex items-center gap-3">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            strokeWidth={stroke}
            className="stroke-muted"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className={cn(
              "motion-safe:transition-[stroke-dashoffset] motion-safe:duration-700",
              cls.stroke,
            )}
          />
        </svg>
        <span
          role="img"
          aria-label={`${percentage}% match`}
          className="absolute inset-0 flex items-center justify-center text-xs font-bold tabular-nums text-foreground"
        >
          {percentage}%
        </span>
      </div>
      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Match score
      </span>
    </div>
  );
}

function DeadlineRow({ deadline }: { deadline?: string }) {
  if (!deadline) {
    return (
      <p className="text-xs text-muted-foreground">
        Continuous submission / Open call (see official call document)
      </p>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm font-medium text-foreground">{formatDeadline(deadline)}</span>
      <DeadlineBadge deadline={deadline} />
    </div>
  );
}
