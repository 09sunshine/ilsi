import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { z } from "zod";
import {
  Search,
  CheckCircle2,
  Clock,
  CreditCard,
  AlertCircle,
  CalendarDays,
  ArrowRight,
  ExternalLink,
  Copy,
  Check,
  GraduationCap,
  Sparkles,
  Loader2,
  ShieldCheck,
  Lock,
  Eye,
  EyeOff,
  UserCheck,
} from "lucide-react";
import { PageHeader, PublicShell } from "@/components/site/PublicShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useI18n, useLocalized } from "@/i18n/LocaleProvider";
import { api } from "@/lib/api";
import { signIn, useSession } from "@/lib/auth-client";
import { toast } from "sonner";

const searchSchema = z.object({
  id: z.string().optional(),
  email: z.string().optional(),
  payment: z.string().optional(),
  payment_id: z.string().optional(),
  session_id: z.string().optional(),
});

export const Route = createFileRoute("/track-application")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Track Your Application — ILSI" },
      {
        name: "description",
        content: "Track your cohort admission status and proceed to enrollment payment.",
      },
      { name: "robots", content: "index, follow" },
      { property: "og:title", content: "Track Your Application — ILSI" },
      {
        property: "og:description",
        content: "Track your cohort admission status and proceed to enrollment payment.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Track Your Application — ILSI" },
      {
        name: "twitter:description",
        content: "Track your cohort admission status and proceed to enrollment payment.",
      },
    ],
  }),
  component: TrackApplicationPage,
});

