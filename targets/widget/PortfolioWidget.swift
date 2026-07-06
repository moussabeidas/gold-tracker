import WidgetKit
import SwiftUI

struct PortfolioWidget: Widget {
  let kind = "PortfolioWidget"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: GoldProvider()) { entry in
      PortfolioView(entry: entry)
    }
    .configurationDisplayName("My Gold Portfolio")
    .description("Your holdings valued at the live gold price.")
    .supportedFamilies([.systemSmall, .systemMedium, .accessoryRectangular])
  }
}

struct PortfolioView: View {
  @Environment(\.widgetFamily) private var family
  let entry: GoldEntry

  var body: some View {
    switch family {
    case .accessoryRectangular:
      accessoryRectangular
    case .systemMedium:
      systemMedium.widgetBackground()
    default:
      systemSmall.widgetBackground()
    }
  }

  private var empty: some View {
    VStack(alignment: .leading, spacing: 6) {
      CoinMark(size: 22)
      Spacer(minLength: 0)
      Text("Add your gold")
        .font(.system(size: 15, weight: .bold, design: .rounded))
        .foregroundStyle(.white)
      Text("Track its live value here.")
        .font(.system(size: 11, weight: .medium))
        .foregroundStyle(.white.opacity(0.5))
    }
    .padding(14)
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
  }

  // MARK: System small

  private var systemSmall: some View {
    if entry.hasHoldings {
      return AnyView(
        VStack(alignment: .leading, spacing: 4) {
          HStack(spacing: 6) {
            CoinMark(size: 18)
            Text("PORTFOLIO")
              .font(.system(size: 11, weight: .heavy, design: .rounded))
              .foregroundStyle(goldGradient)
          }
          Spacer(minLength: 0)
          Text(fmtUsd(entry.portfolioValue))
            .font(.system(size: 24, weight: .bold, design: .rounded))
            .foregroundStyle(.white)
            .minimumScaleFactor(0.5)
            .lineLimit(1)
          ChangeBadge(
            value: entry.portfolioGain, pct: entry.portfolioGainPct,
            isUp: entry.portfolioGain >= 0
          )
          Text("\(fmtGrams(entry.snapshot.pureGrams)) · \(entry.snapshot.holdingsCount) items")
            .font(.system(size: 10, weight: .medium))
            .foregroundStyle(.white.opacity(0.45))
            .lineLimit(1)
        }
        .padding(14)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
      )
    }
    return AnyView(empty)
  }

  // MARK: System medium

  private var systemMedium: some View {
    if entry.hasHoldings {
      return AnyView(
        VStack(alignment: .leading, spacing: 10) {
          HStack(spacing: 6) {
            CoinMark(size: 20)
            Text("MY GOLD PORTFOLIO")
              .font(.system(size: 12, weight: .heavy, design: .rounded))
              .foregroundStyle(goldGradient)
            Spacer()
            Text(fmtUsd(entry.livePrice, fractionDigits: 0) + "/oz")
              .font(.system(size: 11, weight: .semibold))
              .foregroundStyle(.white.opacity(0.5))
          }
          HStack(alignment: .lastTextBaseline, spacing: 10) {
            Text(fmtUsd(entry.portfolioValue))
              .font(.system(size: 32, weight: .bold, design: .rounded))
              .foregroundStyle(.white)
              .minimumScaleFactor(0.6)
              .lineLimit(1)
            ChangeBadge(
              value: entry.portfolioGain, pct: entry.portfolioGainPct,
              isUp: entry.portfolioGain >= 0
            )
          }
          Spacer(minLength: 0)
          HStack {
            PortfolioStat(label: "HOLDINGS", value: fmtGrams(entry.snapshot.pureGrams))
            Spacer()
            PortfolioStat(label: "INVESTED", value: fmtUsd(entry.snapshot.costBasis, fractionDigits: 0))
            Spacer()
            PortfolioStat(label: "ITEMS", value: "\(entry.snapshot.holdingsCount)")
          }
        }
        .padding(18)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
      )
    }
    return AnyView(empty.frame(maxWidth: .infinity))
  }

  // MARK: Lock-screen accessory

  private var accessoryRectangular: some View {
    VStack(alignment: .leading, spacing: 2) {
      Text("GOLD PORTFOLIO")
        .font(.system(size: 12, weight: .semibold))
      if entry.hasHoldings {
        Text(fmtUsd(entry.portfolioValue))
          .font(.system(size: 22, weight: .bold, design: .rounded))
          .lineLimit(1)
          .minimumScaleFactor(0.6)
        Text("\(fmtSignedUsd(entry.portfolioGain)) · \(fmtPct(entry.portfolioGainPct))")
          .font(.system(size: 11, weight: .medium))
      } else {
        Text("Add your gold in the app")
          .font(.system(size: 13, weight: .medium))
      }
    }
    .frame(maxWidth: .infinity, alignment: .leading)
  }
}

struct PortfolioStat: View {
  let label: String
  let value: String
  var body: some View {
    VStack(alignment: .leading, spacing: 2) {
      Text(label)
        .font(.system(size: 8, weight: .bold))
        .foregroundStyle(.white.opacity(0.4))
      Text(value)
        .font(.system(size: 14, weight: .semibold, design: .rounded))
        .foregroundStyle(.white.opacity(0.9))
        .lineLimit(1)
        .minimumScaleFactor(0.7)
    }
  }
}

func fmtGrams(_ grams: Double) -> String {
  let f = NumberFormatter()
  f.numberStyle = .decimal
  f.maximumFractionDigits = grams >= 100 ? 0 : 1
  return (f.string(from: NSNumber(value: grams)) ?? "\(grams)") + "g"
}
