import WidgetKit
import SwiftUI

let APP_GROUP = "group.com.mbeidas.goldtracker"
let TROY_OUNCE_GRAMS = 31.1035
let SPOT_URL = "https://api.gold-api.com/price/XAU"

// Coerce whatever the JS bridge wrote (NSNumber, String) into a Double.
func asDouble(_ value: Any?) -> Double? {
  if let n = value as? NSNumber { return n.doubleValue }
  if let s = value as? String { return Double(s) }
  return nil
}

/// The figures the app mirrors into the shared App Group container.
struct GoldSnapshot {
  var price: Double
  var prevClose: Double
  var pureGrams: Double
  var costBasis: Double
  var holdingsCount: Int
  var updatedAt: Date

  static let fallback = GoldSnapshot(
    price: 3150.4, prevClose: 3118.5, pureGrams: 0, costBasis: 0,
    holdingsCount: 0, updatedAt: Date()
  )

  static func load() -> GoldSnapshot {
    guard
      let dict = UserDefaults(suiteName: APP_GROUP)?.dictionary(forKey: "goldWidget")
    else { return .fallback }
    let updated = asDouble(dict["updatedAt"]) ?? Date().timeIntervalSince1970
    return GoldSnapshot(
      price: asDouble(dict["price"]) ?? fallback.price,
      prevClose: asDouble(dict["prevClose"]) ?? fallback.prevClose,
      pureGrams: asDouble(dict["pureGrams"]) ?? 0,
      costBasis: asDouble(dict["costBasis"]) ?? 0,
      holdingsCount: Int(asDouble(dict["holdingsCount"]) ?? 0),
      updatedAt: Date(timeIntervalSince1970: updated)
    )
  }
}

/// One timeline entry: the stored snapshot plus a freshly fetched spot price.
struct GoldEntry: TimelineEntry {
  let date: Date
  let snapshot: GoldSnapshot
  let livePrice: Double

  var change: Double { livePrice - snapshot.prevClose }
  var changePct: Double {
    snapshot.prevClose > 0 ? (change / snapshot.prevClose) * 100 : 0
  }
  var isUp: Bool { change >= 0 }
  var pricePerGram: Double { livePrice / TROY_OUNCE_GRAMS }
  var portfolioValue: Double { snapshot.pureGrams * pricePerGram }
  var portfolioGain: Double { portfolioValue - snapshot.costBasis }
  var portfolioGainPct: Double {
    snapshot.costBasis > 0 ? (portfolioGain / snapshot.costBasis) * 100 : 0
  }
  var hasHoldings: Bool { snapshot.holdingsCount > 0 && snapshot.pureGrams > 0 }
}

/// Fetch the live spot price; the widget stays current even when the app
/// hasn't been opened. Extensions may make network requests without any
/// extra entitlement.
func fetchSpot() async -> Double? {
  guard let url = URL(string: SPOT_URL) else { return nil }
  do {
    let (data, _) = try await URLSession.shared.data(from: url)
    let obj = try JSONSerialization.jsonObject(with: data) as? [String: Any]
    if let p = asDouble(obj?["price"]), p > 500, p < 20000 { return p }
  } catch {}
  return nil
}

/// Timeline provider shared by every widget family. Refreshes every 15 min.
struct GoldProvider: TimelineProvider {
  func placeholder(in context: Context) -> GoldEntry {
    let snap = GoldSnapshot.fallback
    return GoldEntry(date: Date(), snapshot: snap, livePrice: snap.price)
  }

  func getSnapshot(in context: Context, completion: @escaping (GoldEntry) -> Void) {
    let snap = GoldSnapshot.load()
    completion(GoldEntry(date: Date(), snapshot: snap, livePrice: snap.price))
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<GoldEntry>) -> Void) {
    Task {
      let snap = GoldSnapshot.load()
      let live = await fetchSpot() ?? snap.price
      let entry = GoldEntry(date: Date(), snapshot: snap, livePrice: live)
      let next = Calendar.current.date(byAdding: .minute, value: 15, to: Date())!
      completion(Timeline(entries: [entry], policy: .after(next)))
    }
  }
}

// MARK: - Formatting helpers

func fmtUsd(_ value: Double, fractionDigits: Int = 2) -> String {
  let f = NumberFormatter()
  f.numberStyle = .decimal
  f.minimumFractionDigits = fractionDigits
  f.maximumFractionDigits = fractionDigits
  return "$" + (f.string(from: NSNumber(value: value)) ?? String(format: "%.2f", value))
}

func fmtSignedUsd(_ value: Double) -> String {
  (value >= 0 ? "+" : "−") + fmtUsd(abs(value))
}

func fmtPct(_ value: Double) -> String {
  String(format: "%@%.2f%%", value >= 0 ? "+" : "−", abs(value))
}

// MARK: - Brand palette

extension Color {
  static let goldTop = Color("goldTop")
  static let goldBottom = Color("goldBottom")
  static let widgetBg = Color("widgetBg")
  static let upColor = Color("up")
  static let downColor = Color("down")
}

var goldGradient: LinearGradient {
  LinearGradient(
    colors: [.goldTop, .goldBottom],
    startPoint: .topLeading, endPoint: .bottomTrailing
  )
}

var bgGradient: LinearGradient {
  LinearGradient(
    colors: [Color(red: 0.09, green: 0.09, blue: 0.11),
             Color(red: 0.04, green: 0.04, blue: 0.06)],
    startPoint: .top, endPoint: .bottom
  )
}

extension View {
  /// Full-bleed dark background that also satisfies the iOS 17 requirement
  /// that widgets declare a `containerBackground`.
  @ViewBuilder
  func widgetBackground() -> some View {
    if #available(iOS 17.0, *) {
      self.containerBackground(for: .widget) { bgGradient }
    } else {
      self.background(bgGradient)
    }
  }
}
