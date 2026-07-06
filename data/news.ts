import { NewsArticle } from "@/components/NewsItem";

// Bundled fallback shown until live headlines load (or when the wire is
// quiet). Each links to a news search for its topic so every row stays
// tappable even offline-first; live articles link straight to the story.
function newsSearch(query: string): string {
  return `https://news.google.com/search?q=${encodeURIComponent(query)}`;
}

export const GOLD_NEWS: NewsArticle[] = [
  {
    id: "1",
    headline: "Gold hits record high as central banks ramp up purchases amid dollar weakness",
    source: "Markets",
    timestamp: "2h ago",
    summary:
      "Gold surged past $3,150 per troy ounce on Tuesday as central bank demand from emerging markets reached its highest quarterly level in a decade, while a weakening US dollar bolstered safe-haven demand.",
    url: newsSearch("gold price record high central bank buying"),
    icon: "trending-up",
  },
  {
    id: "2",
    headline: "Fed officials signal patience on rate cuts — gold holds gains",
    source: "Markets",
    timestamp: "4h ago",
    summary:
      "Federal Reserve officials maintained a cautious stance on interest rate cuts at their latest meeting, a backdrop that continues to support gold prices near all-time highs.",
    url: newsSearch("Fed rate cuts gold price"),
    icon: "percent",
  },
  {
    id: "3",
    headline: "ETF inflows into gold products surge to 18-month high",
    source: "Markets",
    timestamp: "7h ago",
    summary:
      "Investors poured over $4.2 billion into gold-backed ETFs last week, the highest weekly inflow since September 2022, as uncertainty around global growth prospects prompted a flight to safety.",
    url: newsSearch("gold ETF inflows surge"),
    icon: "bar-chart-2",
  },
  {
    id: "4",
    headline: "Goldman Sachs raises gold price target to $3,700 by year-end",
    source: "Markets",
    timestamp: "1d ago",
    summary:
      "Goldman Sachs analysts lifted their year-end 2026 gold price forecast from $3,400 to $3,700, citing sustained central bank buying and geopolitical risk as key catalysts.",
    url: newsSearch("gold price forecast Goldman Sachs"),
    icon: "target",
  },
  {
    id: "5",
    headline: "India's gold demand rises 12% in Q1 2026 as wedding season drives jewelry sales",
    source: "Markets",
    timestamp: "1d ago",
    summary:
      "India's gold demand climbed 12% year-on-year in the first quarter of 2026, with jewelry consumption leading gains ahead of the peak wedding season, according to the World Gold Council.",
    url: newsSearch("India gold demand jewelry wedding season"),
    icon: "globe",
  },
  {
    id: "6",
    headline: "Geopolitical tensions in Middle East add a $50 risk premium to gold",
    source: "Markets",
    timestamp: "2d ago",
    summary:
      "Analysts at Standard Chartered estimate ongoing geopolitical tensions have embedded a roughly $50 per ounce risk premium into gold prices, and this premium is unlikely to fade in the near term.",
    url: newsSearch("gold price geopolitical risk premium"),
    icon: "shield",
  },
];
