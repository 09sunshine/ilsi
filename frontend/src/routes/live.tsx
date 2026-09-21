import { useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { CalendarDays, Radio, Video } from "lucide-react";
import { AppShell } from "@/components/app/AppShell";
import { EmptyState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useI18n, useLocalized } from "@/i18n/LocaleProvider";
import { api } from "@/lib/api";

export const Route = createFileRoute("/live")({
  head: () => ({
    meta: [
      { title: "Live sessions — ILSI" },
      { name: "description", content: "Your upcoming live debriefs and past recordings." },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Live sessions — ILSI" },
      { property: "og:description", content: "Upcoming live debriefs and past recordings." },
    ],
  }),
  component: LivePage,
});

function LivePage() {
  const { t, locale } = useI18n();
  const L = useLocalized();
  const fr = locale === "fr";
  const [sessionList, setSessionList] = useState<any[]>([]);

  useEffect(() => {
    async function loadSessions() {
      try {
        const live = await api.getLiveSessions();
        if (Array.isArray(live)) {
          setSessionList(live);
        }
      } catch (err) {
        console.warn("Could not fetch live sessions:", err);
      }
    }
    void loadSessions();
  }, []);

  const fmt = (d: string) => {
    try {
      return new Date(d).toLocaleDateString(fr ? "fr-FR" : "en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    } catch {
      return d;
    }
  };

  return (
    <AppShell title={t("nav.live")}>
      <div className="mx-auto max-w-4xl space-y-3">
        {sessionList.length === 0 ? (
          <EmptyState icon={<Radio className="size-5" />} title={t("common.empty")} />
        ) : (
          sessionList.map((s) => {
            return (
              <article key={s.id} className="panel flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="truncate font-display text-base font-semibold">{L(s.title)}</h2>
                    <Badge variant={s.status === "ENDED" ? "secondary" : "default"}>{s.status}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{L(s.description)}</p>
                  <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <CalendarDays className="size-3.5" /> {fmt(s.date)} · {s.startTime}–{s.endTime}
                    </span>
                    {s.instructor ? <span>{s.instructor}</span> : null}
                  </p>
                </div>
                <div className="shrink-0">
                  {s.recordingUrl ? (
                    <Button asChild size="sm" variant="outline">
                      <a href={s.recordingUrl} target="_blank" rel="noopener noreferrer">
                        <Video className="size-4" /> {t("dash.watchRecording")}
                      </a>
                    </Button>
                  ) : (
                    <Button asChild size="sm">
                      <a href={s.meetingUrl ?? "#"} target="_blank" rel="noopener noreferrer">
                        <Radio className="size-4" /> {t("dash.join")}
                      </a>
                    </Button>
                  )}
                </div>
              </article>
            );
          })
        )}
      </div>
    </AppShell>
  );
}
