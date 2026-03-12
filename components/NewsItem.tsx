import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import Colors from "@/constants/colors";
import { Feather } from "@expo/vector-icons";

export interface NewsArticle {
  id: string;
  headline: string;
  source: string;
  timestamp: string;
  summary: string;
}

interface NewsItemProps {
  article: NewsArticle;
  isLast?: boolean;
}

export function NewsItem({ article, isLast }: NewsItemProps) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.container,
        !isLast && styles.bordered,
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.content}>
        <View style={styles.meta}>
          <Text style={styles.source}>{article.source}</Text>
          <Text style={styles.dot}>·</Text>
          <Text style={styles.timestamp}>{article.timestamp}</Text>
        </View>
        <Text style={styles.headline} numberOfLines={2}>
          {article.headline}
        </Text>
        <Text style={styles.summary} numberOfLines={2}>
          {article.summary}
        </Text>
      </View>
      <Feather
        name="chevron-right"
        size={16}
        color={Colors.dark.textTertiary}
        style={styles.chevron}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
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
    gap: 3,
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
  chevron: {
    marginLeft: 8,
  },
});