function TrackApplicationPage() {
  const { t } = useI18n();
  const L = useLocalized();
  const search = Route.useSearch();
  const navigate = useNavigate();
  const { data: sessionData } = useSession();

  const [query, setQuery] = useState(search.id || search.email || "");
  const [loading, setLoading] = useState(false);
  const [verifyingPayment, setVerifyingPayment] = useState(false);
  const [appData, setAppData] = useState<any>(null);
  const [copied, setCopied] = useState(false);
  const [redirecting, setRedirecting] = useState(false);

  // Account Password Creation state
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [activating, setActivating] = useState(false);

  const fetchStatus = async (inputVal: string) => {
    const trimmed = inputVal.trim();
    if (!trimmed) return;

    setLoading(true);

    const isEmail = trimmed.includes("@");
    const payload = isEmail ? { email: trimmed } : { applicationId: trimmed };

    try {
      const res = await api.trackApplication(payload);
      setAppData(res);
    } catch (err: any) {
      toast.error(err.message || "Application not found. Please verify your details.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;

    const handleInitialLoad = async () => {
      const lookup = search.id || search.email || "";
      if (lookup) {
        setQuery(lookup);
      }

      // If returning from Stripe Checkout with payment success
      if (search.payment === "success" && search.session_id) {
        setVerifyingPayment(true);
        try {
          const res = await api.verifyCheckoutSession({
            sessionId: search.session_id,
            paymentId: search.payment_id,
          });
          if (active && res.status === "PAID") {
            toast.success("Payment Confirmed! Your cohort seat is officially reserved.");
          }
        } catch (err: any) {
          if (active) {
            toast.error(err.message || "Failed to verify payment with Stripe.");
          }
        } finally {
          if (active) {
            setVerifyingPayment(false);
            if (lookup) {
              fetchStatus(lookup);
            }
          }
        }
      } else if (search.payment === "cancelled") {
        toast.info("Payment was cancelled. You can complete your enrollment payment whenever you're ready.");
        if (lookup) {
          fetchStatus(lookup);
        }
      } else if (lookup) {
        fetchStatus(lookup);
      }
    };

    handleInitialLoad();

    return () => {
      active = false;
    };
  }, [search.id, search.email, search.payment, search.session_id, search.payment_id]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchStatus(query);
  };

  const copyApplicationId = (id: string) => {
    navigator.clipboard.writeText(id);
    setCopied(true);
    toast.success(t("apply.idCopied"));
    setTimeout(() => setCopied(false), 2500);
  };

  const handlePay = () => {
    if (!appData?.payment?.checkoutUrl) {
      toast.error("Checkout link is being prepared. Please try again in a few moments.");
      return;
    }
    setRedirecting(true);
    window.location.href = appData.payment.checkoutUrl;
  };

  const handleActivateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 8) {
      toast.error("Password must be at least 8 characters long.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }

    setActivating(true);
    try {
      await api.activateApplicationAccount({
        applicationId: appData.applicationId,
        email: appData.applicant.email,
        password: newPassword,
      });

      toast.success("Password created! Logging you in to your portal...");

      // Automatically sign in the student with Better-Auth
      const loginRes = await signIn.email({
        email: appData.applicant.email,
        password: newPassword,
      });

      if (loginRes?.error) {
        toast.info("Password saved! Please log in with your credentials.");
        navigate({ to: "/login" });
        return;
      }

      toast.success("Welcome to ILSI! Opening your learning dashboard.");
      navigate({ to: "/dashboard" });
    } catch (err: any) {
      toast.error(err.message || "Failed to set password. Please try again.");
    } finally {
      setActivating(false);
    }
  };

  const isAcceptedOrEnrolled =
    appData?.status === "ACCEPTED" ||
    appData?.status === "SELECTED" ||
    appData?.status === "ENROLLED";

  const isPaid = appData?.payment?.status === "PAID" || appData?.status === "ENROLLED";
  const needsPasswordSetup = isPaid && !appData?.account?.isActivated;

  return (
    <PublicShell>
      <PageHeader
        eyebrow={t("nav.apply")}
        title={t("track.title")}
        subtitle={t("track.subtitle")}
      />

      <section className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        {/* Search Bar */}
        <form onSubmit={handleSearchSubmit} className="panel mb-10 p-4 sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("track.searchPlaceholder")}
                className="pl-10 h-11 text-base bg-background"
                required
              />
            </div>
            <Button
              type="submit"
              disabled={loading || verifyingPayment || !query.trim()}
              className="h-11 px-6 font-semibold"
            >
              {loading ? (
                <>
                  <Loader2 className="size-4 animate-spin mr-2" />
                  {t("track.checkStatus")}
                </>
              ) : (
                t("track.checkStatus")
              )}
            </Button>
          </div>
        </form>

        {/* Verifying Payment Banner */}
        {verifyingPayment && (
          <div className="panel mb-8 border-primary/40 bg-primary/5 p-6 text-center animate-pulse">
            <Loader2 className="size-8 animate-spin mx-auto text-primary" />
            <h3 className="mt-3 text-lg font-semibold text-foreground">
              Verifying Stripe Payment...
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Please wait while we confirm your transaction and activate your cohort enrollment.
            </p>
          </div>
        )}

        {/* Loading State */}
        {loading && !verifyingPayment && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Loader2 className="size-8 animate-spin text-primary" />
            <p className="mt-3 text-sm text-muted-foreground">{t("track.checkStatus")}…</p>
          </div>
        )}

        {/* Application Data Card */}
        {appData && !loading && (
          <div className="space-y-6">
            {/* Top Status Banner */}
            <div className="panel overflow-hidden border p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
                      {t("track.applicationId")}
                    </span>
                    <button
                      onClick={() => copyApplicationId(appData.applicationId)}
                      className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-mono bg-muted text-muted-foreground hover:text-foreground transition-colors"
                      title={t("apply.copyId")}
                    >
                      {appData.applicationId}
                      {copied ? (
                        <Check className="size-3 text-success" />
                      ) : (
                        <Copy className="size-3" />
                      )}
                    </button>
                  </div>
                  <h2 className="mt-1 text-xl font-display font-semibold">
                    {appData.applicant?.firstName} {appData.applicant?.lastName}
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {appData.applicant?.email} • {appData.applicant?.city}, {appData.applicant?.country}
                  </p>
                </div>

                <div className="shrink-0">
                  {isPaid || appData.status === "ENROLLED" ? (
                    <Badge className="bg-success text-success-foreground text-sm px-3 py-1 gap-1.5 shadow-sm">
                      <ShieldCheck className="size-4" />
                      Enrolled & Confirmed
                    </Badge>
                  ) : isAcceptedOrEnrolled ? (
                    <Badge className="bg-success text-success-foreground text-sm px-3 py-1 gap-1.5 shadow-sm">
                      <CheckCircle2 className="size-4" />
                      {t("track.acceptedTitle")}
                    </Badge>
                  ) : appData.status === "REJECTED" ? (
                    <Badge variant="destructive" className="text-sm px-3 py-1 gap-1.5">
                      <AlertCircle className="size-4" />
                      {t("track.rejectedTitle")}
                    </Badge>
                  ) : (
                    <Badge
                      variant="secondary"
                      className="text-sm px-3 py-1 gap-1.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                    >
                      <Clock className="size-4" />
                      {t("track.pendingTitle")}
                    </Badge>
                  )}
                </div>
              </div>

              {/* Status Explanation Box */}
              <div className="mt-5 rounded-xl border p-4 bg-muted/40">
                {isPaid || appData.status === "ENROLLED" ? (
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="size-5 text-success shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-sm font-semibold text-foreground">
                        Enrollment Completed & Confirmed
                      </h4>
                      <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                        Your payment has been successfully verified and your cohort seat is reserved.
                        {needsPasswordSetup
                          ? " Create your password below to instantly enter your student portal."
                          : " You can log in using your account credentials to access your courses."}
                      </p>
                    </div>
                  </div>
                ) : isAcceptedOrEnrolled ? (
                  <div className="flex items-start gap-3">
                    <Sparkles className="size-5 text-amber-500 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-sm font-semibold">{t("track.acceptedTitle")}</h4>
                      <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                        {t("track.acceptedNote")}
                      </p>
                    </div>
                  </div>
                ) : appData.status === "REJECTED" ? (
                  <div className="flex items-start gap-3">
                    <AlertCircle className="size-5 text-destructive shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-sm font-semibold">{t("track.rejectedTitle")}</h4>
                      <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                        {t("track.rejectedNote")}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-3">
                    <Clock className="size-5 text-amber-500 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-sm font-semibold">{t("track.pendingTitle")}</h4>
                      <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                        {t("track.pendingNote")}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Program & Cohort Details */}
            <div className="grid gap-6 sm:grid-cols-2">
              <div className="panel p-5 space-y-3">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <GraduationCap className="size-4 text-primary" />
                  {t("track.program")}
                </div>
                <div>
                  <h3 className="text-base font-semibold">
                    {L(appData.program?.title) || "Leadership Program"}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    {t("track.submittedOn")}:{" "}
                    {appData.submittedAt
                      ? new Date(appData.submittedAt).toLocaleDateString()
                      : "—"}
                  </p>
                </div>
              </div>

              <div className="panel p-5 space-y-3">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <CalendarDays className="size-4 text-primary" />
                  {t("track.cohort")}
                </div>
                <div>
                  <h3 className="text-base font-semibold">
                    {appData.cohort ? L(appData.cohort.name) : "Assigned with Admission"}
                  </h3>
                  {appData.cohort ? (
                    <p className="text-xs text-muted-foreground mt-1">
                      {appData.cohort.startDate} → {appData.cohort.endDate} ({appData.cohort.timezone})
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground mt-1">
                      Next cohort schedule will be finalized upon acceptance.
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* STEP 1: Tuition Payment Card (Shown if not paid yet) */}
            {!isPaid && isAcceptedOrEnrolled && (
              <div className="panel overflow-hidden border-2 border-primary/20 bg-card p-6 shadow-[var(--shadow-soft)]">
                <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <CreditCard className="size-5 text-primary" />
                      <h3 className="text-lg font-display font-semibold">
                        {t("track.fee")}
                      </h3>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      Includes live debrief sessions, full module progression, and certification.
                    </p>
                  </div>

                  <div className="text-right sm:text-right">
                    <div className="text-3xl font-display font-bold text-foreground">
                      {(appData.payment?.currency || appData.payment?.feeCurrency || appData.cohort?.feeCurrency) === "EUR" ? "€" : "$"}
                      {Number(appData.payment?.amount) > 0
                        ? Number(appData.payment?.amount)
                        : Number(appData.payment?.feeAmount) > 0
                        ? Number(appData.payment?.feeAmount)
                        : Number(appData.cohort?.feeAmount) > 0
                        ? Number(appData.cohort?.feeAmount)
                        : Number(appData.program?.price) > 0
                        ? Number(appData.program?.price)
                        : 95}
                      <span className="text-sm font-normal text-muted-foreground ml-1">
                        {appData.payment?.currency || appData.payment?.feeCurrency || appData.cohort?.feeCurrency || "USD"}
                      </span>
                    </div>
                    <span className="inline-block text-xs font-medium text-muted-foreground mt-0.5">
                      Fixed cohort fee
                    </span>
                  </div>
                </div>

                <div className="mt-6 pt-5 border-t flex flex-col gap-3 sm:flex-row sm:justify-end">
                  <Button
                    size="lg"
                    onClick={handlePay}
                    disabled={redirecting || !appData.payment?.checkoutUrl}
                    className="w-full sm:w-auto bg-hero-lime text-hero-lime-foreground hover:bg-hero-lime/90 font-bold px-8 shadow-md"
                  >
                    {redirecting ? (
                      <>
                        <Loader2 className="size-4 animate-spin mr-2" />
                        {t("track.redirecting")}
                      </>
                    ) : (
                      <>
                        {t("track.payNow")}
                        <ExternalLink className="size-4 ml-2" />
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}

            {/* STEP 2: Account Password Creation Form (Shown after payment if password not set yet) */}
            {needsPasswordSetup && (
              <div className="panel overflow-hidden border-2 border-primary/30 bg-card p-6 shadow-md space-y-4">
                <div className="flex items-start gap-3">
                  <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
                    <Lock className="size-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-display font-semibold text-foreground">
                      Set Your Password & Activate Student Portal
                    </h3>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      Your tuition is paid! Create your password to immediately sign in and access your orientation, modules, and schedule.
                    </p>
                    <p className="text-xs text-primary font-medium mt-1">
                      Login Email: <span className="font-mono">{appData.applicant?.email}</span>
                    </p>
                  </div>
                </div>

                <form onSubmit={handleActivateAccount} className="pt-3 border-t space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Create Password
                      </label>
                      <div className="relative">
                        <Input
                          type={showPassword ? "text" : "password"}
                          placeholder="Min. 8 characters"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          required
                          minLength={8}
                          className="h-11 pr-10 bg-background"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          tabIndex={-1}
                        >
                          {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Confirm Password
                      </label>
                      <Input
                        type={showPassword ? "text" : "password"}
                        placeholder="Re-enter password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                        minLength={8}
                        className="h-11 bg-background"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row sm:justify-end pt-2">
                    <Button
                      type="submit"
                      disabled={activating || !newPassword || newPassword !== confirmPassword}
                      size="lg"
                      className="w-full sm:w-auto font-bold bg-hero-lime text-hero-lime-foreground hover:bg-hero-lime/90 px-8 shadow-md"
                    >
                      {activating ? (
                        <>
                          <Loader2 className="size-4 animate-spin mr-2" />
                          Activating & Logging In...
                        </>
                      ) : (
                        <>
                          Save Password & Enter Student Portal
                          <ArrowRight className="size-4 ml-2" />
                        </>
                      )}
                    </Button>
                  </div>
                </form>
              </div>
            )}

            {/* STEP 3: Already Activated Account Card */}
            {isPaid && !needsPasswordSetup && (
              <div className="panel overflow-hidden border-2 border-success/30 bg-card p-6 shadow-sm">
                <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start gap-3">
                    <div className="p-2.5 rounded-xl bg-success/10 text-success shrink-0 mt-0.5">
                      <UserCheck className="size-5" />
                    </div>
                    <div>
                      <h4 className="text-base font-semibold text-foreground">
                        Student Account Active & Ready
                      </h4>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        Your account is set up with email <span className="font-semibold text-foreground font-mono">{appData.applicant?.email}</span>.
                      </p>
                    </div>
                  </div>

                  <Button asChild size="lg" className="w-full sm:w-auto font-semibold px-8 shrink-0">
                    <Link to="/login">
                      {sessionData?.user ? "Enter Student Dashboard" : t("track.loginToPortal")}
                      <ArrowRight className="size-4 ml-2" />
                    </Link>
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </section>
    </PublicShell>
  );
}
