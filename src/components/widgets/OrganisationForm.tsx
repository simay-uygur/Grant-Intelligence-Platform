import { useState } from "react";
import type { OrganisationProfile } from "@/types";

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

const REQUIRED: (keyof OrganisationProfile)[] = [
  "organisationName",
  "organisationType",
  "country",
  "projectTitle",
  "projectDescription",
  "fundingAmount",
  "projectDuration",
  "sector",
];

export function OrganisationForm({ initial, disabled, onSubmit }: Props) {
  const [profile, setProfile] = useState<OrganisationProfile>({
    ...EMPTY,
    ...initial,
  });
  const [touched, setTouched] = useState(false);

  const missing = REQUIRED.filter((k) => !profile[k].trim());
  const complete = missing.length === 0;

  const set = <K extends keyof OrganisationProfile>(
    k: K,
    v: OrganisationProfile[K],
  ) => setProfile((p) => ({ ...p, [k]: v }));

  const submit = () => {
    setTouched(true);
    if (!complete) return;
    onSubmit(profile);
  };

  const invalid = (k: keyof OrganisationProfile) =>
    touched && REQUIRED.includes(k) && !profile[k].trim();

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-foreground">
          Tell me a bit more so I can match the best grants
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Fields marked * are required. Everything stays local in your browser.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Field label="Organisation name *" invalid={invalid("organisationName")}>
          <input
            className={inputCls}
            value={profile.organisationName}
            onChange={(e) => set("organisationName", e.target.value)}
            disabled={disabled}
          />
        </Field>
        <Field label="Organisation type *" invalid={invalid("organisationType")}>
          <select
            className={inputCls}
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
            className={inputCls}
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
          <input
            className={inputCls}
            value={profile.region}
            onChange={(e) => set("region", e.target.value)}
            disabled={disabled}
          />
        </Field>
        <Field label="Sector *" invalid={invalid("sector")}>
          <select
            className={inputCls}
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
        <Field label="Funding amount *" invalid={invalid("fundingAmount")}>
          <select
            className={inputCls}
            value={profile.fundingAmount}
            onChange={(e) => set("fundingAmount", e.target.value)}
            disabled={disabled}
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
          <input
            type="date"
            className={inputCls}
            value={profile.projectStartDate}
            onChange={(e) => set("projectStartDate", e.target.value)}
            disabled={disabled}
          />
        </Field>
        <Field label="Project duration *" invalid={invalid("projectDuration")}>
          <select
            className={inputCls}
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
        <Field
          label="Project title *"
          invalid={invalid("projectTitle")}
          className="md:col-span-2"
        >
          <input
            className={inputCls}
            value={profile.projectTitle}
            onChange={(e) => set("projectTitle", e.target.value)}
            disabled={disabled}
          />
        </Field>
        <Field
          label="Organisation description"
          className="md:col-span-2"
        >
          <textarea
            rows={2}
            className={inputCls}
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
          <textarea
            rows={3}
            className={inputCls}
            value={profile.projectDescription}
            onChange={(e) => set("projectDescription", e.target.value)}
            disabled={disabled}
          />
        </Field>
        <Field
          label="Known eligibility constraints"
          className="md:col-span-2"
        >
          <input
            className={inputCls}
            value={profile.eligibilityConstraints}
            onChange={(e) => set("eligibilityConstraints", e.target.value)}
            disabled={disabled}
            placeholder="e.g. must be a consortium of 3+ EU partners"
          />
        </Field>
      </div>

      {touched && !complete && (
        <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          Please complete the required fields: {missing.join(", ")}.
        </div>
      )}

      <div className="mt-4 flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {complete ? "Ready to research." : `${missing.length} field(s) left`}
        </span>
        <button
          type="button"
          onClick={submit}
          disabled={disabled || !complete}
          className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-brand/90 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground"
        >
          Research matching grants
        </button>
      </div>
    </div>
  );
}

const inputCls =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-brand/60 focus:ring-2 focus:ring-brand/20 disabled:opacity-60";

function Field({
  label,
  invalid,
  className,
  children,
}: {
  label: string;
  invalid?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`flex flex-col gap-1 ${className ?? ""}`}>
      <span
        className={`text-[11px] font-medium ${
          invalid ? "text-destructive" : "text-muted-foreground"
        }`}
      >
        {label}
      </span>
      {children}
    </label>
  );
}
