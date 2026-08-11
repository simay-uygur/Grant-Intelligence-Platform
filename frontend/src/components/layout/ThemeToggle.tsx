import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

// Plain light ↔ dark toggle. The icon, tooltip and aria-label all describe the
// ACTION the button performs, not the current mode: in light mode it offers a
// moon ("Switch to dark mode"), in dark mode a sun ("Switch to light mode").
export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";
  const Icon = isDark ? Sun : Moon;
  const label = isDark ? "Switch to light mode" : "Switch to dark mode";

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={toggleTheme}
            aria-label={label}
            className="shrink-0 rounded-lg"
          >
            <Icon className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
