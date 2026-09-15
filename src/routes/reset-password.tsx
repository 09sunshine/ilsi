import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { AuthLayout, FieldLabel, authInputClass, authSubmitClass } from "@/components/site/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/i18n/LocaleProvider";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Choose a new password — ILSI" },
      { name: "description", content: "Set a new password for your ILSI account." },
      { property: "og:title", content: "Choose a new password — ILSI" },
      { property: "og:description", content: "Set a new password for your ILSI account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ResetPasswordPage,
});

const schema = z
  .object({
    password: z.string().min(8).max(128),
    confirm: z.string().min(8).max(128),
  })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "mismatch" });

function ResetPasswordPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema) });

  return (
    <AuthLayout
      eyebrow={t("auth.resetEyebrow")}
      title={t("reset.title")}
      subtitle={t("reset.subtitle")}
      footer={
        <Link to="/login" className="font-semibold text-neutral-900 underline underline-offset-2">
          {t("forgot.back")}
        </Link>
      }
    >
      <form
        onSubmit={handleSubmit(async () => {
          await new Promise((r) => setTimeout(r, 600));
          toast.success(t("common.saved"));
          navigate({ to: "/login" });
        })}
        className="space-y-4"
        noValidate
      >
        <div className="space-y-2">
          <FieldLabel htmlFor="password">{t("reset.password")}</FieldLabel>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            placeholder={t("reset.password")}
            className={authInputClass}
            aria-invalid={!!errors.password}
            {...register("password")}
          />
          {errors.password ? <p className="text-xs text-red-600">{t("common.tooShort")}</p> : null}
        </div>
        <div className="space-y-2">
          <FieldLabel htmlFor="confirm">{t("reset.confirm")}</FieldLabel>
          <Input
            id="confirm"
            type="password"
            autoComplete="new-password"
            placeholder={t("reset.confirm")}
            className={authInputClass}
            aria-invalid={!!errors.confirm}
            {...register("confirm")}
          />
          {errors.confirm ? <p className="text-xs text-red-600">{t("common.tooShort")}</p> : null}
        </div>
        <Button type="submit" disabled={isSubmitting} className={authSubmitClass}>
          {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : null}
          {t("reset.submit")}
        </Button>
      </form>
    </AuthLayout>
  );
}
