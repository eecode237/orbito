"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { AlertTriangle, ExternalLink, Globe2, Loader2, MapPin, Newspaper, Radio, RefreshCw, Sun } from "lucide-react";

import type { GlobeHover, GlobeMarker, PlanetLayers, SunPosition, TextureStatus } from "@/components/planet/globe";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { getLocationInfo, getNews } from "@/lib/api";
import { EARTH_FACTS } from "@/lib/planet/geo";
import type { LocationInfo, NewsArticle, NewsFeed } from "@/lib/types";
import { cn, formatRelative } from "@/lib/utils";

const PlanetGlobe = dynamic(() => import("@/components/planet/globe").then((m) => m.PlanetGlobe), {
  ssr: false,
  loading: () => (
    <div className="grid h-full min-h-[360px] place-items-center text-[12px] text-foreground-muted">
      <div className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin text-primary" /> Loading globe…</div>
    </div>
  ),
});

const REFRESH_MS = 60_000;

const CATEGORY_COLORS: Record<string, string> = {
  ai: "#7c6cff",
  tech: "#43c6f5",
  crypto: "#f5b942",
  finance: "#35d399",
};

const DEFAULT_LAYERS: PlanetLayers = {
  nightLights: true,
  clouds: true,
  relief: true,
  oceanGlint: true,
  atmosphere: true,
  liveSun: true,
  autoRotate: true,
};

const LAYER_LABELS: Record<keyof PlanetLayers, string> = {
  nightLights: "City lights",
  clouds: "Clouds",
  relief: "Relief",
  oceanGlint: "Ocean glint",
  atmosphere: "Atmosphere",
  liveSun: "Live sun",
  autoRotate: "Auto-rotate",
};

type Place = { id: string; articles: NewsArticle[]; lat: number; lon: number; label?: string; category: string };

type TooltipState = {
  hover: GlobeHover;
  x: number;
  y: number;
  placeLeft: boolean;
  placeUp: boolean;
  bottomGap: number;
};

function formatCoord(value: number, positive: string, negative: string): string {
  return `${Math.abs(value).toFixed(1)}° ${value >= 0 ? positive : negative}`;
}

function formatDistance(meters: number | null): string | null {
  if (meters == null) return null;
  return meters >= 1000 ? `${(meters / 1000).toFixed(1)} km away` : `${Math.round(meters)} m away`;
}

