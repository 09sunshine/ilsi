"use client";

import type { ComponentProps, ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";
import {
  FacebookIcon,
  InstagramIcon,
  LinkedinIcon,
  YoutubeIcon,
  Music2,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import ilsiLogo from "@/assets/ilsi-logo.png";
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
        { title: t("nav.trackApplication"), href: "/track-application" },
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
      label: t("footer.social"),
      links: [
        { title: "Facebook", href: "https://web.facebook.com/ilsicampus1", icon: FacebookIcon },
        { title: "Instagram", href: "https://www.instagram.com/ilsi_campus", icon: InstagramIcon },
        { title: "Youtube", href: "https://www.youtube.com/@ilsi_campus", icon: YoutubeIcon },
        { title: "LinkedIn", href: "https://www.linkedin.com/company/ilsicampus", icon: LinkedinIcon },
        { title: "TikTok", href: "https://www.tiktok.com/@ilsi_campus", icon: Music2 }
      ],
    },
  ];

  return (
    <footer className="footer-glow relative w-full overflow-hidden bg-footer text-footer-foreground">
      <div className="relative z-10 mx-auto w-full max-w-6xl px-4 pb-12 pt-20 sm:px-6 lg:px-8 lg:pb-14 lg:pt-24">
        <div className="grid gap-12 md:grid-cols-[1.3fr_2.2fr]">
          <AnimatedContainer className="relative max-w-sm">
            <div className="flex items-center gap-3" aria-label="ILSI">
              <span className="grid size-11 place-items-center rounded-xl bg-white/95 p-1.5 shadow-sm">
                <img src={ilsiLogo} alt="ILSI logo" className="size-full object-contain" />
              </span>
              <span className="font-display text-lg font-semibold tracking-tight text-footer-foreground">
                ILSI
              </span>
            </div>
            <p className="mt-6 text-sm text-footer-foreground/55">
              © {new Date().getFullYear()} ILSI. All rights reserved.
            </p>
          </AnimatedContainer>

          <div className="grid grid-cols-2 gap-x-8 gap-y-10 sm:grid-cols-3">
            {footerLinks.map((section, index) => (
              <AnimatedContainer key={section.label} delay={0.1 + index * 0.08}>
                <div>
                  <h3 className="text-sm font-medium text-footer-foreground">
                    {section.label}
                  </h3>
                  <ul className="mt-5 space-y-3">
                    {section.links.map((link) => (
                      <li key={link.title}>
                        <Link
                          to={link.href}
                          className="inline-flex items-center gap-2 text-sm text-footer-foreground/55 transition-colors duration-200 hover:text-hero-lime"
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
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{ delay, duration: 0.6, ease: "easeOut" }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
