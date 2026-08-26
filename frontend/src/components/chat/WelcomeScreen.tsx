import { Compass, FileText, Scale, Search, ShieldCheck } from "lucide-react";
import type { ComponentType } from "react";
import { Button } from "@/components/ui/button";

interface Suggestion {
  label: string;
  icon: ComponentType<{ className?: string }>;
  action: () => void;
}

interface Props {
  onQuickStart: (text: string) => void;
  onFillComposer: (text: string) => void;
  isMockMode: boolean;
}

export function WelcomeScreen({ onQuickStart, onFillComposer, isMockMode }: Props) {
  const suggestions: Suggestion[] = [
    {
      label: "Find grants for my organisation",
      icon: Search,
      action: () => onQuickStart("I'd like to find grants for my organisation."),
    },
    {
      label: "Check project eligibility",
      icon: ShieldCheck,
      action: () => onFillComposer("Can you help me check if my project is eligible for funding?"),
    },
    {
      label: "Compare funding opportunities",
      icon: Scale,
      action: () =>
        onFillComposer("I'd like to compare a few funding opportunities for my project."),
    },
    {
      label: "Start an application draft",
      icon: FileText,
      action: () => onFillComposer("I'd like to start drafting a grant application."),
    },
  ];

  return (
    <div className="flex h-full flex-col items-center justify-center px-4 py-8 text-center">
      {/* Same size/shape/tint as the assistant avatar in ChatMessageItem, so the compass icon reads as one consistent identity mark everywhere. */}
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand/10 text-brand">
        <Compass className="h-4 w-4" />
      </div>

      <h2 className="mt-4 text-lg font-semibold text-foreground">
        Find grants that match your organisation
      </h2>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        Tell me about your organisation and project. I&apos;ll walk you through a short profile,
        show matched funding programmes, and help you draft an application — all in this
        conversation.
      </p>

      <div className="mt-6 grid w-full max-w-md grid-cols-1 gap-3 sm:grid-cols-2">
        {suggestions.map((s) => (
          <Button
            key={s.label}
            type="button"
            variant="outline"
            onClick={s.action}
            className="h-auto w-full items-center justify-start gap-3 rounded-xl border-border px-3.5 py-3 text-left shadow-sm transition-colors hover:border-brand/40 hover:bg-brand/5 hover:shadow"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand">
              <s.icon className="h-4 w-4" />
            </span>
            <span className="min-w-0 whitespace-normal text-sm font-medium text-foreground">
              {s.label}
            </span>
          </Button>
        ))}
      </div>

      <p className="mt-6 max-w-md text-[11px] text-muted-foreground">
        {isMockMode
          ? "Mock mode — this demo uses local sample data only. No real grant databases or AI models are connected."
          : "Connected to live European grant opportunities and AI-powered drafting."}
      </p>
    </div>
  );
}
