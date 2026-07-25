import {
  cloneElement,
  isValidElement,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactElement,
} from "react";
import { Check } from "lucide-react";
import type { OrganisationProfile } from "@/types";
import { cn } from "@/lib/utils";
import { Card, CardHeader, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

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
    subtitle: "Step 1 of 3 · Organisation basics",
  },
  2: {
    title: "Now, tell me about the project",
    subtitle: "Step 2 of 3 · Project details",
  },
  3: {
    title: "Funding and timeline",
    subtitle: "Step 3 of 3 · Budget and schedule",
  },
};

export function OrganisationForm({ initial, disabled, onSubmit }: Props) {
  const [profile, setProfile] = useState<OrganisationProfile>({
    ...EMPTY,
    ...initial,
  });
  const [step, setStep] = useState<Step>(1);
  const [touched, setTouched] = useState(false);
  const stepRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    stepRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [step]);

  const set = <K extends keyof OrganisationProfile>(k: K, v: OrganisationProfile[K]) =>
    setProfile((p) => ({ ...p, [k]: v }));

  const missingForStep = (s: Step) => STEP_REQUIRED[s].filter((k) => !profile[k].trim());
  const stepValid = missingForStep(step).length === 0;
  const allValid = ALL_REQUIRED.every((k) => profile[k].trim());

  const invalid = (k: keyof OrganisationProfile) =>
    touched && STEP_REQUIRED[step].includes(k) && !profile[k].trim();

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

  const missing = missingForStep(step);

  return (
    <Card ref={stepRef} className="rounded-2xl p-5 shadow-sm">
      <CardHeader className="mb-4 flex-row items-start justify-between gap-3 space-y-0 p-0">
        <div>
          <h3 className="text-sm font-semibold text-foreground">{STEP_COPY[step].title}</h3>
          <p className="mt-1 text-xs text-muted-foreground">{STEP_COPY[step].subtitle}</p>
        </div>
        <StepDots step={step} />
      </CardHeader>

      <CardContent className="p-0">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {step === 1 && (
            <>
              <Field label="Organisation name *" invalid={invalid("organisationName")}>
                <Input
                  className={fieldOverrideCls}
                  value={profile.organisationName}
                  onChange={(e) => set("organisationName", e.target.value)}
                  disabled={disabled}
                  autoFocus
                />
              </Field>
              <Field label="Organisation type *" invalid={invalid("organisationType")}>
                <select
                  className={fieldOverrideCls}
                  value={profile.organisationType}
                  onChange={(e) => set("organisationType", e.target.value)}
                  disabled={disabled}
                >
                  <option value="">Select…</option>
                  {ORG_TYPES.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Country *" invalid={invalid("country")}>
                <select
                  className={fieldOverrideCls}
                  value={profile.country}
                  onChange={(e) => set("country", e.target.value)}
                  disabled={disabled}
                >
                  <option value="">Select…</option>
                  {COUNTRIES.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Region / city">
                <Input
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
              <div className="grid grid-cols-1 gap-3 md:col-span-2 md:grid-cols-3">
                <Field label="Sector *" invalid={invalid("sector")}>
                  <select
                    className={fieldOverrideCls}
                    value={profile.sector}
                    onChange={(e) => set("sector", e.target.value)}
                    disabled={disabled}
                  >
                    <option value="">Select…</option>
                    {SECTORS.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field
                  label="Project title *"
                  invalid={invalid("projectTitle")}
                  className="md:col-span-2"
                >
                  <Input
                    className={fieldOverrideCls}
                    value={profile.projectTitle}
                    onChange={(e) => set("projectTitle", e.target.value)}
                    disabled={disabled}
                    autoFocus
                  />
                </Field>
              </div>
              <Field label="Organisation description" className="md:col-span-2">
                <Textarea
                  rows={3}
                  className={textareaOverrideCls}
                  value={profile.organisationDescription}
                  onChange={(e) => set("organisationDescription", e.target.value)}
                  disabled={disabled}
                />
              </Field>
              <Field
                label="Project description *"
                invalid={invalid("projectDescription")}
                className="md:col-span-2"
              >
                <Textarea
                  rows={4}
                  className={textareaOverrideCls}
                  value={profile.projectDescription}
                  onChange={(e) => set("projectDescription", e.target.value)}
                  disabled={disabled}
                />
              </Field>
            </>
          )}

          {step === 3 && (
            <>
              <Field label="Required budget *" invalid={invalid("fundingAmount")}>
                <select
                  className={fieldOverrideCls}
                  value={profile.fundingAmount}
                  onChange={(e) => set("fundingAmount", e.target.value)}
                  disabled={disabled}
                  autoFocus
                >
                  <option value="">Select…</option>
                  {BUDGETS.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Preferred project start">
                <Input
                  type="date"
                  className={fieldOverrideCls}
                  value={profile.projectStartDate}
                  onChange={(e) => set("projectStartDate", e.target.value)}
                  disabled={disabled}
                />
              </Field>
              <Field label="Project duration *" invalid={invalid("projectDuration")}>
                <select
                  className={fieldOverrideCls}
                  value={profile.projectDuration}
                  onChange={(e) => set("projectDuration", e.target.value)}
                  disabled={disabled}
                >
                  <option value="">Select…</option>
                  {DURATIONS.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Known eligibility constraints" className="md:col-span-2">
                <Textarea
                  rows={2}
                  className={textareaOverrideCls}
                  value={profile.eligibilityConstraints}
                  onChange={(e) => set("eligibilityConstraints", e.target.value)}
                  disabled={disabled}
                  placeholder="e.g. must be a consortium of 3+ EU partners"
                />
              </Field>
            </>
          )}
        </div>

        {touched && missing.length > 0 && (
          <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            Please complete the required fields before continuing.
          </div>
        )}
      </CardContent>

      <CardFooter className="mt-4 flex items-center justify-between p-0">
        <Button
          type="button"
          variant="outline"
          onClick={goBack}
          disabled={disabled || step === 1}
          className="rounded-lg hover:bg-muted"
        >
          Back
        </Button>
        <Button
          type="button"
          onClick={goNext}
          disabled={disabled || !stepValid || (step === 3 && !allValid)}
          className="rounded-lg bg-brand text-white shadow-sm hover:bg-brand/90 disabled:bg-muted disabled:text-muted-foreground"
        >
          {step < 3 ? "Continue" : "Research matching grants"}
        </Button>
      </CardFooter>
    </Card>
  );
}

function StepDots({ step }: { step: Step }) {
  return (
    <div className="flex shrink-0 items-center gap-1.5 pt-1">
      {([1, 2, 3] as Step[]).map((s) => (
        <span
          key={s}
          className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-medium ${
            s < step
              ? "bg-emerald-500 text-white"
              : s === step
                ? "bg-brand text-white"
                : "bg-muted text-muted-foreground"
          }`}
        >
          {s < step ? <Check className="h-3 w-3" /> : s}
        </span>
      ))}
    </div>
  );
}

const fieldOverrideCls =
  "w-full rounded-lg bg-background px-3 py-2 text-sm text-foreground transition-colors focus-visible:border-brand/60 focus-visible:ring-2 focus-visible:ring-brand/20 disabled:opacity-60";

const textareaOverrideCls = cn(
  fieldOverrideCls,
  "min-h-[72px] resize-y [overflow-wrap:anywhere] break-words",
);

function Field({
  label,
  invalid,
  className,
  children,
}: {
  label: string;
  invalid?: boolean;
  className?: string;
  children: ReactElement;
}) {
  const id = useId();
  const control = isValidElement(children)
    ? cloneElement(children, { id } as { id: string })
    : children;

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <Label
        htmlFor={id}
        className={cn(
          "text-[11px] font-medium",
          invalid ? "text-destructive" : "text-muted-foreground",
        )}
      >
        {label}
      </Label>
      {control}
    </div>
  );
}
