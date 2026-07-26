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
}

export function WelcomeScreen({ onQuickStart, onFillComposer }: Props) {
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
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand/10 text-brand">
        <Compass className="h-5 w-5" />
      </div>

      <h2 className="mt-4 text-lg font-semibold text-foreground">
        Find grants that match your organisation
      </h2>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        Tell me about your organisation and project. I&apos;ll walk you through a short profile,
        show matched funding programmes, and help you draft an application — all in this
        conversation.
      </p>

      <div className="mt-6 grid w-full max-w-md grid-cols-1 gap-2 sm:grid-cols-2">
        {suggestions.map((s) => (
          <Button
            key={s.label}
            type="button"
            variant="outline"
            onClick={s.action}
            className="h-auto w-full justify-start gap-2 rounded-lg px-3 py-2.5 hover:bg-muted"
          >
            <s.icon className="h-4 w-4 shrink-0 text-brand" />
            <span className="min-w-0 whitespace-normal text-left text-sm font-medium">
              {s.label}
            </span>
          </Button>
        ))}
      </div>

      <p className="mt-6 max-w-md text-[11px] text-muted-foreground">
        Mock mode — this demo uses local sample data only. No real grant databases or AI models are
        connected.
      </p>
    </div>
  );
}
