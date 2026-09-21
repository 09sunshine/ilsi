import { useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Compass, HeartHandshake, ShieldCheck, Sparkles, CheckCircle2, Loader2, X, HandHeart } from "lucide-react";
import { PageHeader, PublicShell } from "@/components/site/PublicShell";
import { SupportSection } from "@/components/site/SupportSection";
import { useI18n } from "@/i18n/LocaleProvider";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { z } from "zod";

const aboutSearchSchema = z.object({
  donation: z.string().optional(),
  donation_id: z.string().optional(),
  session_id: z.string().optional(),
});

export const Route = createFileRoute("/about")({
  validateSearch: aboutSearchSchema,
  head: () => ({
    meta: [
      { title: "About ILSI — how we run training" },
      {
        name: "description",
        content:
          "ILSI designs structured, cohort-based training programs with fixed schedules, trainers and live debriefs.",
      },
      { name: "robots", content: "index, follow" },
      { property: "og:title", content: "About ILSI — how we run training" },
      {
        property: "og:description",
        content: "Structured cohort training with fixed schedules, trainers and live debriefs.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "About ILSI — how we run training" },
      {
        name: "twitter:description",
        content: "Structured cohort training with fixed schedules, trainers and live debriefs.",
      },
    ],
  }),
  component: AboutPage,
});

function AboutPage() {
  const { t, locale } = useI18n();
  const fr = locale === "fr";
  const search = Route.useSearch();

  const [verifyingDonation, setVerifyingDonation] = useState(false);
  const [completedDonation, setCompletedDonation] = useState<{
    donorName: string;
    amount: number;
    currency: string;
    frequency: string;
  } | null>(null);

  useEffect(() => {
    if (search.donation === "success" && search.session_id) {
      setVerifyingDonation(true);
      api
        .verifyDonationSession({
          sessionId: search.session_id,
          donationId: search.donation_id,
        })
        .then((res) => {
          if (res.status === "COMPLETED") {
            setCompletedDonation({
              donorName: res.donorName,
              amount: res.amount,
              currency: res.currency,
              frequency: res.frequency,
            });
            toast.success(
              fr
                ? "Don confirmé ! Merci infiniment pour votre soutien généreux."
                : "Donation confirmed! Thank you so much for your generous support."
            );
            if (typeof window !== "undefined" && window.history?.replaceState) {
              window.history.replaceState({}, document.title, window.location.pathname);
            }
          }
        })
        .catch((err: any) => {
          toast.error(err.message || "Failed to verify donation with Stripe.");
        })
        .finally(() => {
          setVerifyingDonation(false);
        });
    } else if (search.donation === "cancelled") {
      toast.info(
        fr
          ? "Le don a été annulé. Vous pouvez contribuer à tout moment."
          : "Donation was cancelled. You can contribute whenever you are ready."
      );
      if (typeof window !== "undefined" && window.history?.replaceState) {
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }
  }, [search.donation, search.session_id, search.donation_id, fr]);

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

      {/* Verifying Banner */}
      {verifyingDonation && (
        <div className="mx-auto mt-6 max-w-6xl px-4 sm:px-6">
          <div className="flex items-center gap-3 rounded-2xl border border-primary/20 bg-primary/5 p-4 text-sm text-primary">
            <Loader2 className="size-5 animate-spin shrink-0" />
            <p>
              {fr
                ? "Vérification cryptographique de votre don avec Stripe en cours..."
                : "Cryptographically verifying your donation with Stripe..."}
            </p>
          </div>
        </div>
      )}

      {/* Completed Donation Celebration Card */}
      {completedDonation && (
        <div className="mx-auto mt-6 max-w-6xl px-4 sm:px-6">
          <div className="relative overflow-hidden rounded-3xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent p-6 sm:p-8 backdrop-blur-sm shadow-lg">
            <button
              onClick={() => setCompletedDonation(null)}
              className="absolute right-4 top-4 rounded-full p-1 text-muted-foreground hover:bg-black/5 hover:text-foreground transition-colors"
              aria-label="Close"
            >
              <X className="size-5" />
            </button>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-emerald-500/20 text-emerald-600 ring-1 ring-emerald-500/30">
                <CheckCircle2 className="size-6" />
              </span>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                    {fr ? "Paiement Stripe Réussi" : "Stripe Payment Verified"}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {completedDonation.frequency === "monthly"
                      ? fr
                        ? "Don mensuel récurrent"
                        : "Monthly recurring gift"
                      : fr
                      ? "Don unique"
                      : "One-off gift"}
                  </span>
                </div>
                <h3 className="font-display text-xl sm:text-2xl font-bold text-foreground">
                  {fr
                    ? `Merci pour votre don, ${completedDonation.donorName} !`
                    : `Thank you for your generous gift, ${completedDonation.donorName}!`}
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {fr
                    ? `Votre don de ${completedDonation.amount} ${completedDonation.currency} a été reçu avec succès. Il finance directement les bourses de leaders émergents qui participeront à nos prochaines cohortes.`
                    : `Your contribution of ${completedDonation.currency === "EUR" ? "€" : "$"}${completedDonation.amount} has been received securely via Stripe. It directly funds scholarship seats for emerging leaders in our upcoming cohort.`}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
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
