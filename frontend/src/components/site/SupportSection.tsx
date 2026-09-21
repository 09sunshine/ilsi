import { useState } from "react";
import { ArrowRight, HandHeart, HeartHandshake, Loader2, Lock, ShieldCheck } from "lucide-react";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useI18n } from "@/i18n/LocaleProvider";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

const baseSchema = {
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(255),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
  message: z.string().trim().max(1000).optional().or(z.literal("")),
};

const donationSchema = z.object({
  ...baseSchema,
  amount: z.coerce.number().positive().max(1_000_000),
  frequency: z.enum(["one-off", "monthly"]),
});

const volunteerSchema = z.object({
  ...baseSchema,
  area: z.string().trim().min(2).max(120),
  availability: z.string().trim().min(2).max(120),
});

type Errors = Record<string, string>;

const inputClass =
  "h-11 rounded-xl border-black/10 bg-white text-sm text-neutral-900 placeholder:text-neutral-400";

function FieldError({ message }: { message?: string | null | undefined }) {
  if (!message) return null;
  return <p className="mt-1 text-xs font-medium text-destructive">{message}</p>;
}

export function SupportSection() {
  const { locale } = useI18n();
  const fr = locale === "fr";

  const cards = [
    {
      key: "donate" as const,
      icon: HandHeart,
      title: fr ? "Soutenir une bourse" : "Fund a scholarship",
      body: fr
        ? "Votre don finance des places de cohorte pour des leaders émergents qui ne peuvent pas payer les frais."
        : "Your gift funds cohort seats for emerging leaders who cannot cover the fee themselves.",
      cta: fr ? "Faire un don" : "Donate now",
    },
    {
      key: "volunteer" as const,
      icon: HeartHandshake,
      title: fr ? "Devenir bénévole" : "Volunteer with us",
      body: fr
        ? "Animez un débrief, encadrez un participant ou aidez aux admissions de la prochaine cohorte."
        : "Lead a debrief, mentor a participant or support admissions for the next cohort.",
      cta: fr ? "Rejoindre l'équipe" : "Join the team",
    },
  ];

  return (
    <section className="hero-dark hero-grid-lines relative overflow-hidden">
      <div className="relative z-10 mx-auto max-w-6xl px-4 py-16 text-hero-foreground sm:px-6 lg:py-20">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-hero-lime">
          {fr ? "Nous soutenir" : "Support ILSI"}
        </p>
        <h2 className="mt-3 max-w-2xl font-display text-3xl font-semibold sm:text-4xl">
          {fr
            ? "Deux façons de faire grandir la prochaine cohorte"
            : "Two ways to grow the next cohort"}
        </h2>
        <p className="mt-3 max-w-2xl text-sm text-hero-foreground/70">
          {fr
            ? "ILSI reste accessible grâce aux dons et au temps donné par sa communauté."
            : "ILSI stays accessible thanks to donations and the time given by our community."}
        </p>

        <div className="mt-10 grid gap-5 md:grid-cols-2">
          {cards.map((card) => (
            <div
              key={card.key}
              className="group rounded-3xl border border-white/10 bg-white/[0.04] p-7 backdrop-blur-sm transition-colors hover:border-hero-lime/40"
            >
              <span className="grid size-11 place-items-center rounded-2xl bg-hero-lime/10 text-hero-lime ring-1 ring-hero-lime/25">
                <card.icon className="size-5" aria-hidden />
              </span>
              <h3 className="mt-5 font-display text-xl font-semibold">{card.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-hero-foreground/70">{card.body}</p>
              <SupportDialog kind={card.key} label={card.cta} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function SupportDialog({ kind, label }: { kind: "donate" | "volunteer"; label: string }) {
  const { locale } = useI18n();
  const fr = locale === "fr";
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="mt-6 rounded-full bg-hero-lime px-5 text-hero-lime-foreground hover:bg-hero-lime/90">
          {label}
          <ArrowRight className="ml-1.5 size-4" aria-hidden />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto rounded-2xl sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">
            {kind === "donate"
              ? fr
                ? "Faire un don à ILSI"
                : "Donate to ILSI"
              : fr
                ? "Inscription bénévole"
                : "Volunteer sign-up"}
          </DialogTitle>
          <DialogDescription>
            {kind === "donate"
              ? fr
                ? "Indiquez le montant souhaité, notre équipe vous envoie les instructions de paiement."
                : "Tell us the amount you have in mind and our team sends the payment instructions."
              : fr
                ? "Partagez vos disponibilités, les admissions vous recontactent avant la prochaine cohorte."
                : "Share your availability and admissions will reach out before the next cohort."}
          </DialogDescription>
        </DialogHeader>
        {kind === "donate" ? (
          <DonationForm onDone={() => setOpen(false)} />
        ) : (
          <VolunteerForm onDone={() => setOpen(false)} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function useSubmit(onDone: () => void) {
  const [submitting, setSubmitting] = useState(false);
  const run = async (successMessage: string) => {
    setSubmitting(true);
    await new Promise((r) => setTimeout(r, 700));
    setSubmitting(false);
    toast.success(successMessage);
    onDone();
  };
  return { submitting, run };
}

function DonationForm({ onDone }: { onDone: () => void }) {
  const { locale } = useI18n();
  const fr = locale === "fr";
  const [errors, setErrors] = useState<Errors>({});
  const [frequency, setFrequency] = useState<"one-off" | "monthly">("one-off");
  const [amount, setAmount] = useState("100");
  const [submitting, setSubmitting] = useState(false);

  const required = fr ? "Champ requis ou invalide." : "This field is required or invalid.";

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const parsed = donationSchema.safeParse({
      name: String(data.get("name") ?? ""),
      email: String(data.get("email") ?? ""),
      phone: String(data.get("phone") ?? ""),
      message: String(data.get("message") ?? ""),
      amount: String(data.get("amount") ?? ""),
      frequency,
    });
    if (!parsed.success) {
      const next: Errors = {};
      for (const issue of parsed.error.issues) next[String(issue.path[0])] = required;
      setErrors(next);
      return;
    }
    setErrors({});
    setSubmitting(true);
    try {
      const res = await api.submitDonation({
        ...parsed.data,
        currency: fr ? "EUR" : "USD",
      });

      const checkoutUrl = (res as any)?.checkoutUrl || (res as any)?.data?.checkoutUrl;

      if (checkoutUrl) {
        toast.info(
          fr
            ? "Redirection vers le paiement sécurisé Stripe..."
            : "Redirecting to secure Stripe Checkout..."
        );
        window.location.href = checkoutUrl;
      } else {
        toast.success(
          fr
            ? "Merci pour votre don ! Notre équipe vous écrira très vite avec les détails."
            : "Thank you for your generous pledge! Our team will email you shortly."
        );
        onDone();
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to initiate Stripe donation.");
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <div className="grid gap-2">
        <Label htmlFor="d-amount">
          {fr ? "Montant (€ EUR)" : "Amount ($ USD)"}
        </Label>
        <div className="flex flex-wrap gap-2">
          {["50", "100", "250", "500"].map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => setAmount(preset)}
              className={cn(
                "rounded-full border px-4 py-1.5 text-sm font-medium transition-colors",
                amount === preset
                  ? "border-transparent bg-primary text-primary-foreground shadow-sm"
                  : "border-black/10 hover:bg-secondary",
              )}
            >
              {fr ? `${preset} €` : `$${preset}`}
            </button>
          ))}
        </div>
        <Input
          id="d-amount"
          name="amount"
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className={inputClass}
          placeholder={fr ? "100 €" : "$100"}
        />
        <FieldError message={errors["amount"]} />
      </div>

      <div className="grid gap-2">
        <Label>{fr ? "Fréquence" : "Frequency"}</Label>
        <div className="flex gap-2">
          {(["one-off", "monthly"] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFrequency(f)}
              className={cn(
                "rounded-full border px-4 py-1.5 text-sm font-medium transition-colors",
                frequency === f
                  ? "border-transparent bg-primary text-primary-foreground shadow-sm"
                  : "border-black/10 hover:bg-secondary",
              )}
            >
              {f === "one-off" ? (fr ? "Don unique" : "One-off gift") : fr ? "Don mensuel" : "Monthly gift"}
            </button>
          ))}
        </div>
      </div>

      <SharedFields errors={errors} prefix="d" fr={fr} />

      <Button
        type="submit"
        disabled={submitting}
        className="w-full rounded-xl bg-neutral-900 text-white hover:bg-neutral-800 py-6 text-base font-semibold shadow-md"
      >
        {submitting ? (
          <>
            <Loader2 className="mr-2 size-5 animate-spin" aria-hidden />
            {fr ? "Connexion sécurisée à Stripe..." : "Connecting to Stripe..."}
          </>
        ) : (
          <>
            <Lock className="mr-2 size-4" aria-hidden />
            {fr
              ? `Donner ${amount ? `${amount} €` : ""} avec Stripe`
              : `Donate ${amount ? `$${amount}` : ""} securely via Stripe`}
          </>
        )}
      </Button>

      <div className="flex items-center justify-center gap-2 pt-1 text-center text-xs text-muted-foreground">
        <ShieldCheck className="size-4 text-emerald-600 shrink-0" aria-hidden />
        <span>
          {fr
            ? "Chiffrement SSL 256 bits · Paiement sécurisé opéré par Stripe"
            : "256-bit encryption · Secure payment processed directly by Stripe"}
        </span>
      </div>
    </form>
  );
}

function VolunteerForm({ onDone }: { onDone: () => void }) {
  const { locale } = useI18n();
  const fr = locale === "fr";
  const [errors, setErrors] = useState<Errors>({});
  const [submitting, setSubmitting] = useState(false);
  const required = fr ? "Champ requis ou invalide." : "This field is required or invalid.";

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const parsed = volunteerSchema.safeParse({
      name: String(data.get("name") ?? ""),
      email: String(data.get("email") ?? ""),
      phone: String(data.get("phone") ?? ""),
      message: String(data.get("message") ?? ""),
      area: String(data.get("area") ?? ""),
      availability: String(data.get("availability") ?? ""),
    });
    if (!parsed.success) {
      const next: Errors = {};
      for (const issue of parsed.error.issues) next[String(issue.path[0])] = required;
      setErrors(next);
      return;
    }
    setErrors({});
    setSubmitting(true);
    try {
      await api.submitVolunteer(parsed.data);
      toast.success(
        fr
          ? "Merci pour votre candidature bénévole ! Les admissions vous contacteront avant la prochaine cohorte."
          : "Thank you for volunteering! Admissions will contact you before the next cohort."
      );
      onDone();
    } catch (err: any) {
      toast.error(err.message || "Failed to submit volunteer application.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <SharedFields errors={errors} prefix="v" fr={fr} />

      <div className="grid gap-2">
        <Label htmlFor="v-area">{fr ? "Domaine d'aide" : "How you can help"}</Label>
        <Input
          id="v-area"
          name="area"
          className={inputClass}
          placeholder={fr ? "Mentorat, animation, admissions…" : "Mentoring, facilitation, admissions…"}
        />
        <FieldError message={errors["area"]} />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="v-availability">{fr ? "Disponibilités" : "Availability"}</Label>
        <Input
          id="v-availability"
          name="availability"
          className={inputClass}
          placeholder={fr ? "2 h par semaine, en soirée" : "2 hours per week, evenings"}
        />
        <FieldError message={errors["availability"]} />
      </div>

      <Button
        type="submit"
        disabled={submitting}
        className="w-full rounded-xl bg-neutral-900 text-white hover:bg-neutral-800"
      >
        {submitting && <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />}
        {fr ? "Envoyer ma candidature" : "Submit application"}
      </Button>
    </form>
  );
}

function SharedFields({ errors, prefix, fr }: { errors: Errors; prefix: string; fr: boolean }) {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor={`${prefix}-name`}>{fr ? "Nom complet" : "Full name"}</Label>
          <Input id={`${prefix}-name`} name="name" className={inputClass} placeholder="Amara Diallo" />
          <FieldError message={errors["name"]} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`${prefix}-email`}>{fr ? "E-mail" : "Email"}</Label>
          <Input
            id={`${prefix}-email`}
            name="email"
            type="email"
            className={inputClass}
            placeholder="you@example.com"
          />
          <FieldError message={errors["email"]} />
        </div>
      </div>

      <div className="grid gap-2">
        <Label htmlFor={`${prefix}-phone`}>
          {fr ? "Téléphone (optionnel)" : "Phone (optional)"}
        </Label>
        <Input id={`${prefix}-phone`} name="phone" className={inputClass} placeholder="+1 555 000 0000" />
        <FieldError message={errors["phone"]} />
      </div>

      <div className="grid gap-2">
        <Label htmlFor={`${prefix}-message`}>{fr ? "Message (optionnel)" : "Message (optional)"}</Label>
        <Textarea
          id={`${prefix}-message`}
          name="message"
          rows={3}
          className="rounded-xl border-black/10 bg-white text-sm"
          placeholder={fr ? "Dites-nous en plus…" : "Tell us more…"}
        />
        <FieldError message={errors["message"]} />
      </div>
    </>
  );
}
