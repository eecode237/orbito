"use client";

import { useEffect, useState } from "react";
import {
  ExternalLink,
  Newspaper,
  Radio,
  RefreshCw,
  Rss,
  TriangleAlert,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { SkeletonCard } from "@/components/ui/skeleton";
import { Tabs } from "@/components/ui/tabs";
import { getNews } from "@/lib/api";
import type { NewsFeed } from "@/lib/types";
import { cn, formatRelative } from "@/lib/utils";

const CATEGORIES = [
  { id: "all", label: "Everything" },
  { id: "ai", label: "AI" },
  { id: "tech", label: "Technology" },
  { id: "crypto", label: "Crypto" },
  { id: "finance", label: "Finance" },
];

const CATEGORY_TONE: Record<string, "primary" | "info" | "success" | "warning" | "neutral"> = {
  ai: "primary",
  tech: "info",
  crypto: "warning",
  finance: "success",
  all: "neutral",
};

export function NewsFeedView() {
  const [category, setCategory] = useState("all");
  const [feed, setFeed] = useState<NewsFeed | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    getNews(category, 48)
      .then((data) => {
        if (!alive) return;
        setFeed(data);
        setError(null);
      })
      .catch((cause) => {
        if (!alive) return;
        setError(cause instanceof Error ? cause.message : "News feeds are unreachable.");
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [category]);

  function refresh() {
    setRefreshing(true);
    getNews(category, 48)
      .then((data) => {
        setFeed(data);
        setError(null);
      })
      .catch((cause) => {
        setError(cause instanceof Error ? cause.message : "News feeds are unreachable.");
      })
      .finally(() => setRefreshing(false));
  }

  function selectCategory(next: string) {
    if (next === category) return;
    setLoading(true);
    setCategory(next);
  }

  const articles = feed?.articles ?? [];
  const reachableSources = feed?.sources.filter((source) => source.reachable) ?? [];
  const failedSources = feed?.sources.filter((source) => !source.reachable) ?? [];

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Discovery · News intelligence"
        title={
          <>
            What the world is <span className="text-gradient">reporting right now.</span>
          </>
        }
        description="ORBITO reads publisher RSS and Atom feeds, normalises the headlines and keeps the link on the source. It never republishes full articles, and every disconnected feed is shown rather than hidden."
        icon={<Newspaper className="h-5 w-5" />}
        actions={
          <Button
            variant="secondary"
            size="sm"
            onClick={refresh}
            disabled={refreshing}
          >
            <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />
            {refreshing ? "Refreshing" : "Refresh"}
          </Button>
        }
      >
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={feed?.reachable ? "success" : "error"} dot>
            {feed
              ? `${reachableSources.length}/${feed.sources.length} feeds reachable`
              : "Checking feeds"}
          </Badge>
          <Badge tone="neutral">
            <Rss className="h-3 w-3" /> Headlines + links only
          </Badge>
          <Badge tone="neutral">
            <Radio className="h-3 w-3" /> Cached for 2 minutes
          </Badge>
        </div>
      </PageHeader>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs
          items={CATEGORIES.map((item) => ({ id: item.id, label: item.label }))}
          value={category}
          onChange={selectCategory}
        />
        {feed ? (
          <p className="font-mono text-[10px] text-foreground-muted">
            {articles.length} stories · updated {formatRelative(feed.generated_at)}
          </p>
        ) : null}
      </div>

      {feed && !feed.reachable ? (
        <Card className="border-warning/30 bg-warning/[0.05]">
          <CardContent className="flex items-start gap-3">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
            <div>
              <p className="text-[12.5px] font-medium text-foreground">
                No news source is reachable from this machine.
              </p>
              <p className="mt-1 text-[11.5px] leading-relaxed text-foreground-secondary">
                The feed list is configured, but every publisher request failed. ORBITO will not
                invent articles. Check network access or the source errors below.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {error ? (
        <Card className="border-error/30 bg-error/[0.05]">
          <CardContent className="flex items-start gap-3">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-error" />
            <div>
              <p className="text-[12.5px] font-medium text-foreground">Could not load the news feed</p>
              <p className="mt-1 font-mono text-[11px] text-error">{error}</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={refresh}
              >
                Try again
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-3">
          {loading ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {Array.from({ length: 6 }).map((_, index) => (
                <SkeletonCard key={index} />
              ))}
            </div>
          ) : articles.length ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {articles.map((article) => (
                <a
                  key={article.id}
                  href={article.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="focus-ring group flex flex-col rounded-xl border border-border bg-surface p-4 transition-colors hover:border-border-strong hover:bg-surface-elevated"
                >
                  <div className="flex items-center justify-between gap-2">
                    <Badge tone={CATEGORY_TONE[article.category] ?? "neutral"}>
                      {article.category}
                    </Badge>
                    <span className="font-mono text-[9.5px] text-foreground-muted">
                      {formatRelative(article.published_at)}
                    </span>
                  </div>
                  <h2 className="mt-2.5 text-[13.5px] font-semibold leading-snug text-foreground group-hover:text-primary-hover">
                    {article.title}
                  </h2>
                  {article.summary ? (
                    <p className="mt-1.5 line-clamp-3 text-[11.5px] leading-relaxed text-foreground-secondary">
                      {article.summary}
                    </p>
                  ) : null}
                  <div className="mt-auto flex items-center justify-between gap-2 pt-3">
                    <span className="truncate text-[10px] text-foreground-muted">{article.source}</span>
                    <ExternalLink className="h-3 w-3 shrink-0 text-foreground-muted transition-colors group-hover:text-primary-hover" />
                  </div>
                </a>
              ))}
            </div>
          ) : (
            <Card>
              <EmptyState
                icon={Newspaper}
                title="No stories in this category yet"
                description="When a configured feed publishes an article, it will appear here with a link to the original source."
              />
            </Card>
          )}
        </div>

        <aside className="space-y-3">
          <Card>
            <CardHeader title="Source health" description="Live per-feed request status" />
            <CardContent className="space-y-2">
              {feed?.sources.length ? (
                feed.sources.map((source) => (
                  <div
                    key={`${source.name}-${source.category}`}
                    className="flex items-start justify-between gap-2 rounded-lg border border-border-subtle bg-surface-inset px-2.5 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-[11.5px] font-medium text-foreground">
                        {source.name}
                      </p>
                      <p className="text-[9.5px] uppercase tracking-wide text-foreground-muted">
                        {source.category}
                      </p>
                      {!source.reachable && source.error ? (
                        <p className="mt-1 line-clamp-2 text-[9.5px] text-error">{source.error}</p>
                      ) : null}
                    </div>
                    <Badge tone={source.reachable ? "success" : "error"} dot>
                      {source.reachable ? `${source.count}` : "down"}
                    </Badge>
                  </div>
                ))
              ) : (
                <p className="text-[11px] text-foreground-muted">Loading source status…</p>
              )}
            </CardContent>
          </Card>

          {failedSources.length ? (
            <Card className="border-warning/25">
              <CardHeader
                title="Unavailable sources"
                description="Reported honestly, never substituted with fake stories"
              />
              <CardContent>
                <ul className="space-y-1 text-[10.5px] text-foreground-secondary">
                  {failedSources.map((source) => (
                    <li key={`failed-${source.name}`} className="flex items-center gap-1.5">
                      <span className="h-1 w-1 rounded-full bg-error" />
                      {source.name}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
