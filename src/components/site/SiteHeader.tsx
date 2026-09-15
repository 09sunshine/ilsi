import { Link } from "@tanstack/react-router";
import { Menu, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { LanguageToggle } from "@/components/LanguageToggle";
import { useI18n } from "@/i18n/LocaleProvider";
import { cn } from "@/lib/utils";

const links = [
  { to: "/", key: "nav.home" },
  { to: "/programs", key: "nav.programs" },
  { to: "/about", key: "nav.about" },
  { to: "/contact", key: "nav.contact" },
] as const;

export function SiteHeader() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 px-3 pt-3 sm:px-5 sm:pt-4">
      <div className="mx-auto max-w-6xl overflow-hidden rounded-xl border border-border/80 bg-card/90 shadow-[var(--shadow-lift)] backdrop-blur-xl">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-3 py-2.5 sm:px-4">
          <Link to="/" className="group flex min-w-0 items-center gap-2.5 rounded-lg pr-2">
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary font-display text-sm font-bold text-primary-foreground transition-transform group-hover:-rotate-3">
              I
            </span>
            <span className="truncate font-display text-lg font-semibold">ILSI</span>
          </Link>

          <div className="flex items-center gap-1.5">
            <nav className="mr-1 hidden items-center rounded-lg bg-surface p-1 lg:flex" aria-label="Main">
              {links.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  activeOptions={{ exact: link.to === "/" }}
                  activeProps={{ className: "text-foreground bg-card shadow-[var(--shadow-soft)]" }}
                  className="rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  {t(link.key)}
                </Link>
              ))}
            </nav>
            <LanguageToggle className="hidden sm:inline-flex" />
            <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
              <Link to="/login">{t("nav.login")}</Link>
            </Button>
            <Button asChild size="sm" className="hidden sm:inline-flex">
              <Link to="/apply">{t("nav.apply")}</Link>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              aria-label="Menu"
              className="lg:hidden"
            >
              {open ? <X className="size-4" /> : <Menu className="size-4" />}
            </Button>
          </div>
        </div>

        <div className={cn("border-t border-border bg-card lg:hidden", open ? "block" : "hidden")}>
          <nav className="flex flex-col gap-1 p-3" aria-label="Mobile">
            {links.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                activeOptions={{ exact: link.to === "/" }}
                activeProps={{ className: "bg-secondary text-foreground" }}
                onClick={() => setOpen(false)}
                className="rounded-md px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              >
                {t(link.key)}
              </Link>
            ))}
            <div className="mt-2 flex items-center gap-2 border-t border-border pt-3">
              <Button asChild variant="outline" size="sm" className="flex-1">
                <Link to="/login" onClick={() => setOpen(false)}>
                  {t("nav.login")}
                </Link>
              </Button>
              <Button asChild size="sm" className="flex-1">
                <Link to="/apply" onClick={() => setOpen(false)}>
                  {t("nav.apply")}
                </Link>
              </Button>
            </div>
            <LanguageToggle className="mt-2 self-start sm:hidden" />
          </nav>
        </div>
      </div>
    </header>
  );
}
