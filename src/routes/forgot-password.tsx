import { createFileRoute, Link } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState } from "react";
import { Loader2, MailCheck } from "lucide-react";
import { PublicShell } from "@/components/site/PublicShell";
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
    <PublicShell>
      <section className="hero-wash">
        <div className="mx-auto max-w-md px-4 py-16 sm:px-6 lg:py-24">
          <div className="panel p-7 sm:p-8">
            {sent ? (
              <div className="text-center">
                <div className="mx-auto grid size-11 place-items-center rounded-full bg-success/10 text-success">
                  <MailCheck className="size-5" />
                </div>
                <p className="mt-4 text-sm text-muted-foreground">{t("forgot.sent")}</p>
              </div>
            ) : (
              <>
                <h1 className="font-display text-2xl font-semibold">{t("forgot.title")}</h1>
                <p className="mt-1.5 text-sm text-muted-foreground">{t("forgot.subtitle")}</p>
                <form
                  onSubmit={handleSubmit(async () => {
                    await new Promise((r) => setTimeout(r, 600));
                    setSent(true);
                  })}
                  className="mt-6 space-y-4"
                  noValidate
                >
                  <div className="space-y-1.5">
                    <Label htmlFor="email">{t("login.email")}</Label>
                    <Input id="email" type="email" aria-invalid={!!errors.email} {...register("email")} />
                    {errors.email ? (
                      <p className="text-xs text-destructive">{t("common.invalidEmail")}</p>
                    ) : null}
                  </div>
                  <Button type="submit" className="w-full" disabled={isSubmitting}>
                    {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : null}
                    {t("forgot.submit")}
                  </Button>
                </form>
              </>
            )}
            <div className="mt-6 text-center">
              <Link to="/login" className="text-sm text-primary hover:underline">
                {t("forgot.back")}
              </Link>
            </div>
          </div>
        </div>
      </section>
    </PublicShell>
  );
}
