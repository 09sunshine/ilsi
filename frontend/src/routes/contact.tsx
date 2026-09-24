import { createFileRoute } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Mail, MapPin, Phone } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, PublicShell } from "@/components/site/PublicShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/i18n/LocaleProvider";
import { api } from "@/lib/api";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact ILSI — admissions and partnerships" },
      {
        name: "description",
        content: "Get in touch with ILSI about admissions, cohort dates or partnerships.",
      },
      { name: "robots", content: "index, follow" },
      { property: "og:title", content: "Contact ILSI — admissions and partnerships" },
      { property: "og:description", content: "Questions about admissions, cohorts or partnerships." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Contact ILSI — admissions and partnerships" },
      { name: "twitter:description", content: "Questions about admissions, cohorts or partnerships." },
    ],
  }),
  component: ContactPage,
});

const schema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email().max(255),
  subject: z.string().trim().min(3).max(120),
  message: z.string().trim().min(10).max(1500),
});
type Values = z.infer<typeof schema>;

function ContactPage() {
  const { t } = useI18n();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema) });

  const onSubmit = async (values: Values) => {
    try {
      await api.submitContact(values);
      toast.success(t("contact.sent"));
      reset();
    } catch (err: any) {
      toast.error(err.message || "Failed to send message. Please try again.");
    }
  };


  return (
    <PublicShell>
      <PageHeader eyebrow={t("nav.contact")} title={t("contact.title")} subtitle={t("contact.subtitle")} />
      <section className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[1.3fr_1fr]">
        <form onSubmit={handleSubmit(onSubmit)} className="panel space-y-5 p-6 sm:p-8" noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="name">{t("contact.name")}</Label>
              <Input id="name" aria-invalid={!!errors.name} {...register("name")} />
              {errors.name ? <p className="text-xs text-destructive">{t("common.required")}</p> : null}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">{t("contact.email")}</Label>
              <Input id="email" type="email" aria-invalid={!!errors.email} {...register("email")} />
              {errors.email ? (
                <p className="text-xs text-destructive">{t("common.invalidEmail")}</p>
              ) : null}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="subject">{t("contact.subject")}</Label>
            <Input id="subject" aria-invalid={!!errors.subject} {...register("subject")} />
            {errors.subject ? <p className="text-xs text-destructive">{t("common.required")}</p> : null}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="message">{t("contact.message")}</Label>
            <Textarea id="message" rows={6} aria-invalid={!!errors.message} {...register("message")} />
            {errors.message ? <p className="text-xs text-destructive">{t("common.tooShort")}</p> : null}
          </div>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : null}
            {t("contact.send")}
          </Button>
        </form>

        <aside className="space-y-4">
          <div className="panel flex items-start gap-3 p-5">
            <Mail className="mt-0.5 size-5 text-primary" aria-hidden />
            <div>
              <p className="text-sm font-semibold">Email</p>
              <p className="text-sm text-muted-foreground">admission@ilsicampus.org</p>
            </div>
          </div>
          <div className="panel flex items-start gap-3 p-5">
            <Phone className="mt-0.5 size-5 text-primary" aria-hidden />
            <div>
              <p className="text-sm font-semibold">{t("apply.phone")}</p>
              <p className="text-sm text-muted-foreground">+509 31 94 2183</p>
            </div>
          </div>
          <div className="panel flex items-start gap-3 p-5">
            <MapPin className="mt-0.5 size-5 text-primary" aria-hidden />
            <div>
              <p className="text-sm font-semibold">{t("apply.city")}</p>
              <p className="text-sm text-muted-foreground">Remote-first · sessions online</p>
            </div>
          </div>
        </aside>
      </section>
    </PublicShell>
  );
}
