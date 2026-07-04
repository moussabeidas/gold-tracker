import { useState, useEffect } from "react";

import { fetchNews } from "@/lib/marketData";
import { GOLD_NEWS } from "@/data/news";
import type { NewsArticle } from "@/components/NewsItem";

const QUERY = "gold price";
const TTL_MS = 10 * 60_000;

let cache: { at: number; articles: NewsArticle[] } | null = null;

function relativeTime(ms: number): string {
  const diff = Date.now() - ms;
  const minutes = Math.max(1, Math.round(diff / 60_000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

export function useGoldNews() {
  const [articles, setArticles] = useState<NewsArticle[]>(
    cache?.articles ?? GOLD_NEWS
  );
  const [isLive, setIsLive] = useState(!!cache);

  useEffect(() => {
    if (cache && Date.now() - cache.at < TTL_MS) return;

    let cancelled = false;
    fetchNews(QUERY).then((stories) => {
      if (cancelled || !stories) return;
      const mapped: NewsArticle[] = stories.map((s) => ({
        id: s.id,
        headline: s.title,
        source: s.publisher,
        timestamp: relativeTime(s.publishedAt),
        url: s.url,
        thumbnailUrl: s.thumbnailUrl ?? undefined,
      }));
      cache = { at: Date.now(), articles: mapped };
      setArticles(mapped);
      setIsLive(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return { articles, isLive };
}
