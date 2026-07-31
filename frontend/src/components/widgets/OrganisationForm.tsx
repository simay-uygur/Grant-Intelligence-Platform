import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Check, Wand2 } from "lucide-react";
import type { OrganisationProfile } from "@/types";
import { cn } from "@/lib/utils";
import { Card, CardHeader, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Props {
  initial?: Partial<OrganisationProfile>;
  disabled?: boolean;
  onSubmit: (profile: OrganisationProfile) => void;
}

const ORG_TYPES = [
  "SME",
  "Startup",
  "NGO",
  "University",
  "Research institution",
  "Consultancy",
  "Public organisation",
];

const SECTORS = [
  "Digital & AI",
  "Clean energy",
  "Healthcare",
  "Manufacturing",
  "Agriculture & food",
  "Mobility",
  "Education",
  "Culture & creative",
  "Social innovation",
  "Other",
];

const COUNTRIES = [
  "Austria",
  "Belgium",
  "Bulgaria",
  "Croatia",
  "Cyprus",
  "Czechia",
  "Denmark",
  "Estonia",
  "Finland",
  "France",
  "Germany",
  "Greece",
  "Hungary",
  "Ireland",
  "Italy",
  "Latvia",
  "Lithuania",
  "Luxembourg",
  "Malta",
  "Netherlands",
  "Poland",
  "Portugal",
  "Romania",
  "Slovakia",
  "Slovenia",
  "Spain",
  "Sweden",
];

const BUDGETS = [
  "Under €100,000",
  "€100,000 – €500,000",
  "€500,000 – €1,000,000",
  "€1,000,000 – €2,500,000",
  "Over €2,500,000",
];

const DURATIONS = ["6 months", "12 months", "18 months", "24 months", "36 months"];

const EMPTY: OrganisationProfile = {
  organisationName: "",
  organisationType: "",
  organisationDescription: "",
  country: "",
  region: "",
  projectTitle: "",
  projectDescription: "",
  fundingAmount: "",
  projectStartDate: "",
  projectDuration: "",
  sector: "",
  eligibilityConstraints: "",
};

const SAMPLE_PROFILE: OrganisationProfile = {
  organisationName: "VisionWorks Robotics",
  organisationType: "SME",
  organisationDescription:
    "VisionWorks Robotics builds AI-assisted quality inspection systems for manufacturing teams.",
  country: "Germany",
  region: "Berlin",
  projectTitle: "AI Quality Inspection",
  projectDescription:
    "AI-driven visual quality inspection across three European factory pilots, reducing defects and improving production traceability.",
  fundingAmount: "€500,000 – €1,000,000",
  projectStartDate: "2026-10-01",
  projectDuration: "24 months",
  sector: "Digital & AI",
  eligibilityConstraints: "Open to consortium-based calls and SME innovation grants.",
};

type Step = 1 | 2 | 3;

const STEP_REQUIRED: Record<Step, (keyof OrganisationProfile)[]> = {
  1: ["organisationName", "organisationType", "country"],
  2: ["sector", "projectTitle", "projectDescription"],
  3: ["fundingAmount", "projectDuration"],
};

const ALL_REQUIRED = [...STEP_REQUIRED[1], ...STEP_REQUIRED[2], ...STEP_REQUIRED[3]];

const STEP_COPY: Record<Step, { title: string; subtitle: string }> = {
  1: {
    title: "Tell me about your organisation",
    subtitle: "Organisation basics",
  },
  2: {
    title: "Now, tell me about the project",
    subtitle: "Project details",
  },
  3: {
    title: "Funding and timeline",
    subtitle: "Budget and schedule",
  },
};

const STEP_LABELS: Record<Step, string> = {
  1: "Organisation",
  2: "Project",
  3: "Funding",
};

export function OrganisationForm({ initial, disabled, onSubmit }: Props) {
  const [profile, setProfile] = useState<OrganisationProfile>({
    ...EMPTY,
    ...initial,
  });
  const [step, setStep] = useState<Step>(1);
  const [touched, setTouched] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const cardRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const idPrefix = useId();

  useEffect(() => {
    cardRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    headingRef.current?.focus();
    setAnnouncement(`Step ${step} of 3: ${STEP_LABELS[step]}. ${STEP_COPY[step].title}`);
  }, [step]);

  const set = <K extends keyof OrganisationProfile>(k: K, v: OrganisationProfile[K]) =>
    setProfile((p) => ({ ...p, [k]: v }));

  const missingForStep = (s: Step) => STEP_REQUIRED[s].filter((k) => !profile[k].trim());
  const stepValid = missingForStep(step).length === 0;
  const allValid = ALL_REQUIRED.every((k) => profile[k].trim());

  const invalid = (k: keyof OrganisationProfile) =>
    touched && STEP_REQUIRED[step].includes(k) && !profile[k].trim();

  const fieldError = (k: keyof OrganisationProfile) =>
    invalid(k) ? "This field is required." : undefined;

  const fieldId = (key: string) => `${idPrefix}-${key}`;

  const goBack = () => {
    if (step === 1) return;
    setTouched(false);
    setStep((s) => (s - 1) as Step);
  };

  const goNext = () => {
    setTouched(true);
    if (!stepValid) return;
    if (step < 3) {
      setTouched(false);
      setStep((s) => (s + 1) as Step);
      return;
    }
    if (!allValid) return;
    onSubmit(profile);
  };

  const fillSampleProfile = () => {
    setProfile(SAMPLE_PROFILE);
    setTouched(false);
    setStep(3);
  };

  return (
    <Card ref={cardRef} className="rounded-2xl p-4 shadow-sm sm:p-5">
      <CardHeader className="mb-4 flex flex-col gap-3 space-y-0 p-0">
        <StepIndicator step={step} />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3
              ref={headingRef}
              tabIndex={-1}
              className="text-sm font-semibold text-foreground outline-none"
            >
              {STEP_COPY[step].title}
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">{STEP_COPY[step].subtitle}</p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={fillSampleProfile}
            disabled={disabled}
            className="w-full shrink-0 gap-2 rounded-lg sm:w-auto"
          >
            <Wand2 className="h-3.5 w-3.5" />
            Fill sample
          </Button>
        </div>
      </CardHeader>

      <div aria-live="polite" role="status" className="sr-only">
        {announcement}
      </div>

      <CardContent className="p-0">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {step === 1 && (
            <>
              <Field
                id={fieldId("organisationName")}
                label="Organisation name"
                required
                error={fieldError("organisationName")}
              >
                <Input
                  id={fieldId("organisationName")}
                  className={fieldOverrideCls}
                  value={profile.organisationName}
                  onChange={(e) => set("organisationName", e.target.value)}
                  disabled={disabled}
                  aria-invalid={invalid("organisationName") || undefined}
                  aria-describedby={
                    invalid("organisationName") ? `${fieldId("organisationName")}-error` : undefined
                  }
                  autoFocus
                />
              </Field>
              <Field
                id={fieldId("organisationType")}
                label="Organisation type"
                required
                error={fieldError("organisationType")}
              >
                <Select
                  value={profile.organisationType}
                  onValueChange={(v) => set("organisationType", v)}
                  disabled={disabled}
                >
                  <SelectTrigger
                    id={fieldId("organisationType")}
                    className={cn(
                      selectTriggerCls,
                      invalid("organisationType") && "border-destructive",
                    )}
                    aria-invalid={invalid("organisationType") || undefined}
                    aria-describedby={
                      invalid("organisationType")
                        ? `${fieldId("organisationType")}-error`
                        : undefined
                    }
                  >
                    <SelectValue placeholder="Select…" />
                  </SelectTrigger>
                  <SelectContent>
                    {ORG_TYPES.map((o) => (
                      <SelectItem key={o} value={o}>
                        {o}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field id={fieldId("country")} label="Country" required error={fieldError("country")}>
                <Select
                  value={profile.country}
                  onValueChange={(v) => set("country", v)}
                  disabled={disabled}
                >
                  <SelectTrigger
                    id={fieldId("country")}
                    className={cn(selectTriggerCls, invalid("country") && "border-destructive")}
                    aria-invalid={invalid("country") || undefined}
                    aria-describedby={
                      invalid("country") ? `${fieldId("country")}-error` : undefined
                    }
                  >
                    <SelectValue placeholder="Select…" />
                  </SelectTrigger>
                  <SelectContent>
                    {COUNTRIES.map((o) => (
                      <SelectItem key={o} value={o}>
                        {o}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field id={fieldId("region")} label="Region / city">
                <Input
                  id={fieldId("region")}
                  className={fieldOverrideCls}
                  value={profile.region}
                  onChange={(e) => set("region", e.target.value)}
                  disabled={disabled}
                />
              </Field>
            </>
          )}

          {step === 2 && (
            <>
              <div className="grid grid-cols-1 gap-4 md:col-span-2 md:grid-cols-3">
                <Field id={fieldId("sector")} label="Sector" required error={fieldError("sector")}>
                  <Select
                    value={profile.sector}
                    onValueChange={(v) => set("sector", v)}
                    disabled={disabled}
                  >
                    <SelectTrigger
                      id={fieldId("sector")}
                      className={cn(selectTriggerCls, invalid("sector") && "border-destructive")}
                      aria-invalid={invalid("sector") || undefined}
                      aria-describedby={
                        invalid("sector") ? `${fieldId("sector")}-error` : undefined
                      }
                    >
                      <SelectValue placeholder="Select…" />
                    </SelectTrigger>
                    <SelectContent>
                      {SECTORS.map((o) => (
                        <SelectItem key={o} value={o}>
                          {o}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field
                  id={fieldId("projectTitle")}
                  label="Project title"
                  required
                  error={fieldError("projectTitle")}
                  className="md:col-span-2"
                >
                  <Input
                    id={fieldId("projectTitle")}
                    className={fieldOverrideCls}
                    value={profile.projectTitle}
                    onChange={(e) => set("projectTitle", e.target.value)}
                    disabled={disabled}
                    aria-invalid={invalid("projectTitle") || undefined}
                    aria-describedby={
                      invalid("projectTitle") ? `${fieldId("projectTitle")}-error` : undefined
                    }
                    autoFocus
                  />
                </Field>
              </div>
              <Field
                id={fieldId("organisationDescription")}
                label="Organisation description"
                helper="Optional — a short overview of what your organisation does."
                className="md:col-span-2"
              >
                <Textarea
                  id={fieldId("organisationDescription")}
                  rows={3}
                  className={textareaOverrideCls}
                  value={profile.organisationDescription}
                  onChange={(e) => set("organisationDescription", e.target.value)}
                  disabled={disabled}
                />
              </Field>
              <Field
                id={fieldId("projectDescription")}
                label="Project description"
                required
                error={fieldError("projectDescription")}
                className="md:col-span-2"
              >
                <Textarea
                  id={fieldId("projectDescription")}
                  rows={4}
                  className={cn(textareaOverrideCls, "min-h-[110px]")}
                  value={profile.projectDescription}
                  onChange={(e) => set("projectDescription", e.target.value)}
                  disabled={disabled}
                  aria-invalid={invalid("projectDescription") || undefined}
                  aria-describedby={
                    invalid("projectDescription")
                      ? `${fieldId("projectDescription")}-error`
                      : undefined
                  }
                />
              </Field>
            </>
          )}

          {step === 3 && (
            <>
              <Field
                id={fieldId("fundingAmount")}
                label="Required budget"
                required
                error={fieldError("fundingAmount")}
              >
                <Select
                  value={profile.fundingAmount}
                  onValueChange={(v) => set("fundingAmount", v)}
                  disabled={disabled}
                >
                  <SelectTrigger
                    id={fieldId("fundingAmount")}
                    className={cn(
                      selectTriggerCls,
                      invalid("fundingAmount") && "border-destructive",
                    )}
                    aria-invalid={invalid("fundingAmount") || undefined}
                    aria-describedby={
                      invalid("fundingAmount") ? `${fieldId("fundingAmount")}-error` : undefined
                    }
                    autoFocus
                  >
                    <SelectValue placeholder="Select…" />
                  </SelectTrigger>
                  <SelectContent>
                    {BUDGETS.map((o) => (
                      <SelectItem key={o} value={o}>
                        {o}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field
                id={fieldId("projectStartDate")}
                label="Preferred project start"
                helper="Optional — leave blank if your timeline is flexible."
              >
                <Input
                  id={fieldId("projectStartDate")}
                  type="date"
                  className={fieldOverrideCls}
                  value={profile.projectStartDate}
                  onChange={(e) => set("projectStartDate", e.target.value)}
                  disabled={disabled}
                />
              </Field>
              <Field
                id={fieldId("projectDuration")}
                label="Project duration"
                required
                error={fieldError("projectDuration")}
              >
                <Select
                  value={profile.projectDuration}
                  onValueChange={(v) => set("projectDuration", v)}
                  disabled={disabled}
                >
                  <SelectTrigger
                    id={fieldId("projectDuration")}
                    className={cn(
                      selectTriggerCls,
                      invalid("projectDuration") && "border-destructive",
                    )}
                    aria-invalid={invalid("projectDuration") || undefined}
                    aria-describedby={
                      invalid("projectDuration") ? `${fieldId("projectDuration")}-error` : undefined
                    }
                  >
                    <SelectValue placeholder="Select…" />
                  </SelectTrigger>
                  <SelectContent>
                    {DURATIONS.map((o) => (
                      <SelectItem key={o} value={o}>
                        {o}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field
                id={fieldId("eligibilityConstraints")}
                label="Known eligibility constraints"
                helper="Optional — e.g. must be a consortium of 3+ EU partners."
                className="md:col-span-2"
              >
                <Textarea
                  id={fieldId("eligibilityConstraints")}
                  rows={3}
                  className={cn(textareaOverrideCls, "min-h-[80px]")}
                  value={profile.eligibilityConstraints}
                  onChange={(e) => set("eligibilityConstraints", e.target.value)}
                  disabled={disabled}
                />
              </Field>
            </>
          )}
        </div>

        {step === 3 && (
          <div className="mt-4 rounded-lg border border-border bg-muted/40 p-3">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Review
            </p>
            <dl className="mt-2 grid grid-cols-1 gap-x-4 gap-y-1.5 text-xs sm:grid-cols-2">
              <ReviewRow label="Organisation" value={profile.organisationName} />
              <ReviewRow label="Type" value={profile.organisationType} />
              <ReviewRow
                label="Location"
                value={[profile.country, profile.region].filter(Boolean).join(", ")}
              />
              <ReviewRow label="Sector" value={profile.sector} />
              <ReviewRow label="Project" value={profile.projectTitle} />
            </dl>
          </div>
        )}
      </CardContent>

      <CardFooter className="mt-4 flex flex-col gap-2 p-0 sm:flex-row sm:items-center sm:justify-between">
        <Button
          type="button"
          variant="outline"
          onClick={goBack}
          disabled={disabled || step === 1}
          className="w-full rounded-lg hover:bg-muted sm:w-auto"
        >
          Back
        </Button>
        <Button
          type="button"
          onClick={goNext}
          disabled={disabled || !stepValid || (step === 3 && !allValid)}
          className="w-full rounded-lg bg-brand text-white shadow-sm hover:bg-brand/90 disabled:bg-muted disabled:text-muted-foreground sm:w-auto"
        >
          {step < 3 ? "Continue" : "Research matching grants"}
        </Button>
      </CardFooter>
    </Card>
  );
}

function StepIndicator({ step }: { step: Step }) {
  const steps = ([1, 2, 3] as Step[]).map((n) => ({ n, label: STEP_LABELS[n] }));

  return (
    <ol aria-label="Onboarding steps" className="flex items-start">
      {steps.map(({ n, label }, i) => {
        const status = n < step ? "complete" : n === step ? "current" : "upcoming";
        return (
          <li
            key={n}
            className={cn("flex items-center", i < steps.length - 1 ? "flex-1" : "shrink-0")}
          >
            <div className="flex flex-col items-center gap-1">
              <span
                aria-current={status === "current" ? "step" : undefined}
                className={cn(
                  "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-medium transition-colors",
                  status === "complete" && "bg-brand text-white",
                  status === "current" && "bg-brand text-white ring-4 ring-brand/15",
                  status === "upcoming" && "bg-muted text-muted-foreground",
                )}
              >
                {status === "complete" ? <Check className="h-3.5 w-3.5" /> : n}
              </span>
              <span
                className={cn(
                  "hidden text-[10px] font-medium sm:block",
                  status === "upcoming" ? "text-muted-foreground" : "text-foreground",
                )}
              >
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <span
                aria-hidden="true"
                className={cn(
                  "mx-1.5 mt-3 h-px flex-1 sm:mx-2",
                  status === "complete" ? "bg-brand" : "bg-border",
                )}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2 sm:block">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="truncate font-medium text-foreground" title={value || undefined}>
        {value || "—"}
      </dd>
    </div>
  );
}

const fieldOverrideCls =
  "w-full rounded-lg bg-background px-3 py-2 text-sm text-foreground transition-colors focus-visible:border-brand/60 focus-visible:ring-2 focus-visible:ring-brand/20 disabled:opacity-60";

const selectTriggerCls =
  "w-full justify-between rounded-lg bg-background px-3 py-2 text-sm text-foreground transition-colors focus:border-brand/60 focus:ring-2 focus:ring-brand/20 disabled:opacity-60";

const textareaOverrideCls = cn(fieldOverrideCls, "resize-y [overflow-wrap:anywhere] break-words");

function Field({
  id,
  label,
  required,
  helper,
  error,
  className,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  helper?: string;
  error?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label htmlFor={id} className="text-xs font-medium text-foreground">
        {label}
        {required && <span className="text-destructive"> *</span>}
      </Label>
      {children}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-[11px] font-medium text-destructive">
          {error}
        </p>
      ) : helper ? (
        <p className="text-[11px] text-muted-foreground">{helper}</p>
      ) : null}
    </div>
  );
}
