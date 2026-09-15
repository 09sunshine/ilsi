import { Link, useRouterState } from "@tanstack/react-router";
import {
  Bell,
  BookOpen,
  CreditCard,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  Radio,
  Settings,
  Trophy,
  User,
  Users,
  X,
} from "lucide-react";
import { useState, type ComponentType, type ReactNode } from "react";
import { LanguageToggle } from "@/components/LanguageToggle";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n/LocaleProvider";
import { notifications, currentParticipant } from "@/data/demo";
import type { TranslationKey } from "@/i18n/translations";
import { cn } from "@/lib/utils";

type NavItem = { to: string; key: TranslationKey; icon: ComponentType<{ className?: string }> };

const participantNav: NavItem[] = [
  { to: "/dashboard", key: "nav.dashboard", icon: LayoutDashboard },
  { to: "/learn", key: "nav.myCourse", icon: BookOpen },
  { to: "/live", key: "nav.live", icon: Radio },
  { to: "/results", key: "nav.grades", icon: Trophy },
  { to: "/notifications", key: "nav.notifications", icon: Bell },
  { to: "/profile", key: "nav.profile", icon: User },
];

const adminNav: NavItem[] = [
  { to: "/admin", key: "nav.overview", icon: LayoutDashboard },
  { to: "/admin/participants", key: "nav.participants", icon: Users },
  { to: "/admin/applications", key: "nav.applications", icon: FileText },
  { to: "/admin/cohorts", key: "nav.cohorts", icon: BookOpen },
  { to: "/admin/payments", key: "nav.payments", icon: CreditCard },
  { to: "/admin/settings", key: "nav.settings", icon: Settings },
];

export function AppShell({
  children,
  variant = "participant",
  title,
}: {
  children: ReactNode;
  variant?: "participant" | "admin";
  title?: string;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const nav = variant === "admin" ? adminNav : participantNav;
  const unread = notifications.filter((n) => !n.read).length;

  const isActive = (to: string) =>
    to === "/admin" || to === "/dashboard" ? pathname === to : pathname.startsWith(to);

  const navList = (onNavigate?: () => void) => (
    <ul className="space-y-1">
      {nav.map((item) => (
        <li key={item.to}>
          <Link
            to={item.to}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              isActive(item.to)
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
            )}
            aria-current={isActive(item.to) ? "page" : undefined}
          >
            <item.icon className="size-4 shrink-0" />
            <span className="truncate">{t(item.key)}</span>
          </Link>
        </li>
      ))}
    </ul>
  );

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar px-3 py-4 lg:flex">
        <Link to="/" className="flex items-center gap-2.5 px-2 py-2">
          <span className="grid size-8 place-items-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
            I
          </span>
          <span className="font-display text-lg font-semibold">ILSI</span>
        </Link>
        <nav className="mt-6 flex-1" aria-label="Dashboard">
          {navList()}
        </nav>
        <div className="border-t border-sidebar-border pt-3">
          <Link
            to="/login"
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground"
          >
            <LogOut className="size-4" /> {t("nav.logout")}
          </Link>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar */}
        <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 sm:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                className="grid size-9 shrink-0 place-items-center rounded-md border border-border lg:hidden"
                onClick={() => setOpen(true)}
                aria-label="Menu"
              >
                <Menu className="size-4" />
              </button>
              <h1 className="truncate font-display text-lg font-semibold sm:text-xl">
                {title ?? t("nav.dashboard")}
              </h1>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <LanguageToggle className="hidden sm:inline-flex" />
              <Link
                to="/notifications"
                className="relative grid size-9 place-items-center rounded-md border border-border"
                aria-label={t("nav.notifications")}
              >
                <Bell className="size-4" />
                {unread > 0 ? (
                  <span className="absolute -right-1 -top-1 grid size-4 place-items-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
                    {unread}
                  </span>
                ) : null}
              </Link>
              <span className="grid size-9 place-items-center rounded-full bg-secondary text-xs font-semibold">
                {currentParticipant.firstName[0]}
                {currentParticipant.lastName[0]}
              </span>
            </div>
          </div>
        </header>

        <main className="flex-1 px-4 pb-24 pt-5 sm:px-6 lg:pb-10">{children}</main>
      </div>

      {/* Mobile drawer */}
      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close menu"
            className="absolute inset-0 bg-foreground/30"
            onClick={() => setOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 w-72 bg-sidebar px-3 py-4 shadow-[var(--shadow-lift)]">
            <div className="flex items-center justify-between px-2">
              <span className="font-display text-lg font-semibold">ILSI</span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="grid size-8 place-items-center rounded-md border border-border"
              >
                <X className="size-4" />
              </button>
            </div>
            <nav className="mt-6" aria-label="Mobile dashboard">
              {navList(() => setOpen(false))}
            </nav>
            <div className="mt-6 px-2">
              <LanguageToggle />
            </div>
            <Button asChild variant="outline" size="sm" className="mt-4 w-full">
              <Link to="/login" onClick={() => setOpen(false)}>
                {t("nav.logout")}
              </Link>
            </Button>
          </div>
        </div>
      ) : null}

      {/* Mobile bottom nav */}
      <nav
        className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-border bg-card lg:hidden"
        aria-label="Bottom"
      >
        {nav.slice(0, 4).map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className={cn(
              "flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium",
              isActive(item.to) ? "text-primary" : "text-muted-foreground",
            )}
          >
            <item.icon className="size-5" />
            <span className="truncate px-1">{t(item.key)}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
