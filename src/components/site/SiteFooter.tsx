import { Link } from "@tanstack/react-router";
import { useI18n } from "@/i18n/LocaleProvider";

export function SiteFooter() {
  const { t } = useI18n();
  return (
    <footer className="border-t border-border bg-surface">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-[2fr_1fr_1fr]">
        <div className="max-w-sm">
          <div className="flex items-center gap-2.5">
            <span className="grid size-8 place-items-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
              I
            </span>
            <span className="font-display text-lg font-semibold">ILSI</span>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            {t("about.lead")}
          </p>
        </div>
        <nav aria-label="Footer">
          <h3 className="text-sm font-semibold">{t("nav.programs")}</h3>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li>
              <Link to="/programs" className="hover:text-foreground">
                {t("programs.title")}
              </Link>
            </li>
            <li>
              <Link to="/apply" className="hover:text-foreground">
                {t("nav.apply")}
              </Link>
            </li>
            <li>
              <Link to="/login" className="hover:text-foreground">
                {t("nav.login")}
              </Link>
            </li>
          </ul>
        </nav>
        <nav aria-label="Institution">
          <h3 className="text-sm font-semibold">ILSI</h3>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li>
              <Link to="/about" className="hover:text-foreground">
                {t("nav.about")}
              </Link>
            </li>
            <li>
              <Link to="/contact" className="hover:text-foreground">
                {t("nav.contact")}
              </Link>
            </li>
          </ul>
        </nav>
      </div>
      <div className="border-t border-border/70 px-4 py-5 text-center text-xs text-muted-foreground sm:px-6">
        © {new Date().getFullYear()} ILSI — Institute for Leadership & Skills Initiative
      </div>
    </footer>
  );
}
