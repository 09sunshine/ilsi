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
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur">
      <div className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-4 py-3 sm:px-6 lg:py-4">
        <Link to="/" className="flex min-w-0 items-center gap-2.5">
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
            I
          </span>
          <span className="truncate font-display text-lg font-semibold tracking-tight">ILSI</span>
        </Link>

        <div className="flex items-center gap-1 lg:gap-2">
          <nav className="hidden items-center gap-1 lg:flex" aria-label="Main">
            {links.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                activeOptions={{ exact: link.to === "/" }}
                activeProps={{ className: "text-foreground bg-secondary" }}
                className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
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
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-label="Menu"
            className="grid size-9 place-items-center rounded-md border border-border lg:hidden"
          >
            {open ? <X className="size-4" /> : <Menu className="size-4" />}
          </button>
        </div>
      </div>

      <div className={cn("border-t border-border bg-card lg:hidden", open ? "block" : "hidden")}>
        <nav className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-3" aria-label="Mobile">
          {links.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              onClick={() => setOpen(false)}
              className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
              {t(link.key)}
            </Link>
          ))}
          <div className="mt-2 flex items-center gap-2">
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
    </header>
  );
}
