import { createFileRoute } from "@tanstack/react-router";
import { Compass, HeartHandshake, ShieldCheck, Sparkles } from "lucide-react";
import { PageHeader, PublicShell } from "@/components/site/PublicShell";
import { SupportSection } from "@/components/site/SupportSection";
import { useI18n } from "@/i18n/LocaleProvider";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About ILSI — how we run training" },
      {
        name: "description",
        content:
          "ILSI designs structured, cohort-based training programs with fixed schedules, trainers and live debriefs.",
      },
      { property: "og:title", content: "About ILSI — how we run training" },
      {
        property: "og:description",
        content: "Structured cohort training with fixed schedules, trainers and live debriefs.",
      },
    ],
  }),
  component: AboutPage,
});

function AboutPage() {
  const { t, locale } = useI18n();
  const fr = locale === "fr";

  const values = [
    {
      icon: Compass,
      title: fr ? "Structure avant contenu" : "Structure before content",
      body: fr
        ? "Un calendrier clair et des règles explicites valent mieux qu'une bibliothèque infinie."
        : "A clear calendar and explicit rules beat an infinite content library.",
    },
    {
      icon: ShieldCheck,
      title: fr ? "Exigence bienveillante" : "Demanding and supportive",
      body: fr
        ? "On ne débloque pas un module par le calendrier, mais par le travail fait."
        : "Modules unlock through work completed, never through the calendar alone.",
    },
    {
      icon: HeartHandshake,
      title: fr ? "Le groupe compte" : "The group matters",
      body: fr
        ? "Chaque module se termine par un échange collectif animé par un formateur."
        : "Every module ends with a collective session led by a trainer.",
    },
    {
      icon: Sparkles,
      title: fr ? "Utile dès lundi" : "Useful by Monday",
      body: fr
        ? "Chaque leçon vise une application concrète dans la semaine."
        : "Each lesson targets something you can apply within the week.",
    },
  ];

  const team = [
    { name: "Amara Diallo", role: fr ? "Formatrice principale" : "Lead trainer" },
    { name: "Jean-Luc Pierre", role: fr ? "Formateur, communication" : "Trainer, communication" },
    { name: "Rita Nkemdirim", role: fr ? "Responsable des admissions" : "Head of admissions" },
  ];

  return (
    <PublicShell>
      <PageHeader eyebrow="ILSI" title={t("about.title")} subtitle={t("about.lead")} />
      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:py-20">
        <div className="grid gap-10 lg:grid-cols-[1.3fr_1fr]">
          <div>
            <h2 className="font-display text-2xl font-semibold">{t("about.missionTitle")}</h2>
            <div className="mt-4 space-y-4 text-sm leading-relaxed text-muted-foreground">
              <p>
                {fr
                  ? "ILSI conçoit des formations qui ressemblent davantage à une saison d'entraînement qu'à un catalogue de vidéos. Chaque cohorte a une date de début, une date de fin, des échéances intermédiaires et un formateur qui suit la progression de chacun."
                  : "ILSI builds training that behaves more like a training season than a video catalogue. Every cohort has a start date, an end date, intermediate deadlines and a trainer who follows each participant's progress."}
              </p>
              <p>
                {fr
                  ? "Les modules s'ouvrent selon le calendrier, mais ne se débloquent qu'au mérite : leçons obligatoires terminées et quiz réussi. C'est contraignant, et c'est précisément ce qui fait que les gens terminent."
                  : "Modules open on schedule but only unlock on merit: mandatory lessons finished and the quiz passed. It is demanding, and that is exactly why people finish."}
              </p>
            </div>
          </div>
          <div className="panel p-6">
            <h2 className="font-display text-lg font-semibold">{t("about.teamTitle")}</h2>
            <ul className="mt-4 space-y-4">
              {team.map((m) => (
                <li key={m.name} className="flex items-center gap-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-full bg-secondary text-sm font-semibold">
                    {m.name
                      .split(" ")
                      .map((p) => p[0])
                      .join("")}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{m.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{m.role}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <h2 className="mt-16 font-display text-2xl font-semibold">{t("about.valuesTitle")}</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {values.map((v) => (
            <div key={v.title} className="panel p-6">
              <v.icon className="size-5 text-primary" aria-hidden />
              <h3 className="mt-4 text-sm font-semibold">{v.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{v.body}</p>
            </div>
          ))}
        </div>
      </section>
      <SupportSection />
    </PublicShell>
  );
}
