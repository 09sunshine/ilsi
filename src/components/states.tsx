import type { ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function EmptyState({
  icon,
  title,
  body,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  body?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/50 px-6 py-14 text-center",
        className,
      )}
    >
      {icon ? (
        <div className="mb-3 grid size-11 place-items-center rounded-full bg-secondary text-muted-foreground">
          {icon}
        </div>
      ) : null}
      <p className="font-display text-base font-semibold">{title}</p>
      {body ? <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">{body}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function ErrorState({
  title,
  body,
  onRetry,
  retryLabel,
}: {
  title: string;
  body?: string;
  onRetry?: () => void;
  retryLabel?: string;
}) {
  return (
    <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-6 py-8 text-center">
      <p className="font-display text-base font-semibold text-destructive">{title}</p>
      {body ? <p className="mt-1.5 text-sm text-muted-foreground">{body}</p> : null}
      {onRetry ? (
        <Button variant="outline" size="sm" className="mt-4" onClick={onRetry}>
          {retryLabel ?? "Try again"}
        </Button>
      ) : null}
    </div>
  );
}

export function CardsSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="panel space-y-3 p-5">
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-4/5" />
          <Skeleton className="h-9 w-28" />
        </div>
      ))}
    </div>
  );
}

export function RowsSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-14 w-full rounded-lg" />
      ))}
    </div>
  );
}
