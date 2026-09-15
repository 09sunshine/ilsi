"use client";

import type { ComponentProps, ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";
import {
  FacebookIcon,
  InstagramIcon,
  LinkedinIcon,
  YoutubeIcon,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useI18n } from "@/i18n/LocaleProvider";

interface FooterLink {
  title: string;
  href: string;
  icon?: React.ComponentType<{ className?: string }>;
}

interface FooterSection {
  label: string;
  links: FooterLink[];
}

export function Footer() {
  const { t } = useI18n();

  const footerLinks: FooterSection[] = [
    {
      label: t("nav.programs"),
      links: [
        { title: t("programs.title"), href: "/programs" },
        { title: t("nav.apply"), href: "/apply" },
        { title: t("nav.login"), href: "/login" },
        { title: t("how.title"), href: "/#how-it-works" },
      ],
    },
    {
      label: "ILSI",
      links: [
        { title: t("nav.about"), href: "/about" },
        { title: t("nav.contact"), href: "/contact" },
        { title: t("footer.privacy"), href: "/about" },
        { title: t("footer.terms"), href: "/about" },
      ],
    },
    {
      label: t("footer.resources"),
      links: [
        { title: t("nav.dashboard"), href: "/dashboard" },
        { title: t("nav.live"), href: "/live" },
        { title: t("nav.results"), href: "/results" },
        { title: t("nav.profile"), href: "/profile" },
      ],
    },
    {
      label: t("footer.social"),
      links: [
        { title: "Facebook", href: "#", icon: FacebookIcon },
        { title: "Instagram", href: "#", icon: InstagramIcon },
        { title: "Youtube", href: "#", icon: YoutubeIcon },
        { title: "LinkedIn", href: "#", icon: LinkedinIcon },
      ],
    },
  ];

  return (
    <footer className="relative w-full bg-primary text-primary-foreground">
      <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
        <div className="grid gap-10 md:grid-cols-[1.4fr_2fr]">
          <AnimatedContainer className="relative max-w-sm">
            <div className="flex items-center gap-2.5">
              <span className="grid size-8 place-items-center rounded-lg bg-primary-foreground text-sm font-bold text-primary">
                I
              </span>
              <span className="font-display text-lg font-semibold">ILSI</span>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-primary-foreground/75">
              {t("about.lead")}
            </p>
            <p className="mt-6 text-xs text-primary-foreground/60">
              © {new Date().getFullYear()} ILSI — Institute for Leadership &amp;
              Skills Initiative. All rights reserved.
            </p>
          </AnimatedContainer>

          <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
            {footerLinks.map((section, index) => (
              <AnimatedContainer key={section.label} delay={0.1 + index * 0.1}>
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-primary-foreground/60">
                    {section.label}
                  </h3>
                  <ul className="mt-4 space-y-2.5">
                    {section.links.map((link) => (
                      <li key={link.title}>
                        <Link
                          to={link.href}
                          className="inline-flex items-center gap-2 text-sm text-primary-foreground/75 transition-colors duration-200 hover:text-primary-foreground"
                        >
                          {link.icon && <link.icon className="size-4" />}
                          {link.title}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              </AnimatedContainer>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}

type ViewAnimationProps = {
  delay?: number;
  className?: ComponentProps<"div">["className"];
  children: ReactNode;
};

function AnimatedContainer({
  className,
  delay = 0.1,
  children,
}: ViewAnimationProps) {
  const shouldReduceMotion = useReducedMotion();

  if (shouldReduceMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 24, filter: "blur(6px)" }}
      whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ delay, duration: 0.6, ease: "easeOut" }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
