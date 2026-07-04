import { useState, useEffect } from "react";

import { fetchNews } from "@/lib/marketData";
import { GOLD_NEWS } from "@/data/news";
import type { NewsArticle } from "@/components/NewsItem";

const QUERY = "gold price";
const TTL_MS = 10 * 60_000;

// Keep the feed strictly about the gold market
const RELEVANT = /\bgold\b|xau|bullion|precious metal/i;
const NOISE =
  /gold medal|golden state|gold cup|gold glove|golden globe|gold coast|golden retriever|olympic|gold rush(?! for)/i;

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
    fetchNews(QUERY, 14).then((stories) => {
      if (cancelled || !stories) return;
      const onTopic = stories.filter(
        (s) => RELEVANT.test(s.title) && !NOISE.test(s.title)
      );
      const picked = (onTopic.length >= 3 ? onTopic : stories).slice(0, 8);
      const mapped: NewsArticle[] = picked.map((s) => ({
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
