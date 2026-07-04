// On-device recognition of gold bars and coins from a photo.
// Uses ML Kit text recognition (free, offline, private) to read the
// stamps bullion carries — mint, weight, purity — and turns them into
// prefilled form values the user reviews before saving.

import { Platform } from "react-native";

export interface GoldScanResult {
  name?: string;
  type?: "bar" | "coin";
  weightGrams?: number;
  purity?: string;
  rawText: string;
}

const TROY_OUNCE_GRAMS = 31.1035;

// Well-known bullion coins (imply type "coin" and usually 1 oz)
const COINS: { pattern: RegExp; name: string }[] = [
  { pattern: /krugerrand/i, name: "Krugerrand" },
  { pattern: /maple\s*leaf/i, name: "Maple Leaf" },
  { pattern: /american\s*eagle|liberty\s+in\s+god/i, name: "American Gold Eagle" },
  { pattern: /buffalo/i, name: "Gold Buffalo" },
  { pattern: /britannia/i, name: "Britannia" },
  { pattern: /philharmoniker|philharmonic/i, name: "Vienna Philharmonic" },
  { pattern: /panda/i, name: "Gold Panda" },
  { pattern: /kangaroo|nugget/i, name: "Kangaroo" },
  { pattern: /sovereign/i, name: "Sovereign" },
  { pattern: /libertad/i, name: "Libertad" },
];

// Well-known refiners / mints (imply type "bar" unless a coin matched)
const MINTS: { pattern: RegExp; name: string }[] = [
  { pattern: /valcambi/i, name: "Valcambi" },
  { pattern: /credit\s*suisse/i, name: "Credit Suisse" },
  { pattern: /pamp/i, name: "PAMP Suisse" },
  { pattern: /perth\s*mint/i, name: "Perth Mint" },
  { pattern: /royal\s*(canadian\s*)?mint/i, name: "Royal Mint" },
  { pattern: /argor|heraeus/i, name: "Argor-Heraeus" },
  { pattern: /umicore/i, name: "Umicore" },
  { pattern: /metalor/i, name: "Metalor" },
  { pattern: /engelhard/i, name: "Engelhard" },
  { pattern: /johnson\s*matthey/i, name: "Johnson Matthey" },
  { pattern: /royal\s*canadian/i, name: "Royal Canadian Mint" },
];

function parseWeight(text: string): { grams?: number; label?: string } {
  // Grams: "50g", "100 g", "31.1 grams", "1 kilo"
  const kilo = text.match(/(\d+(?:[.,]\d+)?)\s*(?:kg|kilo)/i);
  if (kilo) {
    const v = parseFloat(kilo[1].replace(",", "."));
    if (v > 0 && v <= 15) return { grams: v * 1000, label: `${v}kg` };
  }
  const grams = text.match(/(\d+(?:[.,]\d+)?)\s*(?:g|gr|gram|grams)\b/i);
  if (grams) {
    const v = parseFloat(grams[1].replace(",", "."));
    if (v > 0 && v <= 15000) return { grams: v, label: `${v}g` };
  }
  // Ounces: "1 oz", "1/2 oz", "1/10 OZ", "0.5 ounce", "one ounce"
  const fracOz = text.match(/(1\/2|1\/4|1\/10|1\/20)\s*(?:oz|ounce|unze|once)/i);
  if (fracOz) {
    const [num, den] = fracOz[1].split("/").map(Number);
    const oz = num / den;
    return { grams: Math.round(oz * TROY_OUNCE_GRAMS * 10000) / 10000, label: `${fracOz[1]} oz` };
  }
  const oz = text.match(/(\d+(?:[.,]\d+)?)\s*(?:troy\s*)?(?:oz|ounce|unze|once)/i);
  if (oz) {
    const v = parseFloat(oz[1].replace(",", "."));
    if (v > 0 && v <= 400) {
      return { grams: Math.round(v * TROY_OUNCE_GRAMS * 10000) / 10000, label: `${v} oz` };
    }
  }
  if (/one\s+(?:troy\s+)?ounce/i.test(text)) {
    return { grams: TROY_OUNCE_GRAMS, label: "1 oz" };
  }
  return {};
}

function parsePurity(text: string): string | undefined {
  if (/999[.,]9|9999/.test(text)) return "999.9";
  if (/\b999\b|[.,]999/.test(text)) return "999";
  if (/24\s*k(?:arat|t)?/i.test(text)) return "24k";
  if (/91[.,]67|22\s*k(?:arat|t)?|916/.test(text)) return "22k";
  return undefined;
}

export function parseGoldText(rawText: string): GoldScanResult {
  const text = rawText.replace(/\s+/g, " ");

  const coin = COINS.find((c) => c.pattern.test(text));
  const mint = MINTS.find((m) => m.pattern.test(text));
  const { grams, label } = parseWeight(text);
  const purity = parsePurity(text);
  const mentionsGold = /gold|or\b|oro|au\b|fine\s*gold/i.test(text) || !!purity;

  let type: "bar" | "coin" | undefined;
  if (coin) type = "coin";
  else if (mint || /\bbar\b|ingot|lingot/i.test(text)) type = "bar";

  // Build a human name from the best parts we found
  let name: string | undefined;
  const weightPart = label ? ` ${label}` : "";
  if (coin) {
    name = `${coin.name}${weightPart} Coin`;
  } else if (mint) {
    name = `${mint.name}${weightPart} Bar`;
  } else if (grams && mentionsGold) {
    name = `Gold ${type === "coin" ? "Coin" : "Bar"}${weightPart}`;
  }

  return { name, type, weightGrams: grams, purity, rawText };
}

/**
 * OCR the image and parse gold details. Returns null when nothing useful
 * was recognized (or on web, where ML Kit isn't available).
 */
export async function scanGoldImage(imageUri: string): Promise<GoldScanResult | null> {
  if (Platform.OS === "web") return null;
  try {
    const TextRecognition = (await import("@react-native-ml-kit/text-recognition"))
      .default;
    const result = await TextRecognition.recognize(imageUri);
    const rawText = result?.text ?? "";
    if (!rawText.trim()) return null;
    const parsed = parseGoldText(rawText);
    return parsed.name || parsed.weightGrams || parsed.type ? parsed : null;
  } catch {
    return null;
  }
}
