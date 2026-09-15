import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
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
      eyebrow={t("auth.newHere")}
      title={t("signup.title")}
      subtitle={t("signup.subtitle")}
      footer={
        <span>
          {t("signup.haveAccount")}{" "}
          <Link to="/login" className="font-semibold text-neutral-900 underline underline-offset-2">
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
        className="space-y-4"
        noValidate
      >
        <div className="space-y-2">
          <FieldLabel htmlFor="name">{t("signup.name")}</FieldLabel>
          <Input
            id="name"
            autoComplete="name"
            placeholder={t("signup.name")}
            className={authInputClass}
            aria-invalid={!!errors.name}
            {...register("name")}
          />
          {errors.name ? <p className="text-xs text-red-600">{t("common.tooShort")}</p> : null}
        </div>

        <div className="space-y-2">
          <FieldLabel htmlFor="email">{t("login.email")}</FieldLabel>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@company.com"
            className={authInputClass}
            aria-invalid={!!errors.email}
            {...register("email")}
          />
          {errors.email ? <p className="text-xs text-red-600">{t("common.invalidEmail")}</p> : null}
        </div>

        <div className="space-y-2">
          <FieldLabel htmlFor="password">{t("login.password")}</FieldLabel>
          <div className="relative">
            <Input
              id="password"
              type={show ? "text" : "password"}
              autoComplete="new-password"
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

        <div className="space-y-2">
          <FieldLabel htmlFor="confirm">{t("signup.confirm")}</FieldLabel>
          <Input
            id="confirm"
            type="password"
            autoComplete="new-password"
            placeholder={t("signup.confirm")}
            className={authInputClass}
            aria-invalid={!!errors.confirm}
            {...register("confirm")}
          />
          {errors.confirm ? <p className="text-xs text-red-600">{t("common.tooShort")}</p> : null}
        </div>

        <Button type="submit" disabled={isSubmitting} className={authSubmitClass}>
          {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : null}
          {t("signup.submit")}
        </Button>
      </form>

      <SocialRow />
    </AuthLayout>
  );
}
