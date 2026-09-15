import { createFileRoute, Link } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { PageHeader, PublicShell } from "@/components/site/PublicShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useI18n, useLocalized } from "@/i18n/LocaleProvider";
import { programs } from "@/data/demo";

const searchSchema = z.object({ program: z.string().optional() });

export const Route = createFileRoute("/apply")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Apply to a program — ILSI" },
      {
        name: "description",
        content:
          "Apply to an ILSI training cohort. Applications are reviewed before each cohort starts.",
      },
      { property: "og:title", content: "Apply to a program — ILSI" },
      { property: "og:description", content: "Apply to an ILSI training cohort." },
    ],
  }),
  component: ApplyPage,
});

const applicationSchema = z.object({
  firstName: z.string().trim().min(2).max(60),
  lastName: z.string().trim().min(2).max(60),
  email: z.string().trim().email().max(255),
  phone: z.string().trim().min(6).max(30),
  country: z.string().trim().min(2).max(60),
  city: z.string().trim().min(2).max(60),
  dateOfBirth: z.string().min(4),
  education: z.string().trim().min(2).max(120),
  occupation: z.string().trim().min(2).max(120),
  organization: z.string().trim().max(120).optional().or(z.literal("")),
  programId: z.string().min(1),
  motivation: z.string().trim().min(40).max(1500),
  experience: z.string().trim().max(1500).optional().or(z.literal("")),
  terms: z.literal(true),
});

type ApplicationValues = z.infer<typeof applicationSchema>;

function ApplyPage() {
  const { t } = useI18n();
  const L = useLocalized();
  const search = Route.useSearch();
  const [submitted, setSubmitted] = useState(false);

  const preselected = programs.find((p) => p.slug === search.program)?.id ?? "";

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ApplicationValues>({
    resolver: zodResolver(applicationSchema),
    defaultValues: { programId: preselected, organization: "", experience: "" },
  });

  const onSubmit = async (_values: ApplicationValues) => {
    await new Promise((r) => setTimeout(r, 700));
    setSubmitted(true);
  };

  const field = (name: keyof ApplicationValues, label: string, type = "text") => (
    <div className="space-y-1.5">
      <Label htmlFor={name}>{label}</Label>
      <Input
        id={name}
        type={type}
        aria-invalid={!!errors[name]}
        {...register(name)}
      />
      {errors[name] ? (
        <p className="text-xs text-destructive">
          {name === "email" ? t("common.invalidEmail") : t("common.required")}
        </p>
      ) : null}
    </div>
  );

  if (submitted) {
    return (
      <PublicShell>
        <div className="mx-auto max-w-xl px-4 py-24 text-center sm:px-6">
          <div className="mx-auto grid size-12 place-items-center rounded-full bg-success/10 text-success">
            <CheckCircle2 className="size-6" />
          </div>
          <h1 className="mt-5 font-display text-2xl font-semibold">{t("apply.successTitle")}</h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            {t("apply.successBody")}
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-2">
            <Button asChild>
              <Link to="/">{t("nav.home")}</Link>
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                reset();
                setSubmitted(false);
              }}
            >
              {t("apply.another")}
            </Button>
          </div>
        </div>
      </PublicShell>
    );
  }

  return (
    <PublicShell>
      <PageHeader eyebrow={t("nav.apply")} title={t("apply.title")} subtitle={t("apply.subtitle")} />
      <section className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-10" noValidate>
          <fieldset className="panel space-y-5 p-6">
            <legend className="px-1 font-display text-lg font-semibold">
              {t("apply.personal")}
            </legend>
            <div className="grid gap-4 sm:grid-cols-2">
              {field("firstName", t("apply.firstName"))}
              {field("lastName", t("apply.lastName"))}
              {field("email", t("apply.email"), "email")}
              {field("phone", t("apply.phone"), "tel")}
              {field("country", t("apply.country"))}
              {field("city", t("apply.city"))}
              {field("dateOfBirth", t("apply.dob"), "date")}
            </div>
          </fieldset>

          <fieldset className="panel space-y-5 p-6">
            <legend className="px-1 font-display text-lg font-semibold">
              {t("apply.background")}
            </legend>
            <div className="grid gap-4 sm:grid-cols-2">
              {field("education", t("apply.education"))}
              {field("occupation", t("apply.occupation"))}
              {field("organization", t("apply.organization"))}
              <div className="space-y-1.5">
                <Label htmlFor="programId">{t("apply.program")}</Label>
                <select
                  id="programId"
                  value={watch("programId")}
                  onChange={(e) => setValue("programId", e.target.value, { shouldValidate: true })}
                  aria-invalid={!!errors.programId}
                  className="h-9 w-full rounded-md border border-input bg-card px-3 text-sm shadow-xs"
                >
                  <option value="">{t("apply.selectProgram")}</option>
                  {programs.map((p) => (
                    <option key={p.id} value={p.id}>
                      {L(p.title)}
                    </option>
                  ))}
                </select>
                {errors.programId ? (
                  <p className="text-xs text-destructive">{t("common.required")}</p>
                ) : null}
              </div>
            </div>
          </fieldset>

          <fieldset className="panel space-y-5 p-6">
            <legend className="px-1 font-display text-lg font-semibold">
              {t("apply.motivation")}
            </legend>
            <div className="space-y-1.5">
              <Label htmlFor="motivation">{t("apply.motivationLabel")}</Label>
              <Textarea id="motivation" rows={5} aria-invalid={!!errors.motivation} {...register("motivation")} />
              {errors.motivation ? (
                <p className="text-xs text-destructive">{t("common.tooShort")}</p>
              ) : null}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="experience">{t("apply.experienceLabel")}</Label>
              <Textarea id="experience" rows={4} {...register("experience")} />
            </div>
            <div className="flex items-start gap-3">
              <Checkbox
                id="terms"
                checked={watch("terms") === true}
                onCheckedChange={(v) =>
                  setValue("terms", v === true ? true : (false as never), { shouldValidate: true })
                }
              />
              <Label htmlFor="terms" className="text-sm font-normal leading-relaxed">
                {t("apply.terms")}
              </Label>
            </div>
            {errors.terms ? (
              <p className="text-xs text-destructive">{t("common.required")}</p>
            ) : null}
          </fieldset>

          <Button type="submit" size="lg" disabled={isSubmitting} className="w-full sm:w-auto">
            {isSubmitting ? (
              <>
                <Loader2 className="size-4 animate-spin" /> {t("apply.submitting")}
              </>
            ) : (
              t("apply.submit")
            )}
          </Button>
        </form>
      </section>
    </PublicShell>
  );
}
