import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { AuthLayout, SocialRow } from "@/components/site/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/i18n/LocaleProvider";

export const Route = createFileRoute("/signup")({
  head: () => ({
    meta: [
      { title: "Create your ILSI account" },
      { name: "description", content: "Create an ILSI account to join a cohort and track your training progress." },
      { property: "og:title", content: "Create your ILSI account" },
      { property: "og:description", content: "Join an ILSI cohort and follow your program from one dashboard." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SignupPage,
});

const schema = z
  .object({
    name: z.string().trim().min(2).max(120),
    email: z.string().trim().email().max(255),
    password: z.string().min(8).max(128),
    confirm: z.string().min(8).max(128),
  })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "mismatch" });

function SignupPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [show, setShow] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema) });

  return (
    <AuthLayout
      title={t("signup.title")}
      subtitle={t("signup.subtitle")}
      footer={
        <span className="text-white/60">
          {t("signup.haveAccount")}{" "}
          <Link to="/login" className="font-medium text-hero-lime hover:underline">
            {t("signup.loginLink")}
          </Link>
        </span>
      }
    >
      <form
        onSubmit={handleSubmit(async () => {
          await new Promise((r) => setTimeout(r, 600));
          toast.success(t("signup.submit"));
          navigate({ to: "/dashboard" });
        })}
        className="space-y-3"
        noValidate
      >
        <div className="space-y-1.5">
          <Label htmlFor="name" className="sr-only">
            {t("signup.name")}
          </Label>
          <Input
            id="name"
            autoComplete="name"
            placeholder={t("signup.name")}
            className="h-12 rounded-full px-5"
            aria-invalid={!!errors.name}
            {...register("name")}
          />
          {errors.name ? <p className="px-4 text-xs text-red-300">{t("common.tooShort")}</p> : null}
        </div>

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

        <div className="space-y-1.5">
          <Label htmlFor="password" className="sr-only">
            {t("login.password")}
          </Label>
          <div className="relative">
            <Input
              id="password"
              type={show ? "text" : "password"}
              autoComplete="new-password"
              placeholder={t("login.password")}
              className="h-12 rounded-full px-5 pr-12"
              aria-invalid={!!errors.password}
              {...register("password")}
            />
            <button
              type="button"
              onClick={() => setShow((v) => !v)}
              aria-label={t("auth.showPassword")}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-white/50 hover:text-white"
            >
              {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
          {errors.password ? <p className="px-4 text-xs text-red-300">{t("common.tooShort")}</p> : null}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="confirm" className="sr-only">
            {t("signup.confirm")}
          </Label>
          <Input
            id="confirm"
            type="password"
            autoComplete="new-password"
            placeholder={t("signup.confirm")}
            className="h-12 rounded-full px-5"
            aria-invalid={!!errors.confirm}
            {...register("confirm")}
          />
          {errors.confirm ? <p className="px-4 text-xs text-red-300">{t("common.tooShort")}</p> : null}
        </div>

        <Button
          type="submit"
          disabled={isSubmitting}
          className="h-12 w-full rounded-full bg-hero-lime text-hero-lime-foreground hover:bg-hero-lime/90"
        >
          {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : null}
          {t("signup.submit")}
        </Button>
      </form>

      <SocialRow />
    </AuthLayout>
  );
}
