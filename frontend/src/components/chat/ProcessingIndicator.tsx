import { Compass } from "lucide-react";

export function ProcessingIndicator() {
  return (
    <li className="flex gap-3" aria-hidden="true">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand">
        <Compass className="h-4 w-4" />
      </div>
      <div className="flex items-center gap-1 rounded-xl bg-muted px-4 py-3.5">
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/50 [animation-delay:-0.3s]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/50 [animation-delay:-0.15s]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/50" />
      </div>
    </li>
  );
}
