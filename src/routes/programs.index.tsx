import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, GraduationCap } from "lucide-react";
import { PageHeader, PublicShell } from "@/components/site/PublicShell";
import { EmptyState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useI18n, useLocalized } from "@/i18n/LocaleProvider";
import { cohortsForProgram, programs } from "@/data/demo";

export const Route = createFileRoute("/programs/")({
  head: () => ({
    meta: [
      { title: "Training programs — ILSI" },
      {
        name: "description",
        content:
          "Browse ILSI training programs: cohort-based leadership, communication and project management training with fixed schedules.",
      },
      { property: "og:title", content: "Training programs — ILSI" },
      {
        property: "og:description",
        content: "Cohort-based leadership, communication and project management training.",
      },
    ],
  }),
  component: ProgramsPage,
});

function ProgramsPage() {
  const { t } = useI18n();
  const L = useLocalized();

  return (
    <PublicShell>
      <PageHeader
        eyebrow={t("home.programsTag")}
        title={t("programs.title")}
        subtitle={t("programs.subtitle")}
      />
      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        {programs.length === 0 ? (
          <EmptyState
            icon={<GraduationCap className="size-5" />}
            title={t("programs.empty")}
            body={t("programs.emptyBody")}
            action={
              <Button asChild>
                <Link to="/contact">{t("nav.contact")}</Link>
              </Button>
            }
          />
        ) : (
          <div className="grid gap-5 md:grid-cols-2">
            {programs.map((p) => {
              const openCohorts = cohortsForProgram(p.id).filter((c) => c.status !== "ARCHIVED");
              return (
                <article key={p.id} className="panel flex flex-col p-6 sm:p-7">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">
                      {p.durationWeeks} {t("programs.weeks")}
                    </Badge>
                    <Badge variant="secondary">
                      {p.moduleCount} {t("programs.modules")}
                    </Badge>
                    <span className="text-xs text-muted-foreground">{L(p.format)}</span>
                  </div>
                  <h2 className="mt-4 font-display text-2xl font-semibold">{L(p.title)}</h2>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {L(p.description)}
                  </p>
                  <div className="mt-5 rounded-lg border border-border bg-surface p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {t("programs.cohorts")}
                    </p>
                    <ul className="mt-2 space-y-1.5 text-sm">
                      {openCohorts.map((c) => (
                        <li key={c.id} className="flex items-center justify-between gap-3">
                          <span className="truncate">{L(c.name)}</span>
                          <span className="shrink-0 text-xs text-muted-foreground">
                            {c.enrolled}/{c.capacity}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="mt-6 flex flex-wrap gap-2">
                    <Button asChild>
                      <Link to="/programs/$slug" params={{ slug: p.slug }}>
                        {t("programs.view")}
                        <ArrowRight className="size-4" />
                      </Link>
                    </Button>
                    <Button asChild variant="outline">
                      <Link to="/apply" search={{ program: p.slug }}>
                        {t("nav.apply")}
                      </Link>
                    </Button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </PublicShell>
  );
}
