import { useState, useEffect, useMemo, useRef } from "react";
import {
  ArrowDown,
  ArrowUp,
  ChevronsDown,
  ChevronsUp,
  ExternalLink,
  GripVertical,
  Loader2,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
} from "lucide-react";
import type { Grant, OrganisationProfile, OutlineSection } from "@/types";
import { applicationService } from "@/services";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { stripLeadingNumber } from "@/utils/text";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  grant: Grant | null;
  profile: OrganisationProfile | null;
  conversationId?: string;
  onConfirm: (sections: OutlineSection[]) => void;
}

export function OutlinePreviewModal({
  open,
  onOpenChange,
  grant,
  profile,
  conversationId,
  onConfirm,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [sections, setSections] = useState<OutlineSection[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const effectiveProfile: OrganisationProfile = useMemo(
    () =>
      profile ?? {
        organisationName: "Your Organisation",
        organisationType: "SME",
        organisationDescription: "European Innovation Partner",
        country: "Germany",
        region: "Western Europe",
        projectTitle: grant?.title ?? "Grant Proposal",
        projectDescription: `Proposal for ${grant?.title ?? "Grant"}`,
        sector: "Technology & Innovation",
        fundingAmount: grant?.fundingAmount || "€1,000,000",
        projectStartDate: "2027-01-01",
        projectDuration: "24 months",
        eligibilityConstraints: "None",
      },
    [grant?.fundingAmount, grant?.title, profile],
  );

  useEffect(() => {
    if (!open || !grant) return;
    let isCurrent = true;
    setLoading(true);
    setIsAdding(false);
    setEditingId(null);
    setDraggedIndex(null);
    setDragOverIndex(null);

    const fetchOutline = async () => {
      try {
        if (applicationService.generateOutline) {
          const generated = await applicationService.generateOutline(grant, effectiveProfile, {
            conversationId,
          });
          if (isCurrent && generated && generated.length > 0) {
            setSections(
              generated.map((s) => ({
                ...s,
                title: stripLeadingNumber(s.title),
              })),
            );
            setLoading(false);
            return;
          }
        }
      } catch (err) {
        console.warn("Failed to generate adaptive outline:", err);
      }
      if (isCurrent) {
        setSections([
          {
            id: "project-objectives-excellence",
            title: "Project Objectives & Excellence",
            description: "Scientific & technical objectives.",
            targetWords: 150,
          },
          {
            id: "proposed-solution-innovation",
            title: "Proposed Solution & Innovation",
            description: "Novelty and methodology.",
            targetWords: 150,
          },
          {
            id: "expected-impact",
            title: "Expected Impact & Exploitation",
            description: "Target outcomes and scale.",
            targetWords: 150,
          },
          {
            id: "work-plan-implementation",
            title: "Work Plan & Implementation",
            description: "Work packages and delivery.",
            targetWords: 150,
          },
          {
            id: "budget-resources",
            title: "Budget & Resource Allocation",
            description: "Cost breakdown.",
            targetWords: 120,
          },
          {
            id: "risk-management-timeline",
            title: "Risk Management & Timeline",
            description: "Mitigation measures.",
            targetWords: 120,
          },
        ]);
        setLoading(false);
      }
    };

    fetchOutline();
    return () => {
      isCurrent = false;
    };
  }, [open, grant, effectiveProfile, conversationId]);

  if (!grant) return null;

  const handleMove = (index: number, direction: "up" | "down" | "top" | "bottom") => {
    if (index < 0 || index >= sections.length) return;
    const next = [...sections];
    const item = next[index];

    if (direction === "top") {
      if (index === 0) return;
      next.splice(index, 1);
      next.unshift(item);
    } else if (direction === "bottom") {
      if (index === sections.length - 1) return;
      next.splice(index, 1);
      next.push(item);
    } else if (direction === "up") {
      if (index === 0) return;
      next[index] = next[index - 1];
      next[index - 1] = item;
    } else if (direction === "down") {
      if (index === sections.length - 1) return;
      next[index] = next[index + 1];
      next[index + 1] = item;
    }
    setSections(next);
  };

  const handleContainerDragOver = (e: React.DragEvent) => {
    if (!containerRef.current || draggedIndex === null) return;
    const rect = containerRef.current.getBoundingClientRect();
    const edgeThreshold = 70;
    const clientY = e.clientY;

    if (clientY <= rect.top + edgeThreshold) {
      const dist = Math.max(0, clientY - rect.top);
      const intensity = Math.max(4, Math.floor((edgeThreshold - dist) / 2) + 2);
      containerRef.current.scrollTop -= intensity;
    } else if (clientY >= rect.bottom - edgeThreshold) {
      const dist = Math.max(0, rect.bottom - clientY);
      const intensity = Math.max(4, Math.floor((edgeThreshold - dist) / 2) + 2);
      containerRef.current.scrollTop += intensity;
    }
  };

  const handleDrop = (targetIndex: number) => {
    if (draggedIndex === null || draggedIndex === targetIndex) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }
    const next = [...sections];
    const [removed] = next.splice(draggedIndex, 1);
    next.splice(targetIndex, 0, removed);
    setSections(next);
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDelete = (id: string) => {
    setSections((prev) => prev.filter((s) => s.id !== id));
  };

  const handleAdd = (position: "top" | "bottom" = "bottom") => {
    if (!newTitle.trim()) return;
    const cleanTitle = stripLeadingNumber(newTitle.trim());
    const slug = cleanTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const newSection: OutlineSection = {
      id: `custom-${slug}-${Date.now()}`,
      title: cleanTitle,
      description: newDesc.trim() || undefined,
      targetWords: 150,
    };

    setSections((prev) => (position === "top" ? [newSection, ...prev] : [...prev, newSection]));
    setNewTitle("");
    setNewDesc("");
    setIsAdding(false);
  };

  const handleUpdateTitle = (id: string, title: string) => {
    setSections((prev) => prev.map((s) => (s.id === id ? { ...s, title } : s)));
  };

  const handleUpdateDesc = (id: string, description: string) => {
    setSections((prev) => prev.map((s) => (s.id === id ? { ...s, description } : s)));
  };

  const totalWords = sections.reduce((sum, s) => sum + (s.targetWords || 150), 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        onDragOver={handleContainerDragOver}
        className="max-w-2xl max-h-[90vh] flex flex-col p-6 rounded-2xl"
      >
        <DialogHeader className="border-b border-border pb-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-brand uppercase tracking-wider">
            <Sparkles className="h-4 w-4 text-brand" />
            Adaptive Application Outline
          </div>
          <DialogTitle className="text-xl font-bold text-foreground">{grant.title}</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
            <span>{grant.programme || "Grant Programme"}</span>
            {grant.sourceUrl && (
              <>
                <span>·</span>
                <a
                  href={grant.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-brand hover:underline font-medium"
                >
                  <ExternalLink className="h-3 w-3" />
                  View Official Call
                </a>
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <div
          ref={containerRef}
          onDragOver={handleContainerDragOver}
          className="flex-1 overflow-y-auto py-3 space-y-3 pr-1"
        >
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-3">
              <Loader2 className="h-6 w-6 animate-spin text-brand" />
              <p className="text-sm font-medium">
                Analyzing call requirements and tailoring proposal outline...
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between text-xs text-muted-foreground px-1 pb-1">
                <span>
                  {sections.length} proposal sections (~{totalWords} words target)
                </span>
                <span>Drag or use arrows to arrange order</span>
              </div>

              <div className="space-y-2.5">
                {sections.map((section, idx) => {
                  const isEditing = editingId === section.id;
                  const isDragging = draggedIndex === idx;
                  const isDragTarget = dragOverIndex === idx && draggedIndex !== idx;

                  return (
                    <div
                      key={section.id}
                      draggable={!isEditing}
                      onDragStart={(e) => {
                        e.dataTransfer.setData("text/plain", `${idx}`);
                        setDraggedIndex(idx);
                      }}
                      onDragOver={(e) => {
                        e.preventDefault();
                        handleContainerDragOver(e);
                        if (dragOverIndex !== idx) setDragOverIndex(idx);
                      }}
                      onDragLeave={() => {
                        if (dragOverIndex === idx) setDragOverIndex(null);
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        handleDrop(idx);
                      }}
                      className={cn(
                        "group flex flex-col rounded-xl border border-border bg-card p-3 shadow-xs transition-all",
                        isDragging && "opacity-40 border-dashed border-brand",
                        isDragTarget && "border-brand ring-2 ring-brand/20 bg-brand/5",
                        !isDragging && !isDragTarget && "hover:border-brand/40",
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <button
                            type="button"
                            aria-label="Drag handle to reorder section"
                            className="cursor-grab active:cursor-grabbing text-muted-foreground/50 hover:text-foreground p-0.5"
                          >
                            <GripVertical className="h-4 w-4" />
                          </button>
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-semibold text-muted-foreground tabular-nums">
                            {idx + 1}
                          </span>
                          {isEditing ? (
                            <Input
                              value={section.title}
                              onChange={(e) => handleUpdateTitle(section.id, e.target.value)}
                              className="h-7 text-xs font-semibold"
                            />
                          ) : (
                            <span className="text-xs font-semibold text-foreground truncate">
                              {stripLeadingNumber(section.title)}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-0.5 shrink-0">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            disabled={idx === 0}
                            onClick={() => handleMove(idx, "top")}
                            className="h-6 w-6 text-muted-foreground hover:text-brand"
                            title="Move to top"
                          >
                            <ChevronsUp className="h-3 w-3" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            disabled={idx === 0}
                            onClick={() => handleMove(idx, "up")}
                            className="h-6 w-6 text-muted-foreground hover:text-foreground"
                            title="Move section up"
                          >
                            <ArrowUp className="h-3 w-3" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            disabled={idx === sections.length - 1}
                            onClick={() => handleMove(idx, "down")}
                            className="h-6 w-6 text-muted-foreground hover:text-foreground"
                            title="Move section down"
                          >
                            <ArrowDown className="h-3 w-3" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            disabled={idx === sections.length - 1}
                            onClick={() => handleMove(idx, "bottom")}
                            className="h-6 w-6 text-muted-foreground hover:text-brand"
                            title="Move to bottom"
                          >
                            <ChevronsDown className="h-3 w-3" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => setEditingId(isEditing ? null : section.id)}
                            className="h-6 w-6 text-muted-foreground hover:text-foreground"
                            title={isEditing ? "Done editing" : "Edit section"}
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(section.id)}
                            className="h-6 w-6 text-destructive/70 hover:text-destructive"
                            title="Remove section"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>

                      {isEditing ? (
                        <div className="mt-2 pl-12">
                          <Textarea
                            value={section.description || ""}
                            onChange={(e) => handleUpdateDesc(section.id, e.target.value)}
                            placeholder="Section guidance notes..."
                            className="text-xs min-h-[50px] resize-none"
                          />
                        </div>
                      ) : section.description ? (
                        <p className="mt-1 pl-12 text-[11px] text-muted-foreground leading-relaxed">
                          {section.description}
                        </p>
                      ) : null}
                    </div>
                  );
                })}
              </div>

              {isAdding ? (
                <div className="rounded-xl border border-dashed border-brand/50 bg-brand/5 p-3 space-y-2">
                  <Input
                    placeholder="New Section Title (e.g. Exploitation & Business Model)"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    className="h-8 text-xs font-semibold bg-background"
                  />
                  <Textarea
                    placeholder="Optional coverage guidance for this section..."
                    value={newDesc}
                    onChange={(e) => setNewDesc(e.target.value)}
                    className="text-xs min-h-[45px] bg-background resize-none"
                  />
                  <div className="flex flex-wrap items-center justify-end gap-1.5 pt-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsAdding(false)}
                      className="h-7 text-xs"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleAdd("top")}
                      className="h-7 text-xs border-brand/40 text-brand hover:bg-brand/10"
                    >
                      <ChevronsUp className="h-3 w-3 mr-1" />
                      Add at Top (Position 1)
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => handleAdd("bottom")}
                      className="h-7 text-xs bg-brand text-white hover:bg-brand/90"
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Add at End
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsAdding(true)}
                  className="w-full border-dashed text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 py-4 rounded-xl"
                >
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Add Custom Section
                </Button>
              )}
            </>
          )}
        </div>

        <DialogFooter className="border-t border-border pt-4 flex sm:justify-between items-center">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="text-xs"
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={loading || sections.length === 0}
            onClick={() => {
              onOpenChange(false);
              onConfirm(sections);
            }}
            className="bg-brand text-white hover:bg-brand/90 text-xs shadow-xs"
          >
            <Sparkles className="h-3.5 w-3.5 mr-1.5" />
            Generate Full Application ({sections.length} Sections)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
