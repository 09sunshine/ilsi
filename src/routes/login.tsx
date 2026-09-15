import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, Eye, EyeOff, Loader2 } from "lucide-react";
import { AuthLayout, SocialRow } from "@/components/site/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/i18n/LocaleProvider";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Log in — ILSI" },
      { name: "description", content: "Log in to your ILSI participant or administrator account." },
      { property: "og:title", content: "Log in — ILSI" },
      { property: "og:description", content: "Access your ILSI training dashboard." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
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
  const [show, setShow] = useState(false);
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
    <AuthLayout
      title={t("login.title")}
      subtitle={t("login.subtitle")}
      footer={
        <span className="text-muted-foreground">
          {t("login.registerPrompt")}{" "}
          <Link to="/signup" className="font-medium text-primary hover:underline">
            {t("login.registerLink")}
          </Link>
        </span>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3" noValidate>
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
          {errors.email ? <p className="px-4 text-xs text-destructive">{t("common.invalidEmail")}</p> : null}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="password" className="sr-only">
            {t("login.password")}
          </Label>
          <div className="relative">
            <Input
              id="password"
              type={show ? "text" : "password"}
              autoComplete="current-password"
              placeholder={t("login.password")}
              className="h-12 rounded-full px-5 pr-12"
              aria-invalid={!!errors.password}
              {...register("password")}
            />
            <button
              type="button"
              onClick={() => setShow((v) => !v)}
              aria-label={t("auth.showPassword")}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
          {errors.password ? <p className="px-4 text-xs text-destructive">{t("common.tooShort")}</p> : null}
        </div>

        <div className="flex justify-end">
          <Link to="/forgot-password" className="text-xs text-muted-foreground hover:text-primary hover:underline">
            {t("login.forgot")}
          </Link>
        </div>

        <Button
          type="submit"
          disabled={isSubmitting}
          className="h-12 w-full rounded-full bg-foreground text-background hover:bg-foreground/90"
        >
          {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : null}
          {t("login.submit")}
        </Button>
      </form>

      <SocialRow />

      <p className="mt-8 text-center text-xs text-muted-foreground">{t("login.demoHint")}</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <Button asChild variant="outline" size="sm" className="rounded-full">
          <Link to="/dashboard">{t("login.asParticipant")}</Link>
        </Button>
        <Button asChild variant="outline" size="sm" className="rounded-full">
          <Link to="/admin">{t("login.asAdmin")}</Link>
        </Button>
      </div>
    </AuthLayout>
  );
}
