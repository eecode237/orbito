"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { ExternalLink, Globe2, Loader2, MapPin, Newspaper, Radio, RefreshCw } from "lucide-react";

import type { GlobeMarker } from "@/components/planet/globe";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { getNews } from "@/lib/api";
import type { NewsArticle, NewsFeed } from "@/lib/types";
import { cn, formatRelative } from "@/lib/utils";

const PlanetGlobe = dynamic(() => import("@/components/planet/globe").then((m) => m.PlanetGlobe), {
  ssr: false,
  loading: () => (
    <div className="grid h-full min-h-[360px] place-items-center rounded-xl border border-border-subtle bg-surface-inset text-[12px] text-foreground-muted">
      <div className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin text-primary" /> Loading globe…</div>
    </div>
  ),
});

const CATEGORY_COLORS: Record<string, string> = {
  ai: "#7c6cff",
  tech: "#43c6f5",
  crypto: "#f5b942",
  finance: "#35d399",
};

function hashHue(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  const palette = ["#7c6cff", "#43c6f5", "#35d399", "#f5b942", "#fb7185"];
  return palette[h % palette.length];
}

export function PlanetView() {
  const [feed, setFeed] = useState<NewsFeed | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    else setRefreshing(true);
    try {
      const data = await getNews("all", 60);
      setFeed(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load news.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const t = window.setInterval(() => { void load(true); }, 120000);
    return () => window.clearInterval(t);
  }, [load]);

  const articles = feed?.articles ?? [];
  const mapped = useMemo(() => articles.filter((a) => a.location && Number.isFinite(a.location.lat) && Number.isFinite(a.location.lon)), [articles]);

  const markers: GlobeMarker[] = useMemo(() => {
    // aggregate by location+category to avoid clutter, keep latest title
    const byKey = new Map<string, { marker: GlobeMarker; article: NewsArticle; count: number }>();
    for (const a of mapped) {
      const loc = a.location!;
      const key = `${loc.lat.toFixed(2)},${loc.lon.toFixed(2)},${a.category}`;
      const existing = byKey.get(key);
      if (!existing) {
        byKey.set(key, {
          count: 1,
          article: a,
          marker: {
            id: a.id,
            lat: loc.lat,
            lon: loc.lon,
            label: loc.label,
            title: a.title,
            color: CATEGORY_COLORS[a.category] || hashHue(a.id),
            pulse: true,
            size: 0.03,
          },
        });
      } else {
        existing.count += 1;
        existing.marker.size = Math.min(0.055, 0.03 + existing.count * 0.004);
      }
    }
    return Array.from(byKey.values()).map((v) => v.marker);
  }, [mapped]);

  const selectedArticle = selected ? articles.find((a) => a.id === selected) : null;
  const reachable = feed?.sources?.filter((s) => s.reachable).length ?? 0;
  const totalSources = feed?.sources?.length ?? 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={feed?.reachable ? "success" : "error"} dot>
            {feed ? `${reachable}/${totalSources} feeds reachable` : "Checking feeds"}
          </Badge>
          <Badge tone="neutral"><Radio className="mr-1 h-3 w-3" /> Auto-refresh 2 min</Badge>
          <Badge tone="primary"><MapPin className="mr-1 h-3 w-3" /> {markers.length} mapped location{markers.length === 1 ? "" : "s"}</Badge>
        </div>
        <Button variant="secondary" size="sm" onClick={() => void load(true)} disabled={refreshing || loading}>
          <RefreshCw className={cn("h-3.5 w-3.5", (refreshing || loading) && "animate-spin")} /> Refresh
        </Button>
      </div>

      {error && !feed ? (
        <Card className="border-error/25 bg-error/[0.04]"><CardContent className="p-4 text-[12px] text-error/90">{error}</CardContent></Card>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]">
        <Card className="overflow-hidden">
          <CardHeader
            title="Earth — live news signals"
            description="Markers show approximate source/coverage regions for real headlines (not precise datelines). Drag to rotate, scroll to zoom."
            icon={<Globe2 className="h-3.5 w-3.5" />}
          />
          <CardContent className="p-0">
            <div className="relative h-[420px] w-full bg-[radial-gradient(ellipse_at_center,rgba(124,108,255,0.08),rgba(3,5,14,0.95)_70%)] sm:h-[520px]">
              {loading && !feed ? (
                <div className="grid h-full place-items-center text-[12px] text-foreground-muted"><span className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin text-primary" /> Loading globe & news…</span></div>
              ) : (
                <PlanetGlobe markers={markers} className="h-full w-full" />
              )}
              <div className="pointer-events-none absolute bottom-3 left-3 flex flex-wrap gap-1.5">
                {Object.entries(CATEGORY_COLORS).map(([cat, color]) => (
                  <span key={cat} className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-black/35 px-2 py-0.5 text-[9.5px] text-white/70 backdrop-blur">
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} /> {cat}
                  </span>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="min-h-0">
          <CardHeader
            title="Live headlines"
            description="Real RSS/Atom headlines (links go to publishers)."
            icon={<Newspaper className="h-3.5 w-3.5" />}
            actions={<Badge tone="neutral">{articles.length} articles</Badge>}
          />
          <CardContent className="p-0">
            {loading && !feed ? (
              <div className="p-4 text-[12px] text-foreground-muted">Loading…</div>
            ) : articles.length === 0 ? (
              <div className="p-6 text-center text-[12px] text-foreground-muted">No headlines available. Feeds may be unreachable — refresh to try again.</div>
            ) : (
              <div className="max-h-[520px] divide-y divide-border-subtle overflow-y-auto">
                {articles.slice(0, 40).map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => setSelected(a.id)}
                    className={cn("block w-full px-4 py-3 text-left transition hover:bg-foreground/[0.02]", selected === a.id && "bg-primary/[0.05]")}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="line-clamp-2 text-[12px] font-medium leading-snug text-foreground">{a.title}</p>
                      {a.location ? <span title={a.location.label || "Mapped source region"}><MapPin className="mt-0.5 h-3 w-3 shrink-0 text-primary/70" /></span> : null}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] text-foreground-muted">
                      <span className="font-medium text-foreground-secondary">{a.source}</span>
                      <Badge tone="neutral">{a.category}</Badge>
                      {a.location?.label ? <span>{a.location.label}</span> : null}
                      <span>{formatRelative(a.published_at)}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {selectedArticle ? (
        <Card>
          <CardHeader title="Selected headline" description={selectedArticle.source} icon={<Newspaper className="h-3.5 w-3.5" />} actions={
            <a href={selectedArticle.url} target="_blank" rel="noreferrer"><Button variant="secondary" size="sm">Open source <ExternalLink className="h-3.5 w-3.5" /></Button></a>
          } />
          <CardContent>
            <h3 className="text-[14px] font-semibold text-foreground">{selectedArticle.title}</h3>
            {selectedArticle.summary ? <p className="mt-2 text-[12px] leading-relaxed text-foreground-secondary">{selectedArticle.summary}</p> : <p className="mt-2 text-[12px] text-foreground-muted">No summary provided by the feed.</p>}
            <div className="mt-3 flex flex-wrap gap-2 text-[10.5px] text-foreground-muted">
              <Badge tone="neutral">{selectedArticle.category}</Badge>
              <span>{selectedArticle.source}</span>
              {selectedArticle.location?.label ? <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" /> {selectedArticle.location.label} (approx. source region)</span> : <span>Location not mapped</span>}
              <span>{formatRelative(selectedArticle.published_at)}</span>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <p className="text-[10.5px] text-foreground-muted">
        Headlines come from real publisher RSS/Atom feeds via <span className="font-mono">/api/v1/intel/news</span>. Globe markers use <b>approximate source/coverage regions</b> (honest mapping), not precise article datelines. Full articles remain on publisher sites.
      </p>
    </div>
  );
}
