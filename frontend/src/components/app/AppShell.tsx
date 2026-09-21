import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { useRef } from "react";
import {
  Bell,
  BookOpen,
  CalendarClock,
  CreditCard,
  FileText,
  HandHeart,
  HeartHandshake,
  HelpCircle,
  LayoutDashboard,
  LogOut,
  Mail,
  Menu,

  Radio,
  Settings,
  Trophy,
  User,
  Users,
  X,
} from "lucide-react";
import { useState, useEffect, type ComponentType, type ReactNode } from "react";
import { LanguageToggle } from "@/components/LanguageToggle";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n/LocaleProvider";
import type { TranslationKey } from "@/i18n/translations";
import { cn } from "@/lib/utils";
import ilsiLogo from "@/assets/ilsi-logo.png";
import { api } from "@/lib/api";
import { MandatoryPasswordChangeModal } from "@/components/auth/MandatoryPasswordChangeModal";
import {
  isDesktopNotificationSupported,
  getDesktopNotificationPermission,
  requestDesktopNotificationPermission,
  showDesktopNotification,
} from "@/lib/desktopNotifications";


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
      { to: "/admin/notifications", key: "nav.notifications", icon: Bell },
    ],
  },
  {
    label: "Menu",
    labelFr: "Menu",
    items: [
      { to: "/admin/participants", key: "nav.participants", icon: Users },
      { to: "/admin/applications", key: "nav.applications", icon: FileText },
      { to: "/admin/payments", key: "nav.payments", icon: CreditCard },
      { to: "/admin/donations", key: "nav.donations", icon: HandHeart },
      { to: "/admin/volunteers", key: "nav.volunteers", icon: HeartHandshake },
      { to: "/admin/messages", key: "nav.messages", icon: Mail },
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
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [unread, setUnread] = useState(0);
  const [userProfile, setUserProfile] = useState<{ firstName?: string; lastName?: string; name?: string; role?: string } | null>(null);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const knownNotifIds = useRef<Set<string>>(new Set());
  const isFirstLoad = useRef<boolean>(true);
  
  const isAdmin =
    variant === "admin" ||
    pathname.startsWith("/admin") ||
    userProfile?.role === "ADMIN" ||
    userProfile?.role === "SUPER_ADMIN";
  const effectiveVariant = isAdmin ? "admin" : "participant";
  const groups = effectiveVariant === "admin" ? adminGroups : participantGroups;
  const flat = groups.flatMap((g) => g.items);

  // Auto-request desktop notification permission once authenticated if browser supports it
  useEffect(() => {
    if (userProfile && isDesktopNotificationSupported() && getDesktopNotificationPermission() === "default") {
      void requestDesktopNotificationPermission();
    }
  }, [userProfile]);

  useEffect(() => {
    async function checkFirstLogin() {
      try {
        const profile = await api.getProfile();
        if (profile) {
          setUserProfile(profile);
          if (profile.firstLogin) {
            setMustChangePassword(true);
          }
        }
      } catch {
        // Not authenticated or network issue
      }
    }

    async function checkUnread() {
      try {
        const notifs = await api.getNotifications();
        if (Array.isArray(notifs)) {
          setUnread(notifs.filter((n: any) => !n.read).length);

          if (isFirstLoad.current) {
            // First load: record existing notification IDs without popup spam
            notifs.forEach((n: any) => knownNotifIds.current.add(n.id));
            isFirstLoad.current = false;
          } else {
            // Subsequent polls: detect fresh unread items and fire native desktop notification
            const freshUnread = notifs.filter(
              (n: any) => !n.read && !knownNotifIds.current.has(n.id)
            );

            for (const n of freshUnread) {
              knownNotifIds.current.add(n.id);
              const titleText =
                typeof n.title === "object"
                  ? (fr ? n.title.fr : n.title.en) || n.title.en
                  : n.title;
              const bodyText =
                typeof n.body === "object"
                  ? (fr ? n.body.fr : n.body.en) || n.body.en
                  : n.body;

              showDesktopNotification({
                title: titleText || "ILSI Notification",
                body: bodyText || "",
                tag: n.id,
                onClick: () => {
                  void navigate({
                    to: effectiveVariant === "admin" ? "/admin/notifications" : "/notifications",
                  });
                },
              });
            }
          }
        }
      } catch {
        // Ignored if unauthenticated
      }
    }

    void checkFirstLogin();
    void checkUnread();

    const interval = setInterval(() => {
      void checkUnread();
    }, 15000);

    return () => clearInterval(interval);
  }, [fr, effectiveVariant, navigate]);


  const isActive = (to: string) =>
    to === "/admin" || to === "/dashboard" ? pathname === to : pathname.startsWith(to);

  const brand = (
    <Link to="/" className="flex items-center gap-2.5 px-3 py-1">
      <img src={ilsiLogo} alt="ILSI logo" className="size-8 object-contain" />
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

  const firstName = userProfile?.firstName || userProfile?.name?.split(" ")[0] || "";
  const lastName = userProfile?.lastName || userProfile?.name?.split(" ").slice(1).join(" ") || "";
  const displayName = firstName ? `${firstName} ${lastName}`.trim() : (variant === "admin" ? "Admin" : "Student");
  const initials = `${firstName[0] || displayName[0] || "U"}${lastName[0] || ""}`.toUpperCase();

  const userRow = (
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-card px-3 py-2.5">
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-brand-blue/10 text-xs font-bold text-brand-blue ring-1 ring-brand-blue/15">
        {initials}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">
          {displayName}
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
        {/* Top bar (Desktop & Mobile) */}
        <header className="sticky top-0 z-30 border-b border-border bg-card/90 backdrop-blur">
          <div className="flex items-center gap-3 px-4 py-3 sm:px-6">
            <button
              type="button"
              className="grid size-9 shrink-0 place-items-center rounded-xl border border-border lg:hidden"
              onClick={() => setOpen(true)}
              aria-label="Menu"
            >
              <Menu className="size-4" />
            </button>
            <h1 className="truncate font-display text-base font-semibold sm:text-lg">
              {title ?? (effectiveVariant === "admin" ? t("nav.overview") : t("nav.dashboard"))}
            </h1>
            <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-3">
              <LanguageToggle />
              <Link
                to={effectiveVariant === "admin" ? "/admin/notifications" : "/notifications"}
                className="relative grid size-9 place-items-center rounded-xl border border-border text-foreground/80 transition-colors hover:bg-surface hover:text-foreground"
                aria-label={t("nav.notifications")}
                title={t("nav.notifications")}
              >
                <Bell className="size-4" />
                {unread > 0 ? (
                  <span className="absolute -right-1 -top-1 grid min-w-4 h-4 px-1 place-items-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground shadow-sm">
                    {unread > 99 ? "99+" : unread}
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

      {/* Mandatory Password Change Modal for One-Time Password logins */}
      <MandatoryPasswordChangeModal
        isOpen={mustChangePassword}
        onPasswordChanged={() => setMustChangePassword(false)}
      />
    </div>
  );
}

