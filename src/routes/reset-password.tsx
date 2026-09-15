import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { PublicShell } from "@/components/site/PublicShell";
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
    <PublicShell>
      <section className="hero-wash">
        <div className="mx-auto max-w-md px-4 py-16 sm:px-6 lg:py-24">
          <div className="panel p-7 sm:p-8">
            <h1 className="font-display text-2xl font-semibold">{t("reset.title")}</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">{t("reset.subtitle")}</p>
            <form
              onSubmit={handleSubmit(async () => {
                await new Promise((r) => setTimeout(r, 600));
                toast.success(t("common.saved"));
                navigate({ to: "/login" });
              })}
              className="mt-6 space-y-4"
              noValidate
            >
              <div className="space-y-1.5">
                <Label htmlFor="password">{t("reset.password")}</Label>
                <Input id="password" type="password" aria-invalid={!!errors.password} {...register("password")} />
                {errors.password ? (
                  <p className="text-xs text-destructive">{t("common.tooShort")}</p>
                ) : null}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirm">{t("reset.confirm")}</Label>
                <Input id="confirm" type="password" aria-invalid={!!errors.confirm} {...register("confirm")} />
                {errors.confirm ? (
                  <p className="text-xs text-destructive">{t("common.tooShort")}</p>
                ) : null}
              </div>
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : null}
                {t("reset.submit")}
              </Button>
            </form>
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
