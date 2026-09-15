import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { PublicShell } from "@/components/site/PublicShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useI18n } from "@/i18n/LocaleProvider";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Log in — ILSI" },
      { name: "description", content: "Log in to your ILSI participant or administrator account." },
      { property: "og:title", content: "Log in — ILSI" },
      { property: "og:description", content: "Access your ILSI training dashboard." },
    ],
  }),
  component: LoginPage,
});

const schema = z.object({
  email: z.string().trim().email().max(255),
  password: z.string().min(8).max(128),
});
type Values = z.infer<typeof schema>;

function LoginPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema) });

  const onSubmit = async () => {
    await new Promise((r) => setTimeout(r, 600));
    navigate({ to: "/dashboard" });
  };

  return (
    <PublicShell>
      <section className="hero-wash">
        <div className="mx-auto flex max-w-md flex-col px-4 py-16 sm:px-6 lg:py-24">
          <div className="panel p-7 sm:p-8">
            <h1 className="font-display text-2xl font-semibold">{t("login.title")}</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">{t("login.subtitle")}</p>

            <form onSubmit={handleSubmit(onSubmit)} className="mt-7 space-y-4" noValidate>
              <div className="space-y-1.5">
                <Label htmlFor="email">{t("login.email")}</Label>
                <Input id="email" type="email" autoComplete="email" aria-invalid={!!errors.email} {...register("email")} />
                {errors.email ? (
                  <p className="text-xs text-destructive">{t("common.invalidEmail")}</p>
                ) : null}
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">{t("login.password")}</Label>
                  <Link to="/forgot-password" className="text-xs text-primary hover:underline">
                    {t("login.forgot")}
                  </Link>
                </div>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  aria-invalid={!!errors.password}
                  {...register("password")}
                />
                {errors.password ? (
                  <p className="text-xs text-destructive">{t("common.tooShort")}</p>
                ) : null}
              </div>
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : null}
                {t("login.submit")}
              </Button>
            </form>

            <Separator className="my-6" />
            <p className="text-xs text-muted-foreground">{t("login.demoHint")}</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <Button asChild variant="outline" size="sm">
                <Link to="/dashboard">{t("login.asParticipant")}</Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link to="/admin">{t("login.asAdmin")}</Link>
              </Button>
            </div>
          </div>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            {t("login.noAccount")}{" "}
            <Link to="/apply" className="font-medium text-primary hover:underline">
              {t("login.applyLink")}
            </Link>
          </p>
        </div>
      </section>
    </PublicShell>
  );
}
