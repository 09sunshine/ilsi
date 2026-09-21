"use client";

import { Link } from "@tanstack/react-router";
import { Menu, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { motion, useMotionValueEvent, useScroll } from "motion/react";
import { Button } from "@/components/ui/button";
import { LanguageToggle } from "@/components/LanguageToggle";
import { useI18n } from "@/i18n/LocaleProvider";
import { cn } from "@/lib/utils";
import ilsiLogo from "@/assets/ilsi-logo.png";

const links = [
  { to: "/", key: "nav.home" },
  { to: "/programs", key: "nav.programs" },
  { to: "/about", key: "nav.about" },
  { to: "/contact", key: "nav.contact" },
] as const;

const EXPAND_SCROLL_THRESHOLD = 80;

const containerVariants = {
  expanded: {
    width: "100%",
    maxWidth: "72rem",
    height: "auto",
    transition: {
      type: "spring" as const,
      damping: 20,
      stiffness: 300,
      staggerChildren: 0.06,
      delayChildren: 0.12,
    },
  },
  collapsed: {
    width: "3.25rem",
    maxWidth: "3.25rem",
    height: "3.25rem",
    transition: {
      type: "spring" as const,
      damping: 22,
      stiffness: 300,
      when: "afterChildren" as const,
      staggerChildren: 0.04,
      staggerDirection: -1,
    },
  },
};

const itemVariants = {
  expanded: {
    opacity: 1,
    x: 0,
    scale: 1,
    transition: { type: "spring" as const, damping: 15 },
  },
  collapsed: {
    opacity: 0,
    x: -16,
    scale: 0.95,
    transition: { duration: 0.18 },
  },
};

const collapsedIconVariants = {
  expanded: { opacity: 0, scale: 0.8, transition: { duration: 0.15 } },
  collapsed: {
    opacity: 1,
    scale: 1,
    transition: { type: "spring" as const, damping: 15, stiffness: 300, delay: 0.15 },
  },
};

export function SiteHeader() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [isExpanded, setExpanded] = useState(true);

  const { scrollY } = useScroll();
  const lastScrollY = useRef(0);
  const collapsedAt = useRef(0);

  useMotionValueEvent(scrollY, "change", (latest) => {
    const previous = lastScrollY.current;

    if (isExpanded && latest > previous && latest > 120) {
      setExpanded(false);
      setOpen(false);
      collapsedAt.current = latest;
    } else if (
      !isExpanded &&
      latest < previous &&
      collapsedAt.current - latest > EXPAND_SCROLL_THRESHOLD
    ) {
      setExpanded(true);
    } else if (latest <= 20 && !isExpanded) {
      setExpanded(true);
    }

    lastScrollY.current = latest;
  });

  useEffect(() => {
    const handleScroll = () => {
      const latest = window.scrollY;
      const previous = lastScrollY.current;

      if (isExpanded && latest > previous && latest > 120) {
        setExpanded(false);
        setOpen(false);
        collapsedAt.current = latest;
      } else if (
        !isExpanded &&
        latest < previous &&
        collapsedAt.current - latest > EXPAND_SCROLL_THRESHOLD
      ) {
        setExpanded(true);
      } else if (latest <= 20 && !isExpanded) {
        setExpanded(true);
      }

      lastScrollY.current = latest;
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [isExpanded]);

  const expandIfCollapsed = (e: React.MouseEvent) => {
    if (!isExpanded) {
      e.preventDefault();
      setExpanded(true);
    }
  };

  return (
    <header
      className="fixed top-0 inset-x-0 z-50 flex justify-center px-3 pt-3 pointer-events-none sm:px-5 sm:pt-4"
    >
      <motion.div
        initial={false}
        animate={isExpanded ? "expanded" : "collapsed"}
        variants={containerVariants}
        onClick={expandIfCollapsed}
        role={isExpanded ? undefined : "button"}
        aria-label={isExpanded ? undefined : "Open navigation"}
        className={cn(
          "pointer-events-auto relative w-full overflow-hidden rounded-2xl border border-border/80 bg-card/90 shadow-[var(--shadow-lift)] backdrop-blur-xl transition-[border-radius,box-shadow] duration-200",
          !isExpanded && "cursor-pointer rounded-full shadow-lg hover:scale-105 active:scale-95",
        )}
      >
        <motion.span
          variants={collapsedIconVariants}
          className="pointer-events-none absolute inset-0 grid place-items-center"
          aria-hidden={isExpanded}
        >
          <Menu className="size-4 text-foreground" />
        </motion.span>

        <div
          className={cn(
            "grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 px-3 py-2.5 sm:px-4",
            !isExpanded && "pointer-events-none",
          )}
        >
          <motion.div variants={itemVariants} className="min-w-0">
            <Link to="/" className="group flex min-w-0 items-center gap-2.5 rounded-lg pr-2">
              <img
                src={ilsiLogo}
                alt="ILSI logo"
                className="size-9 shrink-0 object-contain transition-transform group-hover:-rotate-3"
              />
              <span className="truncate font-display text-lg font-semibold">ILSI</span>
            </Link>
          </motion.div>

          <motion.div variants={itemVariants} className="flex min-w-0 items-center justify-center gap-3">
            <nav className="hidden items-center gap-7 lg:flex" aria-label="Main">
              {links.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  activeOptions={{ exact: link.to === "/" }}
                  activeProps={{
                    className:
                      "rounded-full bg-hero-lime px-5 py-2 font-semibold text-hero-lime-foreground shadow-[var(--shadow-soft)]",
                  }}
                  className="rounded-full px-1 py-2 text-sm font-medium text-foreground/70 transition-colors hover:text-foreground"
                >
                  {t(link.key)}
                </Link>
              ))}
            </nav>
          </motion.div>

          <motion.div variants={itemVariants} className="flex items-center gap-1.5">
            <LanguageToggle className="hidden sm:inline-flex" />
            <Button asChild variant="ghost" size="sm" className="hidden md:inline-flex text-xs">
              <Link to="/track-application">{t("nav.trackApplication")}</Link>
            </Button>
            <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
              <Link to="/login">{t("nav.login")}</Link>
            </Button>
            <Button
              asChild
              size="sm"
              className="hidden bg-hero-lime text-hero-lime-foreground shadow-[var(--shadow-soft)] hover:bg-hero-lime/90 hover:text-hero-lime-foreground sm:inline-flex"
            >
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
          </motion.div>
        </div>

        <div
          className={cn(
            "border-t border-border bg-card lg:hidden",
            open && isExpanded ? "block" : "hidden",
          )}
        >
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
            <Link
              to="/track-application"
              activeProps={{ className: "bg-secondary text-foreground" }}
              onClick={() => setOpen(false)}
              className="rounded-md px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              {t("nav.trackApplication")}
            </Link>
            <div className="mt-2 flex items-center gap-2 border-t border-border pt-3">
              <Button asChild variant="outline" size="sm" className="flex-1">
                <Link to="/login" onClick={() => setOpen(false)}>
                  {t("nav.login")}
                </Link>
              </Button>
              <Button
                asChild
                size="sm"
                className="flex-1 bg-hero-lime text-hero-lime-foreground hover:bg-hero-lime/90 hover:text-hero-lime-foreground"
              >
                <Link to="/apply" onClick={() => setOpen(false)}>
                  {t("nav.apply")}
                </Link>
              </Button>
            </div>
            <LanguageToggle className="mt-2 self-start sm:hidden" />
          </nav>
        </div>
      </motion.div>
    </header>
  );
}
