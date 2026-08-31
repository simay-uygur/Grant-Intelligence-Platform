import type { ComponentType } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export interface EmptyStateAction {
  label: string;
  onClick: () => void;
  icon?: ComponentType<{ className?: string }>;
}

interface EmptyStateProps {
  /** Decorative — the heading carries the meaning, so it's hidden from AT. */
  icon?: ComponentType<{ className?: string }>;
  title: string;
  /** One muted line. Say what this surface will hold and how it gets filled. */
  description?: string;
  action?: EmptyStateAction;
  /**
   * Must slot into the surrounding document outline — h3 under the pipeline's
   * h2, h4 inside a status column whose own heading is an h3. There is no
   * sensible default that is right in both places, so callers pass it.
   */
  headingLevel: "h2" | "h3" | "h4";
  /**
   * `panel` fills a whole view; `inline` is for a slot inside an existing
   * container (a kanban column), where a full-height treatment would shout.
   */
  variant?: "panel" | "inline";
  className?: string;
}

/**
 * The shared empty-state primitive. It deliberately isn't a grey "no items"
 * box: a dashed edge reads as a container waiting to be filled, the icon
 * reuses the brand chip used for the assistant identity mark elsewhere, and
 * the copy is the caller's job — every surface gets its own words, because an
 * empty pipeline is a different moment from a fresh conversation.
 *
 * All colours come from design tokens, so both variants follow the theme.
 * The icon glyph switches to --foreground in dark mode because --brand has no
 * .dark override and would otherwise sit at roughly 1.9:1 on a dark surface.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  headingLevel: Heading,
  variant = "panel",
  className,
}: EmptyStateProps) {
  const isPanel = variant === "panel";
  const ActionIcon = action?.icon;

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border border-dashed border-border text-center",
        isPanel ? "gap-1.5 bg-muted/30 px-6 py-14" : "gap-1 px-3 py-6",
        className,
      )}
    >
      {Icon &&
        (isPanel ? (
          <span
            aria-hidden="true"
            className="mb-2 flex h-11 w-11 items-center justify-center rounded-xl bg-brand/10 text-brand"
          >
            <Icon className="h-5 w-5" />
          </span>
        ) : (
          <Icon className="mb-0.5 h-4 w-4 text-muted-foreground" aria-hidden="true" />
        ))}

      <Heading
        className={cn(
          "font-semibold text-foreground",
          isPanel ? "text-base" : "text-xs leading-snug",
        )}
      >
        {title}
      </Heading>

      {description && (
        <p
          className={cn(
            "text-muted-foreground",
            isPanel ? "max-w-md text-sm leading-relaxed" : "text-[11px] leading-snug",
          )}
        >
          {description}
        </p>
      )}

      {action && (
        <Button
          type="button"
          onClick={action.onClick}
          className={cn(
            "rounded-lg bg-brand text-brand-foreground shadow-sm hover:bg-brand/90",
            isPanel ? "mt-5" : "mt-2 h-8 px-2.5 text-xs",
          )}
        >
          {ActionIcon && <ActionIcon className={isPanel ? "h-4 w-4" : "h-3.5 w-3.5"} />}
          {action.label}
        </Button>
      )}
    </div>
  );
}
