import { useMemo } from "react";
import { KeyRound, LogOut, ShieldCheck, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface AccountModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSignOut: () => void;
}

function getUserEmail(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem("gi.auth.email");
  } catch {
    return null;
  }
}

export function AccountModal({ open, onOpenChange, onSignOut }: AccountModalProps) {
  const userEmail = useMemo(() => getUserEmail(), []);
  const userInitial = (userEmail ? userEmail[0] : "U").toUpperCase();
  const displayName = userEmail ?? "Grant Consultant";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand/15 text-brand text-sm font-semibold uppercase">
              {userInitial}
            </div>
            <div>
              <DialogTitle className="text-base">Account Profile</DialogTitle>
              <DialogDescription className="text-xs">
                Manage your active session and workspace identity
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="py-2">
          {/* Account Identity Card */}
          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-muted-foreground">Email Address</span>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                <ShieldCheck className="h-3 w-3" /> Active
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <User className="h-4 w-4 text-brand" />
              <span>{displayName}</span>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={() => {
              onOpenChange(false);
              onSignOut();
            }}
            className="w-full sm:w-auto gap-1.5"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign out
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="w-full sm:w-auto"
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
