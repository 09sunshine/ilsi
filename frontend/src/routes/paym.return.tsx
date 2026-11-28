import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { z } from "zod";
import { Loader2 } from "lucide-react";

const looseParam = z
  .union([z.string(), z.number()])
  .transform((val) => String(val))
  .optional();

const searchSchema = z
  .object({
    id: looseParam,
    email: looseParam,
    payment: looseParam,
    payment_id: looseParam,
    session_id: looseParam,
    provider: looseParam,
    token: looseParam,
    order_id: looseParam,
    PayerID: looseParam,
    payer_id: looseParam,
    refference_id: looseParam,
    reference_id: looseParam,
    id_transaction: looseParam,
    transaction_id: looseParam,
    status: looseParam,
    statut: looseParam,
    montant: looseParam,
    method: looseParam,
  })
  .passthrough();

export const Route = createFileRoute("/paym/return")({
  validateSearch: searchSchema,
  component: PaymReturnRedirectPage,
});

function PaymReturnRedirectPage() {
  const search = Route.useSearch();

  useEffect(() => {
    const params = new URLSearchParams();
    Object.entries(search).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "") {
        params.set(k, String(v));
      }
    });

    if (!params.has("provider")) {
      params.set("provider", "paym");
    }
    if (!params.has("payment")) {
      params.set("payment", "paym_return");
    }

    window.location.replace(`/track-application?${params.toString()}`);
  }, [search]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="text-center space-y-3">
        <Loader2 className="size-8 animate-spin mx-auto text-primary" />
        <p className="text-sm font-medium text-foreground">
          Vérification de votre paiement Pay'm (MonCash / NatCash)...
        </p>
      </div>
    </div>
  );
}
