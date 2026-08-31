import { useId, useMemo, useRef, useState } from "react";
import {
  Bookmark,
  FileText,
  KanbanSquare,
  Landmark,
  LogOut,
  MessagesSquare,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { Conversation } from "@/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

/** Which main view the app is showing. Local UI state only — never persisted. */
export type MainView = "chat" | "pipeline" | "saved" | "workspace";

export interface SidebarProps {
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onRename: (id: string, title: string) => void;
  onDelete: (id: string) => void;
  mainView: MainView;
  onSelectView: (view: MainView) => void;
  /** Bookmark count shown beside the Saved item; live via useShortlist. */
  savedCount?: number;
  /** Clears the mock auth flag (see useAuth) and returns to the login screen. */
  onSignOut?: () => void;
  isMockMode?: boolean;
}

const VIEWS: { id: MainView; label: string; icon: typeof MessagesSquare }[] = [
  { id: "chat", label: "Chat", icon: MessagesSquare },
  { id: "workspace", label: "Workspace", icon: FileText },
  { id: "pipeline", label: "Pipeline", icon: KanbanSquare },
  { id: "saved", label: "Saved", icon: Bookmark },
];

function SidebarContent({
  conversations,
  activeId,
  onSelect,
  onNew,
  onRename,
  onDelete,
  mainView,
  onSelectView,
  savedCount,
  onSignOut,
  onNavigate,
}: SidebarProps & { onNavigate?: () => void }) {
  const searchId = useId();
  const renameId = useId();
  const [query, setQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  // Set on Escape so the blur that follows the input unmounting doesn't
  // commit the very edit the user just cancelled.
  const cancelledRef = useRef(false);
  // Marks the row whose select button should take focus once editing ends,
  // so focus never falls back to the document body.
  const restoreFocusRef = useRef<string | null>(null);

  const startRename = (id: string, currentTitle: string) => {
    cancelledRef.current = false;
    setDraftTitle(currentTitle);
    setEditingId(id);
  };

  const endRename = (id: string) => {
    restoreFocusRef.current = id;
    setEditingId(null);
    setDraftTitle("");
  };

  // A blank or unchanged title is rejected by renameConversation itself, so
  // committing one is simply a no-op — no storage write, no title lost.
  const commitRename = (id: string) => {
    onRename(id, draftTitle);
    endRename(id);
  };

  const cancelRename = (id: string) => {
    cancelledRef.current = true;
    endRename(id);
  };

  // Display-side only: `conversations` arrives already loaded, and filtering
  // it for render never mutates, reorders, or persists anything. An empty
  // query passes the original array straight through, so the default list is
  // byte-for-byte what it was before — same order, same active highlight.
  const needle = query.trim().toLowerCase();
  const visible = useMemo(
    () =>
      needle ? conversations.filter((c) => c.title.toLowerCase().includes(needle)) : conversations,
    [conversations, needle],
  );

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 px-5 py-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
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
          className="w-full rounded-lg bg-sidebar-primary text-sidebar-primary-foreground shadow-sm hover:bg-sidebar-primary/90 focus:outline-none focus:ring-2 focus:ring-sidebar-ring"
        >
          <Plus className="h-4 w-4" />
          New conversation
        </Button>
      </div>

      {/* Switches the main area between the chat and the global pipeline
          dashboard. Purely a view switch — it doesn't touch conversations. */}
      <nav aria-label="Views" className="px-2 pb-3">
        {/* Explicit role: Tailwind's preflight sets list-style:none, which
            drops list semantics in Safari/VoiceOver. */}
        <ul role="list" className="space-y-1">
          {VIEWS.map(({ id, label, icon: Icon }) => {
            const current = mainView === id;
            return (
              <li key={id}>
                <button
                  type="button"
                  aria-current={current ? "page" : undefined}
                  onClick={() => {
                    onSelectView(id);
                    onNavigate?.();
                  }}
                  className={cn(
                    "flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
                    current
                      ? "bg-sidebar-accent text-white"
                      : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-white",
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {label}
                  {id === "saved" && (savedCount ?? 0) > 0 && (
                    <span
                      className="ml-auto rounded-full bg-sidebar-accent/70 px-2 py-0.5 text-[11px] font-medium text-sidebar-foreground/90"
                      aria-label={`${savedCount} saved ${savedCount === 1 ? "grant" : "grants"}`}
                    >
                      {savedCount}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="px-5 pb-2 text-[11px] font-medium uppercase tracking-wider text-sidebar-foreground/50">
        Conversations
      </div>

      {/* Only worth showing once there's something to search through. */}
      {conversations.length > 0 && (
        <div className="px-4 pb-3">
          <label htmlFor={searchId} className="sr-only">
            Search conversations
          </label>
          <div className="relative">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-sidebar-foreground/50"
            />
            <Input
              id={searchId}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search conversations…"
              // Sidebar palette rather than the main surface's input tokens,
              // and the WebKit clear affordance is suppressed in favour of the
              // button below, so there's never a second × in Chrome/Safari.
              className="border-sidebar-border bg-sidebar-accent/30 pl-8 pr-8 text-sm placeholder:text-sidebar-foreground/40 focus-visible:ring-sidebar-ring [&::-webkit-search-cancel-button]:appearance-none"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Clear search"
                className="absolute right-1.5 top-1/2 -translate-y-1/2 cursor-pointer rounded-md p-1 text-sidebar-foreground/60 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          {/* Polite: the count is read after the keystroke echo, and focus
              stays in the field the whole time. */}
          <p role="status" aria-live="polite" className="sr-only">
            {needle ? `${visible.length} of ${conversations.length} conversations match` : ""}
          </p>
        </div>
      )}

      <nav className="min-h-0 flex-1 overflow-y-auto px-2">
        <ul role="list" className="space-y-1">
          {visible.map((c) => {
            const active = c.id === activeId;
            const editing = editingId === c.id;

            if (editing) {
              return (
                <li key={c.id} className="relative">
                  <label htmlFor={`${renameId}-${c.id}`} className="sr-only">
                    Rename conversation
                  </label>
                  <Input
                    id={`${renameId}-${c.id}`}
                    // Focus and select on mount, so typing replaces the old
                    // title immediately and Escape is always one key away.
                    ref={(el) => {
                      el?.select();
                    }}
                    value={draftTitle}
                    maxLength={200}
                    onChange={(e) => setDraftTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        commitRename(c.id);
                      } else if (e.key === "Escape") {
                        e.preventDefault();
                        cancelRename(c.id);
                      }
                    }}
                    onBlur={() => {
                      if (cancelledRef.current) {
                        cancelledRef.current = false;
                        return;
                      }
                      commitRename(c.id);
                    }}
                    className="border-sidebar-border bg-sidebar-accent/30 text-sm placeholder:text-sidebar-foreground/40 focus-visible:ring-sidebar-ring"
                  />
                </li>
              );
            }

            return (
              <li key={c.id} className="group relative">
                <button
                  type="button"
                  aria-current={active ? "true" : undefined}
                  // Takes focus back when this row's rename ends, so focus
                  // never lands on the body after a commit or cancel.
                  ref={(el) => {
                    if (el && restoreFocusRef.current === c.id) {
                      restoreFocusRef.current = null;
                      el.focus();
                    }
                  }}
                  onClick={() => {
                    onSelect(c.id);
                    onNavigate?.();
                  }}
                  className={cn(
                    "block w-full cursor-pointer rounded-lg px-3 py-2 pr-16 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
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
                {/* Row actions share one revealed-on-hover container, so
                    keyboard focus on either one keeps both visible. */}
                <div className="absolute right-1.5 top-1.5 flex items-center gap-0.5 opacity-100 transition-opacity md:opacity-0 md:group-focus-within:opacity-100 md:group-hover:opacity-100">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation();
                      startRename(c.id, c.title);
                    }}
                    aria-label={`Rename conversation: ${c.title}`}
                    className="h-auto w-auto rounded-md p-1.5 text-sidebar-foreground/70 hover:bg-white/10 hover:text-white"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(c.id);
                    }}
                    // Named per row: a screen reader listing the page's
                    // buttons would otherwise read "Delete conversation" once
                    // per conversation with no way to tell them apart.
                    aria-label={`Delete conversation: ${c.title}`}
                    className="h-auto w-auto rounded-md p-1.5 text-sidebar-foreground/70 hover:bg-white/10 hover:text-white"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </li>
            );
          })}
          {conversations.length === 0 && (
            <li className="px-3 py-4 text-xs text-sidebar-foreground/50">
              You don&apos;t have any conversations yet. Use the button above to start one.
            </li>
          )}
          {/* A search that finds nothing is a normal outcome, not a failure —
              same muted treatment as the "no conversations yet" line. */}
          {conversations.length > 0 && visible.length === 0 && (
            <li className="px-3 py-4 text-xs text-sidebar-foreground/50">
              No conversations match &ldquo;{query.trim()}&rdquo;.
            </li>
          )}
        </ul>
      </nav>

      <div className="mt-auto flex items-center justify-between gap-2 border-t border-sidebar-border/60 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2 text-[11px] text-sidebar-foreground/50">
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-success/70" />
          <span className="truncate">Connected</span>
        </div>
        {onSignOut && (
          <button
            type="button"
            onClick={onSignOut}
            className="inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-1 text-[11px] font-medium text-sidebar-foreground/60 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
          >
            <LogOut className="h-3 w-3" />
            Sign out
          </button>
        )}
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
        className="w-72 max-w-[85vw] border-sidebar-border bg-sidebar p-0 text-sidebar-foreground [&>button]:text-sidebar-foreground/70 [&>button]:hover:bg-white/10 [&>button]:hover:text-white [&>button]:focus:ring-sidebar-ring md:hidden"
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
