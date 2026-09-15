import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { AuthLayout } from "@/components/site/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
      title={t("reset.title")}
      subtitle={t("reset.subtitle")}
      footer={
        <Link to="/login" className="font-medium text-hero-lime hover:underline">
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
        className="space-y-3"
        noValidate
      >
        <div className="space-y-1.5">
          <Label htmlFor="password" className="sr-only">
            {t("reset.password")}
          </Label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            placeholder={t("reset.password")}
            className="h-12 rounded-full px-5"
            aria-invalid={!!errors.password}
            {...register("password")}
          />
          {errors.password ? <p className="px-4 text-xs text-red-300">{t("common.tooShort")}</p> : null}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="confirm" className="sr-only">
            {t("reset.confirm")}
          </Label>
          <Input
            id="confirm"
            type="password"
            autoComplete="new-password"
            placeholder={t("reset.confirm")}
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
          {t("reset.submit")}
        </Button>
      </form>
    </AuthLayout>
  );
}
