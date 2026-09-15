import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, Eye, EyeOff, Loader2, Mail } from "lucide-react";
import {
  AuthLayout,
  FieldLabel,
  SocialRow,
  authInputClass,
  authSubmitClass,
} from "@/components/site/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  const router = useRouter();
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
      eyebrow={t("auth.welcome")}
      title={t("login.heading")}
      subtitle={t("login.subtitle")}
      footer={
        <span>
          {t("login.registerPrompt")}{" "}
          <Link to="/signup" className="font-semibold text-neutral-900 underline underline-offset-2">
            {t("login.registerLink")}
          </Link>
        </span>
      }
      top={
        <button
          type="button"
          onClick={() => (router.history.canGoBack() ? router.history.back() : navigate({ to: "/" }))}
          className="inline-flex items-center gap-1.5 text-sm text-neutral-500 transition-colors hover:text-neutral-900"
        >
          <ArrowLeft className="size-4" />
          {t("common.back")}
        </button>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
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

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <FieldLabel htmlFor="password">{t("login.password")}</FieldLabel>
            <Link to="/forgot-password" className="text-xs text-neutral-500 hover:text-neutral-900 hover:underline">
              {t("login.forgot")}
            </Link>
          </div>
          <div className="relative">
            <Input
              id="password"
              type={show ? "text" : "password"}
              autoComplete="current-password"
              placeholder={t("login.password")}
              className={`${authInputClass} pr-11`}
              aria-invalid={!!errors.password}
              {...register("password")}
            />
            <button
              type="button"
              onClick={() => setShow((v) => !v)}
              aria-label={t("auth.showPassword")}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-900"
            >
              {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
          {errors.password ? <p className="text-xs text-red-600">{t("common.tooShort")}</p> : null}
        </div>

        <Button type="submit" disabled={isSubmitting} className={authSubmitClass}>
          {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : null}
          {t("login.submit")}
        </Button>
      </form>

      <SocialRow />

      <p className="mt-7 text-center text-xs text-neutral-400">{t("login.demoHint")}</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <Button
          asChild
          variant="outline"
          size="sm"
          className="rounded-xl border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50"
        >
          <Link to="/dashboard">{t("login.asParticipant")}</Link>
        </Button>
        <Button
          asChild
          variant="outline"
          size="sm"
          className="rounded-xl border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50"
        >
          <Link to="/admin">{t("login.asAdmin")}</Link>
        </Button>
      </div>
    </AuthLayout>
  );
}
