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
import { PaymentMethodSelector } from "@/components/payment/PaymentMethodSelector";

const searchSchema = z.object({
  id: z.string().optional(),
  email: z.string().optional(),
  payment: z.string().optional(),
  payment_id: z.string().optional(),
  session_id: z.string().optional(),
  provider: z.string().optional(),
  token: z.string().optional(),
  order_id: z.string().optional(),
  PayerID: z.string().optional(),
  refference_id: z.string().optional(),
  id_transaction: z.string().optional(),
  transaction_id: z.string().optional(),
  status: z.string().optional(),
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
  const { t, locale } = useI18n();
  const fr = locale === "fr";
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
  const [initiatingPayment, setInitiatingPayment] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<"paypal" | "paym" | "stripe">("paypal");
  const [paymMethod, setPaymMethod] = useState("moncash");
  const [paymentInstructions, setPaymentInstructions] = useState<string | null>(null);

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

      const isPayPalReturn =
        (search.provider === "paypal" || search.payment === "paypal_success" || (search.token && !search.session_id)) &&
        !search.session_id;

      const isPaymReturn =
        search.provider === "paym" ||
        search.payment === "paym_return" ||
        Boolean(search.refference_id) ||
        Boolean(search.id_transaction);

      const isStripeReturn = search.payment === "success" && search.session_id;

      if (isPayPalReturn) {
        setVerifyingPayment(true);
        try {
          const res = await api.verifyProviderPayment({
            provider: "paypal",
            orderId: search.order_id || search.token,
            paymentId: search.payment_id,
            applicationId: lookup,
          });
          if (active && (res.status === "PAID" || res.status === "succeeded")) {
            toast.success(t("payment.confirmed"));
          } else if (active && (res.status === "PENDING" || res.status === "processing")) {
            toast.info(t("payment.pending"));
          }
        } catch (err: any) {
          if (active) {
            toast.error(err.message || t("payment.failed"));
          }
        } finally {
          if (active) {
            setVerifyingPayment(false);
            if (lookup) fetchStatus(lookup);
          }
        }
      } else if (isPaymReturn) {
        setVerifyingPayment(true);
        try {
          const res = await api.verifyProviderPayment({
            provider: "paym",
            referenceId: search.refference_id,
            transactionId: search.id_transaction || search.transaction_id,
            paymentId: search.payment_id,
            applicationId: lookup,
          });
          if (active && (res.status === "PAID" || res.status === "succeeded")) {
            toast.success(t("payment.confirmed"));
          } else if (active && (res.status === "PENDING" || res.status === "processing")) {
            toast.info(t("payment.pending"));
          }
        } catch (err: any) {
          if (active) {
            toast.error(err.message || t("payment.failed"));
          }
        } finally {
          if (active) {
            setVerifyingPayment(false);
            if (lookup) fetchStatus(lookup);
          }
        }
      } else if (isStripeReturn) {
        setVerifyingPayment(true);
        try {
          const res = await api.verifyCheckoutSession({
            sessionId: search.session_id!,
            paymentId: search.payment_id,
          });
          if (active && res.status === "PAID") {
            toast.success(t("payment.confirmed"));
          }
        } catch (err: any) {
          if (active) {
            toast.error(err.message || "Failed to verify payment with Stripe.");
          }
        } finally {
          if (active) {
            setVerifyingPayment(false);
            if (lookup) fetchStatus(lookup);
          }
        }
      } else if (search.payment === "cancelled" || search.status === "cancelled") {
        toast.info(t("payment.cancelled"));
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
  }, [
    search.id,
    search.email,
    search.payment,
    search.session_id,
    search.payment_id,
    search.provider,
    search.token,
    search.order_id,
    search.refference_id,
    search.id_transaction,
    search.status,
  ]);

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

  const getSelectedProviderName = (): string => {
    const raw =
      typeof selectedProvider === "string"
        ? selectedProvider
        : (selectedProvider as any)?.provider || "paypal";
    return (raw || "paypal").toLowerCase();
  };

  const getProviderButtonLabel = (): string => {
    const p = getSelectedProviderName();
    if (p === "paypal") {
      return "PayPal";
    }
    if (p === "stripe") {
      return "Stripe";
    }
    if (p === "paym") {
      if (paymMethod === "moncash") return "Pay'm (MonCash)";
      if (paymMethod === "natcash") return "Pay'm (Natcash)";
      if (paymMethod === "carte") return locale === "fr" ? "Pay'm (Carte)" : "Pay'm (Card)";
      return "Pay'm";
    }
    return locale === "fr" ? "Carte bancaire" : "Card";
  };

  const handlePay = async () => {
    if (!appData?.applicationId) {
      toast.error("Application data missing. Please check your status first.");
      return;
    }

    setInitiatingPayment(true);
    setPaymentInstructions(null);
    try {
      const cohortId = appData.cohort?.id || appData.payment?.cohortId || undefined;
      const providerId = getSelectedProviderName();
      const res = await api.createPaymentIntent({
        applicationId: appData.applicationId,
        cohortId,
        currency:
          appData.payment?.currency ||
          appData.payment?.feeCurrency ||
          appData.cohort?.feeCurrency ||
          "USD",
        provider: providerId,
        paymMethod: providerId === "paym" ? paymMethod : undefined,
      });

      if (res.checkoutUrl) {
        setRedirecting(true);
        window.location.href = res.checkoutUrl;
      } else if (res.instructions) {
        setPaymentInstructions(res.instructions);
        toast.info("Please follow the instructions below to complete your payment.");
      } else {
        toast.info(t("payment.pending"));
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to initiate payment. Please try again.");
    } finally {
      setInitiatingPayment(false);
    }
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
              {t("payment.verifying")}
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("payment.verifyingNote")}
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
              <div className="panel overflow-hidden border-2 border-primary/20 bg-card p-4 sm:p-6 shadow-[var(--shadow-soft)] max-w-full">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between max-w-full">
                  <div>
                    <div className="flex items-center gap-2">
                      <CreditCard className="size-5 text-primary shrink-0" />
                      <h3 className="text-lg font-display font-semibold">
                        {t("track.fee")}
                      </h3>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      Includes live debrief sessions, full module progression, and certification.
                    </p>
                  </div>

                  <div className="text-left sm:text-right shrink-0">
                    <div className="text-2xl sm:text-3xl font-display font-bold text-foreground">
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

                {/* Multi-provider payment selector */}
                <div className="mt-6 pt-5 border-t">
                  <PaymentMethodSelector
                    selectedProvider={selectedProvider}
                    onSelectProvider={(p: any) => {
                      const id = typeof p === "string" ? p : p?.id || p?.provider;
                      if (id) {
                        setSelectedProvider(id.toLowerCase() as any);
                      }
                    }}
                    paymMethod={paymMethod}
                    onSelectPaymMethod={setPaymMethod}
                    amount={
                      Number(appData.payment?.amount) > 0
                        ? Number(appData.payment?.amount)
                        : Number(appData.payment?.feeAmount) > 0
                        ? Number(appData.payment?.feeAmount)
                        : Number(appData.cohort?.feeAmount) > 0
                        ? Number(appData.cohort?.feeAmount)
                        : Number(appData.program?.price) > 0
                        ? Number(appData.program?.price)
                        : 95
                    }
                    currency={
                      appData.payment?.currency ||
                      appData.payment?.feeCurrency ||
                      appData.cohort?.feeCurrency ||
                      "USD"
                    }
                    disabled={redirecting || initiatingPayment}
                  />
                </div>

                {paymentInstructions && (
                  <div className="mt-4 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-sm space-y-1">
                    <div className="font-semibold text-amber-700 dark:text-amber-400">Payment Instructions:</div>
                    <div className="text-foreground whitespace-pre-wrap">{paymentInstructions}</div>
                  </div>
                )}

                <div className="mt-6 pt-5 border-t flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between max-w-full overflow-hidden">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground sm:max-w-[55%]">
                    <span className="shrink-0 text-base" aria-hidden="true">🔒</span>
                    <span className="leading-relaxed">{t("payment.verifyingNote")}</span>
                  </div>
                  <Button
                    size="lg"
                    onClick={handlePay}
                    disabled={redirecting || initiatingPayment}
                    translate="no"
                    className="notranslate w-full sm:w-auto min-h-[48px] h-auto py-3 px-6 bg-hero-lime text-hero-lime-foreground hover:bg-hero-lime/90 font-bold shadow-md whitespace-normal sm:whitespace-nowrap text-center text-sm sm:text-base transition-all shrink-0 max-w-full"
                  >
                    <span
                      key={redirecting || initiatingPayment ? "loading" : `${getSelectedProviderName()}-${paymMethod}`}
                      className="inline-flex items-center justify-center gap-2 w-full max-w-full"
                    >
                      {redirecting || initiatingPayment ? (
                        <>
                          <Loader2 className="size-4 animate-spin shrink-0" />
                          <span className="truncate">{t("track.redirecting")}</span>
                        </>
                      ) : (
                        <>
                          <span className="truncate">
                            {t("payment.payWith")} {getProviderButtonLabel()}
                          </span>
                          <ExternalLink className="size-4 shrink-0" />
                        </>
                      )}
                    </span>
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
