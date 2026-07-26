import type { ReactNode } from "react";
import { ExternalLink, MessageSquare } from "lucide-react";
import type { Grant } from "@/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  MATCH_TIER_CLASSES,
  MATCH_TIER_LABEL,
  deadlineUrgency,
  formatDeadline,
  matchTierFor,
} from "./grantPresentation";

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
        {grant && (
          <>
            <SheetHeader className="shrink-0 border-b border-border px-5 py-4 text-left">
              <div className="text-[11px] font-medium uppercase tracking-wider text-brand">
                {grant.programme}
              </div>
              <SheetTitle className="text-base leading-snug">{grant.title}</SheetTitle>
              <SheetDescription>
                Full details for this grant, limited to what this demo has available.
              </SheetDescription>
            </SheetHeader>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
              <div className="space-y-5 text-sm">
                <Section title="Overview">
                  <MatchScoreRow percentage={grant.matchPercentage} />
                  <Field label="Description" value={grant.description} />
                </Section>

                <Section title="Funding">
                  <Field label="Amount" value={grant.fundingAmount} />
                  <Field label="Type" value={grant.fundingType} />
                </Section>

                <Section title="Deadline">
                  <DeadlineRow deadline={grant.deadline} />
                </Section>

                <Section title="Eligibility">
                  <ListField
                    label="Organisation eligibility"
                    items={grant.organisationEligibility}
                  />
                  <ListField label="Requirements" items={grant.requirements} />
                </Section>

                <Section title="Geographic scope">
                  <ListField label="Eligible countries / regions" items={grant.eligibleCountries} />
                </Section>

                <Section title="Why it matches">
                  <Field label="Summary" value={grant.whyItMatches} />
                  <ListField label="Match reasons" items={grant.matchReasons} />
                </Section>

                <Section title="Source">
                  {grant.sourceUrl.trim() ? (
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
                    <p className="text-xs italic text-muted-foreground">
                      Not available in demo data.
                    </p>
                  )}
                </Section>

                {grant.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 border-t border-border pt-4">
                    {grant.tags.map((t) => (
                      <Badge key={t} variant="secondary" className="font-normal">
                        {t}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <SheetFooter className="shrink-0 flex-row flex-wrap gap-2 border-t border-border px-5 py-4 sm:justify-start">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  onAsk(grant);
                  onOpenChange(false);
                }}
                className="rounded-lg hover:bg-muted"
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
                className="rounded-lg bg-brand text-white shadow-sm hover:bg-brand/90"
              >
                Start application
              </Button>
              <SheetClose asChild>
                <Button
                  type="button"
                  variant="ghost"
                  className="rounded-lg hover:bg-muted sm:ml-auto"
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
  return (
    <div className={cn("flex items-center gap-3 rounded-lg p-2.5 ring-1", cls.ring)}>
      <div className={cn("text-2xl font-bold leading-none tabular-nums", cls.text)}>
        {percentage}%
      </div>
      <div className={cn("text-xs font-medium", cls.text)}>{MATCH_TIER_LABEL[tier]}</div>
    </div>
  );
}

function DeadlineRow({ deadline }: { deadline: string }) {
  const urgency = deadlineUrgency(deadline);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm font-medium text-foreground">{formatDeadline(deadline)}</span>
      {urgency === "expired" && (
        <Badge variant="outline" className="border-destructive/40 text-destructive">
          Expired
        </Badge>
      )}
      {urgency === "urgent" && (
        <Badge variant="outline" className="border-warning/50 text-warning">
          Closing soon
        </Badge>
      )}
    </div>
  );
}
