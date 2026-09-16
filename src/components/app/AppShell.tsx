import { Link, useRouterState } from "@tanstack/react-router";
import {
  Bell,
  BookOpen,
  CalendarClock,
  CreditCard,
  FileText,
  HelpCircle,
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
type NavGroup = { label: string; labelFr: string; items: NavItem[] };

const participantGroups: NavGroup[] = [
  {
    label: "My desk",
    labelFr: "Mon espace",
    items: [
      { to: "/dashboard", key: "nav.dashboard", icon: LayoutDashboard },
      { to: "/live", key: "nav.live", icon: CalendarClock },
    ],
  },
  {
    label: "Menu",
    labelFr: "Menu",
    items: [
      { to: "/learn", key: "nav.myCourse", icon: BookOpen },
      { to: "/results", key: "nav.grades", icon: Trophy },
      { to: "/notifications", key: "nav.notifications", icon: Bell },
    ],
  },
  {
    label: "Settings",
    labelFr: "Paramètres",
    items: [{ to: "/profile", key: "nav.profile", icon: User }],
  },
];

const adminGroups: NavGroup[] = [
  {
    label: "My desk",
    labelFr: "Mon espace",
    items: [
      { to: "/admin", key: "nav.overview", icon: LayoutDashboard },
      { to: "/admin/cohorts", key: "nav.cohorts", icon: CalendarClock },
    ],
  },
  {
    label: "Menu",
    labelFr: "Menu",
    items: [
      { to: "/admin/participants", key: "nav.participants", icon: Users },
      { to: "/admin/applications", key: "nav.applications", icon: FileText },
      { to: "/admin/payments", key: "nav.payments", icon: CreditCard },
    ],
  },
  {
    label: "Settings",
    labelFr: "Paramètres",
    items: [{ to: "/admin/settings", key: "nav.settings", icon: Settings }],
  },
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
  const { t, locale } = useI18n();
  const fr = locale === "fr";
  const [open, setOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const groups = variant === "admin" ? adminGroups : participantGroups;
  const flat = groups.flatMap((g) => g.items);
  const unread = notifications.filter((n) => !n.read).length;

  const isActive = (to: string) =>
    to === "/admin" || to === "/dashboard" ? pathname === to : pathname.startsWith(to);

  const brand = (
    <Link to="/" className="flex items-center gap-2.5 px-3 py-1">
      <img src={ilsiMark.url} alt="ILSI logo" className="size-8 object-contain" />
      <span className="font-display text-xl font-semibold tracking-tight">ILSI</span>
    </Link>
  );

  const navList = (onNavigate?: () => void) => (
    <div className="space-y-6">
      {groups.map((group) => (
        <div key={group.label}>
          <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/70">
            {fr ? group.labelFr : group.label}
          </p>
          <ul className="space-y-1">
            {group.items.map((item) => (
              <li key={item.to}>
                <Link
                  to={item.to}
                  onClick={onNavigate}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                    isActive(item.to)
                      ? "border border-border bg-surface text-foreground shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
                      : "text-muted-foreground hover:bg-surface/70 hover:text-foreground",
                  )}
                  aria-current={isActive(item.to) ? "page" : undefined}
                >
                  <item.icon className={cn("size-4 shrink-0", isActive(item.to) && "text-primary")} />
                  <span className="truncate">{t(item.key)}</span>
                  {item.key === "nav.notifications" && unread > 0 ? (
                    <span className="ml-auto grid size-5 place-items-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
                      {unread}
                    </span>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );

  const helpCard = (
    <div className="rounded-2xl border border-border bg-surface p-4 text-center">
      <span className="mx-auto grid size-9 place-items-center rounded-full bg-accent text-accent-foreground">
        <HelpCircle className="size-4" />
      </span>
      <p className="mt-2 text-sm font-semibold">{fr ? "Besoin d'aide ?" : "Need support?"}</p>
      <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
        {fr
          ? "Notre équipe cohorte répond sous 24 h."
          : "Your cohort team replies within 24 hours."}
      </p>
      <Button asChild size="sm" className="mt-3 w-full rounded-full">
        <Link to="/contact">{fr ? "Contacter" : "Contact us"}</Link>
      </Button>
    </div>
  );

  const userRow = (
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-card px-3 py-2.5">
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-brand-blue/10 text-xs font-bold text-brand-blue ring-1 ring-brand-blue/15">
        {currentParticipant.firstName[0]}
        {currentParticipant.lastName[0]}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">
          {currentParticipant.firstName} {currentParticipant.lastName}
        </p>
        <p className="truncate text-[11px] text-muted-foreground">
          {variant === "admin" ? (fr ? "Administrateur" : "Administrator") : fr ? "Participante" : "Participant"}
        </p>
      </div>
      <Link
        to="/login"
        aria-label={t("nav.logout")}
        className="grid size-8 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-surface hover:text-foreground"
      >
        <LogOut className="size-4" />
      </Link>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-surface">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-[248px] shrink-0 flex-col gap-4 border-r border-border bg-card px-3 py-5 lg:flex">
        {brand}
        <nav className="mt-2 flex-1 overflow-y-auto" aria-label="Dashboard">
          {navList()}
        </nav>
        <div className="space-y-3">
          {helpCard}
          {userRow}
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar */}
        <header className="sticky top-0 z-30 border-b border-border bg-card/90 backdrop-blur lg:hidden">
          <div className="flex items-center gap-3 px-4 py-3">
            <button
              type="button"
              className="grid size-9 shrink-0 place-items-center rounded-xl border border-border"
              onClick={() => setOpen(true)}
              aria-label="Menu"
            >
              <Menu className="size-4" />
            </button>
            <h1 className="truncate font-display text-base font-semibold">
              {title ?? t("nav.dashboard")}
            </h1>
            <div className="ml-auto flex shrink-0 items-center gap-2">
              <LanguageToggle />
              <Link
                to="/notifications"
                className="relative grid size-9 place-items-center rounded-xl border border-border"
                aria-label={t("nav.notifications")}
              >
                <Bell className="size-4" />
                {unread > 0 ? (
                  <span className="absolute -right-1 -top-1 grid size-4 place-items-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
                    {unread}
                  </span>
                ) : null}
              </Link>
            </div>
          </div>
        </header>

        <main className="flex-1 px-4 pb-24 pt-5 sm:px-6 lg:pb-10 lg:pt-6">{children}</main>
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
          <div className="absolute inset-y-0 left-0 flex w-72 flex-col gap-4 bg-card px-3 py-4 shadow-[var(--shadow-lift)]">
            <div className="flex items-center justify-between">
              {brand}
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="grid size-8 place-items-center rounded-lg border border-border"
              >
                <X className="size-4" />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto" aria-label="Mobile dashboard">
              {navList(() => setOpen(false))}
            </nav>
            {userRow}
          </div>
        </div>
      ) : null}

      {/* Mobile bottom nav */}
      <nav
        className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-border bg-card lg:hidden"
        aria-label="Bottom"
      >
        {flat.slice(0, 4).map((item) => (
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
