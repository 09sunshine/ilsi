import { createFileRoute, Link } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState } from "react";
import { Loader2, MailCheck } from "lucide-react";
import { AuthLayout } from "@/components/site/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/i18n/LocaleProvider";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({
    meta: [
      { title: "Reset your password — ILSI" },
      { name: "description", content: "Request a password reset link for your ILSI account." },
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
      title={t("forgot.title")}
      subtitle={t("forgot.subtitle")}
      footer={
        <Link to="/login" className="font-medium text-hero-lime hover:underline">
          {t("forgot.back")}
        </Link>
      }
    >
      {sent ? (
        <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-6 text-center backdrop-blur">
          <div className="mx-auto grid size-11 place-items-center rounded-full bg-hero-lime/15 text-hero-lime">
            <MailCheck className="size-5" />
          </div>
          <p className="mt-4 text-sm text-white/70">{t("forgot.sent")}</p>
        </div>
      ) : (
        <form
          onSubmit={handleSubmit(async () => {
            await new Promise((r) => setTimeout(r, 600));
            setSent(true);
          })}
          className="space-y-3"
          noValidate
        >
          <div className="space-y-1.5">
            <Label htmlFor="email" className="sr-only">
              {t("login.email")}
            </Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder={t("login.email")}
              className="h-12 rounded-full px-5"
              aria-invalid={!!errors.email}
              {...register("email")}
            />
            {errors.email ? <p className="px-4 text-xs text-red-300">{t("common.invalidEmail")}</p> : null}
          </div>
          <Button
            type="submit"
            disabled={isSubmitting}
            className="h-12 w-full rounded-full bg-hero-lime text-hero-lime-foreground hover:bg-hero-lime/90"
          >
            {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : null}
            {t("forgot.submit")}
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
