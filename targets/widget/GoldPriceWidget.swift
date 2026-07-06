import WidgetKit
import SwiftUI

struct GoldPriceWidget: Widget {
  let kind = "GoldPriceWidget"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: GoldProvider()) { entry in
      GoldPriceView(entry: entry)
    }
    .configurationDisplayName("Gold Price")
    .description("Live XAU/USD spot price.")
    .supportedFamilies([
      .systemSmall, .systemMedium,
      .accessoryRectangular, .accessoryInline, .accessoryCircular,
    ])
  }
}

struct GoldPriceView: View {
  @Environment(\.widgetFamily) private var family
  let entry: GoldEntry

  var body: some View {
    switch family {
    case .accessoryInline:
      Text("XAU \(fmtUsd(entry.livePrice, fractionDigits: 0)) \(fmtPct(entry.changePct))")
    case .accessoryCircular:
      accessoryCircular
    case .accessoryRectangular:
      accessoryRectangular
    case .systemMedium:
      systemMedium.widgetBackground()
    default:
      systemSmall.widgetBackground()
    }
  }

  // MARK: System small

  private var systemSmall: some View {
    VStack(alignment: .leading, spacing: 6) {
      HStack(spacing: 6) {
        CoinMark(size: 20)
        Text("GOLD")
          .font(.system(size: 13, weight: .heavy, design: .rounded))
          .foregroundStyle(goldGradient)
        Spacer()
      }
      Spacer(minLength: 0)
      Text(fmtUsd(entry.livePrice))
        .font(.system(size: 26, weight: .bold, design: .rounded))
        .foregroundStyle(.white)
        .minimumScaleFactor(0.6)
        .lineLimit(1)
      ChangeBadge(value: entry.change, pct: entry.changePct, isUp: entry.isUp)
      Text("per troy ounce")
        .font(.system(size: 10, weight: .medium))
        .foregroundStyle(.white.opacity(0.45))
    }
    .padding(14)
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
  }

  // MARK: System medium

  private var systemMedium: some View {
    HStack(spacing: 16) {
      VStack(alignment: .leading, spacing: 8) {
        HStack(spacing: 6) {
          CoinMark(size: 22)
          Text("GOLD · XAU/USD")
            .font(.system(size: 12, weight: .heavy, design: .rounded))
            .foregroundStyle(goldGradient)
        }
        Text(fmtUsd(entry.livePrice))
          .font(.system(size: 34, weight: .bold, design: .rounded))
          .foregroundStyle(.white)
          .minimumScaleFactor(0.6)
          .lineLimit(1)
        ChangeBadge(value: entry.change, pct: entry.changePct, isUp: entry.isUp)
      }
      Spacer()
      VStack(alignment: .trailing, spacing: 4) {
        Text("PER GRAM")
          .font(.system(size: 9, weight: .bold))
          .foregroundStyle(.white.opacity(0.4))
        Text(fmtUsd(entry.pricePerGram))
          .font(.system(size: 18, weight: .semibold, design: .rounded))
          .foregroundStyle(.white.opacity(0.9))
        Spacer().frame(height: 4)
        Text("24K · 999.9")
          .font(.system(size: 10, weight: .medium))
          .foregroundStyle(Color.goldTop.opacity(0.8))
      }
    }
    .padding(18)
    .frame(maxWidth: .infinity, maxHeight: .infinity)
  }

  // MARK: Lock-screen accessories

  private var accessoryCircular: some View {
    ZStack {
      AccessoryWidgetBackground()
      VStack(spacing: 0) {
        Text("XAU")
          .font(.system(size: 11, weight: .bold))
        Text(fmtUsd(entry.livePrice, fractionDigits: 0))
          .font(.system(size: 13, weight: .semibold, design: .rounded))
          .minimumScaleFactor(0.5)
          .lineLimit(1)
        Text(fmtPct(entry.changePct))
          .font(.system(size: 9, weight: .medium))
      }
    }
  }

  private var accessoryRectangular: some View {
    VStack(alignment: .leading, spacing: 2) {
      HStack(spacing: 4) {
        Image(systemName: "circle.hexagongrid.fill")
          .font(.system(size: 12))
        Text("GOLD · XAU/USD")
          .font(.system(size: 12, weight: .semibold))
      }
      Text(fmtUsd(entry.livePrice))
        .font(.system(size: 22, weight: .bold, design: .rounded))
        .lineLimit(1)
        .minimumScaleFactor(0.6)
      Text("\(fmtSignedUsd(entry.change)) · \(fmtPct(entry.changePct)) today")
        .font(.system(size: 11, weight: .medium))
    }
    .frame(maxWidth: .infinity, alignment: .leading)
  }
}

// MARK: - Shared subviews

struct ChangeBadge: View {
  let value: Double
  let pct: Double
  let isUp: Bool

  var body: some View {
    HStack(spacing: 4) {
      Image(systemName: isUp ? "arrow.up.right" : "arrow.down.right")
        .font(.system(size: 10, weight: .bold))
      Text("\(fmtSignedUsd(value)) (\(fmtPct(pct)))")
        .font(.system(size: 12, weight: .semibold, design: .rounded))
        .lineLimit(1)
        .minimumScaleFactor(0.7)
    }
    .foregroundStyle(isUp ? Color.upColor : Color.downColor)
    .padding(.horizontal, 8)
    .padding(.vertical, 4)
    .background(
      Capsule().fill((isUp ? Color.upColor : Color.downColor).opacity(0.15))
    )
  }
}

struct CoinMark: View {
  let size: CGFloat
  var body: some View {
    ZStack {
      Circle().fill(goldGradient)
      Text("Au")
        .font(.system(size: size * 0.42, weight: .heavy, design: .rounded))
        .foregroundStyle(Color(red: 0.35, green: 0.24, blue: 0.02))
    }
    .frame(width: size, height: size)
  }
}
