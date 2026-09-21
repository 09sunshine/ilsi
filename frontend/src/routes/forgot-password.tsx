import { createFileRoute, Link } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState } from "react";
import { ArrowLeft, Loader2, Mail, MailCheck } from "lucide-react";
import { AuthLayout, FieldLabel, authInputClass, authSubmitClass } from "@/components/site/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/i18n/LocaleProvider";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({
    meta: [
      { title: "Reset your password — ILSI" },
      { name: "description", content: "Request a password reset link for your ILSI account." },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Reset your password — ILSI" },
      { property: "og:description", content: "Request a password reset link for your ILSI account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ForgotPasswordPage,
});

const schema = z.object({ email: z.string().trim().email().max(255) });

function ForgotPasswordPage() {
  const { t } = useI18n();
  const [sent, setSent] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema) });

  return (
    <AuthLayout
      eyebrow={t("auth.resetEyebrow")}
      title={t("forgot.title")}
      subtitle={t("forgot.subtitle")}
      footer={
        <Link to="/login" className="font-semibold text-neutral-900 underline underline-offset-2">
          {t("forgot.back")}
        </Link>
      }
      top={
        <Link
          to="/login"
          className="inline-flex items-center gap-1.5 text-sm text-neutral-500 transition-colors hover:text-neutral-900"
        >
          <ArrowLeft className="size-4" />
          {t("common.back")}
        </Link>
      }
    >
      {sent ? (
        <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-6 text-center">
          <div className="mx-auto grid size-11 place-items-center rounded-full bg-hero-lime/25 text-neutral-900">
            <MailCheck className="size-5" />
          </div>
          <p className="mt-4 text-sm text-neutral-600">{t("forgot.sent")}</p>
        </div>
      ) : (
        <form
          onSubmit={handleSubmit(async () => {
            await new Promise((r) => setTimeout(r, 600));
            setSent(true);
          })}
          className="space-y-4"
          noValidate
        >
          <div className="space-y-2">
            <FieldLabel htmlFor="email">{t("login.email")}</FieldLabel>
            <div className="relative">
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@company.com"
                className={`${authInputClass} pr-11`}
                aria-invalid={!!errors.email}
                {...register("email")}
              />
              <Mail className="pointer-events-none absolute right-4 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
            </div>
            {errors.email ? <p className="text-xs text-red-600">{t("common.invalidEmail")}</p> : null}
          </div>
          <Button type="submit" disabled={isSubmitting} className={authSubmitClass}>
            {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : null}
            {t("forgot.submit")}
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
