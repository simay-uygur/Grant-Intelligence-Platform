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
import {
  getGrantSourceLabel,
  getGrantSourceType,
  MATCH_TIER_CLASSES,
  matchTierFor,
} from "./grantPresentation";
import { formatDeadline } from "@/utils/deadline";

interface Props {
  grant: Grant | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAsk: (grant: Grant) => void;
  onStart: (grant: Grant) => void;
  hasDraft?: boolean;
}

export function GrantDetailsSheet({ grant, open, onOpenChange, onAsk, onStart, hasDraft }: Props) {
  const sourceType = grant ? getGrantSourceType(grant) : "eu_portal";
  const sourceLabel = grant ? getGrantSourceLabel(grant) : "EU Horizon API";

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
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold border",
                    sourceType === "web_discovery"
                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                      : "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-400",
                  )}
                >
                  {sourceType === "web_discovery" ? "🌐 Web Discovery" : "🇪🇺 EU Portal"}
                </span>
                <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  {grant.programme || sourceLabel}
                </span>
              </div>
              <SheetTitle className="text-base leading-snug">{grant.title}</SheetTitle>
              <SheetDescription>
                {grant.provenance === "live"
                  ? "Details returned by the live parallel search pipeline. Missing source fields are not inferred."
                  : "Full details available in the local demo catalogue."}
              </SheetDescription>
            </SheetHeader>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
              <div className="space-y-5 text-sm">
                <Section title="Overview">
                  {grant.matchPercentage !== undefined && (
                    <MatchScoreRow percentage={grant.matchPercentage} />
                  )}
                  <Field label="Description" value={grant.description} />
                  <Field
                    label="Discovery Source"
                    value={
                      sourceType === "web_discovery"
                        ? "Web Grant Discovery (Parallel Search)"
                        : "EU Funding & Tenders Portal (Parallel Search)"
                    }
                  />
                </Section>

                {(grant.fundingAmount || grant.fundingType) && (
                  <Section title="Funding">
                    {grant.fundingAmount && <Field label="Amount" value={grant.fundingAmount} />}
                    {grant.fundingType && <Field label="Type" value={grant.fundingType} />}
                  </Section>
                )}

                {grant.deadline && (
                  <Section title="Deadline">
                    <DeadlineRow deadline={grant.deadline} />
                  </Section>
                )}

                {(grant.organisationEligibility?.length || grant.requirements?.length) && (
                  <Section title="Eligibility">
                    {grant.organisationEligibility?.length ? (
                      <ListField
                        label="Organisation eligibility"
                        items={grant.organisationEligibility}
                      />
                    ) : null}
                    {grant.requirements?.length ? (
                      <ListField label="Requirements" items={grant.requirements} />
                    ) : null}
                  </Section>
                )}

                {grant.eligibleCountries?.length ? (
                  <Section title="Geographic scope">
                    <ListField
                      label="Eligible countries / regions"
                      items={grant.eligibleCountries}
                    />
                  </Section>
                ) : null}

                {(grant.whyItMatches || grant.matchReasons?.length) && (
                  <Section title="Why it was returned">
                    {grant.whyItMatches && <Field label="Summary" value={grant.whyItMatches} />}
                    {grant.matchReasons?.length ? (
                      <ListField label="Match reasons" items={grant.matchReasons} />
                    ) : null}
                  </Section>
                )}

                {grant.sourceUrl && (
                  <Section title="Official source">
                    <a
                      href={grant.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-sm font-medium text-brand hover:underline"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      Open official source
                    </a>
                  </Section>
                )}

                {grant.tags?.length ? (
                  <div className="flex flex-wrap gap-1.5 border-t border-border pt-4">
                    {grant.tags.map((t) => (
                      <Badge key={t} variant="secondary" className="font-normal">
                        {t}
                      </Badge>
                    ))}
                  </div>
                ) : null}
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
                className="w-full rounded-lg bg-brand text-white shadow-sm hover:bg-brand/90 sm:w-auto"
              >
                {hasDraft ? "Open saved application" : "Start application"}
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

function Field({ label, value }: { label: string; value: string }) {
  const available = value.trim().length > 0;
  return (
    <div>
      <div className="text-[11px] font-medium text-muted-foreground">{label}</div>
      {available ? (
        <p className="mt-0.5 whitespace-pre-wrap break-words text-sm text-foreground [overflow-wrap:anywhere]">
          {value}
        </p>
      ) : (
        <p className="mt-0.5 text-xs italic text-muted-foreground">Not available in demo data.</p>
      )}
    </div>
  );
}

function ListField({ label, items }: { label: string; items: string[] }) {
  return (
    <div>
      <div className="text-[11px] font-medium text-muted-foreground">{label}</div>
      {items.length > 0 ? (
        <ul className="mt-1 space-y-1">
          {items.map((item, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-foreground">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-brand" />
              <span className="min-w-0 break-words [overflow-wrap:anywhere]">{item}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-0.5 text-xs italic text-muted-foreground">Not available in demo data.</p>
      )}
    </div>
  );
}

function MatchScoreRow({ percentage }: { percentage: number }) {
  const tier = matchTierFor(percentage);
  const cls = MATCH_TIER_CLASSES[tier];
  const clamped = Math.min(100, Math.max(0, percentage));
  return (
    <div className="flex items-center gap-3">
      <div className="shrink-0 text-right leading-none">
        <span className={cn("text-lg font-medium tabular-nums", cls.text)}>{percentage}%</span>
        <div className="mt-0.5 text-[10px] text-muted-foreground">match</div>
      </div>
      <div
        role="img"
        aria-label={`${percentage}% match`}
        className="h-1 flex-1 overflow-hidden rounded-full bg-muted"
      >
        <div className={cn("h-full rounded-full", cls.bar)} style={{ width: `${clamped}%` }} />
      </div>
    </div>
  );
}

function DeadlineRow({ deadline }: { deadline: string }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm font-medium text-foreground">{formatDeadline(deadline)}</span>
      <DeadlineBadge deadline={deadline} />
    </div>
  );
}
