import React from "react";
import { View, Text, StyleSheet, Pressable, Image } from "react-native";
import * as WebBrowser from "expo-web-browser";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { Feather } from "@expo/vector-icons";

export interface NewsArticle {
  id: string;
  headline: string;
  source: string;
  timestamp: string;
  summary?: string;
  url?: string;
  thumbnailUrl?: string;
}

interface NewsItemProps {
  article: NewsArticle;
  isLast?: boolean;
}

export function NewsItem({ article, isLast }: NewsItemProps) {
  const handlePress = () => {
    if (!article.url) return;
    Haptics.selectionAsync();
    WebBrowser.openBrowserAsync(article.url).catch(() => {});
  };

  return (
    <Pressable
      style={({ pressed }) => [
        styles.container,
        !isLast && styles.bordered,
        pressed && article.url ? styles.pressed : null,
      ]}
      onPress={handlePress}
      disabled={!article.url}
    >
      <View style={styles.content}>
        <View style={styles.meta}>
          <Text style={styles.source} numberOfLines={1}>
            {article.source}
          </Text>
          <Text style={styles.dot}>·</Text>
          <Text style={styles.timestamp}>{article.timestamp}</Text>
        </View>
        <Text style={styles.headline} numberOfLines={3}>
          {article.headline}
        </Text>
        {article.summary ? (
          <Text style={styles.summary} numberOfLines={2}>
            {article.summary}
          </Text>
        ) : null}
      </View>

      {article.thumbnailUrl ? (
        <Image
          source={{ uri: article.thumbnailUrl }}
          style={styles.thumbnail}
        />
      ) : (
        <View style={[styles.thumbnail, styles.thumbnailPlaceholder]}>
          <Feather name="file-text" size={20} color={Colors.dark.goldDim} />
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  bordered: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.dark.border,
  },
  pressed: {
    opacity: 0.7,
  },
  content: {
    flex: 1,
    gap: 4,
  },
  meta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  source: {
    fontSize: 12,
    color: Colors.dark.textTertiary,
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    maxWidth: 180,
  },
  dot: {
    fontSize: 12,
    color: Colors.dark.textTertiary,
  },
  timestamp: {
    fontSize: 12,
    color: Colors.dark.textTertiary,
    fontFamily: "Inter_400Regular",
  },
  headline: {
    fontSize: 15,
    color: Colors.dark.text,
    fontFamily: "Inter_600SemiBold",
    lineHeight: 20,
  },
  summary: {
    fontSize: 13,
    color: Colors.dark.textSecondary,
    fontFamily: "Inter_400Regular",
    lineHeight: 18,
  },
  thumbnail: {
    width: 72,
    height: 72,
    borderRadius: 10,
    backgroundColor: Colors.dark.surface,
  },
  thumbnailPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.dark.goldFaint,
  },
});
