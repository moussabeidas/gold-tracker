import { useState, useEffect } from "react";

import { fetchNews, type NewsStory } from "@/lib/marketData";
import { GOLD_NEWS } from "@/data/news";
import type { NewsArticle } from "@/components/NewsItem";

const TTL_MS = 10 * 60_000;

// Cast a wide net, then filter hard — several targeted queries beat one.
const QUERIES = ["gold price", "gold bullion", "XAU USD gold", "precious metals prices"];

// A headline must be about the gold/precious-metals market...
const RELEVANT =
  /\bgold\b|\bxau\b|bullion|precious metal|\bsilver\b|platinum|palladium|troy ounce/i;
// ...and mention it in a market context (price, trading, macro drivers)
const MARKET_CONTEXT =
  /price|rally|record|high|low|surge|soar|slip|fall|drop|climb|rise|gain|ounce|futures|spot|market|demand|forecast|outlook|fed|inflation|dollar|central bank|etf|invest|buy|sell|haven|bull|bear|reserve|mine|mining|\$\d/i;
// Hard exclusions: sports, places, pop culture, crypto masquerading as gold
const NOISE =
  /gold medal|golden state|gold cup|gold glove|golden globe|gold coast|golden retriever|olympic|world cup|golden age|golden hour|golden ticket|golden gate|bitcoin|crypto|ethereum|digital gold|golden visa|goldilocks/i;

function isOnTopic(title: string): boolean {
  return RELEVANT.test(title) && MARKET_CONTEXT.test(title) && !NOISE.test(title);
}

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
    Promise.all(QUERIES.map((q) => fetchNews(q, 10))).then((batches) => {
      if (cancelled) return;

      // Merge all queries, dedupe by normalized title
      const seen = new Set<string>();
      const merged: NewsStory[] = [];
      for (const batch of batches) {
        for (const story of batch ?? []) {
          const key = story.title.toLowerCase().replace(/\W+/g, " ").trim();
          if (seen.has(key)) continue;
          seen.add(key);
          merged.push(story);
        }
      }

      const onTopic = merged
        .filter((s) => isOnTopic(s.title))
        .sort((a, b) => b.publishedAt - a.publishedAt)
        .slice(0, 8);

      // Never pad with off-topic stories, but do surface whatever real
      // headlines arrived — topped up with the bundled gold articles so
      // the section always has substance.
      if (onTopic.length === 0) return;

      const mapped: NewsArticle[] = onTopic.map((s) => ({
        id: s.id,
        headline: s.title,
        source: s.publisher,
        timestamp: relativeTime(s.publishedAt),
        url: s.url,
        thumbnailUrl: s.thumbnailUrl ?? undefined,
      }));
      const topUp = GOLD_NEWS.slice(0, Math.max(0, 5 - mapped.length));
      const combined = [...mapped, ...topUp];
      cache = { at: Date.now(), articles: combined };
      setArticles(combined);
      setIsLive(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return { articles, isLive };
}
