import { useState, useEffect } from "react";
import { Check, CreditCard, Loader2, Smartphone, ShieldCheck, AlertCircle } from "lucide-react";
import { api } from "@/lib/api";
import { useI18n } from "@/i18n/LocaleProvider";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface SelectedPaymentOption {
  provider: "paypal" | "paym" | "stripe" | string;
  paymMethod?: string;
  phoneNumber?: string;
}

interface PaymentMethodSelectorProps {
  selectedProvider: string | { provider: string };
  onSelectProvider: (provider: any) => void;
  paymMethod?: string;
  onSelectPaymMethod?: (method: string) => void;
  onChangePaymMethod?: (method: string) => void;
  phoneNumber?: string;
  onChangePhoneNumber?: (phone: string) => void;
  amount?: number;
  currency?: string;
  disabled?: boolean;
}

interface ProviderMethod {
  id: string;
  name: string;
  enabled: boolean;
  currencies: string[];
  descriptionEn?: string;
  descriptionFr?: string;
  subMethods?: Array<{ id: string; name: string }>;
}

export function PaymentMethodSelector({
  selectedProvider,
  onSelectProvider,
  paymMethod = "all",
  onSelectPaymMethod,
  onChangePaymMethod,
  phoneNumber = "",
  onChangePhoneNumber,
  amount,
  currency = "USD",
  disabled = false,
}: PaymentMethodSelectorProps) {
  const { locale } = useI18n();
  const fr = locale === "fr";

  const [methods, setMethods] = useState<ProviderMethod[]>([]);
  const [loading, setLoading] = useState(true);

  // Safely extract string provider ID even if an object or undefined is passed
  const rawProvider =
    typeof selectedProvider === "string"
      ? selectedProvider
      : (selectedProvider as any)?.provider || "paypal";
  const currentProviderId = (rawProvider || "paypal").toLowerCase();

  const handleSelectPaymMethod = (methodId: string) => {
    onSelectProvider("paym");
    if (onSelectPaymMethod) onSelectPaymMethod(methodId);
    if (onChangePaymMethod) onChangePaymMethod(methodId);
  };

  useEffect(() => {
    let active = true;
    async function loadMethods() {
      try {
        const res = await api.getPaymentMethods();
        const methodList = res?.methods || (res as any)?.data?.methods;
        if (active && Array.isArray(methodList)) {
          const enabledList = methodList.filter((m: any) => m.enabled);
          setMethods(enabledList);
          // If current selection is not in available methods, select first available
          if (enabledList.length > 0 && !enabledList.some((m: any) => m.id.toLowerCase() === currentProviderId)) {
            const first = enabledList[0];
            if (first) {
              onSelectProvider(first.id.toLowerCase());
            }
          }
        }
      } catch (err: any) {
        console.warn("Could not fetch payment methods:", err.message);
        if (active) {
          // Safe fallback default to active providers
          setMethods([
            {
              id: "paypal",
              name: "PayPal",
              enabled: true,
              currencies: ["USD", "EUR"],
              descriptionEn: "Pay securely with PayPal balance, credit cards or linked accounts.",
              descriptionFr: "Payez en toute sécurité avec PayPal ou cartes bancaires internationales.",
            },
            {
              id: "paym",
              name: "Pay'm",
              enabled: true,
              currencies: ["HTG", "USD"],
              descriptionEn: "Haitian mobile money & multi-currency payments (MonCash, NatCash, Card).",
              descriptionFr: "Paiement mobile en Haïti et multi-options (MonCash, NatCash, Carte).",
              subMethods: [
                { id: "all", name: fr ? "Toutes les options Pay'm" : "All Pay'm Methods" },
                { id: "moncash", name: "MonCash" },
                { id: "natcash", name: "Natcash" },
                { id: "carte", name: "Credit/Debit Card (Square)" },
                { id: "kashpaw", name: "KashPaw" },
              ],
            },
          ]);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }
    loadMethods();
    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-6 border rounded-2xl bg-muted/20 animate-pulse">
        <Loader2 className="size-5 animate-spin mr-2 text-primary" />
        <span className="text-sm text-muted-foreground">
          {fr ? "Chargement des modes de paiement disponibles..." : "Loading secure payment options..."}
        </span>
      </div>
    );
  }

  if (methods.length === 0) {
    return (
      <div className="p-4 border border-destructive/20 rounded-2xl bg-destructive/5 text-sm text-destructive flex items-center gap-2">
        <AlertCircle className="size-4 shrink-0" />
        <span>{fr ? "Aucun moyen de paiement actif actuellement." : "No active payment methods currently available."}</span>
      </div>
    );
  }

  // Calculate approximate HTG conversion for display if amount is in USD/EUR
  const approxHtg = amount && currency.toUpperCase() !== "HTG" ? Math.round(amount * 132) : null;

  return (
    <div className="space-y-4">
      <div>
        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {fr ? "Choisissez votre mode de paiement" : "Select Payment Method"}
        </Label>
        <p className="text-xs text-muted-foreground mt-0.5">
          {fr
            ? "Transactions directes, chiffrées et vérifiées par nos serveurs."
            : "Direct, server-verified and cryptographically secure payment gateways."}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {methods.map((method) => {
          const isSelected = currentProviderId === method.id.toLowerCase();
          const isPaym = method.id.toLowerCase() === "paym";
          const isPayPal = method.id.toLowerCase() === "paypal";

          return (
            <div
              key={method.id}
              role="button"
              tabIndex={disabled ? -1 : 0}
              onKeyDown={(e) => {
                if ((e.key === "Enter" || e.key === " ") && !disabled) {
                  e.preventDefault();
                  onSelectProvider(method.id.toLowerCase());
                }
              }}
              onClick={() => {
                if (!disabled) {
                  onSelectProvider(method.id.toLowerCase());
                }
              }}
              className={cn(
                "relative flex flex-col justify-between p-4 rounded-2xl border-2 cursor-pointer transition-all text-left max-w-full overflow-hidden notranslate",
                isSelected
                  ? "border-primary bg-primary/5 shadow-sm ring-1 ring-primary/20"
                  : "border-border hover:border-muted-foreground/30 bg-card hover:bg-muted/10",
                disabled && "opacity-50 cursor-not-allowed"
              )}
              translate="no"
            >
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div
                      className={cn(
                        "size-9 rounded-xl flex items-center justify-center font-bold text-xs shadow-xs",
                        isPayPal
                          ? "bg-[#003087] text-white"
                          : isPaym
                          ? "bg-amber-500 text-white"
                          : "bg-neutral-900 text-white"
                      )}
                    >
                      {isPayPal ? (
                        <span className="font-serif italic font-black text-sm">P</span>
                      ) : isPaym ? (
                        <Smartphone className="size-4" />
                      ) : (
                        <CreditCard className="size-4" />
                      )}
                    </div>
                    <div>
                      <h4 className="font-semibold text-sm text-foreground flex items-center gap-1.5">
                        {method.name}
                      </h4>
                      <div className="flex items-center gap-1 mt-0.5">
                        {method.currencies.map((curr) => (
                          <span
                            key={curr}
                            className="text-[10px] font-mono font-medium px-1.5 py-0.2 rounded bg-muted text-muted-foreground"
                          >
                            {curr}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div
                    className={cn(
                      "size-5 rounded-full border-2 flex items-center justify-center transition-colors",
                      isSelected
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-muted-foreground/30"
                    )}
                  >
                    {isSelected && <Check className="size-3 stroke-[3]" />}
                  </div>
                </div>

                <p className="mt-3 text-xs text-muted-foreground leading-relaxed">
                  {fr ? method.descriptionFr || method.descriptionEn : method.descriptionEn}
                </p>
              </div>

              {/* Sub-badge indicating currency support */}
              {isPaym && approxHtg && (
                <div className="mt-3 pt-2.5 border-t border-border/60 text-[11px] text-muted-foreground flex items-center justify-between">
                  <span>{fr ? "Équivalent HTG calculé :" : "Estimated HTG total:"}</span>
                  <span className="font-mono font-semibold text-foreground">
                    ~{approxHtg.toLocaleString()} HTG
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Pay'm specific options if selected */}
      {currentProviderId === "paym" && (
        <div className="p-4 rounded-2xl border bg-muted/30 space-y-3.5 transition-all">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <Smartphone className="size-3.5 text-primary" />
              {fr ? "Passerelle Pay'm souhaitée" : "Select Pay'm Payment Gateway"}
            </Label>
            <span className="text-[11px] text-muted-foreground">
              {fr ? "Min. 20 HTG garanti" : "Min. 20 HTG required"}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 notranslate" translate="no">
            {[
              { id: "all", name: fr ? "Toutes (All)" : "All Gateways" },
              { id: "moncash", name: "MonCash" },
              { id: "natcash", name: "Natcash" },
              { id: "carte", name: "Carte (Square)" },
            ].map((sub) => {
              const isSubSelected = (paymMethod || "all") === sub.id;
              return (
                <button
                  key={sub.id}
                  type="button"
                  onClick={() => handleSelectPaymMethod(sub.id)}
                  className={cn(
                    "px-2.5 py-2 text-xs font-medium rounded-xl border transition-all text-center truncate",
                    isSubSelected
                      ? "border-primary bg-primary text-primary-foreground shadow-xs font-semibold"
                      : "border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground"
                  )}
                >
                  {sub.name}
                </button>
              );
            })}
          </div>

          {/* Conditional phone number input for USSD methods */}
          {(paymMethod === "moncash_ussd" || paymMethod === "natcash_ussd") && (
            <div className="space-y-1.5 pt-1">
              <Label className="text-xs font-medium">
                {fr ? "Numéro de téléphone client (509XXXXXXXX)" : "Client Phone Number (509XXXXXXXX)"}
              </Label>
              <Input
                type="tel"
                placeholder="50912345678"
                value={phoneNumber}
                onChange={(e) => {
                  onChangePhoneNumber?.(e.target.value);
                }}
                className="h-10 text-sm bg-background font-mono"
              />
            </div>
          )}

          <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
            <ShieldCheck className="size-3.5 text-emerald-600 shrink-0" />
            <span>
              {fr
                ? "Paiement sécurisé par le réseau Pay'm / KashPaw avec confirmation en temps réel."
                : "Secure transaction processed via Pay'm / KashPaw network with instant verification."}
            </span>
          </p>
        </div>
      )}
    </div>
  );
}