export function PlanetView() {
  const [feed, setFeed] = useState<NewsFeed | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [layers, setLayers] = useState<PlanetLayers>(DEFAULT_LAYERS);
  const [sun, setSun] = useState<SunPosition | null>(null);
  const [textureStatus, setTextureStatus] = useState<TextureStatus>("loading");
  const [now, setNow] = useState<Date | null>(null);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const fetchNews = useCallback(
    () =>
      getNews("all", 60)
        .then((data) => {
          setFeed(data);
          setError(null);
          setLastUpdated(new Date());
        })
        .catch((err: unknown) => {
          setError(err instanceof Error ? err.message : "Failed to load news.");
        })
        .finally(() => {
          setLoading(false);
          setRefreshing(false);
        }),
    [],
  );

  useEffect(() => {
    void fetchNews();
    const t = window.setInterval(() => { void fetchNews(); }, REFRESH_MS);
    return () => window.clearInterval(t);
  }, [fetchNews]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    void fetchNews();
  }, [fetchNews]);

  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(t);
  }, []);

  const handleSun = useCallback((position: SunPosition) => setSun(position), []);
  const handleStatus = useCallback((status: TextureStatus) => setTextureStatus(status), []);

  const articles = useMemo(() => feed?.articles ?? [], [feed]);

  // One marker per real location. Every headline with a location is kept, so
  // nothing from the feed is hidden behind an aggregate count.
  const places: Place[] = useMemo(() => {
    const byKey = new Map<string, Place>();
    for (const a of articles) {
      const loc = a.location;
      if (!loc || !Number.isFinite(loc.lat) || !Number.isFinite(loc.lon)) continue;
      const key = `${loc.lat.toFixed(3)},${loc.lon.toFixed(3)}`;
      const existing = byKey.get(key);
      if (existing) {
        existing.articles.push(a);
      } else {
        byKey.set(key, { id: a.id, articles: [a], lat: loc.lat, lon: loc.lon, label: loc.label, category: a.category });
      }
    }
    return Array.from(byKey.values());
  }, [articles]);

  const markers: GlobeMarker[] = useMemo(
    () =>
      places.map((p) => ({
        id: p.id,
        lat: p.lat,
        lon: p.lon,
        label: p.label,
        title: p.articles[0]?.title,
        color: CATEGORY_COLORS[p.category] || "#7c6cff",
        pulse: true,
        size: Math.min(0.055, 0.03 + (p.articles.length - 1) * 0.004),
      })),
    [places],
  );

  const placeById = useMemo(() => new Map(places.map((p) => [p.id, p])), [places]);
  const articleById = useMemo(() => new Map(articles.map((a) => [a.id, a])), [articles]);

  const selectedArticle: NewsArticle | null = selected ? articleById.get(selected) ?? null : null;
  const reachable = feed?.sources?.filter((s) => s.reachable).length ?? 0;
  const totalSources = feed?.sources?.length ?? 0;

  function toggle(key: keyof PlanetLayers) {
    setLayers((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  const handleHover = useCallback((hover: GlobeHover | null) => {
    if (!hover) {
      setTooltip(null);
      return;
    }
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = hover.clientX - rect.left;
    const y = hover.clientY - rect.top;
    setTooltip({
      hover,
      x,
      y,
      placeLeft: x > rect.width / 2,
      placeUp: y > rect.height / 2,
      bottomGap: rect.height - y + 14,
    });
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={feed?.reachable ? "success" : "error"} dot>
            {feed ? `${reachable}/${totalSources} feeds reachable` : "Checking feeds"}
          </Badge>
          <Badge tone="success"><Radio className="mr-1 h-3 w-3" /> Live · refresh every 60 s</Badge>
          <Badge tone="neutral">{lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString()}` : "Waiting for first update"}</Badge>
          <Badge tone="primary"><MapPin className="mr-1 h-3 w-3" /> {places.length} location{places.length === 1 ? "" : "s"} · {articles.length} headlines</Badge>
        </div>
        <Button variant="secondary" size="sm" onClick={handleRefresh} disabled={refreshing || loading}>
          <RefreshCw className={cn("h-3.5 w-3.5", (refreshing || loading) && "animate-spin")} /> Refresh
        </Button>
      </div>

      {error && !feed ? (
        <Card className="border-error/25 bg-error/[0.04]"><CardContent className="p-4 text-[12px] text-error/90">{error}</CardContent></Card>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(320px,0.7fr)]">
        <Card className="overflow-hidden">
          <CardHeader
            title="Earth — 4K surface with live news"
            description="Point at a marker for its headlines, or at any spot on Earth for the nearest described place. Click a marker to open it below."
            icon={<Globe2 className="h-3.5 w-3.5" />}
          />
          <CardContent className="p-0">
            <div
              ref={containerRef}
              className="relative h-[460px] w-full bg-[radial-gradient(ellipse_at_center,rgba(124,108,255,0.08),rgba(3,5,14,0.95)_70%)] sm:h-[600px]"
              onPointerLeave={() => setTooltip(null)}
            >
              <PlanetGlobe
                markers={markers}
                layers={layers}
                selectedId={selected}
                onSelect={setSelected}
                onHover={handleHover}
                paused={tooltip !== null}
                onSun={handleSun}
                onStatus={handleStatus}
                className="h-full w-full"
              />

              <div className="absolute left-3 top-3 flex max-w-[calc(100%-1.5rem)] flex-wrap gap-1.5">
                {(Object.keys(LAYER_LABELS) as (keyof PlanetLayers)[]).map((key) => (
                  <button
                    key={key}
                    type="button"
                    aria-pressed={layers[key]}
                    onClick={() => toggle(key)}
                    className={cn(
                      "rounded-full border px-2.5 py-1 text-[10px] backdrop-blur transition",
                      layers[key]
                        ? "border-primary/50 bg-primary/20 text-white"
                        : "border-white/10 bg-black/40 text-white/50 hover:text-white/80",
                    )}
                  >
                    {LAYER_LABELS[key]}
                  </button>
                ))}
              </div>

              <div className="pointer-events-none absolute bottom-3 left-3 max-w-[70%] rounded-lg border border-white/10 bg-black/45 px-2.5 py-1.5 text-[10px] text-white/75 backdrop-blur">
                <div className="flex items-center gap-1.5">
                  <Sun className="h-3 w-3 text-amber" />
                  {layers.liveSun
                    ? sun
                      ? `Sun over ${formatCoord(sun.lat, "N", "S")}, ${formatCoord(sun.lon, "E", "W")}`
                      : "Computing sun position…"
                    : "Fixed lighting (live sun off)"}
                </div>
                <div className="mt-0.5 font-mono text-white/45">
                  {now ? `${now.toISOString().replace("T", " ").slice(0, 19)} UTC` : "—"}
                </div>
              </div>

              <div className="pointer-events-none absolute bottom-3 right-3 flex flex-wrap justify-end gap-1.5">
                {Object.entries(CATEGORY_COLORS).map(([cat, color]) => (
                  <span key={cat} className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-black/40 px-2 py-0.5 text-[9.5px] text-white/70 backdrop-blur">
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} /> {cat}
                  </span>
                ))}
              </div>

              {tooltip ? <PointTooltip tooltip={tooltip} place={tooltip.hover.kind === "marker" ? placeById.get(tooltip.hover.id) ?? null : null} articleById={articleById} /> : null}

              {textureStatus === "error" ? (
                <div className="absolute inset-x-3 top-14 flex items-start gap-2 rounded-lg border border-warning/30 bg-black/70 px-3 py-2 text-[11px] text-warning backdrop-blur">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  Surface textures failed to load (check /planet/*.jpg). Showing a plain fallback globe; news data is unaffected.
                </div>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="min-h-0">
            <CardHeader
              title="Live headlines"
              description="Real RSS/Atom headlines. Links go to the publisher."
              icon={<Newspaper className="h-3.5 w-3.5" />}
              actions={<Badge tone="neutral">{articles.length} articles</Badge>}
            />
            <CardContent className="p-0">
              {loading && !feed ? (
                <div className="p-4 text-[12px] text-foreground-muted">Loading…</div>
              ) : articles.length === 0 ? (
                <div className="p-6 text-center text-[12px] text-foreground-muted">No headlines available. Feeds may be unreachable. Refresh to try again.</div>
              ) : (
                <div className="max-h-[360px] divide-y divide-border-subtle overflow-y-auto">
                  {articles.slice(0, 60).map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => setSelected(a.id)}
                      className={cn("block w-full px-4 py-3 text-left transition hover:bg-foreground/[0.02]", selected === a.id && "bg-primary/[0.05]")}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="line-clamp-2 text-[12px] font-medium leading-snug text-foreground">{a.title}</p>
                        {a.location ? (
                          <span title={a.location.label || "Mapped location"}>
                            <MapPin className="mt-0.5 h-3 w-3 shrink-0 text-primary/70" />
                          </span>
                        ) : null}
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

          <Card>
            <CardHeader title="Earth reference data" description="Published reference values (NASA / IAU)" icon={<Globe2 className="h-3.5 w-3.5" />} />
            <CardContent>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-[11px]">
                {EARTH_FACTS.map((fact) => (
                  <div key={fact.label} className="min-w-0">
                    <dt className="truncate text-foreground-muted">{fact.label}</dt>
                    <dd className="font-medium text-foreground">{fact.value}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-3 border-t border-border-subtle pt-2 text-[10px] text-foreground-muted">
                Textures: day 4096×2048 (4K), night lights 4096×2048, relief 2048×1024 (exaggerated), clouds 1024×512, ocean mask 1600×800. Local files in <span className="font-mono">public/planet</span>.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {selectedArticle ? (
        <Card>
          <CardHeader
            title="Selected headline"
            description={selectedArticle.source}
            icon={<Newspaper className="h-3.5 w-3.5" />}
            actions={
              <a href={selectedArticle.url} target="_blank" rel="noreferrer">
                <Button variant="secondary" size="sm">Open source <ExternalLink className="h-3.5 w-3.5" /></Button>
              </a>
            }
          />
          <CardContent>
            <h3 className="text-[14px] font-semibold text-foreground">{selectedArticle.title}</h3>
            {selectedArticle.summary ? (
              <p className="mt-2 text-[12px] leading-relaxed text-foreground-secondary">{selectedArticle.summary}</p>
            ) : (
              <p className="mt-2 text-[12px] text-foreground-muted">No summary provided by the feed.</p>
            )}
            <div className="mt-3 flex flex-wrap gap-2 text-[10.5px] text-foreground-muted">
              <Badge tone="neutral">{selectedArticle.category}</Badge>
              <span>{selectedArticle.source}</span>
              {selectedArticle.location?.label ? (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3 w-3" /> {selectedArticle.location.label}
                  {selectedArticle.location.precision === "headline" ? " (named in headline)" : " (approx. source region)"}
                </span>
              ) : (
                <span>Location not mapped</span>
              )}
              <span>{formatRelative(selectedArticle.published_at)}</span>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <p className="text-[10.5px] text-foreground-muted">
        Headlines come from real publisher RSS/Atom feeds via <span className="font-mono">/api/v1/intel/news</span>, refreshed every minute. A location is marked &ldquo;named in headline&rdquo; only when the story names a known place; otherwise it falls back to the outlet&apos;s approximate region. Point descriptions come from Wikipedia.
      </p>
    </div>
  );
}

function PointTooltip({
  tooltip,
  place,
  articleById,
}: {
  tooltip: TooltipState;
  place: Place | null;
  articleById: Map<string, NewsArticle>;
}) {
  const horizontal = tooltip.placeLeft
    ? { left: Math.max(8, tooltip.x - 300) }
    : { left: tooltip.x + 16 };
  const vertical = tooltip.placeUp
    ? { bottom: tooltip.bottomGap }
    : { top: Math.max(8, tooltip.y + 14) };
  const style = { ...horizontal, ...vertical };

  return (
    <div
      className="pointer-events-none absolute z-10 w-[280px] rounded-xl border border-white/10 bg-black/80 p-3 text-[11px] text-white/85 shadow-xl backdrop-blur"
      style={style}
    >
      {tooltip.hover.kind === "marker" ? (
        <MarkerInfo place={place} articleById={articleById} />
      ) : (
        <SurfaceInfo lat={tooltip.hover.lat} lon={tooltip.hover.lon} />
      )}
    </div>
  );
}

function MarkerInfo({ place, articleById }: { place: Place | null; articleById: Map<string, NewsArticle> }) {
  const articles = place ? place.articles.slice(0, 3) : [];
  if (!place || articles.length === 0) {
    return <p className="text-white/50">No headline at this point.</p>;
  }
  return (
    <div className="space-y-2">
      <p className="text-[10px] uppercase tracking-wide text-white/40">
        {place.label ?? "News location"} · {place.articles.length} headline{place.articles.length === 1 ? "" : "s"}
      </p>
      {articles.map((a) => {
        const full = articleById.get(a.id) ?? a;
        return (
          <div key={a.id} className="border-t border-white/10 pt-2 first:border-t-0 first:pt-0">
            <p className="font-semibold leading-snug text-white">{full.title}</p>
            {full.summary ? <p className="mt-0.5 line-clamp-3 text-white/65">{full.summary}</p> : null}
            <p className="mt-0.5 text-[10px] text-white/40">{full.source} · {formatRelative(full.published_at)}</p>
          </div>
        );
      })}
      {place.articles.length > articles.length ? (
        <p className="text-[10px] text-white/40">+{place.articles.length - articles.length} more · click to open</p>
      ) : null}
    </div>
  );
}

function SurfaceInfo({ lat, lon }: { lat: number; lon: number }) {
  const key = `${lat.toFixed(1)},${lon.toFixed(1)}`;
  const [lookup, setLookup] = useState<{ key: string; info: LocationInfo | null; error: string | null } | null>(null);
  const cache = useRef(new Map<string, LocationInfo>());

  useEffect(() => {
    const [qLat, qLon] = key.split(",").map(Number);
    const timer = window.setTimeout(() => {
      const cached = cache.current.get(key);
      if (cached) {
        setLookup({ key, info: cached, error: null });
        return;
      }
      getLocationInfo(qLat, qLon)
        .then((info) => {
          if (info.reachable) cache.current.set(key, info);
          setLookup({ key, info, error: info.reachable ? null : info.error });
        })
        .catch((err: unknown) => {
          setLookup({ key, info: null, error: err instanceof Error ? err.message : "Lookup failed." });
        });
    }, 350);
    return () => window.clearTimeout(timer);
  }, [key]);

  const current = lookup && lookup.key === key ? lookup : null;
  return (
    <div className="space-y-1.5">
      <p className="font-mono text-[10px] text-white/45">
        {formatCoord(lat, "N", "S")}, {formatCoord(lon, "E", "W")}
      </p>
      {!current ? (
        <p className="flex items-center gap-1.5 text-white/50"><Loader2 className="h-3 w-3 animate-spin" /> Looking up this point…</p>
      ) : current.error ? (
        <p className="text-amber/90">Description unavailable: {current.error}</p>
      ) : current.info?.title ? (
        <>
          <p className="font-semibold text-white">{current.info.title}</p>
          {current.info.description ? <p className="text-white/70">{current.info.description}</p> : null}
          {current.info.extract ? <p className="line-clamp-4 text-white/60">{current.info.extract}</p> : null}
          <p className="text-[10px] text-white/40">
            {[formatDistance(current.info.distance_m), current.info.source].filter(Boolean).join(" · ")}
          </p>
        </>
      ) : (
        <p className="text-white/50">No described place near this point (open ocean or remote area).</p>
      )}
    </div>
  );
}
