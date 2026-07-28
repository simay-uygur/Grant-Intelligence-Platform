import { Landmark, Plus, Trash2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { Conversation } from "@/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

interface SidebarProps {
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
}

function SidebarContent({
  conversations,
  activeId,
  onSelect,
  onNew,
  onDelete,
  onNavigate,
}: SidebarProps & { onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 px-5 py-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand text-white">
          <Landmark className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold">Grant Intelligence</div>
          <div className="truncate text-xs text-sidebar-foreground/60">
            Research &amp; application workspace
          </div>
        </div>
      </div>

      <div className="px-4 pb-3">
        <Button
          type="button"
          onClick={() => {
            onNew();
            onNavigate?.();
          }}
          className="w-full rounded-lg bg-brand text-white shadow-sm hover:bg-brand/90 focus:outline-none focus:ring-2 focus:ring-brand/50"
        >
          <Plus className="h-4 w-4" />
          New conversation
        </Button>
      </div>

      <div className="px-5 pb-2 text-[11px] font-medium uppercase tracking-wider text-sidebar-foreground/50">
        Conversations
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto px-2">
        <ul className="space-y-1">
          {conversations.map((c) => {
            const active = c.id === activeId;
            return (
              <li key={c.id} className="group relative">
                <button
                  type="button"
                  aria-current={active ? "true" : undefined}
                  onClick={() => {
                    onSelect(c.id);
                    onNavigate?.();
                  }}
                  className={cn(
                    "block w-full cursor-pointer rounded-lg px-3 py-2 pr-9 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
                    active
                      ? "bg-sidebar-accent text-white"
                      : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-white",
                  )}
                >
                  <div className="truncate font-medium">{c.title}</div>
                  <div className="mt-0.5 truncate text-[11px] text-sidebar-foreground/50">
                    {formatDistanceToNow(new Date(c.updatedAt), {
                      addSuffix: true,
                    })}
                  </div>
                </button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(c.id);
                  }}
                  aria-label="Delete conversation"
                  className="absolute right-2 top-2 h-auto w-auto rounded-md p-1.5 text-sidebar-foreground/70 opacity-100 transition-opacity hover:bg-white/10 hover:text-white md:opacity-0 md:group-hover:opacity-100 md:focus:opacity-100"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </li>
            );
          })}
          {conversations.length === 0 && (
            <li className="px-3 py-4 text-xs text-sidebar-foreground/50">
              You don&apos;t have any conversations yet. Use the button above to start one.
            </li>
          )}
        </ul>
      </nav>

      <div className="mt-auto flex items-center border-t border-sidebar-border/60 px-4 py-3">
        <div className="flex items-center gap-2 text-[11px] text-sidebar-foreground/50">
          <span className="h-1.5 w-1.5 rounded-full bg-success/70" />
          Local / mock mode
        </div>
      </div>
    </div>
  );
}

/** Desktop sidebar: always in the layout at md+ widths, hidden below that. */
export function Sidebar(props: SidebarProps) {
  return (
    <aside className="hidden h-screen w-72 shrink-0 border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:block">
      <SidebarContent {...props} />
    </aside>
  );
}

/** Mobile/small-tablet sidebar: off-canvas Sheet, opened via a header trigger. */
export function MobileSidebar({
  open,
  onOpenChange,
  ...props
}: SidebarProps & { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="left"
        className="w-72 max-w-[85vw] border-sidebar-border bg-sidebar p-0 text-sidebar-foreground [&>button]:text-sidebar-foreground/70 [&>button]:hover:bg-white/10 [&>button]:hover:text-white [&>button]:focus:ring-brand md:hidden"
      >
        <SheetHeader className="sr-only">
          <SheetTitle>Conversations</SheetTitle>
          <SheetDescription>
            Browse, start, or delete grant research conversations.
          </SheetDescription>
        </SheetHeader>
        <SidebarContent {...props} onNavigate={() => onOpenChange(false)} />
      </SheetContent>
    </Sheet>
  );
}
